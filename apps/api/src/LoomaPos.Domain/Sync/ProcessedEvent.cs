namespace LoomaPos.Domain.Sync;

public sealed class ProcessedEvent
{
    public Guid EventId { get; set; }
    public Guid TenantId { get; set; }
    public Guid DeviceId { get; set; }
    public DateTimeOffset ProcessedAt { get; set; } = DateTimeOffset.UtcNow;
}
