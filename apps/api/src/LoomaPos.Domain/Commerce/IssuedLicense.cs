using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class IssuedLicense : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid SubscriptionId { get; set; }
    public string PlanCode { get; set; } = "starter";
    public string LicenseKey { get; set; } = string.Empty;
    public string LicenseToken { get; set; } = string.Empty;
    public string Signature { get; set; } = string.Empty;
    public string FeaturesJson { get; set; } = "[]";
    public int? DeviceLimit { get; set; }
    public DateTimeOffset IssuedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; } = DateTimeOffset.UtcNow.AddMonths(1);
    public int GraceDays { get; set; } = 7;
    public string Status { get; set; } = "active";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
