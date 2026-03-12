using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace LoomaPos.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260310120000_CommerceAuthHardening")]
public partial class CommerceAuthHardening : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS email_verification_token_hash text NULL;
            ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS email_verification_expires_at timestamptz NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE customer_accounts DROP COLUMN IF EXISTS email_verification_expires_at;
            ALTER TABLE customer_accounts DROP COLUMN IF EXISTS email_verification_token_hash;
            """);
    }
}
