import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../infra/prisma/client";
import { requireInternalAdmin } from "../../src-node/middleware/internal-admin";
import { ApiError, asyncHandler, readRouteParam } from "../../src-node/utils/http";

const suspendSchema = z.object({
  suspended: z.boolean(),
  reason: z.string().max(300).optional()
});

const extendTrialSchema = z.object({
  days: z.number().int().min(1).max(60)
});

const overrideLicenseSchema = z.object({
  maxDevices: z.number().int().min(1).max(5000).optional(),
  maxBranches: z.number().int().min(1).max(2000).optional(),
  maxStaff: z.number().int().min(1).max(10000).optional(),
  expiresAt: z.coerce.date().optional(),
  featureFlags: z.array(z.string().min(2)).max(200).optional()
});

export const adminRouter = Router();

adminRouter.use(requireInternalAdmin);

adminRouter.get(
  "/tenants",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 20)));
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const where = q
      ? {
          OR: [
            {
              name: {
                contains: q,
                mode: "insensitive" as const
              }
            },
            {
              users: {
                some: {
                  email: {
                    contains: q,
                    mode: "insensitive" as const
                  }
                }
              }
            }
          ]
        }
      : {};

    const [total, tenants] = await Promise.all([
      prisma.tenant.count({ where }),
      prisma.tenant.findMany({
        where,
        include: {
          subscription: true,
          users: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true
            },
            take: 3
          },
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
        },
        orderBy: {
          createdAt: "desc"
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return res.json({
      page,
      pageSize,
      total,
      tenants
    });
  })
);

adminRouter.get(
  "/tenants/:tenantId",
  asyncHandler(async (req, res) => {
    const tenantId = readRouteParam(req.params.tenantId, "tenantId");

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription: true,
        users: true,
        branches: true,
        licenses: {
          orderBy: {
            issuedAt: "desc"
          },
          take: 5
        }
      }
    });

    if (!tenant) {
      throw new ApiError(404, "Tenant not found");
    }

    return res.json({ tenant });
  })
);

adminRouter.patch(
  "/tenants/:tenantId/suspend",
  asyncHandler(async (req, res) => {
    const body = suspendSchema.parse(req.body);
    const tenantId = readRouteParam(req.params.tenantId, "tenantId");

    const tenant = await prisma.tenant.findUnique({
      where: {
        id: tenantId
      }
    });

    if (!tenant) {
      throw new ApiError(404, "Tenant not found");
    }

    const updatedTenant = await prisma.tenant.update({
      where: {
        id: tenant.id
      },
      data: {
        status: body.suspended ? "suspended" : "active",
        suspendedAt: body.suspended ? new Date() : null
      }
    });

    if (body.suspended) {
      await prisma.license.updateMany({
        where: {
          tenantId: tenant.id,
          status: "active"
        },
        data: {
          status: "suspended",
          activeSlot: null
        }
      });
    } else {
      const candidate = await prisma.license.findFirst({
        where: {
          tenantId: tenant.id,
          status: {
            in: ["suspended", "read_only", "expired"]
          }
        },
        orderBy: {
          issuedAt: "desc"
        }
      });

      if (candidate) {
        await prisma.license.update({
          where: {
            id: candidate.id
          },
          data: {
            status: "active",
            activeSlot: tenant.id
          }
        });
      }

      await prisma.license.updateMany({
        where: {
          tenantId: tenant.id,
          status: "active",
          ...(candidate ? { id: { not: candidate.id } } : {})
        },
        data: {
          status: "expired",
          activeSlot: null
        }
      });
    }

    return res.json({
      tenant: updatedTenant,
      note: body.reason ?? null
    });
  })
);

adminRouter.patch(
  "/tenants/:tenantId/extend-trial",
  asyncHandler(async (req, res) => {
    const body = extendTrialSchema.parse(req.body);
    const tenantId = readRouteParam(req.params.tenantId, "tenantId");

    const tenant = await prisma.tenant.findUnique({
      where: {
        id: tenantId
      },
      include: {
        subscription: true
      }
    });

    if (!tenant || !tenant.subscription) {
      throw new ApiError(404, "Tenant or subscription not found");
    }

    const currentEnd = tenant.subscription.endAt;
    const nextEnd = new Date(currentEnd);
    nextEnd.setDate(nextEnd.getDate() + body.days);

    const [updatedTenant, updatedSubscription] = await prisma.$transaction([
      prisma.tenant.update({
        where: {
          id: tenant.id
        },
        data: {
          status: "trial",
          trialEndsAt: nextEnd,
          suspendedAt: null
        }
      }),
      prisma.subscription.update({
        where: {
          id: tenant.subscription.id
        },
        data: {
          status: "trial",
          endAt: nextEnd
        }
      })
    ]);

    const candidate = await prisma.license.findFirst({
      where: {
        tenantId: tenant.id,
        status: {
          in: ["active", "read_only", "expired", "suspended"]
        }
      },
      orderBy: {
        issuedAt: "desc"
      }
    });

    if (candidate) {
      await prisma.license.update({
        where: {
          id: candidate.id
        },
        data: {
          status: "active",
          activeSlot: tenant.id,
          expiresAt: nextEnd
        }
      });

      await prisma.license.updateMany({
        where: {
          tenantId: tenant.id,
          status: "active",
          id: {
            not: candidate.id
          }
        },
        data: {
          status: "expired",
          activeSlot: null
        }
      });
    }

    return res.json({
      tenant: updatedTenant,
      subscription: updatedSubscription
    });
  })
);

adminRouter.patch(
  "/tenants/:tenantId/license/override",
  asyncHandler(async (req, res) => {
    const body = overrideLicenseSchema.parse(req.body);
    const tenantId = readRouteParam(req.params.tenantId, "tenantId");

    const license = await prisma.license.findFirst({
      where: {
        tenantId,
        status: {
          in: ["active", "read_only", "suspended"]
        }
      },
      orderBy: {
        issuedAt: "desc"
      }
    });

    if (!license) {
      throw new ApiError(404, "License not found");
    }

    const updated = await prisma.license.update({
      where: {
        id: license.id
      },
      data: {
        maxDevices: body.maxDevices ?? license.maxDevices,
        maxBranches: body.maxBranches ?? license.maxBranches,
        maxStaff: body.maxStaff ?? license.maxStaff,
        expiresAt: body.expiresAt ?? license.expiresAt,
        featureFlags:
          (body.featureFlags ??
            (Array.isArray(license.featureFlags) ? license.featureFlags : [])) as Prisma.InputJsonValue
      }
    });

    return res.json({
      license: updated
    });
  })
);
