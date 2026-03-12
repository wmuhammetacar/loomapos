using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class ResellerReferral : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ResellerAccountId { get; set; }
    public Guid CheckoutSessionId { get; set; }
    public Guid? TenantId { get; set; }
    public string ReferralCode { get; set; } = string.Empty;
    public string Status { get; set; } = "attached";
    public bool CommissionEligible { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
