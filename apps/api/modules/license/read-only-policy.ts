import type { SubscriptionStatus, TenantStatus } from "@prisma/client";

export function isReadOnlyMode(params: {
  tenantStatus: TenantStatus;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionEndAt: Date | null;
  now: Date;
}) {
  if (params.tenantStatus === "suspended" || params.tenantStatus === "expired") {
    return true;
  }

  if (!params.subscriptionStatus || !params.subscriptionEndAt) {
    return true;
  }

  return params.subscriptionEndAt.getTime() <= params.now.getTime();
}

