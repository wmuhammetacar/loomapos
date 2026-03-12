namespace LoomaPos.Infrastructure.Integration;

public interface IEInvoiceProvider
{
    Task<IntegrationDispatchResult> SendAsync(EInvoiceDispatchRequest request, CancellationToken cancellationToken);
}

public sealed record EInvoiceDispatchRequest(
    Guid TenantId,
    string Provider,
    string DocumentNo,
    string PayloadJson);

public sealed record IntegrationDispatchResult(
    string Status,
    string ProviderRef,
    string Message);
