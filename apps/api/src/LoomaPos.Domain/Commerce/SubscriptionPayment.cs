using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class SubscriptionPayment : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid SubscriptionId { get; set; }
    public Guid InvoiceId { get; set; }
    public string Provider { get; set; } = "mock";
    public string PaymentRef { get; set; } = string.Empty;
    public string Status { get; set; } = "paid";
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "TRY";
    public DateTimeOffset? PaidAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
