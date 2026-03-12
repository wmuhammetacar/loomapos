using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Ops;

public sealed class DeploymentRecord : ICreatedAtEntity
{
    public Guid Id { get; set; }
    public string Environment { get; set; } = "production";
    public string ServiceName { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public string CommitSha { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
    public string ReleaseChannel { get; set; } = "stable";
    public string ArtifactType { get; set; } = "container";
    public string? CorrelationId { get; set; }
    public string? MetadataJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class ServiceVersionRecord : ICreatedAtEntity
{
    public Guid Id { get; set; }
    public string Environment { get; set; } = "production";
    public string ServiceName { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public string MinimumSupportedVersion { get; set; } = string.Empty;
    public string RolloutState { get; set; } = "stable";
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class EnvironmentConfigRecord : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; }
    public string Environment { get; set; } = "production";
    public string ConfigKey { get; set; } = string.Empty;
    public string ValueKind { get; set; } = "runtime";
    public bool IsSecretReference { get; set; }
    public string? ValuePreview { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class SecretReferenceRecord : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; }
    public string Environment { get; set; } = "production";
    public string SecretName { get; set; } = string.Empty;
    public string Provider { get; set; } = "vault";
    public string RotationPolicy { get; set; } = "90d";
    public DateTimeOffset? LastRotatedAt { get; set; }
    public string Status { get; set; } = "healthy";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class MigrationRun : ICreatedAtEntity
{
    public Guid Id { get; set; }
    public string Environment { get; set; } = "production";
    public string MigrationName { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
    public string? VerificationSummary { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class BackupRun : ICreatedAtEntity
{
    public Guid Id { get; set; }
    public string Environment { get; set; } = "production";
    public string BackupType { get; set; } = "postgres";
    public string Status { get; set; } = "scheduled";
    public string Region { get; set; } = string.Empty;
    public string RetentionPolicy { get; set; } = string.Empty;
    public string? ArtifactReference { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class RestoreValidationRun : ICreatedAtEntity
{
    public Guid Id { get; set; }
    public Guid? BackupRunId { get; set; }
    public string Environment { get; set; } = "dr";
    public string Status { get; set; } = "scheduled";
    public string ValidationType { get; set; } = "restore_test";
    public string? FindingsJson { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class IncidentRecord : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; }
    public string Environment { get; set; } = "production";
    public string Severity { get; set; } = "sev3";
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = "open";
    public string Category { get; set; } = string.Empty;
    public string? ImpactSummary { get; set; }
    public string? Owner { get; set; }
    public string? LinkedRunbookCode { get; set; }
    public DateTimeOffset OpenedAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class IncidentTimelineEvent : ICreatedAtEntity
{
    public Guid Id { get; set; }
    public Guid IncidentRecordId { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string? MetadataJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class RunbookRecord : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Severity { get; set; } = "sev3";
    public string MarkdownPath { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class AlertRule : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; }
    public string Environment { get; set; } = "production";
    public string Code { get; set; } = string.Empty;
    public string Severity { get; set; } = "warning";
    public string ThresholdSummary { get; set; } = string.Empty;
    public string Status { get; set; } = "enabled";
    public string? RunbookCode { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class AlertEvent : ICreatedAtEntity
{
    public Guid Id { get; set; }
    public Guid? AlertRuleId { get; set; }
    public string Environment { get; set; } = "production";
    public string Severity { get; set; } = "warning";
    public string Summary { get; set; } = string.Empty;
    public string Status { get; set; } = "open";
    public DateTimeOffset TriggeredAt { get; set; }
    public DateTimeOffset? AcknowledgedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class SloDefinition : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; }
    public string Environment { get; set; } = "production";
    public string ServiceName { get; set; } = string.Empty;
    public string SloCode { get; set; } = string.Empty;
    public string Objective { get; set; } = string.Empty;
    public string MeasurementWindow { get; set; } = "30d";
    public string AlertPolicy { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class CapacitySnapshot : ICreatedAtEntity
{
    public Guid Id { get; set; }
    public string Environment { get; set; } = "production";
    public string ResourceType { get; set; } = string.Empty;
    public string Scope { get; set; } = string.Empty;
    public string UtilizationSummary { get; set; } = string.Empty;
    public string HeadroomState { get; set; } = "healthy";
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class RateLimitPolicyRecord : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; }
    public string PolicyCode { get; set; } = string.Empty;
    public string Scope { get; set; } = string.Empty;
    public string Target { get; set; } = string.Empty;
    public string LimitSummary { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class RetentionPolicyRecord : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; }
    public string PolicyCode { get; set; } = string.Empty;
    public string DataClass { get; set; } = string.Empty;
    public string HotRetention { get; set; } = string.Empty;
    public string ArchiveRetention { get; set; } = string.Empty;
    public string DisposalPolicy { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class SecurityEventRecord : ICreatedAtEntity
{
    public Guid Id { get; set; }
    public string Environment { get; set; } = "production";
    public string EventType { get; set; } = string.Empty;
    public string Severity { get; set; } = "info";
    public string Summary { get; set; } = string.Empty;
    public string Status { get; set; } = "open";
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class AbuseFlag : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; }
    public Guid? TenantId { get; set; }
    public string FlagType { get; set; } = string.Empty;
    public string Severity { get; set; } = "warning";
    public string Summary { get; set; } = string.Empty;
    public string Status { get; set; } = "new";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class DependencyStatusRecord : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; }
    public string Environment { get; set; } = "production";
    public string DependencyCode { get; set; } = string.Empty;
    public string Status { get; set; } = "healthy";
    public string? LastErrorSummary { get; set; }
    public DateTimeOffset? LastSuccessAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class RolloutRecord : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; }
    public string Environment { get; set; } = "production";
    public string Channel { get; set; } = "stable";
    public string TargetType { get; set; } = "desktop";
    public string TargetVersion { get; set; } = string.Empty;
    public string Status { get; set; } = "planned";
    public string? CompatibilityWindow { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class OpsAuditLog : ICreatedAtEntity
{
    public Guid Id { get; set; }
    public string ActorEmail { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string TargetType { get; set; } = string.Empty;
    public string TargetId { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public string? MetadataJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
