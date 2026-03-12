using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class Commission : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ResellerId { get; set; }
    public Guid SubscriptionId { get; set; }
    public Guid InvoiceId { get; set; }
    public decimal Rate { get; set; }
    public decimal Amount { get; set; }
    public string Status { get; set; } = "accrued";
    public DateTimeOffset AccruedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? PaidAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
