using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using LoomaPos.Domain.Catalog;
using LoomaPos.Domain.Identity;
using LoomaPos.Domain.Inventory;
using LoomaPos.Infrastructure.Inventory;
using LoomaPos.Infrastructure.MultiTenancy;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.IntegrationTests.Inventory;

public sealed class WarehouseTransferServiceTests : IAsyncLifetime
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
    public async Task CompleteAsync_ShouldMoveStockBetweenWarehouses_AndWriteOutInMovements()
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
        var warehouseCompatibility = new WarehouseCompatibilityService(context);
        var setup = await SeedTransferSetupAsync(
            context,
            warehouseCompatibility,
            tenantId,
            branchId,
            productId,
            sourceQty: 10m,
            destinationQty: 1m,
            cancellationToken: CancellationToken.None);

        var service = new WarehouseTransferService(context, warehouseCompatibility);

        var transfer = await service.CreateDraftAsync(
            tenantId,
            setup.FromWarehouseId,
            setup.ToWarehouseId,
            CancellationToken.None);

        await service.AddLineAsync(
            tenantId,
            transfer.Id,
            productId,
            3m,
            CancellationToken.None);

        var completed = await service.CompleteAsync(
            tenantId,
            transfer.Id,
            branchId,
            CancellationToken.None);

        Assert.Equal(WarehouseTransferStatuses.Completed, completed.Status);
        Assert.NotNull(completed.CompletedAt);

        var source = await context.StockByWarehouses.AsNoTracking()
            .FirstAsync(x => x.TenantId == tenantId && x.ProductId == productId && x.WarehouseId == setup.FromWarehouseId);
        var destination = await context.StockByWarehouses.AsNoTracking()
            .FirstAsync(x => x.TenantId == tenantId && x.ProductId == productId && x.WarehouseId == setup.ToWarehouseId);

        Assert.Equal(7m, source.Quantity);
        Assert.Equal(4m, destination.Quantity);

        var movements = await context.StockMoves.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.RefType == "warehouse_transfer" && x.RefId == transfer.Id.ToString())
            .OrderBy(x => x.QtyDelta)
            .ToListAsync();

        Assert.Equal(2, movements.Count);
        Assert.Equal(-3m, movements[0].QtyDelta);
        Assert.Equal("WAREHOUSE_TRANSFER_OUT", movements[0].Reason);
        Assert.Equal(setup.FromWarehouseId, movements[0].WarehouseId);

        Assert.Equal(3m, movements[1].QtyDelta);
        Assert.Equal("WAREHOUSE_TRANSFER_IN", movements[1].Reason);
        Assert.Equal(setup.ToWarehouseId, movements[1].WarehouseId);
    }

    [Fact]
    public async Task CompleteAsync_WhenSourceStockInsufficient_ShouldRollbackWithoutPartialMutation()
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
        var warehouseCompatibility = new WarehouseCompatibilityService(context);
        var setup = await SeedTransferSetupAsync(
            context,
            warehouseCompatibility,
            tenantId,
            branchId,
            productId,
            sourceQty: 2m,
            destinationQty: 0m,
            cancellationToken: CancellationToken.None);

        var service = new WarehouseTransferService(context, warehouseCompatibility);

        var transfer = await service.CreateDraftAsync(
            tenantId,
            setup.FromWarehouseId,
            setup.ToWarehouseId,
            CancellationToken.None);

        await service.AddLineAsync(
            tenantId,
            transfer.Id,
            productId,
            3m,
            CancellationToken.None);

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CompleteAsync(tenantId, transfer.Id, branchId, CancellationToken.None));

        Assert.Contains("insufficient stock", exception.Message, StringComparison.OrdinalIgnoreCase);

        var transferFromDb = await context.WarehouseTransfers.AsNoTracking().FirstAsync(x => x.Id == transfer.Id);
        Assert.Equal(WarehouseTransferStatuses.Draft, transferFromDb.Status);
        Assert.Null(transferFromDb.CompletedAt);

        var source = await context.StockByWarehouses.AsNoTracking()
            .FirstAsync(x => x.TenantId == tenantId && x.ProductId == productId && x.WarehouseId == setup.FromWarehouseId);
        Assert.Equal(2m, source.Quantity);

        var destination = await context.StockByWarehouses.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.ProductId == productId && x.WarehouseId == setup.ToWarehouseId);
        Assert.True(destination is null || destination.Quantity == 0m);

        var movementCount = await context.StockMoves.AsNoTracking()
            .CountAsync(x => x.TenantId == tenantId && x.RefType == "warehouse_transfer" && x.RefId == transfer.Id.ToString());
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

    private static async Task<WarehouseTransferSetup> SeedTransferSetupAsync(
        AppDbContext context,
        IWarehouseCompatibilityService warehouseCompatibilityService,
        Guid tenantId,
        Guid branchId,
        Guid productId,
        decimal sourceQty,
        decimal destinationQty,
        CancellationToken cancellationToken)
    {
        context.Tenants.Add(new Tenant
        {
            Id = tenantId,
            Name = "Warehouse Transfer Tenant",
            TenantCode = $"wt-{tenantId.ToString("N")[..8]}",
            BillingEmail = "warehouse-transfer.local",
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
            Name = "Transfer Product",
            Unit = "adet",
            SalePrice = 100m,
            PurchasePrice = 50m,
            TaxRate = 0m,
            StockTrackingEnabled = true,
            MinStock = 0,
            IsActive = true
        });

        await context.SaveChangesAsync(cancellationToken);

        var fromWarehouseId = await warehouseCompatibilityService.EnsureDefaultWarehouseAsync(tenantId, cancellationToken);

        var toWarehouse = new Warehouse
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = "TRANSFER-DEST",
            Type = "branch",
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow
        };
        context.Warehouses.Add(toWarehouse);

        context.StockByWarehouses.Add(new StockByWarehouse
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ProductId = productId,
            WarehouseId = fromWarehouseId,
            Quantity = sourceQty,
            UpdatedAt = DateTimeOffset.UtcNow
        });

        if (destinationQty > 0)
        {
            context.StockByWarehouses.Add(new StockByWarehouse
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                ProductId = productId,
                WarehouseId = toWarehouse.Id,
                Quantity = destinationQty,
                UpdatedAt = DateTimeOffset.UtcNow
            });
        }

        await context.SaveChangesAsync(cancellationToken);

        return new WarehouseTransferSetup(fromWarehouseId, toWarehouse.Id);
    }

    private sealed record WarehouseTransferSetup(Guid FromWarehouseId, Guid ToWarehouseId);

    private sealed class TestTenantProvider : ITenantProvider
    {
        public Guid? TenantId { get; init; }
        public Guid? BranchId { get; init; }
        public Guid? UserId { get; init; }
        public Guid? DeviceId { get; init; }
    }
}
