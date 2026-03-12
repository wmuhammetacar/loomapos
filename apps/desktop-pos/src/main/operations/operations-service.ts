import crypto from "node:crypto";
import { appendOutboxEvent } from "../sync/outbox-repository.js";
import { getDatabase } from "../storage/local-db.js";
import {
  appendLocalAuditLog,
  getAppSetting,
  getDefaultLocalBranch,
  incrementAppCounter
} from "../storage/local-state-repository.js";

const DEFAULT_STOCK_QTY = 100;
const REQUIRE_OPEN_SHIFT_KEY = "require_open_shift";

export interface ProductOperationalState {
  productId: string;
  productName: string;
  stockTracked: boolean;
  serviceItem: boolean;
  variantEnabled: boolean;
  negativeStockAllowed: boolean;
  sellWhenOutOfStock: boolean;
  qtyOnHand: number | null;
  isSnapshotStale: boolean;
}

export interface CashSessionRecord {
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

export interface CashAdjustmentRecord {
  localCashAdjustmentId: string;
  cashSessionId: string;
  type: "cash_in" | "cash_out" | "correction";
  amount: number;
  reason: string;
  createdBy: string;
  createdAt: string;
  syncStatus: string;
}

export interface SessionReportSummary {
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

export interface OpenCashSessionInput {
  tenantId: string;
  branchId: string;
  deviceId: string;
  cashierUserId: string;
  cashierName: string;
  openingCashAmount: number;
}

export interface CloseCashSessionInput {
  tenantId: string;
  branchId: string;
  deviceId: string;
  cashierUserId: string;
  cashierName: string;
  countedCash: number;
}

export interface RecordCashAdjustmentInput {
  tenantId: string;
  branchId: string;
  deviceId: string;
  cashierUserId: string;
  cashierName: string;
  type: "cash_in" | "cash_out" | "correction";
  amount: number;
  reason: string;
}

export interface StockEffectInput {
  tenantId: string;
  branchId: string;
  productId: string;
  variantId?: string | null;
  qtyDelta: number;
  reasonCode: string;
  referenceType: string;
  referenceId: string;
  createdAt: string;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

const getRequireOpenShift = () => getAppSetting(REQUIRE_OPEN_SHIFT_KEY) !== "false";

const asIsoDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const shortCode = (value: string | null | undefined, fallback: string) => {
  const normalized = (value ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  return (normalized || fallback).slice(0, 6);
};

const mapCashSessionRow = (row: Record<string, unknown> | undefined): CashSessionRecord | null => {
  if (!row) {
    return null;
  }

  return {
    cashSessionId: String(row.cashSessionId),
    tenantId: String(row.tenantId),
    branchId: String(row.branchId),
    deviceId: String(row.deviceId),
    cashierUserId: String(row.cashierUserId),
    cashierName: String(row.cashierName),
    openedAt: String(row.openedAt),
    openingCashAmount: Number(row.openingCashAmount),
    closedAt: row.closedAt ? String(row.closedAt) : null,
    closingCashExpected: row.closingCashExpected == null ? null : Number(row.closingCashExpected),
    closingCashCounted: row.closingCashCounted == null ? null : Number(row.closingCashCounted),
    discrepancyAmount: row.discrepancyAmount == null ? null : Number(row.discrepancyAmount),
    status: String(row.status).toUpperCase() === "CLOSED" ? "CLOSED" : "OPEN",
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt)
  };
};

const getCashSessionWindow = (session: CashSessionRecord) => ({
  startedAt: session.openedAt,
  endedAt: session.closedAt ?? new Date().toISOString()
});

const calculateCashAdjustmentNet = (rows: Array<{ type: string; amount: number }>) =>
  round2(
    rows.reduce((sum, row) => {
      if (row.type === "cash_out") {
        return sum - Number(row.amount);
      }
      return sum + Number(row.amount);
    }, 0)
  );

export const getActiveCashSession = (
  tenantId: string,
  branchId: string,
  deviceId: string
): CashSessionRecord | null => {
  const db = getDatabase();
  const row = db
    .prepare(`
      SELECT
        cash_session_id AS cashSessionId,
        tenant_id AS tenantId,
        branch_id AS branchId,
        device_id AS deviceId,
        cashier_user_id AS cashierUserId,
        cashier_name AS cashierName,
        opened_at AS openedAt,
        opening_cash_amount AS openingCashAmount,
        closed_at AS closedAt,
        closing_cash_expected AS closingCashExpected,
        closing_cash_counted AS closingCashCounted,
        discrepancy_amount AS discrepancyAmount,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM local_cash_sessions
      WHERE tenant_id = @tenantId
        AND branch_id = @branchId
        AND device_id = @deviceId
        AND status = 'OPEN'
      ORDER BY opened_at DESC
      LIMIT 1
    `)
    .get({ tenantId, branchId, deviceId }) as Record<string, unknown> | undefined;

  return mapCashSessionRow(row);
};

export const getLatestCashSession = (
  tenantId: string,
  branchId: string,
  deviceId: string
): CashSessionRecord | null => {
  const db = getDatabase();
  const row = db
    .prepare(`
      SELECT
        cash_session_id AS cashSessionId,
        tenant_id AS tenantId,
        branch_id AS branchId,
        device_id AS deviceId,
        cashier_user_id AS cashierUserId,
        cashier_name AS cashierName,
        opened_at AS openedAt,
        opening_cash_amount AS openingCashAmount,
        closed_at AS closedAt,
        closing_cash_expected AS closingCashExpected,
        closing_cash_counted AS closingCashCounted,
        discrepancy_amount AS discrepancyAmount,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM local_cash_sessions
      WHERE tenant_id = @tenantId
        AND branch_id = @branchId
        AND device_id = @deviceId
      ORDER BY opened_at DESC
      LIMIT 1
    `)
    .get({ tenantId, branchId, deviceId }) as Record<string, unknown> | undefined;

  return mapCashSessionRow(row);
};

export const openCashSession = (input: OpenCashSessionInput): CashSessionRecord => {
  const existing = getActiveCashSession(input.tenantId, input.branchId, input.deviceId);
  if (existing) {
    throw new Error("Acik kasa oturumu zaten var.");
  }

  const db = getDatabase();
  const now = new Date().toISOString();
  const record: CashSessionRecord = {
    cashSessionId: crypto.randomUUID(),
    tenantId: input.tenantId,
    branchId: input.branchId,
    deviceId: input.deviceId,
    cashierUserId: input.cashierUserId,
    cashierName: input.cashierName,
    openedAt: now,
    openingCashAmount: round2(Math.max(0, input.openingCashAmount)),
    closedAt: null,
    closingCashExpected: null,
    closingCashCounted: null,
    discrepancyAmount: null,
    status: "OPEN",
    createdAt: now,
    updatedAt: now
  };

  db.prepare(`
    INSERT INTO local_cash_sessions(
      cash_session_id,
      tenant_id,
      branch_id,
      device_id,
      cashier_user_id,
      cashier_name,
      opened_at,
      opening_cash_amount,
      closed_at,
      closing_cash_expected,
      closing_cash_counted,
      discrepancy_amount,
      status,
      last_report_json,
      created_at,
      updated_at
    )
    VALUES(
      @cashSessionId,
      @tenantId,
      @branchId,
      @deviceId,
      @cashierUserId,
      @cashierName,
      @openedAt,
      @openingCashAmount,
      NULL,
      NULL,
      NULL,
      NULL,
      @status,
      NULL,
      @createdAt,
      @updatedAt
    )
  `).run(record);

  appendOutboxEvent({
    tenantId: input.tenantId,
    branchId: input.branchId,
    deviceId: input.deviceId,
    eventType: "CASH_SESSION_OPENED",
    aggregateType: "cash_session",
    aggregateId: record.cashSessionId,
    payload: {
      cashSessionId: record.cashSessionId,
      cashierUserId: input.cashierUserId,
      cashierName: input.cashierName,
      openedAt: record.openedAt,
      openingCashAmount: record.openingCashAmount
    }
  });

  appendLocalAuditLog({
    tenantId: input.tenantId,
    branchId: input.branchId,
    deviceId: input.deviceId,
    actorUserId: input.cashierUserId,
    actorEmail: input.cashierUserId,
    actorName: input.cashierName,
    eventType: "cash_session_opened",
    message: "Kasa oturumu acildi.",
    entityType: "cash_session",
    entityId: record.cashSessionId,
    metadata: {
      openingCashAmount: record.openingCashAmount
    }
  });

  return record;
};

export const getSessionReport = (
  tenantId: string,
  branchId: string,
  deviceId: string,
  countedCash?: number
): SessionReportSummary | null => {
  const session = getActiveCashSession(tenantId, branchId, deviceId) ?? getLatestCashSession(tenantId, branchId, deviceId);
  if (!session) {
    return null;
  }

  const db = getDatabase();
  const window = getCashSessionWindow(session);
  const salesSummary = db
    .prepare(`
      SELECT
        IFNULL(SUM(CASE WHEN status = 'COMPLETED' THEN grand_total ELSE 0 END), 0) AS salesTotal,
        IFNULL(SUM(CASE WHEN status = 'REFUNDED' THEN grand_total ELSE 0 END), 0) AS refundTotal,
        IFNULL(SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS transactionCount
      FROM local_sales
      WHERE tenant_id = @tenantId
        AND branch_id = @branchId
        AND device_id = @deviceId
        AND cash_session_id = @cashSessionId
        AND created_at >= @startedAt
        AND created_at <= @endedAt
    `)
    .get({
      tenantId,
      branchId,
      deviceId,
      cashSessionId: session.cashSessionId,
      startedAt: window.startedAt,
      endedAt: window.endedAt
    }) as { salesTotal: number; refundTotal: number; transactionCount: number };

  const paymentSummary = db
    .prepare(`
      SELECT
        IFNULL(SUM(CASE WHEN s.status = 'COMPLETED' AND p.method = 'CASH' THEN p.amount ELSE 0 END), 0) AS cashSales,
        IFNULL(SUM(CASE WHEN s.status = 'COMPLETED' AND p.method = 'CARD' THEN p.amount ELSE 0 END), 0) AS cardSales,
        IFNULL(SUM(CASE WHEN s.status = 'REFUNDED' AND p.method = 'CASH' THEN p.amount ELSE 0 END), 0) AS cashRefund,
        IFNULL(SUM(CASE WHEN s.status = 'REFUNDED' AND p.method = 'CARD' THEN p.amount ELSE 0 END), 0) AS cardRefund
      FROM local_payments p
      INNER JOIN local_sales s ON s.local_sale_id = p.local_sale_id
      WHERE s.tenant_id = @tenantId
        AND s.branch_id = @branchId
        AND s.device_id = @deviceId
        AND s.cash_session_id = @cashSessionId
        AND s.created_at >= @startedAt
        AND s.created_at <= @endedAt
    `)
    .get({
      tenantId,
      branchId,
      deviceId,
      cashSessionId: session.cashSessionId,
      startedAt: window.startedAt,
      endedAt: window.endedAt
    }) as { cashSales: number; cardSales: number; cashRefund: number; cardRefund: number };

  const adjustments = db
    .prepare(`
      SELECT type, amount
      FROM local_cash_adjustments
      WHERE cash_session_id = @cashSessionId
      ORDER BY created_at ASC
    `)
    .all({ cashSessionId: session.cashSessionId }) as Array<{ type: string; amount: number }>;

  const cashAdjustmentNet = calculateCashAdjustmentNet(adjustments);
  const expectedCash = round2(session.openingCashAmount + paymentSummary.cashSales - paymentSummary.cashRefund + cashAdjustmentNet);
  const normalizedCountedCash =
    countedCash != null
      ? round2(Math.max(0, countedCash))
      : round2(session.closingCashCounted ?? expectedCash);

  return {
    cashSessionId: session.cashSessionId,
    openedAt: session.openedAt,
    openingCash: round2(session.openingCashAmount),
    salesTotal: round2(salesSummary.salesTotal),
    cashSales: round2(paymentSummary.cashSales),
    cardSales: round2(paymentSummary.cardSales),
    refundTotal: round2(salesSummary.refundTotal),
    cashRefund: round2(paymentSummary.cashRefund),
    cardRefund: round2(paymentSummary.cardRefund),
    cashAdjustmentNet,
    expectedCash,
    countedCash: normalizedCountedCash,
    difference: round2(normalizedCountedCash - expectedCash),
    transactionCount: Number(salesSummary.transactionCount ?? 0)
  };
};

export const closeCashSession = (input: CloseCashSessionInput) => {
  const session = getActiveCashSession(input.tenantId, input.branchId, input.deviceId);
  if (!session) {
    throw new Error("Kapatilacak acik kasa oturumu bulunamadi.");
  }

  const report = getSessionReport(input.tenantId, input.branchId, input.deviceId, input.countedCash);
  if (!report) {
    throw new Error("Kasa raporu olusturulamadi.");
  }

  const db = getDatabase();
  const now = new Date().toISOString();
  const reportId = crypto.randomUUID();
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE local_cash_sessions
      SET
        closed_at = @closedAt,
        closing_cash_expected = @closingCashExpected,
        closing_cash_counted = @closingCashCounted,
        discrepancy_amount = @discrepancyAmount,
        status = 'CLOSED',
        last_report_json = @lastReportJson,
        updated_at = @updatedAt
      WHERE cash_session_id = @cashSessionId
    `).run({
      cashSessionId: session.cashSessionId,
      closedAt: now,
      closingCashExpected: report.expectedCash,
      closingCashCounted: report.countedCash,
      discrepancyAmount: report.difference,
      lastReportJson: JSON.stringify(report),
      updatedAt: now
    });

    db.prepare(`
      INSERT INTO z_reports(
        id,
        tenant_id,
        branch_id,
        device_id,
        cashier_name,
        report_date,
        opening_cash,
        cash_sales,
        card_sales,
        refund_total,
        cash_refund,
        card_refund,
        expected_cash,
        counted_cash,
        difference,
        created_at
      )
      VALUES(
        @id,
        @tenantId,
        @branchId,
        @deviceId,
        @cashierName,
        @reportDate,
        @openingCash,
        @cashSales,
        @cardSales,
        @refundTotal,
        @cashRefund,
        @cardRefund,
        @expectedCash,
        @countedCash,
        @difference,
        @createdAt
      )
    `).run({
      id: reportId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      deviceId: input.deviceId,
      cashierName: input.cashierName,
      reportDate: new Date().toISOString().slice(0, 10),
      openingCash: report.openingCash,
      cashSales: report.cashSales,
      cardSales: report.cardSales,
      refundTotal: report.refundTotal,
      cashRefund: report.cashRefund,
      cardRefund: report.cardRefund,
      expectedCash: report.expectedCash,
      countedCash: report.countedCash,
      difference: report.difference,
      createdAt: now
    });
  });
  tx();

  appendOutboxEvent({
    tenantId: input.tenantId,
    branchId: input.branchId,
    deviceId: input.deviceId,
    eventType: "CASH_SESSION_CLOSED",
    aggregateType: "cash_session",
    aggregateId: session.cashSessionId,
    payload: {
      cashSessionId: session.cashSessionId,
      closedAt: now,
      expectedCash: report.expectedCash,
      countedCash: report.countedCash,
      discrepancyAmount: report.difference,
      reportId
    }
  });

  appendLocalAuditLog({
    tenantId: input.tenantId,
    branchId: input.branchId,
    deviceId: input.deviceId,
    actorUserId: input.cashierUserId,
    actorEmail: input.cashierUserId,
    actorName: input.cashierName,
    eventType: "cash_session_closed",
    message: "Kasa oturumu kapatildi.",
    entityType: "cash_session",
    entityId: session.cashSessionId,
    metadata: {
      reportId,
      discrepancyAmount: report.difference
    }
  });

  return {
    sessionId: session.cashSessionId,
    reportId,
    closedAt: now,
    report
  };
};

export const recordCashAdjustment = (input: RecordCashAdjustmentInput): CashAdjustmentRecord => {
  const session = getActiveCashSession(input.tenantId, input.branchId, input.deviceId);
  if (!session) {
    throw new Error("Kasa hareketi icin once oturum acin.");
  }

  const normalizedAmount = round2(Math.max(0, input.amount));
  if (normalizedAmount <= 0) {
    throw new Error("Kasa hareketi tutari sifirdan buyuk olmali.");
  }

  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("Kasa hareketi nedeni zorunlu.");
  }

  const record: CashAdjustmentRecord = {
    localCashAdjustmentId: crypto.randomUUID(),
    cashSessionId: session.cashSessionId,
    type: input.type,
    amount: normalizedAmount,
    reason,
    createdBy: input.cashierUserId,
    createdAt: new Date().toISOString(),
    syncStatus: "PENDING"
  };

  const db = getDatabase();
  db.prepare(`
    INSERT INTO local_cash_adjustments(
      local_cash_adjustment_id,
      tenant_id,
      branch_id,
      device_id,
      cash_session_id,
      type,
      amount,
      reason,
      created_by,
      sync_status,
      created_at
    )
    VALUES(
      @localCashAdjustmentId,
      @tenantId,
      @branchId,
      @deviceId,
      @cashSessionId,
      @type,
      @amount,
      @reason,
      @createdBy,
      @syncStatus,
      @createdAt
    )
  `).run({
    ...record,
    tenantId: input.tenantId,
    branchId: input.branchId,
    deviceId: input.deviceId
  });

  db.prepare(`
    INSERT INTO cash_transactions(id, tenant_id, branch_id, type, amount, reason, created_at)
    VALUES(@id, @tenantId, @branchId, @type, @amount, @reason, @createdAt)
  `).run({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    branchId: input.branchId,
    type: input.type === "cash_out" ? "Out" : "In",
    amount: normalizedAmount,
    reason,
    createdAt: record.createdAt
  });

  appendOutboxEvent({
    tenantId: input.tenantId,
    branchId: input.branchId,
    deviceId: input.deviceId,
    eventType: "CASH_ADJUSTMENT_RECORDED",
    aggregateType: "cash_session",
    aggregateId: session.cashSessionId,
    payload: {
      localCashAdjustmentId: record.localCashAdjustmentId,
      cashSessionId: session.cashSessionId,
      type: record.type,
      amount: record.amount,
      reason: record.reason,
      createdBy: record.createdBy,
      createdAt: record.createdAt
    }
  });

  appendLocalAuditLog({
    tenantId: input.tenantId,
    branchId: input.branchId,
    deviceId: input.deviceId,
    actorUserId: input.cashierUserId,
    actorEmail: input.cashierUserId,
    actorName: input.cashierName,
    eventType: "cash_adjustment_recorded",
    message: "Kasa hareketi kaydedildi.",
    entityType: "cash_adjustment",
    entityId: record.localCashAdjustmentId,
    metadata: {
      type: record.type,
      amount: record.amount,
      reason: record.reason
    }
  });

  return record;
};

export const getNextReceiptNumber = (
  kind: "sale" | "refund",
  branchId: string,
  deviceId: string,
  cashSessionId?: string | null
) => {
  const branch = getDefaultLocalBranch();
  const dateKey = asIsoDate();
  const branchCode = shortCode(branch?.branchCode ?? branchId, "BR");
  const deviceCode = shortCode(deviceId, "DV");
  const sessionCode = shortCode(cashSessionId, "GEN");
  const counterKey = `receipt_counter:${kind}:${branchCode}:${deviceCode}:${sessionCode}:${dateKey}`;
  const counter = incrementAppCounter(counterKey, 1);
  const prefix = kind === "refund" ? "RFD" : "SAT";
  return `${prefix}-${branchCode}-${deviceCode}-${dateKey}-${sessionCode}-${String(counter).padStart(6, "0")}`;
};

export const getProductOperationalStates = (
  tenantId: string,
  branchId: string,
  productIds: string[]
): Map<string, ProductOperationalState> => {
  const uniqueIds = Array.from(new Set(productIds)).filter(Boolean);
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const db = getDatabase();
  const placeholders = uniqueIds.map(() => "?").join(",");
  const rows = db
    .prepare(`
      SELECT
        p.id AS productId,
        p.name AS productName,
        p.stock_tracked AS stockTracked,
        p.service_item AS serviceItem,
        p.variant_enabled AS variantEnabled,
        p.negative_stock_allowed AS negativeStockAllowed,
        p.sell_when_out_of_stock AS sellWhenOutOfStock,
        s.qty_on_hand AS qtyOnHand,
        s.stale_at AS staleAt
      FROM local_products p
      LEFT JOIN local_stock_snapshot s
        ON s.tenant_id = p.tenant_id
       AND s.branch_id = ?
       AND s.product_id = p.id
       AND s.variant_id IS NULL
      WHERE p.tenant_id = ?
        AND p.id IN (${placeholders})
    `)
    .all(branchId, tenantId, ...uniqueIds) as Array<{
    productId: string;
    productName: string;
    stockTracked: number;
    serviceItem: number;
    variantEnabled: number;
    negativeStockAllowed: number;
    sellWhenOutOfStock: number;
    qtyOnHand: number | null;
    staleAt: string | null;
  }>;

  const states = new Map<string, ProductOperationalState>();
  for (const row of rows) {
    states.set(row.productId, {
      productId: row.productId,
      productName: row.productName,
      stockTracked: Boolean(row.stockTracked),
      serviceItem: Boolean(row.serviceItem),
      variantEnabled: Boolean(row.variantEnabled),
      negativeStockAllowed: Boolean(row.negativeStockAllowed),
      sellWhenOutOfStock: Boolean(row.sellWhenOutOfStock),
      qtyOnHand: row.qtyOnHand == null ? null : Number(row.qtyOnHand),
      isSnapshotStale: row.staleAt ? new Date(row.staleAt).getTime() < Date.now() : false
    });
  }

  for (const productId of uniqueIds) {
    if (!states.has(productId)) {
      continue;
    }

    ensureStockSnapshotRow(tenantId, branchId, productId, states.get(productId)?.qtyOnHand ?? DEFAULT_STOCK_QTY);
  }

  return states;
};

export const assertStockAvailabilityForSale = (
  tenantId: string,
  branchId: string,
  lines: Array<{ productId: string; qty: number }>
) => {
  const states = getProductOperationalStates(
    tenantId,
    branchId,
    lines.map((line) => line.productId)
  );

  for (const line of lines) {
    const state = states.get(line.productId);
    if (!state || state.serviceItem || !state.stockTracked) {
      continue;
    }

    if (state.qtyOnHand == null) {
      continue;
    }

    if (state.negativeStockAllowed || state.sellWhenOutOfStock) {
      continue;
    }

    if (state.qtyOnHand - line.qty < 0) {
      throw new Error(`${state.productName} icin stok yetersiz.`);
    }
  }

  return states;
};

export const applyStockLedgerEffect = (input: StockEffectInput) => {
  const db = getDatabase();
  const state = getProductOperationalStates(input.tenantId, input.branchId, [input.productId]).get(input.productId);
  if (!state || state.serviceItem || !state.stockTracked) {
    return;
  }

  ensureStockSnapshotRow(
    input.tenantId,
    input.branchId,
    input.productId,
    state.qtyOnHand ?? DEFAULT_STOCK_QTY
  );

  db.prepare(`
    INSERT INTO local_stock_moves(
      local_stock_move_id,
      tenant_id,
      branch_id,
      product_id,
      variant_id,
      qty_delta,
      reason_code,
      reference_type,
      reference_id,
      sync_status,
      created_at
    )
    VALUES(
      @localStockMoveId,
      @tenantId,
      @branchId,
      @productId,
      @variantId,
      @qtyDelta,
      @reasonCode,
      @referenceType,
      @referenceId,
      'PENDING',
      @createdAt
    )
  `).run({
    localStockMoveId: crypto.randomUUID(),
    tenantId: input.tenantId,
    branchId: input.branchId,
    productId: input.productId,
    variantId: input.variantId ?? null,
    qtyDelta: round2(input.qtyDelta),
    reasonCode: input.reasonCode,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    createdAt: input.createdAt
  });

  db.prepare(`
    INSERT INTO stock_moves(
      id,
      tenant_id,
      branch_id,
      product_id,
      qty_delta,
      reason,
      ref_type,
      ref_id,
      created_at
    )
    VALUES(
      @id,
      @tenantId,
      @branchId,
      @productId,
      @qtyDelta,
      @reason,
      @refType,
      @refId,
      @createdAt
    )
  `).run({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    branchId: input.branchId,
    productId: input.productId,
    qtyDelta: round2(input.qtyDelta),
    reason: input.reasonCode,
    refType: input.referenceType,
    refId: input.referenceId,
    createdAt: input.createdAt
  });

  db.prepare(`
    UPDATE local_stock_snapshot
    SET
      qty_on_hand = qty_on_hand + @qtyDelta,
      last_calculated_at = @updatedAt,
      stale_at = @staleAt
    WHERE tenant_id = @tenantId
      AND branch_id = @branchId
      AND product_id = @productId
      AND variant_id IS NULL
  `).run({
    tenantId: input.tenantId,
    branchId: input.branchId,
    productId: input.productId,
    qtyDelta: round2(input.qtyDelta),
    updatedAt: input.createdAt,
    staleAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  });
};

export const recordStockAdjustment = (input: StockEffectInput & { deviceId: string; cashierUserId: string; cashierName: string }) => {
  applyStockLedgerEffect(input);
  appendOutboxEvent({
    tenantId: input.tenantId,
    branchId: input.branchId,
    deviceId: input.deviceId,
    eventType: "STOCK_ADJUSTMENT_RECORDED",
    aggregateType: "stock_move",
    aggregateId: input.referenceId,
    payload: {
      productId: input.productId,
      variantId: input.variantId ?? null,
      qtyDelta: input.qtyDelta,
      reasonCode: input.reasonCode,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      createdAt: input.createdAt
    }
  });

  appendLocalAuditLog({
    tenantId: input.tenantId,
    branchId: input.branchId,
    actorUserId: input.cashierUserId,
    actorEmail: input.cashierUserId,
    actorName: input.cashierName,
    eventType: "stock_adjustment_recorded",
    message: "Manuel stok hareketi kaydedildi.",
    entityType: "stock_move",
    entityId: input.referenceId
  });
};

export const getOperationalSessionSummary = (
  tenantId: string,
  branchId: string,
  deviceId: string
) => {
  const activeSession = getActiveCashSession(tenantId, branchId, deviceId);
  const latestSession = activeSession ?? getLatestCashSession(tenantId, branchId, deviceId);
  const report = latestSession ? getSessionReport(tenantId, branchId, deviceId) : null;
  return {
    activeSession,
    latestSession,
    report,
    requireOpenShift: getRequireOpenShift()
  };
};

export const requireSaleShift = (
  tenantId: string,
  branchId: string,
  deviceId: string
): CashSessionRecord | null => {
  const session = getActiveCashSession(tenantId, branchId, deviceId);
  if (!getRequireOpenShift()) {
    return session;
  }

  if (!session) {
    throw new Error("Satis icin once kasa vardiyasi acilmali.");
  }

  return session;
};

const ensureStockSnapshotRow = (
  tenantId: string,
  branchId: string,
  productId: string,
  initialQty: number
) => {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO local_stock_snapshot(
      snapshot_id,
      tenant_id,
      branch_id,
      product_id,
      variant_id,
      qty_on_hand,
      source_sync_at,
      last_calculated_at,
      stale_at
    )
    VALUES(
      @snapshotId,
      @tenantId,
      @branchId,
      @productId,
      NULL,
      @qtyOnHand,
      NULL,
      @lastCalculatedAt,
      @staleAt
    )
    ON CONFLICT(branch_id, product_id, variant_id) DO NOTHING
  `).run({
    snapshotId: crypto.randomUUID(),
    tenantId,
    branchId,
    productId,
    qtyOnHand: round2(initialQty),
    lastCalculatedAt: new Date().toISOString(),
    staleAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  });
};
