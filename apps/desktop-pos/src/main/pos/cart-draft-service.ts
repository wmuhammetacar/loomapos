import { getDatabase } from "../storage/local-db.js";
import { clearCartDraft, getCartDraft } from "../storage/local-state-repository.js";
import type { PaymentMethod } from "./pos-service.js";

const CART_DRAFT_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export interface RestoredCartLine {
  productId: string;
  name: string;
  taxRate: number;
  qty: number;
  unitPrice: number;
  discount: number;
}

export interface RestoredCartDraft {
  cart: RestoredCartLine[];
  headerDiscount: number;
  customerName: string;
  paymentDraft: {
    method: PaymentMethod;
    cashReceived: number | null;
  };
  updatedAt: string;
}

export interface CartDraftRecoveryResult {
  restored: boolean;
  draft: RestoredCartDraft | null;
  warningCode: "stale" | "invalid" | "missing_products" | null;
  skippedProductCount: number;
}

const asNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
};

const normalizeMethod = (value: unknown): PaymentMethod => {
  if (typeof value !== "string") {
    return "CASH";
  }
  return value.toUpperCase() === "CARD" ? "CARD" : "CASH";
};

const getActiveProductMap = (tenantId: string, productIds: string[]) => {
  if (productIds.length === 0) {
    return new Map<string, { id: string; name: string; taxRate: number }>();
  }

  const db = getDatabase();
  const placeholders = productIds.map(() => "?").join(", ");
  const sql = `
    SELECT
      id,
      name,
      tax_rate AS taxRate
    FROM local_products
    WHERE tenant_id = ?
      AND is_active = 1
      AND id IN (${placeholders})
  `;
  const rows = db.prepare(sql).all(tenantId, ...productIds) as Array<{
    id: string;
    name: string;
    taxRate: number;
  }>;

  return new Map(rows.map((row) => [row.id, row]));
};

export const restoreCartDraftForSession = (
  tenantId: string,
  branchId: string,
  deviceId: string,
  nowMs = Date.now()
): CartDraftRecoveryResult => {
  const record = getCartDraft(tenantId, branchId, deviceId);
  if (!record) {
    return {
      restored: false,
      draft: null,
      warningCode: null,
      skippedProductCount: 0
    };
  }

  const updatedAtMs = Date.parse(record.updatedAt);
  const isStale = Number.isFinite(updatedAtMs) && nowMs - updatedAtMs > CART_DRAFT_STALE_THRESHOLD_MS;
  if (isStale) {
    clearCartDraft(tenantId, branchId, deviceId);
    return {
      restored: false,
      draft: null,
      warningCode: "stale",
      skippedProductCount: 0
    };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(record.payloadJson) as Record<string, unknown>;
  } catch {
    clearCartDraft(tenantId, branchId, deviceId);
    return {
      restored: false,
      draft: null,
      warningCode: "invalid",
      skippedProductCount: 0
    };
  }

  const rawCart = Array.isArray(payload.cart) ? payload.cart : [];
  const requestedLines = rawCart
    .map((line) => {
      if (!line || typeof line !== "object") {
        return null;
      }
      const candidate = line as Record<string, unknown>;
      if (typeof candidate.productId !== "string" || candidate.productId.trim().length === 0) {
        return null;
      }

      const qty = Math.max(0, asNumber(candidate.qty, 0));
      if (qty <= 0) {
        return null;
      }

      return {
        productId: candidate.productId,
        name: typeof candidate.name === "string" ? candidate.name : "Urun",
        taxRate: Math.max(0, asNumber(candidate.taxRate, 0)),
        qty,
        unitPrice: Math.max(0, asNumber(candidate.unitPrice, 0)),
        discount: Math.max(0, asNumber(candidate.discount, 0))
      };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  const productMap = getActiveProductMap(
    tenantId,
    Array.from(new Set(requestedLines.map((line) => line.productId)))
  );

  let skippedProductCount = 0;
  const restoredCart: RestoredCartLine[] = [];
  for (const line of requestedLines) {
    const product = productMap.get(line.productId);
    if (!product) {
      skippedProductCount += 1;
      continue;
    }

    restoredCart.push({
      productId: line.productId,
      name: product.name || line.name,
      taxRate: Number.isFinite(product.taxRate) ? product.taxRate : line.taxRate,
      qty: line.qty,
      unitPrice: line.unitPrice,
      discount: line.discount
    });
  }

  const paymentDraftRaw = (payload.paymentDraft ?? null) as Record<string, unknown> | null;
  const paymentMethod = normalizeMethod(
    paymentDraftRaw?.method ?? payload.paymentMethod ?? "CASH"
  );
  const paymentCashReceivedRaw = paymentDraftRaw?.cashReceived ?? payload.cashReceived ?? null;
  const paymentCashReceived =
    paymentCashReceivedRaw === null || paymentCashReceivedRaw === undefined
      ? null
      : Math.max(0, asNumber(paymentCashReceivedRaw, 0));

  const normalizedDraft: RestoredCartDraft = {
    cart: restoredCart,
    headerDiscount: Math.max(0, asNumber(payload.headerDiscount, 0)),
    customerName: typeof payload.customerName === "string" ? payload.customerName : "",
    paymentDraft: {
      method: paymentMethod,
      cashReceived: paymentCashReceived
    },
    updatedAt: record.updatedAt
  };

  if (restoredCart.length === 0) {
    clearCartDraft(tenantId, branchId, deviceId);
    return {
      restored: false,
      draft: null,
      warningCode: skippedProductCount > 0 ? "missing_products" : null,
      skippedProductCount
    };
  }

  return {
    restored: true,
    draft: normalizedDraft,
    warningCode: skippedProductCount > 0 ? "missing_products" : null,
    skippedProductCount
  };
};
