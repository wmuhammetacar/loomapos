import { contextBridge, ipcRenderer } from "electron";

const api = {
  getBootstrap: () => ipcRenderer.invoke("desktop:get-bootstrap"),
  login: (args: { email: string; password: string }) => ipcRenderer.invoke("desktop:login", args),
  logout: () => ipcRenderer.invoke("desktop:logout"),
  openRegister: () => ipcRenderer.invoke("desktop:open-register") as Promise<{ ok: true; url: string }>,
  getActivationContext: () => ipcRenderer.invoke("desktop:get-activation-context"),
  activateDesktop: (args: { branchName: string; branchCode?: string | null; deviceName: string }) =>
    ipcRenderer.invoke("desktop:activate", args),
  clearActivation: () => ipcRenderer.invoke("desktop:clear-activation"),
  getDesktopSettings: () => ipcRenderer.invoke("desktop:get-settings"),
  updateDesktopSettings: (args: { deviceName?: string; printerName?: string | null }) =>
    ipcRenderer.invoke("desktop:update-settings", args),
  getOnboardingState: () => ipcRenderer.invoke("desktop:get-onboarding-state"),
  seedOnboardingDemoData: () => ipcRenderer.invoke("desktop:seed-onboarding-demo"),
  completeOnboarding: () => ipcRenderer.invoke("desktop:complete-onboarding"),
  getContext: () => ipcRenderer.invoke("pos:get-context") as Promise<{ tenantId: string; branchId: string; deviceId: string }>,
  listProducts: (args: { search?: string; barcode?: string }) => ipcRenderer.invoke("pos:list-products", args),
  getShiftStatus: () => ipcRenderer.invoke("pos:get-shift-status"),
  openShift: (args: { openingCash: number }) => ipcRenderer.invoke("pos:open-shift", args),
  recordCashAdjustment: (args: { type: "cash_in" | "cash_out" | "correction"; amount: number; reason: string }) =>
    ipcRenderer.invoke("pos:record-cash-adjustment", args),
  createSale: (args: {
    customerName?: string | null;
    discount: number;
    paymentMethod: "CASH" | "CARD";
    lines: Array<{ productId: string; qty: number; unitPrice: number; discount: number }>;
  }) =>
    ipcRenderer.invoke("pos:create-sale", args) as Promise<{
      saleId: string;
      receiptNo: string;
      total: number;
      receiptText: string;
      printWarning?: string;
      fiscalStatus?: "SKIPPED" | "SENT" | "QUEUED";
      fiscalWarning?: string;
      fiscalReferenceNo?: string;
    }>,
  voidSale: (args: { saleId: string; reason: string }) => ipcRenderer.invoke("pos:void-sale", args),
  getSaleByReceipt: (args: { receiptNo: string }) => ipcRenderer.invoke("pos:get-sale-by-receipt", args) as Promise<{
    saleId: string;
    receiptNo: string;
    status: string;
    createdAt: string;
    lines: Array<{
      saleLineId: string;
      productId: string;
      productName: string;
      qty: number;
      unitPrice: number;
      discount: number;
      tax: number;
      taxRate: number;
      lineTotal: number;
    }>;
    payments: Array<{ method: "CASH" | "CARD"; amount: number }>;
  } | null>,
  createRefund: (args: {
    sourceSaleId?: string | null;
    sourceReceiptNo?: string | null;
    paymentMode: "CASH" | "CARD" | "SAME_AS_ORIGINAL";
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
  }) =>
    ipcRenderer.invoke("pos:create-refund", args) as Promise<{
      refundSaleId: string;
      receiptNo: string;
      total: number;
      paymentMethod: "CASH" | "CARD";
      receiptText: string;
      printWarning?: string;
      fiscalStatus?: "SKIPPED" | "SENT" | "QUEUED";
      fiscalWarning?: string;
      fiscalReferenceNo?: string;
    }>,
  getRecentSales: () => ipcRenderer.invoke("pos:get-recent-sales"),
  getEndOfDay: (args: { date: string }) => ipcRenderer.invoke("pos:get-end-of-day", args),
  getXReport: (args: { date: string }) =>
    ipcRenderer.invoke("pos:get-x-report", args) as Promise<{
      date: string;
      totalSales: number;
      cashSales: number;
      cardSales: number;
      transactionCount: number;
      refundTotal: number;
      cashRefund: number;
      cardRefund: number;
    }>,
  printXReport: (args: { date: string }) =>
    ipcRenderer.invoke("pos:print-x-report", args) as Promise<{
      report: {
        date: string;
        totalSales: number;
        cashSales: number;
        cardSales: number;
        transactionCount: number;
        refundTotal: number;
        cashRefund: number;
        cardRefund: number;
      };
      printWarning?: string;
    }>,
  getZPreview: (args: { date: string; openingCash: number; countedCash: number }) =>
    ipcRenderer.invoke("pos:get-z-preview", args) as Promise<{
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
    }>,
  closeZReport: (args: { date: string; openingCash: number; countedCash: number; cashierName: string }) =>
    ipcRenderer.invoke("pos:close-z-report", args) as Promise<{
      reportId: string;
      preview: {
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
      };
      receiptText: string;
      printWarning?: string;
    }>,
  getSyncStatus: () => ipcRenderer.invoke("pos:get-sync-status"),
  getSyncDiagnostics: () => ipcRenderer.invoke("pos:get-sync-diagnostics") as Promise<{
    pendingCount: number;
    failedCount: number;
    lastSuccessfulSyncAt: string | null;
    health: "healthy" | "delayed" | "failed";
  }>,
  syncNow: () => ipcRenderer.invoke("pos:sync-now"),
  retryDeadLetterSync: () => ipcRenderer.invoke("pos:retry-dead-letter-sync"),
  getCartDraft: () => ipcRenderer.invoke("pos:get-cart-draft"),
  restoreCartDraft: () =>
    ipcRenderer.invoke("pos:restore-cart-draft") as Promise<{
      restored: boolean;
      draft: {
        cart: Array<{
          productId: string;
          name: string;
          taxRate: number;
          qty: number;
          unitPrice: number;
          discount: number;
        }>;
        headerDiscount: number;
        customerName: string;
        paymentDraft: {
          method: "CASH" | "CARD";
          cashReceived: number | null;
        };
        updatedAt: string;
      } | null;
      warningCode: "stale" | "invalid" | "missing_products" | null;
      skippedProductCount: number;
    }>,
  saveCartDraft: (args: { payloadJson: string }) => ipcRenderer.invoke("pos:save-cart-draft", args),
  clearCartDraft: () => ipcRenderer.invoke("pos:clear-cart-draft"),
  getLicenseStatus: () => ipcRenderer.invoke("pos:get-license-status"),
  customerDisplayOpen: () => ipcRenderer.invoke("pos:customer-display-open"),
  customerDisplayUpdate: (args: {
    state?: "ACTIVE" | "THANK_YOU";
    lines: Array<{ name: string; qty: number; lineTotal: number }>;
    total: number;
  }) =>
    ipcRenderer.invoke("pos:customer-display-update", args),
  getAppInfo: () =>
    ipcRenderer.invoke("pos:get-app-info") as Promise<{
      tenantId: string;
      branchId: string;
      deviceId: string;
      branchName: string;
      deviceName: string;
      cashierName: string;
      cashierRole: string;
      canManageCatalog: boolean;
      sync: {
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
      };
      license: {
        status: "UNKNOWN" | "ACTIVE" | "READ_ONLY" | "LOCKED" | "ERROR";
        planCode: string | null;
        expiresAt: string | null;
        graceDays: number | null;
        maxDevices: number | null;
        activeDevices: number | null;
        message: string | null;
        lastCheckedAt: string | null;
      };
      shift?: unknown;
    }>,
  ping: () => ipcRenderer.invoke("pos:ping")
};

contextBridge.exposeInMainWorld("posApi", api);

declare global {
  interface Window {
    posApi: typeof api;
  }
}
