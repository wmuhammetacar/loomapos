using System.Data;
using System.Text.Json;
using LoomaPos.Domain.Auditing;
using LoomaPos.Domain.Inventory;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Infrastructure.Inventory;

public interface IWarehouseTransferService
{
    Task<WarehouseTransfer> CreateDraftAsync(
        Guid tenantId,
        Guid fromWarehouseId,
        Guid toWarehouseId,
        CancellationToken cancellationToken);

    Task<WarehouseTransferLine> AddLineAsync(
        Guid tenantId,
        Guid transferId,
        Guid productId,
        decimal quantity,
        CancellationToken cancellationToken);

    Task<WarehouseTransfer> CompleteAsync(
        Guid tenantId,
        Guid transferId,
        Guid? branchId,
        CancellationToken cancellationToken);
}

public sealed class WarehouseTransferService(
    AppDbContext dbContext,
    IWarehouseCompatibilityService warehouseCompatibilityService) : IWarehouseTransferService
{
    public async Task<WarehouseTransfer> CreateDraftAsync(
        Guid tenantId,
        Guid fromWarehouseId,
        Guid toWarehouseId,
        CancellationToken cancellationToken)
    {
        if (fromWarehouseId == toWarehouseId)
        {
            throw new InvalidOperationException("fromWarehouseId and toWarehouseId must be different.");
        }

        await warehouseCompatibilityService.ResolveWarehouseAsync(tenantId, fromWarehouseId, cancellationToken);
        await warehouseCompatibilityService.ResolveWarehouseAsync(tenantId, toWarehouseId, cancellationToken);

        var transfer = new WarehouseTransfer
        {
            TenantId = tenantId,
            FromWarehouseId = fromWarehouseId,
            ToWarehouseId = toWarehouseId,
            Status = WarehouseTransferStatuses.Draft,
            CreatedAt = DateTimeOffset.UtcNow
        };

        dbContext.Add(transfer);
        dbContext.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId,
            Action = WarehouseEventTypes.WarehouseTransferCreated,
            Entity = "warehouse_transfers",
            EntityId = transfer.Id.ToString(),
            PayloadJson = JsonSerializer.Serialize(new
            {
                transfer.Id,
                transfer.FromWarehouseId,
                transfer.ToWarehouseId,
                transfer.Status,
                transfer.CreatedAt
            })
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return transfer;
    }

    public async Task<WarehouseTransferLine> AddLineAsync(
        Guid tenantId,
        Guid transferId,
        Guid productId,
        decimal quantity,
        CancellationToken cancellationToken)
    {
        if (quantity <= 0)
        {
            throw new InvalidOperationException("quantity must be greater than zero.");
        }

        var transfer = await dbContext.Set<WarehouseTransfer>()
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.Id == transferId && x.TenantId == tenantId,
                cancellationToken);

        if (transfer is null)
        {
            throw new InvalidOperationException("transfer not found.");
        }

        if (transfer.Status is WarehouseTransferStatuses.Completed or WarehouseTransferStatuses.Canceled)
        {
            throw new InvalidOperationException("only open transfer can accept lines.");
        }

        var productExists = await dbContext.Products
            .AsNoTracking()
            .AnyAsync(x => x.Id == productId && x.TenantId == tenantId, cancellationToken);
        if (productExists == false)
        {
            throw new InvalidOperationException("product not found for tenant.");
        }

        var existingLine = await dbContext.Set<WarehouseTransferLine>()
            .FirstOrDefaultAsync(
                x => x.TransferId == transferId && x.ProductId == productId,
                cancellationToken);

        if (existingLine is not null)
        {
            existingLine.Quantity += quantity;
            await dbContext.SaveChangesAsync(cancellationToken);
            return existingLine;
        }

        var line = new WarehouseTransferLine
        {
            TransferId = transferId,
            ProductId = productId,
            Quantity = quantity
        };

        dbContext.Add(line);
        await dbContext.SaveChangesAsync(cancellationToken);
        return line;
    }

    public async Task<WarehouseTransfer> CompleteAsync(
        Guid tenantId,
        Guid transferId,
        Guid? branchId,
        CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        var transfer = await dbContext.Set<WarehouseTransfer>()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(
                x => x.Id == transferId && x.TenantId == tenantId,
                cancellationToken);

        if (transfer is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new InvalidOperationException("transfer not found.");
        }

        if (transfer.Status is WarehouseTransferStatuses.Completed or WarehouseTransferStatuses.Canceled)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new InvalidOperationException("transfer cannot be completed in current status.");
        }

        if (transfer.FromWarehouseId == transfer.ToWarehouseId)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new InvalidOperationException("source and destination warehouse must be different.");
        }

        if (transfer.Lines.Count == 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new InvalidOperationException("transfer must include at least one line.");
        }

        await warehouseCompatibilityService.ResolveWarehouseAsync(tenantId, transfer.FromWarehouseId, cancellationToken);
        await warehouseCompatibilityService.ResolveWarehouseAsync(tenantId, transfer.ToWarehouseId, cancellationToken);

        var requestByProduct = transfer.Lines
            .GroupBy(x => x.ProductId)
            .ToDictionary(x => x.Key, x => x.Sum(v => v.Quantity));

        var sourceStock = await dbContext.StockByWarehouses
            .Where(x =>
                x.TenantId == tenantId &&
                x.WarehouseId == transfer.FromWarehouseId &&
                requestByProduct.Keys.Contains(x.ProductId))
            .ToDictionaryAsync(x => x.ProductId, x => x.Quantity, cancellationToken);

        foreach (var (productId, requestedQty) in requestByProduct)
        {
            var available = sourceStock.GetValueOrDefault(productId, 0);
            if (requestedQty > available)
            {
                await transaction.RollbackAsync(cancellationToken);
                throw new InvalidOperationException($"insufficient stock for product {productId}. requested={requestedQty}, available={available}");
            }
        }

        var moveBranchId = branchId ?? await ResolveFallbackBranchIdAsync(tenantId, cancellationToken);

        foreach (var line in transfer.Lines)
        {
            await warehouseCompatibilityService.ApplyWarehouseDeltaAsync(
                tenantId,
                line.ProductId,
                -line.Quantity,
                transfer.FromWarehouseId,
                cancellationToken);

            await warehouseCompatibilityService.ApplyWarehouseDeltaAsync(
                tenantId,
                line.ProductId,
                line.Quantity,
                transfer.ToWarehouseId,
                cancellationToken);

            dbContext.StockMoves.Add(new StockMove
            {
                TenantId = tenantId,
                BranchId = moveBranchId,
                ProductId = line.ProductId,
                WarehouseId = transfer.FromWarehouseId,
                QtyDelta = -line.Quantity,
                Reason = "WAREHOUSE_TRANSFER_OUT",
                RefType = "warehouse_transfer",
                RefId = transfer.Id.ToString()
            });

            dbContext.StockMoves.Add(new StockMove
            {
                TenantId = tenantId,
                BranchId = moveBranchId,
                ProductId = line.ProductId,
                WarehouseId = transfer.ToWarehouseId,
                QtyDelta = line.Quantity,
                Reason = "WAREHOUSE_TRANSFER_IN",
                RefType = "warehouse_transfer",
                RefId = transfer.Id.ToString()
            });
        }

        transfer.Status = WarehouseTransferStatuses.Completed;
        transfer.CompletedAt = DateTimeOffset.UtcNow;

        dbContext.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId,
            Action = WarehouseEventTypes.WarehouseTransferCompleted,
            Entity = "warehouse_transfers",
            EntityId = transfer.Id.ToString(),
            PayloadJson = JsonSerializer.Serialize(new
            {
                transfer.Id,
                transfer.FromWarehouseId,
                transfer.ToWarehouseId,
                transfer.Status,
                transfer.CompletedAt,
                lineCount = transfer.Lines.Count
            })
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return transfer;
    }

    private async Task<Guid> ResolveFallbackBranchIdAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var branchId = await dbContext.Branches.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderBy(x => x.CreatedAt)
            .Select(x => x.Id)
            .FirstOrDefaultAsync(cancellationToken);

        return branchId == Guid.Empty ? Guid.Empty : branchId;
    }
}
