using LoomaPos.Application.Analytics;
using LoomaPos.Domain.Common;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Analytics;

public interface IAnalyticsReadModelService
{
    IReadOnlyList<AnalyticsKpiDefinitionDto> GetKpiCatalog();
    IReadOnlyList<AnalyticsReportDefinitionDto> GetReportCatalog();
    Task<TenantAnalyticsWorkspaceDto> BuildTenantWorkspaceAsync(Guid tenantId, AnalyticsQuery query, CancellationToken cancellationToken);
    Task<ResellerAnalyticsWorkspaceDto> BuildResellerWorkspaceAsync(Guid resellerAccountId, AnalyticsQuery query, CancellationToken cancellationToken);
    Task<InternalAnalyticsWorkspaceDto> BuildInternalWorkspaceAsync(AnalyticsQuery query, CancellationToken cancellationToken);
    Task<AnalyticsQualitySummaryDto> BuildQualitySummaryAsync(CancellationToken cancellationToken);
    Task<string?> ExportTenantReportCsvAsync(Guid tenantId, string reportCode, AnalyticsQuery query, CancellationToken cancellationToken);
    Task<IReadOnlyList<AnalyticsReportScheduleDto>> GetTenantSchedulesAsync(Guid tenantId, CancellationToken cancellationToken);
    Task<AnalyticsReportScheduleDto> UpsertTenantScheduleAsync(Guid tenantId, string? scheduleId, string name, string reportCode, string frequency, string format, string timezone, IReadOnlyList<string> recipients, string filtersJson, bool isActive, CancellationToken cancellationToken);
    Task<IReadOnlyList<AnalyticsSavedViewDto>> GetTenantSavedViewsAsync(Guid tenantId, Guid? customerAccountId, CancellationToken cancellationToken);
    Task<AnalyticsSavedViewDto> SaveTenantViewAsync(Guid tenantId, Guid? customerAccountId, string name, string viewCode, string filtersJson, bool isDefault, CancellationToken cancellationToken);
    Task<bool> DeleteTenantViewAsync(Guid tenantId, Guid? customerAccountId, Guid viewId, CancellationToken cancellationToken);
}

public sealed partial class AnalyticsReadModelService(AppDbContext dbContext, IAnalyticsWarehouseService warehouseService) : IAnalyticsReadModelService
{
    public IReadOnlyList<AnalyticsKpiDefinitionDto> GetKpiCatalog() => KpiCatalog;

    public IReadOnlyList<AnalyticsReportDefinitionDto> GetReportCatalog() => ReportCatalog;

    private static AnalyticsFreshnessDto BuildFreshness(string tier, DateTimeOffset sourceMaxTimestamp, string status, string note)
    {
        var timestamp = sourceMaxTimestamp == DateTimeOffset.MinValue ? DateTimeOffset.UtcNow : sourceMaxTimestamp;
        return new AnalyticsFreshnessDto(tier, DateTimeOffset.UtcNow, timestamp, status, note);
    }

    private static AnalyticsKpiCardDto BuildKpiCard(string code, string label, string value, string description, string comparisonLabel, string delta, string trend)
        => new(code, label, value, description, comparisonLabel, delta, trend);

    private static AnalyticsAnomalyDto ToAnomalyDto(AnalyticsAnomalyRecord item, string id, string targetEntity)
        => new(id, item.Type, item.Severity, item.Explanation, item.SuggestedFollowUp, "new", DateTimeOffset.UtcNow, targetEntity, item.EvidenceSignals, item.BaselinePeriod, item.ComparisonPeriod, item.RuleVersion);

    private static AnalyticsRecommendationDto ToRecommendationDto(AnalyticsRecommendationRecord item, string id)
        => new(id, item.Type, item.TargetEntity, item.Explanation, item.EvidenceSignals, item.ConfidenceScore, DateTimeOffset.UtcNow, "new", item.RecommendedAction, item.RuleVersion);

    private static string FormatCurrency(decimal value) => value.ToString("0.00") + " TRY";

    private static string FormatPercent(decimal ratio) => $"{Math.Round(ratio * 100m, 1, MidpointRounding.AwayFromZero):0.#}%";

    private static decimal ExtractPlanPrice(string? planSnapshotJson)
    {
        if (string.IsNullOrWhiteSpace(planSnapshotJson))
        {
            return 0m;
        }

        try
        {
            using var document = System.Text.Json.JsonDocument.Parse(planSnapshotJson);
            return document.RootElement.TryGetProperty("price", out var price) && price.ValueKind != System.Text.Json.JsonValueKind.Null
                ? price.GetDecimal()
                : 0m;
        }
        catch
        {
            return 0m;
        }
    }

    private static AnalyticsRange ResolveRange(AnalyticsQuery query)
    {
        var days = Math.Clamp(query.Days, 1, 90);
        var timezone = ResolveTimezone(query.Timezone);
        var localNow = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, timezone);
        var startLocal = localNow.Date.AddDays(-(days - 1));
        var startUtc = TimeZoneInfo.ConvertTimeToUtc(startLocal, timezone);
        return new AnalyticsRange(startUtc, DateTimeOffset.UtcNow, timezone, days);
    }

    private static TimeZoneInfo ResolveTimezone(string? timezone)
    {
        var candidates = new[]
        {
            timezone,
            "Europe/Istanbul",
            "Turkey Standard Time",
            TimeZoneInfo.Utc.Id
        }.Where(x => !string.IsNullOrWhiteSpace(x)).Cast<string>();

        foreach (var candidate in candidates)
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(candidate);
            }
            catch
            {
            }
        }

        return TimeZoneInfo.Utc;
    }

    private async Task<List<SaleProjection>> QuerySalesAsync(Guid tenantId, Guid? branchId, DateTimeOffset startUtc, DateTimeOffset endUtc, CancellationToken cancellationToken)
    {
        var query = dbContext.Sales.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.CreatedAt >= startUtc && x.CreatedAt < endUtc);
        if (branchId.HasValue)
        {
            query = query.Where(x => x.BranchId == branchId.Value);
        }

        return await query
            .Select(x => new SaleProjection(x.Id, x.BranchId, x.DeviceId, x.Total, x.CreatedAt, x.Status, x.ReceiptNo))
            .ToListAsync(cancellationToken);
    }

    private async Task<List<StockRow>> QueryStockRowsAsync(Guid tenantId, Guid? branchId, CancellationToken cancellationToken)
    {
        var query = from balance in dbContext.StockBalances.AsNoTracking()
                    join product in dbContext.Products.AsNoTracking() on balance.ProductId equals product.Id
                    join branch in dbContext.Branches.AsNoTracking() on balance.BranchId equals branch.Id
                    where balance.TenantId == tenantId && product.StockTrackingEnabled && (!branchId.HasValue || balance.BranchId == branchId.Value)
                    select new StockRow(
                        product.Id,
                        product.Name,
                        branch.Name,
                        balance.Qty,
                        product.MinStock,
                        balance.Qty <= product.MinStock);

        return await query.OrderBy(x => x.Qty).Take(50).ToListAsync(cancellationToken);
    }

    private sealed record AnalyticsRange(DateTimeOffset StartUtc, DateTimeOffset EndUtc, TimeZoneInfo Timezone, int Days);
    private sealed record SaleProjection(Guid Id, Guid BranchId, Guid DeviceId, decimal Total, DateTimeOffset CreatedAt, SaleStatus Status, string ReceiptNo);
    private sealed record StockRow(Guid ProductId, string ProductName, string BranchName, decimal Qty, decimal MinStock, bool IsCritical);
    private sealed record ProductProjection(Guid Id, string Name, decimal MinStock, bool StockTrackingEnabled, bool IsActive, Guid? CategoryId, decimal PurchasePrice);
    private sealed record BranchProjection(Guid Id, string Name);
    private sealed record DeviceProjection(Guid Id, string Name, DateTimeOffset? LastSeenAt);
}
