using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace LoomaPos.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260329193000_WarehouseFoundation")]
public partial class WarehouseFoundation : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS warehouses (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                name varchar(150) NOT NULL,
                type varchar(30) NOT NULL,
                is_active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_warehouses_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_warehouses_tenant_name ON warehouses(tenant_id, name);

            CREATE TABLE IF NOT EXISTS stock_by_warehouse (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                product_id uuid NOT NULL,
                warehouse_id uuid NOT NULL,
                quantity numeric(18,4) NOT NULL DEFAULT 0,
                updated_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_stock_by_warehouse_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_stock_by_warehouse_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                CONSTRAINT fk_stock_by_warehouse_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_stock_by_warehouse_tenant_product_warehouse
                ON stock_by_warehouse(tenant_id, product_id, warehouse_id);
            CREATE INDEX IF NOT EXISTS ix_stock_by_warehouse_tenant_warehouse_product
                ON stock_by_warehouse(tenant_id, warehouse_id, product_id);

            ALTER TABLE stock_moves ADD COLUMN IF NOT EXISTS warehouse_id uuid NULL;

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'fk_stock_moves_warehouse'
                ) THEN
                    ALTER TABLE stock_moves
                        ADD CONSTRAINT fk_stock_moves_warehouse
                        FOREIGN KEY (warehouse_id)
                        REFERENCES warehouses(id)
                        ON DELETE SET NULL;
                END IF;
            END $$;

            CREATE INDEX IF NOT EXISTS ix_stock_moves_tenant_warehouse_product_created
                ON stock_moves(tenant_id, warehouse_id, product_id, created_at);

            WITH tenant_defaults AS (
                SELECT
                    t.id AS tenant_id,
                    lower(md5('warehouse-default-' || t.id::text)) AS hash
                FROM tenants t
            )
            INSERT INTO warehouses (id, tenant_id, name, type, is_active, created_at)
            SELECT
                (
                    substr(td.hash, 1, 8) || '-' ||
                    substr(td.hash, 9, 4) || '-' ||
                    substr(td.hash, 13, 4) || '-' ||
                    substr(td.hash, 17, 4) || '-' ||
                    substr(td.hash, 21, 12)
                )::uuid,
                td.tenant_id,
                'DEFAULT',
                'main',
                true,
                now()
            FROM tenant_defaults td
            WHERE NOT EXISTS (
                SELECT 1
                FROM warehouses w
                WHERE w.tenant_id = td.tenant_id
                  AND w.name = 'DEFAULT'
            );

            WITH default_stock AS (
                SELECT
                    sb.tenant_id,
                    sb.product_id,
                    w.id AS warehouse_id,
                    sum(sb.qty) AS quantity,
                    lower(md5('warehouse-default-stock-' || sb.tenant_id::text || '-' || sb.product_id::text)) AS hash
                FROM stock_balances sb
                INNER JOIN warehouses w
                    ON w.tenant_id = sb.tenant_id
                   AND w.name = 'DEFAULT'
                GROUP BY sb.tenant_id, sb.product_id, w.id
            )
            INSERT INTO stock_by_warehouse (id, tenant_id, product_id, warehouse_id, quantity, updated_at)
            SELECT
                (
                    substr(ds.hash, 1, 8) || '-' ||
                    substr(ds.hash, 9, 4) || '-' ||
                    substr(ds.hash, 13, 4) || '-' ||
                    substr(ds.hash, 17, 4) || '-' ||
                    substr(ds.hash, 21, 12)
                )::uuid,
                ds.tenant_id,
                ds.product_id,
                ds.warehouse_id,
                ds.quantity,
                now()
            FROM default_stock ds
            ON CONFLICT (tenant_id, product_id, warehouse_id)
            DO UPDATE
            SET quantity = EXCLUDED.quantity,
                updated_at = EXCLUDED.updated_at;

            UPDATE stock_moves sm
            SET warehouse_id = w.id
            FROM warehouses w
            WHERE sm.warehouse_id IS NULL
              AND w.tenant_id = sm.tenant_id
              AND w.name = 'DEFAULT';
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP INDEX IF EXISTS ix_stock_moves_tenant_warehouse_product_created;
            ALTER TABLE stock_moves DROP CONSTRAINT IF EXISTS fk_stock_moves_warehouse;
            ALTER TABLE stock_moves DROP COLUMN IF EXISTS warehouse_id;
            DROP TABLE IF EXISTS stock_by_warehouse;
            DROP TABLE IF EXISTS warehouses;
            """);
    }
}
