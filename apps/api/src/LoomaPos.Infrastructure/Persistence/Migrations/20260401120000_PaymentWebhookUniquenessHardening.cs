using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace LoomaPos.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260401120000_PaymentWebhookUniquenessHardening")]
public partial class PaymentWebhookUniquenessHardening : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            WITH ranked AS (
                SELECT id,
                       ROW_NUMBER() OVER (PARTITION BY provider, event_id ORDER BY received_at DESC NULLS LAST, id DESC) AS rn
                FROM payment_webhooks
            )
            DELETE FROM payment_webhooks target
            USING ranked
            WHERE target.id = ranked.id
              AND ranked.rn > 1;

            DROP INDEX IF EXISTS ix_payment_webhooks_provider_event;
            CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_webhooks_provider_event
                ON payment_webhooks(provider, event_id);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP INDEX IF EXISTS ux_payment_webhooks_provider_event;
            CREATE INDEX IF NOT EXISTS ix_payment_webhooks_provider_event
                ON payment_webhooks(provider, event_id);
            """);
    }
}
