using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class ResellerCustomerLink : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ResellerAccountId { get; set; }
    public Guid CustomerAccountId { get; set; }
    public Guid? SubscriptionId { get; set; }
    public string ReferralCode { get; set; } = string.Empty;
    public DateTimeOffset LinkedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
