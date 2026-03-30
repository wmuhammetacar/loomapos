using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace LoomaPos.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260330213000_ManufacturingPreparationFoundation")]
public partial class ManufacturingPreparationFoundation : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS bill_of_materials (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                product_id uuid NOT NULL,
                code varchar(80) NULL,
                version integer NOT NULL,
                is_active boolean NOT NULL DEFAULT false,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_bom_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_bom_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
                CONSTRAINT ck_bom_version_positive CHECK (version > 0)
            );

            CREATE UNIQUE INDEX IF NOT EXISTS ux_bom_tenant_product_version
                ON bill_of_materials(tenant_id, product_id, version);

            CREATE INDEX IF NOT EXISTS ix_bom_tenant_product_active
                ON bill_of_materials(tenant_id, product_id, is_active);

            CREATE UNIQUE INDEX IF NOT EXISTS ux_bom_single_active_per_product
                ON bill_of_materials(tenant_id, product_id)
                WHERE is_active = true;

            CREATE TABLE IF NOT EXISTS bill_of_material_lines (
                id uuid PRIMARY KEY,
                bom_id uuid NOT NULL,
                component_product_id uuid NOT NULL,
                quantity numeric(18,4) NOT NULL,
                CONSTRAINT fk_bom_line_bom FOREIGN KEY (bom_id) REFERENCES bill_of_materials(id) ON DELETE CASCADE,
                CONSTRAINT fk_bom_line_component_product FOREIGN KEY (component_product_id) REFERENCES products(id) ON DELETE RESTRICT,
                CONSTRAINT ck_bom_line_quantity_positive CHECK (quantity > 0)
            );

            CREATE UNIQUE INDEX IF NOT EXISTS ux_bom_line_component_unique
                ON bill_of_material_lines(bom_id, component_product_id);

            CREATE TABLE IF NOT EXISTS production_orders (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                bom_id uuid NULL,
                finished_product_id uuid NOT NULL,
                planned_quantity numeric(18,4) NOT NULL,
                status varchar(20) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_production_order_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_production_order_bom FOREIGN KEY (bom_id) REFERENCES bill_of_materials(id) ON DELETE SET NULL,
                CONSTRAINT fk_production_order_finished_product FOREIGN KEY (finished_product_id) REFERENCES products(id) ON DELETE RESTRICT,
                CONSTRAINT ck_production_order_status CHECK (status IN ('draft', 'planned', 'canceled')),
                CONSTRAINT ck_production_order_planned_quantity_positive CHECK (planned_quantity > 0)
            );

            CREATE INDEX IF NOT EXISTS ix_production_orders_tenant_status_created
                ON production_orders(tenant_id, status, created_at);

            CREATE INDEX IF NOT EXISTS ix_production_orders_tenant_product_created
                ON production_orders(tenant_id, finished_product_id, created_at);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TABLE IF EXISTS production_orders;
            DROP TABLE IF EXISTS bill_of_material_lines;
            DROP TABLE IF EXISTS bill_of_materials;
            """);
    }
}
