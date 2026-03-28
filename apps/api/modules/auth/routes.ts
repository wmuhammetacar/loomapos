import { Router } from "express";
import { SubscriptionStatus, UserRole } from "@prisma/client";
import { prisma } from "../../infra/prisma/client";
import { requireAuth, requireRoles } from "../../src-node/middleware/auth";
import { asyncHandler, ApiError } from "../../src-node/utils/http";
import { hashPassword, verifyPassword } from "../../src-node/utils/password";
import { hashToken, verifyRefreshToken } from "../../src-node/utils/jwt";
import {
  getPlanLimits,
  getSubscriptionEndDate,
  getTrialEndDate,
  TRIAL_LIMITS
} from "../../src-node/config/plans";
import { generateLicenseKey, issueTokens } from "./service";
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from "./schemas";

export const authRouter = Router();

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);

    const existing = await prisma.user.findFirst({
      where: {
        email: body.email
      }
    });

    if (existing) {
      throw new ApiError(409, "Email already registered");
    }

    const passwordHash = await hashPassword(body.password);
    const now = new Date();
    const trialEnd = getTrialEndDate(now);

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: body.tenantName,
          status: "trial",
          planCode: "starter",
          trialEndsAt: trialEnd
        }
      });

      await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: "Merkez",
          code: "HQ"
        }
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: body.email,
          passwordHash,
          fullName: body.ownerName,
          role: UserRole.owner
        }
      });

      const subscription = await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planCode: "starter",
          billingCycle: "monthly",
          status: SubscriptionStatus.trial,
          startAt: now,
          endAt: trialEnd
        }
      });

      await tx.license.create({
        data: {
          tenantId: tenant.id,
          activeSlot: tenant.id,
          subscriptionId: subscription.id,
          key: generateLicenseKey(),
          status: "active",
          expiresAt: trialEnd,
          maxDevices: TRIAL_LIMITS.maxDevices,
          maxBranches: TRIAL_LIMITS.maxBranches,
          maxStaff: TRIAL_LIMITS.maxStaff,
          featureFlags: TRIAL_LIMITS.features,
          offlineGraceHours: 72,
          revalidationRequiredAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
        }
      });

      return { tenant, user, subscription };
    });

    const tokens = await issueTokens(result.user);

    return res.status(201).json({
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        status: result.tenant.status,
        trialEndsAt: result.tenant.trialEndsAt
      },
      subscription: {
        id: result.subscription.id,
        status: result.subscription.status,
        endAt: result.subscription.endAt
      },
      user: {
        id: result.user.id,
        fullName: result.user.fullName,
        role: result.user.role
      },
      tokens
    });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        email: body.email,
        ...(body.tenantId ? { tenantId: body.tenantId } : {})
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    if (!user) {
      throw new ApiError(401, "Invalid credentials");
    }

    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) {
      throw new ApiError(401, "Invalid credentials");
    }

    const tokens = await issueTokens(user);

    return res.json({
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
        fullName: user.fullName
      },
      tokens
    });
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const body = refreshSchema.parse(req.body);
    const payload = verifyRefreshToken(body.refreshToken);
    const tokenHash = hashToken(body.refreshToken);

    const stored = await prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        userId: payload.userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: true
      }
    });

    if (!stored) {
      throw new ApiError(401, "Refresh token invalid or expired");
    }

    const revoked = await prisma.refreshToken.updateMany({
      where: {
        id: stored.id,
        revokedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      data: { revokedAt: new Date() }
    });

    if (revoked.count !== 1) {
      throw new ApiError(401, "Refresh token invalid or already used");
    }

    const tokens = await issueTokens(stored.user);

    return res.json({
      tokens
    });
  })
);

authRouter.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = logoutSchema.parse(req.body ?? {});

    if (body.refreshToken) {
      await prisma.refreshToken.updateMany({
        where: {
          userId: req.auth!.userId,
          tokenHash: hashToken(body.refreshToken),
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });
    } else {
      await prisma.refreshToken.updateMany({
        where: {
          userId: req.auth!.userId,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });
    }

    return res.status(204).send();
  })
);

authRouter.post(
  "/trial/convert",
  requireAuth,
  requireRoles([UserRole.owner, UserRole.admin]),
  asyncHandler(async (req, res) => {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId: req.auth!.tenantId }
    });

    if (!subscription) {
      throw new ApiError(404, "Subscription not found");
    }

    const now = new Date();
    const limits = getPlanLimits(subscription.planCode as "starter" | "growth" | "enterprise");
    const endAt = getSubscriptionEndDate(now, subscription.billingCycle);

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: "active",
          startAt: now,
          endAt
        }
      });

      await tx.tenant.update({
        where: { id: req.auth!.tenantId },
        data: {
          status: "active",
          trialEndsAt: null,
          planCode: subscription.planCode
        }
      });

      const activeLicense = await tx.license.findFirst({
        where: {
          tenantId: req.auth!.tenantId,
          status: {
            in: ["active", "read_only", "expired", "suspended"]
          }
        },
        orderBy: {
          issuedAt: "desc"
        }
      });

      if (!activeLicense) {
        throw new ApiError(404, "License not found");
      }

      await tx.license.update({
        where: {
          id: activeLicense.id
        },
        data: {
          status: "active",
          expiresAt: endAt,
          activeSlot: req.auth!.tenantId,
          maxDevices: limits.maxDevices,
          maxBranches: limits.maxBranches,
          maxStaff: limits.maxStaff,
          featureFlags: limits.features,
          revalidationRequiredAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
        }
      });

      await tx.license.updateMany({
        where: {
          tenantId: req.auth!.tenantId,
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
    });

    return res.json({
      success: true,
      endAt
    });
  })
);
