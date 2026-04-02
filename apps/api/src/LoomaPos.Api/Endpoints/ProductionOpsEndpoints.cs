using LoomaPos.Api.Ops;
using LoomaPos.Api.Security;
using LoomaPos.Domain.Ops;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class ProductionOpsEndpoints
{
    public static IEndpointRouteBuilder MapProductionOpsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/internal/admin/ops").WithTags("Production Ops").RequireInternalAdminAccess();

        group.MapGet("/workspace", async (HttpContext httpContext, IInternalAdminAuthService authService, IProductionOpsReadModelService service, CancellationToken cancellationToken) =>
        {
            if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
            {
                return Results.Unauthorized();
            }

            return Results.Ok(await service.BuildWorkspaceAsync(cancellationToken));
        });

        group.MapGet("/deployments", async (HttpContext httpContext, IInternalAdminAuthService authService, IProductionOpsReadModelService service, CancellationToken cancellationToken) =>
        {
            if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
            {
                return Results.Unauthorized();
            }

            return Results.Ok((await service.BuildWorkspaceAsync(cancellationToken)).Deployments);
        });

        group.MapGet("/backups", async (HttpContext httpContext, IInternalAdminAuthService authService, IProductionOpsReadModelService service, CancellationToken cancellationToken) =>
        {
            if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
            {
                return Results.Unauthorized();
            }

            return Results.Ok((await service.BuildWorkspaceAsync(cancellationToken)).Backups);
        });

        group.MapGet("/restore-validations", async (HttpContext httpContext, IInternalAdminAuthService authService, IProductionOpsReadModelService service, CancellationToken cancellationToken) =>
        {
            if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
            {
                return Results.Unauthorized();
            }

            return Results.Ok((await service.BuildWorkspaceAsync(cancellationToken)).RestoreValidations);
        });

        group.MapGet("/incidents", async (HttpContext httpContext, IInternalAdminAuthService authService, IProductionOpsReadModelService service, CancellationToken cancellationToken) =>
        {
            if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
            {
                return Results.Unauthorized();
            }

            return Results.Ok((await service.BuildWorkspaceAsync(cancellationToken)).Incidents);
        });

        group.MapGet("/runbooks", async (HttpContext httpContext, IInternalAdminAuthService authService, IProductionOpsReadModelService service, CancellationToken cancellationToken) =>
        {
            if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
            {
                return Results.Unauthorized();
            }

            return Results.Ok((await service.BuildWorkspaceAsync(cancellationToken)).Runbooks);
        });

        group.MapGet("/slos", async (HttpContext httpContext, IInternalAdminAuthService authService, IProductionOpsReadModelService service, CancellationToken cancellationToken) =>
        {
            if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
            {
                return Results.Unauthorized();
            }

            return Results.Ok((await service.BuildWorkspaceAsync(cancellationToken)).Slos);
        });

        group.MapGet("/security", async (HttpContext httpContext, IInternalAdminAuthService authService, IProductionOpsReadModelService service, CancellationToken cancellationToken) =>
        {
            if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
            {
                return Results.Unauthorized();
            }

            return Results.Ok((await service.BuildWorkspaceAsync(cancellationToken)).Security);
        });

        group.MapGet("/alerts", async (HttpContext httpContext, IInternalAdminAuthService authService, IProductionOpsReadModelService service, CancellationToken cancellationToken) =>
        {
            if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
            {
                return Results.Unauthorized();
            }

            return Results.Ok((await service.BuildWorkspaceAsync(cancellationToken)).Alerts);
        });

        group.MapGet("/audit-logs", async (HttpContext httpContext, IInternalAdminAuthService authService, IProductionOpsReadModelService service, CancellationToken cancellationToken) =>
        {
            if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
            {
                return Results.Unauthorized();
            }

            return Results.Ok((await service.BuildWorkspaceAsync(cancellationToken)).OpsAuditLogs);
        });

        group.MapPost("/alerts/{alertId:guid}/ack", AcknowledgeAlertAsync);
        group.MapPost("/backups/runs", CreateBackupRunAsync);
        group.MapPost("/restore-validations/runs", CreateRestoreValidationRunAsync);
        group.MapPost("/incidents", CreateIncidentAsync);
        group.MapPost("/incidents/{incidentId:guid}/status", UpdateIncidentStatusAsync);
        group.MapPost("/dependencies/upsert", UpsertDependencyAsync);
        group.MapPost("/capacity/snapshots", CreateCapacitySnapshotAsync);

        return app;
    }

    private static async Task<IResult> AcknowledgeAlertAsync(Guid alertId, OpsReasonRequest request, HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context.Roles, "super_admin", "ops_admin", "security_auditor"))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return Results.BadRequest(new { message = "Reason is required." });
        }

        var alert = await dbContext.AlertEvents.FirstOrDefaultAsync(x => x.Id == alertId, cancellationToken);
        if (alert is null)
        {
            return Results.NotFound();
        }

        alert.Status = "acknowledged";
        alert.AcknowledgedAt = DateTimeOffset.UtcNow;
        dbContext.OpsAuditLogs.Add(BuildOpsAudit(context.Email, "ops.alert.acknowledged", "alert_event", alert.Id.ToString(), request.Reason, new { alert.Severity, alert.Summary }));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { id = alert.Id, status = alert.Status, acknowledgedAt = alert.AcknowledgedAt });
    }

    private static async Task<IResult> CreateBackupRunAsync(CreateBackupRunRequest request, HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context.Roles, "super_admin", "ops_admin"))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.BackupType) || string.IsNullOrWhiteSpace(request.Region) || string.IsNullOrWhiteSpace(request.RetentionPolicy) || string.IsNullOrWhiteSpace(request.Reason))
        {
            return Results.BadRequest(new { message = "BackupType, region, retentionPolicy and reason are required." });
        }

        var run = new BackupRun
        {
            Environment = string.IsNullOrWhiteSpace(request.Environment) ? "production" : request.Environment.Trim().ToLowerInvariant(),
            BackupType = request.BackupType.Trim().ToLowerInvariant(),
            Status = "scheduled",
            Region = request.Region.Trim().ToLowerInvariant(),
            RetentionPolicy = request.RetentionPolicy.Trim(),
            StartedAt = DateTimeOffset.UtcNow
        };
        dbContext.BackupRuns.Add(run);
        dbContext.OpsAuditLogs.Add(BuildOpsAudit(context.Email, "ops.backup.run_created", "backup_run", run.Id.ToString(), request.Reason, new { run.Environment, run.BackupType, run.Region }));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { run.Id, run.Environment, run.BackupType, run.Status, run.Region, run.StartedAt });
    }

    private static async Task<IResult> CreateRestoreValidationRunAsync(CreateRestoreValidationRunRequest request, HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context.Roles, "super_admin", "ops_admin"))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.ValidationType) || string.IsNullOrWhiteSpace(request.Reason))
        {
            return Results.BadRequest(new { message = "ValidationType and reason are required." });
        }

        BackupRun? backupRun = null;
        if (request.BackupRunId.HasValue)
        {
            backupRun = await dbContext.BackupRuns.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.BackupRunId.Value, cancellationToken);
            if (backupRun is null)
            {
                return Results.BadRequest(new { message = "BackupRunId was not found." });
            }
        }

        var run = new RestoreValidationRun
        {
            BackupRunId = request.BackupRunId,
            Environment = string.IsNullOrWhiteSpace(request.Environment) ? "dr" : request.Environment.Trim().ToLowerInvariant(),
            Status = "scheduled",
            ValidationType = request.ValidationType.Trim().ToLowerInvariant(),
            FindingsJson = string.IsNullOrWhiteSpace(request.FindingsJson) ? null : request.FindingsJson,
            StartedAt = DateTimeOffset.UtcNow
        };
        dbContext.RestoreValidationRuns.Add(run);
        dbContext.OpsAuditLogs.Add(BuildOpsAudit(context.Email, "ops.restore_validation.run_created", "restore_validation_run", run.Id.ToString(), request.Reason, new { run.Environment, run.ValidationType, run.BackupRunId }));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { run.Id, run.Environment, run.ValidationType, run.Status, run.BackupRunId, run.StartedAt, linkedBackupType = backupRun?.BackupType });
    }

    private static async Task<IResult> CreateIncidentAsync(CreateIncidentRequest request, HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context.Roles, "super_admin", "ops_admin", "support_agent", "release_manager"))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Category) || string.IsNullOrWhiteSpace(request.Severity))
        {
            return Results.BadRequest(new { message = "Title, category and severity are required." });
        }

        var incident = new IncidentRecord
        {
            Environment = string.IsNullOrWhiteSpace(request.Environment) ? "production" : request.Environment.Trim().ToLowerInvariant(),
            Severity = request.Severity.Trim().ToLowerInvariant(),
            Title = request.Title.Trim(),
            Status = "open",
            Category = request.Category.Trim().ToLowerInvariant(),
            ImpactSummary = string.IsNullOrWhiteSpace(request.ImpactSummary) ? null : request.ImpactSummary.Trim(),
            Owner = string.IsNullOrWhiteSpace(request.Owner) ? context.Email : request.Owner.Trim(),
            LinkedRunbookCode = string.IsNullOrWhiteSpace(request.LinkedRunbookCode) ? null : request.LinkedRunbookCode.Trim().ToLowerInvariant(),
            OpenedAt = DateTimeOffset.UtcNow
        };
        dbContext.IncidentRecords.Add(incident);
        dbContext.OpsAuditLogs.Add(BuildOpsAudit(context.Email, "ops.incident.created", "incident_record", incident.Id.ToString(), request.Reason, new { incident.Severity, incident.Category, incident.Title }));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new
        {
            id = incident.Id,
            incident.Environment,
            incident.Severity,
            incident.Title,
            incident.Status,
            incident.Category,
            incident.Owner,
            openedAt = incident.OpenedAt
        });
    }

    private static async Task<IResult> UpdateIncidentStatusAsync(Guid incidentId, UpdateIncidentStatusRequest request, HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context.Roles, "super_admin", "ops_admin", "support_agent", "release_manager"))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.Status) || string.IsNullOrWhiteSpace(request.Reason))
        {
            return Results.BadRequest(new { message = "Status and reason are required." });
        }

        var incident = await dbContext.IncidentRecords.FirstOrDefaultAsync(x => x.Id == incidentId, cancellationToken);
        if (incident is null)
        {
            return Results.NotFound();
        }

        incident.Status = request.Status.Trim().ToLowerInvariant();
        incident.Owner = string.IsNullOrWhiteSpace(request.Owner) ? incident.Owner : request.Owner.Trim();
        incident.LinkedRunbookCode = string.IsNullOrWhiteSpace(request.LinkedRunbookCode) ? incident.LinkedRunbookCode : request.LinkedRunbookCode.Trim().ToLowerInvariant();
        if (incident.Status is "resolved" or "closed")
        {
            incident.ResolvedAt = DateTimeOffset.UtcNow;
        }

        dbContext.IncidentTimelineEvents.Add(new IncidentTimelineEvent
        {
            IncidentRecordId = incident.Id,
            EventType = "status_change",
            Summary = $"Status changed to {incident.Status}.",
            MetadataJson = System.Text.Json.JsonSerializer.Serialize(new { request.Reason, actor = context.Email })
        });
        dbContext.OpsAuditLogs.Add(BuildOpsAudit(context.Email, "ops.incident.status_updated", "incident_record", incident.Id.ToString(), request.Reason, new { incident.Status }));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { id = incident.Id, incident.Status, resolvedAt = incident.ResolvedAt, owner = incident.Owner });
    }

    private static async Task<IResult> UpsertDependencyAsync(UpsertDependencyRequest request, HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context.Roles, "super_admin", "ops_admin", "release_manager"))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.DependencyCode) || string.IsNullOrWhiteSpace(request.Status) || string.IsNullOrWhiteSpace(request.Reason))
        {
            return Results.BadRequest(new { message = "DependencyCode, status and reason are required." });
        }

        var code = request.DependencyCode.Trim().ToLowerInvariant();
        var row = await dbContext.DependencyStatusRecords.FirstOrDefaultAsync(x => x.Environment == (request.Environment ?? "production") && x.DependencyCode == code, cancellationToken);
        if (row is null)
        {
            row = new DependencyStatusRecord
            {
                Environment = string.IsNullOrWhiteSpace(request.Environment) ? "production" : request.Environment.Trim().ToLowerInvariant(),
                DependencyCode = code
            };
            dbContext.DependencyStatusRecords.Add(row);
        }

        row.Status = request.Status.Trim().ToLowerInvariant();
        row.LastErrorSummary = string.IsNullOrWhiteSpace(request.LastErrorSummary) ? null : request.LastErrorSummary.Trim();
        row.LastSuccessAt = request.LastSuccessAt ?? (row.Status == "healthy" ? DateTimeOffset.UtcNow : row.LastSuccessAt);
        dbContext.OpsAuditLogs.Add(BuildOpsAudit(context.Email, "ops.dependency.upserted", "dependency_status_record", row.DependencyCode, request.Reason, new { row.Status, row.Environment }));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { row.DependencyCode, row.Status, row.Environment, row.LastSuccessAt, row.LastErrorSummary });
    }

    private static async Task<IResult> CreateCapacitySnapshotAsync(CreateCapacitySnapshotRequest request, HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context.Roles, "super_admin", "ops_admin"))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.ResourceType) || string.IsNullOrWhiteSpace(request.Scope) || string.IsNullOrWhiteSpace(request.UtilizationSummary) || string.IsNullOrWhiteSpace(request.Reason))
        {
            return Results.BadRequest(new { message = "ResourceType, scope, utilizationSummary and reason are required." });
        }

        var snapshot = new CapacitySnapshot
        {
            Environment = string.IsNullOrWhiteSpace(request.Environment) ? "production" : request.Environment.Trim().ToLowerInvariant(),
            ResourceType = request.ResourceType.Trim().ToLowerInvariant(),
            Scope = request.Scope.Trim(),
            UtilizationSummary = request.UtilizationSummary.Trim(),
            HeadroomState = string.IsNullOrWhiteSpace(request.HeadroomState) ? "watch" : request.HeadroomState.Trim().ToLowerInvariant()
        };
        dbContext.CapacitySnapshots.Add(snapshot);
        dbContext.OpsAuditLogs.Add(BuildOpsAudit(context.Email, "ops.capacity.snapshot_created", "capacity_snapshot", snapshot.Id.ToString(), request.Reason, new { snapshot.ResourceType, snapshot.Scope, snapshot.HeadroomState }));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { snapshot.Id, snapshot.Environment, snapshot.ResourceType, snapshot.Scope, snapshot.HeadroomState, snapshot.CreatedAt });
    }

    private static bool HasAnyRole(IEnumerable<string> roles, params string[] allowed)
        => roles.Any(role => allowed.Contains(role, StringComparer.OrdinalIgnoreCase));

    private static OpsAuditLog BuildOpsAudit(string actorEmail, string action, string targetType, string targetId, string? reason, object metadata)
    {
        return new OpsAuditLog
        {
            ActorEmail = actorEmail,
            Action = action,
            TargetType = targetType,
            TargetId = targetId,
            Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim(),
            MetadataJson = System.Text.Json.JsonSerializer.Serialize(metadata)
        };
    }

    private sealed record OpsReasonRequest(string Reason);
    private sealed record CreateIncidentRequest(string Title, string Category, string Severity, string? Owner, string? LinkedRunbookCode, string? ImpactSummary, string? Environment, string? Reason);
    private sealed record UpdateIncidentStatusRequest(string Status, string Reason, string? Owner, string? LinkedRunbookCode);
    private sealed record CreateBackupRunRequest(string BackupType, string Region, string RetentionPolicy, string Reason, string? Environment);
    private sealed record CreateRestoreValidationRunRequest(string ValidationType, string Reason, Guid? BackupRunId, string? Environment, string? FindingsJson);
    private sealed record UpsertDependencyRequest(string DependencyCode, string Status, string Reason, string? Environment, string? LastErrorSummary, DateTimeOffset? LastSuccessAt);
    private sealed record CreateCapacitySnapshotRequest(string ResourceType, string Scope, string UtilizationSummary, string HeadroomState, string Reason, string? Environment);
}
