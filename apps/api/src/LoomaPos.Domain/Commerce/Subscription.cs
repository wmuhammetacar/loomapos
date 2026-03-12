using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class Subscription : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BillingProfileId { get; set; }
    public string PlanCode { get; set; } = "starter";
    public string BillingCycle { get; set; } = "monthly";
    public string Status { get; set; } = "active";
    public DateTimeOffset CurrentPeriodStart { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset CurrentPeriodEnd { get; set; } = DateTimeOffset.UtcNow.AddMonths(1);
    public DateTimeOffset RenewalDate { get; set; } = DateTimeOffset.UtcNow.AddMonths(1);
    public bool CancelAtPeriodEnd { get; set; }
    public DateTimeOffset? TrialEndsAt { get; set; }
    public DateTimeOffset? GraceEndsAt { get; set; }
    public DateTimeOffset? CanceledAt { get; set; }
    public string? ProviderSubscriptionId { get; set; }
    public string? ProviderCustomerReference { get; set; }
    public string PlanSnapshotJson { get; set; } = "{}";
    public string? ResellerCode { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
