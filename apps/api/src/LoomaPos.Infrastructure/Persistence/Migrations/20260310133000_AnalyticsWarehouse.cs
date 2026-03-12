using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LoomaPos.Infrastructure.Persistence.Migrations;

public partial class AnalyticsWarehouse : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "agg_customer_health",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                score = table.Column<int>(type: "int", nullable: false),
                status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                drivers_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                active_devices = table.Column<int>(type: "int", nullable: false),
                failed_payments = table.Column<int>(type: "int", nullable: false),
                open_support_cases = table.Column<int>(type: "int", nullable: false),
                days_since_last_heartbeat = table.Column<int>(type: "int", nullable: false),
                plan_limit_pressure_percent = table.Column<int>(type: "int", nullable: false),
                generated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                source_max_timestamp = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_agg_customer_health", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "agg_daily_sales",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                business_date = table.Column<DateOnly>(type: "date", nullable: false),
                gross_sales = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                refund_amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                net_sales = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                completed_transaction_count = table.Column<int>(type: "int", nullable: false),
                void_count = table.Column<int>(type: "int", nullable: false),
                effective_transaction_count = table.Column<int>(type: "int", nullable: false),
                units_sold = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                average_basket_value = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                low_stock_item_count = table.Column<int>(type: "int", nullable: false),
                stock_adjustment_count = table.Column<int>(type: "int", nullable: false),
                source_max_timestamp = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_agg_daily_sales", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "agg_branch_daily_sales",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                branch_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                business_date = table.Column<DateOnly>(type: "date", nullable: false),
                branch_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                net_sales = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                refund_amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                transaction_count = table.Column<int>(type: "int", nullable: false),
                active_device_count = table.Column<int>(type: "int", nullable: false),
                source_max_timestamp = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_agg_branch_daily_sales", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "agg_payment_method_daily",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                business_date = table.Column<DateOnly>(type: "date", nullable: false),
                payment_method = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                transaction_count = table.Column<int>(type: "int", nullable: false),
                source_max_timestamp = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_agg_payment_method_daily", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "analytics_refresh_runs",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                tenant_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                scope = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                started_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                completed_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                source_max_timestamp = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                records_written = table.Column<int>(type: "int", nullable: false),
                error = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_analytics_refresh_runs", x => x.id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_agg_branch_daily_sales_tenant_id_branch_id_business_date",
            table: "agg_branch_daily_sales",
            columns: new[] { "tenant_id", "branch_id", "business_date" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_agg_customer_health_tenant_id",
            table: "agg_customer_health",
            column: "tenant_id",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_agg_daily_sales_tenant_id_business_date",
            table: "agg_daily_sales",
            columns: new[] { "tenant_id", "business_date" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_agg_payment_method_daily_tenant_id_business_date_payment_method",
            table: "agg_payment_method_daily",
            columns: new[] { "tenant_id", "business_date", "payment_method" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_analytics_refresh_runs_scope_tenant_id_created_at",
            table: "analytics_refresh_runs",
            columns: new[] { "scope", "tenant_id", "created_at" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "agg_branch_daily_sales");
        migrationBuilder.DropTable(name: "agg_customer_health");
        migrationBuilder.DropTable(name: "agg_daily_sales");
        migrationBuilder.DropTable(name: "agg_payment_method_daily");
        migrationBuilder.DropTable(name: "analytics_refresh_runs");
    }
}
