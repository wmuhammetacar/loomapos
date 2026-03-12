using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class DownloadAccess : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid DownloadableAssetId { get; set; }
    public Guid? SubscriptionId { get; set; }
    public Guid? LicenseId { get; set; }
    public string Status { get; set; } = "active";
    public DateTimeOffset? ExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
