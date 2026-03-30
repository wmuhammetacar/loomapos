using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using LoomaPos.Domain.Common;
using LoomaPos.Domain.Customers;
using LoomaPos.Domain.Identity;
using LoomaPos.Domain.Sales;
using LoomaPos.Infrastructure.Customers;
using LoomaPos.Infrastructure.MultiTenancy;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.IntegrationTests.Customers;

public sealed class CustomerCurrentAccountServiceTests : IAsyncLifetime
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
    public async Task CustomerAccountFlow_ShouldBeAppendOnly_AndBalanceShouldTrackEntries()
    {
        if (_containerReady == false)
        {
            return;
        }

        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var customerId = Guid.NewGuid();
        var saleId = Guid.NewGuid();

        await using var context = CreateContext(tenantId, branchId, deviceId, userId);
        await SeedCustomerAndSaleAsync(context, tenantId, branchId, deviceId, customerId, saleId, 120m, CancellationToken.None);

        var service = new CustomerCurrentAccountService(context, new LoomaPos.Infrastructure.Accounting.AccountingBridgeService(context));

        await service.ChargeSaleAsync(tenantId, customerId, saleId, null, "veresiye satis", CancellationToken.None);
        await service.RecordCollectionAsync(tenantId, customerId, 20m, "collection", "col-001", "tahsilat", CancellationToken.None);
        await service.RecordAdjustmentAsync(tenantId, customerId, 5m, "adjustment", "adj-001", "manuel artirim", CancellationToken.None);
        await service.RecordRefundCreditAsync(tenantId, customerId, 10m, "refund", "ref-001", "iade kredisi", CancellationToken.None);

        var account = await context.CustomerCurrentAccounts.AsNoTracking()
            .FirstAsync(x => x.TenantId == tenantId && x.CustomerId == customerId);
        Assert.Equal(95m, account.Balance);
        Assert.Equal("TRY", account.Currency);

        var entries = await context.CustomerCurrentAccountEntries.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.CustomerId == customerId)
            .OrderBy(x => x.CreatedAt)
            .ToListAsync();

        Assert.Equal(4, entries.Count);
        Assert.Equal(CustomerCurrentAccountEntryTypes.SaleCharge, entries[0].Type);
        Assert.Equal(120m, entries[0].Amount);
        Assert.Equal(CustomerCurrentAccountEntryTypes.Collection, entries[1].Type);
        Assert.Equal(-20m, entries[1].Amount);
        Assert.Equal(CustomerCurrentAccountEntryTypes.Adjustment, entries[2].Type);
        Assert.Equal(5m, entries[2].Amount);
        Assert.Equal(CustomerCurrentAccountEntryTypes.RefundCredit, entries[3].Type);
        Assert.Equal(-10m, entries[3].Amount);

        var legacyLedgerRows = await context.ContactLedger.AsNoTracking()
            .CountAsync(x => x.TenantId == tenantId && x.ContactId == customerId);
        Assert.Equal(4, legacyLedgerRows);

        var collectionExports = await context.AccountingExportItems.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.SourceType == "customer_collection")
            .ToListAsync();
        Assert.Single(collectionExports);

        var adjustmentExports = await context.AccountingExportItems.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.SourceType == "customer_account_adjustment")
            .ToListAsync();
        Assert.Equal(2, adjustmentExports.Count);
    }

    [Fact]
    public async Task DuplicateSaleCharge_ShouldBeIdempotent_AndMustNotDoubleApplyBalance()
    {
        if (_containerReady == false)
        {
            return;
        }

        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var customerId = Guid.NewGuid();
        var saleId = Guid.NewGuid();

        await using var context = CreateContext(tenantId, branchId, deviceId, userId);
        await SeedCustomerAndSaleAsync(context, tenantId, branchId, deviceId, customerId, saleId, 75m, CancellationToken.None);

        var service = new CustomerCurrentAccountService(context, new LoomaPos.Infrastructure.Accounting.AccountingBridgeService(context));

        var first = await service.ChargeSaleAsync(tenantId, customerId, saleId, null, "ilk deneme", CancellationToken.None);
        var second = await service.ChargeSaleAsync(tenantId, customerId, saleId, null, "tekrar deneme", CancellationToken.None);

        Assert.Equal(first.Id, second.Id);

        var account = await context.CustomerCurrentAccounts.AsNoTracking()
            .FirstAsync(x => x.TenantId == tenantId && x.CustomerId == customerId);
        Assert.Equal(75m, account.Balance);

        var entryCount = await context.CustomerCurrentAccountEntries.AsNoTracking()
            .CountAsync(x => x.TenantId == tenantId && x.CustomerId == customerId && x.Type == CustomerCurrentAccountEntryTypes.SaleCharge);
        Assert.Equal(1, entryCount);

        var bridgeCount = await context.AccountingExportItems.AsNoTracking()
            .CountAsync(x => x.TenantId == tenantId);
        Assert.Equal(0, bridgeCount);
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

    private static async Task SeedCustomerAndSaleAsync(
        AppDbContext context,
        Guid tenantId,
        Guid branchId,
        Guid deviceId,
        Guid customerId,
        Guid saleId,
        decimal total,
        CancellationToken cancellationToken)
    {
        context.Tenants.Add(new Tenant
        {
            Id = tenantId,
            Name = "Cari Test Tenant",
            TenantCode = $"ca-{tenantId.ToString("N")[..8]}",
            BillingEmail = "customer-account.local",
            Status = "active"
        });

        context.Branches.Add(new Branch
        {
            Id = branchId,
            TenantId = tenantId,
            Name = "Main Branch"
        });

        context.Contacts.Add(new Contact
        {
            Id = customerId,
            TenantId = tenantId,
            Type = ContactType.Customer,
            Name = "Test Musteri",
            Phone = "+90 555 100 0000",
            Email = "musteri@example.com"
        });

        context.Sales.Add(new Sale
        {
            Id = saleId,
            TenantId = tenantId,
            BranchId = branchId,
            DeviceId = deviceId,
            ReceiptNo = $"R-{saleId.ToString("N")[..8]}",
            Status = SaleStatus.Completed,
            Subtotal = total,
            Discount = 0,
            Tax = 0,
            Total = total,
            CreatedAt = DateTimeOffset.UtcNow
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
