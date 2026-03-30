namespace LoomaPos.Domain.Accounting;

public static class AccountingBridgeStatuses
{
    public const string Pending = "pending";
    public const string Exported = "exported";
    public const string Failed = "failed";

    public static readonly string[] All =
    [
        Pending,
        Exported,
        Failed
    ];
}
