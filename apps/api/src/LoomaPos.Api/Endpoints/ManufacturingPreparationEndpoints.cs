using LoomaPos.Api.Commerce;
using LoomaPos.Domain.Manufacturing;
using LoomaPos.Infrastructure.Manufacturing;
using LoomaPos.Infrastructure.MultiTenancy;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class ManufacturingPreparationEndpoints
{
    public static RouteGroupBuilder MapManufacturingPreparationEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/manufacturing/boms", ListBomsAsync)
            .WithName("ListManufacturingBoms")
            .WithSummary("Lists manufacturing BOM definitions.");

        group.MapPost("/manufacturing/boms", CreateBomAsync)
            .WithName("CreateManufacturingBom")
            .WithSummary("Creates BOM recipe definition.");

        group.MapPut("/manufacturing/boms/{bomId:guid}/lines", ReplaceBomLinesAsync)
            .WithName("ReplaceManufacturingBomLines")
            .WithSummary("Replaces BOM component lines.");

        group.MapPost("/manufacturing/boms/{bomId:guid}/activate", ActivateBomAsync)
            .WithName("ActivateManufacturingBom")
            .WithSummary("Activates BOM version for finished product.");

        group.MapPost("/manufacturing/boms/{bomId:guid}/deactivate", DeactivateBomAsync)
            .WithName("DeactivateManufacturingBom")
            .WithSummary("Deactivates BOM version.");

        group.MapGet("/manufacturing/boms/{bomId:guid}/cost-summary", GetBomCostSummaryAsync)
            .WithName("GetManufacturingBomCostSummary")
            .WithSummary("Gets theoretical material cost summary for BOM.");

        group.MapGet("/manufacturing/production-orders", ListProductionOrdersAsync)
            .WithName("ListProductionOrders")
            .WithSummary("Lists placeholder production orders.");

        group.MapPost("/manufacturing/production-orders", CreateProductionOrderAsync)
            .WithName("CreateProductionOrder")
            .WithSummary("Creates production order planning placeholder.");

        group.MapPost("/manufacturing/production-orders/{productionOrderId:guid}/cancel", CancelProductionOrderAsync)
            .WithName("CancelProductionOrder")
            .WithSummary("Cancels production order placeholder.");

        return group;
    }

    private static async Task<IResult> ListBomsAsync(
        Guid? productId,
        bool? isActive,
        int? take,
        ITenantProvider tenantProvider,
        IManufacturingPreparationService manufacturingPreparationService,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var rows = await manufacturingPreparationService.ListBomsAsync(
            tenantId.Value,
            productId,
            isActive,
            take ?? 200,
            cancellationToken);

        return Results.Ok(rows.Select(MapBomResponse).ToList());
    }

    private static async Task<IResult> CreateBomAsync(
        CreateManufacturingBomRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        IManufacturingPreparationService manufacturingPreparationService,
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
            var bom = await manufacturingPreparationService.CreateBomAsync(
                tenantId.Value,
                request.ProductId,
                request.Code,
                request.Version,
                request.Activate,
                request.Lines.Select(x => new ManufacturingBomLineInput(x.ComponentProductId, x.Quantity)).ToList(),
                cancellationToken);

            return Results.Ok(MapBomResponse(bom));
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> ReplaceBomLinesAsync(
        Guid bomId,
        ReplaceManufacturingBomLinesRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        IManufacturingPreparationService manufacturingPreparationService,
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
            var bom = await manufacturingPreparationService.ReplaceBomLinesAsync(
                tenantId.Value,
                bomId,
                request.Lines.Select(x => new ManufacturingBomLineInput(x.ComponentProductId, x.Quantity)).ToList(),
                cancellationToken);

            return Results.Ok(MapBomResponse(bom));
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> ActivateBomAsync(
        Guid bomId,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        IManufacturingPreparationService manufacturingPreparationService,
        CancellationToken cancellationToken)
    {
        return await SetBomActivationAsync(
            bomId,
            isActive: true,
            tenantProvider,
            dbContext,
            manufacturingPreparationService,
            cancellationToken);
    }

    private static async Task<IResult> DeactivateBomAsync(
        Guid bomId,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        IManufacturingPreparationService manufacturingPreparationService,
        CancellationToken cancellationToken)
    {
        return await SetBomActivationAsync(
            bomId,
            isActive: false,
            tenantProvider,
            dbContext,
            manufacturingPreparationService,
            cancellationToken);
    }

    private static async Task<IResult> SetBomActivationAsync(
        Guid bomId,
        bool isActive,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        IManufacturingPreparationService manufacturingPreparationService,
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
            var bom = await manufacturingPreparationService.SetBomActivationAsync(
                tenantId.Value,
                bomId,
                isActive,
                cancellationToken);

            return Results.Ok(MapBomResponse(bom));
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> GetBomCostSummaryAsync(
        Guid bomId,
        ITenantProvider tenantProvider,
        IManufacturingPreparationService manufacturingPreparationService,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        try
        {
            var summary = await manufacturingPreparationService.GetBomCostSummaryAsync(
                tenantId.Value,
                bomId,
                cancellationToken);

            return Results.Ok(summary);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> ListProductionOrdersAsync(
        string? status,
        int? take,
        ITenantProvider tenantProvider,
        IManufacturingPreparationService manufacturingPreparationService,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var rows = await manufacturingPreparationService.ListProductionOrdersAsync(
            tenantId.Value,
            status,
            take ?? 200,
            cancellationToken);

        return Results.Ok(rows.Select(MapProductionOrderResponse).ToList());
    }

    private static async Task<IResult> CreateProductionOrderAsync(
        CreateProductionOrderRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        IManufacturingPreparationService manufacturingPreparationService,
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
            var order = await manufacturingPreparationService.CreateProductionOrderAsync(
                tenantId.Value,
                request.BomId,
                request.FinishedProductId,
                request.PlannedQuantity,
                request.Status,
                cancellationToken);

            return Results.Ok(MapProductionOrderResponse(order));
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> CancelProductionOrderAsync(
        Guid productionOrderId,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        IManufacturingPreparationService manufacturingPreparationService,
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
            var order = await manufacturingPreparationService.CancelProductionOrderAsync(
                tenantId.Value,
                productionOrderId,
                cancellationToken);

            return Results.Ok(MapProductionOrderResponse(order));
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static BomResponse MapBomResponse(BillOfMaterials bom)
    {
        return new BomResponse(
            bom.Id,
            bom.ProductId,
            bom.Code,
            bom.Version,
            bom.IsActive,
            bom.CreatedAt,
            bom.Lines.Select(line => new BomLineResponse(line.Id, line.ComponentProductId, line.Quantity)).ToList());
    }

    private static ProductionOrderResponse MapProductionOrderResponse(ProductionOrder order)
    {
        return new ProductionOrderResponse(
            order.Id,
            order.BomId,
            order.FinishedProductId,
            order.PlannedQuantity,
            order.Status,
            order.CreatedAt);
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

    public sealed record CreateManufacturingBomRequest(
        Guid ProductId,
        string? Code,
        int Version,
        bool Activate,
        IReadOnlyList<CreateManufacturingBomLineRequest> Lines);

    public sealed record CreateManufacturingBomLineRequest(Guid ComponentProductId, decimal Quantity);

    public sealed record ReplaceManufacturingBomLinesRequest(
        IReadOnlyList<CreateManufacturingBomLineRequest> Lines);

    public sealed record CreateProductionOrderRequest(
        Guid? BomId,
        Guid FinishedProductId,
        decimal PlannedQuantity,
        string? Status);

    public sealed record BomResponse(
        Guid Id,
        Guid ProductId,
        string? Code,
        int Version,
        bool IsActive,
        DateTimeOffset CreatedAt,
        IReadOnlyList<BomLineResponse> Lines);

    public sealed record BomLineResponse(Guid Id, Guid ComponentProductId, decimal Quantity);

    public sealed record ProductionOrderResponse(
        Guid Id,
        Guid? BomId,
        Guid FinishedProductId,
        decimal PlannedQuantity,
        string Status,
        DateTimeOffset CreatedAt);
}
