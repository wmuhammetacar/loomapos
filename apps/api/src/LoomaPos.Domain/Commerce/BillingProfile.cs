using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class BillingProfile : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? CustomerAccountId { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public string BillingEmail { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? TaxOffice { get; set; }
    public string? TaxNumber { get; set; }
    public string? AddressLine { get; set; }
    public string? City { get; set; }
    public string Country { get; set; } = "TR";
    public string Locale { get; set; } = "tr-TR";
    public string Status { get; set; } = "active";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
