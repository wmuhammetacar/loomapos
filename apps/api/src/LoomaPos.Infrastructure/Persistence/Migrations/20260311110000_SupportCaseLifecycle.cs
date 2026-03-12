using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace LoomaPos.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260311110000_SupportCaseLifecycle")]
public partial class SupportCaseLifecycle : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS support_cases (
                id uuid PRIMARY KEY,
                tenant_id uuid NULL,
                customer_account_id uuid NULL,
                reseller_account_id uuid NULL,
                source varchar(40) NOT NULL,
                category varchar(60) NOT NULL,
                priority varchar(30) NOT NULL,
                status varchar(40) NOT NULL,
                title varchar(260) NOT NULL,
                summary varchar(4000) NOT NULL,
                contact_preference varchar(60) NULL,
                assignee_email varchar(320) NULL,
                escalation_level varchar(40) NULL,
                first_response_at timestamptz NULL,
                resolved_at timestamptz NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_support_cases_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
                CONSTRAINT fk_support_cases_customer FOREIGN KEY (customer_account_id) REFERENCES customer_accounts(id) ON DELETE SET NULL,
                CONSTRAINT fk_support_cases_reseller FOREIGN KEY (reseller_account_id) REFERENCES reseller_accounts(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS ix_support_cases_status_created ON support_cases(status, created_at DESC);
            CREATE INDEX IF NOT EXISTS ix_support_cases_tenant_created ON support_cases(tenant_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS ix_support_cases_reseller_created ON support_cases(reseller_account_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS support_case_messages (
                id uuid PRIMARY KEY,
                support_case_id uuid NOT NULL,
                author_type varchar(40) NOT NULL,
                author_internal_user_id uuid NULL,
                author_customer_account_id uuid NULL,
                body varchar(8000) NOT NULL,
                is_internal boolean NOT NULL DEFAULT false,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_support_case_messages_case FOREIGN KEY (support_case_id) REFERENCES support_cases(id) ON DELETE CASCADE,
                CONSTRAINT fk_support_case_messages_internal_user FOREIGN KEY (author_internal_user_id) REFERENCES internal_users(id) ON DELETE SET NULL,
                CONSTRAINT fk_support_case_messages_customer FOREIGN KEY (author_customer_account_id) REFERENCES customer_accounts(id) ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS ix_support_case_messages_case_created ON support_case_messages(support_case_id, created_at);

            CREATE TABLE IF NOT EXISTS support_case_notes (
                id uuid PRIMARY KEY,
                support_case_id uuid NOT NULL,
                internal_user_id uuid NOT NULL,
                note varchar(4000) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_support_case_notes_case FOREIGN KEY (support_case_id) REFERENCES support_cases(id) ON DELETE CASCADE,
                CONSTRAINT fk_support_case_notes_internal_user FOREIGN KEY (internal_user_id) REFERENCES internal_users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_support_case_notes_case_created ON support_case_notes(support_case_id, created_at);

            CREATE TABLE IF NOT EXISTS support_case_links (
                id uuid PRIMARY KEY,
                support_case_id uuid NOT NULL,
                entity_type varchar(80) NOT NULL,
                entity_id varchar(120) NOT NULL,
                label varchar(200) NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT fk_support_case_links_case FOREIGN KEY (support_case_id) REFERENCES support_cases(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_support_case_links_case_entity ON support_case_links(support_case_id, entity_type, entity_id);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TABLE IF EXISTS support_case_links;
            DROP TABLE IF EXISTS support_case_notes;
            DROP TABLE IF EXISTS support_case_messages;
            DROP TABLE IF EXISTS support_cases;
            """);
    }
}
