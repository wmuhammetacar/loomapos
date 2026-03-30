import "server-only";
import type {
  ActivityItem,
  AuditRecord,
  CustomerAccountBalanceState,
  CustomerAccountDetailRow,
  CustomerAccountEntryRow,
  CustomerAccountRow,
  ConnectedList,
  DashboardMetrics,
  DeviceRow,
  DeviceStatus,
  SubscriptionRow,
  SupplierDetailRow,
  SupplierRow,
  SupportCaseRow,
  SyncIssue,
  SyncIssueStatus,
  TenantDetail,
  TenantPlan,
  TenantStatus,
  TenantLifecycleState,
  TenantSummary,
  WarehouseDetailRow,
  PurchaseOrderDetailRow,
  PurchaseOrderRow,
  PurchaseOrderStatus,
  WarehouseSummaryRow,
  WarehouseTransferDetailRow,
  WarehouseTransferStatus,
  WarehouseTransferSummaryRow
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
  "Demo123";
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

type InternalAdminWarehouseDto = {
  warehouseId: string;
  tenantId: string;
  tenantName: string;
  name: string;
  type: string;
  isActive: boolean;
  createdAt: string;
  productCount: number;
  totalStockQuantity: number;
};

type InternalAdminWarehouseStockDto = {
  productId: string;
  productName: string;
  sku?: string | null;
  barcode?: string | null;
  quantity: number;
  updatedAt: string;
};

type InternalAdminWarehouseDetailDto = {
  warehouseId: string;
  tenantId: string;
  tenantName: string;
  name: string;
  type: string;
  isActive: boolean;
  createdAt: string;
  productCount: number;
  totalStockQuantity: number;
  stockRows: InternalAdminWarehouseStockDto[];
};

type InternalAdminTransferLineDto = {
  lineId: string;
  productId: string;
  productName: string;
  sku?: string | null;
  barcode?: string | null;
  quantity: number;
};

type InternalAdminTransferSummaryDto = {
  transferId: string;
  tenantId: string;
  tenantName: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  status: string;
  createdAt: string;
  completedAt?: string | null;
  lineCount: number;
};

type InternalAdminTransferDetailDto = InternalAdminTransferSummaryDto & {
  lines: InternalAdminTransferLineDto[];
};

type InternalAdminSupplierDto = {
  supplierId: string;
  tenantId: string;
  tenantName: string;
  name: string;
  taxNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
  createdAt: string;
};

type InternalAdminSupplierRelatedPurchaseOrderDto = {
  purchaseOrderId: string;
  warehouseId: string;
  warehouseName: string;
  status: string;
  createdAt: string;
  receivedAt?: string | null;
  lineCount: number;
};

type InternalAdminSupplierDetailDto = InternalAdminSupplierDto & {
  relatedPurchaseOrders: InternalAdminSupplierRelatedPurchaseOrderDto[];
};

type InternalAdminPurchaseOrderLineDto = {
  lineId: string;
  productId: string;
  productName: string;
  sku?: string | null;
  barcode?: string | null;
  quantity: number;
  unitCost: number;
};

type InternalAdminPurchaseOrderSummaryDto = {
  purchaseOrderId: string;
  tenantId: string;
  tenantName: string;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  warehouseName: string;
  status: string;
  createdAt: string;
  receivedAt?: string | null;
  lineCount: number;
};

type InternalAdminPurchaseOrderDetailDto = InternalAdminPurchaseOrderSummaryDto & {
  lines: InternalAdminPurchaseOrderLineDto[];
};

type InternalAdminCustomerAccountListDto = {
  contactId: string;
  tenantId: string;
  tenantName: string;
  customerName: string;
  email?: string | null;
  phone?: string | null;
  balance: number;
  currency: string;
  updatedAt: string;
  balanceState?: string | null;
};

type InternalAdminCustomerAccountEntryDto = {
  entryId: string;
  type: string;
  amount: number;
  refType: string;
  refId: string;
  createdAt: string;
  note?: string | null;
};

type InternalAdminCustomerAccountDetailDto = InternalAdminCustomerAccountListDto & {
  accountId: string;
  entries: InternalAdminCustomerAccountEntryDto[];
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

function normalizeWarehouseTransferStatus(status: string): WarehouseTransferStatus {
  const normalized = status.trim().toLowerCase();
  if (normalized === "in_transit") {
    return "in_transit";
  }
  if (normalized === "completed") {
    return "completed";
  }
  if (normalized === "canceled" || normalized === "cancelled") {
    return "canceled";
  }
  return "draft";
}

function normalizePurchaseOrderStatus(status: string): PurchaseOrderStatus {
  const normalized = status.trim().toLowerCase();
  if (normalized === "ordered") {
    return "ordered";
  }
  if (normalized === "received") {
    return "received";
  }
  if (normalized === "canceled" || normalized === "cancelled") {
    return "canceled";
  }
  return "draft";
}

function normalizeCustomerAccountBalanceState(status: string | null | undefined): CustomerAccountBalanceState {
  const normalized = status?.trim().toLowerCase();
  if (normalized === "credit") {
    return "credit";
  }
  if (normalized === "positive") {
    return "positive";
  }
  return "zero";
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

async function requestAdminApiMutation<T>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
  retried = false
): Promise<T> {
  const token = await getAccessToken();

  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (response.status === 401 && !retried) {
    accessTokenCache = null;
    return await requestAdminApiMutation<T>(path, method, body, true);
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

function toWarehouseSummary(row: InternalAdminWarehouseDto): WarehouseSummaryRow {
  return {
    warehouseId: row.warehouseId,
    tenantId: row.tenantId,
    tenantName: trimOrDash(row.tenantName),
    name: trimOrDash(row.name),
    type: trimOrDash(row.type),
    isActive: row.isActive,
    createdAt: row.createdAt,
    productCount: Number.isFinite(row.productCount) ? row.productCount : 0,
    totalStockQuantity: Number.isFinite(row.totalStockQuantity) ? row.totalStockQuantity : 0
  };
}

function toWarehouseDetail(row: InternalAdminWarehouseDetailDto): WarehouseDetailRow {
  return {
    warehouseId: row.warehouseId,
    tenantId: row.tenantId,
    tenantName: trimOrDash(row.tenantName),
    name: trimOrDash(row.name),
    type: trimOrDash(row.type),
    isActive: row.isActive,
    createdAt: row.createdAt,
    productCount: Number.isFinite(row.productCount) ? row.productCount : 0,
    totalStockQuantity: Number.isFinite(row.totalStockQuantity) ? row.totalStockQuantity : 0,
    stockRows: row.stockRows.map((item) => ({
      productId: item.productId,
      productName: trimOrDash(item.productName),
      sku: item.sku ?? null,
      barcode: item.barcode ?? null,
      quantity: Number.isFinite(item.quantity) ? item.quantity : 0,
      updatedAt: item.updatedAt
    }))
  };
}

function toTransferSummary(row: InternalAdminTransferSummaryDto): WarehouseTransferSummaryRow {
  return {
    transferId: row.transferId,
    tenantId: row.tenantId,
    tenantName: trimOrDash(row.tenantName),
    fromWarehouseId: row.fromWarehouseId,
    fromWarehouseName: trimOrDash(row.fromWarehouseName),
    toWarehouseId: row.toWarehouseId,
    toWarehouseName: trimOrDash(row.toWarehouseName),
    status: normalizeWarehouseTransferStatus(row.status),
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? null,
    lineCount: Number.isFinite(row.lineCount) ? row.lineCount : 0
  };
}

function toTransferDetail(row: InternalAdminTransferDetailDto): WarehouseTransferDetailRow {
  return {
    ...toTransferSummary(row),
    lines: row.lines.map((line) => ({
      lineId: line.lineId,
      productId: line.productId,
      productName: trimOrDash(line.productName),
      sku: line.sku ?? null,
      barcode: line.barcode ?? null,
      quantity: Number.isFinite(line.quantity) ? line.quantity : 0
    }))
  };
}

export async function getWarehouses(params?: {
  query?: string;
  type?: string | "all";
  isActive?: "all" | "true" | "false";
  tenantId?: string;
}): Promise<ConnectedList<WarehouseSummaryRow>> {
  const query = params?.query?.trim();
  const type = params?.type ?? "all";
  const isActive = params?.isActive ?? "all";
  const tenantId = params?.tenantId?.trim();

  const queryParams = new URLSearchParams();
  if (query && query.length > 0) {
    queryParams.set("search", query);
  }
  if (type !== "all") {
    queryParams.set("type", type);
  }
  if (isActive !== "all") {
    queryParams.set("isActive", isActive);
  }
  if (tenantId && tenantId.length > 0) {
    queryParams.set("tenantId", tenantId);
  }

  const path =
    queryParams.size > 0
      ? `/internal/admin/erp/warehouses?${queryParams.toString()}`
      : "/internal/admin/erp/warehouses";

  const rows = await requestAdminApi<InternalAdminWarehouseDto[]>(path);
  return {
    connection: "connected",
    items: rows.map(toWarehouseSummary)
  };
}

export async function getWarehouseDetail(
  warehouseId: string,
  params?: { query?: string }
): Promise<WarehouseDetailRow | null> {
  const query = params?.query?.trim();
  const queryParams = new URLSearchParams();
  if (query && query.length > 0) {
    queryParams.set("search", query);
  }

  const path =
    queryParams.size > 0
      ? `/internal/admin/erp/warehouses/${warehouseId}?${queryParams.toString()}`
      : `/internal/admin/erp/warehouses/${warehouseId}`;

  try {
    const row = await requestAdminApi<InternalAdminWarehouseDetailDto>(path);
    return toWarehouseDetail(row);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getWarehouseTransfers(params?: {
  query?: string;
  status?: WarehouseTransferStatus | "all";
  tenantId?: string;
}): Promise<ConnectedList<WarehouseTransferSummaryRow>> {
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
      ? `/internal/admin/erp/transfers?${queryParams.toString()}`
      : "/internal/admin/erp/transfers";

  const rows = await requestAdminApi<InternalAdminTransferSummaryDto[]>(path);
  return {
    connection: "connected",
    items: rows.map(toTransferSummary)
  };
}

export async function getWarehouseTransferDetail(transferId: string): Promise<WarehouseTransferDetailRow | null> {
  try {
    const row = await requestAdminApi<InternalAdminTransferDetailDto>(
      `/internal/admin/erp/transfers/${transferId}`
    );
    return toTransferDetail(row);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function createWarehouseTransferDraft(input: {
  tenantId?: string;
  fromWarehouseId: string;
  toWarehouseId: string;
}): Promise<WarehouseTransferDetailRow> {
  const payload = {
    tenantId: input.tenantId,
    fromWarehouseId: input.fromWarehouseId,
    toWarehouseId: input.toWarehouseId
  };

  const row = await requestAdminApiMutation<InternalAdminTransferDetailDto>(
    "/internal/admin/erp/transfers",
    "POST",
    payload
  );

  return toTransferDetail(row);
}

export async function addWarehouseTransferLine(input: {
  transferId: string;
  tenantId?: string;
  productId: string;
  quantity: number;
}): Promise<WarehouseTransferDetailRow> {
  const payload = {
    tenantId: input.tenantId,
    productId: input.productId,
    quantity: input.quantity
  };

  const row = await requestAdminApiMutation<InternalAdminTransferDetailDto>(
    `/internal/admin/erp/transfers/${input.transferId}/lines`,
    "POST",
    payload
  );

  return toTransferDetail(row);
}

export async function completeWarehouseTransfer(input: {
  transferId: string;
  tenantId?: string;
  branchId?: string;
}): Promise<WarehouseTransferDetailRow> {
  const payload = {
    tenantId: input.tenantId,
    branchId: input.branchId
  };

  const row = await requestAdminApiMutation<InternalAdminTransferDetailDto>(
    `/internal/admin/erp/transfers/${input.transferId}/complete`,
    "POST",
    payload
  );

  return toTransferDetail(row);
}

function toSupplierRow(row: InternalAdminSupplierDto): SupplierRow {
  return {
    supplierId: row.supplierId,
    tenantId: row.tenantId,
    tenantName: trimOrDash(row.tenantName),
    name: trimOrDash(row.name),
    taxNumber: row.taxNumber ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt
  };
}

function toSupplierDetail(row: InternalAdminSupplierDetailDto): SupplierDetailRow {
  return {
    ...toSupplierRow(row),
    relatedPurchaseOrders: row.relatedPurchaseOrders.map((item) => ({
      purchaseOrderId: item.purchaseOrderId,
      warehouseId: item.warehouseId,
      warehouseName: trimOrDash(item.warehouseName),
      status: trimOrDash(item.status),
      createdAt: item.createdAt,
      receivedAt: item.receivedAt ?? null,
      lineCount: Number.isFinite(item.lineCount) ? item.lineCount : 0
    }))
  };
}

function toPurchaseOrderRow(row: InternalAdminPurchaseOrderSummaryDto): PurchaseOrderRow {
  return {
    purchaseOrderId: row.purchaseOrderId,
    tenantId: row.tenantId,
    tenantName: trimOrDash(row.tenantName),
    supplierId: row.supplierId,
    supplierName: trimOrDash(row.supplierName),
    warehouseId: row.warehouseId,
    warehouseName: trimOrDash(row.warehouseName),
    status: normalizePurchaseOrderStatus(row.status),
    createdAt: row.createdAt,
    receivedAt: row.receivedAt ?? null,
    lineCount: Number.isFinite(row.lineCount) ? row.lineCount : 0
  };
}

function toPurchaseOrderDetail(row: InternalAdminPurchaseOrderDetailDto): PurchaseOrderDetailRow {
  return {
    ...toPurchaseOrderRow(row),
    lines: row.lines.map((line) => ({
      lineId: line.lineId,
      productId: line.productId,
      productName: trimOrDash(line.productName),
      sku: line.sku ?? null,
      barcode: line.barcode ?? null,
      quantity: Number.isFinite(line.quantity) ? line.quantity : 0,
      unitCost: Number.isFinite(line.unitCost) ? line.unitCost : 0
    }))
  };
}

function toCustomerAccountRow(row: InternalAdminCustomerAccountListDto): CustomerAccountRow {
  return {
    contactId: row.contactId,
    tenantId: row.tenantId,
    tenantName: trimOrDash(row.tenantName),
    customerName: trimOrDash(row.customerName),
    email: row.email ?? null,
    phone: row.phone ?? null,
    balance: Number.isFinite(row.balance) ? row.balance : 0,
    currency: trimOrDash(row.currency),
    updatedAt: row.updatedAt,
    balanceState: normalizeCustomerAccountBalanceState(row.balanceState)
  };
}

function toCustomerAccountEntryRow(row: InternalAdminCustomerAccountEntryDto): CustomerAccountEntryRow {
  return {
    entryId: row.entryId,
    type: trimOrDash(row.type),
    amount: Number.isFinite(row.amount) ? row.amount : 0,
    refType: trimOrDash(row.refType),
    refId: trimOrDash(row.refId),
    createdAt: row.createdAt,
    note: row.note ?? null
  };
}

function toCustomerAccountDetail(row: InternalAdminCustomerAccountDetailDto): CustomerAccountDetailRow {
  return {
    ...toCustomerAccountRow(row),
    accountId: row.accountId,
    entries: row.entries.map(toCustomerAccountEntryRow)
  };
}

export async function getSuppliers(params?: {
  query?: string;
  isActive?: "all" | "true" | "false";
  tenantId?: string;
}): Promise<ConnectedList<SupplierRow>> {
  const query = params?.query?.trim();
  const isActive = params?.isActive ?? "all";
  const tenantId = params?.tenantId?.trim();

  const queryParams = new URLSearchParams();
  if (query && query.length > 0) {
    queryParams.set("search", query);
  }
  if (isActive !== "all") {
    queryParams.set("isActive", isActive);
  }
  if (tenantId && tenantId.length > 0) {
    queryParams.set("tenantId", tenantId);
  }

  const path =
    queryParams.size > 0
      ? `/internal/admin/erp/suppliers?${queryParams.toString()}`
      : "/internal/admin/erp/suppliers";

  const rows = await requestAdminApi<InternalAdminSupplierDto[]>(path);
  return {
    connection: "connected",
    items: rows.map(toSupplierRow)
  };
}

export async function getSupplierDetail(supplierId: string): Promise<SupplierDetailRow | null> {
  try {
    const row = await requestAdminApi<InternalAdminSupplierDetailDto>(
      `/internal/admin/erp/suppliers/${supplierId}`
    );
    return toSupplierDetail(row);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function createSupplier(input: {
  tenantId: string;
  name: string;
  taxNumber?: string;
  phone?: string;
  email?: string;
}): Promise<SupplierDetailRow> {
  const payload = {
    tenantId: input.tenantId,
    name: input.name,
    taxNumber: input.taxNumber,
    phone: input.phone,
    email: input.email
  };

  const row = await requestAdminApiMutation<InternalAdminSupplierDetailDto>(
    "/internal/admin/erp/suppliers",
    "POST",
    payload
  );

  return toSupplierDetail(row);
}

export async function getPurchaseOrders(params?: {
  query?: string;
  status?: PurchaseOrderStatus | "all";
  tenantId?: string;
}): Promise<ConnectedList<PurchaseOrderRow>> {
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
      ? `/internal/admin/erp/purchase-orders?${queryParams.toString()}`
      : "/internal/admin/erp/purchase-orders";

  const rows = await requestAdminApi<InternalAdminPurchaseOrderSummaryDto[]>(path);
  return {
    connection: "connected",
    items: rows.map(toPurchaseOrderRow)
  };
}

export async function getPurchaseOrderDetail(purchaseOrderId: string): Promise<PurchaseOrderDetailRow | null> {
  try {
    const row = await requestAdminApi<InternalAdminPurchaseOrderDetailDto>(
      `/internal/admin/erp/purchase-orders/${purchaseOrderId}`
    );
    return toPurchaseOrderDetail(row);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function createPurchaseOrderDraft(input: {
  tenantId?: string;
  supplierId: string;
  warehouseId: string;
}): Promise<PurchaseOrderDetailRow> {
  const payload = {
    tenantId: input.tenantId,
    supplierId: input.supplierId,
    warehouseId: input.warehouseId
  };

  const row = await requestAdminApiMutation<InternalAdminPurchaseOrderDetailDto>(
    "/internal/admin/erp/purchase-orders",
    "POST",
    payload
  );

  return toPurchaseOrderDetail(row);
}

export async function addPurchaseOrderLine(input: {
  purchaseOrderId: string;
  tenantId?: string;
  productId: string;
  quantity: number;
  unitCost: number;
}): Promise<PurchaseOrderDetailRow> {
  const payload = {
    tenantId: input.tenantId,
    productId: input.productId,
    quantity: input.quantity,
    unitCost: input.unitCost
  };

  const row = await requestAdminApiMutation<InternalAdminPurchaseOrderDetailDto>(
    `/internal/admin/erp/purchase-orders/${input.purchaseOrderId}/lines`,
    "POST",
    payload
  );

  return toPurchaseOrderDetail(row);
}

export async function receivePurchaseOrder(input: {
  purchaseOrderId: string;
  tenantId?: string;
  branchId?: string;
}): Promise<PurchaseOrderDetailRow> {
  const payload = {
    tenantId: input.tenantId,
    branchId: input.branchId
  };

  const row = await requestAdminApiMutation<InternalAdminPurchaseOrderDetailDto>(
    `/internal/admin/erp/purchase-orders/${input.purchaseOrderId}/receive`,
    "POST",
    payload
  );

  return toPurchaseOrderDetail(row);
}

export async function getCustomerAccounts(params?: {
  query?: string;
  balance?: CustomerAccountBalanceState | "all";
  tenantId?: string;
}): Promise<ConnectedList<CustomerAccountRow>> {
  const query = params?.query?.trim();
  const balance = params?.balance ?? "all";
  const tenantId = params?.tenantId?.trim();

  const queryParams = new URLSearchParams();
  if (query && query.length > 0) {
    queryParams.set("search", query);
  }
  if (balance !== "all") {
    queryParams.set("balance", balance);
  }
  if (tenantId && tenantId.length > 0) {
    queryParams.set("tenantId", tenantId);
  }

  const path =
    queryParams.size > 0
      ? `/internal/admin/erp/customer-accounts?${queryParams.toString()}`
      : "/internal/admin/erp/customer-accounts";

  const rows = await requestAdminApi<InternalAdminCustomerAccountListDto[]>(path);
  return {
    connection: "connected",
    items: rows.map(toCustomerAccountRow)
  };
}

export async function getCustomerAccountDetail(contactId: string): Promise<CustomerAccountDetailRow | null> {
  try {
    const row = await requestAdminApi<InternalAdminCustomerAccountDetailDto>(
      `/internal/admin/erp/customer-accounts/${contactId}`
    );
    return toCustomerAccountDetail(row);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function recordCustomerAccountCollection(input: {
  contactId: string;
  tenantId?: string;
  amount: number;
  referenceType?: string;
  referenceId?: string;
  note?: string;
}): Promise<CustomerAccountDetailRow> {
  const payload = {
    tenantId: input.tenantId,
    amount: input.amount,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    note: input.note
  };

  const row = await requestAdminApiMutation<InternalAdminCustomerAccountDetailDto>(
    `/internal/admin/erp/customer-accounts/${input.contactId}/collections`,
    "POST",
    payload
  );

  return toCustomerAccountDetail(row);
}

export async function recordCustomerAccountAdjustment(input: {
  contactId: string;
  tenantId?: string;
  amountDelta: number;
  referenceType?: string;
  referenceId?: string;
  note?: string;
}): Promise<CustomerAccountDetailRow> {
  const payload = {
    tenantId: input.tenantId,
    amountDelta: input.amountDelta,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    note: input.note
  };

  const row = await requestAdminApiMutation<InternalAdminCustomerAccountDetailDto>(
    `/internal/admin/erp/customer-accounts/${input.contactId}/adjustments`,
    "POST",
    payload
  );

  return toCustomerAccountDetail(row);
}

export async function recordCustomerAccountRefundCredit(input: {
  contactId: string;
  tenantId?: string;
  amount: number;
  referenceType?: string;
  referenceId?: string;
  note?: string;
}): Promise<CustomerAccountDetailRow> {
  const payload = {
    tenantId: input.tenantId,
    amount: input.amount,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    note: input.note
  };

  const row = await requestAdminApiMutation<InternalAdminCustomerAccountDetailDto>(
    `/internal/admin/erp/customer-accounts/${input.contactId}/refund-credits`,
    "POST",
    payload
  );

  return toCustomerAccountDetail(row);
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
