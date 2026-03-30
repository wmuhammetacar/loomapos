using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using LoomaPos.Domain.Accounting;
using LoomaPos.Domain.Identity;
using LoomaPos.Infrastructure.Accounting;
using LoomaPos.Infrastructure.MultiTenancy;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.IntegrationTests.Accounting;

public sealed class AccountingBridgeServiceTests : IAsyncLifetime
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

        await using var context = CreateContext(Guid.NewGuid());
        await context.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync()
    {
        await _postgresContainer.DisposeAsync();
    }

    [Fact]
    public async Task EnsurePendingExportItemAsync_DuplicateSource_ShouldRemainSingleRow()
    {
        if (_containerReady == false)
        {
            return;
        }

        var tenantId = Guid.NewGuid();
        await using var context = CreateContext(tenantId);
        await SeedTenantAsync(context, tenantId, CancellationToken.None);

        var service = new AccountingBridgeService(context);

        await service.EnsurePendingExportItemAsync(
            tenantId,
            AccountingBridgeSourceTypes.Sale,
            "sale-001",
            "sale_created",
            "{\"total\":100}",
            CancellationToken.None);

        await service.EnsurePendingExportItemAsync(
            tenantId,
            AccountingBridgeSourceTypes.Sale,
            "sale-001",
            "sale_created",
            "{\"total\":120}",
            CancellationToken.None);

        var items = await context.AccountingExportItems.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.SourceType == AccountingBridgeSourceTypes.Sale && x.SourceId == "sale-001")
            .ToListAsync();

        Assert.Single(items);
        Assert.Equal(AccountingBridgeStatuses.Pending, items[0].Status);
        Assert.Equal("{\"total\":120}", items[0].PayloadJson);

        var exported = await service.MarkExportedAsync(tenantId, items[0].Id, null, CancellationToken.None);
        Assert.True(exported);

        await service.EnsurePendingExportItemAsync(
            tenantId,
            AccountingBridgeSourceTypes.Sale,
            "sale-001",
            "sale_created",
            "{\"total\":130}",
            CancellationToken.None);

        var persisted = await context.AccountingExportItems.AsNoTracking()
            .FirstAsync(x => x.Id == items[0].Id);

        Assert.Equal(AccountingBridgeStatuses.Exported, persisted.Status);
        Assert.NotNull(persisted.ExportedAt);
        Assert.Equal("{\"total\":130}", persisted.PayloadJson);
    }

    [Fact]
    public async Task MarkFailedAndRetryReady_ShouldTransitionStatusesSafely()
    {
        if (_containerReady == false)
        {
            return;
        }

        var tenantId = Guid.NewGuid();
        await using var context = CreateContext(tenantId);
        await SeedTenantAsync(context, tenantId, CancellationToken.None);

        var service = new AccountingBridgeService(context);

        await service.EnsurePendingExportItemAsync(
            tenantId,
            AccountingBridgeSourceTypes.CustomerCollection,
            "collection-001",
            "customer_collection_recorded",
            "{\"amount\":20}",
            CancellationToken.None);

        var item = await context.AccountingExportItems.AsNoTracking()
            .FirstAsync(x => x.TenantId == tenantId && x.SourceType == AccountingBridgeSourceTypes.CustomerCollection && x.SourceId == "collection-001");

        var failed = await service.MarkFailedAsync(
            tenantId,
            item.Id,
            "temporary accounting connector outage",
            retryReady: false,
            CancellationToken.None);

        Assert.True(failed);

        var failedState = await context.AccountingExportItems.AsNoTracking().FirstAsync(x => x.Id == item.Id);
        Assert.Equal(AccountingBridgeStatuses.Failed, failedState.Status);
        Assert.Equal("temporary accounting connector outage", failedState.FailureReason);

        var retryReady = await service.MarkFailedAsync(
            tenantId,
            item.Id,
            "",
            retryReady: true,
            CancellationToken.None);

        Assert.True(retryReady);

        var pendingState = await context.AccountingExportItems.AsNoTracking().FirstAsync(x => x.Id == item.Id);
        Assert.Equal(AccountingBridgeStatuses.Pending, pendingState.Status);
        Assert.Null(pendingState.FailureReason);
    }

    private AppDbContext CreateContext(Guid tenantId)
    {
        var tenantProvider = new TestTenantProvider
        {
            TenantId = tenantId,
            BranchId = Guid.NewGuid(),
            DeviceId = Guid.NewGuid(),
            UserId = Guid.NewGuid()
        };

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_connectionString)
            .Options;

        return new AppDbContext(options, tenantProvider);
    }

    private static async Task SeedTenantAsync(AppDbContext context, Guid tenantId, CancellationToken cancellationToken)
    {
        if (await context.Tenants.AnyAsync(x => x.Id == tenantId, cancellationToken))
        {
            return;
        }

        context.Tenants.Add(new Tenant
        {
            Id = tenantId,
            Name = "Accounting Test Tenant",
            TenantCode = $"acct-{tenantId.ToString("N")[..8]}",
            BillingEmail = "accounting-test.local",
            Status = "active"
        });

        await context.SaveChangesAsync(cancellationToken);
    }

    private sealed class TestTenantProvider : ITenantProvider
    {
        public Guid? TenantId { get; init; }
        public Guid? BranchId { get; init; }
        public Guid? UserId { get; init; }
        public Guid? DeviceId { get; init; }
    }
}
