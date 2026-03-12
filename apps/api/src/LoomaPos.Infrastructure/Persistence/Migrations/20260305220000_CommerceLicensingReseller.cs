using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace LoomaPos.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260305220000_CommerceLicensingReseller")]
public partial class CommerceLicensingReseller : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS plans (
                id uuid PRIMARY KEY,
                code varchar(50) NOT NULL UNIQUE,
                name varchar(150) NOT NULL,
                monthly_price numeric(18,2) NOT NULL DEFAULT 0,
                yearly_price numeric(18,2) NOT NULL DEFAULT 0,
                max_branches int NULL,
                max_users int NULL,
                max_devices int NULL,
                features_json text NOT NULL DEFAULT '[]',
                is_active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS subscriptions (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                plan_code varchar(50) NOT NULL,
                billing_cycle varchar(20) NOT NULL,
                status varchar(30) NOT NULL,
                current_period_start timestamptz NOT NULL,
                current_period_end timestamptz NOT NULL,
                reseller_code varchar(50) NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_subscriptions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_subscriptions_tenant_status_created
            ON subscriptions(tenant_id, status, created_at DESC);

            CREATE TABLE IF NOT EXISTS invoices (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                subscription_id uuid NOT NULL,
                invoice_no varchar(80) NOT NULL UNIQUE,
                total numeric(18,2) NOT NULL,
                currency varchar(8) NOT NULL DEFAULT 'TRY',
                status varchar(30) NOT NULL,
                issued_at timestamptz NOT NULL,
                paid_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_invoices_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_invoices_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_invoices_tenant_created ON invoices(tenant_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS subscription_payments (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                subscription_id uuid NOT NULL,
                invoice_id uuid NOT NULL,
                provider varchar(40) NOT NULL,
                payment_ref varchar(120) NOT NULL,
                status varchar(30) NOT NULL,
                amount numeric(18,2) NOT NULL,
                currency varchar(8) NOT NULL DEFAULT 'TRY',
                paid_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_sub_payments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_sub_payments_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
                CONSTRAINT fk_sub_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_sub_payments_tenant_created ON subscription_payments(tenant_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS ix_sub_payments_payment_ref ON subscription_payments(payment_ref);

            CREATE TABLE IF NOT EXISTS payment_webhooks (
                id uuid PRIMARY KEY,
                provider varchar(40) NOT NULL,
                event_id varchar(150) NOT NULL,
                payload_json text NOT NULL,
                status varchar(30) NOT NULL DEFAULT 'received',
                error text NULL,
                received_at timestamptz NOT NULL DEFAULT now(),
                processed_at timestamptz NULL
            );
            CREATE INDEX IF NOT EXISTS ix_payment_webhooks_provider_event ON payment_webhooks(provider, event_id);

            CREATE TABLE IF NOT EXISTS licenses (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                subscription_id uuid NOT NULL,
                plan_code varchar(50) NOT NULL,
                license_token text NOT NULL,
                features_json text NOT NULL,
                device_limit int NULL,
                issued_at timestamptz NOT NULL,
                expires_at timestamptz NOT NULL,
                grace_days int NOT NULL DEFAULT 7,
                status varchar(30) NOT NULL DEFAULT 'active',
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_licenses_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_licenses_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_licenses_tenant_status_exp
            ON licenses(tenant_id, status, expires_at DESC);

            CREATE TABLE IF NOT EXISTS license_events (
                id bigserial PRIMARY KEY,
                tenant_id uuid NOT NULL,
                license_id uuid NOT NULL,
                event_type varchar(80) NOT NULL,
                payload_json text NOT NULL DEFAULT '{}',
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_license_events_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_license_events_license FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_license_events_tenant_created ON license_events(tenant_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS device_activations (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                device_id uuid NOT NULL,
                device_name varchar(150) NOT NULL,
                platform varchar(40) NOT NULL,
                app_version varchar(40) NULL,
                activation_source varchar(40) NOT NULL DEFAULT 'desktop',
                activated_at timestamptz NOT NULL DEFAULT now(),
                last_seen_at timestamptz NOT NULL DEFAULT now(),
                revoked_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_device_activations_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ux_device_activations_tenant_device
            ON device_activations(tenant_id, device_id);
            CREATE INDEX IF NOT EXISTS ix_device_activations_tenant_revoked
            ON device_activations(tenant_id, revoked_at);

            CREATE TABLE IF NOT EXISTS reseller_accounts (
                id uuid PRIMARY KEY,
                code varchar(50) NOT NULL UNIQUE,
                name varchar(200) NOT NULL,
                email varchar(320) NOT NULL,
                status varchar(30) NOT NULL DEFAULT 'pending',
                commission_rate numeric(8,4) NOT NULL DEFAULT 0.10,
                approved_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS ix_reseller_accounts_email ON reseller_accounts(email);

            CREATE TABLE IF NOT EXISTS reseller_customers (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                reseller_id uuid NOT NULL,
                referred_at timestamptz NOT NULL DEFAULT now(),
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_reseller_customers_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_reseller_customers_reseller FOREIGN KEY (reseller_id) REFERENCES reseller_accounts(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ux_reseller_customers_reseller_tenant
            ON reseller_customers(reseller_id, tenant_id);

            CREATE TABLE IF NOT EXISTS commissions (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                reseller_id uuid NOT NULL,
                subscription_id uuid NOT NULL,
                invoice_id uuid NOT NULL,
                rate numeric(8,4) NOT NULL,
                amount numeric(18,2) NOT NULL,
                status varchar(30) NOT NULL DEFAULT 'accrued',
                accrued_at timestamptz NOT NULL DEFAULT now(),
                paid_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_commissions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_commissions_reseller FOREIGN KEY (reseller_id) REFERENCES reseller_accounts(id) ON DELETE CASCADE,
                CONSTRAINT fk_commissions_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
                CONSTRAINT fk_commissions_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_commissions_reseller_status_created
            ON commissions(reseller_id, status, created_at DESC);

            CREATE TABLE IF NOT EXISTS payouts (
                id uuid PRIMARY KEY,
                reseller_id uuid NOT NULL,
                period_start timestamptz NOT NULL,
                period_end timestamptz NOT NULL,
                total numeric(18,2) NOT NULL,
                status varchar(30) NOT NULL DEFAULT 'pending',
                created_at timestamptz NOT NULL DEFAULT now(),
                paid_at timestamptz NULL,
                CONSTRAINT fk_payouts_reseller FOREIGN KEY (reseller_id) REFERENCES reseller_accounts(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_payouts_reseller_created ON payouts(reseller_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS checkout_sessions (
                id uuid PRIMARY KEY,
                tenant_id uuid NULL,
                company_name varchar(200) NOT NULL,
                email varchar(320) NOT NULL,
                plan_code varchar(50) NOT NULL,
                billing_cycle varchar(20) NOT NULL,
                reseller_code varchar(50) NULL,
                amount numeric(18,2) NOT NULL,
                currency varchar(8) NOT NULL DEFAULT 'TRY',
                status varchar(30) NOT NULL DEFAULT 'created',
                completed_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_checkout_sessions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS ix_checkout_sessions_created ON checkout_sessions(created_at DESC);

            CREATE TABLE IF NOT EXISTS product_variants (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                product_id uuid NOT NULL,
                name varchar(160) NOT NULL,
                sku varchar(100) NULL,
                barcode varchar(64) NULL,
                attributes_json text NOT NULL DEFAULT '{}',
                price_delta numeric(18,2) NOT NULL DEFAULT 0,
                stock_tracking_enabled boolean NOT NULL DEFAULT true,
                is_active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_product_variants_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_product_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_product_variants_tenant_product ON product_variants(tenant_id, product_id);
            CREATE INDEX IF NOT EXISTS ix_product_variants_tenant_barcode ON product_variants(tenant_id, barcode);

            INSERT INTO plans(id, code, name, monthly_price, yearly_price, max_branches, max_users, max_devices, features_json, is_active)
            VALUES
              ('10000000-0000-0000-0000-000000000001', 'starter', 'Starter', 499, 4990, 1, 3, 1, '["sales","inventory","reports","mobile"]', true),
              ('10000000-0000-0000-0000-000000000002', 'pro', 'Pro', 999, 9990, 5, 10, 5, '["sales","inventory","reports","mobile","online_collection","variants"]', true),
              ('10000000-0000-0000-0000-000000000003', 'enterprise', 'Enterprise', 0, 0, NULL, NULL, NULL, '["all"]', true)
            ON CONFLICT (code) DO UPDATE SET
              name = EXCLUDED.name,
              monthly_price = EXCLUDED.monthly_price,
              yearly_price = EXCLUDED.yearly_price,
              max_branches = EXCLUDED.max_branches,
              max_users = EXCLUDED.max_users,
              max_devices = EXCLUDED.max_devices,
              features_json = EXCLUDED.features_json,
              is_active = EXCLUDED.is_active;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TABLE IF EXISTS checkout_sessions;
            DROP TABLE IF EXISTS product_variants;
            DROP TABLE IF EXISTS payouts;
            DROP TABLE IF EXISTS commissions;
            DROP TABLE IF EXISTS reseller_customers;
            DROP TABLE IF EXISTS reseller_accounts;
            DROP TABLE IF EXISTS device_activations;
            DROP TABLE IF EXISTS license_events;
            DROP TABLE IF EXISTS licenses;
            DROP TABLE IF EXISTS payment_webhooks;
            DROP TABLE IF EXISTS subscription_payments;
            DROP TABLE IF EXISTS invoices;
            DROP TABLE IF EXISTS subscriptions;
            DROP TABLE IF EXISTS plans;
            """);
    }
}
