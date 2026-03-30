using LoomaPos.Api.Common;
using LoomaPos.Api.Commerce;
using LoomaPos.Domain.Inventory;
using LoomaPos.Domain.Purchasing;
using LoomaPos.Infrastructure.Inventory;
using LoomaPos.Infrastructure.MultiTenancy;
using LoomaPos.Infrastructure.Persistence;
using LoomaPos.Infrastructure.Purchasing;
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

        group.MapPost("/warehouse-transfers", CreateWarehouseTransferAsync)
            .WithName("CreateWarehouseTransfer")
            .WithSummary("Creates a warehouse transfer draft.");

        group.MapPost("/warehouse-transfers/{transferId:guid}/lines", AddWarehouseTransferLineAsync)
            .WithName("AddWarehouseTransferLine")
            .WithSummary("Adds a product line into warehouse transfer draft.");

        group.MapPost("/warehouse-transfers/{transferId:guid}/complete", CompleteWarehouseTransferAsync)
            .WithName("CompleteWarehouseTransfer")
            .WithSummary("Completes warehouse transfer atomically.");

        group.MapPost("/suppliers", CreateSupplierAsync)
            .WithName("CreateSupplier")
            .WithSummary("Creates supplier for purchasing domain.");

        group.MapPost("/purchase-orders", CreatePurchaseOrderAsync)
            .WithName("CreatePurchaseOrder")
            .WithSummary("Creates purchase order draft.");

        group.MapPost("/purchase-orders/{purchaseOrderId:guid}/lines", AddPurchaseOrderLineAsync)
            .WithName("AddPurchaseOrderLine")
            .WithSummary("Adds line to purchase order.");

        group.MapPost("/purchase-orders/{purchaseOrderId:guid}/receive", ReceivePurchaseOrderAsync)
            .WithName("ReceivePurchaseOrder")
            .WithSummary("Receives purchase order and increases warehouse stock.");

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
        IWarehouseCompatibilityService warehouseCompatibilityService,
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

        Guid resolvedWarehouseId;
        try
        {
            resolvedWarehouseId = await warehouseCompatibilityService.ResolveWarehouseAsync(
                tenantId.Value,
                request.WarehouseId,
                cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }

        var normalizedReason = string.IsNullOrWhiteSpace(request.Reason) ? "Stok duzeltme" : request.Reason.Trim();
        var stockMove = new StockMove
        {
            TenantId = tenantId.Value,
            BranchId = branchId.Value,
            ProductId = request.ProductId,
            WarehouseId = resolvedWarehouseId,
            QtyDelta = request.QtyDelta,
            Reason = normalizedReason,
            RefType = "STOCK_ADJUSTMENT",
            RefId = request.ReferenceId ?? Guid.NewGuid().ToString("N")
        };

        dbContext.StockMoves.Add(stockMove);
        await UpsertStockBalanceAsync(dbContext, tenantId.Value, branchId.Value, request.ProductId, request.QtyDelta, cancellationToken);
        await warehouseCompatibilityService.ApplyWarehouseDeltaAsync(
            tenantId.Value,
            request.ProductId,
            request.QtyDelta,
            resolvedWarehouseId,
            cancellationToken);

        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            tenantId.Value,
            WarehouseEventTypes.StockAdjusted,
            "stock_moves",
            stockMove.Id.ToString(),
            request with { Reason = normalizedReason, WarehouseId = resolvedWarehouseId });

        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { stockMove.Id, eventType = WarehouseEventTypes.StockAdjusted, warehouseId = resolvedWarehouseId });
    }

    private static async Task<IResult> CreateWarehouseTransferAsync(
        CreateWarehouseTransferRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        IWarehouseTransferService warehouseTransferService,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var lifecycleWriteBlock = await EnsureLifecycleWriteAllowedAsync(tenantId.Value, dbContext, cancellationToken);
        if (lifecycleWriteBlock is not null)
        {
            return lifecycleWriteBlock;
        }

        try
        {
            var transfer = await warehouseTransferService.CreateDraftAsync(
                tenantId.Value,
                request.FromWarehouseId,
                request.ToWarehouseId,
                cancellationToken);

            return Results.Ok(MapWarehouseTransfer(transfer));
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> AddWarehouseTransferLineAsync(
        Guid transferId,
        AddWarehouseTransferLineRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        IWarehouseTransferService warehouseTransferService,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var lifecycleWriteBlock = await EnsureLifecycleWriteAllowedAsync(tenantId.Value, dbContext, cancellationToken);
        if (lifecycleWriteBlock is not null)
        {
            return lifecycleWriteBlock;
        }

        try
        {
            var line = await warehouseTransferService.AddLineAsync(
                tenantId.Value,
                transferId,
                request.ProductId,
                request.Quantity,
                cancellationToken);

            return Results.Ok(new WarehouseTransferLineResponse(
                line.Id,
                line.TransferId,
                line.ProductId,
                line.Quantity));
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> CompleteWarehouseTransferAsync(
        Guid transferId,
        CompleteWarehouseTransferRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        IWarehouseTransferService warehouseTransferService,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var lifecycleWriteBlock = await EnsureLifecycleWriteAllowedAsync(tenantId.Value, dbContext, cancellationToken);
        if (lifecycleWriteBlock is not null)
        {
            return lifecycleWriteBlock;
        }

        try
        {
            var transfer = await warehouseTransferService.CompleteAsync(
                tenantId.Value,
                transferId,
                request.BranchId ?? tenantProvider.BranchId,
                cancellationToken);

            return Results.Ok(MapWarehouseTransfer(transfer));
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> CreateSupplierAsync(
        CreateSupplierRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        IPurchasingService purchasingService,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var lifecycleWriteBlock = await EnsureLifecycleWriteAllowedAsync(tenantId.Value, dbContext, cancellationToken);
        if (lifecycleWriteBlock is not null)
        {
            return lifecycleWriteBlock;
        }

        try
        {
            var supplier = await purchasingService.CreateSupplierAsync(
                tenantId.Value,
                request.Name,
                request.TaxNumber,
                request.Phone,
                request.Email,
                cancellationToken);

            return Results.Ok(new SupplierResponse(
                supplier.Id,
                supplier.TenantId,
                supplier.Name,
                supplier.TaxNumber,
                supplier.Phone,
                supplier.Email,
                supplier.IsActive,
                supplier.CreatedAt));
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> CreatePurchaseOrderAsync(
        CreatePurchaseOrderRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        IPurchasingService purchasingService,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var lifecycleWriteBlock = await EnsureLifecycleWriteAllowedAsync(tenantId.Value, dbContext, cancellationToken);
        if (lifecycleWriteBlock is not null)
        {
            return lifecycleWriteBlock;
        }

        try
        {
            var purchaseOrder = await purchasingService.CreatePurchaseOrderDraftAsync(
                tenantId.Value,
                request.SupplierId,
                request.WarehouseId,
                cancellationToken);

            return Results.Ok(MapPurchaseOrder(purchaseOrder));
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> AddPurchaseOrderLineAsync(
        Guid purchaseOrderId,
        AddPurchaseOrderLineRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        IPurchasingService purchasingService,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var lifecycleWriteBlock = await EnsureLifecycleWriteAllowedAsync(tenantId.Value, dbContext, cancellationToken);
        if (lifecycleWriteBlock is not null)
        {
            return lifecycleWriteBlock;
        }

        try
        {
            var line = await purchasingService.AddPurchaseOrderLineAsync(
                tenantId.Value,
                purchaseOrderId,
                request.ProductId,
                request.Quantity,
                request.UnitCost,
                cancellationToken);

            return Results.Ok(new PurchaseOrderLineItemResponse(
                line.Id,
                line.PurchaseOrderId,
                line.ProductId,
                line.Quantity,
                line.UnitCost));
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> ReceivePurchaseOrderAsync(
        Guid purchaseOrderId,
        ReceivePurchaseOrderRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        IPurchasingService purchasingService,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var lifecycleWriteBlock = await EnsureLifecycleWriteAllowedAsync(tenantId.Value, dbContext, cancellationToken);
        if (lifecycleWriteBlock is not null)
        {
            return lifecycleWriteBlock;
        }

        try
        {
            var purchaseOrder = await purchasingService.ReceivePurchaseOrderAsync(
                tenantId.Value,
                purchaseOrderId,
                request.BranchId ?? tenantProvider.BranchId,
                cancellationToken);

            return Results.Ok(MapPurchaseOrder(purchaseOrder));
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static WarehouseTransferResponse MapWarehouseTransfer(WarehouseTransfer transfer)
    {
        var lines = transfer.Lines
            .OrderBy(x => x.ProductId)
            .Select(x => new WarehouseTransferLineResponse(x.Id, x.TransferId, x.ProductId, x.Quantity))
            .ToList();

        return new WarehouseTransferResponse(
            transfer.Id,
            transfer.TenantId,
            transfer.FromWarehouseId,
            transfer.ToWarehouseId,
            transfer.Status,
            transfer.CreatedAt,
            transfer.CompletedAt,
            lines);
    }

    private static PurchaseOrderResponse MapPurchaseOrder(PurchaseOrder purchaseOrder)
    {
        var lines = purchaseOrder.Lines
            .OrderBy(x => x.ProductId)
            .Select(x => new PurchaseOrderLineItemResponse(
                x.Id,
                x.PurchaseOrderId,
                x.ProductId,
                x.Quantity,
                x.UnitCost))
            .ToList();

        return new PurchaseOrderResponse(
            purchaseOrder.Id,
            purchaseOrder.TenantId,
            purchaseOrder.SupplierId,
            purchaseOrder.WarehouseId,
            purchaseOrder.Status,
            purchaseOrder.CreatedAt,
            purchaseOrder.ReceivedAt,
            lines);
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
        string? ReferenceId,
        Guid? WarehouseId = null);

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

    public sealed record CreateWarehouseTransferRequest(
        Guid FromWarehouseId,
        Guid ToWarehouseId);

    public sealed record AddWarehouseTransferLineRequest(
        Guid ProductId,
        decimal Quantity);

    public sealed record CompleteWarehouseTransferRequest(
        Guid? BranchId = null);

    public sealed record WarehouseTransferLineResponse(
        Guid Id,
        Guid TransferId,
        Guid ProductId,
        decimal Quantity);

    public sealed record WarehouseTransferResponse(
        Guid Id,
        Guid TenantId,
        Guid FromWarehouseId,
        Guid ToWarehouseId,
        string Status,
        DateTimeOffset CreatedAt,
        DateTimeOffset? CompletedAt,
        IReadOnlyList<WarehouseTransferLineResponse> Lines);

    public sealed record CreateSupplierRequest(
        string Name,
        string? TaxNumber,
        string? Phone,
        string? Email);

    public sealed record SupplierResponse(
        Guid Id,
        Guid TenantId,
        string Name,
        string? TaxNumber,
        string? Phone,
        string? Email,
        bool IsActive,
        DateTimeOffset CreatedAt);

    public sealed record CreatePurchaseOrderRequest(
        Guid SupplierId,
        Guid WarehouseId);

    public sealed record AddPurchaseOrderLineRequest(
        Guid ProductId,
        decimal Quantity,
        decimal UnitCost);

    public sealed record ReceivePurchaseOrderRequest(
        Guid? BranchId = null);

    public sealed record PurchaseOrderLineItemResponse(
        Guid Id,
        Guid PurchaseOrderId,
        Guid ProductId,
        decimal Quantity,
        decimal UnitCost);

    public sealed record PurchaseOrderResponse(
        Guid Id,
        Guid TenantId,
        Guid SupplierId,
        Guid WarehouseId,
        string Status,
        DateTimeOffset CreatedAt,
        DateTimeOffset? ReceivedAt,
        IReadOnlyList<PurchaseOrderLineItemResponse> Lines);
}
