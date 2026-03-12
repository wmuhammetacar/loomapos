namespace LoomaPos.Infrastructure.Integration;

public sealed class MockFiscalProvider : IFiscalProvider
{
    public Task<IntegrationDispatchResult> SendAsync(FiscalDispatchRequest request, CancellationToken cancellationToken)
    {
        var result = new IntegrationDispatchResult(
            "queued",
            $"mock-fiscal-{Guid.NewGuid():N}",
            $"{request.Provider} mock adapter queued receipt {request.ReceiptNo}.");
        return Task.FromResult(result);
    }
}
