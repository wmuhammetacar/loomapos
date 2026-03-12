import { apiFetch } from "@/lib/api-client";

export type InternalRole =
  | "super_admin"
  | "ops_admin"
  | "support_agent"
  | "billing_admin"
  | "reseller_manager"
  | "release_manager"
  | "security_auditor"
  | "read_only_analyst";

export interface AdminOverviewSnapshot {
  activeTenants: number;
  trialTenants: number;
  pastDueSubscriptions: number;
  failedRenewals: number;
  activeDevices: number;
  deviceLimitViolations: number;
  syncFailureRate: string;
  deadLetterCount: number;
  openSupportCases: number;
  unresolvedBillingIssues: number;
  resellerMonthlyConversions: number;
  latestReleaseAdoption: string;
  integrationIncidents: number;
}

export interface AdminTenantSummary {
  id: string;
  tenantCode: string;
  companyName: string;
  ownerEmail: string;
  phone: string;
  status: string;
  planCode: string;
  billingCycle: string;
  subscriptionStatus: string;
  licenseStatus: string;
  deviceCount: number;
  deviceLimit: number;
  resellerCode?: string | null;
  lastSyncAt: string;
}

export interface AdminTenantDetail extends AdminTenantSummary {
  notes: string[];
  featureFlags: string[];
  recentNotices: string[];
  appVersions: string[];
  latestInvoiceNo: string;
  onboardingState: string;
  supportSummary: string;
}

export interface AdminSupportCase {
  id: string;
  tenantId?: string | null;
  title: string;
  category: string;
  priority: string;
  status: string;
  assignee: string;
  source?: string;
  escalationLevel?: string | null;
  createdAt: string;
  updatedAt: string;
  summary: string;
  notes?: Array<{ id: string; note: string; createdAt: string }>;
  links?: Array<{ id: string; entityType: string; entityId: string; label?: string | null; createdAt: string }>;
  timeline: Array<{ at: string; label: string; detail: string }>;
}

export interface AdminResellerSummary {
  id: string;
  name: string;
  code: string;
  status: string;
  customers: number;
  monthlyConversions: number;
  pendingCommission: number;
  paidOut: number;
  suspicious: boolean;
}

export interface AdminDeadLetterItem {
  id: string;
  eventType: string;
  tenantId: string;
  deviceId: string;
  createdAt: string;
  lastRetryAt: string;
  failureReason: string;
  payloadSummary: string;
  status: string;
}

export interface AdminReleaseRecord {
  id: string;
  platform: string;
  version: string;
  status: string;
  adoption: string;
  minSupportedVersion: string;
  createdAt: string;
}

export interface AdminFeatureFlagRecord {
  id: string;
  code: string;
  scope: string;
  state: string;
  target: string;
}

export interface AdminCouponRecord {
  id: string;
  code: string;
  type: string;
  value: string;
  usage: string;
  expiresAt: string;
  status: string;
}

export interface AdminNoticeRecord {
  id: string;
  title: string;
  audience: string;
  status: string;
  scheduledAt?: string | null;
}

export interface AdminSecuritySnapshot {
  internalUsers: Array<{ email: string; role: string; status: string }>;
  activeSessions: number;
  impersonationSessions: number;
  supportAccessSessions?: AdminSupportAccessSession[];
  lastSecretRotation: string;
}

export interface AdminSupportAccessSession {
  id: string;
  tenantId?: string | null;
  accessMode: string;
  reason: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  endedAt?: string | null;
}

export interface AdminWorkspaceSnapshot {
  overview: AdminOverviewSnapshot;
  tenants: AdminTenantSummary[];
  supportCases: AdminSupportCase[];
  resellers: AdminResellerSummary[];
  deadLetters: AdminDeadLetterItem[];
  releases: AdminReleaseRecord[];
  featureFlags: AdminFeatureFlagRecord[];
  coupons: AdminCouponRecord[];
  notices: AdminNoticeRecord[];
  security: AdminSecuritySnapshot;
}

const fallbackWorkspace: AdminWorkspaceSnapshot = {
  overview: {
    activeTenants: 128,
    trialTenants: 14,
    pastDueSubscriptions: 6,
    failedRenewals: 4,
    activeDevices: 311,
    deviceLimitViolations: 3,
    syncFailureRate: "1.8%",
    deadLetterCount: 9,
    openSupportCases: 12,
    unresolvedBillingIssues: 5,
    resellerMonthlyConversions: 18,
    latestReleaseAdoption: "Desktop 2.4.1 - 76%",
    integrationIncidents: 2
  },
  tenants: [
    {
      id: "tenant-demo-1",
      tenantCode: "LOOMA-2048",
      companyName: "Istanbul Market Group",
      ownerEmail: "owner@istanbulmarket.test",
      phone: "+90 532 000 00 01",
      status: "active",
      planCode: "enterprise",
      billingCycle: "yearly",
      subscriptionStatus: "active",
      licenseStatus: "active",
      deviceCount: 9,
      deviceLimit: 10,
      resellerCode: "IST-PRT",
      lastSyncAt: "2026-03-09T08:32:00Z"
    },
    {
      id: "tenant-demo-2",
      tenantCode: "LOOMA-1180",
      companyName: "Ankara Stationery",
      ownerEmail: "admin@ankarakirtasiye.test",
      phone: "+90 532 000 00 02",
      status: "review",
      planCode: "pro",
      billingCycle: "monthly",
      subscriptionStatus: "past_due",
      licenseStatus: "active",
      deviceCount: 5,
      deviceLimit: 4,
      resellerCode: null,
      lastSyncAt: "2026-03-08T21:10:00Z"
    }
  ],
  supportCases: [
    {
      id: "case-1001",
      tenantId: "tenant-demo-2",
      title: "Renewal paid but subscription still past_due",
      category: "billing",
      priority: "high",
      status: "pending_internal",
      assignee: "Billing Ops",
      createdAt: "2026-03-08T10:30:00Z",
      updatedAt: "2026-03-09T08:20:00Z",
      summary: "Provider marks payment as paid but internal renewal state is stale.",
      timeline: [
        {
          at: "2026-03-08T10:30:00Z",
          label: "Case opened",
          detail: "Customer reported paid renewal mismatch."
        },
        {
          at: "2026-03-09T08:20:00Z",
          label: "Billing review",
          detail: "Webhook recheck requested for provider reconciliation."
        }
      ]
    }
  ],
  resellers: [
    {
      id: "reseller-1",
      name: "Marmara Channel Partner",
      code: "IST-PRT",
      status: "approved",
      customers: 16,
      monthlyConversions: 5,
      pendingCommission: 18250,
      paidOut: 64000,
      suspicious: false
    },
    {
      id: "reseller-2",
      name: "Aegean Retail Advisor",
      code: "EGE-OPS",
      status: "review",
      customers: 4,
      monthlyConversions: 4,
      pendingCommission: 9600,
      paidOut: 0,
      suspicious: true
    }
  ],
  deadLetters: [
    {
      id: "dead-1",
      eventType: "SALE_CREATED",
      tenantId: "tenant-demo-2",
      deviceId: "desktop-ank-04",
      createdAt: "2026-03-09T07:20:00Z",
      lastRetryAt: "2026-03-09T08:10:00Z",
      failureReason: "Payment reconciliation mismatch",
      payloadSummary: "Sale payload accepted locally but provider enrichment failed.",
      status: "dead_letter"
    }
  ],
  releases: [
    {
      id: "rel-desktop-241",
      platform: "desktop",
      version: "2.4.1",
      status: "stable",
      adoption: "76%",
      minSupportedVersion: "2.3.0",
      createdAt: "2026-03-05T12:00:00Z"
    },
    {
      id: "rel-android-193",
      platform: "android",
      version: "1.9.3",
      status: "watch",
      adoption: "58%",
      minSupportedVersion: "1.8.0",
      createdAt: "2026-03-06T09:00:00Z"
    }
  ],
  featureFlags: [
    { id: "flag-1", code: "advanced_reporting", scope: "plan", state: "enabled", target: "enterprise" },
    { id: "flag-2", code: "support_grace_extension", scope: "tenant", state: "temporary", target: "tenant-demo-2" }
  ],
  coupons: [
    { id: "coupon-1", code: "GROWTH25", type: "percent", value: "25%", usage: "18/100", expiresAt: "2026-04-01T00:00:00Z", status: "active" }
  ],
  notices: [
    { id: "notice-1", title: "Desktop 2.4.1 upgrade recommended", audience: "desktop_outdated", status: "active", scheduledAt: null }
  ],
  security: {
    internalUsers: [
      { email: "ops@loomapos.local", role: "super_admin", status: "active" },
      { email: "support@loomapos.local", role: "support_agent", status: "active" }
    ],
    activeSessions: 3,
    impersonationSessions: 0,
    supportAccessSessions: [],
    lastSecretRotation: "2026-03-01T09:00:00Z"
  }
};

async function optionalAdminFetch<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path, { ignoreTenantHeaders: true });
  } catch {
    return null;
  }
}

export async function loadAdminWorkspace(): Promise<AdminWorkspaceSnapshot> {
  const [overview, tenants, supportCases, resellers, deadLetters, releases, featureFlags, coupons, notices, security] =
    await Promise.all([
      optionalAdminFetch<AdminOverviewSnapshot>("/internal/admin/overview"),
      optionalAdminFetch<AdminTenantSummary[]>("/internal/admin/tenants"),
      optionalAdminFetch<AdminSupportCase[]>("/internal/admin/support/cases"),
      optionalAdminFetch<AdminResellerSummary[]>("/internal/admin/resellers"),
      optionalAdminFetch<AdminDeadLetterItem[]>("/internal/admin/dead-letter"),
      optionalAdminFetch<AdminReleaseRecord[]>("/internal/admin/releases"),
      optionalAdminFetch<AdminFeatureFlagRecord[]>("/internal/admin/feature-flags"),
      optionalAdminFetch<AdminCouponRecord[]>("/internal/admin/coupons"),
      optionalAdminFetch<AdminNoticeRecord[]>("/internal/admin/notices"),
      optionalAdminFetch<AdminSecuritySnapshot>("/internal/admin/security")
    ]);

  return {
    overview: overview ?? fallbackWorkspace.overview,
    tenants: tenants ?? fallbackWorkspace.tenants,
    supportCases: supportCases ?? fallbackWorkspace.supportCases,
    resellers: resellers ?? fallbackWorkspace.resellers,
    deadLetters: deadLetters ?? fallbackWorkspace.deadLetters,
    releases: releases ?? fallbackWorkspace.releases,
    featureFlags: featureFlags ?? fallbackWorkspace.featureFlags,
    coupons: coupons ?? fallbackWorkspace.coupons,
    notices: notices ?? fallbackWorkspace.notices,
    security: security ?? fallbackWorkspace.security
  };
}

export async function loadAdminTenantDetail(tenantId: string): Promise<AdminTenantDetail | null> {
  const remote = await optionalAdminFetch<AdminTenantDetail>(`/internal/admin/tenants/${tenantId}`);
  if (remote) {
    return remote;
  }

  const tenant = fallbackWorkspace.tenants.find((item) => item.id === tenantId);
  if (!tenant) {
    return null;
  }

  return {
    ...tenant,
    notes: [
      "Customer success follow-up required after over-limit downgrade warning.",
      "Desktop release adoption below target for two branch devices."
    ],
    featureFlags: ["advanced_reporting", "support_grace_extension"],
    recentNotices: ["Billing recheck pending", "Device limit warning"],
    appVersions: ["Desktop 2.4.1", "Android 1.9.1"],
    latestInvoiceNo: "INV-20260308-4412",
    onboardingState: "9/10 complete",
    supportSummary: "1 open billing case"
  };
}

export async function loadAdminResellerDetail(resellerId: string): Promise<AdminResellerSummary | null> {
  const remote = await optionalAdminFetch<AdminResellerSummary>(`/internal/admin/resellers/${resellerId}`);
  return remote ?? fallbackWorkspace.resellers.find((item) => item.id === resellerId) ?? null;
}

export async function loadAdminSupportCase(caseId: string): Promise<AdminSupportCase | null> {
  const remote = await optionalAdminFetch<AdminSupportCase>(`/internal/admin/support/cases/${caseId}`);
  return remote ?? fallbackWorkspace.supportCases.find((item) => item.id === caseId) ?? null;
}

export async function runAdminAction(path: string, payload: Record<string, unknown>) {
  return await apiFetch<{ success: boolean; message?: string }>(path, {
    method: "POST",
    body: JSON.stringify(payload),
    ignoreTenantHeaders: true
  });
}

export async function assignSupportCase(caseId: string, assigneeEmail: string, reason: string) {
  return await runAdminAction(`/internal/admin/support/cases/${caseId}/assign`, { assigneeEmail, reason });
}

export async function changeSupportCaseStatus(caseId: string, status: string, reason: string) {
  return await runAdminAction(`/internal/admin/support/cases/${caseId}/status`, { status, reason });
}

export async function addSupportCaseNote(caseId: string, note: string) {
  return await runAdminAction(`/internal/admin/support/cases/${caseId}/notes`, { note });
}

export async function addSupportCaseLink(caseId: string, entityType: string, entityId: string, reason: string, label?: string) {
  return await runAdminAction(`/internal/admin/support/cases/${caseId}/links`, { entityType, entityId, reason, label });
}

export async function escalateSupportCase(caseId: string, level: string, reason: string) {
  return await runAdminAction(`/internal/admin/support/cases/${caseId}/escalate`, { level, reason });
}

export async function addSupportCaseMessage(caseId: string, message: string, isInternal: boolean) {
  return await apiFetch<{ id: string; status: string }>(`/internal/admin/support/cases/${caseId}/messages`, {
    method: "POST",
    body: JSON.stringify({ message, isInternal }),
    ignoreTenantHeaders: true
  });
}

export async function startSupportAccessSession(tenantId: string | null, accessMode: "shadow_view" | "impersonation", reason: string, expiresInMinutes = 30) {
  return await apiFetch<{ id: string; status: string; expiresAt: string }>("/internal/admin/support-access/sessions/start", {
    method: "POST",
    body: JSON.stringify({ tenantId, accessMode, reason, expiresInMinutes }),
    ignoreTenantHeaders: true
  });
}

export async function endSupportAccessSession(sessionId: string, reason: string) {
  return await apiFetch<{ id: string; status: string; endedAt: string }>(`/internal/admin/support-access/sessions/${sessionId}/end`, {
    method: "POST",
    body: JSON.stringify({ reason }),
    ignoreTenantHeaders: true
  });
}
