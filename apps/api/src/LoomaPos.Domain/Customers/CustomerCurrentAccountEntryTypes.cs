namespace LoomaPos.Domain.Customers;

public static class CustomerCurrentAccountEntryTypes
{
    public const string SaleCharge = "sale_charge";
    public const string Collection = "collection";
    public const string Adjustment = "adjustment";
    public const string RefundCredit = "refund_credit";

    public static readonly string[] All =
    [
        SaleCharge,
        Collection,
        Adjustment,
        RefundCredit
    ];
}
