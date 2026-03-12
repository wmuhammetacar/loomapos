using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class LicenseEvent : ITenantEntity, ICreatedAtEntity
{
    public long Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid LicenseId { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
