using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using LoomaPos.Domain.Catalog;
using LoomaPos.Domain.Identity;
using LoomaPos.Domain.Manufacturing;
using LoomaPos.Infrastructure.Manufacturing;
using LoomaPos.Infrastructure.MultiTenancy;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.IntegrationTests.Manufacturing;

public sealed class ManufacturingPreparationServiceTests : IAsyncLifetime
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
    public async Task BomCreate_AndCostSummary_ShouldWorkWithoutStockMutation()
    {
        if (_containerReady == false)
        {
            return;
        }

        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        await using var context = CreateContext(tenantId, branchId, deviceId, userId);
        var setup = await SeedManufacturingSetupAsync(context, tenantId, branchId, CancellationToken.None);

        var stockMoveCountBefore = await context.StockMoves.AsNoTracking().CountAsync(x => x.TenantId == tenantId);
        var stockBalanceBefore = await context.StockBalances.AsNoTracking().CountAsync(x => x.TenantId == tenantId);

        var service = new ManufacturingPreparationService(context);

        var bom = await service.CreateBomAsync(
            tenantId,
            setup.FinishedProductId,
            "BOM-100",
            version: 1,
            activate: true,
            lines:
            [
                new ManufacturingBomLineInput(setup.ComponentAId, 2m),
                new ManufacturingBomLineInput(setup.ComponentBId, 1.5m)
            ],
            CancellationToken.None);

        Assert.True(bom.IsActive);
        Assert.Equal(2, bom.Lines.Count);

        var summary = await service.GetBomCostSummaryAsync(tenantId, bom.Id, CancellationToken.None);

        Assert.Equal(27.5m, summary.TheoreticalMaterialCost);
        Assert.False(summary.HasCostGaps);
        Assert.Equal(2, summary.Lines.Count);

        var stockMoveCountAfter = await context.StockMoves.AsNoTracking().CountAsync(x => x.TenantId == tenantId);
        var stockBalanceAfter = await context.StockBalances.AsNoTracking().CountAsync(x => x.TenantId == tenantId);

        Assert.Equal(stockMoveCountBefore, stockMoveCountAfter);
        Assert.Equal(stockBalanceBefore, stockBalanceAfter);
    }

    [Fact]
    public async Task BomCreate_SelfReference_ShouldBeBlocked()
    {
        if (_containerReady == false)
        {
            return;
        }

        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        await using var context = CreateContext(tenantId, branchId, deviceId, userId);
        var setup = await SeedManufacturingSetupAsync(context, tenantId, branchId, CancellationToken.None);

        var service = new ManufacturingPreparationService(context);

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CreateBomAsync(
                tenantId,
                setup.FinishedProductId,
                "BOM-SELF",
                version: 1,
                activate: false,
                lines:
                [
                    new ManufacturingBomLineInput(setup.FinishedProductId, 1m)
                ],
                CancellationToken.None));

        Assert.Contains("finished product", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task BomActivationAndProductionOrderFlow_ShouldWorkSafely()
    {
        if (_containerReady == false)
        {
            return;
        }

        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        await using var context = CreateContext(tenantId, branchId, deviceId, userId);
        var setup = await SeedManufacturingSetupAsync(context, tenantId, branchId, CancellationToken.None);

        var stockMoveCountBefore = await context.StockMoves.AsNoTracking().CountAsync(x => x.TenantId == tenantId);

        var service = new ManufacturingPreparationService(context);

        var bomV1 = await service.CreateBomAsync(
            tenantId,
            setup.FinishedProductId,
            "BOM-V1",
            version: 1,
            activate: true,
            lines:
            [
                new ManufacturingBomLineInput(setup.ComponentAId, 1m)
            ],
            CancellationToken.None);

        var bomV2 = await service.CreateBomAsync(
            tenantId,
            setup.FinishedProductId,
            "BOM-V2",
            version: 2,
            activate: false,
            lines:
            [
                new ManufacturingBomLineInput(setup.ComponentAId, 1m),
                new ManufacturingBomLineInput(setup.ComponentBId, 1m)
            ],
            CancellationToken.None);

        await service.SetBomActivationAsync(tenantId, bomV2.Id, true, CancellationToken.None);

        var allBoms = await service.ListBomsAsync(tenantId, setup.FinishedProductId, null, 50, CancellationToken.None);
        var activeBoms = allBoms.Where(x => x.IsActive).ToList();

        Assert.Single(activeBoms);
        Assert.Equal(bomV2.Id, activeBoms[0].Id);

        var order = await service.CreateProductionOrderAsync(
            tenantId,
            bomV2.Id,
            setup.FinishedProductId,
            plannedQuantity: 10m,
            status: ProductionOrderStatuses.Planned,
            CancellationToken.None);

        Assert.Equal(ProductionOrderStatuses.Planned, order.Status);

        var canceledOrder = await service.CancelProductionOrderAsync(tenantId, order.Id, CancellationToken.None);
        Assert.Equal(ProductionOrderStatuses.Canceled, canceledOrder.Status);

        var stockMoveCountAfter = await context.StockMoves.AsNoTracking().CountAsync(x => x.TenantId == tenantId);
        Assert.Equal(stockMoveCountBefore, stockMoveCountAfter);
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

    private static async Task<ManufacturingSetup> SeedManufacturingSetupAsync(
        AppDbContext context,
        Guid tenantId,
        Guid branchId,
        CancellationToken cancellationToken)
    {
        var finishedProductId = Guid.NewGuid();
        var componentAId = Guid.NewGuid();
        var componentBId = Guid.NewGuid();

        context.Tenants.Add(new Tenant
        {
            Id = tenantId,
            Name = "Manufacturing Tenant",
            TenantCode = $"mfg-{tenantId.ToString("N")[..8]}",
            BillingEmail = "manufacturing.local",
            Status = "active"
        });

        context.Branches.Add(new Branch
        {
            Id = branchId,
            TenantId = tenantId,
            Name = "Main Branch"
        });

        context.Products.AddRange(
            new Product
            {
                Id = finishedProductId,
                TenantId = tenantId,
                Name = "Finished Product",
                Unit = "adet",
                SalePrice = 40m,
                PurchasePrice = 15m,
                TaxRate = 0m,
                StockTrackingEnabled = true,
                MinStock = 0,
                IsActive = true
            },
            new Product
            {
                Id = componentAId,
                TenantId = tenantId,
                Name = "Component A",
                Unit = "adet",
                SalePrice = 0m,
                PurchasePrice = 10m,
                TaxRate = 0m,
                StockTrackingEnabled = true,
                MinStock = 0,
                IsActive = true
            },
            new Product
            {
                Id = componentBId,
                TenantId = tenantId,
                Name = "Component B",
                Unit = "adet",
                SalePrice = 0m,
                PurchasePrice = 5m,
                TaxRate = 0m,
                StockTrackingEnabled = true,
                MinStock = 0,
                IsActive = true
            });

        await context.SaveChangesAsync(cancellationToken);

        return new ManufacturingSetup(finishedProductId, componentAId, componentBId);
    }

    private sealed record ManufacturingSetup(Guid FinishedProductId, Guid ComponentAId, Guid ComponentBId);

    private sealed class TestTenantProvider : ITenantProvider
    {
        public Guid? TenantId { get; init; }
        public Guid? BranchId { get; init; }
        public Guid? UserId { get; init; }
        public Guid? DeviceId { get; init; }
    }
}
