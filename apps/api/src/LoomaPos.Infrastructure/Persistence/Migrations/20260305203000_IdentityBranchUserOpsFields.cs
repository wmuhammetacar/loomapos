using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace LoomaPos.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260305203000_IdentityBranchUserOpsFields")]
public partial class IdentityBranchUserOpsFields : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE branches ADD COLUMN IF NOT EXISTS phone varchar(40) NULL;
            ALTER TABLE branches ADD COLUMN IF NOT EXISTS tax_number varchar(50) NULL;
            ALTER TABLE branches ADD COLUMN IF NOT EXISTS settings_json text NULL;

            ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id uuid NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS phone varchar(40) NULL;

            CREATE INDEX IF NOT EXISTS ix_users_tenant_branch
            ON users(tenant_id, branch_id);

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'fk_users_branch'
                ) THEN
                    ALTER TABLE users
                    ADD CONSTRAINT fk_users_branch
                    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
                END IF;
            END $$;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP INDEX IF EXISTS ix_users_tenant_branch;
            ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_branch;
            ALTER TABLE users DROP COLUMN IF EXISTS phone;
            ALTER TABLE users DROP COLUMN IF EXISTS branch_id;

            ALTER TABLE branches DROP COLUMN IF EXISTS settings_json;
            ALTER TABLE branches DROP COLUMN IF EXISTS tax_number;
            ALTER TABLE branches DROP COLUMN IF EXISTS phone;
            """);
    }
}
