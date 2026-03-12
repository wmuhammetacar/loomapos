using System.Text.Json;
using LoomaPos.Application.Analytics;
using LoomaPos.Domain.Analytics;
using LoomaPos.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Analytics;

public sealed partial class AnalyticsReadModelService
{
    public async Task<TenantAnalyticsWorkspaceDto> BuildTenantWorkspaceAsync(Guid tenantId, AnalyticsQuery query, CancellationToken cancellationToken)
    {
        await warehouseService.EnsureTenantWarehouseFreshAsync(tenantId, cancellationToken);

        var range = ResolveRange(query);
        var previousRange = new AnalyticsRange(range.StartUtc.AddDays(-range.Days), range.StartUtc, range.Timezone, range.Days);
        var startDate = DateOnly.FromDateTime(range.StartUtc.UtcDateTime.Date);
        var endDate = DateOnly.FromDateTime(range.EndUtc.UtcDateTime.Date);
        var previousStartDate = DateOnly.FromDateTime(previousRange.StartUtc.UtcDateTime.Date);
        var previousEndDate = DateOnly.FromDateTime(previousRange.EndUtc.UtcDateTime.Date);

        var dailyAgg = await dbContext.AggDailySales.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.BusinessDate >= startDate && x.BusinessDate <= endDate)
            .OrderBy(x => x.BusinessDate)
            .ToListAsync(cancellationToken);
        var previousDailyAgg = await dbContext.AggDailySales.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.BusinessDate >= previousStartDate && x.BusinessDate <= previousEndDate)
            .ToListAsync(cancellationToken);
        var branchAgg = await dbContext.AggBranchDailySales.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.BusinessDate >= startDate && x.BusinessDate <= endDate && (!query.BranchId.HasValue || x.BranchId == query.BranchId.Value))
            .ToListAsync(cancellationToken);
        var paymentAgg = await dbContext.AggPaymentMethodDaily.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.BusinessDate >= startDate && x.BusinessDate <= endDate)
            .ToListAsync(cancellationToken);
        var healthAgg = await dbContext.AggCustomerHealthSnapshots.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);

        var sales = await QuerySalesAsync(tenantId, query.BranchId, range.StartUtc, range.EndUtc, cancellationToken);
        var previousSales = await QuerySalesAsync(tenantId, query.BranchId, previousRange.StartUtc, previousRange.EndUtc, cancellationToken);
        var saleIds = sales.Select(x => x.Id).ToArray();
        var lines = saleIds.Length == 0
            ? []
            : await dbContext.SaleLines.AsNoTracking().Where(x => saleIds.Contains(x.SaleId)).ToListAsync(cancellationToken);
        var payments = saleIds.Length == 0
            ? []
            : await dbContext.Payments.AsNoTracking().Where(x => saleIds.Contains(x.SaleId)).ToListAsync(cancellationToken);
        var branches = await dbContext.Branches.AsNoTracking()
            .Where(x => x.TenantId == tenantId && (!query.BranchId.HasValue || x.Id == query.BranchId.Value))
            .Select(x => new BranchProjection(x.Id, x.Name))
            .ToListAsync(cancellationToken);
        var products = await dbContext.Products.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Select(x => new ProductProjection(x.Id, x.Name, x.MinStock, x.StockTrackingEnabled, x.IsActive, x.CategoryId, x.PurchasePrice))
            .ToListAsync(cancellationToken);
        var stockRows = await QueryStockRowsAsync(tenantId, query.BranchId, cancellationToken);
        var stockMoves = await dbContext.StockMoves.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.CreatedAt >= range.StartUtc && x.CreatedAt < range.EndUtc && (!query.BranchId.HasValue || x.BranchId == query.BranchId.Value))
            .ToListAsync(cancellationToken);
        var deviceActivations = await dbContext.DeviceActivations.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.RevokedAt == null)
            .ToListAsync(cancellationToken);
        var devices = await dbContext.Devices.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Select(x => new DeviceProjection(x.Id, x.Name, x.LastSeenAt))
            .ToListAsync(cancellationToken);
        var subscription = await dbContext.Subscriptions.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        var license = await dbContext.IssuedLicenses.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.IssuedAt)
            .FirstOrDefaultAsync(cancellationToken);
        var invoices = await dbContext.Invoices.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.IssuedAt >= range.StartUtc && x.IssuedAt < range.EndUtc)
            .ToListAsync(cancellationToken);
        var paymentFailures = await dbContext.PaymentTransactions.AsNoTracking()
            .CountAsync(x => x.TenantId == tenantId && x.Status == "failed" && x.CreatedAt >= range.StartUtc && x.CreatedAt < range.EndUtc, cancellationToken);
        var supportCaseCount = await dbContext.EmailNotifications.AsNoTracking()
            .CountAsync(x => x.TenantId == tenantId && x.EventCode == "portal_support_request" && x.CreatedAt >= range.StartUtc && x.CreatedAt < range.EndUtc, cancellationToken);
        var activePortalUsers = await dbContext.TenantUsers.AsNoTracking()
            .CountAsync(x => x.TenantId == tenantId && x.Status == "active", cancellationToken);
        var cashDiscrepancyCount = await dbContext.CashTransactions.AsNoTracking()
            .CountAsync(x => x.TenantId == tenantId && x.Reason.Contains("discrepancy") && x.CreatedAt >= range.StartUtc && x.CreatedAt < range.EndUtc, cancellationToken);

        var completedSales = sales.Where(x => x.Status == SaleStatus.Completed).ToList();
        var refundedSales = sales.Where(x => x.Status == SaleStatus.Refunded).ToList();
        var voidedSales = sales.Where(x => x.Status == SaleStatus.Voided).ToList();
        var previousCompletedSales = previousSales.Where(x => x.Status == SaleStatus.Completed).ToList();
        var previousRefundedSales = previousSales.Where(x => x.Status == SaleStatus.Refunded).ToList();
        var previousVoidedSales = previousSales.Where(x => x.Status == SaleStatus.Voided).ToList();

        var completedSaleIds = completedSales.Select(x => x.Id).ToHashSet();
        var refundedSaleIds = refundedSales.Select(x => x.Id).ToHashSet();

        var retailKpis = dailyAgg.Count > 0
            ? AnalyticsMetricEngine.CalculateRetailKpis(new RetailMetricInput(
                dailyAgg.Sum(x => x.GrossSales),
                dailyAgg.Sum(x => x.RefundAmount),
                dailyAgg.Sum(x => x.CompletedTransactionCount),
                dailyAgg.Sum(x => x.VoidCount),
                dailyAgg.Sum(x => x.UnitsSold),
                paymentAgg.Where(x => x.PaymentMethod == "cash").Sum(x => x.Amount),
                paymentAgg.Where(x => x.PaymentMethod == "card").Sum(x => x.Amount),
                dailyAgg.Max(x => x.LowStockItemCount),
                dailyAgg.Sum(x => x.StockAdjustmentCount),
                dailyAgg.Sum(x => x.CompletedTransactionCount),
                cashDiscrepancyCount,
                previousDailyAgg.Sum(x => x.GrossSales)))
            : AnalyticsMetricEngine.CalculateRetailKpis(new RetailMetricInput(
                completedSales.Sum(x => x.Total),
                refundedSales.Sum(x => x.Total),
                completedSales.Count,
                voidedSales.Count,
                lines.Where(x => completedSaleIds.Contains(x.SaleId)).Sum(x => x.Qty),
                payments.Where(x => completedSaleIds.Contains(x.SaleId) && x.Method == PaymentMethod.Cash).Sum(x => x.Amount),
                payments.Where(x => completedSaleIds.Contains(x.SaleId) && x.Method == PaymentMethod.Card).Sum(x => x.Amount),
                stockRows.Count(x => x.IsCritical),
                stockMoves.Count(x => x.Reason.Contains("adjustment", StringComparison.OrdinalIgnoreCase) || x.Reason.Contains("correction", StringComparison.OrdinalIgnoreCase)),
                completedSales.Count,
                cashDiscrepancyCount,
                previousCompletedSales.Sum(x => x.Total)));

        var previousRetailKpis = previousDailyAgg.Count > 0
            ? AnalyticsMetricEngine.CalculateRetailKpis(new RetailMetricInput(
                previousDailyAgg.Sum(x => x.GrossSales),
                previousDailyAgg.Sum(x => x.RefundAmount),
                previousDailyAgg.Sum(x => x.CompletedTransactionCount),
                previousDailyAgg.Sum(x => x.VoidCount),
                previousDailyAgg.Sum(x => x.UnitsSold),
                0m,
                0m,
                0,
                0,
                0,
                0,
                0m))
            : AnalyticsMetricEngine.CalculateRetailKpis(new RetailMetricInput(
                previousCompletedSales.Sum(x => x.Total),
                previousRefundedSales.Sum(x => x.Total),
                previousCompletedSales.Count,
                previousVoidedSales.Count,
                0m,
                0m,
                0m,
                0,
                0,
                0,
                0,
                0m));

        var topRevenue = BuildProductBreakdown(lines.Where(x => completedSaleIds.Contains(x.SaleId)).ToList(), products, true, "revenue");
        var topQuantity = BuildProductBreakdown(lines.Where(x => completedSaleIds.Contains(x.SaleId)).ToList(), products, false, "quantity");
        var refundHeavy = BuildProductBreakdown(lines.Where(x => refundedSaleIds.Contains(x.SaleId)).ToList(), products, true, "refund");
        var branchPerformance = branchAgg.Count > 0
            ? branchAgg.GroupBy(x => new { x.BranchId, x.BranchName })
                .Select(group => new AnalyticsBreakdownItemDto(
                    group.Key.BranchId.ToString(),
                    group.Key.BranchName,
                    group.Sum(x => x.NetSales),
                    group.Sum(x => x.TransactionCount),
                    group.Sum(x => x.RefundAmount) > 0 ? "watch" : "healthy",
                    "Primary value is net sales, secondary is transaction count."))
                .OrderByDescending(x => x.PrimaryValue)
                .ToList()
            : BuildBranchBreakdown(completedSales, refundedSales, branches);
        var devicePerformance = BuildDeviceBreakdown(completedSales, payments, devices);
        var paymentMethodBreakdown = paymentAgg.Count > 0
            ? paymentAgg.GroupBy(x => x.PaymentMethod)
                .Select(group => new AnalyticsBreakdownItemDto(
                    group.Key,
                    group.Key,
                    group.Sum(x => x.Amount),
                    group.Sum(x => x.TransactionCount),
                    "payment",
                    "Primary value is amount, secondary is transaction count."))
                .OrderByDescending(x => x.PrimaryValue)
                .ToList()
            : BuildPaymentBreakdown(payments.Where(x => completedSaleIds.Contains(x.SaleId)).ToList());
        var stockMoveBreakdown = stockMoves
            .GroupBy(x => x.Reason)
            .OrderByDescending(group => group.Count())
            .Take(6)
            .Select(group => new AnalyticsBreakdownItemDto(
                group.Key,
                group.Key,
                group.Sum(x => Math.Abs(x.QtyDelta)),
                group.Count(),
                "movement",
                "Aggregated stock ledger reason count."))
            .ToList();
        var trendSeries = dailyAgg.Count > 0
            ? BuildAggregateSalesTrendSeries(range, dailyAgg)
            : BuildSalesTrendSeries(range, completedSales, refundedSales);

        var latestSourceTimestamp = new[]
        {
            sales.Select(x => x.CreatedAt).DefaultIfEmpty(DateTimeOffset.MinValue).Max(),
            stockMoves.Select(x => x.CreatedAt).DefaultIfEmpty(DateTimeOffset.MinValue).Max(),
            invoices.Select(x => x.IssuedAt).DefaultIfEmpty(DateTimeOffset.MinValue).Max(),
            deviceActivations.Select(x => x.LastSeenAt).DefaultIfEmpty(DateTimeOffset.MinValue).Max()
        }.Max();
        var warehouseLatestRun = await dbContext.AnalyticsRefreshRuns.AsNoTracking()
            .Where(x => x.Scope == "tenant" && x.TenantId == tenantId && x.Status == "completed")
            .OrderByDescending(x => x.CompletedAt ?? x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        var freshness = BuildFreshness(
            dailyAgg.Count > 0 ? "warehouse_cached" : "near_real_time",
            warehouseLatestRun?.SourceMaxTimestamp ?? latestSourceTimestamp,
            "fresh",
            dailyAgg.Count > 0 ? "Persisted analytics warehouse aggregates." : $"Tenant timezone: {range.Timezone.Id}");

        var latestHeartbeat = deviceActivations.OrderByDescending(x => x.LastSeenAt).Select(x => x.LastSeenAt).FirstOrDefault();
        var daysSinceHeartbeat = latestHeartbeat == default
            ? 999
            : (int)Math.Max(0, (DateTimeOffset.UtcNow - latestHeartbeat).TotalDays);
        var planLimitPressure = license is null || license.DeviceLimit <= 0
            ? 0
            : (int)Math.Round((decimal)deviceActivations.Count / license.DeviceLimit.GetValueOrDefault() * 100m, 0, MidpointRounding.AwayFromZero);
        var health = healthAgg is not null
            ? new CustomerHealthScoreSnapshot(
                healthAgg.Score,
                healthAgg.Status,
                JsonSerializer.Deserialize<string[]>(healthAgg.DriversJson) ?? [])
            : AnalyticsMetricEngine.CalculateCustomerHealth(new CustomerHealthSignalInput(
                subscription?.Status ?? "inactive",
                paymentFailures,
                supportCaseCount,
                deviceActivations.Count,
                daysSinceHeartbeat,
                planLimitPressure,
                deviceActivations.Count > 0 && activePortalUsers > 0 && license is not null));

        var anomalies = AnalyticsMetricEngine.DetectAnomalies(new AnalyticsAnomalySignalInput(
            tenantId.ToString(),
            query.BranchId?.ToString(),
            retailKpis.RefundRate,
            previousRetailKpis.RefundRate,
            await dbContext.AuditLogs.AsNoTracking().CountAsync(x => x.TenantId == tenantId && EF.Functions.Like(x.Action, "%sync%") && x.CreatedAt >= range.StartUtc && x.CreatedAt < range.EndUtc, cancellationToken),
            stockRows.Count(x => x.Qty < 0),
            invoices.Count == 0 ? 0m : Math.Round((decimal)paymentFailures / Math.Max(1, invoices.Count), 4, MidpointRounding.AwayFromZero),
            await dbContext.DeviceActivations.AsNoTracking().CountAsync(x => x.TenantId == tenantId && x.CreatedAt >= DateTimeOffset.UtcNow.AddHours(-24), cancellationToken)))
            .Select((item, index) => ToAnomalyDto(item, $"tenant-anomaly-{index}", tenantId.ToString()))
            .ToList();

        var recommendations = AnalyticsMetricEngine.BuildRecommendations(new AnalyticsRecommendationSignalInput(
            tenantId.ToString(),
            deviceActivations.Count,
            license?.DeviceLimit,
            stockRows.Count(x => x.IsCritical),
            refundHeavy.Count,
            paymentFailures,
            health.Score))
            .Select((item, index) => ToRecommendationDto(item, $"tenant-rec-{index}"))
            .ToList();

        return new TenantAnalyticsWorkspaceDto(
            new TenantExecutiveDashboardDto(
                [
                    BuildKpiCard("gross_sales", "Gross Sales", FormatCurrency(retailKpis.GrossSales), "Completed sales before refunds.", "vs previous period", FormatPercent(retailKpis.BranchGrowthRate), retailKpis.BranchGrowthRate >= 0 ? "up" : "down"),
                    BuildKpiCard("net_sales", "Net Sales", FormatCurrency(retailKpis.NetSales), "Gross sales minus refund facts.", "refund amount", FormatCurrency(retailKpis.RefundAmount), retailKpis.RefundAmount > 0 ? "down" : "flat"),
                    BuildKpiCard("transaction_count", "Transactions", retailKpis.EffectiveTransactionCount.ToString("0"), "Completed transactions excluding voids.", "refund rate", FormatPercent(retailKpis.RefundRate), "flat"),
                    BuildKpiCard("average_basket_value", "Average Basket", FormatCurrency(retailKpis.AverageBasketValue), "Net sales divided by effective transactions.", "units sold", retailKpis.UnitsSold.ToString("0.##"), "flat"),
                    BuildKpiCard("low_stock_item_count", "Low Stock", stockRows.Count(x => x.IsCritical).ToString(), "Critical low-stock item count.", "negative stock", stockRows.Count(x => x.Qty < 0).ToString(), stockRows.Any(x => x.Qty < 0) ? "down" : "flat"),
                    BuildKpiCard("active_devices", "Active Devices", deviceActivations.Count.ToString(), "Activated Desktop and Mobile devices.", "plan pressure", $"{planLimitPressure}%", planLimitPressure >= 90 ? "up" : "flat")
                ],
                trendSeries,
                [
                    branchPerformance.FirstOrDefault() ?? new AnalyticsBreakdownItemDto("branch:none", "Top branch", 0, 0, "empty", "No branch performance yet."),
                    topRevenue.FirstOrDefault() ?? new AnalyticsBreakdownItemDto("product:none", "Top product", 0, 0, "empty", "No product sales yet."),
                    new AnalyticsBreakdownItemDto("sync-health", "Sync health", Math.Max(0, 100 - anomalies.Count * 10), anomalies.Count, anomalies.Count > 0 ? "warning" : "healthy", "Derived from anomaly and sync signal count.")
                ],
                freshness),
            new TenantSalesAnalyticsDto(trendSeries, branchPerformance, paymentMethodBreakdown, devicePerformance, freshness),
            new TenantInventoryAnalyticsDto(
                [
                    BuildKpiCard("low_stock_item_count", "Low Stock Items", stockRows.Count(x => x.IsCritical).ToString(), "Branch and product low-stock count.", "negative stock", stockRows.Count(x => x.Qty < 0).ToString(), stockRows.Any(x => x.Qty < 0) ? "down" : "flat"),
                    BuildKpiCard("stock_adjustment_count", "Stock Adjustments", retailKpis.StockAdjustmentCount.ToString(), "Ledger reasons tagged as adjustment or correction.", "stock moves", stockMoves.Count.ToString(), "flat")
                ],
                stockRows.Where(x => x.IsCritical).Take(8).Select(x => new AnalyticsBreakdownItemDto(x.ProductId.ToString(), $"{x.ProductName} / {x.BranchName}", x.Qty, x.MinStock, "critical", "Current quantity and minimum stock threshold.")).ToList(),
                stockMoveBreakdown,
                freshness),
            new TenantProductAnalyticsDto(topRevenue, topQuantity, refundHeavy, freshness),
            new TenantBranchAnalyticsDto(branchPerformance, freshness),
            new TenantStaffAnalyticsDto(devicePerformance, freshness),
            new TenantAccountHealthDto(
                health.Score,
                health.Status,
                health.Drivers,
                [
                    BuildKpiCard("payment_failure_rate", "Payment Failures", paymentFailures.ToString(), "Failed commerce payment attempts in the range.", "support cases", supportCaseCount.ToString(), paymentFailures > 0 ? "down" : "flat"),
                    BuildKpiCard("active_devices", "Active Devices", deviceActivations.Count.ToString(), "Device fleet using the current subscription.", "device limit", license?.DeviceLimit.ToString() ?? "-", planLimitPressure >= 90 ? "up" : "flat")
                ],
                freshness),
            anomalies,
            recommendations,
            ReportCatalog.Where(x => x.Audience == "customer").ToList(),
            ScheduleCatalog);
    }

    public async Task<string?> ExportTenantReportCsvAsync(Guid tenantId, string reportCode, AnalyticsQuery query, CancellationToken cancellationToken)
    {
        var workspace = await BuildTenantWorkspaceAsync(tenantId, query, cancellationToken);
        return reportCode switch
        {
            "daily-sales" => AnalyticsExportFormatter.BuildCsv(
                ["metric", "value", "comparison", "delta"],
                workspace.Executive.Kpis.Select(x => (IReadOnlyList<string>)[x.Label, x.Value, x.ComparisonLabel, x.Delta]).ToList()),
            "sales-by-branch" => AnalyticsExportFormatter.BuildCsv(
                ["branch", "net_sales", "transactions", "status"],
                workspace.Branches.BranchPerformance.Select(x => (IReadOnlyList<string>)[x.Label, x.PrimaryValue.ToString("0.##"), x.SecondaryValue.ToString("0.##"), x.Status]).ToList()),
            "low-stock" => AnalyticsExportFormatter.BuildCsv(
                ["product_branch", "qty", "min_stock", "status"],
                workspace.Inventory.LowStock.Select(x => (IReadOnlyList<string>)[x.Label, x.PrimaryValue.ToString("0.##"), x.SecondaryValue.ToString("0.##"), x.Status]).ToList()),
            _ => null
        };
    }

    private static IReadOnlyList<AnalyticsBreakdownItemDto> BuildProductBreakdown(
        IReadOnlyList<LoomaPos.Domain.Sales.SaleLine> lines,
        IReadOnlyList<ProductProjection> products,
        bool sortByRevenue,
        string labelPrefix)
    {
        return lines
            .GroupBy(x => x.ProductId)
            .Select(group =>
            {
                var product = products.FirstOrDefault(x => x.Id == group.Key);
                return new AnalyticsBreakdownItemDto(
                    $"{labelPrefix}:{group.Key}",
                    product?.Name ?? group.Key.ToString(),
                    sortByRevenue ? group.Sum(x => x.LineTotal) : group.Sum(x => x.Qty),
                    sortByRevenue ? group.Sum(x => x.Qty) : group.Sum(x => x.LineTotal),
                    "product",
                    sortByRevenue ? "Primary value is revenue, secondary is quantity." : "Primary value is quantity, secondary is revenue.");
            })
            .OrderByDescending(x => x.PrimaryValue)
            .Take(8)
            .ToList();
    }

    private static IReadOnlyList<AnalyticsBreakdownItemDto> BuildBranchBreakdown(
        IReadOnlyList<SaleProjection> completedSales,
        IReadOnlyList<SaleProjection> refundedSales,
        IReadOnlyList<BranchProjection> branches)
    {
        return completedSales
            .GroupBy(x => x.BranchId)
            .Select(group =>
            {
                var refunds = refundedSales.Where(x => x.BranchId == group.Key).Sum(x => x.Total);
                var branch = branches.FirstOrDefault(x => x.Id == group.Key);
                return new AnalyticsBreakdownItemDto(
                    group.Key.ToString(),
                    branch?.Name ?? group.Key.ToString(),
                    group.Sum(x => x.Total) - refunds,
                    group.Count(),
                    refunds > 0 ? "watch" : "healthy",
                    "Primary value is net sales, secondary is transaction count.");
            })
            .OrderByDescending(x => x.PrimaryValue)
            .ToList();
    }

    private static IReadOnlyList<AnalyticsBreakdownItemDto> BuildDeviceBreakdown(
        IReadOnlyList<SaleProjection> completedSales,
        IReadOnlyList<LoomaPos.Domain.Sales.Payment> payments,
        IReadOnlyList<DeviceProjection> devices)
    {
        return completedSales
            .GroupBy(x => x.DeviceId)
            .Select(group =>
            {
                var device = devices.FirstOrDefault(x => x.Id == group.Key);
                var saleIds = group.Select(x => x.Id).ToHashSet();
                var paymentTotal = payments.Where(x => saleIds.Contains(x.SaleId)).Sum(x => x.Amount);
                return new AnalyticsBreakdownItemDto(
                    group.Key.ToString(),
                    device?.Name ?? $"Device {group.Key.ToString()[..8]}",
                    group.Count(),
                    paymentTotal,
                    "device_proxy",
                    "Primary value is transaction count, secondary is payment total.");
            })
            .OrderByDescending(x => x.PrimaryValue)
            .Take(8)
            .ToList();
    }

    private static IReadOnlyList<AnalyticsBreakdownItemDto> BuildPaymentBreakdown(IReadOnlyList<LoomaPos.Domain.Sales.Payment> payments)
    {
        return payments
            .GroupBy(x => x.Method)
            .Select(group => new AnalyticsBreakdownItemDto(
                group.Key.ToString().ToLowerInvariant(),
                group.Key.ToString(),
                group.Sum(x => x.Amount),
                group.Count(),
                "payment",
                "Primary value is amount, secondary is transaction count."))
            .OrderByDescending(x => x.PrimaryValue)
            .ToList();
    }

    private static IReadOnlyList<AnalyticsSeriesDto> BuildSalesTrendSeries(AnalyticsRange range, IReadOnlyList<SaleProjection> completedSales, IReadOnlyList<SaleProjection> refundedSales)
    {
        var netSeries = new List<AnalyticsSeriesPointDto>();
        var transactionSeries = new List<AnalyticsSeriesPointDto>();
        for (var day = 0; day < range.Days; day++)
        {
            var localDate = TimeZoneInfo.ConvertTime(range.StartUtc, range.Timezone).Date.AddDays(day);
            var startLocal = new DateTime(localDate.Year, localDate.Month, localDate.Day, 0, 0, 0, DateTimeKind.Unspecified);
            var endLocal = startLocal.AddDays(1);
            var startUtc = TimeZoneInfo.ConvertTimeToUtc(startLocal, range.Timezone);
            var endUtc = TimeZoneInfo.ConvertTimeToUtc(endLocal, range.Timezone);
            var gross = completedSales.Where(x => x.CreatedAt >= startUtc && x.CreatedAt < endUtc).Sum(x => x.Total);
            var refunds = refundedSales.Where(x => x.CreatedAt >= startUtc && x.CreatedAt < endUtc).Sum(x => x.Total);
            netSeries.Add(new AnalyticsSeriesPointDto(localDate.ToString("dd MMM"), Math.Round(gross - refunds, 2, MidpointRounding.AwayFromZero)));
            transactionSeries.Add(new AnalyticsSeriesPointDto(localDate.ToString("dd MMM"), completedSales.Count(x => x.CreatedAt >= startUtc && x.CreatedAt < endUtc)));
        }

        return
        [
            new AnalyticsSeriesDto("Net sales", "TRY", netSeries),
            new AnalyticsSeriesDto("Transactions", "count", transactionSeries)
        ];
    }

    private static IReadOnlyList<AnalyticsSeriesDto> BuildAggregateSalesTrendSeries(AnalyticsRange range, IReadOnlyList<AggDailySales> dailyAgg)
    {
        var netSeries = new List<AnalyticsSeriesPointDto>();
        var transactionSeries = new List<AnalyticsSeriesPointDto>();
        for (var day = 0; day < range.Days; day++)
        {
            var date = DateOnly.FromDateTime(range.StartUtc.UtcDateTime.Date.AddDays(day));
            var row = dailyAgg.FirstOrDefault(x => x.BusinessDate == date);
            netSeries.Add(new AnalyticsSeriesPointDto(date.ToString("dd MMM"), row?.NetSales ?? 0m));
            transactionSeries.Add(new AnalyticsSeriesPointDto(date.ToString("dd MMM"), row?.EffectiveTransactionCount ?? 0));
        }

        return
        [
            new AnalyticsSeriesDto("Net sales", "TRY", netSeries),
            new AnalyticsSeriesDto("Transactions", "count", transactionSeries)
        ];
    }
}
