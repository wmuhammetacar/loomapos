namespace LoomaPos.Infrastructure.Integration;

public sealed class MockEInvoiceProvider : IEInvoiceProvider
{
    public Task<IntegrationDispatchResult> SendAsync(EInvoiceDispatchRequest request, CancellationToken cancellationToken)
    {
        var result = new IntegrationDispatchResult(
            "queued",
            $"mock-einv-{Guid.NewGuid():N}",
            $"{request.Provider} mock adapter queued document {request.DocumentNo}.");
        return Task.FromResult(result);
    }
}
