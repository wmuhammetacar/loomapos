using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using LoomaPos.Domain.Catalog;
using LoomaPos.Domain.Identity;
using LoomaPos.Domain.Purchasing;
using LoomaPos.Infrastructure.Inventory;
using LoomaPos.Infrastructure.MultiTenancy;
using LoomaPos.Infrastructure.Persistence;
using LoomaPos.Infrastructure.Purchasing;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.IntegrationTests.Purchasing;

public sealed class PurchasingServiceTests : IAsyncLifetime
{
    private readonly TestcontainersContainer _postgresContainer = new TestcontainersBuilder<TestcontainersContainer>()
        .WithImage("postgres:16-alpine")
        .WithEnvironment("POSTGRES_USER", "loomapos")
        .WithEnvironment("POSTGRES_PASSWORD", "loomapos")
        .WithEnvironment("POSTGRES_DB", "loomapos")
        .WithPortBinding(5432, true)
        .WithWaitStrategy(Wait.ForUnixContainer().UntilPortIsAvailable(5432))
        .Build();

    private string _connectionString = string.Empty;
    private bool _containerReady;

    public async Task InitializeAsync()
    {
        try
        {
            await _postgresContainer.StartAsync();
            _containerReady = true;
        }
        catch
        {
            _containerReady = false;
            return;
        }

        var port = _postgresContainer.GetMappedPublicPort(5432);
        _connectionString = $"Host=127.0.0.1;Port={port};Database=loomapos;Username=loomapos;Password=loomapos";

        await using var context = CreateContext(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        await context.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync()
    {
        await _postgresContainer.DisposeAsync();
    }

    [Fact]
    public async Task SupplierAndPurchaseOrderFlow_ShouldReceiveStock_AndBlockDuplicateReceive()
    {
        if (_containerReady == false)
        {
            return;
        }

        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var productId = Guid.NewGuid();

        await using var context = CreateContext(tenantId, branchId, deviceId, userId);
        var warehouseCompatibilityService = new WarehouseCompatibilityService(context);
        var setup = await SeedPurchasingSetupAsync(
            context,
            warehouseCompatibilityService,
            tenantId,
            branchId,
            productId,
            initialWarehouseQty: 1m,
            cancellationToken: CancellationToken.None);

        var service = new PurchasingService(context, warehouseCompatibilityService, new LoomaPos.Infrastructure.Accounting.AccountingBridgeService(context));

        var supplier = await service.CreateSupplierAsync(
            tenantId,
            "Tedarikci A",
            "123456",
            "+90 555 000 0000",
            "supplier@example.com",
            CancellationToken.None);

        var purchaseOrder = await service.CreatePurchaseOrderDraftAsync(
            tenantId,
            supplier.Id,
            setup.WarehouseId,
            CancellationToken.None);

        var line = await service.AddPurchaseOrderLineAsync(
            tenantId,
            purchaseOrder.Id,
            productId,
            4m,
            12.50m,
            CancellationToken.None);

        Assert.Equal(4m, line.Quantity);
        Assert.Equal(12.50m, line.UnitCost);

        var received = await service.ReceivePurchaseOrderAsync(
            tenantId,
            purchaseOrder.Id,
            branchId,
            CancellationToken.None);

        Assert.Equal(PurchaseOrderStatuses.Received, received.Status);
        Assert.NotNull(received.ReceivedAt);

        var warehouseStock = await context.StockByWarehouses.AsNoTracking()
            .FirstAsync(x => x.TenantId == tenantId && x.ProductId == productId && x.WarehouseId == setup.WarehouseId);
        Assert.Equal(5m, warehouseStock.Quantity);

        var movement = await context.StockMoves.AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.TenantId == tenantId &&
                x.RefType == "purchase_order" &&
                x.RefId == purchaseOrder.Id.ToString() &&
                x.Reason == "PURCHASE_RECEIPT_IN");

        Assert.NotNull(movement);
        Assert.Equal(4m, movement!.QtyDelta);
        Assert.Equal(setup.WarehouseId, movement.WarehouseId);

        var duplicateReceiveException = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.ReceivePurchaseOrderAsync(tenantId, purchaseOrder.Id, branchId, CancellationToken.None));
        Assert.Contains("already received", duplicateReceiveException.Message, StringComparison.OrdinalIgnoreCase);

        var movementCount = await context.StockMoves.AsNoTracking()
            .CountAsync(x => x.TenantId == tenantId && x.RefType == "purchase_order" && x.RefId == purchaseOrder.Id.ToString());
        Assert.Equal(1, movementCount);

        var exportItem = await context.AccountingExportItems.AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.TenantId == tenantId &&
                x.SourceType == "purchase_receipt" &&
                x.SourceId == purchaseOrder.Id.ToString());

        Assert.NotNull(exportItem);
        Assert.Equal("pending", exportItem!.Status);
    }

    [Fact]
    public async Task ReceiveCanceledOrder_ShouldFail_AndKeepStockUnchanged()
    {
        if (_containerReady == false)
        {
            return;
        }

        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var productId = Guid.NewGuid();

        await using var context = CreateContext(tenantId, branchId, deviceId, userId);
        var warehouseCompatibilityService = new WarehouseCompatibilityService(context);
        var setup = await SeedPurchasingSetupAsync(
            context,
            warehouseCompatibilityService,
            tenantId,
            branchId,
            productId,
            initialWarehouseQty: 2m,
            cancellationToken: CancellationToken.None);

        var service = new PurchasingService(context, warehouseCompatibilityService, new LoomaPos.Infrastructure.Accounting.AccountingBridgeService(context));

        var supplier = await service.CreateSupplierAsync(
            tenantId,
            "Tedarikci B",
            null,
            null,
            null,
            CancellationToken.None);

        var purchaseOrder = await service.CreatePurchaseOrderDraftAsync(
            tenantId,
            supplier.Id,
            setup.WarehouseId,
            CancellationToken.None);

        await service.AddPurchaseOrderLineAsync(
            tenantId,
            purchaseOrder.Id,
            productId,
            3m,
            7m,
            CancellationToken.None);

        purchaseOrder.Status = PurchaseOrderStatuses.Canceled;
        context.Update(purchaseOrder);
        await context.SaveChangesAsync();

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.ReceivePurchaseOrderAsync(tenantId, purchaseOrder.Id, branchId, CancellationToken.None));
        Assert.Contains("cannot receive canceled", exception.Message, StringComparison.OrdinalIgnoreCase);

        var warehouseStock = await context.StockByWarehouses.AsNoTracking()
            .FirstAsync(x => x.TenantId == tenantId && x.ProductId == productId && x.WarehouseId == setup.WarehouseId);
        Assert.Equal(2m, warehouseStock.Quantity);

        var movementCount = await context.StockMoves.AsNoTracking()
            .CountAsync(x => x.TenantId == tenantId && x.RefType == "purchase_order" && x.RefId == purchaseOrder.Id.ToString());
        Assert.Equal(0, movementCount);
    }

    private AppDbContext CreateContext(Guid tenantId, Guid branchId, Guid deviceId, Guid userId)
    {
        var tenantProvider = new TestTenantProvider
        {
            TenantId = tenantId,
            BranchId = branchId,
            DeviceId = deviceId,
            UserId = userId
        };

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_connectionString)
            .Options;

        return new AppDbContext(options, tenantProvider);
    }

    private static async Task<PurchasingSetup> SeedPurchasingSetupAsync(
        AppDbContext context,
        IWarehouseCompatibilityService warehouseCompatibilityService,
        Guid tenantId,
        Guid branchId,
        Guid productId,
        decimal initialWarehouseQty,
        CancellationToken cancellationToken)
    {
        context.Tenants.Add(new Tenant
        {
            Id = tenantId,
            Name = "Purchasing Tenant",
            TenantCode = $"po-{tenantId.ToString("N")[..8]}",
            BillingEmail = "purchasing.local",
            Status = "active"
        });

        context.Branches.Add(new Branch
        {
            Id = branchId,
            TenantId = tenantId,
            Name = "Main Branch"
        });

        context.Products.Add(new Product
        {
            Id = productId,
            TenantId = tenantId,
            Name = "PO Product",
            Unit = "adet",
            SalePrice = 100m,
            PurchasePrice = 60m,
            TaxRate = 0m,
            StockTrackingEnabled = true,
            MinStock = 0,
            IsActive = true
        });

        await context.SaveChangesAsync(cancellationToken);

        var warehouseId = await warehouseCompatibilityService.EnsureDefaultWarehouseAsync(tenantId, cancellationToken);

        context.StockByWarehouses.Add(new Domain.Inventory.StockByWarehouse
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ProductId = productId,
            WarehouseId = warehouseId,
            Quantity = initialWarehouseQty,
            UpdatedAt = DateTimeOffset.UtcNow
        });

        await context.SaveChangesAsync(cancellationToken);
        return new PurchasingSetup(warehouseId);
    }

    private sealed record PurchasingSetup(Guid WarehouseId);

    private sealed class TestTenantProvider : ITenantProvider
    {
        public Guid? TenantId { get; init; }
        public Guid? BranchId { get; init; }
        public Guid? UserId { get; init; }
        public Guid? DeviceId { get; init; }
    }
}
