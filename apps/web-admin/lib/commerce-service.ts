"use client";

import {
  buildPortalSession,
  getStoredSession,
  saveSession
} from "@/lib/auth";
import {
  commerceFetch,
  type CommerceCheckoutStatusDto,
  type CommerceCheckoutLaunchDto,
  type CommerceDownloadAssetDto,
  type CommercePortalBillingItemDto,
  type CommercePortalCompanyDto,
  type CommercePortalDeviceDto,
  type CommercePortalLicenseDto,
  type CommercePortalOverviewDto,
  type CommercePortalSubscriptionDto,
  type CommerceSupportLinkDto,
  type PortalAuthResponseDto,
  type ResellerApplyResponseDto,
  type ResellerDashboardDto
} from "@/lib/api-client";
import {
  applyResellerLead,
  getCustomerPortalSnapshot,
  getResellerPortalSnapshot,
  loginCustomer as loginCustomerLocally,
  loginReseller as loginResellerLocally,
  mergeResellerDashboard,
  persistResellerLeadResult,
  registerCustomerAccount as registerCustomerAccountLocally,
  type CheckoutInput,
  type CommissionRecord,
  type ResellerApplyInput,
  type RegisterInput
} from "@/lib/commerce-state";
import { downloadArtifacts, getPlanByCode } from "@/lib/site-content";

const commerceFallbackEnabled =
  process.env.NEXT_PUBLIC_COMMERCE_FALLBACK_MODE === "enabled";

export interface CheckoutLaunchResult {
  checkoutSessionId: string;
  status: string;
  providerStatus: string;
  checkoutUrl?: string | null;
  requiresProviderAction: boolean;
}

export interface CheckoutSuccessSnapshot {
  checkoutSessionId?: string;
  tenantId?: string | null;
  companyName: string;
  planCode: string;
  billingPeriod: string;
  status: string;
  paymentStatus: string;
  amount: number;
  currency: string;
  invoiceNo?: string | null;
  licenseKey?: string | null;
  licenseStatus?: string | null;
  licenseExpiresAt?: string | null;
  downloads: CommerceDownloadAssetDto[];
}

export interface CustomerPortalSnapshot {
  customer: CommercePortalCompanyDto | null;
  overview: CommercePortalOverviewDto | null;
  subscription: CommercePortalSubscriptionDto | null;
  licenses: CommercePortalLicenseDto[];
  license: CommercePortalLicenseDto | null;
  downloads: CommerceDownloadAssetDto[];
  billing: CommercePortalBillingItemDto[];
  devices: CommercePortalDeviceDto[];
  supportLinks: CommerceSupportLinkDto[];
}

export interface CompanyProfileInput {
  companyName: string;
  billingEmail: string;
  phone?: string;
  taxOffice?: string;
  taxNumber?: string;
  addressLine?: string;
  city?: string;
  country?: string;
  locale?: string;
}

const defaultSupportLinks: CommerceSupportLinkDto[] = [
  { label: "Docs", href: "/docs" },
  { label: "FAQ", href: "/faq" },
  { label: "Download center", href: "/download" },
  { label: "Support", href: "/contact" }
];

function syncPortalSession(response: PortalAuthResponseDto, fallbackCompanyName?: string) {
  saveSession(
    buildPortalSession({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresAt: response.expiresAt,
      refreshExpiresAt: response.refreshExpiresAt,
      portalType: response.portalType,
      roles: response.roles,
      email: response.email,
      displayName: response.displayName,
      tenantId: response.tenantId ?? undefined,
      companyName: response.companyName ?? fallbackCompanyName ?? undefined,
      resellerCode: response.resellerCode ?? undefined
    })
  );
}

function syncSessionCompanyName(companyName?: string | null) {
  if (!companyName) {
    return;
  }

  const session = getStoredSession();
  if (!session) {
    return;
  }

  saveSession({
    ...session,
    companyName
  });
}

async function optionalCommerceFetch<T>(path: string): Promise<T | null> {
  try {
    return await commerceFetch<T>(path);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("API 401") || error.message.includes("API 404"))
    ) {
      return null;
    }

    throw error;
  }
}

function mapFallbackDownloads(): CommerceDownloadAssetDto[] {
  return downloadArtifacts.map((artifact, index) => ({
    assetId: `local-asset-${artifact.platform}-${index}`,
    releaseId: `local-release-${artifact.platform}-${index}`,
    platform: artifact.platform,
    title: artifact.title,
    version: artifact.version,
    releaseDate: artifact.releaseDate,
    visibility: artifact.visibility,
    downloadUrl:
      artifact.visibility === "public"
        ? `/download#${artifact.platform}`
        : `/portal/downloads#${artifact.platform}`,
    releaseNotesMarkdown: artifact.releaseNotes.join("\n"),
    installGuideMarkdown: artifact.installationSteps.join("\n"),
    minimumRequirements: artifact.requirements.join("\n")
  }));
}

function buildFallbackPortalSnapshot(): CustomerPortalSnapshot | null {
  const snapshot = getCustomerPortalSnapshot();
  if (!snapshot) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const companyName = snapshot.customer?.companyName ?? getStoredSession()?.companyName ?? "-";
  const billing = snapshot.billing.map((item) => ({
    id: item.id,
    invoiceNo: item.invoiceNo,
    description: `${item.provider.toUpperCase()} billing record`,
    amount: item.amount,
    currency: item.currency,
    status: item.status,
    issuedAt: item.issuedAt,
    dueAt: item.issuedAt,
    pdfUrl: null,
    paymentMethodSummary: item.paymentMethod,
    provider: item.provider
  }));
  const licenses = snapshot.license
    ? [
        {
          id: snapshot.license.id,
          tenantId: snapshot.license.tenantId,
          subscriptionId: snapshot.license.subscriptionId,
          planCode: snapshot.license.planCode,
          licenseKey: snapshot.license.licenseKey,
          licenseToken: snapshot.license.licenseKey,
          signature: "local-fallback",
          featuresJson: JSON.stringify(snapshot.license.featureFlags),
          deviceLimit: Number.parseInt(snapshot.license.deviceLimit, 10) || null,
          issuedAt: snapshot.license.issuedAt,
          expiresAt: snapshot.license.expiresAt,
          graceDays: 7,
          status: snapshot.license.status,
          createdAt: snapshot.license.issuedAt
        }
      ]
    : [];

  return {
    customer: {
      id: snapshot.customer?.tenantId ?? getStoredSession()?.tenantId ?? "local-tenant",
      companyName,
      tenantCode: snapshot.customer?.tenantId ?? "local-tenant",
      billingEmail: snapshot.customer?.email ?? getStoredSession()?.email ?? "customer@local",
      taxOffice: null,
      taxNumber: null,
      country: "TR",
      locale: "tr-TR",
      phone: snapshot.customer?.phone ?? null,
      addressLine: null,
      city: null,
      status: "active"
    },
    overview: {
      companyName,
      activePlan: snapshot.subscription?.planCode ?? null,
      renewalDate: snapshot.subscription?.currentPeriodEnd ?? null,
      billingPeriod: snapshot.subscription?.billingCycle ?? null,
      licenseStatus: snapshot.license?.status ?? null,
      activeDevices: snapshot.devices.length,
      latestInvoice: billing[0]
        ? {
            id: billing[0].id,
            invoiceNo: billing[0].invoiceNo,
            total: billing[0].amount,
            currency: billing[0].currency,
            status: billing[0].status,
            issuedAt: billing[0].issuedAt
          }
        : null,
      downloads: mapFallbackDownloads().slice(0, 3)
    },
    subscription: snapshot.subscription
      ? {
          id: snapshot.subscription.id,
          tenantId: snapshot.subscription.tenantId,
          billingProfileId: null,
          planCode: snapshot.subscription.planCode,
          billingCycle: snapshot.subscription.billingCycle,
          status: snapshot.subscription.status,
          currentPeriodStart: snapshot.subscription.currentPeriodStart,
          currentPeriodEnd: snapshot.subscription.currentPeriodEnd,
          renewalDate: snapshot.subscription.currentPeriodEnd,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          providerSubscriptionId: null,
          providerCustomerReference: null,
          planSnapshotJson: JSON.stringify({
            planCode: snapshot.subscription.planCode
          }),
          resellerCode: null,
          createdAt: snapshot.subscription.createdAt,
          updatedAt: nowIso
        }
      : null,
    licenses,
    license: licenses[0] ?? null,
    downloads: mapFallbackDownloads(),
    billing,
    devices: snapshot.devices.map((device) => ({
      id: device.id,
      tenantId: device.tenantId,
      licenseId: licenses[0]?.id ?? null,
      deviceId: device.id,
      deviceName: device.deviceName,
      platform: device.platform,
      appVersion: device.appVersion ?? null,
      activationSource: "desktop",
      status: device.status,
      activatedAt: device.activatedAt,
      lastSeenAt: device.lastSeenAt,
      revokedAt: null,
      updatedAt: nowIso
    })),
    supportLinks: defaultSupportLinks
  };
}

function shouldUseCommerceFallback() {
  return commerceFallbackEnabled;
}

export async function registerCustomerAccountWithFallback(input: RegisterInput) {
  try {
    const response = await commerceFetch<PortalAuthResponseDto>("/commerce/auth/register", {
      method: "POST",
      body: JSON.stringify({
        fullName: input.fullName,
        companyName: input.companyName,
        email: input.email,
        phone: input.phone,
        password: input.password
      })
    });

    syncPortalSession(response, input.companyName);
    return response;
  } catch (error) {
    if (!shouldUseCommerceFallback()) {
      throw error;
    }

    registerCustomerAccountLocally(input);
    return null;
  }
}

export async function loginCustomerWithFallback(email: string, password: string) {
  try {
    const response = await commerceFetch<PortalAuthResponseDto>("/commerce/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password
      })
    });

    syncPortalSession(response);
    return response;
  } catch (error) {
    if (!shouldUseCommerceFallback()) {
      throw error;
    }

    loginCustomerLocally(email, password);
    return null;
  }
}

export async function loginResellerWithFallback(email: string, password: string) {
  try {
    const response = await commerceFetch<PortalAuthResponseDto>("/commerce/auth/reseller-login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password
      })
    });

    syncPortalSession(response);
    return response;
  } catch (error) {
    if (!shouldUseCommerceFallback()) {
      throw error;
    }

    loginResellerLocally(email, password);
    return null;
  }
}

export async function requestPasswordReset(email: string) {
  return await commerceFetch<{ queued: boolean }>("/commerce/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export async function resetPassword(token: string, password: string) {
  return await commerceFetch<{ reset: boolean }>("/commerce/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password })
  });
}

export async function verifyEmail(token: string) {
  return await commerceFetch<{ verified: boolean }>("/commerce/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token })
  });
}

export async function checkoutWithFallback(input: CheckoutInput): Promise<CheckoutLaunchResult> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const response = await commerceFetch<CommerceCheckoutLaunchDto>("/commerce/checkout/session", {
    method: "POST",
    body: JSON.stringify({
      planCode: input.planCode,
      billingPeriod: input.billingCycle,
      fullName: input.fullName,
      companyName: input.companyName,
      email: input.email,
      password: input.password,
      phone: input.phone,
      billingTitle: input.companyName,
      billingEmail: input.email,
      taxOffice: input.taxOffice ?? "",
      taxNumber: input.taxNumber ?? "",
      addressLine: input.addressLine ?? "",
      city: input.city ?? "",
      country: input.country ?? "TR",
      locale: input.locale ?? "tr-TR",
      paymentMethod: input.paymentMethod,
      provider: input.provider,
      resellerCode: input.resellerCode,
      couponCode: input.couponCode,
      successUrl: origin + "/success",
      cancelUrl: origin + "/checkout?plan=" + input.planCode + "&cycle=" + input.billingCycle
    })
  });

  return {
    checkoutSessionId: response.checkout.checkoutSessionId,
    status: response.checkout.status,
    providerStatus: response.providerStatus,
    checkoutUrl: response.checkoutUrl ?? null,
    requiresProviderAction: response.requiresProviderAction
  };
}

export async function loadCheckoutSuccessWithFallback(
  checkoutSessionId?: string | null,
  _receiptId?: string | null
): Promise<CheckoutSuccessSnapshot | null> {
  void _receiptId;

  if (!checkoutSessionId) {
    return null;
  }

  let response = await commerceFetch<CommerceCheckoutStatusDto>("/commerce/checkout/status/" + checkoutSessionId);
  if (response.status === "created" || response.status === "pending_provider") {
    response = await commerceFetch<CommerceCheckoutStatusDto>("/commerce/checkout/reconcile/" + checkoutSessionId, {
      method: "POST"
    });
  }

  syncSessionCompanyName(response.companyName);

  return {
    checkoutSessionId: response.checkoutSessionId,
    tenantId: response.tenantId,
    companyName: response.companyName,
    planCode: response.planCode,
    billingPeriod: response.billingPeriod,
    status: response.status,
    paymentStatus: response.paymentStatus,
    amount: response.amount,
    currency: response.currency,
    invoiceNo: response.invoiceNo,
    licenseKey: response.licenseKey,
    licenseStatus: response.licenseStatus,
    licenseExpiresAt: response.licenseExpiresAt,
    downloads: response.downloads
  };
}

export async function loadCustomerPortalSnapshotWithFallback() {
  const session = getStoredSession();

  if (session?.portalType === "customer" && session.accessToken) {
    try {
      const [
        overview,
        subscription,
        licenses,
        downloads,
        billing,
        devices,
        company,
        supportLinks
      ] = await Promise.all([
        commerceFetch<CommercePortalOverviewDto>("/commerce/portal/overview"),
        optionalCommerceFetch<CommercePortalSubscriptionDto>("/commerce/portal/subscriptions/me"),
        optionalCommerceFetch<CommercePortalLicenseDto[]>("/commerce/portal/licenses"),
        commerceFetch<CommerceDownloadAssetDto[]>("/commerce/portal/downloads"),
        commerceFetch<CommercePortalBillingItemDto[]>("/commerce/portal/billing"),
        commerceFetch<CommercePortalDeviceDto[]>("/commerce/portal/devices"),
        optionalCommerceFetch<CommercePortalCompanyDto>("/commerce/portal/company/me"),
        optionalCommerceFetch<CommerceSupportLinkDto[]>("/commerce/portal/support-links")
      ]);

      syncSessionCompanyName(company?.companyName ?? overview?.companyName);

      const licenseList = licenses ?? [];
      const activeLicense =
        licenseList.find((item) => item.status.toLowerCase() === "active") ?? licenseList[0] ?? null;

      return {
        customer:
          company ??
          (overview
            ? {
                id: session.tenantId ?? "portal-company",
                companyName: overview.companyName,
                tenantCode: session.tenantId ?? "portal-company",
                billingEmail: session.email,
                taxOffice: null,
                taxNumber: null,
                country: "TR",
                locale: "tr-TR",
                phone: null,
                addressLine: null,
                city: null,
                status: "active"
              }
            : null),
        overview,
        subscription,
        licenses: licenseList,
        license: activeLicense,
        downloads,
        billing,
        devices,
        supportLinks: supportLinks ?? defaultSupportLinks
      } satisfies CustomerPortalSnapshot;
    } catch (error) {
      if (!shouldUseCommerceFallback()) {
        throw error;
      }

      // Fall back to local scaffolded state below.
    }
  }

  if (!shouldUseCommerceFallback()) {
    return null;
  }

  return buildFallbackPortalSnapshot();
}

export async function updateCompanyProfileWithFallback(input: CompanyProfileInput) {
  const response = await commerceFetch<CommercePortalCompanyDto>("/commerce/portal/company/me", {
    method: "PUT",
    body: JSON.stringify({
      companyName: input.companyName,
      billingEmail: input.billingEmail,
      phone: input.phone,
      taxOffice: input.taxOffice,
      taxNumber: input.taxNumber,
      addressLine: input.addressLine,
      city: input.city,
      country: input.country ?? "TR",
      locale: input.locale ?? "tr-TR"
    })
  });

  syncSessionCompanyName(response.companyName);
  return response;
}

export async function submitResellerApplicationWithFallback(input: ResellerApplyInput) {
  try {
    const response = await commerceFetch<ResellerApplyResponseDto>("/commerce/reseller/apply", {
      method: "POST",
      body: JSON.stringify({
        name: input.fullName,
        companyName: input.companyName,
        city: input.city,
        phone: input.phone,
        email: input.email,
        websiteOrSocialProof: input.websiteOrSocialProof,
        experience: input.experience,
        message: input.message
      })
    });

    return persistResellerLeadResult(input, {
      code: response.code,
      status: response.status,
      commissionRate: response.commissionRate
    });
  } catch (error) {
    if (!shouldUseCommerceFallback()) {
      throw error;
    }

    return applyResellerLead(input);
  }
}

export async function loadResellerPortalSnapshotWithFallback() {
  const session = getStoredSession();

  if (session?.resellerCode) {
    try {
      const response = await commerceFetch<ResellerDashboardDto>(
        `/commerce/reseller/${session.resellerCode}/dashboard`
      );

      const commissions: CommissionRecord[] = response.commissions.map((commission) => ({
        id: commission.id,
        resellerId: session.resellerCode!,
        tenantId: commission.tenantId,
        amount: commission.amount,
        rate: commission.rate,
        status: commission.status === "paid" ? "paid" : "accrued",
        createdAt: commission.accruedAt
      }));

      mergeResellerDashboard({
        resellerCode: response.code,
        resellerName: response.name,
        status: response.status,
        commissionRate: response.commissionRate,
        commissions
      });
    } catch (error) {
      if (!shouldUseCommerceFallback()) {
        throw error;
      }

      // Fall back to local scaffolded state below.
    }
  }

  if (!shouldUseCommerceFallback()) {
    return null;
  }

  return getResellerPortalSnapshot();
}

export function getPlanDeviceLimit(planCode: string) {
  return getPlanByCode(planCode).deviceLimit;
}
