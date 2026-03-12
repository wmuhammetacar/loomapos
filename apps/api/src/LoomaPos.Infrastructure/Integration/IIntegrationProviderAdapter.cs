namespace LoomaPos.Infrastructure.Integration;

public interface IIntegrationProviderAdapter
{
    string Domain { get; }
    string ProviderCode { get; }
    string DisplayName { get; }
    IReadOnlyList<string> SupportedModes { get; }
    IReadOnlyList<string> SupportedCapabilities { get; }

    Task<ProviderConnectionValidationResult> ValidateCredentialsAsync(
        ProviderCredentialContext credentialContext,
        CancellationToken cancellationToken);

    Task<ProviderAccountInfo> FetchAccountInfoAsync(
        ProviderCredentialContext credentialContext,
        CancellationToken cancellationToken);

    Task<ProviderSubmissionResult> SubmitRecordAsync(
        ProviderSubmissionRequest request,
        CancellationToken cancellationToken);

    Task<ProviderStatusResult> FetchStatusAsync(
        ProviderStatusRequest request,
        CancellationToken cancellationToken);

    Task<ProviderWebhookResult> ReceiveWebhookAsync(
        ProviderWebhookRequest request,
        CancellationToken cancellationToken);

    Task<ProviderHealthResult> HealthCheckAsync(
        ProviderCredentialContext credentialContext,
        CancellationToken cancellationToken);
}

public sealed record ProviderCredentialContext(
    Guid TenantId,
    string ProviderCode,
    string Mode,
    IReadOnlyDictionary<string, string> Secrets,
    IReadOnlyDictionary<string, string> Settings);

public sealed record ProviderSubmissionRequest(
    Guid TenantId,
    string Domain,
    string ProviderCode,
    string IdempotencyKey,
    string RecordType,
    string ExternalReference,
    string PayloadJson);

public sealed record ProviderStatusRequest(
    Guid TenantId,
    string ProviderCode,
    string ExternalReference,
    string RecordType);

public sealed record ProviderWebhookRequest(
    string ProviderCode,
    string EventKey,
    string EventType,
    string Signature,
    string PayloadJson);

public sealed record ProviderConnectionValidationResult(
    bool IsValid,
    string Status,
    string Message,
    string? AccountReference = null);

public sealed record ProviderAccountInfo(
    string AccountReference,
    string DisplayName,
    string Environment,
    IReadOnlyDictionary<string, string>? Metadata = null);

public sealed record ProviderSubmissionResult(
    string Status,
    string ProviderReference,
    string Message,
    string? PayloadJson = null);

public sealed record ProviderStatusResult(
    string Status,
    string? ProviderReference,
    string Message,
    string? PayloadJson = null);

public sealed record ProviderWebhookResult(
    bool Accepted,
    string Status,
    string Message,
    string? TenantHint = null,
    string? ProviderReference = null);

public sealed record ProviderHealthResult(
    string HealthState,
    string Message,
    DateTimeOffset CheckedAt);
