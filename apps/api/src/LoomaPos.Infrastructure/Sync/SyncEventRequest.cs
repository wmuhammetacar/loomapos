using System.Text.Json;

namespace LoomaPos.Infrastructure.Sync;

public sealed record SyncEventRequest(
    Guid EventId,
    Guid TenantId,
    Guid BranchId,
    Guid DeviceId,
    string EventType,
    JsonElement Payload,
    string? AggregateType = null,
    string? AggregateId = null,
    int PayloadVersion = 1);
