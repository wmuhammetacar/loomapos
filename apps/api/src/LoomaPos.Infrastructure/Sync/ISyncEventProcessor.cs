namespace LoomaPos.Infrastructure.Sync;

public interface ISyncEventProcessor
{
    Task<SyncEventResult> ProcessAsync(SyncEventRequest request, CancellationToken cancellationToken);
    Task<IReadOnlyList<SyncEventResult>> ProcessBatchAsync(IEnumerable<SyncEventRequest> requests, CancellationToken cancellationToken);
}
