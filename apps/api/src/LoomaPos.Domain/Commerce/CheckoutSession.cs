using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class CheckoutSession : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? CustomerAccountId { get; set; }
    public Guid? TenantId { get; set; }
    public Guid? SubscriptionId { get; set; }
    public Guid? BillingProfileId { get; set; }
    public Guid? LicenseId { get; set; }
    public string CheckoutReference { get; set; } = Guid.NewGuid().ToString("N");
    public string CompanyName { get; set; } = string.Empty;
    public string ContactName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string PlanCode { get; set; } = "starter";
    public string BillingCycle { get; set; } = "monthly";
    public string Provider { get; set; } = "mock";
    public string? ProviderSessionId { get; set; }
    public string? ProviderPaymentReference { get; set; }
    public string? ResellerCode { get; set; }
    public string? CouponCode { get; set; }
    public decimal Amount { get; set; }
    public decimal TaxAmount { get; set; }
    public string Currency { get; set; } = "TRY";
    public string Status { get; set; } = "created";
    public string PaymentStatus { get; set; } = "pending";
    public string CheckoutPayloadJson { get; set; } = "{}";
    public string BillingPayloadJson { get; set; } = "{}";
    public string? IdempotencyKey { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset? ProvisionedAt { get; set; }
    public string? Error { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
