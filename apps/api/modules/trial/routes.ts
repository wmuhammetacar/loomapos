import { Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../infra/prisma/client";
import { requireAuth, requireRoles } from "../../src-node/middleware/auth";
import { CUSTOMER_INTERNAL_ROLES } from "../../src-node/security/roles";
import { ApiError, asyncHandler } from "../../src-node/utils/http";

const extendTrialSchema = z.object({
  days: z.number().int().min(1).max(30)
});

export const trialRouter = Router();

trialRouter.use(requireAuth);
trialRouter.use(requireRoles(CUSTOMER_INTERNAL_ROLES));

trialRouter.get(
  "/status",
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const result = await evaluateTrialStatus(tenantId);

    return res.json(result);
  })
);

trialRouter.post(
  "/extend",
  requireRoles([UserRole.owner, UserRole.admin]),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const body = extendTrialSchema.parse(req.body);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription: true
      }
    });

    if (!tenant || !tenant.subscription) {
      throw new ApiError(404, "Trial not found");
    }

    if (tenant.subscription.status !== "trial") {
      throw new ApiError(409, "Only trial subscriptions can be extended");
    }

    const currentEnd = tenant.subscription.endAt;
    const nextEnd = new Date(currentEnd);
    nextEnd.setDate(nextEnd.getDate() + body.days);

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: tenant.subscription!.id },
        data: {
          endAt: nextEnd
        }
      });

      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          trialEndsAt: nextEnd,
          status: "trial"
        }
      });

      const activeLicense = await tx.license.findFirst({
        where: {
          tenantId,
          status: {
            in: ["active", "read_only", "expired", "suspended"]
          }
        },
        orderBy: {
          issuedAt: "desc"
        }
      });

      if (activeLicense) {
        await tx.license.update({
          where: {
            id: activeLicense.id
          },
          data: {
            expiresAt: nextEnd,
            status: "active",
            activeSlot: tenantId
          }
        });

        await tx.license.updateMany({
          where: {
            tenantId,
            status: "active",
            id: {
              not: activeLicense.id
            }
          },
          data: {
            status: "expired",
            activeSlot: null
          }
        });
      } else {
        throw new ApiError(404, "License not found for trial extension");
      }
    });

    return res.json({
      trialEndsAt: nextEnd,
      extendedDays: body.days
    });
  })
);

trialRouter.post(
  "/expire-check",
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const result = await evaluateTrialStatus(tenantId);

    return res.json(result);
  })
);

async function evaluateTrialStatus(tenantId: string) {
  const now = new Date();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: true
    }
  });

  if (!tenant || !tenant.subscription) {
    throw new ApiError(404, "Tenant or subscription not found");
  }

  const trialEndsAt = tenant.subscription.endAt;
  const remainingMs = trialEndsAt.getTime() - now.getTime();
  const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  const expired = remainingMs <= 0 && tenant.subscription.status === "trial";

  if (expired) {
    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: tenant.subscription!.id },
        data: {
          status: "past_due"
        }
      });

      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          status: "expired"
        }
      });

      await tx.license.updateMany({
        where: {
          tenantId,
          status: "active"
        },
        data: {
          status: "read_only",
          activeSlot: null,
          expiresAt: now
        }
      });
    });
  }

  return {
    tenantId,
    status: expired ? "expired" : tenant.status,
    trialEndsAt,
    remainingDays,
    readOnlyMode: expired
  };
}
