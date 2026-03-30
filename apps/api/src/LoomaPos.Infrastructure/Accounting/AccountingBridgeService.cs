using LoomaPos.Domain.Accounting;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Infrastructure.Accounting;

public interface IAccountingBridgeService
{
    Task EnsurePendingExportItemAsync(
        Guid tenantId,
        string sourceType,
        string sourceId,
        string eventCode,
        string payloadJson,
        CancellationToken cancellationToken);

    Task<bool> MarkExportedAsync(
        Guid tenantId,
        Guid exportItemId,
        DateTimeOffset? exportedAt,
        CancellationToken cancellationToken);

    Task<bool> MarkFailedAsync(
        Guid tenantId,
        Guid exportItemId,
        string failureReason,
        bool retryReady,
        CancellationToken cancellationToken);
}

public sealed class AccountingBridgeService(AppDbContext dbContext) : IAccountingBridgeService
{
    public async Task EnsurePendingExportItemAsync(
        Guid tenantId,
        string sourceType,
        string sourceId,
        string eventCode,
        string payloadJson,
        CancellationToken cancellationToken)
    {
        var normalizedSourceType = NormalizeSourceType(sourceType);
        var normalizedSourceId = NormalizeRequired(sourceId, nameof(sourceId), 120);
        var normalizedEventCode = NormalizeRequired(eventCode, nameof(eventCode), 80);
        var normalizedPayload = string.IsNullOrWhiteSpace(payloadJson) ? "{}" : payloadJson.Trim();
        var now = DateTimeOffset.UtcNow;

        await dbContext.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO accounting_export_items (
                id,
                tenant_id,
                source_type,
                source_id,
                event_code,
                payload_json,
                status,
                created_at,
                exported_at,
                failure_reason
            )
            VALUES (
                {Guid.NewGuid()},
                {tenantId},
                {normalizedSourceType},
                {normalizedSourceId},
                {normalizedEventCode},
                {normalizedPayload},
                {AccountingBridgeStatuses.Pending},
                {now},
                {null as DateTimeOffset?},
                {null as string}
            )
            ON CONFLICT (tenant_id, source_type, source_id)
            DO UPDATE SET
                event_code = EXCLUDED.event_code,
                payload_json = EXCLUDED.payload_json,
                status = CASE
                    WHEN accounting_export_items.status = 'exported' THEN accounting_export_items.status
                    ELSE 'pending'
                END,
                failure_reason = CASE
                    WHEN accounting_export_items.status = 'exported' THEN accounting_export_items.failure_reason
                    ELSE NULL
                END,
                exported_at = CASE
                    WHEN accounting_export_items.status = 'exported' THEN accounting_export_items.exported_at
                    ELSE NULL
                END;
            """, cancellationToken);
    }

    public async Task<bool> MarkExportedAsync(
        Guid tenantId,
        Guid exportItemId,
        DateTimeOffset? exportedAt,
        CancellationToken cancellationToken)
    {
        var item = await dbContext.Set<AccountingExportItem>()
            .FirstOrDefaultAsync(x => x.Id == exportItemId && x.TenantId == tenantId, cancellationToken);

        if (item is null)
        {
            return false;
        }

        item.Status = AccountingBridgeStatuses.Exported;
        item.ExportedAt = exportedAt ?? DateTimeOffset.UtcNow;
        item.FailureReason = null;

        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> MarkFailedAsync(
        Guid tenantId,
        Guid exportItemId,
        string failureReason,
        bool retryReady,
        CancellationToken cancellationToken)
    {
        var item = await dbContext.Set<AccountingExportItem>()
            .FirstOrDefaultAsync(x => x.Id == exportItemId && x.TenantId == tenantId, cancellationToken);

        if (item is null)
        {
            return false;
        }

        if (retryReady)
        {
            item.Status = AccountingBridgeStatuses.Pending;
            item.FailureReason = null;
            item.ExportedAt = null;
        }
        else
        {
            var normalizedReason = NormalizeRequired(failureReason, nameof(failureReason), 600);
            item.Status = AccountingBridgeStatuses.Failed;
            item.FailureReason = normalizedReason;
            item.ExportedAt = null;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static string NormalizeSourceType(string sourceType)
    {
        var normalized = NormalizeRequired(sourceType, nameof(sourceType), 40).ToLowerInvariant();
        if (AccountingBridgeSourceTypes.All.Contains(normalized, StringComparer.Ordinal) == false)
        {
            throw new InvalidOperationException($"Unsupported accounting sourceType: {sourceType}.");
        }

        return normalized;
    }

    private static string NormalizeRequired(string value, string field, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException($"{field} is required.");
        }

        var normalized = value.Trim();
        if (normalized.Length > maxLength)
        {
            throw new InvalidOperationException($"{field} cannot exceed {maxLength} characters.");
        }

        return normalized;
    }
}
