using LoomaPos.Application.Analytics;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Analytics;

public sealed partial class AnalyticsReadModelService
{
    public async Task<ResellerAnalyticsWorkspaceDto> BuildResellerWorkspaceAsync(Guid resellerAccountId, AnalyticsQuery query, CancellationToken cancellationToken)
    {
        var range = ResolveRange(query);
        var links = await dbContext.ResellerCustomerLinks.AsNoTracking()
            .Where(x => x.ResellerAccountId == resellerAccountId)
            .ToListAsync(cancellationToken);
        var referrals = await dbContext.ResellerReferrals.AsNoTracking()
            .Where(x => x.ResellerAccountId == resellerAccountId && x.CreatedAt >= range.StartUtc && x.CreatedAt < range.EndUtc)
            .ToListAsync(cancellationToken);
        var commissions = await dbContext.ResellerCommissionEvents.AsNoTracking()
            .Where(x => x.ResellerAccountId == resellerAccountId && x.EventAt >= range.StartUtc && x.EventAt < range.EndUtc)
            .ToListAsync(cancellationToken);
        var payouts = await dbContext.Payouts.AsNoTracking()
            .Where(x => x.ResellerId == resellerAccountId)
            .ToListAsync(cancellationToken);

        var topCustomers = new List<AnalyticsBreakdownItemDto>();
        foreach (var group in links.GroupBy(x => x.TenantId).Take(6))
        {
            var tenant = await dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == group.Key, cancellationToken);
            var revenue = await dbContext.Invoices.AsNoTracking().Where(x => x.TenantId == group.Key && x.Status == "paid").SumAsync(x => (decimal?)x.Total, cancellationToken) ?? 0m;
            var commission = commissions.Where(x => x.TenantId == group.Key).Sum(x => x.Amount);
            topCustomers.Add(new AnalyticsBreakdownItemDto(
                group.Key.ToString(),
                tenant?.Name ?? group.Key.ToString(),
                revenue,
                commission,
                "customer",
                "Revenue and commission contribution."));
        }

        var freshness = BuildFreshness(
            "hourly",
            new[]
            {
                referrals.Select(x => x.CreatedAt).DefaultIfEmpty(DateTimeOffset.MinValue).Max(),
                commissions.Select(x => x.EventAt).DefaultIfEmpty(DateTimeOffset.MinValue).Max(),
                payouts.Select(x => x.CreatedAt).DefaultIfEmpty(DateTimeOffset.MinValue).Max()
            }.Max(),
            "fresh",
            "Reseller funnel, commission and payout analytics.");

        return new ResellerAnalyticsWorkspaceDto(
            [
                BuildKpiCard("referral_volume", "Referral Volume", referrals.Count.ToString(), "Tracked referral visits and registrations in the selected period.", "linked customers", links.Select(x => x.TenantId).Distinct().Count().ToString(), "flat"),
                BuildKpiCard("purchase_conversion", "Purchase Conversion", FormatPercent(referrals.Count == 0 ? 0m : (decimal)links.Select(x => x.TenantId).Distinct().Count() / referrals.Count), "Distinct linked customers over referral volume.", "active subscriptions", links.Count.ToString(), "up"),
                BuildKpiCard("commission_pending", "Pending Commission", FormatCurrency(commissions.Where(x => x.Status is "pending" or "approved" or "accrued").Sum(x => x.Amount)), "Accrued or pending commission events.", "paid out", FormatCurrency(payouts.Where(x => x.Status == "paid").Sum(x => x.Total)), "flat"),
                BuildKpiCard("commission_reversed", "Reversed Commission", FormatCurrency(commissions.Where(x => x.Status == "reversed").Sum(x => x.Amount)), "Commission reversals after churn, refund or cancellation.", "period", $"{range.Days}d", commissions.Any(x => x.Status == "reversed") ? "down" : "flat")
            ],
            [
                new AnalyticsBreakdownItemDto("clicked", "Clicked", referrals.Count, 0, "funnel", "Referral click or visit records."),
                new AnalyticsBreakdownItemDto("registered", "Registered", referrals.Count(x => x.Status is "registered" or "attached" or "active"), 0, "funnel", "Registered or attached referrals."),
                new AnalyticsBreakdownItemDto("purchased", "Purchased", links.Select(x => x.TenantId).Distinct().Count(), 0, "funnel", "Distinct customers that converted to purchase."),
                new AnalyticsBreakdownItemDto("active", "Active Subscription", links.Count, commissions.Count(x => x.Status != "reversed"), "funnel", "Linked active customers and non-reversed commission count.")
            ],
            topCustomers,
            commissions.GroupBy(x => x.Status).Select(group => new AnalyticsBreakdownItemDto(group.Key, group.Key, group.Sum(x => x.Amount), group.Count(), "commission", "Commission amount and event count by status.")).ToList(),
            freshness);
    }

    public async Task<InternalAnalyticsWorkspaceDto> BuildInternalWorkspaceAsync(AnalyticsQuery query, CancellationToken cancellationToken)
    {
        var range = ResolveRange(query);
        var latestSubscriptions = await dbContext.Subscriptions.AsNoTracking()
            .ToListAsync(cancellationToken);
        var latestSubscriptionSnapshots = latestSubscriptions
            .GroupBy(x => x.TenantId)
            .Select(group => group.OrderByDescending(x => x.CreatedAt).First())
            .ToList();
        var invoices = await dbContext.Invoices.AsNoTracking()
            .Where(x => x.IssuedAt >= range.StartUtc && x.IssuedAt < range.EndUtc)
            .ToListAsync(cancellationToken);
        var deviceActivations = await dbContext.DeviceActivations.AsNoTracking()
            .Where(x => x.RevokedAt == null)
            .ToListAsync(cancellationToken);
        var releases = await dbContext.AppReleases.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(cancellationToken);
        var resellers = await dbContext.ResellerAccounts.AsNoTracking().ToListAsync(cancellationToken);
        var commissions = await dbContext.ResellerCommissionEvents.AsNoTracking()
            .Where(x => x.EventAt >= range.StartUtc && x.EventAt < range.EndUtc)
            .ToListAsync(cancellationToken);
        var payments = await dbContext.PaymentTransactions.AsNoTracking()
            .Where(x => x.CreatedAt >= range.StartUtc && x.CreatedAt < range.EndUtc)
            .ToListAsync(cancellationToken);
        var quality = await BuildQualitySummaryAsync(cancellationToken);

        var saasKpis = AnalyticsMetricEngine.CalculateSaasKpis(new SaasMetricInput(
            latestSubscriptionSnapshots.Count(x => x.Status == "active"),
            latestSubscriptionSnapshots.Count(x => x.Status == "trialing"),
            latestSubscriptionSnapshots.Where(x => x.Status is "active" or "trialing").Sum(x => x.BillingCycle == "yearly" ? ExtractPlanPrice(x.PlanSnapshotJson) / 12m : ExtractPlanPrice(x.PlanSnapshotJson)),
            payments.Count(x => x.Status == "paid"),
            Math.Max(1, payments.Count),
            payments.Count(x => x.Status == "failed"),
            deviceActivations.Count,
            Math.Max(1, latestSubscriptionSnapshots.Count),
            await dbContext.EmailNotifications.AsNoTracking().CountAsync(x => (x.EventCode == "portal_support_request" || x.EventCode == "reseller_support_request") && x.Status != "sent", cancellationToken),
            await dbContext.LicenseEvents.AsNoTracking().CountAsync(x => x.EventType.Contains("revoke") && x.CreatedAt >= range.StartUtc && x.CreatedAt < range.EndUtc, cancellationToken),
            await dbContext.ResellerReferrals.AsNoTracking().CountAsync(x => x.CreatedAt >= range.StartUtc && x.CreatedAt < range.EndUtc, cancellationToken),
            await dbContext.ResellerCustomerLinks.AsNoTracking().CountAsync(x => x.LinkedAt >= range.StartUtc && x.LinkedAt < range.EndUtc, cancellationToken),
            await dbContext.CheckoutSessions.AsNoTracking().CountAsync(x => x.CouponCode != null && x.CreatedAt >= range.StartUtc && x.CreatedAt < range.EndUtc, cancellationToken),
            Math.Max(1, await dbContext.PlanPrices.AsNoTracking().CountAsync(x => x.PromoAmount != null, cancellationToken)),
            latestSubscriptionSnapshots.Count(x => x.Status is "past_due" or "suspended" or "canceled")));

        var revenueTrend = await BuildInternalRevenueTrendAsync(range, cancellationToken);
        var versionAdoption = BuildVersionAdoption(deviceActivations, releases);
        var resellerPerformance = new List<AnalyticsBreakdownItemDto>();
        foreach (var reseller in resellers.Take(8))
        {
            var customerCount = await dbContext.ResellerCustomerLinks.AsNoTracking().CountAsync(x => x.ResellerAccountId == reseller.Id, cancellationToken);
            var amount = commissions.Where(x => x.ResellerAccountId == reseller.Id && x.Status != "reversed").Sum(x => x.Amount);
            resellerPerformance.Add(new AnalyticsBreakdownItemDto(reseller.Id.ToString(), reseller.Name, customerCount, amount, reseller.Status, "Customer count and non-reversed commission total."));
        }

        var anomalies = new List<AnalyticsAnomalyDto>();
        if (quality.PaymentMismatchCount > 0)
        {
            anomalies.Add(new AnalyticsAnomalyDto("internal-anomaly-payment-mismatch", "billing_reconciliation_mismatch", "high", $"Detected {quality.PaymentMismatchCount} sale/payment mismatch record(s) in the quality checks.", "Review billing provider state against internal payment summaries.", "new", DateTimeOffset.UtcNow, "platform", [$"payment_mismatch:{quality.PaymentMismatchCount}"], "last_30_days", "current_window", "rules-v1"));
        }
        if (quality.NegativeStockAnomalyCount > 0)
        {
            anomalies.Add(new AnalyticsAnomalyDto("internal-anomaly-negative-stock", "negative_stock_cluster", "medium", $"Detected {quality.NegativeStockAnomalyCount} negative stock anomaly record(s).", "Inspect ledger integrity and stale stock snapshot refreshes.", "new", DateTimeOffset.UtcNow, "platform", [$"negative_stock:{quality.NegativeStockAnomalyCount}"], "last_30_days", "current_window", "rules-v1"));
        }

        var recommendations = new List<AnalyticsRecommendationDto>();
        if (saasKpis.PaymentFailureRate >= 0.15m)
        {
            recommendations.Add(new AnalyticsRecommendationDto("internal-rec-billing-recovery", "billing_recovery", "platform", "Payment failure rate is elevated for the current period.", [$"payment_failure_rate:{(saasKpis.PaymentFailureRate * 100m):0.#}%"], 0.83m, DateTimeOffset.UtcNow, "new", "Prioritize billing recovery messaging and provider diagnostics.", "rules-v1"));
        }
        if (versionAdoption.Any(x => x.Status == "watch"))
        {
            recommendations.Add(new AnalyticsRecommendationDto("internal-rec-version-adoption", "version_adoption", "platform", "A significant portion of the device fleet is on lagging app versions.", versionAdoption.Where(x => x.Status == "watch").Select(x => $"{x.Label}:{x.PrimaryValue:0}").ToArray(), 0.76m, DateTimeOffset.UtcNow, "new", "Publish upgrade notices and enforce minimum supported versions for affected platforms.", "rules-v1"));
        }

        var latestSource = new[]
        {
            invoices.Select(x => x.IssuedAt).DefaultIfEmpty(DateTimeOffset.MinValue).Max(),
            payments.Select(x => x.CreatedAt).DefaultIfEmpty(DateTimeOffset.MinValue).Max(),
            deviceActivations.Select(x => x.LastSeenAt).DefaultIfEmpty(DateTimeOffset.MinValue).Max()
        }.Max();

        return new InternalAnalyticsWorkspaceDto(
            [
                BuildKpiCard("active_paying_tenants", "Active Paying Tenants", saasKpis.ActivePayingTenants.ToString(), "Latest active subscription count.", "trial tenants", saasKpis.TrialTenants.ToString(), "flat"),
                BuildKpiCard("mrr", "MRR", FormatCurrency(saasKpis.Mrr), "Monthly recurring revenue equivalent from active subscriptions.", "renewal success", FormatPercent(saasKpis.RenewalSuccessRate), saasKpis.RenewalSuccessRate >= 0.9m ? "up" : "down"),
                BuildKpiCard("payment_failure_rate", "Payment Failure Rate", FormatPercent(saasKpis.PaymentFailureRate), "Failed payment attempts over renewal attempts.", "support cases", saasKpis.SupportCaseOpenCount.ToString(), saasKpis.PaymentFailureRate > 0.1m ? "down" : "flat"),
                BuildKpiCard("active_devices", "Active Devices", saasKpis.ActiveDevices.ToString(), "Active Desktop and Mobile device fleet.", "avg per tenant", saasKpis.AverageDevicesPerTenant.ToString("0.##"), "flat"),
                BuildKpiCard("reseller_conversion_rate", "Reseller Conversion", FormatPercent(saasKpis.ResellerConversionRate), "Converted reseller-linked customers over referrals.", "coupon redemption", FormatPercent(saasKpis.CouponRedemptionRate), "flat"),
                BuildKpiCard("churn_risk_count", "Churn Risk", saasKpis.ChurnRiskCount.ToString(), "Subscriptions in past_due, suspended or canceled states.", "license revocations", saasKpis.LicenseRevocationCount.ToString(), saasKpis.ChurnRiskCount > 0 ? "down" : "flat")
            ],
            revenueTrend,
            latestSubscriptionSnapshots.GroupBy(x => x.PlanCode).Select(group => new AnalyticsBreakdownItemDto(group.Key, group.Key.ToUpperInvariant(), group.Count(), group.Sum(x => x.BillingCycle == "yearly" ? ExtractPlanPrice(x.PlanSnapshotJson) / 12m : ExtractPlanPrice(x.PlanSnapshotJson)), "plan", "Plan mix by tenant count and MRR equivalent.")).ToList(),
            payments.GroupBy(x => x.Status).Select(group => new AnalyticsBreakdownItemDto(group.Key, group.Key, group.Count(), group.Sum(x => x.Amount), "billing", "Payment transaction count and amount by status.")).ToList(),
            versionAdoption,
            resellerPerformance,
            anomalies,
            recommendations,
            BuildFreshness("hourly", latestSource, quality.FreshnessStatus, "Platform-wide SaaS and operational analytics."));
    }

    public async Task<AnalyticsQualitySummaryDto> BuildQualitySummaryAsync(CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var recentSales = await dbContext.Sales.AsNoTracking()
            .Where(x => x.CreatedAt >= now.AddDays(-30))
            .Select(x => new { x.Id, x.BranchId, x.Total, x.Status, x.CreatedAt })
            .ToListAsync(cancellationToken);
        var recentSaleIds = recentSales.Select(x => x.Id).ToArray();
        var payments = recentSaleIds.Length == 0
            ? []
            : await dbContext.Payments.AsNoTracking().Where(x => recentSaleIds.Contains(x.SaleId)).ToListAsync(cancellationToken);
        var refundSales = recentSales.Where(x => x.Status == LoomaPos.Domain.Common.SaleStatus.Refunded).Select(x => x.Id).ToArray();
        var refundLinks = refundSales.Length == 0
            ? 0
            : await dbContext.StockMoves.AsNoTracking().CountAsync(x => x.RefType == "sale_refund" && refundSales.Select(id => id.ToString()).Contains(x.RefId), cancellationToken);
        var stockBalances = await dbContext.StockBalances.AsNoTracking().ToListAsync(cancellationToken);
        var orphanedHeartbeats = await (from activation in dbContext.DeviceActivations.AsNoTracking()
                                        join device in dbContext.Devices.AsNoTracking() on activation.DeviceId equals device.Id into deviceJoin
                                        from device in deviceJoin.DefaultIfEmpty()
                                        where device == null
                                        select activation.Id).CountAsync(cancellationToken);
        var paymentMismatch = recentSales
            .Where(x => x.Status == LoomaPos.Domain.Common.SaleStatus.Completed)
            .Count(sale => Math.Abs((double)(payments.Where(payment => payment.SaleId == sale.Id).Sum(payment => payment.Amount) - sale.Total)) > 0.01d);
        var lastEventIngestion = await dbContext.ProcessedEvents.AsNoTracking()
            .OrderByDescending(x => x.ProcessedAt)
            .Select(x => (DateTimeOffset?)x.ProcessedAt)
            .FirstOrDefaultAsync(cancellationToken)
            ?? recentSales.Select(x => x.CreatedAt).DefaultIfEmpty(DateTimeOffset.MinValue).Max();

        var alerts = new List<string>();
        if (paymentMismatch > 0)
        {
            alerts.Add($"Payment mismatch count is {paymentMismatch}.");
        }
        if (stockBalances.Count(x => x.Qty < 0) > 0)
        {
            alerts.Add("Negative stock balances detected.");
        }
        if (orphanedHeartbeats > 0)
        {
            alerts.Add("Orphaned device heartbeats detected.");
        }

        return new AnalyticsQualitySummaryDto(
            now,
            lastEventIngestion,
            now,
            0,
            Math.Max(0, refundSales.Length - refundLinks),
            stockBalances.Count(x => x.Qty < 0),
            recentSales.Count(x => x.BranchId == Guid.Empty),
            paymentMismatch,
            orphanedHeartbeats,
            lastEventIngestion < now.AddHours(-6) ? "stale" : "fresh",
            alerts);
    }

    private async Task<IReadOnlyList<AnalyticsSeriesDto>> BuildInternalRevenueTrendAsync(AnalyticsRange range, CancellationToken cancellationToken)
    {
        var invoices = await dbContext.Invoices.AsNoTracking()
            .Where(x => x.IssuedAt >= range.StartUtc && x.IssuedAt < range.EndUtc && x.Status == "paid")
            .ToListAsync(cancellationToken);
        var points = new List<AnalyticsSeriesPointDto>();
        for (var day = 0; day < range.Days; day++)
        {
            var localDate = TimeZoneInfo.ConvertTime(range.StartUtc, range.Timezone).Date.AddDays(day);
            var startLocal = new DateTime(localDate.Year, localDate.Month, localDate.Day, 0, 0, 0, DateTimeKind.Unspecified);
            var endLocal = startLocal.AddDays(1);
            var startUtc = TimeZoneInfo.ConvertTimeToUtc(startLocal, range.Timezone);
            var endUtc = TimeZoneInfo.ConvertTimeToUtc(endLocal, range.Timezone);
            points.Add(new AnalyticsSeriesPointDto(localDate.ToString("dd MMM"), invoices.Where(x => x.IssuedAt >= startUtc && x.IssuedAt < endUtc).Sum(x => x.Total)));
        }

        return [new AnalyticsSeriesDto("MRR-equivalent revenue", "TRY", points)];
    }

    private static IReadOnlyList<AnalyticsBreakdownItemDto> BuildVersionAdoption(IReadOnlyList<LoomaPos.Domain.Commerce.DeviceActivation> activations, IReadOnlyList<LoomaPos.Domain.Commerce.AppRelease> releases)
    {
        var latestByPlatform = releases
            .GroupBy(x => x.Platform)
            .ToDictionary(group => group.Key, group => group.OrderByDescending(x => x.CreatedAt).First().Version, StringComparer.OrdinalIgnoreCase);

        return activations
            .GroupBy(x => x.Platform)
            .Select(group =>
            {
                var latest = latestByPlatform.TryGetValue(group.Key, out var latestVersion) ? latestVersion : null;
                var latestCount = latest is null ? 0 : group.Count(x => string.Equals(x.AppVersion, latest, StringComparison.OrdinalIgnoreCase));
                var adoptionRate = group.Count() == 0 ? 0m : Math.Round((decimal)latestCount / group.Count(), 4, MidpointRounding.AwayFromZero);
                return new AnalyticsBreakdownItemDto(group.Key, $"{group.Key} {latest ?? "n/a"}", group.Count(), adoptionRate * 100m, adoptionRate >= 0.7m ? "healthy" : "watch", "Primary value is device count, secondary is latest-version adoption percent.");
            })
            .ToList();
    }
}
