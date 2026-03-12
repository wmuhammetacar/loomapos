import {
  createFiscalJob,
  FiscalOperationType,
  getFiscalSummary,
  getPendingFiscalJobs,
  markFiscalJobAsFailed,
  markFiscalJobAsSent
} from "./fiscal-job-repository.js";

const BASE_RETRY_DELAY_MS = 2000;
const MAX_RETRY_DELAY_MS = 60000;
const DEFAULT_TIMEOUT_MS = 10000;

export type FiscalMode = "OFF" | "BEST_EFFORT" | "STRICT";
export type FiscalDispatchStatus = "SKIPPED" | "SENT" | "QUEUED";

export interface FiscalDispatchResult {
  status: FiscalDispatchStatus;
  warning?: string;
  referenceNo?: string;
}

export interface SubmitFiscalSaleInput {
  tenantId: string;
  branchId: string;
  deviceId: string;
  saleId: string;
  receiptNo: string;
  paymentMethod: "CASH" | "CARD";
  total: number;
  lines: Array<{
    productId: string;
    qty: number;
    unitPrice: number;
    discount: number;
  }>;
}

export interface SubmitFiscalRefundInput {
  tenantId: string;
  branchId: string;
  deviceId: string;
  refundSaleId: string;
  receiptNo: string;
  paymentMethod: "CASH" | "CARD";
  total: number;
  sourceSaleId?: string | null;
  sourceReceiptNo?: string | null;
  lines: Array<{
    sourceLineId?: string | null;
    productId: string;
    qty: number;
    unitPrice?: number;
    discount?: number;
    taxRate?: number;
  }>;
}

interface FiscalApiPayload {
  tenantId: string;
  branchId: string;
  deviceId: string;
  operationType: FiscalOperationType;
  saleId: string;
  receiptNo: string;
  payload: unknown;
}

const getFiscalMode = (): FiscalMode => {
  const rawMode = (process.env.LOOMAPOS_FISCAL_MODE ?? "").trim().toUpperCase();
  if (rawMode === "OFF" || rawMode === "BEST_EFFORT" || rawMode === "STRICT") {
    return rawMode;
  }

  return process.env.LOOMAPOS_FISCAL_API_URL ? "BEST_EFFORT" : "OFF";
};

const getFiscalApiUrl = () => process.env.LOOMAPOS_FISCAL_API_URL?.trim() ?? "";
const getFiscalApiKey = () => process.env.LOOMAPOS_FISCAL_API_KEY?.trim() ?? "";
const getTimeoutMs = () => {
  const parsed = Number(process.env.LOOMAPOS_FISCAL_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
};

const getRetryDelayMs = (retryCount: number) =>
  Math.min(BASE_RETRY_DELAY_MS * 2 ** Math.max(0, retryCount - 1), MAX_RETRY_DELAY_MS);

const shouldRetryNow = (lastTryAt: string | null, retryCount: number): boolean => {
  if (!lastTryAt) {
    return true;
  }

  const lastTry = new Date(lastTryAt).getTime();
  if (!Number.isFinite(lastTry)) {
    return true;
  }

  const retryDelay = getRetryDelayMs(retryCount);
  return Date.now() - lastTry >= retryDelay;
};

const sendToFiscalApi = async (payload: FiscalApiPayload): Promise<string | null> => {
  const url = getFiscalApiUrl();
  if (!url) {
    throw new Error("Fiscal API endpoint tanimli degil.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Tenant-Id": payload.tenantId,
      "X-Branch-Id": payload.branchId,
      "X-Device-Id": payload.deviceId
    };

    const apiKey = getFiscalApiKey();
    if (apiKey) {
      headers["X-Fiscal-Api-Key"] = apiKey;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = (await response.text()).slice(0, 180);
      throw new Error(`Fiscal API ${response.status}: ${errorText || "Bilinmeyen hata"}`);
    }

    const responseJson = (await response.json().catch(() => null)) as
      | {
          referenceNo?: string;
          fiscalReferenceNo?: string;
        }
      | null;

    if (typeof responseJson?.referenceNo === "string" && responseJson.referenceNo.trim().length > 0) {
      return responseJson.referenceNo.trim();
    }
    if (
      typeof responseJson?.fiscalReferenceNo === "string" &&
      responseJson.fiscalReferenceNo.trim().length > 0
    ) {
      return responseJson.fiscalReferenceNo.trim();
    }

    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const queueAndDispatch = async (input: {
  tenantId: string;
  branchId: string;
  deviceId: string;
  saleId: string;
  receiptNo: string;
  operationType: FiscalOperationType;
  payload: unknown;
}): Promise<FiscalDispatchResult> => {
  const mode = getFiscalMode();
  if (mode === "OFF") {
    return { status: "SKIPPED" };
  }

  const payloadJson = JSON.stringify(input.payload);
  const job = createFiscalJob({
    tenantId: input.tenantId,
    branchId: input.branchId,
    deviceId: input.deviceId,
    saleId: input.saleId,
    receiptNo: input.receiptNo,
    operationType: input.operationType,
    payloadJson
  });

  try {
    const referenceNo = await sendToFiscalApi({
      tenantId: input.tenantId,
      branchId: input.branchId,
      deviceId: input.deviceId,
      operationType: input.operationType,
      saleId: input.saleId,
      receiptNo: input.receiptNo,
      payload: input.payload
    });

    markFiscalJobAsSent(job.id, referenceNo);
    return {
      status: "SENT",
      referenceNo: referenceNo ?? undefined
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fiscal gonderim hatasi.";
    markFiscalJobAsFailed(job.id, message);

    if (mode === "STRICT") {
      return {
        status: "QUEUED",
        warning: `Mali cihaza anlik gonderim basarisiz, islem kuyruga alindi (STRICT): ${message}`
      };
    }

    return {
      status: "QUEUED",
      warning: `Mali cihaza gonderim basarisiz, arka planda tekrar denenecek: ${message}`
    };
  }
};

export const submitFiscalSale = async (input: SubmitFiscalSaleInput): Promise<FiscalDispatchResult> => {
  return queueAndDispatch({
    tenantId: input.tenantId,
    branchId: input.branchId,
    deviceId: input.deviceId,
    saleId: input.saleId,
    receiptNo: input.receiptNo,
    operationType: "SALE",
    payload: {
      saleId: input.saleId,
      receiptNo: input.receiptNo,
      paymentMethod: input.paymentMethod,
      total: input.total,
      lines: input.lines
    }
  });
};

export const submitFiscalRefund = async (input: SubmitFiscalRefundInput): Promise<FiscalDispatchResult> => {
  return queueAndDispatch({
    tenantId: input.tenantId,
    branchId: input.branchId,
    deviceId: input.deviceId,
    saleId: input.refundSaleId,
    receiptNo: input.receiptNo,
    operationType: "REFUND",
    payload: {
      refundSaleId: input.refundSaleId,
      sourceSaleId: input.sourceSaleId ?? null,
      sourceReceiptNo: input.sourceReceiptNo ?? null,
      receiptNo: input.receiptNo,
      paymentMethod: input.paymentMethod,
      total: input.total,
      lines: input.lines
    }
  });
};

export const processPendingFiscalJobs = async (): Promise<void> => {
  const mode = getFiscalMode();
  if (mode === "OFF") {
    return;
  }

  const url = getFiscalApiUrl();
  if (!url) {
    return;
  }

  const jobs = getPendingFiscalJobs();
  for (const job of jobs) {
    if (!shouldRetryNow(job.lastTryAt, job.retryCount)) {
      continue;
    }

    try {
      const payload = JSON.parse(job.payloadJson);
      const referenceNo = await sendToFiscalApi({
        tenantId: job.tenantId,
        branchId: job.branchId,
        deviceId: job.deviceId,
        operationType: job.operationType,
        saleId: job.saleId,
        receiptNo: job.receiptNo,
        payload
      });
      markFiscalJobAsSent(job.id, referenceNo);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fiscal gonderim hatasi.";
      markFiscalJobAsFailed(job.id, message);
    }
  }
};

export const getFiscalSyncSummary = () => {
  if (getFiscalMode() === "OFF") {
    return {
      pending: 0,
      failed: 0,
      sent: 0,
      lastError: null,
      lastTryAt: null
    };
  }

  return getFiscalSummary();
};

export { getFiscalSummary };
