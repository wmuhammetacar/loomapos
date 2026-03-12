using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class PlanFeatureFlag : ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SubscriptionPlanId { get; set; }
    public Guid FeatureFlagId { get; set; }
    public bool IsEnabled { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
