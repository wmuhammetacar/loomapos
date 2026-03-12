using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class SubscriptionPlan : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int? BranchLimit { get; set; }
    public int? UserLimit { get; set; }
    public int? DeviceLimit { get; set; }
    public string SupportTier { get; set; } = "standard";
    public bool ResellerCommissionEligibility { get; set; }
    public bool IsPublic { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public string HighlightLabel { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
