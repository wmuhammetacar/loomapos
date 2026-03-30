using LoomaPos.Domain.Accounting;
using LoomaPos.Infrastructure.Accounting;
using LoomaPos.Infrastructure.MultiTenancy;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class AccountingBridgeEndpoints
{
    public static RouteGroupBuilder MapAccountingBridgeEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/accounting/export-items", ListExportItemsAsync)
            .WithName("ListAccountingExportItems")
            .WithSummary("Lists accounting bridge export-ready items.");

        group.MapGet("/accounting/export-items/{id:guid}", GetExportItemDetailAsync)
            .WithName("GetAccountingExportItem")
            .WithSummary("Gets accounting export item detail.");

        group.MapPost("/accounting/export-items/{id:guid}/mark-exported", MarkExportedAsync)
            .WithName("MarkAccountingExportItemExported")
            .WithSummary("Marks accounting export item as exported.");

        group.MapPost("/accounting/export-items/{id:guid}/mark-failed", MarkFailedAsync)
            .WithName("MarkAccountingExportItemFailed")
            .WithSummary("Marks accounting export item as failed or retry-ready pending.");

        return group;
    }

    private static async Task<IResult> ListExportItemsAsync(
        string? status,
        string? sourceType,
        int? take,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var safeTake = take is null or <= 0 ? 200 : Math.Min(take.Value, 1000);

        var query = dbContext.AccountingExportItems
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId.Value)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToLowerInvariant();
            query = query.Where(x => x.Status == normalizedStatus);
        }

        if (!string.IsNullOrWhiteSpace(sourceType))
        {
            var normalizedSourceType = sourceType.Trim().ToLowerInvariant();
            query = query.Where(x => x.SourceType == normalizedSourceType);
        }

        var rows = await query
            .OrderByDescending(x => x.CreatedAt)
            .Take(safeTake)
            .Select(x => new AccountingExportItemListResponse(
                x.Id,
                x.SourceType,
                x.SourceId,
                x.EventCode,
                x.Status,
                x.CreatedAt,
                x.ExportedAt,
                x.FailureReason))
            .ToListAsync(cancellationToken);

        return Results.Ok(rows);
    }

    private static async Task<IResult> GetExportItemDetailAsync(
        Guid id,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var item = await dbContext.AccountingExportItems
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId.Value && x.Id == id)
            .Select(x => new AccountingExportItemDetailResponse(
                x.Id,
                x.TenantId,
                x.SourceType,
                x.SourceId,
                x.EventCode,
                x.PayloadJson,
                x.Status,
                x.CreatedAt,
                x.ExportedAt,
                x.FailureReason))
            .FirstOrDefaultAsync(cancellationToken);

        return item is null ? Results.NotFound() : Results.Ok(item);
    }

    private static async Task<IResult> MarkExportedAsync(
        Guid id,
        MarkAccountingExportedRequest request,
        ITenantProvider tenantProvider,
        IAccountingBridgeService accountingBridgeService,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var updated = await accountingBridgeService.MarkExportedAsync(
            tenantId.Value,
            id,
            request.ExportedAt,
            cancellationToken);

        return updated
            ? Results.Ok(new { id, status = AccountingBridgeStatuses.Exported, exportedAt = request.ExportedAt ?? DateTimeOffset.UtcNow })
            : Results.NotFound();
    }

    private static async Task<IResult> MarkFailedAsync(
        Guid id,
        MarkAccountingFailedRequest request,
        ITenantProvider tenantProvider,
        IAccountingBridgeService accountingBridgeService,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        if (!request.RetryReady && string.IsNullOrWhiteSpace(request.FailureReason))
        {
            return Results.BadRequest(new { error = "failureReason is required when retryReady=false." });
        }

        var updated = await accountingBridgeService.MarkFailedAsync(
            tenantId.Value,
            id,
            request.FailureReason ?? string.Empty,
            request.RetryReady,
            cancellationToken);

        if (!updated)
        {
            return Results.NotFound();
        }

        return Results.Ok(new
        {
            id,
            status = request.RetryReady ? AccountingBridgeStatuses.Pending : AccountingBridgeStatuses.Failed,
            failureReason = request.RetryReady ? null : request.FailureReason
        });
    }

    public sealed record AccountingExportItemListResponse(
        Guid Id,
        string SourceType,
        string SourceId,
        string EventCode,
        string Status,
        DateTimeOffset CreatedAt,
        DateTimeOffset? ExportedAt,
        string? FailureReason);

    public sealed record AccountingExportItemDetailResponse(
        Guid Id,
        Guid TenantId,
        string SourceType,
        string SourceId,
        string EventCode,
        string PayloadJson,
        string Status,
        DateTimeOffset CreatedAt,
        DateTimeOffset? ExportedAt,
        string? FailureReason);

    public sealed record MarkAccountingExportedRequest(DateTimeOffset? ExportedAt);

    public sealed record MarkAccountingFailedRequest(string? FailureReason, bool RetryReady = false);
}
