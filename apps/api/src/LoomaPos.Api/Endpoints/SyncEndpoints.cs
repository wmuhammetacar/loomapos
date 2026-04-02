using System.Text.Json;
using LoomaPos.Api.Commerce;
using LoomaPos.Infrastructure.MultiTenancy;
using LoomaPos.Infrastructure.Persistence;
using LoomaPos.Infrastructure.Sync;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class SyncEndpoints
{
    public static IEndpointRouteBuilder MapSyncEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/sync").WithTags("Sync");

        group.MapPost("/events", ProcessSyncEventAsync)
            .WithName("ProcessSyncEvent")
            .WithSummary("Processes one desktop POS sync event with idempotent acknowledgement.")
            .RequireRateLimiting("sync-push");

        group.MapPost("/events/batch", ProcessSyncBatchAsync)
            .WithName("ProcessSyncBatch")
            .WithSummary("Processes desktop POS sync events in batch and returns per-event acknowledgement.")
            .RequireRateLimiting("sync-push");

        group.MapGet("/pull", PullSyncStateAsync)
            .WithName("PullSyncState")
            .WithSummary("Returns product/config/license/permission snapshots for desktop pull-sync refresh.");

        return app;
    }

    private static async Task<IResult> ProcessSyncEventAsync(
        SyncEventRequest request,
        HttpContext httpContext,
        IPortalAuthService authService,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        ISyncEventProcessor syncEventProcessor,
        CancellationToken cancellationToken)
    {
        if (!await AuthorizeTenantRequestAsync(httpContext, authService, tenantProvider, request.TenantId, cancellationToken))
        {
            return Results.Unauthorized();
        }

        var validation = ValidateRequest(request);
        if (validation is not null)
        {
            return validation;
        }

        var contextValidation = await ValidateSyncRequestContextAsync(request, tenantProvider, dbContext, cancellationToken);
        if (contextValidation is not null)
        {
            return contextValidation;
        }

        var result = await syncEventProcessor.ProcessAsync(request, cancellationToken);
        return Results.Ok(new
        {
            eventId = request.EventId,
            status = result.Status,
            alreadyProcessed = result.AlreadyProcessed,
            message = result.Message,
            errorCode = result.ErrorCode,
            serverReferenceId = result.ServerReferenceId
        });
    }

    private static async Task<IResult> ProcessSyncBatchAsync(
        SyncEventBatchRequest request,
        HttpContext httpContext,
        IPortalAuthService authService,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        ISyncEventProcessor syncEventProcessor,
        CancellationToken cancellationToken)
    {
        if (request.Events.Count == 0)
        {
            return Results.BadRequest(new { error = "events is required." });
        }

        var tenantIds = request.Events.Select(x => x.TenantId).Distinct().ToList();
        if (tenantIds.Count != 1 || tenantIds[0] == Guid.Empty)
        {
            return Results.BadRequest(new { error = "all sync events must belong to the same tenant." });
        }
        var tenantId = tenantIds[0];

        var branchIds = request.Events.Select(x => x.BranchId).Distinct().ToList();
        if (branchIds.Count != 1 || branchIds[0] == Guid.Empty)
        {
            return Results.BadRequest(new { error = "all sync events must belong to the same branch." });
        }

        var deviceIds = request.Events.Select(x => x.DeviceId).Distinct().ToList();
        if (deviceIds.Count != 1 || deviceIds[0] == Guid.Empty)
        {
            return Results.BadRequest(new { error = "all sync events must belong to the same device." });
        }

        if (!await AuthorizeTenantRequestAsync(httpContext, authService, tenantProvider, tenantId, cancellationToken))
        {
            return Results.Unauthorized();
        }

        foreach (var evt in request.Events)
        {
            var validation = ValidateRequest(evt);
            if (validation is not null)
            {
                return validation;
            }
        }

        var contextValidation = await ValidateSyncRequestContextAsync(request.Events[0], tenantProvider, dbContext, cancellationToken);
        if (contextValidation is not null)
        {
            return contextValidation;
        }

        var results = await syncEventProcessor.ProcessBatchAsync(request.Events, cancellationToken);
        return Results.Ok(new
        {
            results = request.Events.Zip(results, (evt, result) => new
            {
                eventId = evt.EventId,
                status = result.Status,
                alreadyProcessed = result.AlreadyProcessed,
                message = result.Message,
                errorCode = result.ErrorCode,
                serverReferenceId = result.ServerReferenceId
            })
        });
    }

    private static async Task<IResult> PullSyncStateAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        DateTimeOffset? since,
        CancellationToken cancellationToken)
    {
        var access = await ResolveSyncAccessAsync(httpContext, authService, tenantProvider, null, cancellationToken);
        if (access is null || !access.TenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var tenantId = access.TenantId.Value;
        var requestedBranchId = ResolveBranchId(httpContext, tenantProvider);
        var allBranches = await dbContext.Branches.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);
        var allowsAllBranches = AllowsAllBranches(access.RoleCode);
        var branches = allowsAllBranches
            ? allBranches
            : allBranches
                .Where(x => !requestedBranchId.HasValue || x.Id == requestedBranchId.Value)
                .Take(1)
                .ToList();
        if (branches.Count == 0 && allBranches.Count > 0)
        {
            branches = [allBranches[0]];
        }

        var selectedBranch = requestedBranchId.HasValue
            ? branches.FirstOrDefault(x => x.Id == requestedBranchId.Value)
            : branches.FirstOrDefault();
        selectedBranch ??= branches.FirstOrDefault();

        var products = dbContext.Products.AsNoTracking().Where(x => x.TenantId == tenantId);
        if (since.HasValue)
        {
            products = products.Where(x => x.CreatedAt >= since.Value);
        }

        var stockBalances = selectedBranch is null
            ? new Dictionary<Guid, decimal>()
            : await dbContext.StockBalances.AsNoTracking()
                .Where(x => x.TenantId == tenantId && x.BranchId == selectedBranch.Id)
                .ToDictionaryAsync(x => x.ProductId, x => x.Qty, cancellationToken);
        var categories = await dbContext.Categories.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        var productRows = await products
            .OrderBy(x => x.Name)
            .Take(500)
            .Select(x => new
            {
                id = x.Id,
                name = x.Name,
                sku = x.Sku,
                barcode = x.Barcode,
                unit = x.Unit,
                taxRate = x.TaxRate,
                price = x.SalePrice,
                purchasePrice = x.PurchasePrice,
                minStock = x.MinStock,
                categoryId = x.CategoryId,
                isActive = x.IsActive,
                stockTracked = x.StockTrackingEnabled,
                serviceItem = false,
                variantEnabled = false,
                negativeStockAllowed = false,
                sellWhenOutOfStock = true,
                updatedAt = x.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var dashboardSummary = await BuildDashboardSummaryAsync(
            dbContext,
            tenantId,
            selectedBranch?.Id,
            cancellationToken);
        var recentActivity = await BuildRecentActivityAsync(
            dbContext,
            tenantId,
            selectedBranch?.Id,
            cancellationToken);

        var license = await dbContext.IssuedLicenses.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.IssuedAt)
            .FirstOrDefaultAsync(cancellationToken);
        var activeDevices = await dbContext.DeviceActivations.AsNoTracking()
            .CountAsync(x => x.TenantId == tenantId && x.RevokedAt == null, cancellationToken);
        var notifications = BuildNotifications(dashboardSummary.lowStockAlerts, license, activeDevices);

        return Results.Ok(new
        {
            serverTime = DateTimeOffset.UtcNow,
            products = productRows.Select(x => new
            {
                x.id,
                x.name,
                x.sku,
                x.barcode,
                x.unit,
                x.taxRate,
                x.price,
                x.purchasePrice,
                x.minStock,
                categoryName = x.categoryId.HasValue && categories.TryGetValue(x.categoryId.Value, out var categoryName)
                    ? categoryName
                    : null,
                stockQty = stockBalances.TryGetValue(x.id, out var qty) ? qty : 0,
                x.isActive,
                x.stockTracked,
                x.serviceItem,
                x.variantEnabled,
                x.negativeStockAllowed,
                x.sellWhenOutOfStock,
                x.updatedAt
            }),
            branch = selectedBranch is null ? null : new
            {
                id = selectedBranch.Id,
                name = selectedBranch.Name,
                address = selectedBranch.Address,
                phone = selectedBranch.Phone,
                settingsJson = selectedBranch.SettingsJson
            },
            branches = branches.Select(x => new
            {
                x.Id,
                x.Name,
                x.Address,
                x.Phone,
                x.SettingsJson,
                updatedAt = x.CreatedAt
            }),
            permissions = new
            {
                roleCode = access.RoleCode,
                actions = BuildActions(access.RoleCode)
            },
            dashboardSummary = new
            {
                dashboardSummary.todaySales,
                dashboardSummary.transactionCount,
                dashboardSummary.averageBasket,
                dashboardSummary.refundTotal,
                dashboardSummary.topProducts,
                dashboardSummary.lowStockAlerts,
                dashboardSummary.paymentMethodSummary
            },
            recentActivity,
            notifications,
            license = license is null ? null : new
            {
                status = license.Status,
                planCode = license.PlanCode,
                expiresAt = license.ExpiresAt,
                graceDays = license.GraceDays,
                deviceLimit = license.DeviceLimit,
                activeDevices,
                featureFlags = ParseStringArray(license.FeaturesJson)
            },
            featureFlags = license is null ? Array.Empty<string>() : ParseStringArray(license.FeaturesJson),
            supportMessages = Array.Empty<object>()
        });
    }

    private static IResult? ValidateRequest(SyncEventRequest request)
    {
        if (request.EventId == Guid.Empty)
        {
            return Results.BadRequest(new { error = "event_id is required." });
        }

        if (request.TenantId == Guid.Empty || request.BranchId == Guid.Empty || request.DeviceId == Guid.Empty)
        {
            return Results.BadRequest(new { error = "tenant_id, branch_id and device_id are required." });
        }

        if (string.IsNullOrWhiteSpace(request.EventType))
        {
            return Results.BadRequest(new { error = "event_type is required." });
        }

        return null;
    }

    private static async Task<IResult?> ValidateSyncRequestContextAsync(
        SyncEventRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (tenantProvider.TenantId.HasValue && tenantProvider.TenantId.Value != request.TenantId)
        {
            return Results.Unauthorized();
        }

        if (tenantProvider.BranchId.HasValue && tenantProvider.BranchId.Value != request.BranchId)
        {
            return Results.Unauthorized();
        }

        if (tenantProvider.DeviceId.HasValue && tenantProvider.DeviceId.Value != request.DeviceId)
        {
            return Results.Unauthorized();
        }

        var branchBelongsToTenant = await dbContext.Branches.AsNoTracking()
            .AnyAsync(x => x.TenantId == request.TenantId && x.Id == request.BranchId, cancellationToken);
        if (!branchBelongsToTenant)
        {
            return Results.BadRequest(new { error = "branch_id is invalid for tenant context." });
        }

        var deviceActivationExists = await dbContext.DeviceActivations.AsNoTracking()
            .AnyAsync(x => x.TenantId == request.TenantId && x.DeviceId == request.DeviceId && x.RevokedAt == null, cancellationToken);
        if (!deviceActivationExists)
        {
            return Results.Unauthorized();
        }

        return null;
    }

    private static async Task<bool> AuthorizeTenantRequestAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        ITenantProvider tenantProvider,
        Guid requestedTenantId,
        CancellationToken cancellationToken)
    {
        var access = await ResolveSyncAccessAsync(httpContext, authService, tenantProvider, requestedTenantId, cancellationToken);
        return access?.TenantId == requestedTenantId;
    }

    private static async Task<PortalAccessContext?> ResolveSyncAccessAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        ITenantProvider tenantProvider,
        Guid? requestedTenantId,
        CancellationToken cancellationToken)
    {
        var access = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (access?.TenantId is Guid accessTenantId)
        {
            if (!requestedTenantId.HasValue || requestedTenantId.Value == accessTenantId)
            {
                return access;
            }
            return null;
        }

        if (httpContext.User.Identity?.IsAuthenticated == true
            && tenantProvider.TenantId.HasValue
            && (!requestedTenantId.HasValue || tenantProvider.TenantId.Value == requestedTenantId.Value))
        {
            return new PortalAccessContext(
                Guid.Empty,
                "desktop",
                "cashier",
                null,
                null,
                tenantProvider.TenantId.Value,
                "claim-sync",
                "Desktop Sync",
                null,
                null);
        }

        return null;
    }

    private static Guid? ResolveBranchId(HttpContext _, ITenantProvider tenantProvider)
    {
        return tenantProvider.BranchId;
    }

    private static bool AllowsAllBranches(string roleCode)
    {
        var normalized = roleCode.Trim().ToLowerInvariant();
        return normalized is "tenant_owner" or "tenant_admin" or "admin";
    }

    private static async Task<DashboardSnapshot> BuildDashboardSummaryAsync(
        AppDbContext dbContext,
        Guid tenantId,
        Guid? branchId,
        CancellationToken cancellationToken)
    {
        var todayStart = new DateTimeOffset(DateTime.UtcNow.Date, TimeSpan.Zero);

        var salesQuery = dbContext.Sales.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.CreatedAt >= todayStart);
        if (branchId.HasValue)
        {
            salesQuery = salesQuery.Where(x => x.BranchId == branchId.Value);
        }

        var sales = await salesQuery.ToListAsync(cancellationToken);
        var saleIds = sales.Select(x => x.Id).ToList();
        var payments = saleIds.Count == 0
            ? []
            : await dbContext.Payments.AsNoTracking()
                .Where(x => saleIds.Contains(x.SaleId))
                .ToListAsync(cancellationToken);
        var lines = saleIds.Count == 0
            ? []
            : await dbContext.SaleLines.AsNoTracking()
                .Where(x => saleIds.Contains(x.SaleId))
                .ToListAsync(cancellationToken);
        var products = await dbContext.Products.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Select(x => new { x.Id, x.Name, x.MinStock })
            .ToListAsync(cancellationToken);

        var completedSales = sales.Where(x => x.Status == LoomaPos.Domain.Common.SaleStatus.Completed).ToList();
        var refundSales = sales.Where(x => x.Status == LoomaPos.Domain.Common.SaleStatus.Refunded).ToList();

        var lowStockAlertsQuery = from balance in dbContext.StockBalances.AsNoTracking()
                                  join product in dbContext.Products.AsNoTracking() on balance.ProductId equals product.Id
                                  join branch in dbContext.Branches.AsNoTracking() on balance.BranchId equals branch.Id
                                  where balance.TenantId == tenantId &&
                                      product.StockTrackingEnabled &&
                                      balance.Qty <= product.MinStock &&
                                      (!branchId.HasValue || balance.BranchId == branchId.Value)
                                  orderby balance.Qty ascending
                                  select new
                                  {
                                      product.Id,
                                      product.Name,
                                      balance.Qty,
                                      product.MinStock,
                                      BranchName = branch.Name
                                  };
        var lowStockAlerts = await lowStockAlertsQuery.Take(8).ToListAsync(cancellationToken);

        var topProducts = lines
            .GroupBy(line => line.ProductId)
            .Select(group =>
            {
                var product = products.FirstOrDefault(x => x.Id == group.Key);
                return new
                {
                    productId = group.Key,
                    productName = product?.Name ?? "-",
                    quantity = group.Sum(x => x.Qty),
                    revenue = group.Sum(x => x.LineTotal)
                };
            })
            .OrderByDescending(x => x.quantity)
            .Take(5)
            .ToList();

        var paymentMethodSummary = payments
            .GroupBy(x => x.Method.ToString().ToLowerInvariant())
            .ToDictionary(group => group.Key, group => group.Sum(x => x.Amount));

        return new DashboardSnapshot(
            completedSales.Sum(x => x.Total),
            completedSales.Count,
            completedSales.Count == 0 ? 0 : completedSales.Average(x => x.Total),
            refundSales.Sum(x => x.Total),
            topProducts.Select(x => new TopProductSnapshot(x.productId, x.productName, x.quantity, x.revenue)).ToList(),
            lowStockAlerts.Select(x => new
            {
                productId = x.Id,
                productName = x.Name,
                qty = x.Qty,
                minStock = x.MinStock,
                branchName = x.BranchName
            }).Select(x => new LowStockSnapshot(x.productId, x.productName, x.qty, x.minStock, x.branchName)).ToList(),
            paymentMethodSummary);
    }

    private static async Task<IReadOnlyList<ActivitySnapshot>> BuildRecentActivityAsync(
        AppDbContext dbContext,
        Guid tenantId,
        Guid? branchId,
        CancellationToken cancellationToken)
    {
        var salesQuery = dbContext.Sales.AsNoTracking()
            .Where(x => x.TenantId == tenantId);
        if (branchId.HasValue)
        {
            salesQuery = salesQuery.Where(x => x.BranchId == branchId.Value);
        }

        var sales = await salesQuery
            .OrderByDescending(x => x.CreatedAt)
            .Take(10)
            .ToListAsync(cancellationToken);

        var auditsQuery = dbContext.AuditLogs.AsNoTracking()
            .Where(x => x.TenantId == tenantId);
        var audits = await auditsQuery
            .OrderByDescending(x => x.CreatedAt)
            .Take(10)
            .ToListAsync(cancellationToken);

        var saleItems = sales.Select(x => new ActivitySnapshot(
            x.Id.ToString(),
            x.Status == LoomaPos.Domain.Common.SaleStatus.Refunded ? "refund" : "sale",
            x.Status == LoomaPos.Domain.Common.SaleStatus.Refunded ? $"Iade {x.ReceiptNo}" : $"Satis {x.ReceiptNo}",
            x.Status.ToString(),
            null,
            null,
            x.Total,
            null,
            x.CreatedAt,
            "synced"));

        var auditItems = audits.Select(x => new ActivitySnapshot(
            x.Id.ToString(),
            x.Action.ToLowerInvariant(),
            x.Action.Replace("_", " "),
            x.Entity,
            null,
            null,
            null,
            null,
            x.CreatedAt,
            "synced"));

        return saleItems
            .Concat(auditItems)
            .OrderByDescending(item => item.createdAt)
            .Take(20)
            .ToList();
    }

    private static IReadOnlyList<NotificationSnapshot> BuildNotifications(
        IReadOnlyList<LowStockSnapshot> lowStockAlerts,
        object? license,
        int activeDevices)
    {
        var notifications = new List<NotificationSnapshot>();
        notifications.AddRange(
            lowStockAlerts.Take(3).Select((item, index) => new
            NotificationSnapshot(
                $"low-stock-{index}",
                "low_stock",
                "Low stock alert",
                $"{item.productName} qty {item.qty} / min {item.minStock}",
                "/stock-count",
                false,
                DateTimeOffset.UtcNow)));

        if (license is LoomaPos.Domain.Commerce.IssuedLicense issuedLicense &&
            issuedLicense.ExpiresAt <= DateTimeOffset.UtcNow.AddDays(7))
        {
            notifications.Add(new NotificationSnapshot(
                "license-warning",
                "license_warning",
                "License warning",
                $"License expires at {issuedLicense.ExpiresAt:yyyy-MM-dd}. Active devices: {activeDevices}.",
                "/settings",
                false,
                DateTimeOffset.UtcNow));
        }

        return notifications;
    }

    private static IReadOnlyList<string> BuildActions(string roleCode)
    {
        var normalized = roleCode.Trim().ToLowerInvariant();
        return normalized switch
        {
            "tenant_owner" or "tenant_admin" or "admin" => new[]
            {
                "sale.complete",
                "refund.create",
                "void.sale",
                "cash.adjust",
                "shift.close",
                "settings.access",
                "reprint.receipt",
                "dashboard.view",
                "dashboard.view.all_branches",
                "recent_sales.view",
                "reports.summary.view",
                "product.lookup",
                "product.create",
                "product.edit",
                "branch.switch",
                "stock_count.create",
                "stock_count.submit",
                "stock.adjust"
            },
            "branch_manager" => new[]
            {
                "sale.complete",
                "refund.create",
                "cash.adjust",
                "shift.close",
                "settings.access",
                "dashboard.view",
                "recent_sales.view",
                "reports.summary.view",
                "product.lookup",
                "product.edit",
                "branch.switch",
                "stock_count.create",
                "stock_count.submit",
                "stock.adjust"
            },
            "stock_staff" => new[]
            {
                "product.lookup",
                "stock_count.create",
                "stock_count.submit",
                "stock.adjust"
            },
            _ => new[]
            {
                "sale.complete",
                "product.lookup",
                "stock_count.create"
            }
        };
    }

    private static IReadOnlyList<string> ParseStringArray(string json)
    {
        try
        {
            var parsed = JsonSerializer.Deserialize<List<string>>(json);
            return parsed ?? [];
        }
        catch
        {
            return [];
        }
    }
}

public sealed record SyncEventBatchRequest(IReadOnlyList<SyncEventRequest> Events);

internal sealed record DashboardSnapshot(
    decimal todaySales,
    int transactionCount,
    decimal averageBasket,
    decimal refundTotal,
    IReadOnlyList<TopProductSnapshot> topProducts,
    IReadOnlyList<LowStockSnapshot> lowStockAlerts,
    IReadOnlyDictionary<string, decimal> paymentMethodSummary);

internal sealed record TopProductSnapshot(
    Guid productId,
    string productName,
    decimal quantity,
    decimal revenue);

internal sealed record LowStockSnapshot(
    Guid productId,
    string productName,
    decimal qty,
    decimal minStock,
    string branchName);

internal sealed record ActivitySnapshot(
    string id,
    string type,
    string title,
    string subtitle,
    string? branchName,
    string? actorName,
    decimal? amount,
    decimal? qtyImpact,
    DateTimeOffset createdAt,
    string syncState);

internal sealed record NotificationSnapshot(
    string id,
    string category,
    string title,
    string body,
    string? targetRoute,
    bool isRead,
    DateTimeOffset createdAt);
