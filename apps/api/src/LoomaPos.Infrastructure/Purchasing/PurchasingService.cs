using System.Data;
using System.Text.Json;
using LoomaPos.Domain.Auditing;
using LoomaPos.Domain.Inventory;
using LoomaPos.Domain.Purchasing;
using LoomaPos.Domain.Accounting;
using LoomaPos.Infrastructure.Inventory;
using LoomaPos.Infrastructure.Accounting;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Infrastructure.Purchasing;

public interface IPurchasingService
{
    Task<Supplier> CreateSupplierAsync(
        Guid tenantId,
        string name,
        string? taxNumber,
        string? phone,
        string? email,
        CancellationToken cancellationToken);

    Task<PurchaseOrder> CreatePurchaseOrderDraftAsync(
        Guid tenantId,
        Guid supplierId,
        Guid warehouseId,
        CancellationToken cancellationToken);

    Task<PurchaseOrderLine> AddPurchaseOrderLineAsync(
        Guid tenantId,
        Guid purchaseOrderId,
        Guid productId,
        decimal quantity,
        decimal unitCost,
        CancellationToken cancellationToken);

    Task<PurchaseOrder> ReceivePurchaseOrderAsync(
        Guid tenantId,
        Guid purchaseOrderId,
        Guid? branchId,
        CancellationToken cancellationToken);
}

public sealed class PurchasingService(
    AppDbContext dbContext,
    IWarehouseCompatibilityService warehouseCompatibilityService,
    IAccountingBridgeService accountingBridgeService) : IPurchasingService
{
    public async Task<Supplier> CreateSupplierAsync(
        Guid tenantId,
        string name,
        string? taxNumber,
        string? phone,
        string? email,
        CancellationToken cancellationToken)
    {
        var normalizedName = name.Trim();
        if (string.IsNullOrWhiteSpace(normalizedName))
        {
            throw new InvalidOperationException("supplier name is required.");
        }

        var supplier = new Supplier
        {
            TenantId = tenantId,
            Name = normalizedName,
            TaxNumber = NormalizeOptional(taxNumber),
            Phone = NormalizeOptional(phone),
            Email = NormalizeOptional(email),
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow
        };

        dbContext.Add(supplier);
        dbContext.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId,
            Action = PurchasingEventTypes.SupplierCreated,
            Entity = "suppliers",
            EntityId = supplier.Id.ToString(),
            PayloadJson = JsonSerializer.Serialize(new
            {
                supplier.Id,
                supplier.Name,
                supplier.TaxNumber,
                supplier.Phone,
                supplier.Email,
                supplier.IsActive,
                supplier.CreatedAt
            })
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return supplier;
    }

    public async Task<PurchaseOrder> CreatePurchaseOrderDraftAsync(
        Guid tenantId,
        Guid supplierId,
        Guid warehouseId,
        CancellationToken cancellationToken)
    {
        await ResolveSupplierAsync(tenantId, supplierId, cancellationToken);
        var resolvedWarehouseId = await warehouseCompatibilityService.ResolveWarehouseAsync(tenantId, warehouseId, cancellationToken);

        var purchaseOrder = new PurchaseOrder
        {
            TenantId = tenantId,
            SupplierId = supplierId,
            WarehouseId = resolvedWarehouseId,
            Status = PurchaseOrderStatuses.Draft,
            CreatedAt = DateTimeOffset.UtcNow
        };

        dbContext.Add(purchaseOrder);
        dbContext.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId,
            Action = PurchasingEventTypes.PurchaseOrderCreated,
            Entity = "purchase_orders",
            EntityId = purchaseOrder.Id.ToString(),
            PayloadJson = JsonSerializer.Serialize(new
            {
                purchaseOrder.Id,
                purchaseOrder.SupplierId,
                purchaseOrder.WarehouseId,
                purchaseOrder.Status,
                purchaseOrder.CreatedAt
            })
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return purchaseOrder;
    }

    public async Task<PurchaseOrderLine> AddPurchaseOrderLineAsync(
        Guid tenantId,
        Guid purchaseOrderId,
        Guid productId,
        decimal quantity,
        decimal unitCost,
        CancellationToken cancellationToken)
    {
        if (quantity <= 0)
        {
            throw new InvalidOperationException("quantity must be greater than zero.");
        }

        if (unitCost < 0)
        {
            throw new InvalidOperationException("unitCost must be greater than or equal to zero.");
        }

        var purchaseOrder = await dbContext.Set<PurchaseOrder>()
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.Id == purchaseOrderId && x.TenantId == tenantId,
                cancellationToken);

        if (purchaseOrder is null)
        {
            throw new InvalidOperationException("purchase order not found.");
        }

        if (purchaseOrder.Status is PurchaseOrderStatuses.Canceled or PurchaseOrderStatuses.Received)
        {
            throw new InvalidOperationException("cannot add lines to canceled or received purchase order.");
        }

        var productExists = await dbContext.Products
            .AsNoTracking()
            .AnyAsync(x => x.Id == productId && x.TenantId == tenantId, cancellationToken);

        if (productExists == false)
        {
            throw new InvalidOperationException("product not found for tenant.");
        }

        var existingLine = await dbContext.Set<PurchaseOrderLine>()
            .FirstOrDefaultAsync(
                x => x.PurchaseOrderId == purchaseOrderId && x.ProductId == productId,
                cancellationToken);

        if (existingLine is not null)
        {
            existingLine.Quantity += quantity;
            existingLine.UnitCost = unitCost;
            await dbContext.SaveChangesAsync(cancellationToken);
            return existingLine;
        }

        var line = new PurchaseOrderLine
        {
            PurchaseOrderId = purchaseOrderId,
            ProductId = productId,
            Quantity = quantity,
            UnitCost = unitCost
        };

        dbContext.Add(line);
        await dbContext.SaveChangesAsync(cancellationToken);
        return line;
    }

    public async Task<PurchaseOrder> ReceivePurchaseOrderAsync(
        Guid tenantId,
        Guid purchaseOrderId,
        Guid? branchId,
        CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        var purchaseOrder = await dbContext.Set<PurchaseOrder>()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(
                x => x.Id == purchaseOrderId && x.TenantId == tenantId,
                cancellationToken);

        if (purchaseOrder is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new InvalidOperationException("purchase order not found.");
        }

        if (purchaseOrder.Status == PurchaseOrderStatuses.Canceled)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new InvalidOperationException("cannot receive canceled purchase order.");
        }

        if (purchaseOrder.Status == PurchaseOrderStatuses.Received)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new InvalidOperationException("purchase order already received.");
        }

        if (purchaseOrder.Lines.Count == 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new InvalidOperationException("purchase order must include at least one line.");
        }

        await ResolveSupplierAsync(tenantId, purchaseOrder.SupplierId, cancellationToken);
        await warehouseCompatibilityService.ResolveWarehouseAsync(tenantId, purchaseOrder.WarehouseId, cancellationToken);

        var resolvedBranchId = branchId ?? await ResolveFallbackBranchIdAsync(tenantId, cancellationToken);

        foreach (var line in purchaseOrder.Lines)
        {
            if (line.Quantity <= 0)
            {
                await transaction.RollbackAsync(cancellationToken);
                throw new InvalidOperationException("purchase order line quantity must be greater than zero.");
            }

            if (line.UnitCost < 0)
            {
                await transaction.RollbackAsync(cancellationToken);
                throw new InvalidOperationException("purchase order line unit cost must be greater than or equal to zero.");
            }

            await warehouseCompatibilityService.ApplyWarehouseDeltaAsync(
                tenantId,
                line.ProductId,
                line.Quantity,
                purchaseOrder.WarehouseId,
                cancellationToken);

            await UpsertStockBalanceAsync(
                tenantId,
                resolvedBranchId,
                line.ProductId,
                line.Quantity,
                cancellationToken);

            dbContext.StockMoves.Add(new StockMove
            {
                TenantId = tenantId,
                BranchId = resolvedBranchId,
                ProductId = line.ProductId,
                WarehouseId = purchaseOrder.WarehouseId,
                QtyDelta = line.Quantity,
                Reason = "PURCHASE_RECEIPT_IN",
                RefType = "purchase_order",
                RefId = purchaseOrder.Id.ToString()
            });
        }

        purchaseOrder.Status = PurchaseOrderStatuses.Received;
        purchaseOrder.ReceivedAt = DateTimeOffset.UtcNow;

        dbContext.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId,
            Action = PurchasingEventTypes.PurchaseOrderReceived,
            Entity = "purchase_orders",
            EntityId = purchaseOrder.Id.ToString(),
            PayloadJson = JsonSerializer.Serialize(new
            {
                purchaseOrder.Id,
                purchaseOrder.SupplierId,
                purchaseOrder.WarehouseId,
                purchaseOrder.Status,
                purchaseOrder.ReceivedAt,
                lineCount = purchaseOrder.Lines.Count
            })
        });

        await accountingBridgeService.EnsurePendingExportItemAsync(
            tenantId,
            AccountingBridgeSourceTypes.PurchaseReceipt,
            purchaseOrder.Id.ToString(),
            PurchasingEventTypes.PurchaseOrderReceived,
            JsonSerializer.Serialize(new
            {
                purchaseOrder.Id,
                purchaseOrder.SupplierId,
                purchaseOrder.WarehouseId,
                purchaseOrder.Status,
                purchaseOrder.ReceivedAt,
                lineCount = purchaseOrder.Lines.Count,
                lines = purchaseOrder.Lines.Select(line => new
                {
                    line.ProductId,
                    line.Quantity,
                    line.UnitCost
                }).ToList()
            }),
            cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return purchaseOrder;
    }

    private async Task<Supplier> ResolveSupplierAsync(Guid tenantId, Guid supplierId, CancellationToken cancellationToken)
    {
        var supplier = await dbContext.Set<Supplier>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == supplierId && x.TenantId == tenantId, cancellationToken);

        if (supplier is null)
        {
            throw new InvalidOperationException("supplier not found for tenant.");
        }

        if (supplier.IsActive == false)
        {
            throw new InvalidOperationException("supplier is inactive.");
        }

        return supplier;
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
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

    private async Task UpsertStockBalanceAsync(
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
}
