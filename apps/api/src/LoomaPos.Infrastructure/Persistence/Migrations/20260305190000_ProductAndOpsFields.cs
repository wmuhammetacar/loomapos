using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace LoomaPos.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260305190000_ProductAndOpsFields")]
public partial class ProductAndOpsFields : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id uuid NULL;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price numeric(18,2) NOT NULL DEFAULT 1;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price numeric(18,2) NOT NULL DEFAULT 0;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_tracking_enabled boolean NOT NULL DEFAULT true;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock numeric(18,4) NOT NULL DEFAULT 0;

            UPDATE products
            SET sale_price = 1
            WHERE sale_price <= 0;

            CREATE INDEX IF NOT EXISTS ix_products_tenant_category
            ON products(tenant_id, category_id);

            CREATE UNIQUE INDEX IF NOT EXISTS ux_products_tenant_barcode_unique
            ON products(tenant_id, barcode)
            WHERE barcode IS NOT NULL AND btrim(barcode) <> '';

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'fk_products_category'
                ) THEN
                    ALTER TABLE products
                    ADD CONSTRAINT fk_products_category
                    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
                END IF;
            END $$;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP INDEX IF EXISTS ux_products_tenant_barcode_unique;
            DROP INDEX IF EXISTS ix_products_tenant_category;

            ALTER TABLE products DROP CONSTRAINT IF EXISTS fk_products_category;
            ALTER TABLE products DROP COLUMN IF EXISTS min_stock;
            ALTER TABLE products DROP COLUMN IF EXISTS stock_tracking_enabled;
            ALTER TABLE products DROP COLUMN IF EXISTS purchase_price;
            ALTER TABLE products DROP COLUMN IF EXISTS sale_price;
            ALTER TABLE products DROP COLUMN IF EXISTS category_id;
            """);
    }
}
