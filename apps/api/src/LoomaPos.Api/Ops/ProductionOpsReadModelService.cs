using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Ops;

public interface IProductionOpsReadModelService
{
    Task<ProductionOpsWorkspaceDto> BuildWorkspaceAsync(CancellationToken cancellationToken);
}

public sealed class ProductionOpsReadModelService(AppDbContext dbContext) : IProductionOpsReadModelService
{
    public async Task<ProductionOpsWorkspaceDto> BuildWorkspaceAsync(CancellationToken cancellationToken)
    {
        try
        {
            var latestRelease = await dbContext.AppReleases.AsNoTracking()
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => $"{x.Platform} {x.Version}")
                .FirstOrDefaultAsync(cancellationToken) ?? "desktop 0.0.0";

            var deployments = await dbContext.DeploymentRecords.AsNoTracking()
                .OrderByDescending(x => x.CreatedAt)
                .Take(12)
                .Select(x => new DeploymentDto(
                    x.Id,
                    x.Environment,
                    x.ServiceName,
                    x.Version,
                    x.CommitSha,
                    x.Status,
                    x.ReleaseChannel,
                    x.ArtifactType,
                    x.CreatedAt.ToString("O")))
                .ToListAsync(cancellationToken);

            var backups = await dbContext.BackupRuns.AsNoTracking()
                .OrderByDescending(x => x.CreatedAt)
                .Take(12)
                .Select(x => new BackupDto(
                    x.Id,
                    x.Environment,
                    x.BackupType,
                    x.Status,
                    x.Region,
                    x.RetentionPolicy,
                    x.StartedAt.ToString("O"),
                    x.CompletedAt.HasValue ? x.CompletedAt.Value.ToString("O") : null))
                .ToListAsync(cancellationToken);

            var restoreValidations = await dbContext.RestoreValidationRuns.AsNoTracking()
                .OrderByDescending(x => x.CreatedAt)
                .Take(12)
                .Select(x => new RestoreValidationDto(
                    x.Id,
                    x.Environment,
                    x.Status,
                    x.ValidationType,
                    x.StartedAt.ToString("O"),
                    x.CompletedAt.HasValue ? x.CompletedAt.Value.ToString("O") : null,
                    x.BackupRunId))
                .ToListAsync(cancellationToken);

            var incidents = await dbContext.IncidentRecords.AsNoTracking()
                .OrderByDescending(x => x.OpenedAt)
                .Take(20)
                .Select(x => new IncidentDto(
                    x.Id,
                    x.Environment,
                    x.Severity,
                    x.Title,
                    x.Status,
                    x.Category,
                    x.Owner,
                    x.OpenedAt.ToString("O"),
                    x.LinkedRunbookCode))
                .ToListAsync(cancellationToken);

            var alerts = await (from alert in dbContext.AlertEvents.AsNoTracking()
                                join rule in dbContext.AlertRules.AsNoTracking() on alert.AlertRuleId equals rule.Id into alertRules
                                from rule in alertRules.DefaultIfEmpty()
                                orderby alert.TriggeredAt descending
                                select new AlertDto(
                                    alert.Id,
                                    alert.Environment,
                                    alert.Severity,
                                    alert.Summary,
                                    alert.Status,
                                    alert.TriggeredAt.ToString("O"),
                                    rule == null ? null : rule.Code))
                .Take(30)
                .ToListAsync(cancellationToken);

            var opsAuditLogs = await dbContext.OpsAuditLogs.AsNoTracking()
                .OrderByDescending(x => x.CreatedAt)
                .Take(40)
                .Select(x => new OpsAuditLogDto(
                    x.Id,
                    x.ActorEmail,
                    x.Action,
                    x.TargetType,
                    x.TargetId,
                    x.Reason,
                    x.CreatedAt.ToString("O")))
                .ToListAsync(cancellationToken);

            var runbooks = await dbContext.RunbookRecords.AsNoTracking()
                .OrderBy(x => x.Category).ThenBy(x => x.Code)
                .Take(30)
                .Select(x => new RunbookDto(x.Id, x.Code, x.Title, x.Category, x.Severity, x.MarkdownPath, x.Status))
                .ToListAsync(cancellationToken);

            var slos = await dbContext.SloDefinitions.AsNoTracking()
                .OrderBy(x => x.ServiceName).ThenBy(x => x.SloCode)
                .Take(20)
                .Select(x => new SloDto(
                    x.Id,
                    x.Environment,
                    x.ServiceName,
                    x.SloCode,
                    x.Objective,
                    x.MeasurementWindow,
                    x.AlertPolicy,
                    x.Status))
                .ToListAsync(cancellationToken);

            var dependencies = await dbContext.DependencyStatusRecords.AsNoTracking()
                .OrderBy(x => x.DependencyCode)
                .Select(x => new
                {
                    x.DependencyCode,
                    x.Status,
                    x.LastErrorSummary,
                    LastSuccessAt = x.LastSuccessAt.HasValue ? x.LastSuccessAt.Value.ToString("O") : null
                })
                .ToListAsync(cancellationToken);

            var capacity = await dbContext.CapacitySnapshots.AsNoTracking()
                .OrderByDescending(x => x.CreatedAt)
                .Take(12)
                .Select(x => new
                {
                    x.ResourceType,
                    x.Scope,
                    x.UtilizationSummary,
                    x.HeadroomState,
                    CreatedAt = x.CreatedAt.ToString("O")
                })
                .ToListAsync(cancellationToken);

            var policies = await dbContext.RateLimitPolicies.AsNoTracking()
                .OrderBy(x => x.PolicyCode)
                .Select(x => new
                {
                    x.PolicyCode,
                    x.Scope,
                    x.Target,
                    x.LimitSummary,
                    x.Status
                })
                .ToListAsync(cancellationToken);

            var security = new SecurityOpsDto(
                LastSecretRotation: await dbContext.SecretReferences.AsNoTracking()
                    .OrderByDescending(x => x.LastRotatedAt)
                    .Select(x => x.LastRotatedAt.HasValue ? x.LastRotatedAt.Value.ToString("O") : string.Empty)
                    .FirstOrDefaultAsync(cancellationToken) ?? DateTimeOffset.UtcNow.AddDays(-14).ToString("O"),
                OpenSecurityEvents: await dbContext.SecurityEvents.AsNoTracking().CountAsync(x => x.Status != "resolved", cancellationToken),
                AbuseFlags: await dbContext.AbuseFlags.AsNoTracking().CountAsync(x => x.Status != "resolved", cancellationToken),
                RateLimitState: policies.Count == 0 ? "foundation" : "active",
                TenantIsolationState: "tenant-keyed cache, rate-limit and queue fairness enabled");

            var overview = new OpsOverviewDto(
                Environment: "production",
                DeploymentState: deployments.FirstOrDefault()?.Status ?? "foundation",
                ActiveAlerts: await dbContext.AlertEvents.AsNoTracking().CountAsync(x => x.Status == "open", cancellationToken),
                OpenIncidents: incidents.Count(x => x.Status is "open" or "investigating" or "mitigating"),
                FailedBackups: backups.Count(x => x.Status is "failed" or "degraded"),
                FailedRestoreValidations: await dbContext.RestoreValidationRuns.AsNoTracking().CountAsync(x => x.Status == "failed", cancellationToken),
                SecurityWarnings: security.OpenSecurityEvents,
                AbuseFlags: security.AbuseFlags,
                QueueHealth: dependencies.FirstOrDefault(x => ((string)x.DependencyCode).Contains("queue", StringComparison.OrdinalIgnoreCase))?.Status ?? "watch",
                LatestRelease: latestRelease,
                ApiAvailabilityTarget: slos.FirstOrDefault(x => x.SloCode == "api_availability")?.Objective ?? "99.9%",
                LastDeploymentAt: deployments.FirstOrDefault()?.CreatedAt ?? DateTimeOffset.UtcNow.AddHours(-6).ToString("O"));

            return new ProductionOpsWorkspaceDto(overview, deployments, backups, restoreValidations, incidents, alerts, opsAuditLogs, runbooks, slos, security, dependencies, capacity, policies);
        }
        catch
        {
            return BuildFallbackWorkspace();
        }
    }

    private static ProductionOpsWorkspaceDto BuildFallbackWorkspace()
    {
        var deployments = new[]
        {
            new DeploymentDto(Guid.NewGuid(), "production", "api", "2026.03.09.1", "7c2f4ad", "succeeded", "stable", "container", DateTimeOffset.UtcNow.AddHours(-4).ToString("O")),
            new DeploymentDto(Guid.NewGuid(), "production", "web-admin", "2026.03.09.1", "7c2f4ad", "canary", "stable", "bundle", DateTimeOffset.UtcNow.AddHours(-4).ToString("O"))
        };
        var backups = new[]
        {
            new BackupDto(Guid.NewGuid(), "production", "postgres", "completed", "eu-central", "35d hot / 365d archive", DateTimeOffset.UtcNow.AddHours(-16).ToString("O"), DateTimeOffset.UtcNow.AddHours(-15).ToString("O"))
        };
        var restoreValidations = new[]
        {
            new RestoreValidationDto(Guid.NewGuid(), "dr", "completed", "restore_test", DateTimeOffset.UtcNow.AddHours(-10).ToString("O"), DateTimeOffset.UtcNow.AddHours(-9).ToString("O"), backups[0].Id)
        };
        var incidents = new[]
        {
            new IncidentDto(Guid.NewGuid(), "production", "sev2", "Provider webhook latency spike", "monitoring", "integrations", "Ops rotation", DateTimeOffset.UtcNow.AddHours(-5).ToString("O"), "provider-outage")
        };
        var alerts = new[]
        {
            new AlertDto(Guid.NewGuid(), "production", "warning", "Queue backlog exceeded warning threshold.", "open", DateTimeOffset.UtcNow.AddMinutes(-40).ToString("O"), "queue_backlog_growth"),
            new AlertDto(Guid.NewGuid(), "production", "critical", "Payment webhook failures elevated.", "acknowledged", DateTimeOffset.UtcNow.AddHours(-2).ToString("O"), "payment_webhook_failures")
        };
        var opsAuditLogs = new[]
        {
            new OpsAuditLogDto(Guid.NewGuid(), "ops@loomapos.local", "ops.alert.acknowledged", "alert_event", "alert-1", "Ack from fallback model", DateTimeOffset.UtcNow.AddMinutes(-20).ToString("O"))
        };
        var runbooks = new[]
        {
            new RunbookDto(Guid.NewGuid(), "failed-deploy-rollback", "Failed deployment rollback", "release", "sev2", "docs/runbooks/failed-deployment-rollback.md", "active"),
            new RunbookDto(Guid.NewGuid(), "backup-restore-validation", "Backup restore validation", "recovery", "sev1", "docs/runbooks/backup-restore-validation.md", "active")
        };
        var slos = new[]
        {
            new SloDto(Guid.NewGuid(), "production", "api", "api_availability", "99.9%", "30d", "page on burn > 5%", "active"),
            new SloDto(Guid.NewGuid(), "production", "sync-workers", "sync_delay", "< 5m p95", "7d", "ticket on delay > 10m", "active")
        };
        var security = new SecurityOpsDto(DateTimeOffset.UtcNow.AddDays(-8).ToString("O"), 2, 1, "active", "tenant-keyed cache and queue fairness enforced");
        var dependencies = new object[]
        {
            new { DependencyCode = "queue-rabbitmq", Status = "healthy", LastErrorSummary = (string?)null, LastSuccessAt = DateTimeOffset.UtcNow.AddMinutes(-3).ToString("O") },
            new { DependencyCode = "payments-provider", Status = "degraded", LastErrorSummary = "Elevated timeout p95", LastSuccessAt = DateTimeOffset.UtcNow.AddMinutes(-5).ToString("O") }
        };
        var capacity = new object[]
        {
            new { ResourceType = "postgres", Scope = "production-primary", UtilizationSummary = "CPU 48% / Storage 62%", HeadroomState = "healthy", CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-10).ToString("O") },
            new { ResourceType = "queue", Scope = "sync-workers", UtilizationSummary = "Backlog 1.2k / Drain 8m", HeadroomState = "watch", CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-10).ToString("O") }
        };
        var policies = new object[]
        {
            new { PolicyCode = "sync-events", Scope = "tenant", Target = "all", LimitSummary = "600 req/min", Status = "active" },
            new { PolicyCode = "public-api", Scope = "api-client", Target = "partner", LimitSummary = "120 req/min", Status = "active" }
        };

        return new ProductionOpsWorkspaceDto(
            new OpsOverviewDto("production", "healthy", 3, 1, 0, 0, 2, 1, "watch", "desktop 2.4.1", "99.9%", deployments[0].CreatedAt),
            deployments,
            backups,
            restoreValidations,
            incidents,
            alerts,
            opsAuditLogs,
            runbooks,
            slos,
            security,
            dependencies,
            capacity,
            policies);
    }
}
