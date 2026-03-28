using LoomaPos.Api.Common;
using LoomaPos.Api.Commerce;
using LoomaPos.Domain.Catalog;
using LoomaPos.Domain.Inventory;
using LoomaPos.Infrastructure.MultiTenancy;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class CatalogEndpoints
{
    public static RouteGroupBuilder MapCatalogEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/products", GetProductsAsync)
            .WithName("GetProducts")
            .WithSummary("Gets products with optional search and barcode filters.");

        group.MapPost("/products", CreateProductAsync)
            .WithName("CreateProduct")
            .WithSummary("Creates a new product.");

        group.MapPatch("/products/{id:guid}", UpdateProductAsync)
            .WithName("UpdateProduct")
            .WithSummary("Updates product fields.");

        group.MapGet("/products/{productId:guid}/variants", GetProductVariantsAsync)
            .WithName("GetProductVariants")
            .WithSummary("Gets variants for the product.");

        group.MapPost("/products/{productId:guid}/variants", CreateProductVariantAsync)
            .WithName("CreateProductVariant")
            .WithSummary("Creates product variant with optional variant-level barcode.");

        group.MapGet("/categories", GetCategoriesAsync)
            .WithName("GetCategories")
            .WithSummary("Gets categories for the tenant.");

        group.MapPost("/categories", CreateCategoryAsync)
            .WithName("CreateCategory")
            .WithSummary("Creates category for the tenant.");

        return group;
    }

    private static async Task<IResult> GetProductsAsync(
        string? search,
        string? barcode,
        bool? is_active,
        Guid? branch_id,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Products.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x =>
                x.Name.Contains(term) ||
                (x.Sku != null && x.Sku.Contains(term)) ||
                (x.Barcode != null && x.Barcode.Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(barcode))
        {
            query = query.Where(x => x.Barcode == barcode.Trim());
        }

        if (is_active.HasValue)
        {
            query = query.Where(x => x.IsActive == is_active.Value);
        }

        var branchId = branch_id ?? tenantProvider.BranchId;
        var stockByProduct = branchId.HasValue
            ? await dbContext.StockBalances.AsNoTracking()
                .Where(x => x.BranchId == branchId.Value)
                .ToDictionaryAsync(x => x.ProductId, x => x.Qty, cancellationToken)
            : new Dictionary<Guid, decimal>();

        var categories = await dbContext.Categories.AsNoTracking()
            .Select(x => new { x.Id, x.Name })
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        var products = await query
            .OrderBy(x => x.Name)
            .Take(500)
            .Select(x => new ProductResponse(
                x.Id,
                x.Name,
                x.CategoryId,
                x.Sku,
                x.Barcode,
                x.Unit,
                x.SalePrice,
                x.PurchasePrice,
                x.TaxRate,
                x.StockTrackingEnabled,
                x.MinStock,
                x.IsActive,
                0,
                null))
            .ToListAsync(cancellationToken);

        var rows = products.Select(x => x with
        {
            StockQty = x.StockTrackingEnabled
                ? stockByProduct.GetValueOrDefault(x.Id, 0)
                : 0,
            CategoryName = x.CategoryId.HasValue
                ? categories.GetValueOrDefault(x.CategoryId.Value)
                : null
        }).ToList();

        return Results.Ok(rows);
    }

    private static async Task<IResult> UpdateProductAsync(
        Guid id,
        UpdateProductRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var product = await dbContext.Products.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (product is null)
        {
            return Results.NotFound();
        }

        var lifecycleWriteBlock = await EnsureLifecycleWriteAllowedAsync(product.TenantId, dbContext, cancellationToken);
        if (lifecycleWriteBlock is not null)
        {
            return lifecycleWriteBlock;
        }

        if (request.CategoryId.HasValue)
        {
            var categoryExists = await dbContext.Categories.AsNoTracking()
                .AnyAsync(x => x.Id == request.CategoryId.Value, cancellationToken);
            if (!categoryExists)
            {
                return Results.BadRequest(new { error = "Category not found." });
            }
        }

        if (!string.IsNullOrWhiteSpace(request.Barcode))
        {
            var normalizedBarcode = request.Barcode.Trim();
            var barcodeExists = await dbContext.Products.AsNoTracking()
                .AnyAsync(x => x.Id != id && x.Barcode == normalizedBarcode, cancellationToken);
            if (barcodeExists)
            {
                return Results.BadRequest(new { error = "Barcode must be unique." });
            }

            product.Barcode = normalizedBarcode;
        }

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            product.Name = request.Name.Trim();
        }

        if (request.SalePrice.HasValue)
        {
            if (request.SalePrice.Value <= 0)
            {
                return Results.BadRequest(new { error = "Sale price must be greater than zero." });
            }

            product.SalePrice = request.SalePrice.Value;
        }

        if (request.PurchasePrice.HasValue)
        {
            product.PurchasePrice = Math.Max(0, request.PurchasePrice.Value);
        }

        if (request.TaxRate.HasValue)
        {
            product.TaxRate = Math.Max(0, request.TaxRate.Value);
        }

        if (request.StockTrackingEnabled.HasValue)
        {
            product.StockTrackingEnabled = request.StockTrackingEnabled.Value;
        }

        if (request.MinStock.HasValue)
        {
            product.MinStock = Math.Max(0, request.MinStock.Value);
        }

        if (request.IsActive.HasValue)
        {
            product.IsActive = request.IsActive.Value;
        }

        if (request.CategoryId.HasValue)
        {
            product.CategoryId = request.CategoryId;
        }

        if (request.Sku is not null)
        {
            product.Sku = string.IsNullOrWhiteSpace(request.Sku) ? null : request.Sku.Trim();
        }

        if (request.Unit is not null)
        {
            product.Unit = string.IsNullOrWhiteSpace(request.Unit) ? "adet" : request.Unit.Trim();
        }

        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            product.TenantId,
            "PRODUCT_UPDATED",
            "products",
            product.Id.ToString(),
            request);

        await dbContext.SaveChangesAsync(cancellationToken);

        var categoryName = product.CategoryId.HasValue
            ? await dbContext.Categories.AsNoTracking()
                .Where(x => x.Id == product.CategoryId.Value)
                .Select(x => x.Name)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        return Results.Ok(new ProductResponse(
            product.Id,
            product.Name,
            product.CategoryId,
            product.Sku,
            product.Barcode,
            product.Unit,
            product.SalePrice,
            product.PurchasePrice,
            product.TaxRate,
            product.StockTrackingEnabled,
            product.MinStock,
            product.IsActive,
            0,
            categoryName));
    }

    private static async Task<IResult> CreateProductAsync(
        CreateProductRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId ?? request.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.BadRequest(new { error = "Tenant context is required." });
        }

        var lifecycleWriteBlock = await EnsureLifecycleWriteAllowedAsync(tenantId.Value, dbContext, cancellationToken);
        if (lifecycleWriteBlock is not null)
        {
            return lifecycleWriteBlock;
        }

        var normalizedName = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedName))
        {
            return Results.BadRequest(new { error = "Product name is required." });
        }

        if (request.SalePrice <= 0)
        {
            return Results.BadRequest(new { error = "Sale price must be greater than zero." });
        }

        if (request.CategoryId.HasValue)
        {
            var categoryExists = await dbContext.Categories.AsNoTracking()
                .AnyAsync(x => x.Id == request.CategoryId.Value && x.TenantId == tenantId.Value, cancellationToken);
            if (!categoryExists)
            {
                return Results.BadRequest(new { error = "Category not found." });
            }
        }

        var normalizedBarcode = string.IsNullOrWhiteSpace(request.Barcode) ? null : request.Barcode.Trim();
        if (!string.IsNullOrWhiteSpace(normalizedBarcode))
        {
            var barcodeExists = await dbContext.Products.AsNoTracking()
                .AnyAsync(x => x.Barcode == normalizedBarcode, cancellationToken);
            if (barcodeExists)
            {
                return Results.BadRequest(new { error = "Barcode must be unique." });
            }
        }

        var product = new Product
        {
            TenantId = tenantId.Value,
            Name = normalizedName,
            CategoryId = request.CategoryId,
            Sku = string.IsNullOrWhiteSpace(request.Sku) ? null : request.Sku.Trim(),
            Barcode = normalizedBarcode,
            Unit = string.IsNullOrWhiteSpace(request.Unit) ? "adet" : request.Unit.Trim(),
            SalePrice = request.SalePrice,
            PurchasePrice = Math.Max(0, request.PurchasePrice),
            TaxRate = Math.Max(0, request.TaxRate),
            StockTrackingEnabled = request.StockTrackingEnabled,
            MinStock = request.StockTrackingEnabled ? Math.Max(0, request.MinStock) : 0,
            IsActive = request.IsActive
        };

        dbContext.Products.Add(product);

        var normalizedOpeningStock = request.StockTrackingEnabled ? request.OpeningStock : 0;
        var branchId = request.BranchId ?? tenantProvider.BranchId;
        if (normalizedOpeningStock != 0)
        {
            if (!branchId.HasValue)
            {
                return Results.BadRequest(new { error = "branch_id is required when opening_stock is used." });
            }

            dbContext.StockMoves.Add(new StockMove
            {
                TenantId = tenantId.Value,
                BranchId = branchId.Value,
                ProductId = product.Id,
                QtyDelta = normalizedOpeningStock,
                Reason = "OPENING_STOCK",
                RefType = "product_opening",
                RefId = product.Id.ToString()
            });

            var currentBalance = await dbContext.StockBalances
                .FirstOrDefaultAsync(x => x.TenantId == tenantId.Value && x.BranchId == branchId.Value && x.ProductId == product.Id, cancellationToken);

            if (currentBalance is null)
            {
                dbContext.StockBalances.Add(new StockBalance
                {
                    TenantId = tenantId.Value,
                    BranchId = branchId.Value,
                    ProductId = product.Id,
                    Qty = normalizedOpeningStock
                });
            }
            else
            {
                currentBalance.Qty += normalizedOpeningStock;
            }
        }

        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            tenantId.Value,
            "PRODUCT_CREATED",
            "products",
            product.Id.ToString(),
            request);

        await dbContext.SaveChangesAsync(cancellationToken);

        string? categoryName = null;
        if (product.CategoryId.HasValue)
        {
            categoryName = await dbContext.Categories.AsNoTracking()
                .Where(x => x.Id == product.CategoryId.Value)
                .Select(x => x.Name)
                .FirstOrDefaultAsync(cancellationToken);
        }

        return Results.Created($"/products/{product.Id}", new ProductResponse(
            product.Id,
            product.Name,
            product.CategoryId,
            product.Sku,
            product.Barcode,
            product.Unit,
            product.SalePrice,
            product.PurchasePrice,
            product.TaxRate,
            product.StockTrackingEnabled,
            product.MinStock,
            product.IsActive,
            normalizedOpeningStock,
            categoryName));
    }

    private static async Task<IResult> GetCategoriesAsync(
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var categories = await dbContext.Categories.AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new CategoryResponse(x.Id, x.Name, x.ParentId))
            .ToListAsync(cancellationToken);

        return Results.Ok(categories);
    }

    private static async Task<IResult> CreateCategoryAsync(
        CreateCategoryRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantProvider.TenantId ?? request.TenantId;
        if (!tenantId.HasValue)
        {
            return Results.BadRequest(new { error = "Tenant context is required." });
        }

        var lifecycleWriteBlock = await EnsureLifecycleWriteAllowedAsync(tenantId.Value, dbContext, cancellationToken);
        if (lifecycleWriteBlock is not null)
        {
            return lifecycleWriteBlock;
        }

        var normalizedName = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedName))
        {
            return Results.BadRequest(new { error = "Category name is required." });
        }

        if (request.ParentId.HasValue)
        {
            var parentExists = await dbContext.Categories.AsNoTracking()
                .AnyAsync(x => x.Id == request.ParentId.Value && x.TenantId == tenantId.Value, cancellationToken);
            if (!parentExists)
            {
                return Results.BadRequest(new { error = "Parent category not found." });
            }
        }

        var category = new Category
        {
            TenantId = tenantId.Value,
            Name = normalizedName,
            ParentId = request.ParentId
        };

        dbContext.Categories.Add(category);
        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            tenantId.Value,
            "CATEGORY_CREATED",
            "categories",
            category.Id.ToString(),
            request);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Created($"/categories/{category.Id}", new CategoryResponse(category.Id, category.Name, category.ParentId));
    }

    private static async Task<IResult> GetProductVariantsAsync(
        Guid productId,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var productExists = await dbContext.Products.AsNoTracking().AnyAsync(x => x.Id == productId, cancellationToken);
        if (!productExists)
        {
            return Results.NotFound();
        }

        var rows = await dbContext.ProductVariants.AsNoTracking()
            .Where(x => x.ProductId == productId)
            .OrderBy(x => x.Name)
            .Select(x => new ProductVariantResponse(
                x.Id,
                x.ProductId,
                x.Name,
                x.Sku,
                x.Barcode,
                x.AttributesJson,
                x.PriceDelta,
                x.StockTrackingEnabled,
                x.IsActive))
            .ToListAsync(cancellationToken);

        return Results.Ok(rows);
    }

    private static async Task<IResult> CreateProductVariantAsync(
        Guid productId,
        CreateProductVariantRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var product = await dbContext.Products.FirstOrDefaultAsync(x => x.Id == productId, cancellationToken);
        if (product is null)
        {
            return Results.NotFound();
        }

        var lifecycleWriteBlock = await EnsureLifecycleWriteAllowedAsync(product.TenantId, dbContext, cancellationToken);
        if (lifecycleWriteBlock is not null)
        {
            return lifecycleWriteBlock;
        }

        var normalizedName = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedName))
        {
            return Results.BadRequest(new { error = "Variant name is required." });
        }

        var normalizedBarcode = string.IsNullOrWhiteSpace(request.Barcode) ? null : request.Barcode.Trim();
        if (!string.IsNullOrWhiteSpace(normalizedBarcode))
        {
            var productBarcodeExists = await dbContext.Products.AsNoTracking()
                .AnyAsync(x => x.Barcode == normalizedBarcode, cancellationToken);
            if (productBarcodeExists)
            {
                return Results.BadRequest(new { error = "Barcode already used by another product." });
            }

            var variantBarcodeExists = await dbContext.ProductVariants.AsNoTracking()
                .AnyAsync(x => x.Barcode == normalizedBarcode, cancellationToken);
            if (variantBarcodeExists)
            {
                return Results.BadRequest(new { error = "Barcode already used by another variant." });
            }
        }

        var variant = new ProductVariant
        {
            TenantId = product.TenantId,
            ProductId = productId,
            Name = normalizedName,
            Sku = string.IsNullOrWhiteSpace(request.Sku) ? null : request.Sku.Trim(),
            Barcode = normalizedBarcode,
            AttributesJson = string.IsNullOrWhiteSpace(request.AttributesJson) ? "{}" : request.AttributesJson.Trim(),
            PriceDelta = request.PriceDelta,
            StockTrackingEnabled = request.StockTrackingEnabled,
            IsActive = request.IsActive
        };

        dbContext.ProductVariants.Add(variant);
        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            product.TenantId,
            "PRODUCT_VARIANT_CREATED",
            "product_variants",
            variant.Id.ToString(),
            request);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Created(
            $"/products/{productId}/variants/{variant.Id}",
            new ProductVariantResponse(
                variant.Id,
                variant.ProductId,
                variant.Name,
                variant.Sku,
                variant.Barcode,
                variant.AttributesJson,
                variant.PriceDelta,
                variant.StockTrackingEnabled,
                variant.IsActive));
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

    public sealed record CreateProductRequest(
        Guid? TenantId,
        Guid? BranchId,
        string Name,
        Guid? CategoryId,
        string? Sku,
        string? Barcode,
        string Unit,
        decimal SalePrice,
        decimal PurchasePrice,
        decimal TaxRate,
        bool StockTrackingEnabled,
        decimal MinStock,
        decimal OpeningStock,
        bool IsActive);

    public sealed record UpdateProductRequest(
        string? Name,
        Guid? CategoryId,
        string? Sku,
        string? Barcode,
        string? Unit,
        decimal? SalePrice,
        decimal? PurchasePrice,
        decimal? TaxRate,
        bool? StockTrackingEnabled,
        decimal? MinStock,
        bool? IsActive);

    public sealed record ProductResponse(
        Guid Id,
        string Name,
        Guid? CategoryId,
        string? Sku,
        string? Barcode,
        string Unit,
        decimal SalePrice,
        decimal PurchasePrice,
        decimal TaxRate,
        bool StockTrackingEnabled,
        decimal MinStock,
        bool IsActive,
        decimal StockQty,
        string? CategoryName);

    public sealed record CreateProductVariantRequest(
        string Name,
        string? Sku,
        string? Barcode,
        string? AttributesJson,
        decimal PriceDelta,
        bool StockTrackingEnabled,
        bool IsActive);

    public sealed record ProductVariantResponse(
        Guid Id,
        Guid ProductId,
        string Name,
        string? Sku,
        string? Barcode,
        string AttributesJson,
        decimal PriceDelta,
        bool StockTrackingEnabled,
        bool IsActive);

    public sealed record CategoryResponse(Guid Id, string Name, Guid? ParentId);
    public sealed record CreateCategoryRequest(Guid? TenantId, string Name, Guid? ParentId);
}
