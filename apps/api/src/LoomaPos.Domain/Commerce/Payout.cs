namespace LoomaPos.Domain.Commerce;

public sealed class Payout
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ResellerId { get; set; }
    public DateTimeOffset PeriodStart { get; set; }
    public DateTimeOffset PeriodEnd { get; set; }
    public decimal Total { get; set; }
    public string Status { get; set; } = "pending";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? PaidAt { get; set; }
}

