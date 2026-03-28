import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { SubscriptionStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../infra/prisma/client";
import {
  getPlanLimits,
  getPlanRank,
  getSubscriptionEndDate,
  isDowngrade,
  isUpgrade,
  type BillingCycle,
  type PlanCode
} from "../../src-node/config/plans";
import { requireAuth, requireRoles } from "../../src-node/middleware/auth";
import { ApiError, asyncHandler } from "../../src-node/utils/http";
import { env } from "../../src-node/config/env";
import { generateLicenseKey } from "../auth/service";
import { CUSTOMER_INTERNAL_ROLES } from "../../src-node/security/roles";
import { exceedsNextPlanLimits } from "./usage-policy";

const planEnum = z.enum(["starter", "growth", "enterprise"]);
const cycleEnum = z.enum(["monthly", "yearly"]);

const upgradeSchema = z.object({
  planCode: planEnum,
  billingCycle: cycleEnum.optional()
});

const downgradeSchema = z.object({
  planCode: planEnum
});

const cancelSchema = z.object({
  immediate: z.boolean().optional().default(false)
});

export const subscriptionRouter = Router();

subscriptionRouter.use(requireAuth);
subscriptionRouter.use(requireRoles(CUSTOMER_INTERNAL_ROLES));

subscriptionRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    await applyScheduledChanges(tenantId);

    const [subscription, activeLicense] = await Promise.all([
      prisma.subscription.findUnique({
        where: { tenantId }
      }),
      prisma.license.findFirst({
        where: {
          tenantId,
          status: "active"
        },
        orderBy: {
          issuedAt: "desc"
        }
      })
    ]);

    if (!subscription) {
      throw new ApiError(404, "Subscription not found");
    }

    return res.json({
      subscription,
      limits: activeLicense
        ? {
            maxDevices: activeLicense.maxDevices,
            maxBranches: activeLicense.maxBranches,
            maxStaff: activeLicense.maxStaff,
            features: activeLicense.featureFlags
          }
        : getPlanLimits(subscription.planCode)
    });
  })
);

subscriptionRouter.patch(
  "/upgrade",
  requireRoles([UserRole.owner, UserRole.admin]),
  asyncHandler(async (req, res) => {
    const body = upgradeSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId }
    });

    if (!subscription) {
      throw new ApiError(404, "Subscription not found");
    }

    const currentPlan = subscription.planCode as PlanCode;
    const currentCycle = subscription.billingCycle as BillingCycle;
    const targetPlan = body.planCode;
    const targetCycle = body.billingCycle ?? currentCycle;

    if (targetPlan === currentPlan && targetCycle === currentCycle) {
      throw new ApiError(400, "Subscription is already on target plan/cycle");
    }

    if (!isUpgrade(currentPlan, targetPlan) && targetCycle === currentCycle) {
      throw new ApiError(409, "Use downgrade flow for lower plans");
    }

    const now = new Date();
    const endAt = getSubscriptionEndDate(now, targetCycle);

    const updated = await prisma.$transaction(async (tx) => {
      const nextSubscription = await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          planCode: targetPlan,
          billingCycle: targetCycle,
          status: SubscriptionStatus.active,
          startAt: now,
          endAt,
          downgradePlanCode: null,
          cancelAt: null
        }
      });

      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          planCode: targetPlan,
          status: "active",
          trialEndsAt: null
        }
      });

      await syncLicenseWithPlan(tx, {
        tenantId,
        subscriptionId: nextSubscription.id,
        planCode: targetPlan,
        expiresAt: endAt
      });

      return nextSubscription;
    });

    return res.json({
      subscription: updated,
      action: "upgraded"
    });
  })
);

subscriptionRouter.patch(
  "/downgrade",
  requireRoles([UserRole.owner, UserRole.admin]),
  asyncHandler(async (req, res) => {
    const body = downgradeSchema.parse(req.body);
    const tenantId = req.auth!.tenantId;

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId }
    });

    if (!subscription) {
      throw new ApiError(404, "Subscription not found");
    }

    if (!isDowngrade(subscription.planCode, body.planCode)) {
      throw new ApiError(409, "Target plan is not a downgrade");
    }

    const [deviceUsage, branchUsage, staffUsage] = await Promise.all([
      prisma.device.count({ where: { tenantId, status: "active" } }),
      prisma.branch.count({ where: { tenantId } }),
      prisma.user.count({ where: { tenantId, status: "active" } })
    ]);

    const nextLimits = getPlanLimits(body.planCode);
    const overLimit = exceedsNextPlanLimits({
      usage: {
        devices: deviceUsage,
        branches: branchUsage,
        staff: staffUsage
      },
      nextLimits: {
        maxDevices: nextLimits.maxDevices,
        maxBranches: nextLimits.maxBranches,
        maxStaff: nextLimits.maxStaff
      }
    });

    if (overLimit) {
      throw new ApiError(409, "Current usage exceeds target plan limits");
    }

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        downgradePlanCode: body.planCode,
        status: SubscriptionStatus.scheduled_downgrade
      }
    });

    return res.json({
      subscription: updated,
      action: "downgrade_scheduled"
    });
  })
);

subscriptionRouter.patch(
  "/cancel",
  requireRoles([UserRole.owner, UserRole.admin]),
  asyncHandler(async (req, res) => {
    const body = cancelSchema.parse(req.body ?? {});
    const tenantId = req.auth!.tenantId;

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId }
    });

    if (!subscription) {
      throw new ApiError(404, "Subscription not found");
    }

    const now = new Date();

    if (body.immediate) {
      await prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.canceled,
            cancelAt: now,
            endAt: now
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

      return res.json({
        success: true,
        action: "canceled_immediately"
      });
    }

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.canceled,
        cancelAt: subscription.endAt
      }
    });

    return res.json({
      subscription: updated,
      action: "cancel_scheduled"
    });
  })
);

subscriptionRouter.post(
  "/apply-scheduled",
  requireRoles([UserRole.owner, UserRole.admin]),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const applied = await applyScheduledChanges(tenantId);

    return res.json({
      applied
    });
  })
);

async function applyScheduledChanges(tenantId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: {
      tenantId
    }
  });

  if (!subscription) {
    return false;
  }

  const now = new Date();

  if (subscription.cancelAt && subscription.cancelAt <= now) {
    await prisma.$transaction(async (tx) => {
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

    return true;
  }

  if (subscription.downgradePlanCode && subscription.endAt <= now) {
    const nextPlan = subscription.downgradePlanCode as PlanCode;
    const nextStart = now;
    const nextEnd = getSubscriptionEndDate(nextStart, subscription.billingCycle as BillingCycle);

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          planCode: nextPlan,
          status: SubscriptionStatus.active,
          startAt: nextStart,
          endAt: nextEnd,
          downgradePlanCode: null
        }
      });

      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          planCode: nextPlan,
          status: "active"
        }
      });

      await syncLicenseWithPlan(tx, {
        tenantId,
        subscriptionId: subscription.id,
        planCode: nextPlan,
        expiresAt: nextEnd
      });
    });

    return true;
  }

  return false;
}

async function syncLicenseWithPlan(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string;
    subscriptionId: string;
    planCode: PlanCode;
    expiresAt: Date;
  }
) {
  const limits = getPlanLimits(args.planCode);
  const activeLicense = await tx.license.findFirst({
    where: {
      tenantId: args.tenantId,
      status: "active"
    },
    orderBy: {
      issuedAt: "desc"
    }
  });

  const baseData = {
    subscriptionId: args.subscriptionId,
    activeSlot: args.tenantId,
    expiresAt: args.expiresAt,
    maxDevices: limits.maxDevices,
    maxBranches: limits.maxBranches,
    maxStaff: limits.maxStaff,
    featureFlags: limits.features,
    offlineGraceHours: env.OFFLINE_GRACE_HOURS,
    revalidationRequiredAt: new Date(Date.now() + env.OFFLINE_GRACE_HOURS * 60 * 60 * 1000)
  };

  if (activeLicense) {
    await tx.license.updateMany({
      where: {
        tenantId: args.tenantId,
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

    await tx.license.update({
      where: {
        id: activeLicense.id
      },
      data: baseData
    });
    return;
  }

  await tx.license.create({
    data: {
      tenantId: args.tenantId,
      key: generateLicenseKey(),
      status: "active",
      issuedAt: new Date(),
      ...baseData
    }
  });
}

export function isPaidPlan(planCode: string): boolean {
  return getPlanRank(planCode) >= getPlanRank("starter");
}
