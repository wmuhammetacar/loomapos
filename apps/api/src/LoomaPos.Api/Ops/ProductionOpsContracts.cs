namespace LoomaPos.Api.Ops;

public sealed record OpsOverviewDto(
    string Environment,
    string DeploymentState,
    int ActiveAlerts,
    int OpenIncidents,
    int FailedBackups,
    int FailedRestoreValidations,
    int SecurityWarnings,
    int AbuseFlags,
    string QueueHealth,
    string LatestRelease,
    string ApiAvailabilityTarget,
    string LastDeploymentAt);

public sealed record DeploymentDto(
    Guid Id,
    string Environment,
    string ServiceName,
    string Version,
    string CommitSha,
    string Status,
    string ReleaseChannel,
    string ArtifactType,
    string CreatedAt);

public sealed record BackupDto(
    Guid Id,
    string Environment,
    string BackupType,
    string Status,
    string Region,
    string RetentionPolicy,
    string StartedAt,
    string? CompletedAt);

public sealed record RestoreValidationDto(
    Guid Id,
    string Environment,
    string Status,
    string ValidationType,
    string StartedAt,
    string? CompletedAt,
    Guid? BackupRunId);

public sealed record IncidentDto(
    Guid Id,
    string Environment,
    string Severity,
    string Title,
    string Status,
    string Category,
    string? Owner,
    string OpenedAt,
    string? LinkedRunbookCode);

public sealed record RunbookDto(
    Guid Id,
    string Code,
    string Title,
    string Category,
    string Severity,
    string MarkdownPath,
    string Status);

public sealed record SloDto(
    Guid Id,
    string Environment,
    string ServiceName,
    string SloCode,
    string Objective,
    string MeasurementWindow,
    string AlertPolicy,
    string Status);

public sealed record SecurityOpsDto(
    string LastSecretRotation,
    int OpenSecurityEvents,
    int AbuseFlags,
    string RateLimitState,
    string TenantIsolationState);

public sealed record AlertDto(
    Guid Id,
    string Environment,
    string Severity,
    string Summary,
    string Status,
    string TriggeredAt,
    string? AlertRuleCode);

public sealed record OpsAuditLogDto(
    Guid Id,
    string ActorEmail,
    string Action,
    string TargetType,
    string TargetId,
    string? Reason,
    string CreatedAt);

public sealed record ProductionOpsWorkspaceDto(
    OpsOverviewDto Overview,
    IReadOnlyList<DeploymentDto> Deployments,
    IReadOnlyList<BackupDto> Backups,
    IReadOnlyList<RestoreValidationDto> RestoreValidations,
    IReadOnlyList<IncidentDto> Incidents,
    IReadOnlyList<AlertDto> Alerts,
    IReadOnlyList<OpsAuditLogDto> OpsAuditLogs,
    IReadOnlyList<RunbookDto> Runbooks,
    IReadOnlyList<SloDto> Slos,
    SecurityOpsDto Security,
    IReadOnlyList<object> Dependencies,
    IReadOnlyList<object> Capacity,
    IReadOnlyList<object> Policies);
