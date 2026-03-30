namespace LoomaPos.Domain.Manufacturing;

public static class ProductionOrderStatuses
{
    public const string Draft = "draft";
    public const string Planned = "planned";
    public const string Canceled = "canceled";

    public static readonly string[] All =
    [
        Draft,
        Planned,
        Canceled
    ];
}
