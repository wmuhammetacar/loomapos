import { Router } from "express";
import { prisma } from "../../infra/prisma/client";
import { requireAuth, requireRoles } from "../../src-node/middleware/auth";
import { asyncHandler, ApiError } from "../../src-node/utils/http";
import { getPlanLimits } from "../../src-node/config/plans";
import { CUSTOMER_INTERNAL_ROLES } from "../../src-node/security/roles";
import { z } from "zod";

const updateTenantSchema = z.object({
  name: z.string().min(2).max(120)
});

export const tenantRouter = Router();

tenantRouter.use(requireAuth);
tenantRouter.use(requireRoles(CUSTOMER_INTERNAL_ROLES));

tenantRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.auth!.tenantId },
      include: {
        subscription: true
      }
    });

    if (!tenant) {
      throw new ApiError(404, "Tenant not found");
    }

    return res.json({
      tenant
    });
  })
);

tenantRouter.patch(
  "/me",
  asyncHandler(async (req, res) => {
    const body = updateTenantSchema.parse(req.body);

    const tenant = await prisma.tenant.update({
      where: { id: req.auth!.tenantId },
      data: {
        name: body.name
      }
    });

    return res.json({
      tenant
    });
  })
);

tenantRouter.get(
  "/usage",
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;

    const [tenant, branchCount, deviceCount, staffCount] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscription: true,
          licenses: {
            where: {
              status: "active"
            },
            orderBy: {
              issuedAt: "desc"
            },
            take: 1
          }
        }
      }),
      prisma.branch.count({ where: { tenantId } }),
      prisma.device.count({ where: { tenantId, status: "active" } }),
      prisma.user.count({ where: { tenantId, status: "active" } })
    ]);

    if (!tenant) {
      throw new ApiError(404, "Tenant not found");
    }

    const planCode = tenant.subscription?.planCode ?? tenant.planCode;
    const planLimits = getPlanLimits(planCode as "starter" | "growth" | "enterprise");
    const activeLicense = tenant.licenses[0];

    return res.json({
      planCode,
      tenantStatus: tenant.status,
      usage: {
        branches: branchCount,
        devices: deviceCount,
        staff: staffCount
      },
      limits: {
        branches: activeLicense?.maxBranches ?? planLimits.maxBranches,
        devices: activeLicense?.maxDevices ?? planLimits.maxDevices,
        staff: activeLicense?.maxStaff ?? planLimits.maxStaff
      }
    });
  })
);
