using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace LoomaPos.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260307143000_Phase2CommerceCore")]
public partial class Phase2CommerceCore : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tenant_code varchar(80) NULL;
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_email varchar(320) NULL;
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tax_office varchar(120) NULL;
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tax_number varchar(50) NULL;
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS country varchar(8) NULL;
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS default_locale varchar(20) NULL;
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status varchar(30) NULL;
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

            UPDATE tenants
            SET tenant_code = COALESCE(NULLIF(tenant_code, ''), 'TENANT-' || upper(substr(replace(id::text, '-', ''), 1, 8))),
                billing_email = COALESCE(NULLIF(billing_email, ''), 'billing+' || lower(substr(replace(id::text, '-', ''), 1, 8)) || '@loomapos.local'),
                country = COALESCE(NULLIF(country, ''), 'TR'),
                default_locale = COALESCE(NULLIF(default_locale, ''), 'tr-TR'),
                status = COALESCE(NULLIF(status, ''), 'active');

            ALTER TABLE tenants ALTER COLUMN tenant_code SET NOT NULL;
            ALTER TABLE tenants ALTER COLUMN billing_email SET NOT NULL;
            ALTER TABLE tenants ALTER COLUMN country SET NOT NULL;
            ALTER TABLE tenants ALTER COLUMN default_locale SET NOT NULL;
            ALTER TABLE tenants ALTER COLUMN status SET NOT NULL;

            CREATE UNIQUE INDEX IF NOT EXISTS ix_tenants_tenant_code ON tenants(tenant_code);
            CREATE INDEX IF NOT EXISTS ix_tenants_billing_email ON tenants(billing_email);

            ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_profile_id uuid NULL;
            ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS renewal_date timestamptz NULL;
            ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;
            ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz NULL;
            ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS grace_ends_at timestamptz NULL;
            ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS canceled_at timestamptz NULL;
            ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_subscription_id varchar(150) NULL;
            ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_customer_reference varchar(150) NULL;
            ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_snapshot_json text NOT NULL DEFAULT '{}';
            ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

            UPDATE subscriptions
            SET renewal_date = COALESCE(renewal_date, current_period_end, created_at);

            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_profile_id uuid NULL;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS description varchar(500) NULL;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal numeric(18,2) NOT NULL DEFAULT 0;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount numeric(18,2) NOT NULL DEFAULT 0;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_at timestamptz NULL;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_period_start timestamptz NULL;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_period_end timestamptz NULL;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS provider_invoice_reference varchar(150) NULL;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_url varchar(500) NULL;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

            UPDATE invoices
            SET description = COALESCE(NULLIF(description, ''), 'Subscription invoice'),
                subtotal = CASE WHEN subtotal = 0 THEN total ELSE subtotal END,
                due_at = COALESCE(due_at, issued_at),
                billing_period_start = COALESCE(billing_period_start, issued_at),
                billing_period_end = COALESCE(billing_period_end, paid_at, issued_at),
                pdf_url = COALESCE(NULLIF(pdf_url, ''), '/commerce/portal/billing/' || id::text || '/pdf');

            ALTER TABLE invoices ALTER COLUMN description SET NOT NULL;

            ALTER TABLE licenses ADD COLUMN IF NOT EXISTS license_key varchar(120) NULL;
            ALTER TABLE licenses ADD COLUMN IF NOT EXISTS signature varchar(256) NULL;

            UPDATE licenses
            SET license_key = COALESCE(NULLIF(license_key, ''), 'LMA-' || upper(substr(md5(id::text), 1, 6)) || '-' || upper(substr(md5(id::text), 7, 6))),
                signature = COALESCE(NULLIF(signature, ''), md5(license_token));

            ALTER TABLE licenses ALTER COLUMN license_key SET NOT NULL;
            ALTER TABLE licenses ALTER COLUMN signature SET NOT NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS ix_licenses_license_key ON licenses(license_key);

            ALTER TABLE device_activations ADD COLUMN IF NOT EXISTS license_id uuid NULL;
            ALTER TABLE device_activations ADD COLUMN IF NOT EXISTS status varchar(30) NOT NULL DEFAULT 'active';
            ALTER TABLE device_activations ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

            ALTER TABLE reseller_accounts ADD COLUMN IF NOT EXISTS password_hash text NULL;
            ALTER TABLE reseller_accounts ADD COLUMN IF NOT EXISTS last_login_at timestamptz NULL;
            ALTER TABLE reseller_accounts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

            ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS customer_account_id uuid NULL;
            ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS subscription_id uuid NULL;
            ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS billing_profile_id uuid NULL;
            ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS license_id uuid NULL;
            ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS checkout_reference varchar(80) NULL;
            ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS contact_name varchar(200) NULL;
            ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS phone varchar(40) NULL;
            ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS provider varchar(40) NULL;
            ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS provider_session_id varchar(150) NULL;
            ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS provider_payment_reference varchar(150) NULL;
            ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS coupon_code varchar(50) NULL;
            ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS tax_amount numeric(18,2) NOT NULL DEFAULT 0;
            ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS payment_status varchar(30) NOT NULL DEFAULT 'pending';
            ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS checkout_payload_json text NOT NULL DEFAULT '{}';
            ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS billing_payload_json text NOT NULL DEFAULT '{}';
            ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS idempotency_key varchar(120) NULL;
            ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS provisioned_at timestamptz NULL;
            ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS error text NULL;
            ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

            UPDATE checkout_sessions
            SET checkout_reference = COALESCE(NULLIF(checkout_reference, ''), 'CHK-' || upper(substr(replace(id::text, '-', ''), 1, 12))),
                contact_name = COALESCE(NULLIF(contact_name, ''), company_name),
                provider = COALESCE(NULLIF(provider, ''), 'mock'),
                payment_status = CASE
                    WHEN payment_status IS NOT NULL AND payment_status <> '' THEN payment_status
                    WHEN completed_at IS NOT NULL THEN 'paid'
                    ELSE 'pending'
                END;

            ALTER TABLE checkout_sessions ALTER COLUMN checkout_reference SET NOT NULL;
            ALTER TABLE checkout_sessions ALTER COLUMN contact_name SET NOT NULL;
            ALTER TABLE checkout_sessions ALTER COLUMN provider SET NOT NULL;

            CREATE UNIQUE INDEX IF NOT EXISTS ix_checkout_sessions_checkout_reference ON checkout_sessions(checkout_reference);
            CREATE INDEX IF NOT EXISTS ix_checkout_sessions_provider_payment_reference ON checkout_sessions(provider_payment_reference);
            CREATE INDEX IF NOT EXISTS ix_checkout_sessions_idempotency_key ON checkout_sessions(idempotency_key);

            CREATE TABLE IF NOT EXISTS customer_accounts (
                id uuid PRIMARY KEY,
                email varchar(320) NOT NULL,
                password_hash text NOT NULL,
                full_name varchar(200) NOT NULL,
                phone varchar(40) NULL,
                account_status varchar(30) NOT NULL DEFAULT 'active',
                email_verified_at timestamptz NULL,
                last_login_at timestamptz NULL,
                password_reset_token_hash text NULL,
                password_reset_expires_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_customer_accounts_email ON customer_accounts(email);
            CREATE INDEX IF NOT EXISTS ix_customer_accounts_status_created ON customer_accounts(account_status, created_at DESC);

            CREATE TABLE IF NOT EXISTS portal_sessions (
                id uuid PRIMARY KEY,
                customer_account_id uuid NULL,
                reseller_account_id uuid NULL,
                tenant_id uuid NULL,
                portal_type varchar(30) NOT NULL,
                role_code varchar(50) NOT NULL,
                access_token_hash text NOT NULL,
                refresh_token_hash text NOT NULL,
                expires_at timestamptz NOT NULL,
                refresh_expires_at timestamptz NOT NULL,
                user_agent varchar(500) NULL,
                ip_address varchar(80) NULL,
                revoked_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_portal_sessions_customer FOREIGN KEY (customer_account_id) REFERENCES customer_accounts(id) ON DELETE CASCADE,
                CONSTRAINT fk_portal_sessions_reseller FOREIGN KEY (reseller_account_id) REFERENCES reseller_accounts(id) ON DELETE CASCADE,
                CONSTRAINT fk_portal_sessions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_portal_sessions_access_token_hash ON portal_sessions(access_token_hash);
            CREATE UNIQUE INDEX IF NOT EXISTS ix_portal_sessions_refresh_token_hash ON portal_sessions(refresh_token_hash);
            CREATE INDEX IF NOT EXISTS ix_portal_sessions_customer_revoked ON portal_sessions(customer_account_id, revoked_at);

            CREATE TABLE IF NOT EXISTS tenant_users (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                customer_account_id uuid NOT NULL,
                role_code varchar(50) NOT NULL,
                is_owner boolean NOT NULL DEFAULT false,
                status varchar(30) NOT NULL DEFAULT 'active',
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_tenant_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_tenant_users_customer FOREIGN KEY (customer_account_id) REFERENCES customer_accounts(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_tenant_users_tenant_customer ON tenant_users(tenant_id, customer_account_id);
            CREATE INDEX IF NOT EXISTS ix_tenant_users_tenant_role ON tenant_users(tenant_id, role_code);

            CREATE TABLE IF NOT EXISTS subscription_plans (
                id uuid PRIMARY KEY,
                code varchar(50) NOT NULL,
                name varchar(150) NOT NULL,
                description varchar(500) NOT NULL,
                branch_limit int NULL,
                user_limit int NULL,
                device_limit int NULL,
                support_tier varchar(60) NOT NULL,
                reseller_commission_eligibility boolean NOT NULL DEFAULT false,
                is_public boolean NOT NULL DEFAULT true,
                is_active boolean NOT NULL DEFAULT true,
                highlight_label varchar(120) NOT NULL DEFAULT '',
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_subscription_plans_code ON subscription_plans(code);
            CREATE INDEX IF NOT EXISTS ix_subscription_plans_public_active ON subscription_plans(is_public, is_active);

            CREATE TABLE IF NOT EXISTS plan_prices (
                id uuid PRIMARY KEY,
                subscription_plan_id uuid NOT NULL,
                billing_period varchar(20) NOT NULL,
                currency varchar(8) NOT NULL DEFAULT 'TRY',
                amount numeric(18,2) NOT NULL,
                promo_amount numeric(18,2) NULL,
                external_price_id varchar(150) NULL,
                trial_days int NOT NULL DEFAULT 0,
                is_active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_plan_prices_plan FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_plan_prices_plan_period_currency ON plan_prices(subscription_plan_id, billing_period, currency);

            CREATE TABLE IF NOT EXISTS feature_flags (
                id uuid PRIMARY KEY,
                code varchar(80) NOT NULL,
                name varchar(150) NOT NULL,
                description varchar(500) NOT NULL,
                is_public boolean NOT NULL DEFAULT true,
                is_active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_feature_flags_code ON feature_flags(code);

            CREATE TABLE IF NOT EXISTS plan_feature_flags (
                id uuid PRIMARY KEY,
                subscription_plan_id uuid NOT NULL,
                feature_flag_id uuid NOT NULL,
                is_enabled boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_plan_feature_flags_plan FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE,
                CONSTRAINT fk_plan_feature_flags_flag FOREIGN KEY (feature_flag_id) REFERENCES feature_flags(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_plan_feature_flags_plan_flag ON plan_feature_flags(subscription_plan_id, feature_flag_id);

            CREATE TABLE IF NOT EXISTS billing_profiles (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                customer_account_id uuid NULL,
                company_name varchar(200) NOT NULL,
                billing_email varchar(320) NOT NULL,
                phone varchar(40) NULL,
                tax_office varchar(120) NULL,
                tax_number varchar(50) NULL,
                address_line varchar(500) NULL,
                city varchar(120) NULL,
                country varchar(8) NOT NULL DEFAULT 'TR',
                locale varchar(20) NOT NULL DEFAULT 'tr-TR',
                status varchar(30) NOT NULL DEFAULT 'active',
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_billing_profiles_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_billing_profiles_customer FOREIGN KEY (customer_account_id) REFERENCES customer_accounts(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS ix_billing_profiles_tenant_email ON billing_profiles(tenant_id, billing_email);

            CREATE TABLE IF NOT EXISTS invoice_lines (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                invoice_id uuid NOT NULL,
                description varchar(500) NOT NULL,
                quantity numeric(18,2) NOT NULL DEFAULT 1,
                unit_amount numeric(18,2) NOT NULL DEFAULT 0,
                tax_amount numeric(18,2) NOT NULL DEFAULT 0,
                total_amount numeric(18,2) NOT NULL DEFAULT 0,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_invoice_lines_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_invoice_lines_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_invoice_lines_tenant_invoice ON invoice_lines(tenant_id, invoice_id);

            CREATE TABLE IF NOT EXISTS payment_transactions (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                subscription_id uuid NULL,
                invoice_id uuid NULL,
                checkout_session_id uuid NULL,
                provider varchar(40) NOT NULL,
                provider_payment_id varchar(150) NOT NULL,
                provider_customer_reference varchar(150) NULL,
                amount numeric(18,2) NOT NULL DEFAULT 0,
                tax_amount numeric(18,2) NOT NULL DEFAULT 0,
                currency varchar(8) NOT NULL DEFAULT 'TRY',
                status varchar(30) NOT NULL DEFAULT 'pending',
                payment_method_summary varchar(120) NOT NULL DEFAULT 'card',
                metadata_json text NOT NULL DEFAULT '{}',
                paid_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_payment_transactions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_payment_transactions_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
                CONSTRAINT fk_payment_transactions_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
                CONSTRAINT fk_payment_transactions_checkout FOREIGN KEY (checkout_session_id) REFERENCES checkout_sessions(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS ix_payment_transactions_provider_payment_id ON payment_transactions(provider_payment_id);
            CREATE INDEX IF NOT EXISTS ix_payment_transactions_tenant_created ON payment_transactions(tenant_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS payment_attempts (
                id uuid PRIMARY KEY,
                checkout_session_id uuid NOT NULL,
                payment_transaction_id uuid NULL,
                provider varchar(40) NOT NULL,
                status varchar(30) NOT NULL DEFAULT 'pending',
                failure_reason varchar(500) NULL,
                metadata_json text NOT NULL DEFAULT '{}',
                attempted_at timestamptz NOT NULL DEFAULT now(),
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_payment_attempts_checkout FOREIGN KEY (checkout_session_id) REFERENCES checkout_sessions(id) ON DELETE CASCADE,
                CONSTRAINT fk_payment_attempts_transaction FOREIGN KEY (payment_transaction_id) REFERENCES payment_transactions(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS ix_payment_attempts_checkout_attempted ON payment_attempts(checkout_session_id, attempted_at DESC);

            CREATE TABLE IF NOT EXISTS activation_events (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                device_activation_id uuid NOT NULL,
                event_type varchar(80) NOT NULL,
                payload_json text NOT NULL DEFAULT '{}',
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_activation_events_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_activation_events_device FOREIGN KEY (device_activation_id) REFERENCES device_activations(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_activation_events_tenant_created ON activation_events(tenant_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS app_releases (
                id uuid PRIMARY KEY,
                platform varchar(30) NOT NULL,
                channel varchar(30) NOT NULL DEFAULT 'stable',
                version varchar(40) NOT NULL,
                release_date date NOT NULL,
                release_notes_markdown text NOT NULL,
                install_guide_markdown text NOT NULL,
                minimum_requirements text NOT NULL,
                is_public boolean NOT NULL DEFAULT false,
                is_active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_app_releases_platform_channel_version ON app_releases(platform, channel, version);

            CREATE TABLE IF NOT EXISTS downloadable_assets (
                id uuid PRIMARY KEY,
                app_release_id uuid NOT NULL,
                label varchar(150) NOT NULL,
                platform varchar(30) NOT NULL,
                visibility varchar(20) NOT NULL DEFAULT 'portal',
                download_url varchar(500) NOT NULL,
                checksum varchar(128) NOT NULL,
                requires_active_license boolean NOT NULL DEFAULT true,
                is_active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_downloadable_assets_release FOREIGN KEY (app_release_id) REFERENCES app_releases(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_downloadable_assets_release_platform ON downloadable_assets(app_release_id, platform);

            CREATE TABLE IF NOT EXISTS download_accesses (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                downloadable_asset_id uuid NOT NULL,
                subscription_id uuid NULL,
                license_id uuid NULL,
                status varchar(30) NOT NULL DEFAULT 'active',
                expires_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_download_accesses_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_download_accesses_asset FOREIGN KEY (downloadable_asset_id) REFERENCES downloadable_assets(id) ON DELETE CASCADE,
                CONSTRAINT fk_download_accesses_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
                CONSTRAINT fk_download_accesses_license FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE SET NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_download_accesses_tenant_asset ON download_accesses(tenant_id, downloadable_asset_id);

            CREATE TABLE IF NOT EXISTS reseller_codes (
                id uuid PRIMARY KEY,
                reseller_account_id uuid NOT NULL,
                code varchar(50) NOT NULL,
                is_primary boolean NOT NULL DEFAULT false,
                is_active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_reseller_codes_account FOREIGN KEY (reseller_account_id) REFERENCES reseller_accounts(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_reseller_codes_code ON reseller_codes(code);

            CREATE TABLE IF NOT EXISTS reseller_referrals (
                id uuid PRIMARY KEY,
                reseller_account_id uuid NOT NULL,
                checkout_session_id uuid NOT NULL,
                tenant_id uuid NULL,
                referral_code varchar(50) NOT NULL,
                status varchar(30) NOT NULL DEFAULT 'attached',
                commission_eligible boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_reseller_referrals_account FOREIGN KEY (reseller_account_id) REFERENCES reseller_accounts(id) ON DELETE CASCADE,
                CONSTRAINT fk_reseller_referrals_checkout FOREIGN KEY (checkout_session_id) REFERENCES checkout_sessions(id) ON DELETE CASCADE,
                CONSTRAINT fk_reseller_referrals_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_reseller_referrals_checkout_code ON reseller_referrals(checkout_session_id, referral_code);

            CREATE TABLE IF NOT EXISTS reseller_customer_links (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                reseller_account_id uuid NOT NULL,
                customer_account_id uuid NULL,
                subscription_id uuid NULL,
                referral_code varchar(50) NOT NULL,
                linked_at timestamptz NOT NULL DEFAULT now(),
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_reseller_customer_links_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_reseller_customer_links_account FOREIGN KEY (reseller_account_id) REFERENCES reseller_accounts(id) ON DELETE CASCADE,
                CONSTRAINT fk_reseller_customer_links_customer FOREIGN KEY (customer_account_id) REFERENCES customer_accounts(id) ON DELETE SET NULL,
                CONSTRAINT fk_reseller_customer_links_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_reseller_customer_links_account_tenant ON reseller_customer_links(reseller_account_id, tenant_id);

            CREATE TABLE IF NOT EXISTS reseller_commission_events (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                reseller_account_id uuid NOT NULL,
                subscription_id uuid NULL,
                invoice_id uuid NULL,
                rate numeric(8,4) NOT NULL DEFAULT 0,
                amount numeric(18,2) NOT NULL DEFAULT 0,
                status varchar(30) NOT NULL DEFAULT 'accrued',
                event_at timestamptz NOT NULL DEFAULT now(),
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_reseller_commission_events_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_reseller_commission_events_account FOREIGN KEY (reseller_account_id) REFERENCES reseller_accounts(id) ON DELETE CASCADE,
                CONSTRAINT fk_reseller_commission_events_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
                CONSTRAINT fk_reseller_commission_events_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS ix_reseller_commission_events_account_status_event ON reseller_commission_events(reseller_account_id, status, event_at DESC);

            CREATE TABLE IF NOT EXISTS email_notifications (
                id uuid PRIMARY KEY,
                tenant_id uuid NULL,
                customer_account_id uuid NULL,
                event_code varchar(80) NOT NULL,
                to_email varchar(320) NOT NULL,
                subject varchar(200) NOT NULL,
                body_markdown text NOT NULL,
                status varchar(30) NOT NULL DEFAULT 'queued',
                sent_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_email_notifications_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
                CONSTRAINT fk_email_notifications_customer FOREIGN KEY (customer_account_id) REFERENCES customer_accounts(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS ix_email_notifications_event_status_created ON email_notifications(event_code, status, created_at DESC);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TABLE IF EXISTS email_notifications;
            DROP TABLE IF EXISTS reseller_commission_events;
            DROP TABLE IF EXISTS reseller_customer_links;
            DROP TABLE IF EXISTS reseller_referrals;
            DROP TABLE IF EXISTS reseller_codes;
            DROP TABLE IF EXISTS download_accesses;
            DROP TABLE IF EXISTS downloadable_assets;
            DROP TABLE IF EXISTS app_releases;
            DROP TABLE IF EXISTS activation_events;
            DROP TABLE IF EXISTS payment_attempts;
            DROP TABLE IF EXISTS payment_transactions;
            DROP TABLE IF EXISTS invoice_lines;
            DROP TABLE IF EXISTS billing_profiles;
            DROP TABLE IF EXISTS plan_feature_flags;
            DROP TABLE IF EXISTS feature_flags;
            DROP TABLE IF EXISTS plan_prices;
            DROP TABLE IF EXISTS subscription_plans;
            DROP TABLE IF EXISTS tenant_users;
            DROP TABLE IF EXISTS portal_sessions;
            DROP TABLE IF EXISTS customer_accounts;

            DROP INDEX IF EXISTS ix_checkout_sessions_checkout_reference;
            DROP INDEX IF EXISTS ix_checkout_sessions_provider_payment_reference;
            DROP INDEX IF EXISTS ix_checkout_sessions_idempotency_key;
            DROP INDEX IF EXISTS ix_licenses_license_key;
            DROP INDEX IF EXISTS ix_tenants_tenant_code;
            DROP INDEX IF EXISTS ix_tenants_billing_email;
            """);
    }
}
