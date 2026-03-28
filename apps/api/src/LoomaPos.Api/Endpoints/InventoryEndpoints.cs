using LoomaPos.Api.Common;
using LoomaPos.Api.Commerce;
using LoomaPos.Domain.Inventory;
using LoomaPos.Infrastructure.MultiTenancy;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class InventoryEndpoints
{
    public static RouteGroupBuilder MapInventoryEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/stock", GetStockAsync)
            .WithName("GetStock")
            .WithSummary("Gets stock balances by branch.");

        group.MapPost("/stock/adjustments", CreateStockAdjustmentAsync)
            .WithName("CreateStockAdjustment")
            .WithSummary("Creates stock adjustment as immutable stock move.");

        return group;
    }

    private static async Task<IResult> GetStockAsync(
        Guid? branch_id,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var branchId = branch_id ?? tenantProvider.BranchId;
        if (!branchId.HasValue)
        {
            return Results.BadRequest(new { error = "branch_id is required." });
        }

        var branchName = await dbContext.Branches.AsNoTracking()
            .Where(x => x.Id == branchId.Value)
            .Select(x => x.Name)
            .FirstOrDefaultAsync(cancellationToken);

        var stockByProduct = await dbContext.StockBalances.AsNoTracking()
            .Where(x => x.BranchId == branchId.Value)
            .ToDictionaryAsync(x => x.ProductId, x => x.Qty, cancellationToken);

        var products = await dbContext.Products.AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.Name)
            .Select(product => new
            {
                product.Id,
                product.Name,
                product.Sku,
                product.Barcode,
                product.MinStock,
                product.StockTrackingEnabled
            })
            .ToListAsync(cancellationToken);

        var stockRows = products.Select(product =>
        {
            var qty = product.StockTrackingEnabled
                ? stockByProduct.GetValueOrDefault(product.Id, 0)
                : 0;
            var status = product.StockTrackingEnabled
                ? (qty <= product.MinStock ? "KRITIK" : "OK")
                : "IZLENMIYOR";

            return new StockBalanceResponse(
                product.Id,
                product.Name,
                product.Sku,
                product.Barcode,
                branchId.Value,
                branchName ?? "Sube",
                qty,
                product.MinStock,
                product.StockTrackingEnabled,
                status);
        }).ToList();

        return Results.Ok(stockRows);
    }

    private static async Task<IResult> CreateStockAdjustmentAsync(
        CreateStockAdjustmentRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId ?? request.TenantId;
        var branchId = request.BranchId ?? tenantProvider.BranchId;

        if (!tenantId.HasValue || !branchId.HasValue)
        {
            return Results.BadRequest(new { error = "tenant_id and branch_id are required." });
        }

        var lifecycleWriteBlock = await EnsureLifecycleWriteAllowedAsync(tenantId.Value, dbContext, cancellationToken);
        if (lifecycleWriteBlock is not null)
        {
            return lifecycleWriteBlock;
        }

        var product = await dbContext.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.ProductId, cancellationToken);
        if (product is null)
        {
            return Results.BadRequest(new { error = "product_id is invalid." });
        }

        if (!product.StockTrackingEnabled)
        {
            return Results.BadRequest(new { error = "Stock tracking is disabled for this product." });
        }

        var normalizedReason = string.IsNullOrWhiteSpace(request.Reason) ? "Stok duzeltme" : request.Reason.Trim();
        var stockMove = new StockMove
        {
            TenantId = tenantId.Value,
            BranchId = branchId.Value,
            ProductId = request.ProductId,
            QtyDelta = request.QtyDelta,
            Reason = normalizedReason,
            RefType = "STOCK_ADJUSTMENT",
            RefId = request.ReferenceId ?? Guid.NewGuid().ToString("N")
        };

        dbContext.StockMoves.Add(stockMove);
        await UpsertStockBalanceAsync(dbContext, tenantId.Value, branchId.Value, request.ProductId, request.QtyDelta, cancellationToken);

        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            tenantId.Value,
            "STOCK_ADJUSTMENT",
            "stock_moves",
            stockMove.Id.ToString(),
            request with { Reason = normalizedReason });

        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { stockMove.Id, eventType = "STOCK_ADJUSTMENT" });
    }

    private static async Task<IResult?> EnsureLifecycleWriteAllowedAsync(
        Guid tenantId,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenant = await dbContext.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken);
        var subscription = await dbContext.Subscriptions.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        var license = await dbContext.IssuedLicenses.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.IssuedAt)
            .FirstOrDefaultAsync(cancellationToken);

        var lifecycleState = SubscriptionLifecyclePolicy.ResolveState(tenant, subscription, license, DateTimeOffset.UtcNow);
        var lifecycle = SubscriptionLifecyclePolicy.Describe(lifecycleState);
        if (lifecycle.CanWrite)
        {
            return null;
        }

        return Results.Json(new
        {
            error = "subscription_state_blocked",
            lifecycleState = lifecycle.State,
            lifecycleLabel = lifecycle.Label,
            lifecycleMessage = lifecycle.Message,
            allowedActions = lifecycle.AllowedActions,
            blockedActions = lifecycle.BlockedActions,
            canCheckout = lifecycle.CanCheckout,
            canWrite = lifecycle.CanWrite,
            canSync = lifecycle.CanSync,
            canView = lifecycle.CanView,
            requiresUpgradeAction = lifecycle.RequiresUpgradeAction,
            requiresBlock = lifecycle.RequiresBlock
        }, statusCode: StatusCodes.Status403Forbidden);
    }

    private static async Task UpsertStockBalanceAsync(
        AppDbContext dbContext,
        Guid tenantId,
        Guid branchId,
        Guid productId,
        decimal qtyDelta,
        CancellationToken cancellationToken)
    {
        var stockBalance = await dbContext.StockBalances
            .FirstOrDefaultAsync(
                x => x.TenantId == tenantId && x.BranchId == branchId && x.ProductId == productId,
                cancellationToken);

        if (stockBalance is null)
        {
            dbContext.StockBalances.Add(new StockBalance
            {
                TenantId = tenantId,
                BranchId = branchId,
                ProductId = productId,
                Qty = qtyDelta
            });
            return;
        }

        stockBalance.Qty += qtyDelta;
    }

    public sealed record CreateStockAdjustmentRequest(
        Guid? TenantId,
        Guid? BranchId,
        Guid ProductId,
        decimal QtyDelta,
        string Reason,
        string? ReferenceId);

    public sealed record StockBalanceResponse(
        Guid ProductId,
        string ProductName,
        string? Sku,
        string? Barcode,
        Guid BranchId,
        string BranchName,
        decimal Qty,
        decimal MinStock,
        bool StockTrackingEnabled,
        string Status);
}
