export type TenantPlan = "starter" | "growth" | "enterprise";

export type TenantStatus = "active" | "trial" | "suspended";
export type TenantLifecycleState =
  | "trial_active"
  | "trial_expiring"
  | "trial_expired"
  | "subscription_active"
  | "subscription_past_due"
  | "subscription_canceled"
  | "suspended_blocked";

export type DeviceStatus = "active" | "stale" | "offline" | "blocked";

export type DataConnectionStatus = "connected" | "partial" | "not_connected";

export interface ActivityItem {
  id: string;
  time: string;
  action: string;
  actor: string;
  target: string;
}

export interface DashboardMetrics {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  trialExpiringSoonTenants: number;
  trialExpiredReadOnlyTenants: number;
  suspendedBlockedTenants: number;
  devicesOnline: number;
  devicesOffline: number;
  syncIssues: number;
  recentActivity: ActivityItem[];
}

export interface TenantSummary {
  id: string;
  name: string;
  plan: TenantPlan;
  status: TenantStatus;
  lifecycleState: TenantLifecycleState;
  devices: number;
  lastActivity: string;
  subscriptionStatus: string;
  billingCycle: string;
  deviceLimit: number;
}

export interface TenantDetail extends TenantSummary {
  tenantCode: string;
  ownerEmail: string;
  phone: string;
  licenseStatus: string;
  resellerCode?: string | null;
  supportNotes: string[];
  recentActivity: ActivityItem[];
  featureFlags: string[];
  recentNotices: string[];
  appVersions: string[];
  latestInvoiceNo: string;
  onboardingState: string;
  supportSummary: string;
  supportConnection: DataConnectionStatus;
  auditConnection: DataConnectionStatus;
  syncConnection: DataConnectionStatus;
  syncSummary: string;
}

export interface DeviceRow {
  deviceId: string;
  tenantId: string;
  tenantName: string;
  branchId: string | null;
  status: DeviceStatus;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  appVersion: string | null;
  licenseStatus: string;
  isOnline: boolean;
  isStale: boolean;
}

export type WarehouseType = "main" | "branch" | "virtual" | string;

export interface WarehouseSummaryRow {
  warehouseId: string;
  tenantId: string;
  tenantName: string;
  name: string;
  type: WarehouseType;
  isActive: boolean;
  createdAt: string;
  productCount: number;
  totalStockQuantity: number;
}

export interface WarehouseStockRow {
  productId: string;
  productName: string;
  sku: string | null;
  barcode: string | null;
  quantity: number;
  updatedAt: string;
}

export interface WarehouseDetailRow {
  warehouseId: string;
  tenantId: string;
  tenantName: string;
  name: string;
  type: WarehouseType;
  isActive: boolean;
  createdAt: string;
  productCount: number;
  totalStockQuantity: number;
  stockRows: WarehouseStockRow[];
}

export type WarehouseTransferStatus = "draft" | "in_transit" | "completed" | "canceled";

export interface WarehouseTransferSummaryRow {
  transferId: string;
  tenantId: string;
  tenantName: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  status: WarehouseTransferStatus;
  createdAt: string;
  completedAt: string | null;
  lineCount: number;
}

export interface WarehouseTransferLineRow {
  lineId: string;
  productId: string;
  productName: string;
  sku: string | null;
  barcode: string | null;
  quantity: number;
}

export interface WarehouseTransferDetailRow extends WarehouseTransferSummaryRow {
  lines: WarehouseTransferLineRow[];
}

export interface SupplierRow {
  supplierId: string;
  tenantId: string;
  tenantName: string;
  name: string;
  taxNumber: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface SupplierRelatedPurchaseOrderRow {
  purchaseOrderId: string;
  warehouseId: string;
  warehouseName: string;
  status: string;
  createdAt: string;
  receivedAt: string | null;
  lineCount: number;
}

export interface SupplierDetailRow extends SupplierRow {
  relatedPurchaseOrders: SupplierRelatedPurchaseOrderRow[];
}

export type PurchaseOrderStatus = "draft" | "ordered" | "received" | "canceled";

export interface PurchaseOrderRow {
  purchaseOrderId: string;
  tenantId: string;
  tenantName: string;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  warehouseName: string;
  status: PurchaseOrderStatus;
  createdAt: string;
  receivedAt: string | null;
  lineCount: number;
}

export interface PurchaseOrderLineRow {
  lineId: string;
  productId: string;
  productName: string;
  sku: string | null;
  barcode: string | null;
  quantity: number;
  unitCost: number;
}

export interface PurchaseOrderDetailRow extends PurchaseOrderRow {
  lines: PurchaseOrderLineRow[];
}

export type CustomerAccountBalanceState = "positive" | "zero" | "credit";

export interface CustomerAccountRow {
  contactId: string;
  tenantId: string;
  tenantName: string;
  customerName: string;
  email: string | null;
  phone: string | null;
  balance: number;
  currency: string;
  updatedAt: string;
  balanceState: CustomerAccountBalanceState;
}

export interface CustomerAccountEntryRow {
  entryId: string;
  type: "sale_charge" | "collection" | "adjustment" | "refund_credit" | string;
  amount: number;
  refType: string;
  refId: string;
  createdAt: string;
  note: string | null;
}

export interface CustomerAccountDetailRow extends CustomerAccountRow {
  accountId: string;
  entries: CustomerAccountEntryRow[];
}

export type AccountingExportStatus = "pending" | "exported" | "failed";

export interface AccountingExportItemRow {
  id: string;
  tenantId: string | null;
  sourceType: string;
  sourceId: string;
  eventCode: string;
  status: AccountingExportStatus;
  createdAt: string;
  exportedAt: string | null;
  failureReason: string | null;
}

export interface AccountingExportItemDetailRow extends AccountingExportItemRow {
  payloadJson: string;
}


export interface SubscriptionRow {
  id: string;
  tenantId: string;
  tenantName: string;
  plan: TenantPlan;
  billingCycle: string;
  renewalDate: string | null;
  status: string;
  tenantStatus: TenantStatus;
  lifecycleState: TenantLifecycleState;
}

export type SyncIssueStatus = "retrying" | "failed" | "dead_letter";

export interface SyncIssue {
  issueId: string;
  tenantId: string;
  tenantName: string;
  deviceId: string | null;
  eventId: string;
  eventType: string;
  status: SyncIssueStatus;
  retryCount: number;
  reason: string;
  createdAt: string;
  lastAttemptAt: string | null;
  isPermanentFailure: boolean;
  isRetryable: boolean;
}

export interface SupportCaseRow {
  caseId: string;
  tenantId: string | null;
  tenantName: string;
  priority: string;
  status: string;
  subject: string;
  summary: string;
  assignee: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditRecord {
  id: string;
  time: string;
  action: string;
  actor: string;
  target: string;
}

export interface ConnectedList<T> {
  connection: DataConnectionStatus;
  message?: string;
  items: T[];
}
