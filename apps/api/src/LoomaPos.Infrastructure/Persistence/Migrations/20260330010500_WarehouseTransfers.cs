using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace LoomaPos.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260330010500_WarehouseTransfers")]
public partial class WarehouseTransfers : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS warehouse_transfers (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                from_warehouse_id uuid NOT NULL,
                to_warehouse_id uuid NOT NULL,
                status varchar(20) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                completed_at timestamptz NULL,
                CONSTRAINT fk_warehouse_transfers_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_warehouse_transfers_from_warehouse FOREIGN KEY (from_warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
                CONSTRAINT fk_warehouse_transfers_to_warehouse FOREIGN KEY (to_warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
                CONSTRAINT ck_warehouse_transfer_warehouses_distinct CHECK (from_warehouse_id <> to_warehouse_id),
                CONSTRAINT ck_warehouse_transfer_status CHECK (status IN ('draft', 'in_transit', 'completed', 'canceled'))
            );

            CREATE TABLE IF NOT EXISTS warehouse_transfer_lines (
                id uuid PRIMARY KEY,
                transfer_id uuid NOT NULL,
                product_id uuid NOT NULL,
                quantity numeric(18,4) NOT NULL,
                CONSTRAINT fk_warehouse_transfer_lines_transfer FOREIGN KEY (transfer_id) REFERENCES warehouse_transfers(id) ON DELETE CASCADE,
                CONSTRAINT fk_warehouse_transfer_lines_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
                CONSTRAINT ck_warehouse_transfer_line_quantity CHECK (quantity > 0)
            );

            CREATE INDEX IF NOT EXISTS ix_warehouse_transfers_tenant_status_created
                ON warehouse_transfers(tenant_id, status, created_at);

            CREATE INDEX IF NOT EXISTS ix_warehouse_transfers_tenant_created
                ON warehouse_transfers(tenant_id, created_at);

            CREATE INDEX IF NOT EXISTS ix_warehouse_transfer_lines_transfer_product
                ON warehouse_transfer_lines(transfer_id, product_id);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TABLE IF EXISTS warehouse_transfer_lines;
            DROP TABLE IF EXISTS warehouse_transfers;
            """);
    }
}
