using LoomaPos.Domain.Analytics;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Infrastructure.Persistence;

public static class AnalyticsWarehouseModelBuilderExtensions
{
    public static void ConfigureAnalyticsWarehouseEntities(this ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AggDailySales>(entity =>
        {
            entity.ToTable("agg_daily_sales");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.BusinessDate).HasColumnName("business_date");
            entity.Property(x => x.GrossSales).HasColumnName("gross_sales").HasPrecision(18, 2);
            entity.Property(x => x.RefundAmount).HasColumnName("refund_amount").HasPrecision(18, 2);
            entity.Property(x => x.NetSales).HasColumnName("net_sales").HasPrecision(18, 2);
            entity.Property(x => x.CompletedTransactionCount).HasColumnName("completed_transaction_count");
            entity.Property(x => x.VoidCount).HasColumnName("void_count");
            entity.Property(x => x.EffectiveTransactionCount).HasColumnName("effective_transaction_count");
            entity.Property(x => x.UnitsSold).HasColumnName("units_sold").HasPrecision(18, 4);
            entity.Property(x => x.AverageBasketValue).HasColumnName("average_basket_value").HasPrecision(18, 2);
            entity.Property(x => x.LowStockItemCount).HasColumnName("low_stock_item_count");
            entity.Property(x => x.StockAdjustmentCount).HasColumnName("stock_adjustment_count");
            entity.Property(x => x.SourceMaxTimestamp).HasColumnName("source_max_timestamp");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.TenantId, x.BusinessDate }).IsUnique();
        });

        modelBuilder.Entity<AggBranchDailySales>(entity =>
        {
            entity.ToTable("agg_branch_daily_sales");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.BranchId).HasColumnName("branch_id");
            entity.Property(x => x.BusinessDate).HasColumnName("business_date");
            entity.Property(x => x.BranchName).HasColumnName("branch_name").HasMaxLength(200).IsRequired();
            entity.Property(x => x.NetSales).HasColumnName("net_sales").HasPrecision(18, 2);
            entity.Property(x => x.RefundAmount).HasColumnName("refund_amount").HasPrecision(18, 2);
            entity.Property(x => x.TransactionCount).HasColumnName("transaction_count");
            entity.Property(x => x.ActiveDeviceCount).HasColumnName("active_device_count");
            entity.Property(x => x.SourceMaxTimestamp).HasColumnName("source_max_timestamp");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.TenantId, x.BranchId, x.BusinessDate }).IsUnique();
        });

        modelBuilder.Entity<AggPaymentMethodDaily>(entity =>
        {
            entity.ToTable("agg_payment_method_daily");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.BusinessDate).HasColumnName("business_date");
            entity.Property(x => x.PaymentMethod).HasColumnName("payment_method").HasMaxLength(40).IsRequired();
            entity.Property(x => x.Amount).HasColumnName("amount").HasPrecision(18, 2);
            entity.Property(x => x.TransactionCount).HasColumnName("transaction_count");
            entity.Property(x => x.SourceMaxTimestamp).HasColumnName("source_max_timestamp");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.TenantId, x.BusinessDate, x.PaymentMethod }).IsUnique();
        });

        modelBuilder.Entity<AggCustomerHealthSnapshot>(entity =>
        {
            entity.ToTable("agg_customer_health");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.Score).HasColumnName("score");
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.DriversJson).HasColumnName("drivers_json").IsRequired();
            entity.Property(x => x.ActiveDevices).HasColumnName("active_devices");
            entity.Property(x => x.FailedPayments).HasColumnName("failed_payments");
            entity.Property(x => x.OpenSupportCases).HasColumnName("open_support_cases");
            entity.Property(x => x.DaysSinceLastHeartbeat).HasColumnName("days_since_last_heartbeat");
            entity.Property(x => x.PlanLimitPressurePercent).HasColumnName("plan_limit_pressure_percent");
            entity.Property(x => x.GeneratedAt).HasColumnName("generated_at");
            entity.Property(x => x.SourceMaxTimestamp).HasColumnName("source_max_timestamp");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => x.TenantId).IsUnique();
        });

        modelBuilder.Entity<AnalyticsRefreshRun>(entity =>
        {
            entity.ToTable("analytics_refresh_runs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.Scope).HasColumnName("scope").HasMaxLength(30).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.StartedAt).HasColumnName("started_at");
            entity.Property(x => x.CompletedAt).HasColumnName("completed_at");
            entity.Property(x => x.SourceMaxTimestamp).HasColumnName("source_max_timestamp");
            entity.Property(x => x.RecordsWritten).HasColumnName("records_written");
            entity.Property(x => x.Error).HasColumnName("error").HasMaxLength(500);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.Scope, x.TenantId, x.CreatedAt });
        });

        modelBuilder.Entity<AnalyticsReportSchedule>(entity =>
        {
            entity.ToTable("analytics_report_schedules");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(180).IsRequired();
            entity.Property(x => x.ReportCode).HasColumnName("report_code").HasMaxLength(80).IsRequired();
            entity.Property(x => x.Frequency).HasColumnName("frequency").HasMaxLength(30).IsRequired();
            entity.Property(x => x.Format).HasColumnName("format").HasMaxLength(20).IsRequired();
            entity.Property(x => x.Timezone).HasColumnName("timezone").HasMaxLength(80).IsRequired();
            entity.Property(x => x.RecipientsJson).HasColumnName("recipients_json").IsRequired();
            entity.Property(x => x.FiltersJson).HasColumnName("filters_json").IsRequired();
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.LastRunAt).HasColumnName("last_run_at");
            entity.Property(x => x.NextRunAt).HasColumnName("next_run_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.TenantId, x.CreatedAt });
        });

        modelBuilder.Entity<AnalyticsSavedView>(entity =>
        {
            entity.ToTable("analytics_saved_views");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.CustomerAccountId).HasColumnName("customer_account_id");
            entity.Property(x => x.Scope).HasColumnName("scope").HasMaxLength(30).IsRequired();
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(180).IsRequired();
            entity.Property(x => x.ViewCode).HasColumnName("view_code").HasMaxLength(80).IsRequired();
            entity.Property(x => x.FiltersJson).HasColumnName("filters_json").IsRequired();
            entity.Property(x => x.IsDefault).HasColumnName("is_default");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.TenantId, x.CustomerAccountId, x.ViewCode, x.Name }).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.CreatedAt });
        });
    }
}
