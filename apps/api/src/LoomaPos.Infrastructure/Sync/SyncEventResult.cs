namespace LoomaPos.Infrastructure.Sync;

public sealed record SyncEventResult(
    string Status,
    bool AlreadyProcessed,
    string Message,
    string? ErrorCode = null,
    string? ServerReferenceId = null);
