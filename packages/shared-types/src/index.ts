export type PaymentMethod = "CASH" | "CARD";

export interface SyncEventEnvelope<TPayload> {
  eventId: string;
  tenantId: string;
  branchId: string;
  deviceId: string;
  eventType: string;
  payload: TPayload;
}

export interface ProductDto {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unit: string;
  taxRate: number;
  isActive: boolean;
}

export interface SaleLineDto {
  productId: string;
  qty: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotal: number;
}

export interface SaleCreatedPayload {
  saleId: string;
  receiptNo: string;
  createdAt: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  lines: SaleLineDto[];
  payments: Array<{ method: PaymentMethod; amount: number }>;
}

export * from "./generated/api-client";
export * from "./generated/public-api-client";
