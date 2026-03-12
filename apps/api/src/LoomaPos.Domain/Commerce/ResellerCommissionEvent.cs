using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class ResellerCommissionEvent : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ResellerAccountId { get; set; }
    public Guid? SubscriptionId { get; set; }
    public Guid? InvoiceId { get; set; }
    public decimal Rate { get; set; }
    public decimal Amount { get; set; }
    public string Status { get; set; } = "accrued";
    public DateTimeOffset EventAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
