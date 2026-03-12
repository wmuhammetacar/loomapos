using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class PlanPrice : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SubscriptionPlanId { get; set; }
    public string BillingPeriod { get; set; } = "monthly";
    public string Currency { get; set; } = "TRY";
    public decimal Amount { get; set; }
    public decimal? PromoAmount { get; set; }
    public string? ExternalPriceId { get; set; }
    public int TrialDays { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
