using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class AppRelease : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Platform { get; set; } = string.Empty;
    public string Channel { get; set; } = "stable";
    public string Version { get; set; } = string.Empty;
    public DateOnly ReleaseDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public string ReleaseNotesMarkdown { get; set; } = string.Empty;
    public string InstallGuideMarkdown { get; set; } = string.Empty;
    public string MinimumRequirements { get; set; } = string.Empty;
    public bool IsPublic { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
