using System.Data;
using System.Text.Json;
using LoomaPos.Domain.Auditing;
using LoomaPos.Domain.Manufacturing;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Infrastructure.Manufacturing;

public interface IManufacturingPreparationService
{
    Task<BillOfMaterials> CreateBomAsync(
        Guid tenantId,
        Guid finishedProductId,
        string? code,
        int version,
        bool activate,
        IReadOnlyList<ManufacturingBomLineInput> lines,
        CancellationToken cancellationToken);

    Task<BillOfMaterials> ReplaceBomLinesAsync(
        Guid tenantId,
        Guid bomId,
        IReadOnlyList<ManufacturingBomLineInput> lines,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<BillOfMaterials>> ListBomsAsync(
        Guid tenantId,
        Guid? finishedProductId,
        bool? isActive,
        int take,
        CancellationToken cancellationToken);

    Task<BillOfMaterials> SetBomActivationAsync(
        Guid tenantId,
        Guid bomId,
        bool isActive,
        CancellationToken cancellationToken);

    Task<ManufacturingBomCostSummary> GetBomCostSummaryAsync(
        Guid tenantId,
        Guid bomId,
        CancellationToken cancellationToken);

    Task<ProductionOrder> CreateProductionOrderAsync(
        Guid tenantId,
        Guid? bomId,
        Guid finishedProductId,
        decimal plannedQuantity,
        string? status,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<ProductionOrder>> ListProductionOrdersAsync(
        Guid tenantId,
        string? status,
        int take,
        CancellationToken cancellationToken);

    Task<ProductionOrder> CancelProductionOrderAsync(
        Guid tenantId,
        Guid productionOrderId,
        CancellationToken cancellationToken);
}

public sealed class ManufacturingPreparationService(AppDbContext dbContext) : IManufacturingPreparationService
{
    public async Task<BillOfMaterials> CreateBomAsync(
        Guid tenantId,
        Guid finishedProductId,
        string? code,
        int version,
        bool activate,
        IReadOnlyList<ManufacturingBomLineInput> lines,
        CancellationToken cancellationToken)
    {
        if (version <= 0)
        {
            throw new InvalidOperationException("version must be greater than zero.");
        }

        await EnsureProductExistsAsync(tenantId, finishedProductId, cancellationToken);
        var normalizedLines = await NormalizeLinesAsync(tenantId, finishedProductId, lines, cancellationToken);

        var existingBom = await dbContext.Set<BillOfMaterials>()
            .AsNoTracking()
            .AnyAsync(
                x => x.TenantId == tenantId &&
                     x.ProductId == finishedProductId &&
                     x.Version == version,
                cancellationToken);

        if (existingBom)
        {
            throw new InvalidOperationException("BOM version already exists for finished product.");
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        var bom = new BillOfMaterials
        {
            TenantId = tenantId,
            ProductId = finishedProductId,
            Code = NormalizeOptional(code),
            Version = version,
            IsActive = activate,
            CreatedAt = DateTimeOffset.UtcNow,
            Lines = normalizedLines.Select(x => new BillOfMaterialsLine
            {
                ComponentProductId = x.ComponentProductId,
                Quantity = x.Quantity
            }).ToList()
        };

        dbContext.Add(bom);

        if (activate)
        {
            await DeactivateOtherBomsAsync(tenantId, finishedProductId, exceptBomId: bom.Id, cancellationToken);
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId,
            Action = ManufacturingEventTypes.BomCreated,
            Entity = "bill_of_materials",
            EntityId = bom.Id.ToString(),
            PayloadJson = JsonSerializer.Serialize(new
            {
                bom.Id,
                bom.TenantId,
                bom.ProductId,
                bom.Code,
                bom.Version,
                bom.IsActive,
                lineCount = bom.Lines.Count,
                lines = bom.Lines.Select(line => new
                {
                    line.ComponentProductId,
                    line.Quantity
                }).ToList(),
                bom.CreatedAt
            })
        });

        if (activate)
        {
            dbContext.AuditLogs.Add(new AuditLog
            {
                TenantId = tenantId,
                Action = ManufacturingEventTypes.BomActivated,
                Entity = "bill_of_materials",
                EntityId = bom.Id.ToString(),
                PayloadJson = JsonSerializer.Serialize(new
                {
                    bom.Id,
                    bom.ProductId,
                    bom.Version,
                    bom.IsActive
                })
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return await dbContext.Set<BillOfMaterials>()
            .AsNoTracking()
            .Include(x => x.Lines)
            .FirstAsync(x => x.Id == bom.Id, cancellationToken);
    }

    public async Task<BillOfMaterials> ReplaceBomLinesAsync(
        Guid tenantId,
        Guid bomId,
        IReadOnlyList<ManufacturingBomLineInput> lines,
        CancellationToken cancellationToken)
    {
        var bom = await dbContext.Set<BillOfMaterials>()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == bomId && x.TenantId == tenantId, cancellationToken);

        if (bom is null)
        {
            throw new InvalidOperationException("BOM not found for tenant.");
        }

        var normalizedLines = await NormalizeLinesAsync(tenantId, bom.ProductId, lines, cancellationToken);

        dbContext.Set<BillOfMaterialsLine>().RemoveRange(bom.Lines);

        var replacementLines = normalizedLines.Select(x => new BillOfMaterialsLine
        {
            BomId = bom.Id,
            ComponentProductId = x.ComponentProductId,
            Quantity = x.Quantity
        }).ToList();

        dbContext.Set<BillOfMaterialsLine>().AddRange(replacementLines);
        bom.Lines = replacementLines;

        dbContext.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId,
            Action = "bom_updated",
            Entity = "bill_of_materials",
            EntityId = bom.Id.ToString(),
            PayloadJson = JsonSerializer.Serialize(new
            {
                bom.Id,
                bom.ProductId,
                lineCount = bom.Lines.Count,
                lines = bom.Lines.Select(line => new
                {
                    line.ComponentProductId,
                    line.Quantity
                }).ToList()
            })
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return await dbContext.Set<BillOfMaterials>()
            .AsNoTracking()
            .Include(x => x.Lines)
            .FirstAsync(x => x.Id == bom.Id, cancellationToken);
    }

    public async Task<IReadOnlyList<BillOfMaterials>> ListBomsAsync(
        Guid tenantId,
        Guid? finishedProductId,
        bool? isActive,
        int take,
        CancellationToken cancellationToken)
    {
        var safeTake = take <= 0 ? 200 : Math.Min(take, 1000);

        var query = dbContext.Set<BillOfMaterials>()
            .AsNoTracking()
            .Include(x => x.Lines)
            .Where(x => x.TenantId == tenantId)
            .AsQueryable();

        if (finishedProductId.HasValue)
        {
            query = query.Where(x => x.ProductId == finishedProductId.Value);
        }

        if (isActive.HasValue)
        {
            query = query.Where(x => x.IsActive == isActive.Value);
        }

        return await query
            .OrderByDescending(x => x.CreatedAt)
            .Take(safeTake)
            .ToListAsync(cancellationToken);
    }

    public async Task<BillOfMaterials> SetBomActivationAsync(
        Guid tenantId,
        Guid bomId,
        bool isActive,
        CancellationToken cancellationToken)
    {
        var bom = await dbContext.Set<BillOfMaterials>()
            .FirstOrDefaultAsync(x => x.Id == bomId && x.TenantId == tenantId, cancellationToken);

        if (bom is null)
        {
            throw new InvalidOperationException("BOM not found for tenant.");
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        if (isActive)
        {
            await DeactivateOtherBomsAsync(tenantId, bom.ProductId, bom.Id, cancellationToken);
            bom.IsActive = true;

            dbContext.AuditLogs.Add(new AuditLog
            {
                TenantId = tenantId,
                Action = ManufacturingEventTypes.BomActivated,
                Entity = "bill_of_materials",
                EntityId = bom.Id.ToString(),
                PayloadJson = JsonSerializer.Serialize(new
                {
                    bom.Id,
                    bom.ProductId,
                    bom.Version,
                    bom.IsActive
                })
            });
        }
        else
        {
            bom.IsActive = false;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return await dbContext.Set<BillOfMaterials>()
            .AsNoTracking()
            .Include(x => x.Lines)
            .FirstAsync(x => x.Id == bom.Id, cancellationToken);
    }

    public async Task<ManufacturingBomCostSummary> GetBomCostSummaryAsync(
        Guid tenantId,
        Guid bomId,
        CancellationToken cancellationToken)
    {
        var bom = await dbContext.Set<BillOfMaterials>()
            .AsNoTracking()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == bomId && x.TenantId == tenantId, cancellationToken);

        if (bom is null)
        {
            throw new InvalidOperationException("BOM not found for tenant.");
        }

        var componentIds = bom.Lines.Select(x => x.ComponentProductId).Distinct().ToArray();
        var costs = await dbContext.Products.AsNoTracking()
            .Where(x => x.TenantId == tenantId && componentIds.Contains(x.Id))
            .Select(x => new { x.Id, x.PurchasePrice })
            .ToDictionaryAsync(x => x.Id, x => x.PurchasePrice, cancellationToken);

        var lines = bom.Lines.Select(line =>
        {
            var unitCost = costs.GetValueOrDefault(line.ComponentProductId, 0m);
            var lineCost = line.Quantity * unitCost;
            var costUnavailable = unitCost <= 0;

            return new ManufacturingBomCostLine(
                line.ComponentProductId,
                line.Quantity,
                unitCost,
                lineCost,
                costUnavailable);
        }).ToList();

        return new ManufacturingBomCostSummary(
            bom.Id,
            bom.ProductId,
            bom.Version,
            lines.Sum(x => x.LineCost),
            lines.Any(x => x.IsCostUnavailable),
            lines);
    }

    public async Task<ProductionOrder> CreateProductionOrderAsync(
        Guid tenantId,
        Guid? bomId,
        Guid finishedProductId,
        decimal plannedQuantity,
        string? status,
        CancellationToken cancellationToken)
    {
        if (plannedQuantity <= 0)
        {
            throw new InvalidOperationException("plannedQuantity must be greater than zero.");
        }

        var normalizedStatus = string.IsNullOrWhiteSpace(status)
            ? ProductionOrderStatuses.Planned
            : status.Trim().ToLowerInvariant();

        if (ProductionOrderStatuses.All.Contains(normalizedStatus, StringComparer.Ordinal) == false)
        {
            throw new InvalidOperationException("unsupported production order status.");
        }

        await EnsureProductExistsAsync(tenantId, finishedProductId, cancellationToken);

        if (bomId.HasValue)
        {
            var bom = await dbContext.Set<BillOfMaterials>()
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == bomId.Value && x.TenantId == tenantId, cancellationToken);

            if (bom is null)
            {
                throw new InvalidOperationException("BOM not found for tenant.");
            }

            if (bom.ProductId != finishedProductId)
            {
                throw new InvalidOperationException("BOM finished product mismatch.");
            }
        }

        var order = new ProductionOrder
        {
            TenantId = tenantId,
            BomId = bomId,
            FinishedProductId = finishedProductId,
            PlannedQuantity = plannedQuantity,
            Status = normalizedStatus,
            CreatedAt = DateTimeOffset.UtcNow
        };

        dbContext.Add(order);
        dbContext.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId,
            Action = ManufacturingEventTypes.ProductionOrderCreated,
            Entity = "production_orders",
            EntityId = order.Id.ToString(),
            PayloadJson = JsonSerializer.Serialize(new
            {
                order.Id,
                order.BomId,
                order.FinishedProductId,
                order.PlannedQuantity,
                order.Status,
                order.CreatedAt
            })
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return order;
    }

    public async Task<IReadOnlyList<ProductionOrder>> ListProductionOrdersAsync(
        Guid tenantId,
        string? status,
        int take,
        CancellationToken cancellationToken)
    {
        var safeTake = take <= 0 ? 200 : Math.Min(take, 1000);

        var query = dbContext.Set<ProductionOrder>()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToLowerInvariant();
            query = query.Where(x => x.Status == normalizedStatus);
        }

        return await query
            .OrderByDescending(x => x.CreatedAt)
            .Take(safeTake)
            .ToListAsync(cancellationToken);
    }

    public async Task<ProductionOrder> CancelProductionOrderAsync(
        Guid tenantId,
        Guid productionOrderId,
        CancellationToken cancellationToken)
    {
        var order = await dbContext.Set<ProductionOrder>()
            .FirstOrDefaultAsync(x => x.Id == productionOrderId && x.TenantId == tenantId, cancellationToken);

        if (order is null)
        {
            throw new InvalidOperationException("production order not found for tenant.");
        }

        if (order.Status == ProductionOrderStatuses.Canceled)
        {
            return order;
        }

        order.Status = ProductionOrderStatuses.Canceled;

        dbContext.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId,
            Action = ManufacturingEventTypes.ProductionOrderCanceled,
            Entity = "production_orders",
            EntityId = order.Id.ToString(),
            PayloadJson = JsonSerializer.Serialize(new
            {
                order.Id,
                order.BomId,
                order.FinishedProductId,
                order.PlannedQuantity,
                order.Status,
                canceledAt = DateTimeOffset.UtcNow
            })
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return order;
    }

    private async Task EnsureProductExistsAsync(Guid tenantId, Guid productId, CancellationToken cancellationToken)
    {
        var exists = await dbContext.Products.AsNoTracking()
            .AnyAsync(x => x.Id == productId && x.TenantId == tenantId, cancellationToken);

        if (!exists)
        {
            throw new InvalidOperationException("product not found for tenant.");
        }
    }

    private async Task<List<ManufacturingBomLineInput>> NormalizeLinesAsync(
        Guid tenantId,
        Guid finishedProductId,
        IReadOnlyList<ManufacturingBomLineInput> lines,
        CancellationToken cancellationToken)
    {
        if (lines.Count == 0)
        {
            throw new InvalidOperationException("BOM must include at least one component line.");
        }

        var normalized = lines
            .Select(line => new ManufacturingBomLineInput(line.ComponentProductId, line.Quantity))
            .ToList();

        var duplicateComponent = normalized
            .GroupBy(x => x.ComponentProductId)
            .FirstOrDefault(group => group.Count() > 1);

        if (duplicateComponent is not null)
        {
            throw new InvalidOperationException("BOM cannot include duplicate component product lines.");
        }

        foreach (var line in normalized)
        {
            if (line.Quantity <= 0)
            {
                throw new InvalidOperationException("component quantity must be greater than zero.");
            }

            if (line.ComponentProductId == finishedProductId)
            {
                throw new InvalidOperationException("BOM cannot reference finished product as its own component.");
            }
        }

        var componentIds = normalized.Select(x => x.ComponentProductId).Distinct().ToArray();
        var existingComponentIds = await dbContext.Products.AsNoTracking()
            .Where(x => x.TenantId == tenantId && componentIds.Contains(x.Id))
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        if (existingComponentIds.Count != componentIds.Length)
        {
            throw new InvalidOperationException("one or more component products not found for tenant.");
        }

        return normalized;
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private async Task DeactivateOtherBomsAsync(
        Guid tenantId,
        Guid finishedProductId,
        Guid exceptBomId,
        CancellationToken cancellationToken)
    {
        var activeBoms = await dbContext.Set<BillOfMaterials>()
            .Where(x => x.TenantId == tenantId && x.ProductId == finishedProductId && x.Id != exceptBomId && x.IsActive)
            .ToListAsync(cancellationToken);

        foreach (var other in activeBoms)
        {
            other.IsActive = false;
        }
    }
}

public sealed record ManufacturingBomLineInput(Guid ComponentProductId, decimal Quantity);

public sealed record ManufacturingBomCostSummary(
    Guid BomId,
    Guid FinishedProductId,
    int Version,
    decimal TheoreticalMaterialCost,
    bool HasCostGaps,
    IReadOnlyList<ManufacturingBomCostLine> Lines);

public sealed record ManufacturingBomCostLine(
    Guid ComponentProductId,
    decimal Quantity,
    decimal UnitCost,
    decimal LineCost,
    bool IsCostUnavailable);
