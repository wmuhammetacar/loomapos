using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class DownloadableAsset : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AppReleaseId { get; set; }
    public string Label { get; set; } = string.Empty;
    public string Platform { get; set; } = string.Empty;
    public string Visibility { get; set; } = "portal";
    public string DownloadUrl { get; set; } = string.Empty;
    public string Checksum { get; set; } = string.Empty;
    public bool RequiresActiveLicense { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
