using LoomaPos.Domain.Auditing;
using LoomaPos.Domain.Inventory;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Infrastructure.Inventory;

public interface IWarehouseCompatibilityService
{
    Task<Guid> EnsureDefaultWarehouseAsync(Guid tenantId, CancellationToken cancellationToken);

    Task<Guid> ResolveWarehouseAsync(Guid tenantId, Guid? warehouseId, CancellationToken cancellationToken);

    Task ApplyWarehouseDeltaAsync(
        Guid tenantId,
        Guid productId,
        decimal qtyDelta,
        Guid? warehouseId,
        CancellationToken cancellationToken);

    Task SetWarehouseQuantityAsync(
        Guid tenantId,
        Guid productId,
        decimal quantity,
        Guid? warehouseId,
        CancellationToken cancellationToken);

    Task<decimal> GetGlobalQuantityAsync(Guid tenantId, Guid productId, CancellationToken cancellationToken);
}

public sealed class WarehouseCompatibilityService(AppDbContext dbContext) : IWarehouseCompatibilityService
{
    private const string DefaultWarehouseName = "DEFAULT";
    private const string DefaultWarehouseType = "main";

    public async Task<Guid> EnsureDefaultWarehouseAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var localDefaultWarehouse = dbContext.Warehouses.Local
            .FirstOrDefault(x => x.TenantId == tenantId && x.Name == DefaultWarehouseName);

        var existingWarehouse = localDefaultWarehouse ?? await dbContext.Warehouses
            .FirstOrDefaultAsync(
                x => x.TenantId == tenantId && x.Name == DefaultWarehouseName,
                cancellationToken);

        if (existingWarehouse is not null)
        {
            if (existingWarehouse.IsActive == false)
            {
                existingWarehouse.IsActive = true;
            }

            return existingWarehouse.Id;
        }

        var warehouse = new Warehouse
        {
            TenantId = tenantId,
            Name = DefaultWarehouseName,
            Type = DefaultWarehouseType,
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow
        };

        dbContext.Warehouses.Add(warehouse);
        dbContext.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId,
            Action = WarehouseEventTypes.WarehouseCreated,
            Entity = "warehouses",
            EntityId = warehouse.Id.ToString(),
            PayloadJson = "{\"name\":\"DEFAULT\",\"type\":\"main\"}"
        });
        return warehouse.Id;
    }

    public async Task<Guid> ResolveWarehouseAsync(Guid tenantId, Guid? warehouseId, CancellationToken cancellationToken)
    {
        if (!warehouseId.HasValue)
        {
            return await EnsureDefaultWarehouseAsync(tenantId, cancellationToken);
        }

        var localWarehouse = dbContext.Warehouses.Local
            .FirstOrDefault(x => x.Id == warehouseId.Value && x.TenantId == tenantId);

        var warehouse = localWarehouse ?? await dbContext.Warehouses
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.Id == warehouseId.Value && x.TenantId == tenantId,
                cancellationToken);

        if (warehouse is null)
        {
            throw new InvalidOperationException("warehouse_id is invalid.");
        }

        if (warehouse.IsActive == false)
        {
            throw new InvalidOperationException("warehouse is inactive.");
        }

        return warehouse.Id;
    }

    public async Task ApplyWarehouseDeltaAsync(
        Guid tenantId,
        Guid productId,
        decimal qtyDelta,
        Guid? warehouseId,
        CancellationToken cancellationToken)
    {
        var resolvedWarehouseId = await ResolveWarehouseAsync(tenantId, warehouseId, cancellationToken);

        var stockByWarehouse = await dbContext.StockByWarehouses
            .FirstOrDefaultAsync(
                x => x.TenantId == tenantId &&
                    x.ProductId == productId &&
                    x.WarehouseId == resolvedWarehouseId,
                cancellationToken);

        if (stockByWarehouse is null)
        {
            dbContext.StockByWarehouses.Add(new StockByWarehouse
            {
                TenantId = tenantId,
                ProductId = productId,
                WarehouseId = resolvedWarehouseId,
                Quantity = qtyDelta,
                UpdatedAt = DateTimeOffset.UtcNow
            });

            return;
        }

        stockByWarehouse.Quantity += qtyDelta;
        stockByWarehouse.UpdatedAt = DateTimeOffset.UtcNow;
    }

    public async Task SetWarehouseQuantityAsync(
        Guid tenantId,
        Guid productId,
        decimal quantity,
        Guid? warehouseId,
        CancellationToken cancellationToken)
    {
        var resolvedWarehouseId = await ResolveWarehouseAsync(tenantId, warehouseId, cancellationToken);

        var stockByWarehouse = await dbContext.StockByWarehouses
            .FirstOrDefaultAsync(
                x => x.TenantId == tenantId &&
                    x.ProductId == productId &&
                    x.WarehouseId == resolvedWarehouseId,
                cancellationToken);

        if (stockByWarehouse is null)
        {
            dbContext.StockByWarehouses.Add(new StockByWarehouse
            {
                TenantId = tenantId,
                ProductId = productId,
                WarehouseId = resolvedWarehouseId,
                Quantity = quantity,
                UpdatedAt = DateTimeOffset.UtcNow
            });

            return;
        }

        stockByWarehouse.Quantity = quantity;
        stockByWarehouse.UpdatedAt = DateTimeOffset.UtcNow;
    }

    public async Task<decimal> GetGlobalQuantityAsync(Guid tenantId, Guid productId, CancellationToken cancellationToken)
    {
        var total = await dbContext.StockByWarehouses
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.ProductId == productId)
            .Select(x => (decimal?)x.Quantity)
            .SumAsync(cancellationToken);

        return total ?? 0;
    }
}
