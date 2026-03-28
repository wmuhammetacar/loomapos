import { Router } from "express";
import { Prisma as PrismaRuntime, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../infra/prisma/client";
import { redis } from "../../infra/redis/client";
import { env } from "../../src-node/config/env";
import { requireAuth, requireRoles } from "../../src-node/middleware/auth";
import { CUSTOMER_INTERNAL_ROLES } from "../../src-node/security/roles";
import { ApiError, asyncHandler } from "../../src-node/utils/http";
import { canAllocateDeviceSlot, requiresNewSlot } from "./device-slot-policy";

const validateDeviceSchema = z.object({
  deviceId: z.string().min(3).max(128),
  fingerprint: z.string().min(8).max(256),
  branchId: z.string().cuid(),
  name: z.string().min(1).max(120).optional()
});

const revalidateSchema = z.object({
  deviceId: z.string().min(3).max(128),
  fingerprint: z.string().min(8).max(256)
});

const deactivateSchema = z.object({
  deviceId: z.string().min(3).max(128)
});

export const licenseRouter = Router();

licenseRouter.use(requireAuth);
licenseRouter.use(requireRoles(CUSTOMER_INTERNAL_ROLES));

licenseRouter.get(
  "/current",
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const summary = await loadLicenseSummary(tenantId);

    return res.json(summary);
  })
);

licenseRouter.get(
  "/features",
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const summary = await loadLicenseSummary(tenantId);

    if (!summary.license) {
      throw new ApiError(404, "Active license not found");
    }

    return res.json({
      planCode: summary.subscription?.planCode ?? summary.tenant.planCode,
      features: summary.license.featureFlags,
      limits: {
        maxDevices: summary.license.maxDevices,
        maxBranches: summary.license.maxBranches,
        maxStaff: summary.license.maxStaff
      }
    });
  })
);

licenseRouter.get(
  "/operation-access",
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const summary = await loadLicenseSummary(tenantId);

    const canCreateSales = Boolean(summary.license && summary.license.status === "active" && !summary.isReadOnlyMode);

    return res.json({
      mode: canCreateSales ? "operational" : "read_only",
      canCreateSales,
      reason: canCreateSales ? null : "subscription_or_trial_expired"
    });
  })
);

licenseRouter.post(
  "/validate-device",
  requireRoles([UserRole.owner, UserRole.admin, UserRole.staff]),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const body = validateDeviceSchema.parse(req.body);

    const summary = await loadLicenseSummary(tenantId);

    if (!summary.license || summary.license.status !== "active") {
      throw new ApiError(403, "Active license required for device activation");
    }

    if (summary.isReadOnlyMode) {
      throw new ApiError(402, "License expired. Tenant is in read-only mode");
    }

    let device:
      | {
          id: string;
          deviceId: string;
          branchId: string;
          status: string;
          offlineUntil: Date | null;
        }
      | null = null;

    try {
      const result = await withSerializableRetry(() =>
        prisma.$transaction(
          async (tx) => {
            const [branch, activeLicense, crossTenantFingerprint] = await Promise.all([
              tx.branch.findFirst({
                where: {
                  id: body.branchId,
                  tenantId
                }
              }),
              tx.license.findFirst({
                where: {
                  tenantId,
                  status: "active",
                  activeSlot: tenantId
                },
                orderBy: {
                  issuedAt: "desc"
                }
              }),
              tx.device.findFirst({
                where: {
                  fingerprint: body.fingerprint,
                  tenantId: {
                    not: tenantId
                  },
                  status: "active"
                },
                select: {
                  id: true,
                  tenantId: true
                }
              })
            ]);

            if (!branch) {
              throw new ApiError(404, "Branch not found");
            }

            if (!activeLicense) {
              throw new ApiError(403, "Active license required for device activation");
            }

            if (crossTenantFingerprint) {
              throw new ApiError(409, "Device fingerprint already active on another tenant");
            }

            const existingDevice = await tx.device.findFirst({
              where: {
                tenantId,
                OR: [{ deviceId: body.deviceId }, { fingerprint: body.fingerprint }]
              }
            });

            const activeDeviceCount = await tx.device.count({
              where: {
                tenantId,
                status: "active",
                ...(existingDevice ? { id: { not: existingDevice.id } } : {})
              }
            });

            if (
              requiresNewSlot(existingDevice) &&
              !canAllocateDeviceSlot(activeDeviceCount, activeLicense.maxDevices)
            ) {
              throw new ApiError(409, "Device limit reached for current plan");
            }

            const now = new Date();
            const offlineUntil = new Date(
              now.getTime() + activeLicense.offlineGraceHours * 60 * 60 * 1000
            );

            const savedDevice = existingDevice
              ? await tx.device.update({
                  where: { id: existingDevice.id },
                  data: {
                    branchId: branch.id,
                    deviceId: body.deviceId,
                    fingerprint: body.fingerprint,
                    name: body.name,
                    status: "active",
                    lastSeenAt: now,
                    offlineUntil
                  }
                })
              : await tx.device.create({
                  data: {
                    tenantId,
                    branchId: branch.id,
                    deviceId: body.deviceId,
                    fingerprint: body.fingerprint,
                    name: body.name,
                    status: "active",
                    activatedAt: now,
                    lastSeenAt: now,
                    offlineUntil
                  }
                });

            return {
              device: savedDevice,
              reason: existingDevice ? "revalidated" : "activated"
            };
          },
          {
            isolationLevel: PrismaRuntime.TransactionIsolationLevel.Serializable
          }
        )
      );

      device = result.device;

      await writeActivationAudit({
        tenantId,
        deviceId: device.id,
        fingerprint: body.fingerprint,
        outcome: "success",
        reason: result.reason,
        req
      });
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 409) {
        await writeActivationAudit({
          tenantId,
          fingerprint: body.fingerprint,
          outcome: error.message.includes("fingerprint") ? "blocked" : "denied",
          reason: error.message.includes("fingerprint")
            ? "fingerprint_registered_other_tenant"
            : "device_limit_exceeded",
          req
        });
      }

      throw error;
    }

    if (!device) {
      throw new ApiError(500, "Device activation failed");
    }

    await cacheLicenseSummary(tenantId, {
      licenseId: summary.license.id,
      planCode: summary.subscription?.planCode ?? summary.tenant.planCode,
      expiresAt: summary.license.expiresAt.toISOString(),
      offlineGraceHours: summary.license.offlineGraceHours
    });

    return res.json({
      activation: {
        tenantId,
        deviceId: device.deviceId,
        branchId: device.branchId,
        status: device.status,
        validatedAt: new Date(),
        offlineValidUntil: device.offlineUntil
      },
      license: {
        key: summary.license.key,
        expiresAt: summary.license.expiresAt,
        features: summary.license.featureFlags
      }
    });
  })
);

licenseRouter.post(
  "/revalidate",
  requireRoles([UserRole.owner, UserRole.admin, UserRole.staff]),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const body = revalidateSchema.parse(req.body);

    const summary = await loadLicenseSummary(tenantId);

    if (!summary.license || summary.license.status !== "active") {
      throw new ApiError(403, "Active license required for revalidation");
    }

    if (summary.isReadOnlyMode) {
      throw new ApiError(402, "License expired. Tenant is in read-only mode");
    }

    const device = await prisma.device.findFirst({
      where: {
        tenantId,
        deviceId: body.deviceId,
        fingerprint: body.fingerprint,
        status: "active"
      }
    });

    if (!device) {
      throw new ApiError(404, "Active device not found");
    }

    const now = new Date();
    const offlineUntil = new Date(now.getTime() + summary.license.offlineGraceHours * 60 * 60 * 1000);

    const updated = await prisma.device.update({
      where: {
        id: device.id
      },
      data: {
        lastSeenAt: now,
        offlineUntil
      }
    });

    await writeActivationAudit({
      tenantId,
      deviceId: device.id,
      fingerprint: body.fingerprint,
      outcome: "success",
      reason: "offline_revalidation",
      req
    });

    return res.json({
      device: {
        id: updated.deviceId,
        status: updated.status,
        offlineValidUntil: updated.offlineUntil
      }
    });
  })
);

licenseRouter.post(
  "/deactivate-device",
  requireRoles([UserRole.owner, UserRole.admin]),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const body = deactivateSchema.parse(req.body);

    const device = await prisma.device.findFirst({
      where: {
        tenantId,
        deviceId: body.deviceId
      }
    });

    if (!device) {
      throw new ApiError(404, "Device not found");
    }

    await prisma.device.update({
      where: { id: device.id },
      data: {
        status: "deactivated",
        offlineUntil: null,
        lastSeenAt: new Date()
      }
    });

    await writeActivationAudit({
      tenantId,
      deviceId: device.id,
      fingerprint: device.fingerprint,
      outcome: "success",
      reason: "manual_deactivation",
      req
    });

    return res.status(204).send();
  })
);

async function loadLicenseSummary(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: {
      id: tenantId
    },
    include: {
      subscription: true,
      licenses: {
        where: {
          status: {
            in: ["active", "read_only"]
          }
        },
        orderBy: {
          issuedAt: "desc"
        },
        take: 1
      }
    }
  });

  if (!tenant) {
    throw new ApiError(404, "Tenant not found");
  }

  const license = tenant.licenses[0] ?? null;
  const now = new Date();
  const subscriptionExpired = Boolean(tenant.subscription && tenant.subscription.endAt <= now);
  const trialExpired = tenant.subscription?.status === "trial" && subscriptionExpired;
  const paidExpired = tenant.subscription?.status !== "trial" && subscriptionExpired;
  const isReadOnlyMode = tenant.status === "expired" || tenant.status === "suspended" || trialExpired || paidExpired;

  if (isReadOnlyMode && license?.status === "active") {
    await prisma.license.update({
      where: {
        id: license.id
      },
      data: {
        status: "read_only",
        activeSlot: null,
        expiresAt: now
      }
    });
  }

  return {
    tenant,
    subscription: tenant.subscription,
    license: license && isReadOnlyMode ? { ...license, status: "read_only" as const } : license,
    isReadOnlyMode
  };
}

async function writeActivationAudit(args: {
  tenantId: string;
  deviceId?: string;
  fingerprint: string;
  outcome: string;
  reason?: string;
  req: { ip?: string; headers: { [key: string]: unknown } };
}) {
  await prisma.deviceActivationAudit.create({
    data: {
      tenantId: args.tenantId,
      deviceId: args.deviceId,
      fingerprint: args.fingerprint,
      outcome: args.outcome,
      reason: args.reason,
      ipAddress: args.req.ip,
      userAgent: typeof args.req.headers["user-agent"] === "string" ? args.req.headers["user-agent"] : null
    }
  });
}

async function cacheLicenseSummary(
  tenantId: string,
  payload: {
    licenseId: string;
    planCode: string;
    expiresAt: string;
    offlineGraceHours: number;
  }
) {
  try {
    await redis.set(`license:summary:${tenantId}`, JSON.stringify(payload), "EX", 60);
  } catch {
    // Redis cache is an optimization; API logic remains DB-backed.
  }
}

async function withSerializableRetry<T>(work: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      lastError = error;

      if (!isSerializableConflict(error) || attempt === maxAttempts) {
        throw error;
      }
    }
  }

  throw lastError;
}

function isSerializableConflict(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const knownCode = (error as { code?: string }).code;
  if (knownCode === "P2034") {
    return true;
  }

  const message = (error as { message?: string }).message;
  return typeof message === "string" && message.toLowerCase().includes("serialization");
}
