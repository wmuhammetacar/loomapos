import { prisma } from "../infra/prisma/client";
import { hashPassword } from "../src-node/utils/password";
import { getPlanLimits, getTrialEndDate } from "../src-node/config/plans";

async function main() {
  const email = "owner@demo.local";

  const existing = await prisma.user.findFirst({
    where: {
      email
    },
    include: {
      tenant: true
    }
  });

  if (existing) {
    // eslint-disable-next-line no-console
    console.log("Seed already exists:", existing.tenant.name, existing.email);
    return;
  }

  const now = new Date();
  const trialEnd = getTrialEndDate(now);
  const limits = getPlanLimits("starter");

  const passwordHash = await hashPassword("ChangeMe123!");

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: "Demo Magaza",
        planCode: "starter",
        status: "trial",
        trialEndsAt: trialEnd
      }
    });

    const branch = await tx.branch.create({
      data: {
        tenantId: tenant.id,
        name: "Merkez",
        code: "HQ"
      }
    });

    const owner = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email,
        passwordHash,
        fullName: "Demo Owner",
        role: "owner",
        status: "active"
      }
    });

    const subscription = await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        planCode: "starter",
        billingCycle: "monthly",
        status: "trial",
        startAt: now,
        endAt: trialEnd
      }
    });

    const license = await tx.license.create({
      data: {
        tenantId: tenant.id,
        subscriptionId: subscription.id,
        key: `LIC-DEMO-${tenant.id.slice(0, 8).toUpperCase()}`,
        status: "active",
        expiresAt: trialEnd,
        maxDevices: limits.maxDevices,
        maxBranches: limits.maxBranches,
        maxStaff: limits.maxStaff,
        featureFlags: limits.features,
        offlineGraceHours: 72,
        revalidationRequiredAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
      }
    });

    return { tenant, branch, owner, subscription, license };
  });

  // eslint-disable-next-line no-console
  console.log("Seed completed:", {
    tenantId: result.tenant.id,
    branchId: result.branch.id,
    ownerEmail: result.owner.email,
    licenseKey: result.license.key
  });
}

void main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
