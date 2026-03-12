namespace LoomaPos.Application.Sync;

public interface ISyncEventProcessor
{
    Task<SyncEventResult> ProcessAsync(SyncEventRequest request, CancellationToken cancellationToken);
}
