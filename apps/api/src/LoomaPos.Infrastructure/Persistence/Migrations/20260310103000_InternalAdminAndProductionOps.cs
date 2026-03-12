using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace LoomaPos.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260310103000_InternalAdminAndProductionOps")]
public partial class InternalAdminAndProductionOps : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS internal_users (
                id uuid PRIMARY KEY,
                email varchar(320) NOT NULL,
                display_name varchar(200) NOT NULL,
                password_hash varchar(500) NOT NULL,
                status varchar(30) NOT NULL DEFAULT 'active',
                require_mfa boolean NOT NULL DEFAULT false,
                last_login_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_internal_users_email ON internal_users(email);

            CREATE TABLE IF NOT EXISTS internal_user_roles (
                id uuid PRIMARY KEY,
                internal_user_id uuid NOT NULL,
                role_code varchar(80) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_internal_user_roles_user FOREIGN KEY (internal_user_id) REFERENCES internal_users(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_internal_user_roles_user_role ON internal_user_roles(internal_user_id, role_code);

            CREATE TABLE IF NOT EXISTS internal_sessions (
                id uuid PRIMARY KEY,
                internal_user_id uuid NOT NULL,
                access_token_hash varchar(128) NOT NULL,
                refresh_token_hash varchar(128) NOT NULL,
                expires_at timestamptz NOT NULL,
                refresh_expires_at timestamptz NOT NULL,
                user_agent varchar(400) NULL,
                ip_address varchar(120) NULL,
                revoked_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_internal_sessions_user FOREIGN KEY (internal_user_id) REFERENCES internal_users(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_internal_sessions_access_token_hash ON internal_sessions(access_token_hash);
            CREATE INDEX IF NOT EXISTS ix_internal_sessions_user_created ON internal_sessions(internal_user_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS admin_action_requests (
                id uuid PRIMARY KEY,
                requested_by_internal_user_id uuid NOT NULL,
                action_code varchar(120) NOT NULL,
                target_type varchar(80) NOT NULL,
                target_id varchar(120) NOT NULL,
                reason varchar(500) NOT NULL,
                status varchar(30) NOT NULL DEFAULT 'recorded',
                requires_approval boolean NOT NULL DEFAULT false,
                metadata_json text NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_admin_action_requests_user FOREIGN KEY (requested_by_internal_user_id) REFERENCES internal_users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_admin_action_requests_action_created ON admin_action_requests(action_code, created_at DESC);

            CREATE TABLE IF NOT EXISTS admin_action_approvals (
                id uuid PRIMARY KEY,
                admin_action_request_id uuid NOT NULL,
                approved_by_internal_user_id uuid NOT NULL,
                decision varchar(30) NOT NULL,
                note varchar(500) NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_admin_action_approvals_request FOREIGN KEY (admin_action_request_id) REFERENCES admin_action_requests(id) ON DELETE CASCADE,
                CONSTRAINT fk_admin_action_approvals_user FOREIGN KEY (approved_by_internal_user_id) REFERENCES internal_users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_admin_action_approvals_request_created ON admin_action_approvals(admin_action_request_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS support_access_sessions (
                id uuid PRIMARY KEY,
                internal_user_id uuid NOT NULL,
                tenant_id uuid NOT NULL,
                access_mode varchar(40) NOT NULL,
                reason varchar(500) NOT NULL,
                status varchar(30) NOT NULL DEFAULT 'active',
                expires_at timestamptz NOT NULL,
                ended_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_support_access_sessions_user FOREIGN KEY (internal_user_id) REFERENCES internal_users(id) ON DELETE CASCADE,
                CONSTRAINT fk_support_access_sessions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_support_access_sessions_user_created ON support_access_sessions(internal_user_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS deployment_records (
                id uuid PRIMARY KEY,
                environment varchar(40) NOT NULL,
                service_name varchar(80) NOT NULL,
                version varchar(40) NOT NULL,
                commit_sha varchar(80) NOT NULL,
                status varchar(30) NOT NULL,
                release_channel varchar(30) NOT NULL,
                artifact_type varchar(30) NOT NULL,
                correlation_id varchar(120) NULL,
                metadata_json text NULL,
                created_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS ix_deployment_records_environment_service_created ON deployment_records(environment, service_name, created_at DESC);

            CREATE TABLE IF NOT EXISTS service_versions (
                id uuid PRIMARY KEY,
                environment varchar(40) NOT NULL,
                service_name varchar(80) NOT NULL,
                version varchar(40) NOT NULL,
                minimum_supported_version varchar(40) NOT NULL,
                rollout_state varchar(30) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS ix_service_versions_environment_service ON service_versions(environment, service_name);

            CREATE TABLE IF NOT EXISTS rollout_records (
                id uuid PRIMARY KEY,
                environment varchar(40) NOT NULL,
                channel varchar(30) NOT NULL,
                target_type varchar(40) NOT NULL,
                target_version varchar(40) NOT NULL,
                status varchar(30) NOT NULL,
                compatibility_window varchar(120) NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS ix_rollout_records_env_channel_target ON rollout_records(environment, channel, target_type, target_version);

            CREATE TABLE IF NOT EXISTS runbook_records (
                id uuid PRIMARY KEY,
                code varchar(120) NOT NULL,
                title varchar(180) NOT NULL,
                category varchar(60) NOT NULL,
                severity varchar(20) NOT NULL,
                markdown_path varchar(260) NOT NULL,
                status varchar(30) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_runbook_records_code ON runbook_records(code);

            CREATE TABLE IF NOT EXISTS slo_definitions (
                id uuid PRIMARY KEY,
                environment varchar(40) NOT NULL,
                service_name varchar(80) NOT NULL,
                slo_code varchar(120) NOT NULL,
                objective varchar(160) NOT NULL,
                measurement_window varchar(40) NOT NULL,
                alert_policy varchar(240) NOT NULL,
                status varchar(30) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_slo_definitions_env_service_code ON slo_definitions(environment, service_name, slo_code);

            CREATE TABLE IF NOT EXISTS rate_limit_policies (
                id uuid PRIMARY KEY,
                policy_code varchar(120) NOT NULL,
                scope varchar(60) NOT NULL,
                target varchar(120) NOT NULL,
                limit_summary varchar(240) NOT NULL,
                status varchar(30) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_rate_limit_policies_code ON rate_limit_policies(policy_code);

            CREATE TABLE IF NOT EXISTS retention_policies (
                id uuid PRIMARY KEY,
                policy_code varchar(120) NOT NULL,
                data_class varchar(80) NOT NULL,
                hot_retention varchar(80) NOT NULL,
                archive_retention varchar(80) NOT NULL,
                disposal_policy varchar(200) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_retention_policies_code ON retention_policies(policy_code);

            CREATE TABLE IF NOT EXISTS environment_configs (
                id uuid PRIMARY KEY,
                environment varchar(40) NOT NULL,
                config_key varchar(120) NOT NULL,
                value_kind varchar(30) NOT NULL,
                is_secret_reference boolean NOT NULL DEFAULT false,
                value_preview varchar(200) NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_environment_configs_env_key ON environment_configs(environment, config_key);

            CREATE TABLE IF NOT EXISTS secret_references (
                id uuid PRIMARY KEY,
                environment varchar(40) NOT NULL,
                secret_name varchar(120) NOT NULL,
                provider varchar(40) NOT NULL,
                rotation_policy varchar(80) NOT NULL,
                last_rotated_at timestamptz NULL,
                status varchar(30) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_secret_references_env_name ON secret_references(environment, secret_name);

            CREATE TABLE IF NOT EXISTS dependency_status_records (
                id uuid PRIMARY KEY,
                environment varchar(40) NOT NULL,
                dependency_code varchar(80) NOT NULL,
                status varchar(30) NOT NULL,
                last_error_summary varchar(300) NULL,
                last_success_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_dependency_status_records_env_code ON dependency_status_records(environment, dependency_code);

            CREATE TABLE IF NOT EXISTS migration_runs (
                id uuid PRIMARY KEY,
                environment varchar(40) NOT NULL,
                migration_name varchar(180) NOT NULL,
                status varchar(30) NOT NULL,
                verification_summary varchar(500) NULL,
                started_at timestamptz NOT NULL,
                completed_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS ix_migration_runs_env_name_created ON migration_runs(environment, migration_name, created_at DESC);

            CREATE TABLE IF NOT EXISTS backup_runs (
                id uuid PRIMARY KEY,
                environment varchar(40) NOT NULL,
                backup_type varchar(40) NOT NULL,
                status varchar(30) NOT NULL,
                region varchar(60) NOT NULL,
                retention_policy varchar(120) NOT NULL,
                artifact_reference varchar(240) NULL,
                started_at timestamptz NOT NULL,
                completed_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS ix_backup_runs_env_type_created ON backup_runs(environment, backup_type, created_at DESC);

            CREATE TABLE IF NOT EXISTS restore_validation_runs (
                id uuid PRIMARY KEY,
                backup_run_id uuid NULL,
                environment varchar(40) NOT NULL,
                status varchar(30) NOT NULL,
                validation_type varchar(50) NOT NULL,
                findings_json text NULL,
                started_at timestamptz NOT NULL,
                completed_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_restore_validation_runs_backup FOREIGN KEY (backup_run_id) REFERENCES backup_runs(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS ix_restore_validation_runs_env_created ON restore_validation_runs(environment, created_at DESC);

            CREATE TABLE IF NOT EXISTS incident_records (
                id uuid PRIMARY KEY,
                environment varchar(40) NOT NULL,
                severity varchar(20) NOT NULL,
                title varchar(180) NOT NULL,
                status varchar(30) NOT NULL,
                category varchar(60) NOT NULL,
                impact_summary varchar(600) NULL,
                owner varchar(120) NULL,
                linked_runbook_code varchar(120) NULL,
                opened_at timestamptz NOT NULL,
                resolved_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS ix_incident_records_env_status_opened ON incident_records(environment, status, opened_at DESC);

            CREATE TABLE IF NOT EXISTS incident_timeline_events (
                id uuid PRIMARY KEY,
                incident_record_id uuid NOT NULL,
                event_type varchar(60) NOT NULL,
                summary varchar(500) NOT NULL,
                metadata_json text NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_incident_timeline_events_incident FOREIGN KEY (incident_record_id) REFERENCES incident_records(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_incident_timeline_events_incident_created ON incident_timeline_events(incident_record_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS alert_rules (
                id uuid PRIMARY KEY,
                environment varchar(40) NOT NULL,
                code varchar(120) NOT NULL,
                severity varchar(20) NOT NULL,
                threshold_summary varchar(300) NOT NULL,
                status varchar(30) NOT NULL,
                runbook_code varchar(120) NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_alert_rules_env_code ON alert_rules(environment, code);

            CREATE TABLE IF NOT EXISTS alert_events (
                id uuid PRIMARY KEY,
                alert_rule_id uuid NULL,
                environment varchar(40) NOT NULL,
                severity varchar(20) NOT NULL,
                summary varchar(300) NOT NULL,
                status varchar(30) NOT NULL,
                triggered_at timestamptz NOT NULL,
                acknowledged_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_alert_events_rule FOREIGN KEY (alert_rule_id) REFERENCES alert_rules(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS ix_alert_events_env_triggered ON alert_events(environment, triggered_at DESC);

            CREATE TABLE IF NOT EXISTS capacity_snapshots (
                id uuid PRIMARY KEY,
                environment varchar(40) NOT NULL,
                resource_type varchar(60) NOT NULL,
                scope varchar(120) NOT NULL,
                utilization_summary varchar(300) NOT NULL,
                headroom_state varchar(30) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS ix_capacity_snapshots_env_resource_created ON capacity_snapshots(environment, resource_type, created_at DESC);

            CREATE TABLE IF NOT EXISTS security_events (
                id uuid PRIMARY KEY,
                environment varchar(40) NOT NULL,
                event_type varchar(80) NOT NULL,
                severity varchar(20) NOT NULL,
                summary varchar(300) NOT NULL,
                status varchar(30) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS ix_security_events_env_type_created ON security_events(environment, event_type, created_at DESC);

            CREATE TABLE IF NOT EXISTS abuse_flags (
                id uuid PRIMARY KEY,
                tenant_id uuid NULL,
                flag_type varchar(80) NOT NULL,
                severity varchar(20) NOT NULL,
                summary varchar(300) NOT NULL,
                status varchar(30) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_abuse_flags_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS ix_abuse_flags_tenant_flag_created ON abuse_flags(tenant_id, flag_type, created_at DESC);

            CREATE TABLE IF NOT EXISTS ops_audit_logs (
                id uuid PRIMARY KEY,
                actor_email varchar(320) NOT NULL,
                action varchar(120) NOT NULL,
                target_type varchar(80) NOT NULL,
                target_id varchar(120) NOT NULL,
                reason varchar(500) NULL,
                metadata_json text NULL,
                created_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS ix_ops_audit_logs_actor_created ON ops_audit_logs(actor_email, created_at DESC);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TABLE IF EXISTS ops_audit_logs;
            DROP TABLE IF EXISTS abuse_flags;
            DROP TABLE IF EXISTS security_events;
            DROP TABLE IF EXISTS capacity_snapshots;
            DROP TABLE IF EXISTS alert_events;
            DROP TABLE IF EXISTS alert_rules;
            DROP TABLE IF EXISTS incident_timeline_events;
            DROP TABLE IF EXISTS incident_records;
            DROP TABLE IF EXISTS restore_validation_runs;
            DROP TABLE IF EXISTS backup_runs;
            DROP TABLE IF EXISTS migration_runs;
            DROP TABLE IF EXISTS dependency_status_records;
            DROP TABLE IF EXISTS secret_references;
            DROP TABLE IF EXISTS environment_configs;
            DROP TABLE IF EXISTS retention_policies;
            DROP TABLE IF EXISTS rate_limit_policies;
            DROP TABLE IF EXISTS slo_definitions;
            DROP TABLE IF EXISTS runbook_records;
            DROP TABLE IF EXISTS rollout_records;
            DROP TABLE IF EXISTS service_versions;
            DROP TABLE IF EXISTS deployment_records;
            DROP TABLE IF EXISTS support_access_sessions;
            DROP TABLE IF EXISTS admin_action_approvals;
            DROP TABLE IF EXISTS admin_action_requests;
            DROP TABLE IF EXISTS internal_sessions;
            DROP TABLE IF EXISTS internal_user_roles;
            DROP TABLE IF EXISTS internal_users;
            """);
    }
}
