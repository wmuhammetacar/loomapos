export interface DesktopProduct {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unit: string;
  taxRate: number;
  price: number;
}

export interface DesktopSaleSummary {
  saleId: string;
  receiptNo: string;
  status: string;
  total: number;
  createdAt: string;
}

export interface DesktopEndOfDaySummary {
  saleCount: number;
  grossTotal: number;
  discountTotal: number;
  taxTotal: number;
  netTotal: number;
}

export type DesktopPaymentMethod = "CASH" | "CARD";
export type DesktopRefundPaymentMode = DesktopPaymentMethod | "SAME_AS_ORIGINAL";

export interface DesktopRefundCandidateLine {
  saleLineId: string;
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  discount: number;
  tax: number;
  taxRate: number;
  lineTotal: number;
}

export interface DesktopRefundCandidateSale {
  saleId: string;
  receiptNo: string;
  status: string;
  createdAt: string;
  lines: DesktopRefundCandidateLine[];
  payments: Array<{
    method: DesktopPaymentMethod;
    amount: number;
  }>;
}

export interface DesktopXReportSummary {
  date: string;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  transactionCount: number;
  refundTotal: number;
  cashRefund: number;
  cardRefund: number;
}

export interface DesktopZReportPreview {
  date: string;
  openingCash: number;
  cashSales: number;
  cardSales: number;
  refundTotal: number;
  cashRefund: number;
  cardRefund: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  transactionCount: number;
  cashAdjustmentNet?: number;
}

export interface DesktopSyncStatus {
  isRunning: boolean;
  pending: number;
  failed: number;
  sent: number;
  deadLetter: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastPullAt: string | null;
  lastHeartbeatAt: string | null;
  lastError: string | null;
  lastTryAt: string | null;
  connectionQuality: "online" | "degraded" | "offline";
  blockedReason: string | null;
}

export interface DesktopCashSession {
  cashSessionId: string;
  tenantId: string;
  branchId: string;
  deviceId: string;
  cashierUserId: string;
  cashierName: string;
  openedAt: string;
  openingCashAmount: number;
  closedAt: string | null;
  closingCashExpected: number | null;
  closingCashCounted: number | null;
  discrepancyAmount: number | null;
  status: "OPEN" | "CLOSED";
  createdAt: string;
  updatedAt: string;
}

export interface DesktopSessionReport {
  cashSessionId: string;
  openedAt: string;
  openingCash: number;
  salesTotal: number;
  cashSales: number;
  cardSales: number;
  refundTotal: number;
  cashRefund: number;
  cardRefund: number;
  cashAdjustmentNet: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  transactionCount: number;
}

export interface DesktopShiftSummary {
  activeSession: DesktopCashSession | null;
  latestSession: DesktopCashSession | null;
  report: DesktopSessionReport | null;
  requireOpenShift: boolean;
}

export type DesktopBootstrapStage = "activation_required" | "login_required" | "ready" | "locked";

export interface DesktopLicenseStatus {
  status: "UNKNOWN" | "ACTIVE" | "READ_ONLY" | "LOCKED" | "ERROR";
  planCode: string | null;
  expiresAt: string | null;
  graceDays: number | null;
  maxDevices: number | null;
  activeDevices: number | null;
  message: string | null;
  lastCheckedAt: string | null;
}

export interface DesktopSessionSnapshot {
  email: string;
  displayName: string;
  companyName: string | null;
  tenantId: string | null;
  portalType: string;
  roles: string[];
  expiresAt: string;
  refreshExpiresAt: string;
  lastValidatedAt: string;
  offlineAllowedUntil: string | null;
  isOfflineSession: boolean;
}

export interface DesktopCashierSnapshot {
  cashierId: string;
  tenantId: string | null;
  email: string;
  displayName: string;
  operationalRole: string;
  permissions: string[];
  sourceSessionId: string | null;
}

export interface DesktopActivationSnapshot {
  activationId: string;
  tenantId: string;
  companyName: string | null;
  branchId: string;
  branchName: string;
  deviceId: string;
  deviceName: string;
  licenseId: string | null;
  licenseKey: string | null;
  planCode: string | null;
  featureFlags: string[];
  activatedAt: string;
  expiresAt: string | null;
  graceDays: number;
  lastValidationAt: string;
  offlineAllowedUntil: string | null;
  status: string;
}

export interface DesktopSettingsSnapshot {
  deviceId: string;
  deviceName: string;
  branchId: string | null;
  branchName: string | null;
  printerName: string | null;
  version: string;
}

export interface DesktopActivationContext {
  companyName: string;
  tenantId: string;
  billingEmail: string;
  planCode: string;
  licenseId: string;
  licenseKey: string;
  expiresAt: string;
  graceDays: number;
  deviceLimit: number | null;
  featureFlags: string[];
  suggestedDeviceName: string;
  suggestedBranchName: string;
}

export interface DesktopBootstrapState {
  stage: DesktopBootstrapStage;
  online: boolean;
  message: string | null;
  session: DesktopSessionSnapshot | null;
  cashier: DesktopCashierSnapshot | null;
  activation: DesktopActivationSnapshot | null;
  settings: DesktopSettingsSnapshot;
  license: DesktopLicenseStatus;
  sync: DesktopSyncStatus;
}

export interface DesktopPosApi {
  getBootstrap: () => Promise<DesktopBootstrapState>;
  login: (args: { email: string; password: string }) => Promise<DesktopBootstrapState>;
  logout: () => Promise<DesktopBootstrapState>;
  getActivationContext: () => Promise<DesktopActivationContext>;
  activateDesktop: (args: {
    branchName: string;
    branchCode?: string | null;
    deviceName: string;
  }) => Promise<DesktopBootstrapState>;
  clearActivation: () => Promise<DesktopBootstrapState>;
  getDesktopSettings: () => Promise<DesktopSettingsSnapshot>;
  updateDesktopSettings: (args: {
    deviceName?: string;
    printerName?: string | null;
  }) => Promise<DesktopSettingsSnapshot>;
  getContext: () => Promise<{ tenantId: string; branchId: string; deviceId: string }>;
  listProducts: (args: { search?: string; barcode?: string }) => Promise<DesktopProduct[]>;
  getShiftStatus: () => Promise<DesktopShiftSummary>;
  openShift: (args: { openingCash: number }) => Promise<DesktopCashSession>;
  recordCashAdjustment: (args: {
    type: "cash_in" | "cash_out" | "correction";
    amount: number;
    reason: string;
  }) => Promise<{
    localCashAdjustmentId: string;
    cashSessionId: string;
    type: "cash_in" | "cash_out" | "correction";
    amount: number;
    reason: string;
    createdBy: string;
    createdAt: string;
    syncStatus: string;
  }>;
  createSale: (args: {
    customerName?: string | null;
    discount: number;
    paymentMethod: DesktopPaymentMethod;
    lines: Array<{ productId: string; qty: number; unitPrice: number; discount: number }>;
  }) => Promise<{
    saleId: string;
    receiptNo: string;
    total: number;
    receiptText: string;
    printWarning?: string;
    fiscalStatus?: "SKIPPED" | "SENT" | "QUEUED";
    fiscalWarning?: string;
    fiscalReferenceNo?: string;
  }>;
  voidSale: (args: { saleId: string; reason: string }) => Promise<{ ok: true }>;
  getSaleByReceipt: (args: { receiptNo: string }) => Promise<DesktopRefundCandidateSale | null>;
  createRefund: (args: {
    sourceSaleId?: string | null;
    sourceReceiptNo?: string | null;
    paymentMode: DesktopRefundPaymentMode;
    returnToStock?: boolean;
    refundReasonCode?: string | null;
    lines: Array<{
      sourceLineId?: string | null;
      productId: string;
      qty: number;
      unitPrice?: number;
      discount?: number;
      taxRate?: number;
    }>;
  }) => Promise<{
    refundSaleId: string;
    receiptNo: string;
    total: number;
    paymentMethod: DesktopPaymentMethod;
    receiptText: string;
    printWarning?: string;
    fiscalStatus?: "SKIPPED" | "SENT" | "QUEUED";
    fiscalWarning?: string;
    fiscalReferenceNo?: string;
  }>;
  getRecentSales: () => Promise<DesktopSaleSummary[]>;
  getEndOfDay: (args: { date: string }) => Promise<DesktopEndOfDaySummary>;
  getXReport: (args: { date: string }) => Promise<DesktopXReportSummary>;
  printXReport: (args: { date: string }) => Promise<{
    report: DesktopXReportSummary;
    printWarning?: string;
  }>;
  getZPreview: (args: {
    date: string;
    openingCash: number;
    countedCash: number;
  }) => Promise<DesktopZReportPreview>;
  closeZReport: (args: {
    date: string;
    openingCash: number;
    countedCash: number;
    cashierName: string;
  }) => Promise<{
    reportId: string;
    preview: DesktopZReportPreview;
    receiptText: string;
    printWarning?: string;
  }>;
  getSyncStatus: () => Promise<DesktopSyncStatus>;
  syncNow: () => Promise<DesktopSyncStatus>;
  retryDeadLetterSync: () => Promise<DesktopSyncStatus>;
  getCartDraft: () => Promise<{
    draftId: string;
    tenantId: string;
    branchId: string;
    deviceId: string;
    cashierUserId?: string | null;
    payloadJson: string;
    updatedAt: string;
    createdAt: string;
  } | null>;
  saveCartDraft: (args: { payloadJson: string }) => Promise<{ ok: true }>;
  clearCartDraft: () => Promise<{ ok: true }>;
  getLicenseStatus: () => Promise<DesktopLicenseStatus>;
  customerDisplayOpen: () => Promise<{ ok: true }>;
  customerDisplayUpdate: (args: {
    state?: "ACTIVE" | "THANK_YOU";
    lines: Array<{ name: string; qty: number; lineTotal: number }>;
    total: number;
  }) => Promise<{ ok: true }>;
  getAppInfo: () => Promise<{
    tenantId: string;
    branchId: string;
    deviceId: string;
    branchName: string;
    deviceName: string;
    cashierName: string;
    cashierRole: string;
    canManageCatalog: boolean;
    sync: DesktopSyncStatus;
    license: DesktopLicenseStatus;
    shift?: DesktopShiftSummary | null;
  }>;
  ping: () => Promise<{ ok: true; nonce: string }>;
}

declare global {
  interface Window {
    posApi: DesktopPosApi;
  }
}

export {};
