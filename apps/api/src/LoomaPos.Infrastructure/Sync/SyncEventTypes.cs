namespace LoomaPos.Infrastructure.Sync;

public static class SyncEventTypes
{
    public const string SaleCreated = "SALE_CREATED";
    public const string SaleVoided = "SALE_VOIDED";
    public const string SaleRefundCreated = "SALE_REFUND_CREATED";
    public const string StockAdjusted = "STOCK_ADJUSTMENT_RECORDED";
    public const string PaymentAdded = "SALE_PAYMENT_RECORDED";
    public const string CashSessionOpened = "CASH_SESSION_OPENED";
    public const string CashSessionClosed = "CASH_SESSION_CLOSED";
    public const string CashAdjustmentRecorded = "CASH_ADJUSTMENT_RECORDED";
    public const string DeviceHeartbeat = "DEVICE_HEARTBEAT";
    public const string UserSessionStarted = "USER_SESSION_STARTED";
    public const string UserSessionEnded = "USER_SESSION_ENDED";
    public const string StockCountSubmitted = "STOCK_COUNT_SUBMITTED";
    public const string ProductCreated = "PRODUCT_CREATED";
    public const string ProductUpdated = "PRODUCT_UPDATED";
    public const string MobileDeviceHeartbeat = "MOBILE_DEVICE_HEARTBEAT";
    public const string MobileSessionStarted = "MOBILE_SESSION_STARTED";
    public const string MobileSessionEnded = "MOBILE_SESSION_ENDED";
}
