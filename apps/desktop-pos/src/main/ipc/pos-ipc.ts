import crypto from "node:crypto";
import { ipcMain } from "electron";
import {
  createSale,
  createRefund,
  findProducts,
  getEndOfDaySummary,
  getSaleByReceiptNo,
  getXReport,
  getZReportPreview,
  getRecentSales,
  renderXReportText,
  renderZReportText,
  seedLocalProducts,
  voidSale
} from "../pos/pos-service.js";
import { printRawReceiptText, renderReceiptText } from "../printer/escpos-printer.js";
import { submitFiscalRefund, submitFiscalSale } from "../fiscal/fiscal-integration.js";
import { getSyncStatus, retryDeadLetterSync, triggerSyncNow } from "../sync/sync-worker.js";
import { clearCartDraft, getCartDraft, saveCartDraft } from "../storage/local-state-repository.js";
import {
  closeCashSession,
  getOperationalSessionSummary,
  getSessionReport,
  openCashSession,
  recordCashAdjustment
} from "../operations/operations-service.js";
import { hardwareAdapters } from "../hardware/hardware-service.js";

export interface PosContext {
  tenantId: string;
  branchId: string;
  deviceId: string;
  cashierUserId: string;
  cashierName: string;
}

export const registerPosIpc = (contextProvider: { getContext: () => PosContext }) => {
  const resolveContext = () => {
    const context = contextProvider.getContext();
    seedLocalProducts(context.tenantId);
    return context;
  };

  ipcMain.handle("pos:get-context", () => {
    const context = resolveContext();
    return {
      tenantId: context.tenantId,
      branchId: context.branchId,
      deviceId: context.deviceId
    };
  });

  ipcMain.handle("pos:list-products", (_event, args: { search?: string; barcode?: string }) =>
    findProducts(resolveContext().tenantId, args?.search, args?.barcode)
  );

  ipcMain.handle("pos:get-shift-status", () => {
    const context = resolveContext();
    return getOperationalSessionSummary(context.tenantId, context.branchId, context.deviceId);
  });

  ipcMain.handle("pos:open-shift", (_event, args: { openingCash: number }) => {
    const context = resolveContext();
    return openCashSession({
      tenantId: context.tenantId,
      branchId: context.branchId,
      deviceId: context.deviceId,
      cashierUserId: context.cashierUserId,
      cashierName: context.cashierName,
      openingCashAmount: Number(args.openingCash ?? 0)
    });
  });

  ipcMain.handle(
    "pos:record-cash-adjustment",
    (_event, args: { type: "cash_in" | "cash_out" | "correction"; amount: number; reason: string }) => {
      const context = resolveContext();
      return recordCashAdjustment({
        tenantId: context.tenantId,
        branchId: context.branchId,
        deviceId: context.deviceId,
        cashierUserId: context.cashierUserId,
        cashierName: context.cashierName,
        type: args.type,
        amount: Number(args.amount ?? 0),
        reason: args.reason
      });
    }
  );

  ipcMain.handle(
    "pos:create-sale",
    async (
      _event,
      args: {
        customerName?: string | null;
        discount: number;
        paymentMethod: "CASH" | "CARD";
        lines: Array<{ productId: string; qty: number; unitPrice: number; discount: number }>;
      }
    ) => {
      const context = resolveContext();
      const created = createSale(
        {
          tenantId: context.tenantId,
          branchId: context.branchId,
          deviceId: context.deviceId,
          cashierUserId: context.cashierUserId,
          customerName: args.customerName,
          discount: args.discount,
          paymentMethod: args.paymentMethod,
          lines: args.lines
        },
        (receiptModel) => renderReceiptText(receiptModel)
      );

      let printWarning: string | undefined;
      try {
        const printResult = await hardwareAdapters.receiptPrinter.printText(created.receiptText);
        printWarning = printResult.warning;
      } catch {
        // Printer failures must not block the sales flow.
        printWarning = "Fis yazdirilamadi. Satis kaydi tamamlandi.";
      }

      if (args.paymentMethod === "CASH") {
        try {
          const drawer = await hardwareAdapters.cashDrawer.open("cash_sale_completed");
          if (drawer.warning) {
            printWarning = drawer.warning;
          }
        } catch {
          // Cash drawer trigger must not block the sales flow.
        }
      }

      const fiscalResult = await submitFiscalSale({
        tenantId: context.tenantId,
        branchId: context.branchId,
        deviceId: context.deviceId,
        saleId: created.saleId,
        receiptNo: created.receiptNo,
        paymentMethod: args.paymentMethod,
        total: created.total,
        lines: args.lines
      });

      return {
        ...created,
        printWarning,
        fiscalStatus: fiscalResult.status,
        fiscalWarning: fiscalResult.warning,
        fiscalReferenceNo: fiscalResult.referenceNo
      };
    }
  );

  ipcMain.handle("pos:void-sale", (_event, args: { saleId: string; reason: string }) => {
    const context = resolveContext();
    voidSale(context.tenantId, context.branchId, context.deviceId, args.saleId, args.reason);
    return { ok: true };
  });

  ipcMain.handle("pos:get-sale-by-receipt", (_event, args: { receiptNo: string }) => {
    return getSaleByReceiptNo(resolveContext().tenantId, args.receiptNo);
  });

  ipcMain.handle(
    "pos:create-refund",
    async (
      _event,
        args: {
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
      }
    ) => {
      const context = resolveContext();
      const created = createRefund(
        {
          tenantId: context.tenantId,
          branchId: context.branchId,
          deviceId: context.deviceId,
          cashierUserId: context.cashierUserId,
          sourceSaleId: args.sourceSaleId,
          sourceReceiptNo: args.sourceReceiptNo,
          paymentMode: args.paymentMode,
          returnToStock: args.returnToStock,
          refundReasonCode: args.refundReasonCode,
          lines: args.lines
        },
        (receiptModel) => renderReceiptText(receiptModel)
      );

      let printWarning: string | undefined;
      try {
        const printResult = await hardwareAdapters.receiptPrinter.printText(created.receiptText);
        printWarning = printResult.warning;
      } catch {
        printWarning = "Iade fisi yazdirilamadi. Iade kaydi tamamlandi.";
      }

      const fiscalResult = await submitFiscalRefund({
        tenantId: context.tenantId,
        branchId: context.branchId,
        deviceId: context.deviceId,
        refundSaleId: created.refundSaleId,
        receiptNo: created.receiptNo,
        paymentMethod: created.paymentMethod,
        total: created.total,
        sourceSaleId: args.sourceSaleId,
        sourceReceiptNo: args.sourceReceiptNo,
        lines: args.lines
      });

      return {
        ...created,
        printWarning,
        fiscalStatus: fiscalResult.status,
        fiscalWarning: fiscalResult.warning,
        fiscalReferenceNo: fiscalResult.referenceNo
      };
    }
  );

  ipcMain.handle("pos:get-recent-sales", () => getRecentSales(resolveContext().tenantId, 50));

  ipcMain.handle("pos:get-end-of-day", (_event, args: { date: string }) =>
    getEndOfDaySummary(resolveContext().tenantId, args.date)
  );

  ipcMain.handle("pos:get-x-report", (_event, args: { date: string }) => {
    const context = resolveContext();
    const sessionReport = getSessionReport(context.tenantId, context.branchId, context.deviceId);
    if (sessionReport) {
      return {
        date: args.date,
        totalSales: sessionReport.salesTotal,
        cashSales: sessionReport.cashSales,
        cardSales: sessionReport.cardSales,
        transactionCount: sessionReport.transactionCount,
        refundTotal: sessionReport.refundTotal,
        cashRefund: sessionReport.cashRefund,
        cardRefund: sessionReport.cardRefund
      };
    }

    return getXReport(context.tenantId, args.date);
  });

  ipcMain.handle(
    "pos:print-x-report",
    async (_event, args: { date: string }) => {
      const report = getXReport(resolveContext().tenantId, args.date);
      const receiptText = renderXReportText(report);
      let printWarning: string | undefined;
      try {
        const result = await hardwareAdapters.receiptPrinter.printText(receiptText);
        printWarning = result.warning;
      } catch {
        printWarning = "X raporu yazdirilamadi.";
      }

      return {
        report,
        printWarning
      };
    }
  );

  ipcMain.handle("pos:get-z-preview", (_event, args: { date: string; openingCash: number; countedCash: number }) => {
    const context = resolveContext();
    const report = getSessionReport(context.tenantId, context.branchId, context.deviceId, args.countedCash);
    if (!report) {
      return getZReportPreview(context.tenantId, args.date, args.openingCash, args.countedCash);
    }

    return {
      date: args.date,
      openingCash: report.openingCash,
      cashSales: report.cashSales,
      cardSales: report.cardSales,
      refundTotal: report.refundTotal,
      cashRefund: report.cashRefund,
      cardRefund: report.cardRefund,
      expectedCash: report.expectedCash,
      countedCash: report.countedCash,
      difference: report.difference,
      transactionCount: report.transactionCount,
      cashAdjustmentNet: report.cashAdjustmentNet
    };
  });

  ipcMain.handle(
    "pos:close-z-report",
    async (
      _event,
      args: { date: string; openingCash: number; countedCash: number; cashierName: string }
    ) => {
      const context = resolveContext();
      const closed = closeCashSession({
        tenantId: context.tenantId,
        branchId: context.branchId,
        deviceId: context.deviceId,
        cashierUserId: context.cashierUserId,
        cashierName: args.cashierName,
        countedCash: args.countedCash
      });

      let printWarning: string | undefined;
      const preview = {
        date: args.date,
        openingCash: closed.report.openingCash,
        cashSales: closed.report.cashSales,
        cardSales: closed.report.cardSales,
        refundTotal: closed.report.refundTotal,
        cashRefund: closed.report.cashRefund,
        cardRefund: closed.report.cardRefund,
        expectedCash: closed.report.expectedCash,
        countedCash: closed.report.countedCash,
        difference: closed.report.difference,
        transactionCount: closed.report.transactionCount
      };
      const receiptText = renderZReportText(preview, args.cashierName, closed.reportId);
      try {
        const result = await hardwareAdapters.receiptPrinter.printText(receiptText);
        printWarning = result.warning;
      } catch {
        printWarning = "Z raporu yazdirilamadi.";
      }

      return {
        reportId: closed.reportId,
        preview,
        receiptText,
        printWarning
      };
    }
  );

  ipcMain.handle("pos:get-sync-status", () => getSyncStatus());
  ipcMain.handle("pos:sync-now", async () => {
    await triggerSyncNow();
    return getSyncStatus();
  });
  ipcMain.handle("pos:retry-dead-letter-sync", async () => {
    await retryDeadLetterSync();
    return getSyncStatus();
  });

  ipcMain.handle("pos:get-cart-draft", () => {
    const context = resolveContext();
    return getCartDraft(context.tenantId, context.branchId, context.deviceId);
  });

  ipcMain.handle(
    "pos:save-cart-draft",
    (_event, args: { payloadJson: string }) => {
      const context = resolveContext();
      saveCartDraft({
        tenantId: context.tenantId,
        branchId: context.branchId,
        deviceId: context.deviceId,
        cashierUserId: context.cashierUserId,
        payloadJson: args.payloadJson
      });
      return { ok: true };
    }
  );

  ipcMain.handle("pos:clear-cart-draft", () => {
    const context = resolveContext();
    clearCartDraft(context.tenantId, context.branchId, context.deviceId);
    return { ok: true };
  });

  ipcMain.handle("pos:ping", () => ({ ok: true, nonce: crypto.randomUUID() }));
};
