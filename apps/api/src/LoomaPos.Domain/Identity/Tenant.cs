using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Identity;

public sealed class Tenant : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string TenantCode { get; set; } = string.Empty;
    public string BillingEmail { get; set; } = string.Empty;
    public string? TaxOffice { get; set; }
    public string? TaxNumber { get; set; }
    public string Country { get; set; } = "TR";
    public string DefaultLocale { get; set; } = "tr-TR";
    public string Status { get; set; } = "active";
    public string? SettingsJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
