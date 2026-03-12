using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Integrations;

public sealed class IntegrationConnection : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string IntegrationDomain { get; set; } = string.Empty;
    public string ProviderCode { get; set; } = string.Empty;
    public string Status { get; set; } = "draft";
    public bool Enabled { get; set; }
    public string Mode { get; set; } = "sandbox";
    public string HealthState { get; set; } = "pending";
    public string DisplayName { get; set; } = string.Empty;
    public string? EntitlementCode { get; set; }
    public string SyncMode { get; set; } = "async";
    public string CreatedBy { get; set; } = string.Empty;
    public string UpdatedBy { get; set; } = string.Empty;
    public DateTimeOffset? LastSuccessAt { get; set; }
    public DateTimeOffset? LastErrorAt { get; set; }
    public DateTimeOffset? LastValidatedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class IntegrationCredential : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid IntegrationConnectionId { get; set; }
    public string SecretName { get; set; } = string.Empty;
    public string SecretCiphertext { get; set; } = string.Empty;
    public string SecretMask { get; set; } = string.Empty;
    public bool IsValid { get; set; }
    public string Status { get; set; } = "active";
    public string? ValidationError { get; set; }
    public DateTimeOffset? LastValidatedAt { get; set; }
    public DateTimeOffset? LastRotatedAt { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class IntegrationConfig : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid IntegrationConnectionId { get; set; }
    public string ConfigSchemaVersion { get; set; } = "v1";
    public string SyncPolicy { get; set; } = "push_pull";
    public string SyncDirection { get; set; } = "bidirectional";
    public string RetryPolicyJson { get; set; } = "{}";
    public string MappingPolicyJson { get; set; } = "{}";
    public string FeatureEntitlementsJson { get; set; } = "[]";
    public string SettingsJson { get; set; } = "{}";
    public bool TestModeEnabled { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class IntegrationMapping : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid IntegrationConnectionId { get; set; }
    public string MappingType { get; set; } = string.Empty;
    public string SourceValue { get; set; } = string.Empty;
    public string TargetValue { get; set; } = string.Empty;
    public string Direction { get; set; } = "outbound";
    public string Status { get; set; } = "complete";
    public bool IsDefault { get; set; }
    public string? Warning { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class IntegrationJob : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? IntegrationConnectionId { get; set; }
    public Guid? IntegrationEventId { get; set; }
    public string JobType { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
    public string IdempotencyKey { get; set; } = string.Empty;
    public string CorrelationId { get; set; } = Guid.NewGuid().ToString("N");
    public string? BusinessObjectType { get; set; }
    public string? BusinessObjectId { get; set; }
    public string PayloadJson { get; set; } = "{}";
    public int RetryCount { get; set; }
    public int MaxRetryCount { get; set; } = 5;
    public DateTimeOffset? NextRetryAt { get; set; }
    public DateTimeOffset? LastAttemptAt { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class IntegrationJobAttempt : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid IntegrationJobId { get; set; }
    public int AttemptNo { get; set; }
    public string Status { get; set; } = "pending";
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public int DurationMs { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class IntegrationEvent : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? IntegrationConnectionId { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string AggregateType { get; set; } = string.Empty;
    public string AggregateId { get; set; } = string.Empty;
    public string PayloadVersion { get; set; } = "v1";
    public string PayloadJson { get; set; } = "{}";
    public string Status { get; set; } = "pending";
    public string IdempotencyKey { get; set; } = string.Empty;
    public DateTimeOffset? ProcessedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class IntegrationLog : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? IntegrationConnectionId { get; set; }
    public Guid? IntegrationJobId { get; set; }
    public string Level { get; set; } = "info";
    public string Message { get; set; } = string.Empty;
    public string? DetailJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class IntegrationFailure : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? IntegrationConnectionId { get; set; }
    public Guid? IntegrationJobId { get; set; }
    public string FailureType { get; set; } = string.Empty;
    public string Severity { get; set; } = "warning";
    public string Status { get; set; } = "open";
    public string Summary { get; set; } = string.Empty;
    public string DetailJson { get; set; } = "{}";
    public DateTimeOffset? LastSeenAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class IntegrationHealthSnapshot : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? IntegrationConnectionId { get; set; }
    public string HealthState { get; set; } = "unknown";
    public int PendingJobs { get; set; }
    public int FailedJobs { get; set; }
    public int DeadLetters { get; set; }
    public string? LastErrorSummary { get; set; }
    public DateTimeOffset? LastSuccessAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class IntegrationRateLimitRecord : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? ApiClientId { get; set; }
    public string CounterKey { get; set; } = string.Empty;
    public string WindowCode { get; set; } = "minute";
    public int RequestCount { get; set; }
    public DateTimeOffset WindowStartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class ProviderWebhookEvent : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? IntegrationConnectionId { get; set; }
    public string ProviderCode { get; set; } = string.Empty;
    public string EventKey { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string Signature { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = "{}";
    public string Status { get; set; } = "received";
    public string? ErrorMessage { get; set; }
    public DateTimeOffset? ProcessedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class OutboundWebhookEndpoint : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string TargetUrl { get; set; } = string.Empty;
    public string SecretCiphertext { get; set; } = string.Empty;
    public string SecretMask { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
    public bool Enabled { get; set; } = true;
    public string PayloadVersion { get; set; } = "v1";
    public DateTimeOffset? LastSuccessAt { get; set; }
    public DateTimeOffset? LastFailureAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class OutboundWebhookSubscription : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid OutboundWebhookEndpointId { get; set; }
    public string Topic { get; set; } = string.Empty;
    public bool Enabled { get; set; } = true;
    public string FiltersJson { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class OutboundWebhookDelivery : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid OutboundWebhookEndpointId { get; set; }
    public Guid? IntegrationEventId { get; set; }
    public string Topic { get; set; } = string.Empty;
    public string PayloadVersion { get; set; } = "v1";
    public string PayloadJson { get; set; } = "{}";
    public string Status { get; set; } = "pending";
    public int RetryCount { get; set; }
    public DateTimeOffset? NextRetryAt { get; set; }
    public DateTimeOffset? LastAttemptAt { get; set; }
    public DateTimeOffset? DeliveredAt { get; set; }
    public string? ResponseSummary { get; set; }
    public string Signature { get; set; } = string.Empty;
    public string IdempotencyKey { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class ApiClient : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ClientType { get; set; } = "tenant";
    public string Status { get; set; } = "active";
    public string Environment { get; set; } = "sandbox";
    public string? ContactEmail { get; set; }
    public string AllowedIpRangesJson { get; set; } = "[]";
    public DateTimeOffset? LastUsedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class ApiKey : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ApiClientId { get; set; }
    public string KeyPrefix { get; set; } = string.Empty;
    public string SecretHash { get; set; } = string.Empty;
    public string MaskedKey { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
    public DateTimeOffset? ExpiresAt { get; set; }
    public DateTimeOffset? LastUsedAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class ApiScope : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? ApiClientId { get; set; }
    public string ScopeCode { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsGranted { get; set; } = true;
    public DateTimeOffset? ExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class ApiUsageLog : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? ApiClientId { get; set; }
    public Guid? ApiKeyId { get; set; }
    public string Method { get; set; } = "GET";
    public string Path { get; set; } = string.Empty;
    public string StatusCode { get; set; } = "200";
    public string? ScopeCode { get; set; }
    public int DurationMs { get; set; }
    public string? RequestId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class InvoiceDocument : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string SourceBusinessObjectType { get; set; } = string.Empty;
    public string SourceBusinessObjectId { get; set; } = string.Empty;
    public string DocumentNumber { get; set; } = string.Empty;
    public string? ProviderDocumentNumber { get; set; }
    public string DocumentType { get; set; } = string.Empty;
    public string ProviderCode { get; set; } = string.Empty;
    public string CustomerTaxSnapshotJson { get; set; } = "{}";
    public string TotalsSnapshotJson { get; set; } = "{}";
    public string Currency { get; set; } = "TRY";
    public string Status { get; set; } = "pending";
    public DateTimeOffset? SubmittedAt { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }
    public DateTimeOffset? RejectedAt { get; set; }
    public string? ProviderReference { get; set; }
    public int RetryCount { get; set; }
    public DateTimeOffset? NextRetryAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class InvoiceDocumentLine : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid InvoiceDocumentId { get; set; }
    public string ProductCode { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TaxRate { get; set; }
    public decimal LineTotal { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class InvoiceDocumentStatusHistory : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid InvoiceDocumentId { get; set; }
    public string Status { get; set; } = string.Empty;
    public string DetailJson { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class InvoiceProviderSubmission : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid InvoiceDocumentId { get; set; }
    public string ProviderCode { get; set; } = string.Empty;
    public string RequestPayloadJson { get; set; } = "{}";
    public string ResponsePayloadJson { get; set; } = "{}";
    public string IdempotencyKey { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
    public string? ProviderReference { get; set; }
    public DateTimeOffset? SubmittedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class InvoiceArtifact : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid InvoiceDocumentId { get; set; }
    public string ArtifactType { get; set; } = string.Empty;
    public string StorageReference { get; set; } = string.Empty;
    public string ContentType { get; set; } = "application/octet-stream";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class InvoiceMappingError : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? InvoiceDocumentId { get; set; }
    public string FieldName { get; set; } = string.Empty;
    public string ErrorCode { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Status { get; set; } = "open";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class FiscalDeviceBinding : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? DeviceId { get; set; }
    public string ProviderCode { get; set; } = string.Empty;
    public string TerminalCode { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
    public string Mode { get; set; } = "sandbox";
    public string ConfigJson { get; set; } = "{}";
    public DateTimeOffset? LastSeenAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class FiscalCommandLog : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? FiscalDeviceBindingId { get; set; }
    public string CommandType { get; set; } = string.Empty;
    public string RequestPayloadJson { get; set; } = "{}";
    public string ResponsePayloadJson { get; set; } = "{}";
    public string Status { get; set; } = "pending";
    public string? ErrorMessage { get; set; }
    public DateTimeOffset? ExecutedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class AccountingSyncRecord : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? IntegrationConnectionId { get; set; }
    public string SyncDirection { get; set; } = "export";
    public string RecordType { get; set; } = string.Empty;
    public string InternalReference { get; set; } = string.Empty;
    public string? ExternalReference { get; set; }
    public string Status { get; set; } = "pending";
    public string PayloadJson { get; set; } = "{}";
    public DateTimeOffset? SyncedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class EcommerceSyncRecord : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? IntegrationConnectionId { get; set; }
    public string ChannelCode { get; set; } = string.Empty;
    public string SyncType { get; set; } = string.Empty;
    public string InternalReference { get; set; } = string.Empty;
    public string? ExternalReference { get; set; }
    public string Status { get; set; } = "pending";
    public string PayloadJson { get; set; } = "{}";
    public DateTimeOffset? SyncedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class MessagingDeliveryRecord : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? IntegrationConnectionId { get; set; }
    public string Channel { get; set; } = "email";
    public string ProviderCode { get; set; } = string.Empty;
    public string Recipient { get; set; } = string.Empty;
    public string TemplateCode { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = "{}";
    public string Status { get; set; } = "queued";
    public string? ProviderReference { get; set; }
    public string? FailureReason { get; set; }
    public DateTimeOffset? DeliveredAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class IntegrationArtifact : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? IntegrationConnectionId { get; set; }
    public string ArtifactDomain { get; set; } = string.Empty;
    public string ArtifactType { get; set; } = string.Empty;
    public string StorageReference { get; set; } = string.Empty;
    public string ContentType { get; set; } = "application/octet-stream";
    public string MetadataJson { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class IntegrationAuditLog : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? IntegrationConnectionId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string Actor { get; set; } = string.Empty;
    public string TargetType { get; set; } = string.Empty;
    public string TargetId { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
