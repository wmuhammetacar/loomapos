import crypto from "node:crypto";
import { getDatabase } from "../storage/local-db.js";
import { appendLocalAuditLog } from "../storage/local-state-repository.js";
import { appendOutboxEvent } from "../sync/outbox-repository.js";
import {
  applyStockLedgerEffect,
  assertStockAvailabilityForSale,
  closeCashSession,
  getNextReceiptNumber,
  getSessionReport,
  requireSaleShift
} from "../operations/operations-service.js";

export type PaymentMethod = "CASH" | "CARD";
export type RefundPaymentMode = PaymentMethod | "SAME_AS_ORIGINAL";

export interface ProductView {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: string;
  taxRate: number;
  price: number;
}

export interface CatalogProductSnapshot extends ProductView {
  isActive: boolean;
  updatedAt?: string | null;
}

export interface CartLineInput {
  productId: string;
  qty: number;
  unitPrice: number;
  discount: number;
}

export interface CreateSaleInput {
  tenantId: string;
  branchId: string;
  deviceId: string;
  cashierUserId: string;
  customerName?: string | null;
  discount: number;
  paymentMethod: PaymentMethod;
  lines: CartLineInput[];
}

export interface CreateSaleResult {
  saleId: string;
  receiptNo: string;
  total: number;
  receiptText: string;
}

export interface LocalSaleSummary {
  saleId: string;
  receiptNo: string;
  status: string;
  total: number;
  createdAt: string;
}

export interface EndOfDaySummary {
  saleCount: number;
  grossTotal: number;
  discountTotal: number;
  taxTotal: number;
  netTotal: number;
}

export interface RefundCandidateLine {
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

export interface RefundCandidatePayment {
  method: PaymentMethod;
  amount: number;
}

export interface RefundCandidateSale {
  saleId: string;
  receiptNo: string;
  status: string;
  createdAt: string;
  lines: RefundCandidateLine[];
  payments: RefundCandidatePayment[];
}

export interface RefundLineInput {
  sourceLineId?: string | null;
  productId: string;
  qty: number;
  unitPrice?: number;
  discount?: number;
  taxRate?: number;
}

export interface CreateRefundInput {
  tenantId: string;
  branchId: string;
  deviceId: string;
  cashierUserId: string;
  sourceSaleId?: string | null;
  sourceReceiptNo?: string | null;
  paymentMode: RefundPaymentMode;
  returnToStock?: boolean;
  refundReasonCode?: string | null;
  lines: RefundLineInput[];
}

export interface CreateRefundResult {
  refundSaleId: string;
  receiptNo: string;
  total: number;
  paymentMethod: PaymentMethod;
  receiptText: string;
}

export interface XReportSummary {
  date: string;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  transactionCount: number;
  refundTotal: number;
  cashRefund: number;
  cardRefund: number;
}

export interface ZReportPreview {
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
}

export interface CloseZReportInput {
  tenantId: string;
  branchId: string;
  deviceId: string;
  cashierUserId: string;
  cashierName: string;
  date: string;
  openingCash: number;
  countedCash: number;
}

export interface CloseZReportResult {
  reportId: string;
  preview: ZReportPreview;
  receiptText: string;
}

const SAMPLE_PRODUCTS: Array<Omit<ProductView, "taxRate"> & { taxRate: number; tenantId: string }> = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    tenantId: "00000000-0000-0000-0000-000000000001",
    name: "Su 0.5L",
    sku: "SKU-SU-05",
    barcode: "869000000001",
    unit: "adet",
    taxRate: 1,
    price: 10
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    tenantId: "00000000-0000-0000-0000-000000000001",
    name: "Sandvic Tavuk",
    sku: "SKU-SAN-01",
    barcode: "869000000002",
    unit: "adet",
    taxRate: 10,
    price: 115
  },
  {
    id: "10000000-0000-0000-0000-000000000003",
    tenantId: "00000000-0000-0000-0000-000000000001",
    name: "Kahve Buyuk",
    sku: "SKU-KAH-01",
    barcode: "869000000003",
    unit: "adet",
    taxRate: 10,
    price: 95
  }
];

export const seedLocalProducts = (tenantId: string) => {
  const db = getDatabase();
  const countRow = db
    .prepare("SELECT COUNT(1) AS count FROM local_products WHERE tenant_id = ?")
    .get(tenantId) as { count: number };
  if (countRow.count > 0) {
    return;
  }

  const insert = db.prepare(`
    INSERT INTO products(id, tenant_id, name, sku, barcode, unit, tax_rate, price, is_active, created_at)
    VALUES(@id, @tenantId, @name, @sku, @barcode, @unit, @taxRate, @price, 1, @createdAt)
  `);
  const insertLocal = db.prepare(`
    INSERT INTO local_products(
      id, tenant_id, name, sku, barcode, unit, tax_rate, price, stock_tracked, service_item,
      variant_enabled, negative_stock_allowed, sell_when_out_of_stock, is_active, source, created_at, updated_at
    )
    VALUES(
      @id, @tenantId, @name, @sku, @barcode, @unit, @taxRate, @price, 1, 0,
      0, 0, 1, 1, 'seed', @createdAt, @updatedAt
    )
  `);
  const insertBarcode = db.prepare(`
    INSERT INTO local_product_barcodes(id, product_id, barcode, is_primary, created_at, updated_at)
    VALUES(@id, @productId, @barcode, 1, @createdAt, @updatedAt)
  `);
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    for (const product of SAMPLE_PRODUCTS) {
      if (product.tenantId !== tenantId) {
        continue;
      }

      insert.run({
        ...product,
        createdAt: now
      });

      insertLocal.run({
        ...product,
        createdAt: now,
        updatedAt: now
      });

      if (product.barcode) {
        insertBarcode.run({
          id: crypto.randomUUID(),
          productId: product.id,
          barcode: product.barcode,
          createdAt: now,
          updatedAt: now
        });
      }
    }
  });
  tx();
};

export const replaceLocalProducts = (tenantId: string, rows: CatalogProductSnapshot[]) => {
  const db = getDatabase();
  const deleteBarcodes = db.prepare(`
    DELETE FROM local_product_barcodes
    WHERE product_id IN (SELECT id FROM local_products WHERE tenant_id = @tenantId)
  `);
  const deleteProducts = db.prepare("DELETE FROM local_products WHERE tenant_id = @tenantId");
  const deleteLegacyProducts = db.prepare("DELETE FROM products WHERE tenant_id = @tenantId");
  const insertLegacy = db.prepare(`
    INSERT INTO products(id, tenant_id, name, sku, barcode, unit, tax_rate, price, is_active, created_at)
    VALUES(@id, @tenantId, @name, @sku, @barcode, @unit, @taxRate, @price, @isActive, @createdAt)
  `);
  const insertLocal = db.prepare(`
    INSERT INTO local_products(
      id, tenant_id, name, sku, barcode, unit, tax_rate, price, stock_tracked, service_item,
      variant_enabled, negative_stock_allowed, sell_when_out_of_stock, is_active, source, created_at, updated_at
    )
    VALUES(
      @id, @tenantId, @name, @sku, @barcode, @unit, @taxRate, @price, 1, 0,
      0, 0, 1, @isActive, 'cloud', @createdAt, @updatedAt
    )
  `);
  const insertBarcode = db.prepare(`
    INSERT INTO local_product_barcodes(id, product_id, barcode, is_primary, created_at, updated_at)
    VALUES(@id, @productId, @barcode, 1, @createdAt, @updatedAt)
  `);

  const tx = db.transaction(() => {
    deleteBarcodes.run({ tenantId });
    deleteProducts.run({ tenantId });
    deleteLegacyProducts.run({ tenantId });

    for (const row of rows) {
      const createdAt = row.updatedAt ?? new Date().toISOString();
      insertLegacy.run({
        ...row,
        tenantId,
        isActive: row.isActive ? 1 : 0,
        createdAt
      });
      insertLocal.run({
        ...row,
        tenantId,
        isActive: row.isActive ? 1 : 0,
        createdAt,
        updatedAt: createdAt
      });

      if (row.barcode) {
        insertBarcode.run({
          id: crypto.randomUUID(),
          productId: row.id,
          barcode: row.barcode,
          createdAt,
          updatedAt: createdAt
        });
      }
    }
  });
  tx();
};

export const findProducts = (tenantId: string, search?: string, barcode?: string): ProductView[] => {
  const db = getDatabase();
  const searchTerm = (search ?? "").trim();
  const barcodeTerm = (barcode ?? "").trim();

  if (barcodeTerm.length > 0) {
    const byBarcode = db
      .prepare(`
        SELECT
          p.id,
          p.name,
          p.sku,
          p.barcode,
          p.unit,
          p.tax_rate AS taxRate,
          p.price
        FROM local_products p
        INNER JOIN local_product_barcodes b ON b.product_id = p.id
        WHERE p.tenant_id = @tenantId AND p.is_active = 1 AND b.barcode = @barcode
        ORDER BY name ASC
        LIMIT 25
      `)
      .all({ tenantId, barcode: barcodeTerm }) as ProductView[];
    return byBarcode;
  }

  if (searchTerm.length === 0) {
    return db
      .prepare(`
        SELECT
          id,
          name,
          sku,
          barcode,
          unit,
          tax_rate AS taxRate,
          price
        FROM local_products
        WHERE tenant_id = @tenantId AND is_active = 1
        ORDER BY name ASC
        LIMIT 100
      `)
      .all({ tenantId }) as ProductView[];
  }

  return db
    .prepare(`
      SELECT
        id,
        name,
        sku,
        barcode,
        unit,
        tax_rate AS taxRate,
        price
      FROM local_products
      WHERE tenant_id = @tenantId
        AND is_active = 1
        AND (
          name LIKE @term
          OR IFNULL(sku, '') LIKE @term
          OR IFNULL(barcode, '') LIKE @term
        )
      ORDER BY name ASC
      LIMIT 100
    `)
    .all({ tenantId, term: `%${searchTerm}%` }) as ProductView[];
};

export const createSale = (input: CreateSaleInput, receiptTextFactory: (sale: ReceiptModel) => string): CreateSaleResult => {
  if (input.lines.length === 0) {
    throw new Error("Sepet bos olamaz.");
  }

  const db = getDatabase();
  const activeCashSession = requireSaleShift(input.tenantId, input.branchId, input.deviceId);
  const products = db
    .prepare(`
      SELECT id, name, barcode, tax_rate AS taxRate
      FROM local_products
      WHERE tenant_id = @tenantId AND is_active = 1
    `)
    .all({ tenantId: input.tenantId }) as Array<{ id: string; name: string; barcode: string | null; taxRate: number }>;
  const productById = new Map(products.map((product) => [product.id, product]));

  const saleId = crypto.randomUUID();
  const receiptNo = getNextReceiptNumber("sale", input.branchId, input.deviceId, activeCashSession?.cashSessionId ?? null);
  const now = new Date().toISOString();

  const lineModels = input.lines.map((line) => {
    const product = productById.get(line.productId);
    if (!product) {
      throw new Error(`Urun bulunamadi: ${line.productId}`);
    }

    const normalizedQty = Math.max(0.0001, line.qty);
    const normalizedUnitPrice = Math.max(0, line.unitPrice);
    const normalizedLineDiscount = Math.max(0, line.discount);
    const subtotal = normalizedQty * normalizedUnitPrice;
    const taxBase = Math.max(0, subtotal - normalizedLineDiscount);
    const tax = (taxBase * product.taxRate) / 100;
    const total = taxBase + tax;

    return {
      id: crypto.randomUUID(),
      productId: line.productId,
      productName: product.name,
      barcode: product.barcode,
      qty: normalizedQty,
      unitPrice: normalizedUnitPrice,
      discount: normalizedLineDiscount,
      tax,
      lineTotal: total
    };
  });

  assertStockAvailabilityForSale(
    input.tenantId,
    input.branchId,
    lineModels.map((line) => ({
      productId: line.productId,
      qty: line.qty
    }))
  );

  const subtotal = round2(lineModels.reduce((sum, line) => sum + line.qty * line.unitPrice, 0));
  const lineDiscount = round2(lineModels.reduce((sum, line) => sum + line.discount, 0));
  const headerDiscount = round2(Math.max(0, input.discount));
  const discount = round2(lineDiscount + headerDiscount);
  const tax = round2(lineModels.reduce((sum, line) => sum + line.tax, 0));
  const total = round2(Math.max(0, subtotal - discount + tax));

  const payload = {
    saleId,
    receiptNo,
    createdAt: now,
    cashSessionId: activeCashSession?.cashSessionId ?? null,
    customerName: input.customerName?.trim() || null,
    subtotal,
    discount,
    tax,
    total,
    lines: lineModels.map((line) => ({
      productId: line.productId,
      qty: line.qty,
      unitPrice: round2(line.unitPrice),
      discount: round2(line.discount),
      tax: round2(line.tax),
      lineTotal: round2(line.lineTotal)
    })),
    payments: [
      {
        method: input.paymentMethod,
        amount: total
      }
    ]
  };

  const insertSale = db.prepare(`
    INSERT INTO sales(
      id, tenant_id, branch_id, device_id, cashier_user_id, receipt_no, status, subtotal, discount, tax, total, currency, sync_status, created_at
    )
    VALUES (@id, @tenantId, @branchId, @deviceId, @cashierUserId, @receiptNo, 'COMPLETED', @subtotal, @discount, @tax, @total, 'TRY', 'PENDING', @createdAt)
  `);
  const insertLocalSale = db.prepare(`
    INSERT INTO local_sales(
      local_sale_id, cloud_sale_id, tenant_id, branch_id, device_id, cashier_user_id, cash_session_id, customer_name,
      receipt_no_local, status, subtotal, discount_total, tax_total, grand_total, currency, sync_status, created_at, updated_at
    )
    VALUES (
      @localSaleId, NULL, @tenantId, @branchId, @deviceId, @cashierUserId, @cashSessionId, @customerName,
      @receiptNoLocal, 'COMPLETED', @subtotal, @discountTotal, @taxTotal, @grandTotal, 'TRY', 'PENDING', @createdAt, @updatedAt
    )
  `);
  const insertLine = db.prepare(`
    INSERT INTO sale_lines(
      id, sale_id, product_id, qty, unit_price, discount, tax, line_total
    )
    VALUES (@id, @saleId, @productId, @qty, @unitPrice, @discount, @tax, @lineTotal)
  `);
  const insertLocalLine = db.prepare(`
    INSERT INTO local_sale_lines(
      local_sale_line_id, local_sale_id, product_id, product_name_snapshot, barcode_snapshot, qty, unit_price, discount_amount, tax_amount, line_total, created_at
    )
    VALUES (@localSaleLineId, @localSaleId, @productId, @productNameSnapshot, @barcodeSnapshot, @qty, @unitPrice, @discountAmount, @taxAmount, @lineTotal, @createdAt)
  `);
  const insertPayment = db.prepare(`
    INSERT INTO payments(id, sale_id, method, amount, created_at)
    VALUES (@id, @saleId, @method, @amount, @createdAt)
  `);
  const insertLocalPayment = db.prepare(`
    INSERT INTO local_payments(local_payment_id, local_sale_id, cash_session_id, method, amount, created_at)
    VALUES (@localPaymentId, @localSaleId, @cashSessionId, @method, @amount, @createdAt)
  `);
  const insertReceipt = db.prepare(`
    INSERT INTO local_receipts(
      local_receipt_id, local_sale_id, receipt_no_local, template_type, original_receipt_no,
      receipt_payload_json, print_status, printed_at, created_at
    )
    VALUES (
      @localReceiptId, @localSaleId, @receiptNoLocal, 'sale', NULL,
      @receiptPayloadJson, 'pending', NULL, @createdAt
    )
  `);

  const transaction = db.transaction(() => {
    insertSale.run({
      id: saleId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      deviceId: input.deviceId,
      cashierUserId: input.cashierUserId,
      receiptNo,
      subtotal,
      discount,
      tax,
      total,
      createdAt: now
    });

    insertLocalSale.run({
      localSaleId: saleId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      deviceId: input.deviceId,
      cashierUserId: input.cashierUserId,
      cashSessionId: activeCashSession?.cashSessionId ?? null,
      customerName: input.customerName?.trim() || null,
      receiptNoLocal: receiptNo,
      subtotal,
      discountTotal: discount,
      taxTotal: tax,
      grandTotal: total,
      createdAt: now,
      updatedAt: now
    });

    for (const line of lineModels) {
      insertLine.run({
        id: line.id,
        saleId,
        productId: line.productId,
        qty: line.qty,
        unitPrice: line.unitPrice,
        discount: line.discount,
        tax: line.tax,
        lineTotal: line.lineTotal
      });

      insertLocalLine.run({
        localSaleLineId: line.id,
        localSaleId: saleId,
        productId: line.productId,
        productNameSnapshot: line.productName,
        barcodeSnapshot: line.barcode,
        qty: line.qty,
        unitPrice: line.unitPrice,
        discountAmount: line.discount,
        taxAmount: line.tax,
        lineTotal: line.lineTotal,
        createdAt: now
      });
      applyStockLedgerEffect({
        tenantId: input.tenantId,
        branchId: input.branchId,
        productId: line.productId,
        qtyDelta: -line.qty,
        reasonCode: "sale",
        referenceType: "sale",
        referenceId: saleId,
        createdAt: now
      });
    }

    insertPayment.run({
      id: crypto.randomUUID(),
      saleId,
      method: input.paymentMethod,
      amount: total,
      createdAt: now
    });

    insertLocalPayment.run({
      localPaymentId: crypto.randomUUID(),
      localSaleId: saleId,
      cashSessionId: activeCashSession?.cashSessionId ?? null,
      method: input.paymentMethod,
      amount: total,
      createdAt: now
    });

    insertReceipt.run({
      localReceiptId: crypto.randomUUID(),
      localSaleId: saleId,
      receiptNoLocal: receiptNo,
      receiptPayloadJson: JSON.stringify(payload),
      createdAt: now
    });

    appendOutboxEvent({
      tenantId: input.tenantId,
      branchId: input.branchId,
      deviceId: input.deviceId,
      eventType: "SALE_CREATED",
      aggregateType: "sale",
      aggregateId: saleId,
      payload
    });

    appendOutboxEvent({
      tenantId: input.tenantId,
      branchId: input.branchId,
      deviceId: input.deviceId,
      eventType: "SALE_PAYMENT_RECORDED",
      aggregateType: "payment",
      aggregateId: saleId,
      payload: {
        saleId,
        receiptNo,
        method: input.paymentMethod,
        amount: total,
        createdAt: now,
        cashSessionId: activeCashSession?.cashSessionId ?? null
      }
    });
  });
  transaction();

  const receiptText = receiptTextFactory({
    saleId,
    receiptNo,
    createdAt: now,
    subtotal,
    discount,
    tax,
    total,
    paymentMethod: input.paymentMethod,
    lines: lineModels.map((line) => ({
      productName: line.productName,
      qty: line.qty,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal
    }))
  });

  appendLocalAuditLog({
    tenantId: input.tenantId,
    branchId: input.branchId,
    deviceId: input.deviceId,
    actorUserId: input.cashierUserId,
    actorEmail: input.cashierUserId,
    actorName: input.cashierUserId,
    eventType: "sale_completed",
    message: "Satis lokal olarak tamamlandi.",
    entityType: "sale",
    entityId: saleId,
    metadata: {
      cashSessionId: activeCashSession?.cashSessionId ?? null,
      customerName: input.customerName?.trim() || null
    },
    payload: {
      saleId,
      receiptNo,
      total,
      paymentMethod: input.paymentMethod
    }
  });

  return {
    saleId,
    receiptNo,
    total,
    receiptText
  };
};

export const voidSale = (tenantId: string, branchId: string, deviceId: string, saleId: string, reason: string) => {
  const db = getDatabase();
  const sale = db
    .prepare(`
      SELECT local_sale_id AS id, status, cashier_user_id AS cashierUserId
      FROM local_sales
      WHERE local_sale_id = @saleId AND tenant_id = @tenantId
    `)
    .get({ saleId, tenantId }) as { id: string; status: string; cashierUserId: string | null } | undefined;

  if (!sale) {
    throw new Error("Iptal edilecek satis bulunamadi.");
  }

  if (sale.status === "VOIDED") {
    return;
  }

  const saleLines = db
    .prepare("SELECT product_id AS productId, qty FROM local_sale_lines WHERE local_sale_id = @saleId")
    .all({ saleId }) as Array<{ productId: string; qty: number }>;

  const updateSale = db.prepare("UPDATE sales SET status = 'VOIDED' WHERE id = @saleId");
  const updateLocalSale = db.prepare(`
    UPDATE local_sales
    SET status = 'VOIDED', sync_status = 'PENDING', updated_at = @updatedAt
    WHERE local_sale_id = @saleId
  `);

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    updateSale.run({ saleId });
    updateLocalSale.run({ saleId, updatedAt: now });

    for (const line of saleLines) {
      applyStockLedgerEffect({
        tenantId,
        branchId,
        productId: line.productId,
        qtyDelta: line.qty,
        reasonCode: reason.trim().length > 0 ? reason.trim() : "sale_void",
        referenceType: "sale_void",
        referenceId: saleId,
        createdAt: now
      });
    }

    appendOutboxEvent({
      tenantId,
      branchId,
      deviceId,
      eventType: "SALE_VOIDED",
      aggregateType: "sale",
      aggregateId: saleId,
      payload: {
        saleId,
        reason
      }
    });
  });
  tx();

  appendLocalAuditLog({
    tenantId,
    branchId,
    deviceId,
    actorUserId: sale.cashierUserId,
    actorEmail: sale.cashierUserId,
    actorName: sale.cashierUserId,
    eventType: "sale_voided",
    message: "Lokal satis iptal edildi.",
    entityType: "sale",
    entityId: saleId,
    payload: {
      saleId,
      reason
    }
  });
};

export const getSaleByReceiptNo = (tenantId: string, receiptNo: string): RefundCandidateSale | null => {
  const db = getDatabase();
  const normalizedReceiptNo = receiptNo.trim();
  if (normalizedReceiptNo.length === 0) {
    return null;
  }

  const sale = db
    .prepare(`
      SELECT
        local_sale_id AS saleId,
        receipt_no_local AS receiptNo,
        status,
        created_at AS createdAt
      FROM local_sales
      WHERE tenant_id = @tenantId AND receipt_no_local = @receiptNo
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get({ tenantId, receiptNo: normalizedReceiptNo }) as
    | { saleId: string; receiptNo: string; status: string; createdAt: string }
    | undefined;

  if (!sale) {
    return null;
  }

  const lines = db
    .prepare(`
      SELECT
        l.local_sale_line_id AS saleLineId,
        l.product_id AS productId,
        l.product_name_snapshot AS productName,
        l.qty AS qty,
        l.unit_price AS unitPrice,
        l.discount_amount AS discount,
        l.tax_amount AS tax,
        IFNULL(p.tax_rate, 0) AS taxRate,
        l.line_total AS lineTotal
      FROM local_sale_lines l
      LEFT JOIN local_products p ON p.id = l.product_id AND p.tenant_id = @tenantId
      WHERE l.local_sale_id = @saleId
      ORDER BY l.created_at ASC
    `)
    .all({ tenantId, saleId: sale.saleId }) as Array<{
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

  const payments = db
    .prepare(`
      SELECT
        method,
        amount
      FROM local_payments
      WHERE local_sale_id = @saleId
      ORDER BY created_at ASC
    `)
    .all({ saleId: sale.saleId }) as Array<{ method: string; amount: number }>;

  return {
    saleId: sale.saleId,
    receiptNo: sale.receiptNo,
    status: sale.status,
    createdAt: sale.createdAt,
    lines: lines.map((line) => ({
      saleLineId: line.saleLineId,
      productId: line.productId,
      productName: line.productName,
      qty: Number(line.qty),
      unitPrice: Number(line.unitPrice),
      discount: Number(line.discount),
      tax: Number(line.tax),
      taxRate: Number(line.taxRate),
      lineTotal: Number(line.lineTotal)
    })),
    payments: payments.map((payment) => ({
      method: parsePaymentMethod(payment.method),
      amount: Number(payment.amount)
    }))
  };
};

export const createRefund = (
  input: CreateRefundInput,
  receiptTextFactory: (sale: ReceiptModel) => string
): CreateRefundResult => {
  if (input.lines.length === 0) {
    throw new Error("Iade sepeti bos olamaz.");
  }

  const db = getDatabase();
  const activeCashSession = requireSaleShift(input.tenantId, input.branchId, input.deviceId);
  const sourceSale = resolveSourceSale(input.tenantId, input.sourceSaleId, input.sourceReceiptNo);
  const sourceSaleId = sourceSale?.saleId ?? input.sourceSaleId ?? null;
  const sourceReceiptNo = sourceSale?.receiptNo ?? input.sourceReceiptNo ?? null;
  const returnToStock = input.returnToStock ?? true;
  const refundReasonCode = input.refundReasonCode?.trim() || null;

  const paymentMethod: PaymentMethod =
    input.paymentMode === "SAME_AS_ORIGINAL"
      ? getFirstPaymentMethodForSale(sourceSaleId) ?? "CASH"
      : input.paymentMode;

  const productIds = Array.from(new Set(input.lines.map((line) => line.productId)));
  const productRows =
    productIds.length > 0
      ? (db
          .prepare(`
            SELECT
              id,
              name,
              barcode,
              tax_rate AS taxRate,
              price
            FROM local_products
            WHERE tenant_id = @tenantId
              AND id IN (${productIds.map(() => "?").join(",")})
          `)
          .all(input.tenantId, ...productIds) as Array<{
          id: string;
          name: string;
          barcode: string | null;
          taxRate: number;
          price: number;
        }>)
      : [];
  const productById = new Map(productRows.map((row) => [row.id, row]));

  const refundSaleId = crypto.randomUUID();
  const receiptNo = getNextReceiptNumber("refund", input.branchId, input.deviceId, activeCashSession?.cashSessionId ?? null);
  const now = new Date().toISOString();

  const lineModels = input.lines.map((line) => {
    const product = productById.get(line.productId);
    if (!product) {
      throw new Error(`Iade urunu bulunamadi: ${line.productId}`);
    }

    const qty = Math.max(0.0001, Number(line.qty));
    const unitPrice = Math.max(0, Number(line.unitPrice ?? product.price));
    const discount = Math.max(0, Number(line.discount ?? 0));
    const taxRate = Math.max(0, Number(line.taxRate ?? product.taxRate));
    const subtotal = qty * unitPrice;
    const taxBase = Math.max(0, subtotal - discount);
    const tax = (taxBase * taxRate) / 100;
    const lineTotal = taxBase + tax;

    return {
      id: crypto.randomUUID(),
      sourceLineId: line.sourceLineId ?? null,
      productId: line.productId,
      productName: product.name,
      barcode: product.barcode,
      qty,
      unitPrice,
      discount,
      tax,
      lineTotal
    };
  });

  const subtotal = round2(lineModels.reduce((sum, line) => sum + line.qty * line.unitPrice, 0));
  const discount = round2(lineModels.reduce((sum, line) => sum + line.discount, 0));
  const tax = round2(lineModels.reduce((sum, line) => sum + line.tax, 0));
  const total = round2(Math.max(0, subtotal - discount + tax));

  const payload = {
    refundSaleId,
    sourceSaleId,
    sourceReceiptNo,
    receiptNo,
    createdAt: now,
    cashSessionId: activeCashSession?.cashSessionId ?? null,
    subtotal,
    discount,
    tax,
    total,
    returnToStock,
    refundReasonCode,
    lines: lineModels.map((line) => ({
      sourceLineId: line.sourceLineId,
      productId: line.productId,
      qty: line.qty,
      unitPrice: round2(line.unitPrice),
      discount: round2(line.discount),
      tax: round2(line.tax),
      lineTotal: round2(line.lineTotal)
    })),
    payments: [
      {
        method: paymentMethod,
        amount: total
      }
    ]
  };

  const insertSale = db.prepare(`
    INSERT INTO sales(
      id, tenant_id, branch_id, device_id, cashier_user_id, receipt_no, status, subtotal, discount, tax, total, currency, sync_status, created_at
    )
    VALUES (@id, @tenantId, @branchId, @deviceId, @cashierUserId, @receiptNo, 'REFUNDED', @subtotal, @discount, @tax, @total, 'TRY', 'PENDING', @createdAt)
  `);
  const insertLocalSale = db.prepare(`
    INSERT INTO local_sales(
      local_sale_id, cloud_sale_id, tenant_id, branch_id, device_id, cashier_user_id, cash_session_id, customer_name,
      original_sale_id, receipt_no_local, status, subtotal, discount_total, tax_total, grand_total, currency, sync_status, created_at, updated_at
    )
    VALUES (
      @localSaleId, NULL, @tenantId, @branchId, @deviceId, @cashierUserId, @cashSessionId, NULL,
      @originalSaleId, @receiptNoLocal, 'REFUNDED', @subtotal, @discountTotal, @taxTotal, @grandTotal, 'TRY', 'PENDING', @createdAt, @updatedAt
    )
  `);
  const insertLine = db.prepare(`
    INSERT INTO sale_lines(
      id, sale_id, product_id, qty, unit_price, discount, tax, line_total
    )
    VALUES (@id, @saleId, @productId, @qty, @unitPrice, @discount, @tax, @lineTotal)
  `);
  const insertLocalLine = db.prepare(`
    INSERT INTO local_sale_lines(
      local_sale_line_id, local_sale_id, product_id, product_name_snapshot, barcode_snapshot, qty, unit_price, discount_amount, tax_amount, line_total, created_at
    )
    VALUES (@localSaleLineId, @localSaleId, @productId, @productNameSnapshot, @barcodeSnapshot, @qty, @unitPrice, @discountAmount, @taxAmount, @lineTotal, @createdAt)
  `);
  const insertPayment = db.prepare(`
    INSERT INTO payments(id, sale_id, method, amount, created_at)
    VALUES (@id, @saleId, @method, @amount, @createdAt)
  `);
  const insertLocalPayment = db.prepare(`
    INSERT INTO local_payments(local_payment_id, local_sale_id, cash_session_id, method, amount, created_at)
    VALUES (@localPaymentId, @localSaleId, @cashSessionId, @method, @amount, @createdAt)
  `);
  const insertReceipt = db.prepare(`
    INSERT INTO local_receipts(
      local_receipt_id, local_sale_id, receipt_no_local, template_type, original_receipt_no,
      receipt_payload_json, print_status, printed_at, created_at
    )
    VALUES (
      @localReceiptId, @localSaleId, @receiptNoLocal, 'refund', @originalReceiptNo,
      @receiptPayloadJson, 'pending', NULL, @createdAt
    )
  `);
  const insertRefund = db.prepare(`
    INSERT INTO local_refunds(
      local_refund_id, tenant_id, branch_id, device_id, cash_session_id, original_local_sale_id, original_cloud_sale_id,
      refund_receipt_no, refund_total, refund_payment_method, return_to_stock, refund_reason_code,
      cashier_user_id, sync_status, created_at, updated_at
    )
    VALUES(
      @localRefundId, @tenantId, @branchId, @deviceId, @cashSessionId, @originalLocalSaleId, NULL,
      @refundReceiptNo, @refundTotal, @refundPaymentMethod, @returnToStock, @refundReasonCode,
      @cashierUserId, 'PENDING', @createdAt, @updatedAt
    )
  `);
  const insertRefundLine = db.prepare(`
    INSERT INTO local_refund_lines(
      local_refund_line_id, local_refund_id, original_line_ref, product_id, qty_refunded, refund_amount, stock_return_qty, created_at
    )
    VALUES(
      @localRefundLineId, @localRefundId, @originalLineRef, @productId, @qtyRefunded, @refundAmount, @stockReturnQty, @createdAt
    )
  `);

  const tx = db.transaction(() => {
    insertSale.run({
      id: refundSaleId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      deviceId: input.deviceId,
      cashierUserId: input.cashierUserId,
      receiptNo,
      subtotal,
      discount,
      tax,
      total,
      createdAt: now
    });

    insertLocalSale.run({
      localSaleId: refundSaleId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      deviceId: input.deviceId,
      cashierUserId: input.cashierUserId,
      cashSessionId: activeCashSession?.cashSessionId ?? null,
      originalSaleId: sourceSaleId,
      receiptNoLocal: receiptNo,
      subtotal,
      discountTotal: discount,
      taxTotal: tax,
      grandTotal: total,
      createdAt: now,
      updatedAt: now
    });

    for (const line of lineModels) {
      insertLine.run({
        id: line.id,
        saleId: refundSaleId,
        productId: line.productId,
        qty: line.qty,
        unitPrice: line.unitPrice,
        discount: line.discount,
        tax: line.tax,
        lineTotal: line.lineTotal
      });

      insertLocalLine.run({
        localSaleLineId: line.id,
        localSaleId: refundSaleId,
        productId: line.productId,
        productNameSnapshot: line.productName,
        barcodeSnapshot: line.barcode,
        qty: line.qty,
        unitPrice: line.unitPrice,
        discountAmount: line.discount,
        taxAmount: line.tax,
        lineTotal: line.lineTotal,
        createdAt: now
      });

      if (returnToStock) {
        applyStockLedgerEffect({
          tenantId: input.tenantId,
          branchId: input.branchId,
          productId: line.productId,
          qtyDelta: line.qty,
          reasonCode: refundReasonCode ?? "refund",
          referenceType: "sale_refund",
          referenceId: refundSaleId,
          createdAt: now
        });
      }
    }

    insertPayment.run({
      id: crypto.randomUUID(),
      saleId: refundSaleId,
      method: paymentMethod,
      amount: total,
      createdAt: now
    });

    insertLocalPayment.run({
      localPaymentId: crypto.randomUUID(),
      localSaleId: refundSaleId,
      cashSessionId: activeCashSession?.cashSessionId ?? null,
      method: paymentMethod,
      amount: total,
      createdAt: now
    });

    insertReceipt.run({
      localReceiptId: crypto.randomUUID(),
      localSaleId: refundSaleId,
      receiptNoLocal: receiptNo,
      originalReceiptNo: sourceReceiptNo,
      receiptPayloadJson: JSON.stringify(payload),
      createdAt: now
    });

    insertRefund.run({
      localRefundId: refundSaleId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      deviceId: input.deviceId,
      cashSessionId: activeCashSession?.cashSessionId ?? null,
      originalLocalSaleId: sourceSaleId,
      refundReceiptNo: receiptNo,
      refundTotal: total,
      refundPaymentMethod: paymentMethod,
      returnToStock: returnToStock ? 1 : 0,
      refundReasonCode,
      cashierUserId: input.cashierUserId,
      createdAt: now,
      updatedAt: now
    });

    for (const line of lineModels) {
      insertRefundLine.run({
        localRefundLineId: crypto.randomUUID(),
        localRefundId: refundSaleId,
        originalLineRef: line.sourceLineId,
        productId: line.productId,
        qtyRefunded: line.qty,
        refundAmount: line.lineTotal,
        stockReturnQty: returnToStock ? line.qty : 0,
        createdAt: now
      });
    }

    appendOutboxEvent({
      tenantId: input.tenantId,
      branchId: input.branchId,
      deviceId: input.deviceId,
      eventType: "SALE_REFUND_CREATED",
      aggregateType: "sale_refund",
      aggregateId: refundSaleId,
      payload
    });
  });
  tx();

  const receiptCoreText = receiptTextFactory({
    saleId: refundSaleId,
    receiptNo,
    createdAt: now,
    subtotal,
    discount,
    tax,
    total,
    paymentMethod,
    lines: lineModels.map((line) => ({
      productName: line.productName,
      qty: line.qty,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal
    }))
  });

  const receiptText = ["IADE FISI", `Kaynak Fis: ${sourceReceiptNo ?? "-"}`, receiptCoreText].join("\n");

  appendLocalAuditLog({
    tenantId: input.tenantId,
    branchId: input.branchId,
    deviceId: input.deviceId,
    actorUserId: input.cashierUserId,
    actorEmail: input.cashierUserId,
    actorName: input.cashierUserId,
    eventType: "refund_completed",
    message: "Lokal iade islemi tamamlandi.",
    entityType: "refund",
    entityId: refundSaleId,
    metadata: {
      sourceSaleId,
      returnToStock,
      refundReasonCode
    },
    payload: {
      refundSaleId,
      receiptNo,
      total,
      paymentMethod,
      sourceReceiptNo
    }
  });

  return {
    refundSaleId,
    receiptNo,
    total,
    paymentMethod,
    receiptText
  };
};

export const getRecentSales = (tenantId: string, limit = 25): LocalSaleSummary[] => {
  const db = getDatabase();
  return db
    .prepare(`
      SELECT
        local_sale_id AS saleId,
        receipt_no_local AS receiptNo,
        status,
        grand_total AS total,
        created_at AS createdAt
      FROM local_sales
      WHERE tenant_id = @tenantId
      ORDER BY created_at DESC
      LIMIT @limit
    `)
    .all({ tenantId, limit }) as LocalSaleSummary[];
};

export const getEndOfDaySummary = (tenantId: string, date: string): EndOfDaySummary => {
  const db = getDatabase();
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const summary = db
    .prepare(`
      SELECT
        COUNT(1) AS saleCount,
        IFNULL(SUM(subtotal), 0) AS grossTotal,
        IFNULL(SUM(discount_total), 0) AS discountTotal,
        IFNULL(SUM(tax_total), 0) AS taxTotal,
        IFNULL(SUM(grand_total), 0) AS netTotal
      FROM local_sales
      WHERE tenant_id = @tenantId
        AND created_at >= @dayStart
        AND created_at < @dayEnd
        AND status = 'COMPLETED'
    `)
    .get({
      tenantId,
      dayStart: dayStart.toISOString(),
      dayEnd: dayEnd.toISOString()
    }) as EndOfDaySummary;

  return {
    saleCount: summary.saleCount,
    grossTotal: round2(summary.grossTotal),
    discountTotal: round2(summary.discountTotal),
    taxTotal: round2(summary.taxTotal),
    netTotal: round2(summary.netTotal)
  };
};

export const getXReport = (tenantId: string, date: string): XReportSummary => {
  const db = getDatabase();
  const { dayStartIso, dayEndIso } = getDayRange(date);

  const salesSummary = db
    .prepare(`
      SELECT
        IFNULL(SUM(CASE WHEN status = 'COMPLETED' THEN grand_total ELSE 0 END), 0) AS totalSales,
        IFNULL(SUM(CASE WHEN status = 'REFUNDED' THEN grand_total ELSE 0 END), 0) AS refundTotal,
        IFNULL(SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS transactionCount
      FROM local_sales
      WHERE tenant_id = @tenantId
        AND created_at >= @dayStart
        AND created_at < @dayEnd
    `)
    .get({ tenantId, dayStart: dayStartIso, dayEnd: dayEndIso }) as {
    totalSales: number;
    refundTotal: number;
    transactionCount: number;
  };

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
        AND s.created_at >= @dayStart
        AND s.created_at < @dayEnd
    `)
    .get({ tenantId, dayStart: dayStartIso, dayEnd: dayEndIso }) as {
    cashSales: number;
    cardSales: number;
    cashRefund: number;
    cardRefund: number;
  };

  return {
    date,
    totalSales: round2(salesSummary.totalSales),
    cashSales: round2(paymentSummary.cashSales),
    cardSales: round2(paymentSummary.cardSales),
    transactionCount: Number(salesSummary.transactionCount),
    refundTotal: round2(salesSummary.refundTotal),
    cashRefund: round2(paymentSummary.cashRefund),
    cardRefund: round2(paymentSummary.cardRefund)
  };
};

export const getZReportPreview = (
  tenantId: string,
  date: string,
  openingCash: number,
  countedCash: number
): ZReportPreview => {
  const x = getXReport(tenantId, date);
  const normalizedOpeningCash = round2(Math.max(0, openingCash));
  const normalizedCountedCash = round2(Math.max(0, countedCash));
  const expectedCash = round2(normalizedOpeningCash + x.cashSales - x.cashRefund);
  const difference = round2(normalizedCountedCash - expectedCash);

  return {
    date,
    openingCash: normalizedOpeningCash,
    cashSales: x.cashSales,
    cardSales: x.cardSales,
    refundTotal: x.refundTotal,
    cashRefund: x.cashRefund,
    cardRefund: x.cardRefund,
    expectedCash,
    countedCash: normalizedCountedCash,
    difference,
    transactionCount: x.transactionCount
  };
};

export const closeZReport = (input: CloseZReportInput): CloseZReportResult => {
  const preview = getZReportPreview(input.tenantId, input.date, input.openingCash, input.countedCash);
  const db = getDatabase();
  const now = new Date().toISOString();
  const reportId = crypto.randomUUID();

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
    VALUES (
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
    reportDate: input.date,
    openingCash: preview.openingCash,
    cashSales: preview.cashSales,
    cardSales: preview.cardSales,
    refundTotal: preview.refundTotal,
    cashRefund: preview.cashRefund,
    cardRefund: preview.cardRefund,
    expectedCash: preview.expectedCash,
    countedCash: preview.countedCash,
    difference: preview.difference,
    createdAt: now
  });

  appendLocalAuditLog({
    tenantId: input.tenantId,
    branchId: input.branchId,
    deviceId: input.deviceId,
    actorEmail: input.cashierUserId,
    actorName: input.cashierName,
    eventType: "z_report_closed",
    message: "Gun sonu raporu lokal olarak olusturuldu.",
    payload: {
      reportId,
      date: input.date,
      countedCash: preview.countedCash,
      difference: preview.difference
    }
  });

  return {
    reportId,
    preview,
    receiptText: renderZReportText(preview, input.cashierName, reportId)
  };
};

export const renderXReportText = (report: XReportSummary): string => {
  const lines: string[] = [];
  lines.push("LOOMAPOS");
  lines.push("X RAPORU");
  lines.push(`Tarih: ${report.date}`);
  lines.push("--------------------------------");
  lines.push(`Toplam Satis : ${report.totalSales.toFixed(2)} TL`);
  lines.push(`Nakit        : ${report.cashSales.toFixed(2)} TL`);
  lines.push(`Kart         : ${report.cardSales.toFixed(2)} TL`);
  lines.push(`Toplam Islem : ${report.transactionCount}`);
  lines.push(`Iade         : ${report.refundTotal.toFixed(2)} TL`);
  lines.push("--------------------------------");
  return lines.join("\n");
};

export const renderZReportText = (
  report: ZReportPreview,
  cashierName: string,
  reportId: string
): string => {
  const lines: string[] = [];
  lines.push("LOOMAPOS");
  lines.push("Z RAPORU");
  lines.push(`Tarih: ${report.date}`);
  lines.push(`Kasiyer: ${cashierName}`);
  lines.push("--------------------------------");
  lines.push(`Acilis      : ${report.openingCash.toFixed(2)} TL`);
  lines.push(`Nakit Satis : ${report.cashSales.toFixed(2)} TL`);
  lines.push(`Kart Satis  : ${report.cardSales.toFixed(2)} TL`);
  lines.push(`Iade        : ${report.refundTotal.toFixed(2)} TL`);
  lines.push(`Beklenen    : ${report.expectedCash.toFixed(2)} TL`);
  lines.push(`Girilen     : ${report.countedCash.toFixed(2)} TL`);
  lines.push(`Fark        : ${report.difference.toFixed(2)} TL`);
  lines.push("--------------------------------");
  lines.push(`Rapor Id: ${reportId}`);
  return lines.join("\n");
};

interface ReceiptModel {
  saleId: string;
  receiptNo: string;
  createdAt: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  lines: Array<{
    productName: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}

const resolveSourceSale = (
  tenantId: string,
  sourceSaleId?: string | null,
  sourceReceiptNo?: string | null
): { saleId: string; receiptNo: string } | null => {
  const db = getDatabase();

  if (sourceSaleId) {
    const byId = db
      .prepare(`
        SELECT
          local_sale_id AS saleId,
          receipt_no_local AS receiptNo
        FROM local_sales
        WHERE tenant_id = @tenantId AND local_sale_id = @saleId
        LIMIT 1
      `)
      .get({ tenantId, saleId: sourceSaleId }) as
      | { saleId: string; receiptNo: string }
      | undefined;

    if (byId) {
      return byId;
    }
  }

  if (sourceReceiptNo) {
    const byReceipt = db
      .prepare(`
        SELECT
          local_sale_id AS saleId,
          receipt_no_local AS receiptNo
        FROM local_sales
        WHERE tenant_id = @tenantId AND receipt_no_local = @receiptNo
        ORDER BY created_at DESC
        LIMIT 1
      `)
      .get({ tenantId, receiptNo: sourceReceiptNo }) as
      | { saleId: string; receiptNo: string }
      | undefined;

    if (byReceipt) {
      return byReceipt;
    }
  }

  return null;
};

const getFirstPaymentMethodForSale = (saleId: string | null): PaymentMethod | null => {
  if (!saleId) {
    return null;
  }

  const db = getDatabase();
  const row = db
    .prepare(`
      SELECT method
      FROM local_payments
      WHERE local_sale_id = @saleId
      ORDER BY created_at ASC
      LIMIT 1
    `)
    .get({ saleId }) as { method: string } | undefined;

  if (!row) {
    return null;
  }

  return parsePaymentMethod(row.method);
};

const parsePaymentMethod = (value: string | null | undefined): PaymentMethod =>
  value?.toUpperCase() === "CARD" ? "CARD" : "CASH";

const getDayRange = (date: string) => {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  return {
    dayStartIso: dayStart.toISOString(),
    dayEndIso: dayEnd.toISOString()
  };
};

const generateReceiptNo = (): string => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hours = String(now.getUTCHours()).padStart(2, "0");
  const minutes = String(now.getUTCMinutes()).padStart(2, "0");
  const seconds = String(now.getUTCSeconds()).padStart(2, "0");
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `${year}${month}${day}-${hours}${minutes}${seconds}-${suffix}`;
};

const generateRefundReceiptNo = (): string => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hours = String(now.getUTCHours()).padStart(2, "0");
  const minutes = String(now.getUTCMinutes()).padStart(2, "0");
  const seconds = String(now.getUTCSeconds()).padStart(2, "0");
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `RFD-${year}${month}${day}-${hours}${minutes}${seconds}-${suffix}`;
};

const round2 = (value: number) => Math.round(value * 100) / 100;
