import crypto from "node:crypto";
import { getDatabase } from "../storage/local-db.js";

export type FiscalJobStatus = "PENDING" | "SENT" | "FAILED";
export type FiscalOperationType = "SALE" | "REFUND";

export interface FiscalJob {
  id: string;
  tenantId: string;
  branchId: string;
  deviceId: string;
  saleId: string;
  receiptNo: string;
  operationType: FiscalOperationType;
  payloadJson: string;
  status: FiscalJobStatus;
  createdAt: string;
  lastTryAt: string | null;
  retryCount: number;
  lastError: string | null;
  fiscalReference: string | null;
}

export interface FiscalJobSummary {
  pending: number;
  failed: number;
  sent: number;
  lastError: string | null;
  lastTryAt: string | null;
}

export interface CreateFiscalJobInput {
  tenantId: string;
  branchId: string;
  deviceId: string;
  saleId: string;
  receiptNo: string;
  operationType: FiscalOperationType;
  payloadJson: string;
}

export const createFiscalJob = (input: CreateFiscalJobInput): FiscalJob => {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  db.prepare(
    `
      INSERT INTO fiscal_jobs(
        id, tenant_id, branch_id, device_id, sale_id, receipt_no,
        operation_type, payload_json, status, created_at, retry_count, last_error, fiscal_reference
      )
      VALUES (
        @id, @tenantId, @branchId, @deviceId, @saleId, @receiptNo,
        @operationType, @payloadJson, 'PENDING', @createdAt, 0, NULL, NULL
      )
    `
  ).run({
    id,
    tenantId: input.tenantId,
    branchId: input.branchId,
    deviceId: input.deviceId,
    saleId: input.saleId,
    receiptNo: input.receiptNo,
    operationType: input.operationType,
    payloadJson: input.payloadJson,
    createdAt: now
  });

  return {
    id,
    tenantId: input.tenantId,
    branchId: input.branchId,
    deviceId: input.deviceId,
    saleId: input.saleId,
    receiptNo: input.receiptNo,
    operationType: input.operationType,
    payloadJson: input.payloadJson,
    status: "PENDING",
    createdAt: now,
    lastTryAt: null,
    retryCount: 0,
    lastError: null,
    fiscalReference: null
  };
};

export const getPendingFiscalJobs = (limit = 25): FiscalJob[] => {
  const db = getDatabase();
  return db
    .prepare(
      `
        SELECT
          id,
          tenant_id AS tenantId,
          branch_id AS branchId,
          device_id AS deviceId,
          sale_id AS saleId,
          receipt_no AS receiptNo,
          operation_type AS operationType,
          payload_json AS payloadJson,
          status,
          created_at AS createdAt,
          last_try_at AS lastTryAt,
          retry_count AS retryCount,
          last_error AS lastError,
          fiscal_reference AS fiscalReference
        FROM fiscal_jobs
        WHERE status IN ('PENDING', 'FAILED')
        ORDER BY created_at ASC
        LIMIT @limit
      `
    )
    .all({ limit }) as FiscalJob[];
};

export const markFiscalJobAsSent = (id: string, fiscalReference?: string | null) => {
  const db = getDatabase();
  db.prepare(
    `
      UPDATE fiscal_jobs
      SET
        status = 'SENT',
        last_try_at = @lastTryAt,
        last_error = NULL,
        fiscal_reference = @fiscalReference
      WHERE id = @id
    `
  ).run({
    id,
    lastTryAt: new Date().toISOString(),
    fiscalReference: fiscalReference ?? null
  });
};

export const markFiscalJobAsFailed = (id: string, error: string) => {
  const db = getDatabase();
  db.prepare(
    `
      UPDATE fiscal_jobs
      SET
        status = 'FAILED',
        retry_count = retry_count + 1,
        last_try_at = @lastTryAt,
        last_error = @lastError
      WHERE id = @id
    `
  ).run({
    id,
    lastTryAt: new Date().toISOString(),
    lastError: error.slice(0, 500)
  });
};

export const getFiscalSummary = (): FiscalJobSummary => {
  const db = getDatabase();

  const rows = db
    .prepare(
      `
        SELECT status, COUNT(1) AS count
        FROM fiscal_jobs
        GROUP BY status
      `
    )
    .all() as Array<{ status: FiscalJobStatus; count: number }>;

  let pending = 0;
  let failed = 0;
  let sent = 0;

  for (const row of rows) {
    if (row.status === "PENDING") {
      pending = row.count;
      continue;
    }
    if (row.status === "FAILED") {
      failed = row.count;
      continue;
    }
    if (row.status === "SENT") {
      sent = row.count;
    }
  }

  const lastAttempt = db
    .prepare(
      `
        SELECT
          last_error AS lastError,
          last_try_at AS lastTryAt
        FROM fiscal_jobs
        WHERE last_try_at IS NOT NULL
        ORDER BY last_try_at DESC
        LIMIT 1
      `
    )
    .get() as { lastError: string | null; lastTryAt: string | null } | undefined;

  return {
    pending,
    failed,
    sent,
    lastError: lastAttempt?.lastError ?? null,
    lastTryAt: lastAttempt?.lastTryAt ?? null
  };
};
