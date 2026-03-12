namespace LoomaPos.Infrastructure.Integration;

public interface IFiscalProvider
{
    Task<IntegrationDispatchResult> SendAsync(FiscalDispatchRequest request, CancellationToken cancellationToken);
}

public sealed record FiscalDispatchRequest(
    Guid TenantId,
    string Provider,
    string ReceiptNo,
    string PayloadJson);
