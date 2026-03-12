namespace LoomaPos.Application.Sync;

public sealed record SyncEventResult(bool AlreadyProcessed, string Message);
