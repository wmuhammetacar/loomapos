using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace LoomaPos.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260306113000_ResellerLeadDetails")]
public partial class ResellerLeadDetails : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE reseller_accounts ADD COLUMN IF NOT EXISTS company_name varchar(200) NULL;
            ALTER TABLE reseller_accounts ADD COLUMN IF NOT EXISTS city varchar(120) NULL;
            ALTER TABLE reseller_accounts ADD COLUMN IF NOT EXISTS phone varchar(40) NULL;
            ALTER TABLE reseller_accounts ADD COLUMN IF NOT EXISTS website_or_social_proof varchar(500) NULL;
            ALTER TABLE reseller_accounts ADD COLUMN IF NOT EXISTS experience text NULL;
            ALTER TABLE reseller_accounts ADD COLUMN IF NOT EXISTS message text NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE reseller_accounts DROP COLUMN IF EXISTS company_name;
            ALTER TABLE reseller_accounts DROP COLUMN IF EXISTS city;
            ALTER TABLE reseller_accounts DROP COLUMN IF EXISTS phone;
            ALTER TABLE reseller_accounts DROP COLUMN IF EXISTS website_or_social_proof;
            ALTER TABLE reseller_accounts DROP COLUMN IF EXISTS experience;
            ALTER TABLE reseller_accounts DROP COLUMN IF EXISTS message;
            """);
    }
}
