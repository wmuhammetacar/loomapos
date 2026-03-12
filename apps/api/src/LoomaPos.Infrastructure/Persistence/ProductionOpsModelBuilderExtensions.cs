using LoomaPos.Domain.Ops;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Infrastructure.Persistence;

public static class ProductionOpsModelBuilderExtensions
{
    public static void ConfigureProductionOpsEntities(this ModelBuilder modelBuilder)
    {
        ConfigureDeployment(modelBuilder);
        ConfigureVersions(modelBuilder);
        ConfigureEnvironment(modelBuilder);
        ConfigureRecovery(modelBuilder);
        ConfigureIncidents(modelBuilder);
        ConfigureReliability(modelBuilder);
        ConfigureSecurity(modelBuilder);
    }

    private static void ConfigureDeployment(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DeploymentRecord>(entity =>
        {
            entity.ToTable("deployment_records");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Environment).HasColumnName("environment").HasMaxLength(40).IsRequired();
            entity.Property(x => x.ServiceName).HasColumnName("service_name").HasMaxLength(80).IsRequired();
            entity.Property(x => x.Version).HasColumnName("version").HasMaxLength(40).IsRequired();
            entity.Property(x => x.CommitSha).HasColumnName("commit_sha").HasMaxLength(80).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.ReleaseChannel).HasColumnName("release_channel").HasMaxLength(30).IsRequired();
            entity.Property(x => x.ArtifactType).HasColumnName("artifact_type").HasMaxLength(30).IsRequired();
            entity.Property(x => x.CorrelationId).HasColumnName("correlation_id").HasMaxLength(120);
            entity.Property(x => x.MetadataJson).HasColumnName("metadata_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.Environment, x.ServiceName, x.CreatedAt });
        });

        modelBuilder.Entity<ServiceVersionRecord>(entity =>
        {
            entity.ToTable("service_versions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Environment).HasColumnName("environment").HasMaxLength(40).IsRequired();
            entity.Property(x => x.ServiceName).HasColumnName("service_name").HasMaxLength(80).IsRequired();
            entity.Property(x => x.Version).HasColumnName("version").HasMaxLength(40).IsRequired();
            entity.Property(x => x.MinimumSupportedVersion).HasColumnName("minimum_supported_version").HasMaxLength(40).IsRequired();
            entity.Property(x => x.RolloutState).HasColumnName("rollout_state").HasMaxLength(30).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.Environment, x.ServiceName });
        });

        modelBuilder.Entity<RolloutRecord>(entity =>
        {
            entity.ToTable("rollout_records");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Environment).HasColumnName("environment").HasMaxLength(40).IsRequired();
            entity.Property(x => x.Channel).HasColumnName("channel").HasMaxLength(30).IsRequired();
            entity.Property(x => x.TargetType).HasColumnName("target_type").HasMaxLength(40).IsRequired();
            entity.Property(x => x.TargetVersion).HasColumnName("target_version").HasMaxLength(40).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.CompatibilityWindow).HasColumnName("compatibility_window").HasMaxLength(120);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.Environment, x.Channel, x.TargetType, x.TargetVersion });
        });
    }

    private static void ConfigureVersions(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<RunbookRecord>(entity =>
        {
            entity.ToTable("runbook_records");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Code).HasColumnName("code").HasMaxLength(120).IsRequired();
            entity.Property(x => x.Title).HasColumnName("title").HasMaxLength(180).IsRequired();
            entity.Property(x => x.Category).HasColumnName("category").HasMaxLength(60).IsRequired();
            entity.Property(x => x.Severity).HasColumnName("severity").HasMaxLength(20).IsRequired();
            entity.Property(x => x.MarkdownPath).HasColumnName("markdown_path").HasMaxLength(260).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => x.Code).IsUnique();
        });

        modelBuilder.Entity<SloDefinition>(entity =>
        {
            entity.ToTable("slo_definitions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Environment).HasColumnName("environment").HasMaxLength(40).IsRequired();
            entity.Property(x => x.ServiceName).HasColumnName("service_name").HasMaxLength(80).IsRequired();
            entity.Property(x => x.SloCode).HasColumnName("slo_code").HasMaxLength(120).IsRequired();
            entity.Property(x => x.Objective).HasColumnName("objective").HasMaxLength(160).IsRequired();
            entity.Property(x => x.MeasurementWindow).HasColumnName("measurement_window").HasMaxLength(40).IsRequired();
            entity.Property(x => x.AlertPolicy).HasColumnName("alert_policy").HasMaxLength(240).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.Environment, x.ServiceName, x.SloCode }).IsUnique();
        });

        modelBuilder.Entity<RateLimitPolicyRecord>(entity =>
        {
            entity.ToTable("rate_limit_policies");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.PolicyCode).HasColumnName("policy_code").HasMaxLength(120).IsRequired();
            entity.Property(x => x.Scope).HasColumnName("scope").HasMaxLength(60).IsRequired();
            entity.Property(x => x.Target).HasColumnName("target").HasMaxLength(120).IsRequired();
            entity.Property(x => x.LimitSummary).HasColumnName("limit_summary").HasMaxLength(240).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => x.PolicyCode).IsUnique();
        });

        modelBuilder.Entity<RetentionPolicyRecord>(entity =>
        {
            entity.ToTable("retention_policies");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.PolicyCode).HasColumnName("policy_code").HasMaxLength(120).IsRequired();
            entity.Property(x => x.DataClass).HasColumnName("data_class").HasMaxLength(80).IsRequired();
            entity.Property(x => x.HotRetention).HasColumnName("hot_retention").HasMaxLength(80).IsRequired();
            entity.Property(x => x.ArchiveRetention).HasColumnName("archive_retention").HasMaxLength(80).IsRequired();
            entity.Property(x => x.DisposalPolicy).HasColumnName("disposal_policy").HasMaxLength(200).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => x.PolicyCode).IsUnique();
        });
    }

    private static void ConfigureEnvironment(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<EnvironmentConfigRecord>(entity =>
        {
            entity.ToTable("environment_configs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Environment).HasColumnName("environment").HasMaxLength(40).IsRequired();
            entity.Property(x => x.ConfigKey).HasColumnName("config_key").HasMaxLength(120).IsRequired();
            entity.Property(x => x.ValueKind).HasColumnName("value_kind").HasMaxLength(30).IsRequired();
            entity.Property(x => x.IsSecretReference).HasColumnName("is_secret_reference");
            entity.Property(x => x.ValuePreview).HasColumnName("value_preview").HasMaxLength(200);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.Environment, x.ConfigKey }).IsUnique();
        });

        modelBuilder.Entity<SecretReferenceRecord>(entity =>
        {
            entity.ToTable("secret_references");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Environment).HasColumnName("environment").HasMaxLength(40).IsRequired();
            entity.Property(x => x.SecretName).HasColumnName("secret_name").HasMaxLength(120).IsRequired();
            entity.Property(x => x.Provider).HasColumnName("provider").HasMaxLength(40).IsRequired();
            entity.Property(x => x.RotationPolicy).HasColumnName("rotation_policy").HasMaxLength(80).IsRequired();
            entity.Property(x => x.LastRotatedAt).HasColumnName("last_rotated_at");
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.Environment, x.SecretName }).IsUnique();
        });

        modelBuilder.Entity<DependencyStatusRecord>(entity =>
        {
            entity.ToTable("dependency_status_records");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Environment).HasColumnName("environment").HasMaxLength(40).IsRequired();
            entity.Property(x => x.DependencyCode).HasColumnName("dependency_code").HasMaxLength(80).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.LastErrorSummary).HasColumnName("last_error_summary").HasMaxLength(300);
            entity.Property(x => x.LastSuccessAt).HasColumnName("last_success_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.Environment, x.DependencyCode }).IsUnique();
        });
    }

    private static void ConfigureRecovery(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<MigrationRun>(entity =>
        {
            entity.ToTable("migration_runs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Environment).HasColumnName("environment").HasMaxLength(40).IsRequired();
            entity.Property(x => x.MigrationName).HasColumnName("migration_name").HasMaxLength(180).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.VerificationSummary).HasColumnName("verification_summary").HasMaxLength(500);
            entity.Property(x => x.StartedAt).HasColumnName("started_at");
            entity.Property(x => x.CompletedAt).HasColumnName("completed_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.Environment, x.MigrationName, x.CreatedAt });
        });

        modelBuilder.Entity<BackupRun>(entity =>
        {
            entity.ToTable("backup_runs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Environment).HasColumnName("environment").HasMaxLength(40).IsRequired();
            entity.Property(x => x.BackupType).HasColumnName("backup_type").HasMaxLength(40).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.Region).HasColumnName("region").HasMaxLength(60).IsRequired();
            entity.Property(x => x.RetentionPolicy).HasColumnName("retention_policy").HasMaxLength(120).IsRequired();
            entity.Property(x => x.ArtifactReference).HasColumnName("artifact_reference").HasMaxLength(240);
            entity.Property(x => x.StartedAt).HasColumnName("started_at");
            entity.Property(x => x.CompletedAt).HasColumnName("completed_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.Environment, x.BackupType, x.CreatedAt });
        });

        modelBuilder.Entity<RestoreValidationRun>(entity =>
        {
            entity.ToTable("restore_validation_runs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.BackupRunId).HasColumnName("backup_run_id");
            entity.Property(x => x.Environment).HasColumnName("environment").HasMaxLength(40).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.ValidationType).HasColumnName("validation_type").HasMaxLength(50).IsRequired();
            entity.Property(x => x.FindingsJson).HasColumnName("findings_json");
            entity.Property(x => x.StartedAt).HasColumnName("started_at");
            entity.Property(x => x.CompletedAt).HasColumnName("completed_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.Environment, x.CreatedAt });
        });
    }

    private static void ConfigureIncidents(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<IncidentRecord>(entity =>
        {
            entity.ToTable("incident_records");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Environment).HasColumnName("environment").HasMaxLength(40).IsRequired();
            entity.Property(x => x.Severity).HasColumnName("severity").HasMaxLength(20).IsRequired();
            entity.Property(x => x.Title).HasColumnName("title").HasMaxLength(180).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.Category).HasColumnName("category").HasMaxLength(60).IsRequired();
            entity.Property(x => x.ImpactSummary).HasColumnName("impact_summary").HasMaxLength(600);
            entity.Property(x => x.Owner).HasColumnName("owner").HasMaxLength(120);
            entity.Property(x => x.LinkedRunbookCode).HasColumnName("linked_runbook_code").HasMaxLength(120);
            entity.Property(x => x.OpenedAt).HasColumnName("opened_at");
            entity.Property(x => x.ResolvedAt).HasColumnName("resolved_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.Environment, x.Status, x.OpenedAt });
        });

        modelBuilder.Entity<IncidentTimelineEvent>(entity =>
        {
            entity.ToTable("incident_timeline_events");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.IncidentRecordId).HasColumnName("incident_record_id");
            entity.Property(x => x.EventType).HasColumnName("event_type").HasMaxLength(60).IsRequired();
            entity.Property(x => x.Summary).HasColumnName("summary").HasMaxLength(500).IsRequired();
            entity.Property(x => x.MetadataJson).HasColumnName("metadata_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.IncidentRecordId, x.CreatedAt });
        });
    }

    private static void ConfigureReliability(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AlertRule>(entity =>
        {
            entity.ToTable("alert_rules");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Environment).HasColumnName("environment").HasMaxLength(40).IsRequired();
            entity.Property(x => x.Code).HasColumnName("code").HasMaxLength(120).IsRequired();
            entity.Property(x => x.Severity).HasColumnName("severity").HasMaxLength(20).IsRequired();
            entity.Property(x => x.ThresholdSummary).HasColumnName("threshold_summary").HasMaxLength(300).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.RunbookCode).HasColumnName("runbook_code").HasMaxLength(120);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.Environment, x.Code }).IsUnique();
        });

        modelBuilder.Entity<AlertEvent>(entity =>
        {
            entity.ToTable("alert_events");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.AlertRuleId).HasColumnName("alert_rule_id");
            entity.Property(x => x.Environment).HasColumnName("environment").HasMaxLength(40).IsRequired();
            entity.Property(x => x.Severity).HasColumnName("severity").HasMaxLength(20).IsRequired();
            entity.Property(x => x.Summary).HasColumnName("summary").HasMaxLength(300).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.TriggeredAt).HasColumnName("triggered_at");
            entity.Property(x => x.AcknowledgedAt).HasColumnName("acknowledged_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.Environment, x.TriggeredAt });
        });

        modelBuilder.Entity<CapacitySnapshot>(entity =>
        {
            entity.ToTable("capacity_snapshots");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Environment).HasColumnName("environment").HasMaxLength(40).IsRequired();
            entity.Property(x => x.ResourceType).HasColumnName("resource_type").HasMaxLength(60).IsRequired();
            entity.Property(x => x.Scope).HasColumnName("scope").HasMaxLength(120).IsRequired();
            entity.Property(x => x.UtilizationSummary).HasColumnName("utilization_summary").HasMaxLength(300).IsRequired();
            entity.Property(x => x.HeadroomState).HasColumnName("headroom_state").HasMaxLength(30).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.Environment, x.ResourceType, x.CreatedAt });
        });
    }

    private static void ConfigureSecurity(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SecurityEventRecord>(entity =>
        {
            entity.ToTable("security_events");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Environment).HasColumnName("environment").HasMaxLength(40).IsRequired();
            entity.Property(x => x.EventType).HasColumnName("event_type").HasMaxLength(80).IsRequired();
            entity.Property(x => x.Severity).HasColumnName("severity").HasMaxLength(20).IsRequired();
            entity.Property(x => x.Summary).HasColumnName("summary").HasMaxLength(300).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.Environment, x.EventType, x.CreatedAt });
        });

        modelBuilder.Entity<AbuseFlag>(entity =>
        {
            entity.ToTable("abuse_flags");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.FlagType).HasColumnName("flag_type").HasMaxLength(80).IsRequired();
            entity.Property(x => x.Severity).HasColumnName("severity").HasMaxLength(20).IsRequired();
            entity.Property(x => x.Summary).HasColumnName("summary").HasMaxLength(300).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.TenantId, x.FlagType, x.CreatedAt });
        });

        modelBuilder.Entity<OpsAuditLog>(entity =>
        {
            entity.ToTable("ops_audit_logs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ActorEmail).HasColumnName("actor_email").HasMaxLength(320).IsRequired();
            entity.Property(x => x.Action).HasColumnName("action").HasMaxLength(120).IsRequired();
            entity.Property(x => x.TargetType).HasColumnName("target_type").HasMaxLength(80).IsRequired();
            entity.Property(x => x.TargetId).HasColumnName("target_id").HasMaxLength(120).IsRequired();
            entity.Property(x => x.Reason).HasColumnName("reason").HasMaxLength(500);
            entity.Property(x => x.MetadataJson).HasColumnName("metadata_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.ActorEmail, x.CreatedAt });
        });
    }
}
