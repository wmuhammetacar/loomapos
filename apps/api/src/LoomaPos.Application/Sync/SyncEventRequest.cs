using System.Text.Json;

namespace LoomaPos.Application.Sync;

public sealed record SyncEventRequest(
    Guid EventId,
    Guid TenantId,
    Guid BranchId,
    Guid DeviceId,
    string EventType,
    JsonElement Payload);
