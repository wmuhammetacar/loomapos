import { getStoredSession } from "@/lib/auth";
import { commerceFetch, type CommerceSupportLinkDto } from "@/lib/api-client";
import {
  loadCustomerPortalSnapshotWithFallback,
  loadResellerPortalSnapshotWithFallback,
  updateCompanyProfileWithFallback,
  type CompanyProfileInput,
  type CustomerPortalSnapshot
} from "@/lib/commerce-service";
import type { CommissionRecord } from "@/lib/commerce-state";
import { getPlanByCode, type BillingCycle, type PlanCode } from "@/lib/site-content";

const commerceFallbackEnabled =
  process.env.NEXT_PUBLIC_COMMERCE_FALLBACK_MODE === "enabled";

export type PortalRole =
  | "tenant_owner"
  | "billing_admin"
  | "company_admin"
  | "support_contact"
  | "read_only_portal_user"
  | string;

export interface PortalPendingPlanChange {
  targetPlanCode: string;
  targetBillingCycle: string;
  effectiveAt: string;
  requestedAt: string;
  mode: "immediate" | "scheduled";
  warnings: string[];
}

export interface PortalUsageSummary {
  planCode?: string | null;
  supportTier?: string | null;
  limits: {
    branches?: number | null;
    users?: number | null;
    devices?: number | null;
  };
  usage: {
    branches: number;
    users: number;
    devices: number;
  };
  overLimit: {
    branches: boolean;
    users: boolean;
    devices: boolean;
  };
  featureFlags: string[];
  nextBillingAmount?: number | null;
  promoAmount?: number | null;
  currency: string;
  couponCode?: string | null;
  pendingPlanChange?: PortalPendingPlanChange | null;
}

export interface PortalNotice {
  id: string;
  level: "info" | "warning" | "danger" | "success";
  title: string;
  description: string;
  href?: string | null;
}

export interface PortalOnboardingStep {
  code: string;
  label: string;
  description: string;
  status: "complete" | "pending" | "attention";
  href?: string | null;
  completedAt?: string | null;
}

export interface PortalUserRecord {
  id: string;
  customerAccountId?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  roleCode: PortalRole;
  status: string;
  isOwner: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface SecuritySessionRecord {
  id: string;
  roleCode: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  current: boolean;
}

export interface SecurityActivityRecord {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
  detail: string;
}

export interface PortalSecuritySnapshot {
  email: string;
  emailVerifiedAt?: string | null;
  mfaReady: boolean;
  sessions: SecuritySessionRecord[];
  activity: SecurityActivityRecord[];
}

export interface SupportRequestRecord {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  message: string;
  createdAt: string;
  contactPreference?: string | null;
}

export interface TrialPromoStatus {
  trialEndsAt?: string | null;
  trialRemainingDays?: number | null;
  couponCode?: string | null;
  promoAmount?: number | null;
  annualDiscountLabel?: string | null;
  conversionState: "paid" | "trialing" | "trial_expired" | "coupon_applied";
}

export interface CustomerPortalExperience extends CustomerPortalSnapshot {
  roleCode: PortalRole;
  usage: PortalUsageSummary;
  notices: PortalNotice[];
  onboarding: PortalOnboardingStep[];
  users: PortalUserRecord[];
  security: PortalSecuritySnapshot;
  supportRequests: SupportRequestRecord[];
  supportCategories: string[];
  promo: TrialPromoStatus;
}

export interface ResellerPortalOverviewTotals {
  referredCustomers: number;
  activeCustomers: number;
  monthlyConversions: number;
  totalEarnedCommission: number;
  pendingCommission: number;
  paidOutCommission: number;
  availablePayout: number;
}

export interface ResellerCustomerRecord {
  tenantId: string;
  companyName: string;
  signupDate?: string | null;
  plan?: string | null;
  subscriptionStatus?: string | null;
  billingPeriod?: string | null;
  licenseStatus?: string | null;
  activeDevices: number;
  branchCount: number;
  userCount: number;
  revenueAmount: number;
  commissionAmount: number;
}

export interface ResellerReferralSummary {
  primaryCode: string;
  primaryLink: string;
  clicked: number;
  registered: number;
  purchased: number;
  active: number;
  canceled: number;
  history: Array<{
    id: string;
    status: string;
    code: string;
    companyName?: string | null;
    createdAt: string;
  }>;
}

export interface ResellerPayoutRecord {
  id: string;
  periodStart: string;
  periodEnd: string;
  total: number;
  status: string;
  createdAt: string;
  paidAt?: string | null;
}

export interface ResellerLicenseVisibilityRecord {
  tenantId: string;
  companyName: string;
  planCode?: string | null;
  licenseStatus?: string | null;
  issuedAt?: string | null;
  renewalDate?: string | null;
  activeDevices: number;
  deviceLimit?: number | null;
}

export interface ResellerAssetRecord {
  id: string;
  title: string;
  type: string;
  description: string;
  href: string;
}

export interface ResellerSettingsSnapshot {
  resellerName: string;
  companyName?: string | null;
  email: string;
  phone?: string | null;
  commissionRate: number;
  payoutMethod: string;
  status: string;
}

export interface ResellerPortalExperience {
  overview: {
    resellerName: string;
    referralCode: string;
    commissionRate: number;
    totals: ResellerPortalOverviewTotals;
    partnerAnnouncements: string[];
  };
  customers: ResellerCustomerRecord[];
  referrals: ResellerReferralSummary;
  commissions: Array<CommissionRecord & { companyName?: string | null; planCode?: string | null }>;
  payouts: ResellerPayoutRecord[];
  licenses: ResellerLicenseVisibilityRecord[];
  assets: ResellerAssetRecord[];
  supportRequests: SupportRequestRecord[];
  supportLinks: CommerceSupportLinkDto[];
  settings: ResellerSettingsSnapshot;
}

const supportCategories = [
  "billing",
  "license",
  "device_activation",
  "downloads",
  "onboarding",
  "integrations",
  "reseller"
];

const resellerAssets: ResellerAssetRecord[] = [
  {
    id: "asset-logo-kit",
    title: "Logo kit",
    type: "brand",
    description: "Brand assets for reseller sales decks and proposals.",
    href: "/download"
  },
  {
    id: "asset-pricing-sheet",
    title: "Pricing sheet",
    type: "sales",
    description: "Starter, Pro and Enterprise plan comparison sheet.",
    href: "/pricing"
  },
  {
    id: "asset-onboarding-pack",
    title: "Onboarding pack",
    type: "enablement",
    description: "Activation, licensing and rollout talking points for partners.",
    href: "/docs"
  }
];

function getOrigin() {
  return typeof window === "undefined" ? "http://localhost:3000" : window.location.origin;
}

function getNumericLimits(planCode?: string | null) {
  switch ((planCode ?? "").toLowerCase()) {
    case "starter":
      return { branches: 1, users: 3, devices: 1 };
    case "pro":
      return { branches: 5, users: 10, devices: 5 };
    default:
      return { branches: null, users: null, devices: null };
  }
}

function parsePlanSnapshot(planSnapshotJson?: string | null) {
  if (!planSnapshotJson) {
    return {
      featureFlags: [] as string[],
      supportTier: null as string | null,
      pendingPlanChange: null as PortalPendingPlanChange | null
    };
  }

  try {
    const parsed = JSON.parse(planSnapshotJson) as {
      featureFlags?: string[];
      supportTier?: string;
      pendingPlanChange?: PortalPendingPlanChange | null;
    };

    return {
      featureFlags: parsed.featureFlags ?? [],
      supportTier: parsed.supportTier ?? null,
      pendingPlanChange: parsed.pendingPlanChange ?? null
    };
  } catch {
    return {
      featureFlags: [] as string[],
      supportTier: null as string | null,
      pendingPlanChange: null as PortalPendingPlanChange | null
    };
  }
}

async function optionalCommerceFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    return await commerceFetch<T>(path, options);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("API 401") ||
        error.message.includes("API 403") ||
        error.message.includes("API 404"))
    ) {
      return null;
    }

    throw error;
  }
}

function buildFallbackCustomerExperience(snapshot: CustomerPortalSnapshot): CustomerPortalExperience {
  const session = getStoredSession();
  const roleCode = (session?.roles[0] as PortalRole | undefined) ?? "tenant_owner";
  const planCode = snapshot.subscription?.planCode ?? snapshot.overview?.activePlan ?? null;
  const limits = getNumericLimits(planCode);
  const parsedSnapshot = parsePlanSnapshot(snapshot.subscription?.planSnapshotJson);
  const usage = {
    branches: snapshot.customer ? 1 : 0,
    users: 1,
    devices: snapshot.devices.filter((device) => !device.revokedAt && device.status !== "revoked").length
  };

  return {
    ...snapshot,
    roleCode,
    usage: {
      planCode,
      supportTier: parsedSnapshot.supportTier,
      limits,
      usage,
      overLimit: {
        branches: limits.branches !== null ? usage.branches > limits.branches : false,
        users: limits.users !== null ? usage.users > limits.users : false,
        devices: limits.devices !== null ? usage.devices > limits.devices : false
      },
      featureFlags: parsedSnapshot.featureFlags,
      nextBillingAmount:
        planCode && ["starter", "pro", "enterprise"].includes(planCode)
          ? snapshot.subscription?.billingCycle === "yearly"
            ? getPlanByCode(planCode).yearlyPrice
            : getPlanByCode(planCode).monthlyPrice
          : null,
      promoAmount: null,
      currency: "TRY",
      couponCode: null,
      pendingPlanChange: parsedSnapshot.pendingPlanChange
    },
    notices: [],
    onboarding: [],
    users: session
      ? [
          {
            id: session.tenantId ?? "current-user",
            customerAccountId: session.tenantId ?? null,
            fullName: session.displayName,
            email: session.email,
            phone: snapshot.customer?.phone ?? null,
            roleCode,
            status: "active",
            isOwner: true,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString()
          }
        ]
      : [],
    security: {
      email: snapshot.customer?.billingEmail ?? session?.email ?? "-",
      emailVerifiedAt: null,
      mfaReady: false,
      sessions: session
        ? [
            {
              id: "current-session",
              roleCode,
              createdAt: new Date(Math.max(0, session.expiresAt - 12 * 60 * 60 * 1000)).toISOString(),
              expiresAt: new Date(session.expiresAt).toISOString(),
              revokedAt: null,
              userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Browser session",
              ipAddress: null,
              current: true
            }
          ]
        : [],
      activity: []
    },
    supportRequests: [],
    supportCategories,
    promo: {
      trialEndsAt: null,
      trialRemainingDays: null,
      couponCode: null,
      promoAmount: null,
      annualDiscountLabel:
        snapshot.subscription?.billingCycle === "yearly" ? "Annual billing active." : null,
      conversionState: snapshot.subscription?.status === "trialing" ? "trialing" : "paid"
    }
  };
}

function buildFallbackResellerExperience(
  snapshot: Awaited<ReturnType<typeof loadResellerPortalSnapshotWithFallback>>
): ResellerPortalExperience | null {
  if (!snapshot) {
    return null;
  }

  const customers: ResellerCustomerRecord[] = snapshot.customers.map((customer) => ({
    tenantId: customer.tenantId ?? customer.id,
    companyName: customer.companyName,
    signupDate: customer.createdAt,
    plan: "pro",
    subscriptionStatus: "active",
    billingPeriod: "monthly",
    licenseStatus: snapshot.licenseReadyCustomers.some((item) => item.id === customer.id)
      ? "active"
      : "pending",
    activeDevices: 0,
    branchCount: 1,
    userCount: 1,
    revenueAmount: 0,
    commissionAmount: snapshot.commissions
      .filter((item) => item.tenantId === customer.tenantId)
      .reduce((sum, item) => sum + item.amount, 0)
  }));
  const pendingCommission = snapshot.commissions
    .filter((item) => item.status !== "paid")
    .reduce((sum, item) => sum + item.amount, 0);
  const paidOutCommission = snapshot.commissions
    .filter((item) => item.status === "paid")
    .reduce((sum, item) => sum + item.amount, 0);

  return {
    overview: {
      resellerName: snapshot.reseller.companyName || snapshot.reseller.fullName,
      referralCode: snapshot.reseller.referralCode,
      commissionRate: snapshot.reseller.commissionRate,
      totals: {
        referredCustomers: customers.length,
        activeCustomers: customers.length,
        monthlyConversions: customers.length,
        totalEarnedCommission: pendingCommission + paidOutCommission,
        pendingCommission,
        paidOutCommission,
        availablePayout: pendingCommission
      },
      partnerAnnouncements: [
        "Partner sales materials are available in the assets area.",
        "Support and activation guidance are available in the portal."
      ]
    },
    customers,
    referrals: {
      primaryCode: snapshot.reseller.referralCode,
      primaryLink: `${getOrigin()}/checkout?ref=${snapshot.reseller.referralCode}`,
      clicked: customers.length * 3,
      registered: customers.length,
      purchased: customers.length,
      active: customers.length,
      canceled: 0,
      history: customers.map((customer) => ({
        id: customer.tenantId,
        status: customer.subscriptionStatus ?? "active",
        code: snapshot.reseller.referralCode,
        companyName: customer.companyName,
        createdAt: customer.signupDate ?? new Date().toISOString()
      }))
    },
    commissions: snapshot.commissions.map((item) => ({
      ...item,
      companyName: customers.find((customer) => customer.tenantId === item.tenantId)?.companyName ?? null,
      planCode: customers.find((customer) => customer.tenantId === item.tenantId)?.plan ?? null
    })),
    payouts: [],
    licenses: customers.map((customer) => ({
      tenantId: customer.tenantId,
      companyName: customer.companyName,
      planCode: customer.plan,
      licenseStatus: customer.licenseStatus,
      issuedAt: customer.signupDate,
      renewalDate: customer.signupDate,
      activeDevices: customer.activeDevices,
      deviceLimit: getNumericLimits(customer.plan).devices
    })),
    assets: resellerAssets,
    supportRequests: [],
    supportLinks: [
      { label: "Partner docs", href: "/docs" },
      { label: "Partner FAQ", href: "/faq" },
      { label: "Support", href: "/contact" }
    ],
    settings: {
      resellerName: snapshot.reseller.fullName,
      companyName: snapshot.reseller.companyName,
      email: snapshot.reseller.email,
      phone: snapshot.reseller.phone,
      commissionRate: snapshot.reseller.commissionRate,
      payoutMethod: "Manual payout review",
      status: snapshot.reseller.status
    }
  };
}

export async function loadCustomerPortalExperience(): Promise<CustomerPortalExperience | null> {
  const snapshot = await loadCustomerPortalSnapshotWithFallback();
  if (!snapshot) {
    return null;
  }

  const session = getStoredSession();
  if (!session?.accessToken || session.portalType !== "customer") {
    return buildFallbackCustomerExperience(snapshot);
  }

  try {
    const [usage, notices, onboarding, users, security, supportRequests, promo] = await Promise.all([
      optionalCommerceFetch<PortalUsageSummary>("/commerce/portal/subscription/usage"),
      optionalCommerceFetch<PortalNotice[]>("/commerce/portal/notices"),
      optionalCommerceFetch<PortalOnboardingStep[]>("/commerce/portal/onboarding"),
      optionalCommerceFetch<PortalUserRecord[]>("/commerce/portal/users"),
      optionalCommerceFetch<PortalSecuritySnapshot>("/commerce/portal/security"),
      optionalCommerceFetch<SupportRequestRecord[]>("/commerce/portal/support"),
      optionalCommerceFetch<TrialPromoStatus>("/commerce/portal/subscription/trial-status")
    ]);

    const fallback = buildFallbackCustomerExperience(snapshot);

    return {
      ...snapshot,
      roleCode: (session.roles[0] as PortalRole | undefined) ?? fallback.roleCode,
      usage: usage ?? fallback.usage,
      notices: notices ?? fallback.notices,
      onboarding: onboarding ?? fallback.onboarding,
      users: users ?? fallback.users,
      security: security ?? fallback.security,
      supportRequests: supportRequests ?? fallback.supportRequests,
      supportCategories,
      promo: promo ?? fallback.promo
    };
  } catch (error) {
    if (!commerceFallbackEnabled) {
      throw error;
    }

    return buildFallbackCustomerExperience(snapshot);
  }
}

export async function loadResellerPortalExperience(): Promise<ResellerPortalExperience | null> {
  const fallbackSnapshot = await loadResellerPortalSnapshotWithFallback();
  const session = getStoredSession();

  if (!session?.accessToken || session.portalType !== "reseller") {
    return buildFallbackResellerExperience(fallbackSnapshot);
  }

  try {
    const [
      overview,
      customers,
      referrals,
      commissions,
      payouts,
      licenses,
      assets,
      supportRequests,
      supportLinks,
      settings
    ] = await Promise.all([
      commerceFetch<ResellerPortalExperience["overview"]>("/commerce/reseller-portal/overview"),
      commerceFetch<ResellerCustomerRecord[]>("/commerce/reseller-portal/customers"),
      commerceFetch<ResellerReferralSummary>("/commerce/reseller-portal/referrals"),
      commerceFetch<Array<CommissionRecord & { companyName?: string | null; planCode?: string | null }>>(
        "/commerce/reseller-portal/commissions"
      ),
      commerceFetch<ResellerPayoutRecord[]>("/commerce/reseller-portal/payouts"),
      commerceFetch<ResellerLicenseVisibilityRecord[]>("/commerce/reseller-portal/licenses"),
      commerceFetch<ResellerAssetRecord[]>("/commerce/reseller-portal/assets"),
      optionalCommerceFetch<SupportRequestRecord[]>("/commerce/reseller-portal/support"),
      optionalCommerceFetch<CommerceSupportLinkDto[]>("/commerce/reseller-portal/support-links"),
      commerceFetch<ResellerSettingsSnapshot>("/commerce/reseller-portal/settings")
    ]);

    return {
      overview,
      customers,
      referrals,
      commissions,
      payouts,
      licenses,
      assets,
      supportRequests: supportRequests ?? [],
      supportLinks:
        supportLinks ??
        [
          { label: "Partner docs", href: "/docs" },
          { label: "Partner FAQ", href: "/faq" },
          { label: "Support", href: "/contact" }
        ],
      settings
    };
  } catch (error) {
    if (!commerceFallbackEnabled) {
      throw error;
    }

    return buildFallbackResellerExperience(fallbackSnapshot);
  }
}

export async function updatePortalCompanyProfile(input: CompanyProfileInput) {
  return await updateCompanyProfileWithFallback(input);
}

export async function changePortalPlan(input: {
  planCode: PlanCode;
  billingCycle: BillingCycle;
  immediate?: boolean;
}) {
  return await commerceFetch("/commerce/portal/subscription/change-plan", {
    method: "POST",
    body: JSON.stringify({
      planCode: input.planCode,
      billingCycle: input.billingCycle,
      immediate: input.immediate ?? true
    })
  });
}

export async function cancelPortalSubscription() {
  return await commerceFetch("/commerce/portal/subscription/cancel", { method: "POST" });
}

export async function reactivatePortalSubscription() {
  return await commerceFetch("/commerce/portal/subscription/reactivate", { method: "POST" });
}

export async function invitePortalUser(input: {
  fullName: string;
  email: string;
  phone?: string;
  roleCode: PortalRole;
}) {
  return await commerceFetch<PortalUserRecord>("/commerce/portal/users/invite", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updatePortalUserRole(userId: string, roleCode: PortalRole) {
  return await commerceFetch<PortalUserRecord>(`/commerce/portal/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ roleCode })
  });
}

export async function removePortalUser(userId: string) {
  return await commerceFetch<{ removed: boolean; userId: string }>(`/commerce/portal/users/${userId}`, {
    method: "DELETE"
  });
}

export async function changePortalPassword(currentPassword: string, newPassword: string) {
  return await commerceFetch<{ changed: boolean }>("/commerce/portal/security/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword })
  });
}

export async function revokePortalSession(sessionId: string) {
  return await commerceFetch<{ revoked: boolean; sessionId: string }>(
    `/commerce/portal/security/sessions/${sessionId}/revoke`,
    { method: "POST" }
  );
}

export async function renamePortalDevice(deviceId: string, deviceName: string) {
  return await commerceFetch(`/commerce/portal/devices/${deviceId}/rename`, {
    method: "POST",
    body: JSON.stringify({ deviceName })
  });
}

export async function deactivatePortalDevice(deviceId: string) {
  return await commerceFetch(`/commerce/portal/devices/${deviceId}/deactivate`, {
    method: "POST"
  });
}

export async function createPortalSupportRequest(input: {
  subject: string;
  category: string;
  priority: string;
  message: string;
  contactPreference?: string;
}) {
  return await commerceFetch<SupportRequestRecord>("/commerce/portal/support", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function createResellerSupportRequest(input: {
  subject: string;
  category: string;
  priority: string;
  message: string;
  contactPreference?: string;
}) {
  return await commerceFetch<SupportRequestRecord>("/commerce/reseller-portal/support", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export const portalRoleOptions: Array<{ value: PortalRole; label: string }> = [
  { value: "tenant_owner", label: "Tenant owner" },
  { value: "billing_admin", label: "Billing admin" },
  { value: "company_admin", label: "Company admin" },
  { value: "support_contact", label: "Support contact" },
  { value: "read_only_portal_user", label: "Read-only" }
];

export const portalSupportCategories = supportCategories;
export const portalResellerAssets = resellerAssets;
export type { CompanyProfileInput };
