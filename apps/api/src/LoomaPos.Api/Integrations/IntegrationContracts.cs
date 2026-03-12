namespace LoomaPos.Api.Integrations;

public sealed record IntegrationProviderCatalogItemDto(
    string Domain,
    string ProviderCode,
    string DisplayName,
    string Description,
    IReadOnlyList<string> SupportedModes,
    IReadOnlyList<string> SupportedCapabilities);

public sealed record IntegrationConnectionDto(
    Guid Id,
    string Domain,
    string ProviderCode,
    string DisplayName,
    string Status,
    bool Enabled,
    string Mode,
    string HealthState,
    string SyncMode,
    DateTimeOffset? LastSuccessAt,
    DateTimeOffset? LastErrorAt,
    DateTimeOffset? LastValidatedAt,
    IReadOnlyList<string> MappingWarnings,
    int PendingJobs,
    int DeadLetters,
    string ConfigurationState);

public sealed record IntegrationWebhookDto(
    Guid Id,
    string Name,
    string TargetUrl,
    string Status,
    bool Enabled,
    string PayloadVersion,
    string SecretMask,
    IReadOnlyList<string> Topics,
    DateTimeOffset? LastSuccessAt,
    DateTimeOffset? LastFailureAt);

public sealed record IntegrationApiClientDto(
    Guid Id,
    string Name,
    string ClientType,
    string Status,
    string Environment,
    string? ContactEmail,
    IReadOnlyList<string> Scopes,
    IReadOnlyList<string> Keys,
    DateTimeOffset? LastUsedAt,
    DateTimeOffset CreatedAt);

public sealed record IntegrationJobDto(
    Guid Id,
    Guid? ConnectionId,
    string JobType,
    string Status,
    string IdempotencyKey,
    string CorrelationId,
    string? BusinessObjectType,
    string? BusinessObjectId,
    int RetryCount,
    int MaxRetryCount,
    DateTimeOffset? NextRetryAt,
    DateTimeOffset? LastAttemptAt,
    string? ErrorCode,
    string? ErrorMessage,
    DateTimeOffset CreatedAt);

public sealed record IntegrationFailureDto(
    Guid Id,
    Guid? ConnectionId,
    string FailureType,
    string Severity,
    string Status,
    string Summary,
    string Detail,
    DateTimeOffset CreatedAt,
    DateTimeOffset? LastSeenAt);

public sealed record IntegrationProviderEventDto(
    Guid Id,
    Guid? TenantId,
    Guid? ConnectionId,
    string ProviderCode,
    string EventKey,
    string EventType,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ProcessedAt,
    string? ErrorMessage);

public sealed record TenantIntegrationWorkspaceDto(
    IReadOnlyList<IntegrationProviderCatalogItemDto> Catalog,
    IReadOnlyList<IntegrationConnectionDto> Connections,
    IReadOnlyList<IntegrationWebhookDto> Webhooks,
    IReadOnlyList<IntegrationApiClientDto> ApiClients,
    IReadOnlyList<IntegrationJobDto> RecentJobs,
    IReadOnlyList<IntegrationFailureDto> RecentFailures,
    IReadOnlyList<string> Notices);

public sealed record AdminIntegrationOverviewDto(
    int ActiveConnections,
    int UnhealthyConnections,
    int PendingJobs,
    int FailedJobs,
    int DeadLetters,
    int WebhookFailures,
    int MappingIssues,
    int ExpiredCredentials,
    int PublicApiClients);

public sealed record AdminTenantIntegrationSummaryDto(
    Guid TenantId,
    string CompanyName,
    int ConnectionCount,
    int UnhealthyConnections,
    int PendingJobs,
    int FailedJobs,
    DateTimeOffset? LastSuccessAt,
    string WorstHealthState);

public sealed record AdminIntegrationWorkspaceDto(
    AdminIntegrationOverviewDto Overview,
    IReadOnlyList<AdminTenantIntegrationSummaryDto> TenantSummaries,
    IReadOnlyList<IntegrationConnectionDto> Connections,
    IReadOnlyList<IntegrationJobDto> Jobs,
    IReadOnlyList<IntegrationFailureDto> Failures,
    IReadOnlyList<IntegrationProviderEventDto> ProviderEvents,
    IReadOnlyList<IntegrationWebhookDto> Webhooks,
    IReadOnlyList<string> Incidents);

public sealed record SaveIntegrationConnectionRequest(
    string Domain,
    string ProviderCode,
    string DisplayName,
    string Mode,
    string SyncMode,
    bool Enabled,
    IDictionary<string, string> Secrets,
    IDictionary<string, string> Settings,
    IDictionary<string, string> RequiredMappings);

public sealed record UpdateIntegrationConnectionRequest(
    string? DisplayName,
    string? Mode,
    string? SyncMode,
    bool? Enabled,
    IDictionary<string, string>? Secrets,
    IDictionary<string, string>? Settings,
    IDictionary<string, string>? RequiredMappings);

public sealed record CreateWebhookEndpointRequest(
    string Name,
    string TargetUrl,
    IReadOnlyList<string> Topics,
    bool Enabled);

public sealed record CreateApiClientRequest(
    string Name,
    string ClientType,
    string Environment,
    string? ContactEmail,
    IReadOnlyList<string> Scopes,
    DateTimeOffset? ExpiresAt);

public sealed record AdminReasonRequest(string Reason);

public sealed record ReplayDeadLetterRequest(
    Guid? TenantId,
    int? MaxCount,
    string Reason);

public sealed record IntegrationMappingPreviewRequest(
    string AggregateType,
    string EventType,
    IDictionary<string, string> SourceFields);

public sealed record IntegrationMappingPreviewDto(
    Guid ConnectionId,
    string Domain,
    string ProviderCode,
    string AggregateType,
    string EventType,
    IReadOnlyDictionary<string, string> SourceFields,
    IReadOnlyDictionary<string, string> AppliedMappings,
    IReadOnlyDictionary<string, string> TransformedFields,
    IReadOnlyList<string> Warnings,
    bool ReadyToSubmit,
    DateTimeOffset GeneratedAt);
