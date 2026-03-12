namespace LoomaPos.Api.Analytics;

public sealed record AnalyticsQuery(
    int Days = 30,
    Guid? BranchId = null,
    string? Timezone = null);

public sealed record AnalyticsFreshnessDto(
    string Tier,
    DateTimeOffset GeneratedAt,
    DateTimeOffset SourceMaxTimestamp,
    string Status,
    string Note);

public sealed record AnalyticsKpiDefinitionDto(
    string Code,
    string Name,
    string Category,
    string Formula,
    string TimeWindowLogic,
    string InclusionRules,
    string TimezoneLogic,
    string DataFreshnessExpectation,
    string Owner);

public sealed record AnalyticsKpiCardDto(
    string Code,
    string Label,
    string Value,
    string Description,
    string ComparisonLabel,
    string Delta,
    string Trend);

public sealed record AnalyticsSeriesPointDto(
    string Label,
    decimal Value);

public sealed record AnalyticsSeriesDto(
    string Label,
    string Unit,
    IReadOnlyList<AnalyticsSeriesPointDto> Points);

public sealed record AnalyticsBreakdownItemDto(
    string Key,
    string Label,
    decimal PrimaryValue,
    decimal SecondaryValue,
    string Status,
    string Note);

public sealed record AnalyticsReportDefinitionDto(
    string Code,
    string Name,
    string Audience,
    string Description,
    IReadOnlyList<string> ExportFormats,
    IReadOnlyList<string> Filters);

public sealed record AnalyticsScheduleTemplateDto(
    string Code,
    string Name,
    string Frequency,
    string Format,
    string Timezone,
    string Description);

public sealed record AnalyticsAnomalyDto(
    string Id,
    string Type,
    string Severity,
    string Explanation,
    string SuggestedFollowUp,
    string Status,
    DateTimeOffset GeneratedAt,
    string TargetEntity,
    IReadOnlyList<string> EvidenceSignals,
    string BaselinePeriod,
    string ComparisonPeriod,
    string RuleVersion);

public sealed record AnalyticsRecommendationDto(
    string Id,
    string Type,
    string TargetEntity,
    string Explanation,
    IReadOnlyList<string> EvidenceSignals,
    decimal ConfidenceScore,
    DateTimeOffset GeneratedAt,
    string Status,
    string RecommendedAction,
    string RuleVersion);

public sealed record TenantExecutiveDashboardDto(
    IReadOnlyList<AnalyticsKpiCardDto> Kpis,
    IReadOnlyList<AnalyticsSeriesDto> Trends,
    IReadOnlyList<AnalyticsBreakdownItemDto> Highlights,
    AnalyticsFreshnessDto Freshness);

public sealed record TenantSalesAnalyticsDto(
    IReadOnlyList<AnalyticsSeriesDto> Trends,
    IReadOnlyList<AnalyticsBreakdownItemDto> Branches,
    IReadOnlyList<AnalyticsBreakdownItemDto> PaymentMethods,
    IReadOnlyList<AnalyticsBreakdownItemDto> Devices,
    AnalyticsFreshnessDto Freshness);

public sealed record TenantInventoryAnalyticsDto(
    IReadOnlyList<AnalyticsKpiCardDto> Kpis,
    IReadOnlyList<AnalyticsBreakdownItemDto> LowStock,
    IReadOnlyList<AnalyticsBreakdownItemDto> StockMoves,
    AnalyticsFreshnessDto Freshness);

public sealed record TenantProductAnalyticsDto(
    IReadOnlyList<AnalyticsBreakdownItemDto> TopRevenueProducts,
    IReadOnlyList<AnalyticsBreakdownItemDto> TopQuantityProducts,
    IReadOnlyList<AnalyticsBreakdownItemDto> RefundHeavyProducts,
    AnalyticsFreshnessDto Freshness);

public sealed record TenantBranchAnalyticsDto(
    IReadOnlyList<AnalyticsBreakdownItemDto> BranchPerformance,
    AnalyticsFreshnessDto Freshness);

public sealed record TenantStaffAnalyticsDto(
    IReadOnlyList<AnalyticsBreakdownItemDto> StaffPerformance,
    AnalyticsFreshnessDto Freshness);

public sealed record TenantAccountHealthDto(
    int Score,
    string Status,
    IReadOnlyList<string> Drivers,
    IReadOnlyList<AnalyticsKpiCardDto> CommercialKpis,
    AnalyticsFreshnessDto Freshness);

public sealed record TenantAnalyticsWorkspaceDto(
    TenantExecutiveDashboardDto Executive,
    TenantSalesAnalyticsDto Sales,
    TenantInventoryAnalyticsDto Inventory,
    TenantProductAnalyticsDto Products,
    TenantBranchAnalyticsDto Branches,
    TenantStaffAnalyticsDto Staff,
    TenantAccountHealthDto Health,
    IReadOnlyList<AnalyticsAnomalyDto> Anomalies,
    IReadOnlyList<AnalyticsRecommendationDto> Recommendations,
    IReadOnlyList<AnalyticsReportDefinitionDto> ReportCatalog,
    IReadOnlyList<AnalyticsScheduleTemplateDto> ScheduleTemplates);

public sealed record ResellerAnalyticsWorkspaceDto(
    IReadOnlyList<AnalyticsKpiCardDto> Kpis,
    IReadOnlyList<AnalyticsBreakdownItemDto> Funnel,
    IReadOnlyList<AnalyticsBreakdownItemDto> TopCustomers,
    IReadOnlyList<AnalyticsBreakdownItemDto> CommissionStatus,
    AnalyticsFreshnessDto Freshness);

public sealed record InternalAnalyticsWorkspaceDto(
    IReadOnlyList<AnalyticsKpiCardDto> Kpis,
    IReadOnlyList<AnalyticsSeriesDto> RevenueTrends,
    IReadOnlyList<AnalyticsBreakdownItemDto> PlanMix,
    IReadOnlyList<AnalyticsBreakdownItemDto> BillingHealth,
    IReadOnlyList<AnalyticsBreakdownItemDto> VersionAdoption,
    IReadOnlyList<AnalyticsBreakdownItemDto> ResellerPerformance,
    IReadOnlyList<AnalyticsAnomalyDto> Anomalies,
    IReadOnlyList<AnalyticsRecommendationDto> Recommendations,
    AnalyticsFreshnessDto Freshness);

public sealed record AnalyticsQualitySummaryDto(
    DateTimeOffset GeneratedAt,
    DateTimeOffset LastEventIngestionAt,
    DateTimeOffset LastAggregateRefreshAt,
    int DuplicateEventCount,
    int MissingRefundLinkageCount,
    int NegativeStockAnomalyCount,
    int MissingBranchIdCount,
    int PaymentMismatchCount,
    int OrphanedHeartbeatCount,
    string FreshnessStatus,
    IReadOnlyList<string> Alerts);

public sealed record AnalyticsReportScheduleDto(
    Guid Id,
    string Name,
    string ReportCode,
    string Frequency,
    string Format,
    string Timezone,
    IReadOnlyList<string> Recipients,
    string FiltersJson,
    bool IsActive,
    DateTimeOffset? LastRunAt,
    DateTimeOffset? NextRunAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record AnalyticsSavedViewDto(
    Guid Id,
    string Scope,
    string Name,
    string ViewCode,
    string FiltersJson,
    bool IsDefault,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
