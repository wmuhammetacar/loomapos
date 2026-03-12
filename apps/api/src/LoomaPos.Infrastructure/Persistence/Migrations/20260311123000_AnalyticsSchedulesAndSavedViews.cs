using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace LoomaPos.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260311123000_AnalyticsSchedulesAndSavedViews")]
public partial class AnalyticsSchedulesAndSavedViews : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS analytics_report_schedules (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                name varchar(180) NOT NULL,
                report_code varchar(80) NOT NULL,
                frequency varchar(30) NOT NULL,
                format varchar(20) NOT NULL,
                timezone varchar(80) NOT NULL,
                recipients_json text NOT NULL,
                filters_json text NOT NULL,
                is_active boolean NOT NULL DEFAULT true,
                last_run_at timestamptz NULL,
                next_run_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_analytics_report_schedules_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_analytics_report_schedules_tenant_created ON analytics_report_schedules(tenant_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS analytics_saved_views (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                customer_account_id uuid NULL,
                scope varchar(30) NOT NULL,
                name varchar(180) NOT NULL,
                view_code varchar(80) NOT NULL,
                filters_json text NOT NULL,
                is_default boolean NOT NULL DEFAULT false,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_analytics_saved_views_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_analytics_saved_views_customer FOREIGN KEY (customer_account_id) REFERENCES customer_accounts(id) ON DELETE SET NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_analytics_saved_views_unique ON analytics_saved_views(tenant_id, customer_account_id, view_code, name);
            CREATE INDEX IF NOT EXISTS ix_analytics_saved_views_tenant_created ON analytics_saved_views(tenant_id, created_at DESC);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TABLE IF EXISTS analytics_saved_views;
            DROP TABLE IF EXISTS analytics_report_schedules;
            """);
    }
}
