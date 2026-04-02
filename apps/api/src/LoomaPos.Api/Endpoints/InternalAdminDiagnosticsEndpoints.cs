using LoomaPos.Api.Security;
using LoomaPos.Domain.Accounting;
using LoomaPos.Domain.Common;
using LoomaPos.Domain.Customers;
using LoomaPos.Domain.Purchasing;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class InternalAdminDiagnosticsEndpoints
{
    public static IEndpointRouteBuilder MapInternalAdminDiagnosticsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/internal/admin/diagnostics/reconciliation")
            .WithTags("Internal Admin Diagnostics")
            .RequireInternalAdminAccess();

        group.MapGet("/stock", GetStockReconciliationAsync)
            .WithSummary("Compares legacy stock aggregates with warehouse-based aggregates.");

        group.MapGet("/customer-accounts", GetCustomerAccountReconciliationAsync)
            .WithSummary("Compares current customer account balance with append-only entry sums.");

        group.MapGet("/accounting-exports", GetAccountingExportReconciliationAsync)
            .WithSummary("Compares operational source events with accounting export item integrity.");

        return app;
    }

    private static async Task<IResult> GetStockReconciliationAsync(
        AppDbContext dbContext,
        Guid? tenantId,
        decimal? tolerance,
        int? limit,
        CancellationToken cancellationToken)
    {
        var effectiveTolerance = NormalizeTolerance(tolerance);
        var effectiveLimit = NormalizeLimit(limit);

        var legacyQuery = dbContext.StockBalances.AsNoTracking();
        if (tenantId.HasValue)
        {
            legacyQuery = legacyQuery.Where(x => x.TenantId == tenantId.Value);
        }

        var warehouseQuery = dbContext.StockByWarehouses.AsNoTracking();
        if (tenantId.HasValue)
        {
            warehouseQuery = warehouseQuery.Where(x => x.TenantId == tenantId.Value);
        }

        var legacyRows = await legacyQuery
            .GroupBy(x => new { x.TenantId, x.ProductId })
            .Select(group => new
            {
                group.Key.TenantId,
                group.Key.ProductId,
                LegacyQty = group.Sum(x => x.Qty)
            })
            .ToListAsync(cancellationToken);

        var warehouseRows = await warehouseQuery
            .GroupBy(x => new { x.TenantId, x.ProductId })
            .Select(group => new
            {
                group.Key.TenantId,
                group.Key.ProductId,
                WarehouseQty = group.Sum(x => x.Quantity)
            })
            .ToListAsync(cancellationToken);

        var legacyByKey = legacyRows.ToDictionary(
            x => (x.TenantId, x.ProductId),
            x => x.LegacyQty);
        var warehouseByKey = warehouseRows.ToDictionary(
            x => (x.TenantId, x.ProductId),
            x => x.WarehouseQty);

        var keys = new HashSet<(Guid TenantId, Guid ProductId)>(legacyByKey.Keys);
        keys.UnionWith(warehouseByKey.Keys);

        var productIds = keys.Select(x => x.ProductId).Distinct().ToList();
        var productsQuery = dbContext.Products.AsNoTracking().Where(x => productIds.Contains(x.Id));
        if (tenantId.HasValue)
        {
            productsQuery = productsQuery.Where(x => x.TenantId == tenantId.Value);
        }

        var productNames = await productsQuery
            .Select(x => new { x.TenantId, x.Id, x.Name })
            .ToDictionaryAsync(
                x => (x.TenantId, ProductId: x.Id),
                x => x.Name,
                cancellationToken);

        var rows = keys
            .Select(key =>
            {
                var hasLegacy = legacyByKey.TryGetValue(key, out var legacyQty);
                var hasWarehouse = warehouseByKey.TryGetValue(key, out var warehouseQty);
                legacyQty = hasLegacy ? legacyQty : 0m;
                warehouseQty = hasWarehouse ? warehouseQty : 0m;

                var delta = warehouseQty - legacyQty;
                var matched = hasLegacy && hasWarehouse && Math.Abs(delta) <= effectiveTolerance;
                var status = matched
                    ? "matched"
                    : hasLegacy && hasWarehouse
                        ? "mismatch"
                        : hasLegacy
                            ? "legacy_only"
                            : "warehouse_only";

                var productName = productNames.TryGetValue(key, out var resolvedName)
                    ? resolvedName
                    : null;

                return new
                {
                    tenantId = key.TenantId,
                    productId = key.ProductId,
                    productName,
                    legacyQty,
                    warehouseQty,
                    delta,
                    status,
                    matched
                };
            })
            .OrderByDescending(x => Math.Abs(x.delta))
            .ThenBy(x => x.tenantId)
            .ThenBy(x => x.productId)
            .ToList();

        var mismatches = rows
            .Where(x => !x.matched)
            .Take(effectiveLimit)
            .ToList();

        return Results.Ok(new
        {
            scope = new { tenantId },
            tolerance = effectiveTolerance,
            summary = new
            {
                totalCompared = rows.Count,
                matched = rows.Count(x => x.matched),
                mismatched = rows.Count(x => !x.matched),
                mismatchRatio = rows.Count == 0 ? 0m : Math.Round((decimal)rows.Count(x => !x.matched) / rows.Count, 4),
                legacyOnly = rows.Count(x => x.status == "legacy_only"),
                warehouseOnly = rows.Count(x => x.status == "warehouse_only"),
                totalAbsoluteDelta = rows.Sum(x => Math.Abs(x.delta))
            },
            mismatches,
            generatedAt = DateTimeOffset.UtcNow
        });
    }

    private static async Task<IResult> GetCustomerAccountReconciliationAsync(
        AppDbContext dbContext,
        Guid? tenantId,
        decimal? tolerance,
        int? limit,
        CancellationToken cancellationToken)
    {
        var effectiveTolerance = NormalizeTolerance(tolerance);
        var effectiveLimit = NormalizeLimit(limit);

        var accountQuery = dbContext.CustomerCurrentAccounts.AsNoTracking();
        if (tenantId.HasValue)
        {
            accountQuery = accountQuery.Where(x => x.TenantId == tenantId.Value);
        }

        var entryQuery = dbContext.CustomerCurrentAccountEntries.AsNoTracking();
        if (tenantId.HasValue)
        {
            entryQuery = entryQuery.Where(x => x.TenantId == tenantId.Value);
        }

        var accounts = await accountQuery
            .Select(x => new
            {
                x.TenantId,
                CustomerId = x.CustomerId,
                CurrentBalance = x.Balance,
                x.Currency,
                x.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        var entrySums = await entryQuery
            .GroupBy(x => new { x.TenantId, x.CustomerId })
            .Select(group => new
            {
                group.Key.TenantId,
                group.Key.CustomerId,
                EntrySum = group.Sum(x => x.Amount),
                EntryCount = group.Count(),
                LastEntryAt = group.Max(x => x.CreatedAt)
            })
            .ToListAsync(cancellationToken);

        var accountByKey = accounts.ToDictionary(x => (x.TenantId, x.CustomerId));
        var entryByKey = entrySums.ToDictionary(x => (x.TenantId, CustomerId: x.CustomerId));

        var keys = new HashSet<(Guid TenantId, Guid CustomerId)>(accountByKey.Keys);
        keys.UnionWith(entryByKey.Keys);

        var customerIds = keys.Select(x => x.CustomerId).Distinct().ToList();
        var contactsQuery = dbContext.Contacts.AsNoTracking()
            .Where(x => customerIds.Contains(x.Id));
        if (tenantId.HasValue)
        {
            contactsQuery = contactsQuery.Where(x => x.TenantId == tenantId.Value);
        }

        var customerNames = await contactsQuery
            .Select(x => new { x.TenantId, x.Id, x.Name })
            .ToDictionaryAsync(
                x => (x.TenantId, CustomerId: x.Id),
                x => x.Name,
                cancellationToken);

        var rows = keys
            .Select(key =>
            {
                var hasAccount = accountByKey.TryGetValue(key, out var account);
                var hasEntry = entryByKey.TryGetValue(key, out var entry);

                var currentBalance = hasAccount ? account!.CurrentBalance : 0m;
                var entrySum = hasEntry ? entry!.EntrySum : 0m;
                var delta = entrySum - currentBalance;
                var matched = hasAccount && hasEntry && Math.Abs(delta) <= effectiveTolerance;
                var status = matched
                    ? "matched"
                    : hasAccount && hasEntry
                        ? "mismatch"
                        : hasAccount
                            ? "account_only"
                            : "entries_only";

                var customerName = customerNames.TryGetValue(key, out var resolvedName)
                    ? resolvedName
                    : null;

                return new
                {
                    tenantId = key.TenantId,
                    customerId = key.CustomerId,
                    customerName,
                    currentBalance,
                    entrySum,
                    delta,
                    status,
                    matched,
                    currency = hasAccount ? account!.Currency : "TRY",
                    updatedAt = hasAccount ? account!.UpdatedAt : (DateTimeOffset?)null,
                    entryCount = hasEntry ? entry!.EntryCount : 0,
                    lastEntryAt = hasEntry ? entry!.LastEntryAt : (DateTimeOffset?)null
                };
            })
            .OrderByDescending(x => Math.Abs(x.delta))
            .ThenBy(x => x.tenantId)
            .ThenBy(x => x.customerId)
            .ToList();

        var mismatches = rows
            .Where(x => !x.matched)
            .Take(effectiveLimit)
            .ToList();

        return Results.Ok(new
        {
            scope = new { tenantId },
            tolerance = effectiveTolerance,
            summary = new
            {
                totalCompared = rows.Count,
                matched = rows.Count(x => x.matched),
                mismatched = rows.Count(x => !x.matched),
                mismatchRatio = rows.Count == 0 ? 0m : Math.Round((decimal)rows.Count(x => !x.matched) / rows.Count, 4),
                accountOnly = rows.Count(x => x.status == "account_only"),
                entriesOnly = rows.Count(x => x.status == "entries_only"),
                totalAbsoluteDelta = rows.Sum(x => Math.Abs(x.delta))
            },
            mismatches,
            generatedAt = DateTimeOffset.UtcNow
        });
    }

    private static async Task<IResult> GetAccountingExportReconciliationAsync(
        AppDbContext dbContext,
        Guid? tenantId,
        int? limit,
        CancellationToken cancellationToken)
    {
        var effectiveLimit = NormalizeLimit(limit);

        var salesQuery = dbContext.Sales.AsNoTracking();
        var cashQuery = dbContext.CashTransactions.AsNoTracking();
        var purchaseQuery = dbContext.PurchaseOrders.AsNoTracking();
        var customerEntryQuery = dbContext.CustomerCurrentAccountEntries.AsNoTracking();
        var exportQuery = dbContext.AccountingExportItems.AsNoTracking();

        if (tenantId.HasValue)
        {
            salesQuery = salesQuery.Where(x => x.TenantId == tenantId.Value);
            cashQuery = cashQuery.Where(x => x.TenantId == tenantId.Value);
            purchaseQuery = purchaseQuery.Where(x => x.TenantId == tenantId.Value);
            customerEntryQuery = customerEntryQuery.Where(x => x.TenantId == tenantId.Value);
            exportQuery = exportQuery.Where(x => x.TenantId == tenantId.Value);
        }

        var expected = new List<(Guid TenantId, string SourceType, string SourceId, string Origin)>();

        var completedSales = await salesQuery
            .Where(x => x.Status == SaleStatus.Completed)
            .Select(x => new { x.TenantId, x.Id })
            .ToListAsync(cancellationToken);
        expected.AddRange(completedSales.Select(x => (x.TenantId, AccountingBridgeSourceTypes.Sale, x.Id.ToString(), "sales.completed")));

        var reversalSales = await salesQuery
            .Where(x => x.Status == SaleStatus.Refunded || x.Status == SaleStatus.Voided)
            .Select(x => new { x.TenantId, x.Id, x.Status })
            .ToListAsync(cancellationToken);
        expected.AddRange(reversalSales.Select(x => (x.TenantId, AccountingBridgeSourceTypes.SaleReversal, x.Id.ToString(), $"sales.{x.Status.ToString().ToLowerInvariant()}")));

        var cashRows = await cashQuery
            .Select(x => new { x.TenantId, x.Id })
            .ToListAsync(cancellationToken);
        expected.AddRange(cashRows.Select(x => (x.TenantId, AccountingBridgeSourceTypes.CashMovement, x.Id.ToString(), "cash_transactions")));

        var purchaseRows = await purchaseQuery
            .Where(x => x.Status == PurchaseOrderStatuses.Received)
            .Select(x => new { x.TenantId, x.Id })
            .ToListAsync(cancellationToken);
        expected.AddRange(purchaseRows.Select(x => (x.TenantId, AccountingBridgeSourceTypes.PurchaseReceipt, x.Id.ToString(), "purchase_orders.received")));

        var customerCollections = await customerEntryQuery
            .Where(x => x.Type == CustomerCurrentAccountEntryTypes.Collection)
            .Select(x => new { x.TenantId, x.Id })
            .ToListAsync(cancellationToken);
        expected.AddRange(customerCollections.Select(x => (x.TenantId, AccountingBridgeSourceTypes.CustomerCollection, x.Id.ToString(), "customer_account_entries.collection")));

        var customerAdjustments = await customerEntryQuery
            .Where(x => x.Type == CustomerCurrentAccountEntryTypes.Adjustment || x.Type == CustomerCurrentAccountEntryTypes.RefundCredit)
            .Select(x => new { x.TenantId, x.Id, x.Type })
            .ToListAsync(cancellationToken);
        expected.AddRange(customerAdjustments.Select(x => (x.TenantId, AccountingBridgeSourceTypes.CustomerAccountAdjustment, x.Id.ToString(), $"customer_account_entries.{x.Type}")));

        var exportItems = await exportQuery
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.SourceType,
                x.SourceId,
                x.Status,
                x.ExportedAt,
                x.FailureReason,
                x.EventCode,
                x.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var expectedByKey = expected
            .GroupBy(x => (x.TenantId, x.SourceType, x.SourceId))
            .ToDictionary(
                group => group.Key,
                group => group.Select(x => x.Origin).Distinct().ToArray());

        var exportByKey = exportItems
            .GroupBy(x => (x.TenantId, x.SourceType, x.SourceId))
            .ToDictionary(group => group.Key, group => group.ToList());

        var missing = expectedByKey
            .Where(x => !exportByKey.ContainsKey(x.Key))
            .Select(x => new
            {
                tenantId = x.Key.TenantId,
                sourceType = x.Key.SourceType,
                sourceId = x.Key.SourceId,
                expectedFrom = x.Value
            })
            .Take(effectiveLimit)
            .ToList();

        var duplicates = exportByKey
            .Where(x => x.Value.Count > 1)
            .Select(x => new
            {
                tenantId = x.Key.TenantId,
                sourceType = x.Key.SourceType,
                sourceId = x.Key.SourceId,
                duplicateCount = x.Value.Count,
                statuses = x.Value.Select(item => item.Status).ToArray(),
                exportItemIds = x.Value.Select(item => item.Id).ToArray()
            })
            .Take(effectiveLimit)
            .ToList();

        var orphanExportItems = exportByKey
            .Where(x => !expectedByKey.ContainsKey(x.Key))
            .SelectMany(x => x.Value.Select(item => new
            {
                tenantId = item.TenantId,
                sourceType = item.SourceType,
                sourceId = item.SourceId,
                exportItemId = item.Id,
                item.Status,
                item.EventCode,
                item.CreatedAt
            }))
            .Take(effectiveLimit)
            .ToList();

        var statusAnomalies = exportItems
            .Where(item =>
                (item.Status == AccountingBridgeStatuses.Exported && item.ExportedAt is null)
                || (item.Status != AccountingBridgeStatuses.Exported && item.ExportedAt is not null)
                || (item.Status == AccountingBridgeStatuses.Failed && string.IsNullOrWhiteSpace(item.FailureReason)))
            .Select(item => new
            {
                tenantId = item.TenantId,
                sourceType = item.SourceType,
                sourceId = item.SourceId,
                exportItemId = item.Id,
                item.Status,
                item.ExportedAt,
                item.FailureReason,
                anomaly = item.Status == AccountingBridgeStatuses.Exported && item.ExportedAt is null
                    ? "exported_without_timestamp"
                    : item.Status != AccountingBridgeStatuses.Exported && item.ExportedAt is not null
                        ? "non_exported_with_timestamp"
                        : "failed_without_reason"
            })
            .Take(effectiveLimit)
            .ToList();

        return Results.Ok(new
        {
            scope = new { tenantId },
            summary = new
            {
                expectedSourceEvents = expectedByKey.Count,
                exportItems = exportItems.Count,
                missingExportItems = expectedByKey.Count(x => !exportByKey.ContainsKey(x.Key)),
                duplicateSourceExports = exportByKey.Count(x => x.Value.Count > 1),
                orphanExportItems = exportByKey.Count(x => !expectedByKey.ContainsKey(x.Key)),
                pending = exportItems.Count(x => x.Status == AccountingBridgeStatuses.Pending),
                failed = exportItems.Count(x => x.Status == AccountingBridgeStatuses.Failed),
                exported = exportItems.Count(x => x.Status == AccountingBridgeStatuses.Exported),
                statusAnomalies = exportItems.Count(item =>
                    (item.Status == AccountingBridgeStatuses.Exported && item.ExportedAt is null)
                    || (item.Status != AccountingBridgeStatuses.Exported && item.ExportedAt is not null)
                    || (item.Status == AccountingBridgeStatuses.Failed && string.IsNullOrWhiteSpace(item.FailureReason)))
            },
            missing,
            duplicates,
            orphanExportItems,
            statusAnomalies,
            generatedAt = DateTimeOffset.UtcNow
        });
    }

    private static decimal NormalizeTolerance(decimal? tolerance)
    {
        if (!tolerance.HasValue)
        {
            return 0.0001m;
        }

        if (tolerance.Value < 0)
        {
            return 0m;
        }

        return tolerance.Value;
    }

    private static int NormalizeLimit(int? limit)
    {
        if (!limit.HasValue)
        {
            return 200;
        }

        if (limit.Value < 1)
        {
            return 1;
        }

        return Math.Min(limit.Value, 1000);
    }
}
