using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class PaymentTransaction : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? SubscriptionId { get; set; }
    public Guid? InvoiceId { get; set; }
    public Guid? CheckoutSessionId { get; set; }
    public string Provider { get; set; } = "mock";
    public string ProviderPaymentId { get; set; } = string.Empty;
    public string? ProviderCustomerReference { get; set; }
    public decimal Amount { get; set; }
    public decimal TaxAmount { get; set; }
    public string Currency { get; set; } = "TRY";
    public string Status { get; set; } = "pending";
    public string PaymentMethodSummary { get; set; } = "card";
    public string MetadataJson { get; set; } = "{}";
    public DateTimeOffset? PaidAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
