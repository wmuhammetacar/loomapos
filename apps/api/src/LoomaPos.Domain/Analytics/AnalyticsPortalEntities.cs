using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Analytics;

public sealed class AnalyticsReportSchedule : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ReportCode { get; set; } = string.Empty;
    public string Frequency { get; set; } = "weekly";
    public string Format { get; set; } = "csv";
    public string Timezone { get; set; } = "Europe/Istanbul";
    public string RecipientsJson { get; set; } = "[]";
    public string FiltersJson { get; set; } = "{}";
    public bool IsActive { get; set; } = true;
    public DateTimeOffset? LastRunAt { get; set; }
    public DateTimeOffset? NextRunAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class AnalyticsSavedView : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? CustomerAccountId { get; set; }
    public string Scope { get; set; } = "tenant";
    public string Name { get; set; } = string.Empty;
    public string ViewCode { get; set; } = string.Empty;
    public string FiltersJson { get; set; } = "{}";
    public bool IsDefault { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
