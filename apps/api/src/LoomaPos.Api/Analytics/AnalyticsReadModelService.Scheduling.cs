using LoomaPos.Domain.Analytics;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Analytics;

public sealed partial class AnalyticsReadModelService
{
    public async Task<IReadOnlyList<AnalyticsReportScheduleDto>> GetTenantSchedulesAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        return await dbContext.AnalyticsReportSchedules.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new AnalyticsReportScheduleDto(
                x.Id,
                x.Name,
                x.ReportCode,
                x.Frequency,
                x.Format,
                x.Timezone,
                DeserializeStringList(x.RecipientsJson),
                x.FiltersJson,
                x.IsActive,
                x.LastRunAt,
                x.NextRunAt,
                x.CreatedAt,
                x.UpdatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<AnalyticsReportScheduleDto> UpsertTenantScheduleAsync(
        Guid tenantId,
        string? scheduleId,
        string name,
        string reportCode,
        string frequency,
        string format,
        string timezone,
        IReadOnlyList<string> recipients,
        string filtersJson,
        bool isActive,
        CancellationToken cancellationToken)
    {
        AnalyticsReportSchedule? item = null;
        if (Guid.TryParse(scheduleId, out var parsedId))
        {
            item = await dbContext.AnalyticsReportSchedules.FirstOrDefaultAsync(x => x.Id == parsedId && x.TenantId == tenantId, cancellationToken);
        }

        if (item is null)
        {
            item = new AnalyticsReportSchedule
            {
                TenantId = tenantId
            };
            dbContext.AnalyticsReportSchedules.Add(item);
        }

        item.Name = name.Trim();
        item.ReportCode = reportCode.Trim().ToLowerInvariant();
        item.Frequency = frequency.Trim().ToLowerInvariant();
        item.Format = format.Trim().ToLowerInvariant();
        item.Timezone = timezone.Trim();
        item.RecipientsJson = System.Text.Json.JsonSerializer.Serialize(recipients.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim().ToLowerInvariant()).Distinct().ToArray());
        item.FiltersJson = string.IsNullOrWhiteSpace(filtersJson) ? "{}" : filtersJson;
        item.IsActive = isActive;
        item.NextRunAt = CalculateNextRun(item.Frequency, item.Timezone);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new AnalyticsReportScheduleDto(
            item.Id,
            item.Name,
            item.ReportCode,
            item.Frequency,
            item.Format,
            item.Timezone,
            DeserializeStringList(item.RecipientsJson),
            item.FiltersJson,
            item.IsActive,
            item.LastRunAt,
            item.NextRunAt,
            item.CreatedAt,
            item.UpdatedAt);
    }

    public async Task<IReadOnlyList<AnalyticsSavedViewDto>> GetTenantSavedViewsAsync(Guid tenantId, Guid? customerAccountId, CancellationToken cancellationToken)
    {
        var query = dbContext.AnalyticsSavedViews.AsNoTracking()
            .Where(x => x.TenantId == tenantId && (x.Scope == "tenant" || (x.Scope == "user" && customerAccountId != null && x.CustomerAccountId == customerAccountId)));

        return await query
            .OrderByDescending(x => x.IsDefault)
            .ThenByDescending(x => x.UpdatedAt)
            .Select(x => new AnalyticsSavedViewDto(
                x.Id,
                x.Scope,
                x.Name,
                x.ViewCode,
                x.FiltersJson,
                x.IsDefault,
                x.CreatedAt,
                x.UpdatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<AnalyticsSavedViewDto> SaveTenantViewAsync(Guid tenantId, Guid? customerAccountId, string name, string viewCode, string filtersJson, bool isDefault, CancellationToken cancellationToken)
    {
        var scope = customerAccountId.HasValue ? "user" : "tenant";
        var normalizedName = name.Trim();
        var normalizedViewCode = viewCode.Trim().ToLowerInvariant();
        var item = await dbContext.AnalyticsSavedViews.FirstOrDefaultAsync(x =>
            x.TenantId == tenantId &&
            x.Scope == scope &&
            x.CustomerAccountId == customerAccountId &&
            x.ViewCode == normalizedViewCode &&
            x.Name == normalizedName, cancellationToken);

        if (item is null)
        {
            item = new AnalyticsSavedView
            {
                TenantId = tenantId,
                CustomerAccountId = customerAccountId,
                Scope = scope,
                Name = normalizedName,
                ViewCode = normalizedViewCode
            };
            dbContext.AnalyticsSavedViews.Add(item);
        }

        item.FiltersJson = string.IsNullOrWhiteSpace(filtersJson) ? "{}" : filtersJson;
        item.IsDefault = isDefault;

        if (isDefault)
        {
            var siblings = await dbContext.AnalyticsSavedViews
                .Where(x => x.TenantId == tenantId &&
                            x.Scope == scope &&
                            x.CustomerAccountId == customerAccountId &&
                            x.ViewCode == normalizedViewCode &&
                            x.Id != item.Id &&
                            x.IsDefault)
                .ToListAsync(cancellationToken);
            foreach (var sibling in siblings)
            {
                sibling.IsDefault = false;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return new AnalyticsSavedViewDto(
            item.Id,
            item.Scope,
            item.Name,
            item.ViewCode,
            item.FiltersJson,
            item.IsDefault,
            item.CreatedAt,
            item.UpdatedAt);
    }

    public async Task<bool> DeleteTenantViewAsync(Guid tenantId, Guid? customerAccountId, Guid viewId, CancellationToken cancellationToken)
    {
        var item = await dbContext.AnalyticsSavedViews.FirstOrDefaultAsync(x =>
            x.Id == viewId &&
            x.TenantId == tenantId &&
            (x.Scope == "tenant" || (x.Scope == "user" && x.CustomerAccountId == customerAccountId)), cancellationToken);
        if (item is null)
        {
            return false;
        }

        dbContext.AnalyticsSavedViews.Remove(item);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static IReadOnlyList<string> DeserializeStringList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Array.Empty<string>();
        }

        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<string[]>(json) ?? Array.Empty<string>();
        }
        catch
        {
            return Array.Empty<string>();
        }
    }

    private static DateTimeOffset? CalculateNextRun(string frequency, string timezone)
    {
        var tz = ResolveTimezone(timezone);
        var localNow = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, tz);
        var nextLocal = frequency switch
        {
            "daily" => localNow.Date.AddDays(1).AddHours(7),
            "monthly" => new DateTime(localNow.Year, localNow.Month, 1).AddMonths(1).AddHours(7),
            _ => localNow.Date.AddDays(7).AddHours(7)
        };

        var utc = TimeZoneInfo.ConvertTimeToUtc(nextLocal, tz);
        return new DateTimeOffset(utc);
    }
}
