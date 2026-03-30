namespace LoomaPos.Domain.Accounting;

public static class AccountingBridgeSourceTypes
{
    public const string Sale = "sale";
    public const string SaleReversal = "sale_reversal";
    public const string CashMovement = "cash_movement";
    public const string PurchaseReceipt = "purchase_receipt";
    public const string CustomerCollection = "customer_collection";
    public const string CustomerAccountAdjustment = "customer_account_adjustment";

    public static readonly string[] All =
    [
        Sale,
        SaleReversal,
        CashMovement,
        PurchaseReceipt,
        CustomerCollection,
        CustomerAccountAdjustment
    ];
}
