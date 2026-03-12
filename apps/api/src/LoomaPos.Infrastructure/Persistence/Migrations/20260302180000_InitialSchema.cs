using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace LoomaPos.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260302180000_InitialSchema")]
public partial class InitialSchema : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS tenants (
                id uuid PRIMARY KEY,
                name varchar(200) NOT NULL,
                settings_json text NULL,
                created_at timestamptz NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS branches (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                name varchar(200) NOT NULL,
                address varchar(500) NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_branches_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ux_branches_tenant_name ON branches(tenant_id, name);

            CREATE TABLE IF NOT EXISTS users (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                email varchar(320) NOT NULL,
                name varchar(200) NOT NULL,
                is_active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ux_users_tenant_email ON users(tenant_id, email);

            CREATE TABLE IF NOT EXISTS roles (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                name varchar(100) NOT NULL,
                CONSTRAINT fk_roles_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ux_roles_tenant_name ON roles(tenant_id, name);

            CREATE TABLE IF NOT EXISTS user_roles (
                user_id uuid NOT NULL,
                role_id uuid NOT NULL,
                PRIMARY KEY (user_id, role_id),
                CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id bigserial PRIMARY KEY,
                tenant_id uuid NOT NULL,
                user_id uuid NULL,
                action varchar(100) NOT NULL,
                entity varchar(100) NOT NULL,
                entity_id varchar(100) NOT NULL,
                payload_json text NOT NULL DEFAULT '{}',
                created_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS ix_audit_logs_tenant_created ON audit_logs(tenant_id, created_at);

            CREATE TABLE IF NOT EXISTS devices (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                branch_id uuid NOT NULL,
                name varchar(150) NOT NULL,
                type varchar(50) NOT NULL,
                last_seen_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS ix_devices_tenant_branch_name ON devices(tenant_id, branch_id, name);

            CREATE TABLE IF NOT EXISTS categories (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                name varchar(200) NOT NULL,
                parent_id uuid NULL
            );
            CREATE INDEX IF NOT EXISTS ix_categories_tenant_name ON categories(tenant_id, name);

            CREATE TABLE IF NOT EXISTS products (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                name varchar(200) NOT NULL,
                sku varchar(100) NULL,
                barcode varchar(64) NULL,
                unit varchar(20) NOT NULL,
                tax_rate numeric(18,4) NOT NULL DEFAULT 0,
                is_active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ux_products_tenant_sku ON products(tenant_id, sku);
            CREATE INDEX IF NOT EXISTS ix_products_tenant_barcode ON products(tenant_id, barcode);

            CREATE TABLE IF NOT EXISTS product_barcodes (
                product_id uuid NOT NULL,
                barcode varchar(64) NOT NULL,
                PRIMARY KEY (product_id, barcode),
                CONSTRAINT fk_product_barcodes_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS stock_moves (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                branch_id uuid NOT NULL,
                product_id uuid NOT NULL,
                qty_delta numeric(18,4) NOT NULL,
                reason varchar(150) NOT NULL,
                ref_type varchar(100) NOT NULL,
                ref_id varchar(100) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS ix_stock_moves_tenant_branch_product_created
            ON stock_moves(tenant_id, branch_id, product_id, created_at);

            CREATE TABLE IF NOT EXISTS stock_balances (
                tenant_id uuid NOT NULL,
                branch_id uuid NOT NULL,
                product_id uuid NOT NULL,
                qty numeric(18,4) NOT NULL DEFAULT 0,
                PRIMARY KEY (tenant_id, branch_id, product_id)
            );

            CREATE TABLE IF NOT EXISTS sales (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                branch_id uuid NOT NULL,
                device_id uuid NOT NULL,
                receipt_no varchar(80) NOT NULL,
                status varchar(20) NOT NULL,
                subtotal numeric(18,2) NOT NULL,
                discount numeric(18,2) NOT NULL,
                tax numeric(18,2) NOT NULL,
                total numeric(18,2) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS ix_sales_tenant_branch_created ON sales(tenant_id, branch_id, created_at);
            CREATE INDEX IF NOT EXISTS ix_sales_tenant_receipt ON sales(tenant_id, receipt_no);

            CREATE TABLE IF NOT EXISTS sale_lines (
                id uuid PRIMARY KEY,
                sale_id uuid NOT NULL,
                product_id uuid NOT NULL,
                qty numeric(18,4) NOT NULL,
                unit_price numeric(18,2) NOT NULL,
                discount numeric(18,2) NOT NULL,
                tax numeric(18,2) NOT NULL,
                line_total numeric(18,2) NOT NULL,
                CONSTRAINT fk_sale_lines_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS payments (
                id uuid PRIMARY KEY,
                sale_id uuid NOT NULL,
                method varchar(20) NOT NULL,
                amount numeric(18,2) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_payments_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS contacts (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                type varchar(20) NOT NULL,
                name varchar(200) NOT NULL,
                phone varchar(40) NULL,
                email varchar(320) NULL,
                created_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS ix_contacts_tenant_type_name ON contacts(tenant_id, type, name);

            CREATE TABLE IF NOT EXISTS contact_ledger (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                contact_id uuid NOT NULL,
                amount_delta numeric(18,2) NOT NULL,
                reason varchar(150) NOT NULL,
                ref_type varchar(100) NOT NULL,
                ref_id varchar(100) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_contact_ledger_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_contact_ledger_tenant_contact_created ON contact_ledger(tenant_id, contact_id, created_at);

            CREATE TABLE IF NOT EXISTS cash_transactions (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                branch_id uuid NOT NULL,
                type varchar(20) NOT NULL,
                amount numeric(18,2) NOT NULL,
                reason varchar(150) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS ix_cash_transactions_tenant_branch_created ON cash_transactions(tenant_id, branch_id, created_at);

            CREATE TABLE IF NOT EXISTS processed_events (
                event_id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                device_id uuid NOT NULL,
                processed_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS ix_processed_events_tenant_device_processed ON processed_events(tenant_id, device_id, processed_at);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TABLE IF EXISTS processed_events;
            DROP TABLE IF EXISTS cash_transactions;
            DROP TABLE IF EXISTS contact_ledger;
            DROP TABLE IF EXISTS contacts;
            DROP TABLE IF EXISTS payments;
            DROP TABLE IF EXISTS sale_lines;
            DROP TABLE IF EXISTS sales;
            DROP TABLE IF EXISTS stock_balances;
            DROP TABLE IF EXISTS stock_moves;
            DROP TABLE IF EXISTS product_barcodes;
            DROP TABLE IF EXISTS products;
            DROP TABLE IF EXISTS categories;
            DROP TABLE IF EXISTS devices;
            DROP TABLE IF EXISTS audit_logs;
            DROP TABLE IF EXISTS user_roles;
            DROP TABLE IF EXISTS roles;
            DROP TABLE IF EXISTS users;
            DROP TABLE IF EXISTS branches;
            DROP TABLE IF EXISTS tenants;
            """);
    }
}
