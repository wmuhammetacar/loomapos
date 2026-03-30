using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace LoomaPos.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260330014000_PurchasingFoundation")]
public partial class PurchasingFoundation : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS suppliers (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                name varchar(200) NOT NULL,
                tax_number varchar(50) NULL,
                phone varchar(40) NULL,
                email varchar(320) NULL,
                is_active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_suppliers_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS ix_suppliers_tenant_name
                ON suppliers(tenant_id, name);

            CREATE TABLE IF NOT EXISTS purchase_orders (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                supplier_id uuid NOT NULL,
                warehouse_id uuid NOT NULL,
                status varchar(20) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                received_at timestamptz NULL,
                CONSTRAINT fk_purchase_orders_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_purchase_orders_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
                CONSTRAINT fk_purchase_orders_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
                CONSTRAINT ck_purchase_order_status CHECK (status IN ('draft', 'ordered', 'received', 'canceled'))
            );

            CREATE INDEX IF NOT EXISTS ix_purchase_orders_tenant_status_created
                ON purchase_orders(tenant_id, status, created_at);
            CREATE INDEX IF NOT EXISTS ix_purchase_orders_tenant_supplier_created
                ON purchase_orders(tenant_id, supplier_id, created_at);

            CREATE TABLE IF NOT EXISTS purchase_order_lines (
                id uuid PRIMARY KEY,
                purchase_order_id uuid NOT NULL,
                product_id uuid NOT NULL,
                quantity numeric(18,4) NOT NULL,
                unit_cost numeric(18,4) NOT NULL,
                CONSTRAINT fk_purchase_order_lines_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
                CONSTRAINT fk_purchase_order_lines_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
                CONSTRAINT ck_purchase_order_lines_qty CHECK (quantity > 0),
                CONSTRAINT ck_purchase_order_lines_unit_cost CHECK (unit_cost >= 0)
            );

            CREATE INDEX IF NOT EXISTS ix_purchase_order_lines_order_product
                ON purchase_order_lines(purchase_order_id, product_id);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TABLE IF EXISTS purchase_order_lines;
            DROP TABLE IF EXISTS purchase_orders;
            DROP TABLE IF EXISTS suppliers;
            """);
    }
}
