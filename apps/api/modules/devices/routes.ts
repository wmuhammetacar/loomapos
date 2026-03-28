import { Router } from "express";
import { Prisma as PrismaRuntime, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../infra/prisma/client";
import { requireAuth, requireRoles } from "../../src-node/middleware/auth";
import { CUSTOMER_INTERNAL_ROLES } from "../../src-node/security/roles";
import { ApiError, asyncHandler, readRouteParam } from "../../src-node/utils/http";
import { canAllocateDeviceSlot, requiresNewSlot } from "../license/device-slot-policy";

const registerDeviceSchema = z.object({
  deviceId: z.string().min(3).max(128),
  fingerprint: z.string().min(8).max(256),
  branchId: z.string().cuid(),
  name: z.string().min(1).max(120).optional()
});

export const devicesRouter = Router();

devicesRouter.use(requireAuth);
devicesRouter.use(requireRoles(CUSTOMER_INTERNAL_ROLES));

devicesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;

    const devices = await prisma.device.findMany({
      where: {
        tenantId
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        activatedAt: "desc"
      }
    });

    return res.json({ devices });
  })
);

devicesRouter.get(
  "/abnormal-activations",
  requireRoles([UserRole.owner, UserRole.admin]),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;

    const audits = await prisma.deviceActivationAudit.findMany({
      where: {
        tenantId,
        outcome: {
          in: ["blocked", "denied"]
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 100
    });

    return res.json({ audits });
  })
);

devicesRouter.post(
  "/",
  requireRoles([UserRole.owner, UserRole.admin]),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const body = registerDeviceSchema.parse(req.body);

    const device = await withSerializableRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const [branch, activeLicense] = await Promise.all([
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
            })
          ]);

          const crossTenantFingerprint = await tx.device.findFirst({
            where: {
              fingerprint: body.fingerprint,
              tenantId: {
                not: tenantId
              },
              status: "active"
            },
            select: {
              id: true
            }
          });

          if (!branch) {
            throw new ApiError(404, "Branch not found");
          }

          if (!activeLicense) {
            throw new ApiError(403, "Active license required");
          }

          if (crossTenantFingerprint) {
            throw new ApiError(409, "Device fingerprint already active on another tenant");
          }

          const existing = await tx.device.findFirst({
            where: {
              tenantId,
              OR: [{ deviceId: body.deviceId }, { fingerprint: body.fingerprint }]
            }
          });

          if (existing && existing.status === "active") {
            throw new ApiError(409, "Device already registered");
          }

          const activeCount = await tx.device.count({
            where: {
              tenantId,
              status: "active",
              ...(existing ? { id: { not: existing.id } } : {})
            }
          });

          if (
            requiresNewSlot(existing) &&
            !canAllocateDeviceSlot(activeCount, activeLicense.maxDevices)
          ) {
            throw new ApiError(409, "Device limit reached");
          }

          const now = new Date();
          const offlineUntil = new Date(
            now.getTime() + activeLicense.offlineGraceHours * 60 * 60 * 1000
          );

          if (existing) {
            return tx.device.update({
              where: {
                id: existing.id
              },
              data: {
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
          }

          return tx.device.create({
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
        },
        {
          isolationLevel: PrismaRuntime.TransactionIsolationLevel.Serializable
        }
      )
    );

    return res.status(201).json({ device });
  })
);

devicesRouter.patch(
  "/:deviceId/deactivate",
  requireRoles([UserRole.owner, UserRole.admin]),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const deviceId = readRouteParam(req.params.deviceId, "deviceId");

    const device = await prisma.device.findFirst({
      where: {
        tenantId,
        deviceId
      }
    });

    if (!device) {
      throw new ApiError(404, "Device not found");
    }

    const updated = await prisma.device.update({
      where: {
        id: device.id
      },
      data: {
        status: "deactivated",
        offlineUntil: null,
        lastSeenAt: new Date()
      }
    });

    return res.json({ device: updated });
  })
);

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
