namespace LoomaPos.Api.Analytics;

public sealed partial class AnalyticsReadModelService
{
    private static readonly IReadOnlyList<AnalyticsKpiDefinitionDto> KpiCatalog =
    [
        Kpi("gross_sales", "Gross Sales", "retail", "sum(completed_sale.total)", "selected_period", "Completed sales only; excludes refunds and voids.", "Tenant business timezone boundary.", "Near real time.", "analytics"),
        Kpi("net_sales", "Net Sales", "retail", "gross_sales - refund_amount", "selected_period", "Completed sales minus refund facts; voids excluded.", "Tenant business timezone boundary.", "Near real time.", "analytics"),
        Kpi("refund_amount", "Refund Amount", "retail", "sum(refund_sale.total)", "selected_period", "Refund facts only; no silent deletion.", "Tenant business timezone boundary.", "Near real time.", "analytics"),
        Kpi("refund_rate", "Refund Rate", "retail", "refund_amount / gross_sales", "selected_period", "Uses gross sales denominator.", "Tenant business timezone boundary.", "Near real time.", "analytics"),
        Kpi("transaction_count", "Transaction Count", "retail", "count(completed_sales)", "selected_period", "Completed sales only.", "Tenant business timezone boundary.", "Near real time.", "analytics"),
        Kpi("average_basket_value", "Average Basket Value", "retail", "net_sales / effective_transaction_count", "selected_period", "Voids excluded from effective transaction count.", "Tenant business timezone boundary.", "Near real time.", "analytics"),
        Kpi("units_sold", "Units Sold", "retail", "sum(completed_sale_line.qty)", "selected_period", "Completed sale lines only.", "Tenant business timezone boundary.", "Near real time.", "analytics"),
        Kpi("top_product_revenue", "Top Product by Revenue", "retail", "max(sum(completed_sale_line.line_total) by product)", "selected_period", "Completed sale lines only.", "Tenant business timezone boundary.", "Hourly.", "analytics"),
        Kpi("top_product_quantity", "Top Product by Quantity", "retail", "max(sum(completed_sale_line.qty) by product)", "selected_period", "Completed sale lines only.", "Tenant business timezone boundary.", "Hourly.", "analytics"),
        Kpi("low_stock_item_count", "Low Stock Item Count", "retail", "count(stock_balance.qty <= product.min_stock)", "current_snapshot", "Stock-tracked products only.", "Tenant business timezone boundary.", "Near real time snapshot.", "inventory"),
        Kpi("stock_adjustment_count", "Stock Adjustment Count", "retail", "count(stock_move.reason in adjustment/correction)", "selected_period", "Ledger events only.", "Tenant business timezone boundary.", "Near real time.", "inventory"),
        Kpi("cash_vs_card_ratio", "Cash vs Card Ratio", "retail", "cash_amount / card_amount", "selected_period", "Completed sale payments only.", "Tenant business timezone boundary.", "Near real time.", "analytics"),
        Kpi("branch_growth_rate", "Branch Growth Rate", "retail", "(current_gross_sales - previous_gross_sales) / previous_gross_sales", "selected_period vs previous_period", "Branch scoped if branch filter exists.", "Tenant business timezone boundary.", "Hourly.", "analytics"),
        Kpi("staff_transaction_count", "Staff Transaction Count", "retail", "count(completed_sales by operator/device proxy)", "selected_period", "Uses device proxy until explicit cashier dimension is synced.", "Tenant business timezone boundary.", "Hourly.", "analytics"),
        Kpi("cash_discrepancy_count", "Cash Discrepancy Count", "retail", "count(cash_transaction.reason contains discrepancy)", "selected_period", "Cash session discrepancy events only.", "Tenant business timezone boundary.", "Hourly.", "cash"),
        Kpi("active_paying_tenants", "Active Paying Tenants", "saas", "count(latest_subscription.status = active)", "current_snapshot", "Latest subscription per tenant.", "UTC.", "Hourly.", "commerce"),
        Kpi("trial_tenants", "Trial Tenants", "saas", "count(latest_subscription.status = trialing)", "current_snapshot", "Latest subscription per tenant.", "UTC.", "Hourly.", "commerce"),
        Kpi("mrr", "MRR", "saas", "sum(monthly_price_equivalent of active subscriptions)", "current_snapshot", "Yearly subscriptions normalized to monthly equivalent.", "UTC.", "Hourly.", "commerce"),
        Kpi("renewal_success_rate", "Renewal Success Rate", "saas", "successful_renewals / renewal_attempts", "selected_period", "Uses payment transaction statuses.", "UTC.", "Hourly.", "billing"),
        Kpi("payment_failure_rate", "Payment Failure Rate", "saas", "failed_payments / renewal_attempts", "selected_period", "Uses payment transaction statuses.", "UTC.", "Hourly.", "billing"),
        Kpi("active_devices", "Active Devices", "saas", "count(device_activation.revoked_at is null)", "current_snapshot", "Desktop and Mobile activations.", "UTC.", "Near real time.", "ops"),
        Kpi("average_devices_per_tenant", "Average Devices per Tenant", "saas", "active_devices / active_or_trial_tenants", "current_snapshot", "Latest subscription tenant set.", "UTC.", "Hourly.", "ops"),
        Kpi("support_case_open_count", "Support Case Open Count", "saas", "count(open support requests)", "current_snapshot", "Queued or unresolved support requests.", "UTC.", "Near real time.", "support"),
        Kpi("license_revocation_count", "License Revocation Count", "saas", "count(license_event revoke)", "selected_period", "License revoke/replacement events only.", "UTC.", "Hourly.", "licensing"),
        Kpi("reseller_conversion_rate", "Reseller Conversion Rate", "saas", "converted_reseller_customers / reseller_referrals", "selected_period", "Distinct linked tenants over referrals.", "UTC.", "Hourly.", "reseller"),
        Kpi("coupon_redemption_rate", "Coupon Redemption Rate", "saas", "coupon_redemptions / coupon_offers", "selected_period", "Coupon usage over active promo offers.", "UTC.", "Hourly.", "growth"),
        Kpi("churn_risk_count", "Churn Risk Count", "saas", "count(subscription.status in past_due/suspended/canceled)", "current_snapshot", "Latest subscription per tenant.", "UTC.", "Hourly.", "customer_success")
    ];

    private static readonly IReadOnlyList<AnalyticsReportDefinitionDto> ReportCatalog =
    [
        new("daily-sales", "Daily Sales", "customer", "Executive summary of daily gross/net sales and transaction KPIs.", ["csv", "excel", "pdf_placeholder"], ["date_range", "branch"]),
        new("sales-by-branch", "Sales by Branch", "customer", "Branch ranking by net sales and transactions.", ["csv", "excel"], ["date_range", "branch"]),
        new("sales-by-product", "Sales by Product", "customer", "Top revenue and quantity products with refund visibility.", ["csv", "excel"], ["date_range", "branch", "category"]),
        new("sales-by-payment-method", "Sales by Payment Method", "customer", "Cash/card mix and refund trend.", ["csv", "excel"], ["date_range", "branch", "payment_method"]),
        new("refund-report", "Refund Report", "customer", "Refund totals, rates and refund-heavy products.", ["csv", "excel"], ["date_range", "branch"]),
        new("stock-health", "Stock Health", "customer", "Current stock risk and ledger adjustment summary.", ["csv", "excel"], ["branch", "category"]),
        new("low-stock", "Low Stock", "customer", "Critical low stock items by branch.", ["csv", "excel"], ["branch", "category"]),
        new("stock-count-variance", "Stock Count Variance", "customer", "Variance and discrepancy foundations from stock count events.", ["csv", "excel"], ["branch", "date_range"]),
        new("staff-performance", "Staff Performance", "customer", "Device/operator proxy performance summary.", ["csv", "excel"], ["date_range", "branch"]),
        new("device-version-health", "Device Version Health", "customer", "Device fleet and version adoption overview.", ["csv", "excel"], ["platform"]),
        new("account-health", "Account Health", "customer", "Subscription, payment and usage risk summary.", ["csv", "pdf_placeholder"], ["date_range"]),
        new("subscription-revenue", "Subscription Revenue", "internal", "MRR, renewal and billing trend summary.", ["csv", "excel"], ["date_range"]),
        new("mrr-churn", "MRR / Churn", "internal", "Plan mix, churn risk and subscription status breakdown.", ["csv", "excel"], ["date_range"]),
        new("billing-failure", "Billing Failure", "internal", "Payment failure and mismatch drill-down.", ["csv", "excel"], ["date_range", "provider"]),
        new("device-fleet", "Device Fleet", "internal", "Platform-wide device and version adoption analytics.", ["csv", "excel"], ["platform"]),
        new("sync-reliability", "Sync Reliability", "internal", "Queue, dead-letter and ingestion quality summary.", ["csv", "excel"], ["date_range"]),
        new("support-sla", "Support SLA", "internal", "Support request volume and resolution readiness foundations.", ["csv", "excel"], ["date_range", "category"]),
        new("reseller-performance", "Reseller Performance", "internal", "Referral, conversion and commission analytics.", ["csv", "excel"], ["date_range", "reseller"]),
        new("coupon-campaign-performance", "Coupon / Campaign Performance", "internal", "Promo usage and redemption analytics.", ["csv", "excel"], ["date_range", "campaign"]),
        new("version-adoption", "Version Adoption", "internal", "Release adoption by platform and version.", ["csv", "excel"], ["platform"]),
        new("integration-health", "Integration Health", "internal", "Billing and sync-adjacent incident foundations.", ["csv", "excel"], ["date_range"])
    ];

    private static readonly IReadOnlyList<AnalyticsScheduleTemplateDto> ScheduleCatalog =
    [
        new("daily-owner-summary", "Daily owner summary", "daily", "csv", "Europe/Istanbul", "Daily executive summary sent to owners."),
        new("weekly-branch-report", "Weekly branch report", "weekly", "excel", "Europe/Istanbul", "Weekly branch performance digest."),
        new("monthly-health-summary", "Monthly health summary", "monthly", "csv", "Europe/Istanbul", "Subscription, device and account health summary."),
        new("low-stock-digest", "Low stock digest", "daily", "csv", "Europe/Istanbul", "Critical low-stock alert digest."),
        new("reseller-performance-digest", "Reseller performance digest", "weekly", "csv", "Europe/Istanbul", "Partner conversion and commission summary.")
    ];

    private static AnalyticsKpiDefinitionDto Kpi(string code, string name, string category, string formula, string timeWindowLogic, string inclusionRules, string timezoneLogic, string freshness, string owner)
        => new(code, name, category, formula, timeWindowLogic, inclusionRules, timezoneLogic, freshness, owner);
}
