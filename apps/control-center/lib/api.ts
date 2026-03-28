import "server-only";
import type {
  ActivityItem,
  AuditRecord,
  ConnectedList,
  DashboardMetrics,
  DeviceRow,
  DeviceStatus,
  SubscriptionRow,
  SupportCaseRow,
  SyncIssue,
  SyncIssueStatus,
  TenantDetail,
  TenantPlan,
  TenantStatus,
  TenantLifecycleState,
  TenantSummary
} from "@/types";

const API_BASE_URL =
  process.env.LOOMA_DOTNET_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:5000";
const INTERNAL_ADMIN_EMAIL =
  process.env.LOOMA_INTERNAL_ADMIN_EMAIL ??
  process.env.INTERNAL_ADMIN_BOOTSTRAP_EMAIL ??
  "ops@loomapos.local";
const INTERNAL_ADMIN_PASSWORD =
  process.env.LOOMA_INTERNAL_ADMIN_PASSWORD ??
  process.env.INTERNAL_ADMIN_BOOTSTRAP_PASSWORD ??
  "ChangeThisNow123!";
const REQUEST_TIMEOUT_MS = 15000;

type InternalTokenEnvelopeDto = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  refreshExpiresAt: string;
  email: string;
  displayName: string;
  roles: string[];
};

type InternalAdminOverviewDto = {
  activeTenants: number;
  trialTenants: number;
  activeDevices: number;
  openSupportCases: number;
};

type InternalAdminTenantDto = {
  id: string;
  tenantCode: string;
  companyName: string;
  ownerEmail?: string | null;
  phone?: string | null;
  status: string;
  planCode: string;
  billingCycle: string;
  subscriptionStatus: string;
  licenseStatus: string;
  lifecycleState?: string | null;
  deviceCount: number;
  deviceLimit: number;
  resellerCode?: string | null;
  lastSyncAt?: string | null;
};

type InternalAdminTenantDetailDto = {
  id: string;
  tenantCode: string;
  companyName: string;
  ownerEmail?: string | null;
  phone?: string | null;
  status: string;
  planCode: string;
  billingCycle: string;
  subscriptionStatus: string;
  licenseStatus: string;
  lifecycleState?: string | null;
  deviceCount: number;
  deviceLimit: number;
  resellerCode?: string | null;
  lastSyncAt?: string | null;
  notes?: string[];
  featureFlags?: string[];
  recentNotices?: string[];
  appVersions?: string[];
  latestInvoiceNo?: string | null;
  onboardingState?: string | null;
  supportSummary?: string | null;
};

type InternalAdminSupportCaseDto = {
  id: string;
  tenantId?: string | null;
  title: string;
  category: string;
  priority: string;
  status: string;
  assignee: string;
  createdAt: string;
  updatedAt: string;
  summary: string;
};

type InternalOpsAuditLogDto = {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string | null;
  createdAt: string;
};

type InternalDeadLetterDto = {
  id: string;
  eventType: string;
  tenantId: string;
  deviceId: string;
  createdAt: string;
  lastRetryAt: string;
  failureReason: string;
  payloadSummary: string;
  status: string;
};

type InternalAdminDeviceDto = {
  deviceId: string;
  tenantId: string;
  tenantName: string;
  branchId?: string | null;
  status: string;
  lastSeenAt?: string | null;
  lastSyncAt?: string | null;
  appVersion?: string | null;
  licenseStatus: string;
  isOnline: boolean;
  isStale: boolean;
};

type InternalAdminSyncIssueDto = {
  issueId: string;
  tenantId: string;
  tenantName: string;
  deviceId?: string | null;
  eventId: string;
  eventType: string;
  status: string;
  retryCount: number;
  reason: string;
  createdAt: string;
  lastAttemptAt?: string | null;
  isPermanentFailure: boolean;
  isRetryable: boolean;
};

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type AccessTokenCache = {
  token: string;
  expiresAtMs: number;
};

let accessTokenCache: AccessTokenCache | null = null;
let accessTokenPending: Promise<string> | null = null;

function normalizePlan(planCode: string): TenantPlan {
  const normalized = planCode.trim().toLowerCase();
  if (normalized === "enterprise") {
    return "enterprise";
  }
  if (normalized === "growth" || normalized === "pro") {
    return "growth";
  }
  return "starter";
}

function normalizeTenantStatus(status: string): TenantStatus {
  const normalized = status.trim().toLowerCase();
  if (normalized === "trial") {
    return "trial";
  }
  if (normalized === "active") {
    return "active";
  }
  return "suspended";
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function resolveTenantLifecycleState(input: {
  tenantStatus: string;
  subscriptionStatus: string;
  licenseStatus: string;
  lifecycleState?: string | null;
  planCode: string;
}): TenantLifecycleState {
  const backendLifecycle = normalizeText(input.lifecycleState);

  if (backendLifecycle === "trial_active") {
    return "trial_active";
  }
  if (backendLifecycle === "trial_expiring" || backendLifecycle === "trial_expiring_soon") {
    return "trial_expiring";
  }
  if (backendLifecycle === "trial_expired" || backendLifecycle === "trial_expired_read_only") {
    return "trial_expired";
  }
  if (backendLifecycle === "subscription_past_due" || backendLifecycle === "past_due" || backendLifecycle === "past-due") {
    return "subscription_past_due";
  }
  if (backendLifecycle === "subscription_canceled" || backendLifecycle === "canceled" || backendLifecycle === "cancelled") {
    return "subscription_canceled";
  }
  if (backendLifecycle === "suspended_blocked" || backendLifecycle === "suspended" || backendLifecycle === "blocked") {
    return "suspended_blocked";
  }
  return "subscription_active";
}

function normalizeDeviceOperationalStatus(status: string): DeviceStatus {
  const normalized = status.trim().toLowerCase();
  if (normalized === "active") {
    return "active";
  }
  if (normalized === "stale") {
    return "stale";
  }
  if (normalized === "blocked") {
    return "blocked";
  }
  return "offline";
}

function normalizeSyncIssueStatus(status: string): SyncIssueStatus {
  const normalized = status.trim().toLowerCase();
  if (normalized === "retrying") {
    return "retrying";
  }
  if (normalized === "dead_letter" || normalized === "dead-letter" || normalized === "deadletter") {
    return "dead_letter";
  }
  return "failed";
}

function formatTarget(targetType: string, targetId: string): string {
  if (targetType.trim().length === 0) {
    return targetId;
  }
  return `${targetType}:${targetId}`;
}

function trimOrDash(value: string | null | undefined): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : "-";
}

function listFromUnknown<T>(value: unknown): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value as T[];
}

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: "no-store"
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const raw = (await response.json()) as unknown;
  return raw as T;
}

async function loginInternalAdmin(): Promise<string> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/internal/admin/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: INTERNAL_ADMIN_EMAIL,
      password: INTERNAL_ADMIN_PASSWORD
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new ApiError(
      response.status,
      `Internal admin login failed (${response.status}): ${message}`
    );
  }

  const tokenEnvelope = await parseJson<InternalTokenEnvelopeDto>(response);
  const expiresAtMs = Date.parse(tokenEnvelope.expiresAt);

  if (!tokenEnvelope.accessToken || Number.isNaN(expiresAtMs)) {
    throw new ApiError(500, "Internal admin login response is invalid.");
  }

  accessTokenCache = {
    token: tokenEnvelope.accessToken,
    expiresAtMs
  };

  return tokenEnvelope.accessToken;
}

async function getAccessToken(): Promise<string> {
  if (accessTokenCache && accessTokenCache.expiresAtMs - 60000 > Date.now()) {
    return accessTokenCache.token;
  }

  if (accessTokenPending) {
    return await accessTokenPending;
  }

  accessTokenPending = loginInternalAdmin();

  try {
    return await accessTokenPending;
  } finally {
    accessTokenPending = null;
  }
}

async function requestAdminApi<T>(path: string, retried = false): Promise<T> {
  const token = await getAccessToken();

  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (response.status === 401 && !retried) {
    accessTokenCache = null;
    return await requestAdminApi<T>(path, true);
  }

  if (!response.ok) {
    const message = await response.text();
    throw new ApiError(response.status, `API ${response.status}: ${message}`);
  }

  return await parseJson<T>(response);
}

function toActivity(record: InternalOpsAuditLogDto): ActivityItem {
  return {
    id: record.id,
    time: record.createdAt,
    action: record.action,
    actor: record.actorEmail,
    target: formatTarget(record.targetType, record.targetId)
  };
}

function toTenantSummary(row: InternalAdminTenantDto): TenantSummary {
  const lifecycleState = resolveTenantLifecycleState({
    tenantStatus: row.status,
    subscriptionStatus: row.subscriptionStatus,
    licenseStatus: row.licenseStatus,
    planCode: row.planCode,
    lifecycleState: row.lifecycleState
  });

  return {
    id: row.id,
    name: row.companyName,
    plan: normalizePlan(row.planCode),
    status: normalizeTenantStatus(row.status),
    lifecycleState,
    devices: row.deviceCount,
    lastActivity: row.lastSyncAt ?? "-",
    subscriptionStatus: row.subscriptionStatus,
    billingCycle: row.billingCycle,
    deviceLimit: row.deviceLimit
  };
}

function toSupportCaseRow(item: InternalAdminSupportCaseDto): SupportCaseRow {
  const tenantId = item.tenantId?.trim() ? item.tenantId : null;

  return {
    caseId: item.id,
    tenantId,
    tenantName: tenantId ?? "-",
    priority: trimOrDash(item.priority),
    status: trimOrDash(item.status),
    subject: trimOrDash(item.title),
    summary: trimOrDash(item.summary),
    assignee: trimOrDash(item.assignee),
    category: trimOrDash(item.category),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt || item.createdAt
  };
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [overview, auditLogSource, tenants] = await Promise.all([
    requestAdminApi<InternalAdminOverviewDto>("/internal/admin/overview"),
    getAuditLog().catch(() => ({ connection: "not_connected", items: [] } as ConnectedList<AuditRecord>)),
    requestAdminApi<InternalAdminTenantDto[]>("/internal/admin/tenants")
  ]);

  const tenantSummaries = tenants.map(toTenantSummary);
  const trialActiveCount = tenantSummaries.filter((tenant) => tenant.lifecycleState === "trial_active").length;
  const trialExpiringSoonCount = tenantSummaries.filter((tenant) => tenant.lifecycleState === "trial_expiring").length;
  const trialExpiredCount = tenantSummaries.filter((tenant) => tenant.lifecycleState === "trial_expired").length;
  const suspendedBlockedCount = tenantSummaries.filter((tenant) => tenant.lifecycleState === "suspended_blocked").length;

  const recentActivity = auditLogSource.items
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      time: row.time,
      action: row.action,
      actor: row.actor,
      target: row.target
    }));

  return {
    totalTenants: tenantSummaries.length,
    activeTenants: overview.activeTenants,
    trialTenants: trialActiveCount,
    trialExpiringSoonTenants: trialExpiringSoonCount,
    trialExpiredReadOnlyTenants: trialExpiredCount,
    suspendedBlockedTenants: suspendedBlockedCount,
    devicesOnline: overview.activeDevices,
    devicesOffline: Math.max(0, tenantSummaries.reduce((sum, tenant) => sum + tenant.devices, 0) - overview.activeDevices),
    syncIssues: overview.openSupportCases,
    recentActivity
  };
}

export async function getTenants(params?: {
  query?: string;
  status?: TenantStatus | "all";
}): Promise<TenantSummary[]> {
  const query = params?.query?.trim().toLowerCase() ?? "";
  const selectedStatus = params?.status ?? "all";

  const rows = await requestAdminApi<InternalAdminTenantDto[]>("/internal/admin/tenants");

  return rows
    .map(toTenantSummary)
    .filter((tenant) => {
      const queryMatch = query.length === 0 ? true : tenant.name.toLowerCase().includes(query);
      const statusMatch = selectedStatus === "all" ? true : tenant.status === selectedStatus;
      return queryMatch && statusMatch;
    });
}

export async function getTenantDetail(id: string): Promise<TenantDetail | null> {
  let detail: InternalAdminTenantDetailDto;
  try {
    detail = await requestAdminApi<InternalAdminTenantDetailDto>(`/internal/admin/tenants/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }

  let supportConnection: TenantDetail["supportConnection"] = "not_connected";
  let supportNotes: string[] = [];

  try {
    const supportCasesSource = await getSupportCases();
    const related = supportCasesSource.items.filter((item) => {
      const tenantId = item.tenantId?.toLowerCase();
      return tenantId === detail.id.toLowerCase() || tenantId === detail.tenantCode.toLowerCase();
    });

    supportNotes = related.map(
      (item) => `${item.caseId} • ${item.priority} • ${item.status} • ${item.subject}`
    );
    supportConnection = supportCasesSource.connection;
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) {
      throw error;
    }
  }

  let auditConnection: TenantDetail["auditConnection"] = "not_connected";
  let recentActivity: ActivityItem[] = [];

  try {
    const auditRows = await requestAdminApi<InternalOpsAuditLogDto[]>("/internal/admin/ops/audit-logs");
    recentActivity = auditRows
      .filter((item) =>
        item.targetId.toLowerCase() === detail.id.toLowerCase() ||
        item.targetId.toLowerCase() === detail.tenantCode.toLowerCase()
      )
      .slice(0, 10)
      .map(toActivity);
    auditConnection = "connected";
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) {
      throw error;
    }
  }

  let syncConnection: TenantDetail["syncConnection"] = "not_connected";
  let syncSummary = "Sync issue endpoint not connected.";

  try {
    const deadLetters = await requestAdminApi<InternalDeadLetterDto[]>("/internal/admin/dead-letter");
    const tenantIssues = deadLetters.filter((item) => item.tenantId.toLowerCase() === detail.tenantCode.toLowerCase());
    syncSummary =
      tenantIssues.length === 0
        ? "No dead-letter sync event for this tenant in latest snapshot."
        : `${tenantIssues.length} dead-letter sync event(s) detected.`;
    syncConnection = "partial";
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) {
      throw error;
    }
  }

  return {
    id: detail.id,
    tenantCode: detail.tenantCode,
    name: detail.companyName,
    ownerEmail: trimOrDash(detail.ownerEmail),
    phone: trimOrDash(detail.phone),
    plan: normalizePlan(detail.planCode),
    status: normalizeTenantStatus(detail.status),
    lifecycleState: resolveTenantLifecycleState({
      tenantStatus: detail.status,
      subscriptionStatus: detail.subscriptionStatus,
      licenseStatus: detail.licenseStatus,
      planCode: detail.planCode,
      lifecycleState: detail.lifecycleState
    }),
    subscriptionStatus: detail.subscriptionStatus,
    billingCycle: detail.billingCycle,
    devices: detail.deviceCount,
    deviceLimit: detail.deviceLimit,
    licenseStatus: detail.licenseStatus,
    resellerCode: detail.resellerCode ?? null,
    lastActivity: detail.lastSyncAt ?? "-",
    supportNotes,
    recentActivity,
    featureFlags: listFromUnknown<string>(detail.featureFlags),
    recentNotices: listFromUnknown<string>(detail.recentNotices),
    appVersions: listFromUnknown<string>(detail.appVersions),
    latestInvoiceNo: detail.latestInvoiceNo ?? "-",
    onboardingState: detail.onboardingState ?? "-",
    supportSummary: detail.supportSummary ?? "-",
    supportConnection,
    auditConnection,
    syncConnection,
    syncSummary
  };
}

function toDeviceFromInternal(row: InternalAdminDeviceDto): DeviceRow {
  return {
    deviceId: row.deviceId,
    tenantId: row.tenantId,
    tenantName: trimOrDash(row.tenantName),
    branchId: row.branchId ?? null,
    status: normalizeDeviceOperationalStatus(row.status),
    lastSeenAt: row.lastSeenAt ?? null,
    lastSyncAt: row.lastSyncAt ?? null,
    appVersion: row.appVersion ?? null,
    licenseStatus: trimOrDash(row.licenseStatus),
    isOnline: row.isOnline,
    isStale: row.isStale
  };
}

export async function getDevices(params?: {
  query?: string;
  status?: DeviceStatus | "all";
  tenantId?: string;
}): Promise<ConnectedList<DeviceRow>> {
  const query = params?.query?.trim();
  const status = params?.status ?? "all";
  const tenantId = params?.tenantId?.trim();

  const queryParams = new URLSearchParams();
  if (query && query.length > 0) {
    queryParams.set("search", query);
  }
  if (status !== "all") {
    queryParams.set("status", status);
  }
  if (tenantId && tenantId.length > 0) {
    queryParams.set("tenantId", tenantId);
  }

  const path =
    queryParams.size > 0
      ? "/internal/admin/devices?" + queryParams.toString()
      : "/internal/admin/devices";

  const rows = await requestAdminApi<InternalAdminDeviceDto[]>(path);

  return {
    connection: "connected",
    items: rows.map(toDeviceFromInternal)
  };
}

export async function getSubscriptions(): Promise<ConnectedList<SubscriptionRow>> {
  const tenants = await requestAdminApi<InternalAdminTenantDto[]>("/internal/admin/tenants");

  return {
    connection: "partial",
    message:
      "Subscription view is derived from /internal/admin/tenants because a dedicated /internal/admin/subscriptions contract is not available.",
    items: tenants.map((tenant) => ({
      id: `subscription-${tenant.id}`,
      tenantId: tenant.id,
      tenantName: tenant.companyName,
      plan: normalizePlan(tenant.planCode),
      billingCycle: tenant.billingCycle,
      renewalDate: null,
      status: tenant.subscriptionStatus,
      tenantStatus: normalizeTenantStatus(tenant.status),
      lifecycleState: resolveTenantLifecycleState({
        tenantStatus: tenant.status,
        subscriptionStatus: tenant.subscriptionStatus,
        licenseStatus: tenant.licenseStatus,
        planCode: tenant.planCode,
        lifecycleState: tenant.lifecycleState
      })
    }))
  };
}

export async function getSyncIssues(params?: {
  query?: string;
  status?: SyncIssueStatus | "all";
  retryable?: "true" | "false" | "all";
}): Promise<ConnectedList<SyncIssue>> {
  const search = params?.query?.trim();
  const status = params?.status ?? "all";
  const retryable = params?.retryable ?? "all";

  const queryParams = new URLSearchParams();
  if (search && search.length > 0) {
    queryParams.set("search", search);
  }
  if (status !== "all") {
    queryParams.set("status", status);
  }
  if (retryable !== "all") {
    queryParams.set("retryable", retryable);
  }

  const path =
    queryParams.size > 0
      ? `/internal/admin/sync-issues?${queryParams.toString()}`
      : "/internal/admin/sync-issues";

  const rows = await requestAdminApi<InternalAdminSyncIssueDto[]>(path);

  return {
    connection: "connected",
    items: rows.map((item) => ({
      issueId: item.issueId,
      tenantId: item.tenantId,
      tenantName: item.tenantName,
      deviceId: item.deviceId ?? null,
      eventId: item.eventId,
      eventType: item.eventType,
      status: normalizeSyncIssueStatus(item.status),
      retryCount: Number.isFinite(item.retryCount) ? item.retryCount : 0,
      reason: item.reason,
      createdAt: item.createdAt,
      lastAttemptAt: item.lastAttemptAt ?? null,
      isPermanentFailure: item.isPermanentFailure,
      isRetryable: item.isRetryable
    }))
  };
}

export async function getSupportCases(params?: {
  query?: string;
  status?: string | "all";
  priority?: string | "all";
}): Promise<ConnectedList<SupportCaseRow>> {
  const query = params?.query?.trim().toLowerCase() ?? "";
  const status = (params?.status ?? "all").trim().toLowerCase();
  const priority = (params?.priority ?? "all").trim().toLowerCase();

  const rows = await requestAdminApi<InternalAdminSupportCaseDto[]>("/internal/admin/support/cases");
  const mapped = rows.map(toSupportCaseRow);

  return {
    connection: "connected",
    items: mapped.filter((item) => {
      const statusMatch = status === "all" ? true : item.status.toLowerCase() === status;
      const priorityMatch = priority === "all" ? true : item.priority.toLowerCase() === priority;
      const queryMatch =
        query.length === 0
          ? true
          : [
              item.caseId,
              item.tenantName,
              item.tenantId ?? "",
              item.subject,
              item.summary,
              item.assignee
            ]
              .join(" ")
              .toLowerCase()
              .includes(query);

      return statusMatch && priorityMatch && queryMatch;
    })
  };
}

export async function getSupportNotes(): Promise<ConnectedList<SupportCaseRow>> {
  return await getSupportCases();
}

export async function getAuditLog(): Promise<ConnectedList<AuditRecord>> {
  try {
    const rows = await requestAdminApi<InternalOpsAuditLogDto[]>("/internal/admin/ops/audit-logs");
    return {
      connection: "connected",
      items: rows.map((row) => ({
        id: row.id,
        time: row.createdAt,
        action: row.action,
        actor: row.actorEmail,
        target: formatTarget(row.targetType, row.targetId)
      }))
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return {
        connection: "not_connected",
        message: "Audit log endpoint is not connected.",
        items: []
      };
    }

    throw error;
  }
}

export function toUiError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error while loading control-center data.";
}
