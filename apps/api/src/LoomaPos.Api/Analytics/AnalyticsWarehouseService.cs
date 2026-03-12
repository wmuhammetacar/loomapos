using System.Text.Json;
using LoomaPos.Application.Analytics;
using LoomaPos.Domain.Analytics;
using LoomaPos.Domain.Common;
using LoomaPos.Domain.Sales;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Analytics;

public interface IAnalyticsWarehouseService
{
    Task EnsureTenantWarehouseFreshAsync(Guid tenantId, CancellationToken cancellationToken);
}

public sealed class AnalyticsWarehouseService(AppDbContext dbContext) : IAnalyticsWarehouseService
{
    private static readonly TimeSpan RefreshTtl = TimeSpan.FromMinutes(15);

    public async Task EnsureTenantWarehouseFreshAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var latestRun = await dbContext.AnalyticsRefreshRuns.AsNoTracking()
            .Where(x => x.Scope == "tenant" && x.TenantId == tenantId && x.Status == "completed")
            .OrderByDescending(x => x.CompletedAt ?? x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (latestRun is not null && (DateTimeOffset.UtcNow - (latestRun.CompletedAt ?? latestRun.CreatedAt)) < RefreshTtl)
        {
            return;
        }

        var run = new AnalyticsRefreshRun
        {
            TenantId = tenantId,
            Scope = "tenant",
            Status = "running",
            StartedAt = DateTimeOffset.UtcNow,
            SourceMaxTimestamp = DateTimeOffset.UtcNow
        };
        dbContext.AnalyticsRefreshRuns.Add(run);
        await dbContext.SaveChangesAsync(cancellationToken);

        try
        {
            var end = DateTimeOffset.UtcNow;
            var start = end.AddDays(-90);

            var sales = await dbContext.Sales.AsNoTracking()
                .Where(x => x.TenantId == tenantId && x.CreatedAt >= start && x.CreatedAt < end)
                .Select(x => new { x.Id, x.BranchId, x.DeviceId, x.Total, x.CreatedAt, x.Status })
                .ToListAsync(cancellationToken);
            var saleIds = sales.Select(x => x.Id).ToArray();
            var lines = saleIds.Length == 0
                ? []
                : await dbContext.SaleLines.AsNoTracking().Where(x => saleIds.Contains(x.SaleId)).ToListAsync(cancellationToken);
            var payments = saleIds.Length == 0
                ? []
                : await dbContext.Payments.AsNoTracking().Where(x => saleIds.Contains(x.SaleId)).ToListAsync(cancellationToken);
            var branches = await dbContext.Branches.AsNoTracking()
                .Where(x => x.TenantId == tenantId)
                .Select(x => new { x.Id, x.Name })
                .ToListAsync(cancellationToken);
            var stockRows = await (
                from balance in dbContext.StockBalances.AsNoTracking()
                join product in dbContext.Products.AsNoTracking() on balance.ProductId equals product.Id
                where balance.TenantId == tenantId && product.StockTrackingEnabled
                select new { balance.BranchId, balance.Qty, product.MinStock }
            ).ToListAsync(cancellationToken);
            var stockMoves = await dbContext.StockMoves.AsNoTracking()
                .Where(x => x.TenantId == tenantId && x.CreatedAt >= start && x.CreatedAt < end)
                .ToListAsync(cancellationToken);
            var deviceActivations = await dbContext.DeviceActivations.AsNoTracking()
                .Where(x => x.TenantId == tenantId && x.RevokedAt == null)
                .ToListAsync(cancellationToken);
            var subscription = await dbContext.Subscriptions.AsNoTracking()
                .Where(x => x.TenantId == tenantId)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);
            var license = await dbContext.IssuedLicenses.AsNoTracking()
                .Where(x => x.TenantId == tenantId)
                .OrderByDescending(x => x.IssuedAt)
                .FirstOrDefaultAsync(cancellationToken);
            var paymentFailures = await dbContext.PaymentTransactions.AsNoTracking()
                .CountAsync(x => x.TenantId == tenantId && x.Status == "failed" && x.CreatedAt >= start && x.CreatedAt < end, cancellationToken);
            var supportCaseCount = await dbContext.EmailNotifications.AsNoTracking()
                .CountAsync(x => x.TenantId == tenantId && x.EventCode == "portal_support_request" && x.CreatedAt >= start && x.CreatedAt < end, cancellationToken);
            var activePortalUsers = await dbContext.TenantUsers.AsNoTracking()
                .CountAsync(x => x.TenantId == tenantId && x.Status == "active", cancellationToken);

            var sourceMaxTimestamp = new[]
            {
                sales.Select(x => x.CreatedAt).DefaultIfEmpty(DateTimeOffset.MinValue).Max(),
                stockMoves.Select(x => x.CreatedAt).DefaultIfEmpty(DateTimeOffset.MinValue).Max(),
                deviceActivations.Select(x => x.LastSeenAt).DefaultIfEmpty(DateTimeOffset.MinValue).Max()
            }.Max();

            var salesByDay = sales.GroupBy(x => DateOnly.FromDateTime(x.CreatedAt.UtcDateTime.Date)).ToList();
            var dailyRows = new List<AggDailySales>();
            foreach (var group in salesByDay)
            {
                var completed = group.Where(x => x.Status == SaleStatus.Completed).ToList();
                var refunded = group.Where(x => x.Status == SaleStatus.Refunded).ToList();
                var voided = group.Where(x => x.Status == SaleStatus.Voided).ToList();
                var completedIds = completed.Select(x => x.Id).ToHashSet();
                var retail = AnalyticsMetricEngine.CalculateRetailKpis(new RetailMetricInput(
                    completed.Sum(x => x.Total),
                    refunded.Sum(x => x.Total),
                    completed.Count,
                    voided.Count,
                    lines.Where(x => completedIds.Contains(x.SaleId)).Sum(x => x.Qty),
                    payments.Where(x => completedIds.Contains(x.SaleId) && x.Method == PaymentMethod.Cash).Sum(x => x.Amount),
                    payments.Where(x => completedIds.Contains(x.SaleId) && x.Method == PaymentMethod.Card).Sum(x => x.Amount),
                    stockRows.Count(x => x.Qty <= x.MinStock),
                    stockMoves.Count(x => DateOnly.FromDateTime(x.CreatedAt.UtcDateTime.Date) == group.Key &&
                        (x.Reason.Contains("adjustment", StringComparison.OrdinalIgnoreCase) || x.Reason.Contains("correction", StringComparison.OrdinalIgnoreCase))),
                    completed.Count,
                    0,
                    0m));

                dailyRows.Add(new AggDailySales
                {
                    TenantId = tenantId,
                    BusinessDate = group.Key,
                    GrossSales = retail.GrossSales,
                    RefundAmount = retail.RefundAmount,
                    NetSales = retail.NetSales,
                    CompletedTransactionCount = retail.TransactionCount,
                    VoidCount = retail.TransactionCount - retail.EffectiveTransactionCount,
                    EffectiveTransactionCount = retail.EffectiveTransactionCount,
                    UnitsSold = retail.UnitsSold,
                    AverageBasketValue = retail.AverageBasketValue,
                    LowStockItemCount = retail.LowStockItemCount,
                    StockAdjustmentCount = retail.StockAdjustmentCount,
                    SourceMaxTimestamp = sourceMaxTimestamp
                });
            }

            var branchRows = sales
                .Where(x => x.Status == SaleStatus.Completed || x.Status == SaleStatus.Refunded)
                .GroupBy(x => new { x.BranchId, BusinessDate = DateOnly.FromDateTime(x.CreatedAt.UtcDateTime.Date) })
                .Select(group =>
                {
                    var branchName = branches.FirstOrDefault(x => x.Id == group.Key.BranchId)?.Name ?? group.Key.BranchId.ToString();
                    var completed = group.Where(x => x.Status == SaleStatus.Completed).ToList();
                    var refunded = group.Where(x => x.Status == SaleStatus.Refunded).ToList();
                    return new AggBranchDailySales
                    {
                        TenantId = tenantId,
                        BranchId = group.Key.BranchId,
                        BusinessDate = group.Key.BusinessDate,
                        BranchName = branchName,
                        NetSales = completed.Sum(x => x.Total) - refunded.Sum(x => x.Total),
                        RefundAmount = refunded.Sum(x => x.Total),
                        TransactionCount = completed.Count,
                        ActiveDeviceCount = sales.Where(x => x.BranchId == group.Key.BranchId).Select(x => x.DeviceId).Distinct().Count(),
                        SourceMaxTimestamp = sourceMaxTimestamp
                    };
                })
                .ToList();

            var paymentRows = (
                from payment in payments
                join sale in sales on payment.SaleId equals sale.Id
                where sale.Status == SaleStatus.Completed
                group payment by new { BusinessDate = DateOnly.FromDateTime(sale.CreatedAt.UtcDateTime.Date), payment.Method } into grouped
                select new AggPaymentMethodDaily
                {
                    TenantId = tenantId,
                    BusinessDate = grouped.Key.BusinessDate,
                    PaymentMethod = grouped.Key.Method.ToString().ToLowerInvariant(),
                    Amount = grouped.Sum(x => x.Amount),
                    TransactionCount = grouped.Count(),
                    SourceMaxTimestamp = sourceMaxTimestamp
                }).ToList();

            var latestHeartbeat = deviceActivations.OrderByDescending(x => x.LastSeenAt).Select(x => x.LastSeenAt).FirstOrDefault();
            var daysSinceHeartbeat = latestHeartbeat == default
                ? 999
                : (int)Math.Max(0, (DateTimeOffset.UtcNow - latestHeartbeat).TotalDays);
            var planLimitPressure = license is null || license.DeviceLimit <= 0
                ? 0
                : (int)Math.Round((decimal)deviceActivations.Count / license.DeviceLimit.GetValueOrDefault() * 100m, 0, MidpointRounding.AwayFromZero);
            var health = AnalyticsMetricEngine.CalculateCustomerHealth(new CustomerHealthSignalInput(
                subscription?.Status ?? "inactive",
                paymentFailures,
                supportCaseCount,
                deviceActivations.Count,
                daysSinceHeartbeat,
                planLimitPressure,
                deviceActivations.Count > 0 && activePortalUsers > 0 && license is not null));

            var healthRow = new AggCustomerHealthSnapshot
            {
                TenantId = tenantId,
                Score = health.Score,
                Status = health.Status,
                DriversJson = JsonSerializer.Serialize(health.Drivers),
                ActiveDevices = deviceActivations.Count,
                FailedPayments = paymentFailures,
                OpenSupportCases = supportCaseCount,
                DaysSinceLastHeartbeat = daysSinceHeartbeat,
                PlanLimitPressurePercent = planLimitPressure,
                GeneratedAt = DateTimeOffset.UtcNow,
                SourceMaxTimestamp = sourceMaxTimestamp
            };

            var existingDaily = await dbContext.AggDailySales.Where(x => x.TenantId == tenantId).ToListAsync(cancellationToken);
            var existingBranch = await dbContext.AggBranchDailySales.Where(x => x.TenantId == tenantId).ToListAsync(cancellationToken);
            var existingPayment = await dbContext.AggPaymentMethodDaily.Where(x => x.TenantId == tenantId).ToListAsync(cancellationToken);
            var existingHealth = await dbContext.AggCustomerHealthSnapshots.FirstOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);

            dbContext.AggDailySales.RemoveRange(existingDaily);
            dbContext.AggBranchDailySales.RemoveRange(existingBranch);
            dbContext.AggPaymentMethodDaily.RemoveRange(existingPayment);
            if (existingHealth is not null)
            {
                dbContext.AggCustomerHealthSnapshots.Remove(existingHealth);
            }

            await dbContext.SaveChangesAsync(cancellationToken);

            dbContext.AggDailySales.AddRange(dailyRows);
            dbContext.AggBranchDailySales.AddRange(branchRows);
            dbContext.AggPaymentMethodDaily.AddRange(paymentRows);
            dbContext.AggCustomerHealthSnapshots.Add(healthRow);

            run.Status = "completed";
            run.SourceMaxTimestamp = sourceMaxTimestamp;
            run.CompletedAt = DateTimeOffset.UtcNow;
            run.RecordsWritten = dailyRows.Count + branchRows.Count + paymentRows.Count + 1;

            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            run.Status = "failed";
            run.CompletedAt = DateTimeOffset.UtcNow;
            run.Error = ex.Message[..Math.Min(ex.Message.Length, 500)];
            await dbContext.SaveChangesAsync(cancellationToken);
            throw;
        }
    }
}
