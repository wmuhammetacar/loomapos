using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class Invoice : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid SubscriptionId { get; set; }
    public Guid? BillingProfileId { get; set; }
    public string InvoiceNo { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Subtotal { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal Total { get; set; }
    public string Currency { get; set; } = "TRY";
    public string Status { get; set; } = "paid";
    public DateTimeOffset IssuedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? DueAt { get; set; }
    public DateTimeOffset? PaidAt { get; set; }
    public DateTimeOffset? BillingPeriodStart { get; set; }
    public DateTimeOffset? BillingPeriodEnd { get; set; }
    public string? ProviderInvoiceReference { get; set; }
    public string? PdfUrl { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
