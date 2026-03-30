using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace LoomaPos.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260330190000_CustomerCurrentAccounts")]
public partial class CustomerCurrentAccounts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS customer_current_accounts (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                customer_id uuid NOT NULL,
                balance numeric(18,2) NOT NULL DEFAULT 0,
                currency varchar(10) NOT NULL DEFAULT 'TRY',
                updated_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_customer_current_accounts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_customer_current_accounts_customer FOREIGN KEY (customer_id) REFERENCES contacts(id) ON DELETE CASCADE,
                CONSTRAINT ck_customer_current_accounts_currency CHECK (length(trim(currency)) > 0)
            );

            CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_current_accounts_tenant_customer
                ON customer_current_accounts(tenant_id, customer_id);

            CREATE TABLE IF NOT EXISTS customer_account_entries (
                id uuid PRIMARY KEY,
                tenant_id uuid NOT NULL,
                customer_id uuid NOT NULL,
                type varchar(40) NOT NULL,
                amount numeric(18,2) NOT NULL,
                ref_type varchar(100) NOT NULL,
                ref_id varchar(120) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                note varchar(500) NULL,
                CONSTRAINT fk_customer_account_entries_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT fk_customer_account_entries_customer FOREIGN KEY (customer_id) REFERENCES contacts(id) ON DELETE CASCADE,
                CONSTRAINT ck_customer_account_entries_type CHECK (type IN ('sale_charge', 'collection', 'adjustment', 'refund_credit')),
                CONSTRAINT ck_customer_account_entries_ref_type CHECK (length(trim(ref_type)) > 0),
                CONSTRAINT ck_customer_account_entries_ref_id CHECK (length(trim(ref_id)) > 0)
            );

            CREATE INDEX IF NOT EXISTS ix_customer_account_entries_tenant_customer_created
                ON customer_account_entries(tenant_id, customer_id, created_at);

            CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_account_entries_idempotency
                ON customer_account_entries(tenant_id, customer_id, type, ref_type, ref_id);

            INSERT INTO customer_account_entries (
                id,
                tenant_id,
                customer_id,
                type,
                amount,
                ref_type,
                ref_id,
                created_at,
                note
            )
            SELECT
                ledger.id,
                ledger.tenant_id,
                ledger.contact_id,
                CASE
                    WHEN lower(coalesce(ledger.reason, '')) LIKE '%refund%' THEN 'refund_credit'
                    WHEN ledger.amount_delta < 0 THEN 'collection'
                    WHEN ledger.amount_delta > 0 THEN 'sale_charge'
                    ELSE 'adjustment'
                END,
                ledger.amount_delta,
                coalesce(nullif(trim(ledger.ref_type), ''), 'legacy'),
                coalesce(nullif(trim(ledger.ref_id), ''), ledger.id::text),
                ledger.created_at,
                left(ledger.reason, 500)
            FROM contact_ledger ledger
            INNER JOIN contacts customer ON customer.id = ledger.contact_id
            WHERE lower(customer.type) = 'customer'
            ON CONFLICT (id) DO NOTHING;

            INSERT INTO customer_current_accounts (
                id,
                tenant_id,
                customer_id,
                balance,
                currency,
                updated_at
            )
            SELECT
                customer.id,
                customer.tenant_id,
                customer.id,
                coalesce(sum(entry.amount), 0),
                'TRY',
                coalesce(max(entry.created_at), now())
            FROM contacts customer
            LEFT JOIN customer_account_entries entry
                ON entry.customer_id = customer.id
                AND entry.tenant_id = customer.tenant_id
            WHERE lower(customer.type) = 'customer'
            GROUP BY customer.id, customer.tenant_id
            ON CONFLICT (tenant_id, customer_id)
            DO UPDATE SET
                balance = EXCLUDED.balance,
                currency = EXCLUDED.currency,
                updated_at = EXCLUDED.updated_at;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TABLE IF EXISTS customer_account_entries;
            DROP TABLE IF EXISTS customer_current_accounts;
            """);
    }
}
