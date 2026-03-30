using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace LoomaPos.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260330194000_AccountingBridgeFoundation")]
public partial class AccountingBridgeFoundation : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS accounting_export_items (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                source_type varchar(40) NOT NULL,
                source_id varchar(120) NOT NULL,
                event_code varchar(80) NOT NULL,
                payload_json text NOT NULL,
                status varchar(20) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                exported_at timestamptz NULL,
                failure_reason varchar(600) NULL,
                CONSTRAINT fk_accounting_export_items_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT ck_accounting_export_items_source_type CHECK (source_type IN (
                    'sale',
                    'sale_reversal',
                    'cash_movement',
                    'purchase_receipt',
                    'customer_collection',
                    'customer_account_adjustment'
                )),
                CONSTRAINT ck_accounting_export_items_status CHECK (status IN ('pending', 'exported', 'failed'))
            );

            CREATE INDEX IF NOT EXISTS ix_accounting_export_items_tenant_status_created
                ON accounting_export_items(tenant_id, status, created_at);

            CREATE UNIQUE INDEX IF NOT EXISTS ux_accounting_export_items_source
                ON accounting_export_items(tenant_id, source_type, source_id);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TABLE IF EXISTS accounting_export_items;
            """);
    }
}
