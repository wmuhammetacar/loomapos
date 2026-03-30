using LoomaPos.Domain.Common;

namespace LoomaPos.Infrastructure.Sync;

internal sealed record SaleCreatedPayload(
    Guid SaleId,
    string ReceiptNo,
    DateTimeOffset CreatedAt,
    decimal Subtotal,
    decimal Discount,
    decimal Tax,
    decimal Total,
    IReadOnlyList<SaleCreatedLinePayload> Lines,
    IReadOnlyList<SaleCreatedPaymentPayload> Payments);

internal sealed record SaleCreatedLinePayload(
    Guid ProductId,
    decimal Qty,
    decimal UnitPrice,
    decimal Discount,
    decimal Tax,
    decimal LineTotal);

internal sealed record SaleCreatedPaymentPayload(
    PaymentMethod Method,
    decimal Amount);

internal sealed record SaleVoidedPayload(
    Guid SaleId,
    string? Reason);

internal sealed record SaleRefundCreatedPayload(
    Guid RefundSaleId,
    Guid? SourceSaleId,
    string? SourceReceiptNo,
    string ReceiptNo,
    DateTimeOffset CreatedAt,
    decimal Subtotal,
    decimal Discount,
    decimal Tax,
    decimal Total,
    IReadOnlyList<SaleRefundCreatedLinePayload> Lines,
    IReadOnlyList<SaleCreatedPaymentPayload> Payments);

internal sealed record SaleRefundCreatedLinePayload(
    Guid ProductId,
    decimal Qty,
    decimal UnitPrice,
    decimal Discount,
    decimal Tax,
    decimal LineTotal);

internal sealed record StockAdjustedPayload(
    Guid ProductId,
    decimal QtyDelta,
    string? Reason,
    string? ReasonCode = null,
    Guid? WarehouseId = null);

internal sealed record PaymentAddedPayload(
    Guid SaleId,
    PaymentMethod Method,
    decimal Amount);

internal sealed record CashAdjustmentRecordedPayload(
    string Type,
    decimal Amount,
    string Reason);

internal sealed record StockCountSubmittedPayload(
    Guid StockCountSessionId,
    Guid BranchId,
    string CountType,
    string Label,
    string StartedBy,
    DateTimeOffset StartedAt,
    DateTimeOffset SubmittedAt,
    string? Notes,
    IReadOnlyList<StockCountSubmittedLinePayload> Lines);

internal sealed record StockCountSubmittedLinePayload(
    Guid LineId,
    Guid ProductId,
    Guid? VariantId,
    string? BarcodeSnapshot,
    string ProductNameSnapshot,
    decimal? ExpectedQtySnapshot,
    decimal CountedQty,
    decimal? DeltaQty,
    string? Note);

internal sealed record MobileProductMutationPayload(
    Guid? ProductId,
    string Name,
    string? Barcode,
    string? Sku,
    string? CategoryName,
    decimal SalePrice,
    decimal PurchasePrice,
    decimal TaxRate,
    bool StockTracked,
    decimal MinStock,
    bool IsActive,
    decimal StockQty,
    Guid? BranchId);
