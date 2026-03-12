using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class EmailNotification : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? CustomerAccountId { get; set; }
    public string EventCode { get; set; } = string.Empty;
    public string ToEmail { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string BodyMarkdown { get; set; } = string.Empty;
    public string Status { get; set; } = "queued";
    public DateTimeOffset? SentAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
