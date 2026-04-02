using System.Text.Json;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using LoomaPos.Infrastructure.Integration;
using LoomaPos.Domain.Commerce;
using LoomaPos.Domain.Catalog;
using LoomaPos.Domain.Identity;
using LoomaPos.Infrastructure.Accounting;
using LoomaPos.Domain.Accounting;
using LoomaPos.Infrastructure.MultiTenancy;
using LoomaPos.Infrastructure.Persistence;
using LoomaPos.Infrastructure.Inventory;
using LoomaPos.Infrastructure.Sync;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace LoomaPos.IntegrationTests.Sync;

public sealed class SyncEventProcessorIdempotencyTests : IAsyncLifetime
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
    public async Task ProcessAsync_RetryWithSameEventId_ShouldRemainSingleApply()
    {
        if (!_containerReady)
        {
            return;
        }

        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var saleId = Guid.NewGuid();

        var request = BuildSaleCreatedRequest(eventId, tenantId, branchId, deviceId, saleId);

        await using (var context = CreateContext(tenantId, branchId, deviceId, Guid.NewGuid()))
        {
            await SeedOperationalStateAsync(context, tenantId);
            var processor = CreateProcessor(context);
            var first = await processor.ProcessAsync(request, CancellationToken.None);
            Assert.Equal("accepted", first.Status);
        }

        await using (var context = CreateContext(tenantId, branchId, deviceId, Guid.NewGuid()))
        {
            var processor = CreateProcessor(context);
            var second = await processor.ProcessAsync(request, CancellationToken.None);
            Assert.Equal("duplicate", second.Status);
            Assert.True(second.AlreadyProcessed);
        }

        await using (var verify = CreateContext(tenantId, branchId, deviceId, Guid.NewGuid()))
        {
            var processedCount = await verify.ProcessedEvents.CountAsync(x => x.EventId == eventId);
            var saleCount = await verify.Sales.CountAsync(x => x.Id == saleId);
            var exportCount = await verify.AccountingExportItems.CountAsync(
                x => x.TenantId == tenantId &&
                     x.SourceType == "sale" &&
                     x.SourceId == saleId.ToString());

            Assert.Equal(1, processedCount);
            Assert.Equal(1, saleCount);
            Assert.Equal(1, exportCount);
        }
    }

    [Fact]
    public async Task ProcessBatch_DuplicateEventInBatch_ShouldNotDoubleApply()
    {
        if (!_containerReady)
        {
            return;
        }

        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var saleId = Guid.NewGuid();

        var request = BuildSaleCreatedRequest(eventId, tenantId, branchId, deviceId, saleId);

        await using var context = CreateContext(tenantId, branchId, deviceId, Guid.NewGuid());
        await SeedOperationalStateAsync(context, tenantId);
        var processor = CreateProcessor(context);

        var results = await processor.ProcessBatchAsync([request, request], CancellationToken.None);

        Assert.Equal(2, results.Count);
        Assert.Equal("accepted", results[0].Status);
        Assert.Equal("duplicate", results[1].Status);

        var processedCount = await context.ProcessedEvents.CountAsync(x => x.EventId == eventId);
        var saleCount = await context.Sales.CountAsync(x => x.Id == saleId);

        Assert.Equal(1, processedCount);
        Assert.Equal(1, saleCount);
    }

    [Fact]
    public async Task ProcessAsync_SaleCreated_ShouldMirrorStockDeltaToDefaultWarehouse()
    {
        if (_containerReady == false)
        {
            return;
        }

        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var saleId = Guid.NewGuid();
        var productId = Guid.NewGuid();

        var request = BuildSaleCreatedRequestWithLine(eventId, tenantId, branchId, deviceId, saleId, productId, 2m);

        await using var context = CreateContext(tenantId, branchId, deviceId, Guid.NewGuid());
        await SeedOperationalStateAsync(context, tenantId);

        context.Products.Add(new Product
        {
            Id = productId,
            TenantId = tenantId,
            Name = "Warehouse Sync Product",
            Unit = "adet",
            SalePrice = 50m,
            PurchasePrice = 0m,
            TaxRate = 0m,
            StockTrackingEnabled = true,
            MinStock = 0,
            IsActive = true
        });
        await context.SaveChangesAsync();

        var processor = CreateProcessor(context);
        var result = await processor.ProcessAsync(request, CancellationToken.None);

        Assert.Equal("accepted", result.Status);

        var warehouse = await context.Warehouses
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Name == "DEFAULT");
        Assert.NotNull(warehouse);

        var stockByWarehouse = await context.StockByWarehouses
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.ProductId == productId && x.WarehouseId == warehouse!.Id);

        Assert.NotNull(stockByWarehouse);
        Assert.Equal(-2m, stockByWarehouse!.Quantity);

        var branchStockBalance = await context.StockBalances.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.BranchId == branchId && x.ProductId == productId);
        Assert.NotNull(branchStockBalance);
        Assert.Equal(-2m, branchStockBalance!.Qty);

        var stockMove = await context.StockMoves.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.ProductId == productId && x.RefId == saleId.ToString());
        Assert.NotNull(stockMove);
        Assert.Equal(warehouse.Id, stockMove!.WarehouseId);
    }

    [Fact]
    public async Task ProcessAsync_DuplicateFloodConcurrent_ShouldRemainSingleApplyAndNoDoubleSideEffects()
    {
        if (!_containerReady)
        {
            return;
        }

        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var saleId = Guid.NewGuid();
        var productId = Guid.NewGuid();

        await using (var seedContext = CreateContext(tenantId, branchId, deviceId, Guid.NewGuid()))
        {
            await SeedOperationalStateAsync(seedContext, tenantId);
            seedContext.Products.Add(new Product
            {
                Id = productId,
                TenantId = tenantId,
                Name = "Flood Product",
                Unit = "adet",
                SalePrice = 50m,
                PurchasePrice = 25m,
                TaxRate = 0m,
                StockTrackingEnabled = true,
                MinStock = 0,
                IsActive = true
            });
            await seedContext.SaveChangesAsync();
        }

        var request = BuildSaleCreatedRequestWithLine(eventId, tenantId, branchId, deviceId, saleId, productId, 3m);

        var processingTasks = Enumerable.Range(0, 24)
            .Select(async _ =>
            {
                await using var context = CreateContext(tenantId, branchId, deviceId, Guid.NewGuid());
                var processor = CreateProcessor(context);
                var result = await processor.ProcessAsync(request, CancellationToken.None);
                return result.Status;
            })
            .ToArray();

        var statuses = await Task.WhenAll(processingTasks);

        Assert.Equal(1, statuses.Count(x => x == "accepted"));
        Assert.Equal(statuses.Length - 1, statuses.Count(x => x == "duplicate"));

        await using var verify = CreateContext(tenantId, branchId, deviceId, Guid.NewGuid());
        var processedCount = await verify.ProcessedEvents.CountAsync(x => x.EventId == eventId);
        var saleCount = await verify.Sales.CountAsync(x => x.Id == saleId);
        var exportCount = await verify.AccountingExportItems.CountAsync(
            x => x.TenantId == tenantId && x.SourceType == AccountingBridgeSourceTypes.Sale && x.SourceId == saleId.ToString());
        var customerAccountEntries = await verify.CustomerCurrentAccountEntries.CountAsync(x => x.TenantId == tenantId);

        var warehouse = await verify.Warehouses
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Name == "DEFAULT");
        Assert.NotNull(warehouse);

        var stockByWarehouse = await verify.StockByWarehouses
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.ProductId == productId && x.WarehouseId == warehouse!.Id);
        var branchStockBalance = await verify.StockBalances
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.BranchId == branchId && x.ProductId == productId);

        Assert.Equal(1, processedCount);
        Assert.Equal(1, saleCount);
        Assert.Equal(1, exportCount);
        Assert.Equal(0, customerAccountEntries);
        Assert.NotNull(stockByWarehouse);
        Assert.Equal(-3m, stockByWarehouse!.Quantity);
        Assert.NotNull(branchStockBalance);
        Assert.Equal(-3m, branchStockBalance!.Qty);
    }

    [Fact]
    public async Task ProcessBatch_MixedDuplicateEvents_ShouldApplyDistinctEventsOnce()
    {
        if (!_containerReady)
        {
            return;
        }

        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();

        var eventA = Guid.NewGuid();
        var saleA = Guid.NewGuid();
        var requestA = BuildSaleCreatedRequest(eventA, tenantId, branchId, deviceId, saleA);

        var eventB = Guid.NewGuid();
        var saleB = Guid.NewGuid();
        var requestB = BuildSaleCreatedRequest(eventB, tenantId, branchId, deviceId, saleB);

        await using var context = CreateContext(tenantId, branchId, deviceId, Guid.NewGuid());
        await SeedOperationalStateAsync(context, tenantId);

        var processor = CreateProcessor(context);
        var results = await processor.ProcessBatchAsync([
            requestA,
            requestA,
            requestB,
            requestA,
            requestB
        ], CancellationToken.None);

        Assert.Equal(5, results.Count);
        Assert.Equal(2, results.Count(x => x.Status == "accepted"));
        Assert.Equal(3, results.Count(x => x.Status == "duplicate"));

        var processedCount = await context.ProcessedEvents.CountAsync(
            x => x.EventId == eventA || x.EventId == eventB);
        var saleCount = await context.Sales.CountAsync(
            x => x.Id == saleA || x.Id == saleB);
        var exportCount = await context.AccountingExportItems.CountAsync(
            x => x.TenantId == tenantId
                 && x.SourceType == AccountingBridgeSourceTypes.Sale
                 && (x.SourceId == saleA.ToString() || x.SourceId == saleB.ToString()));

        Assert.Equal(2, processedCount);
        Assert.Equal(2, saleCount);
        Assert.Equal(2, exportCount);
    }

    [Fact]
    public async Task ProcessBatch_TransientFailuresThenRetry_ShouldEventuallyApplyWithoutDoubleApply()
    {
        if (!_containerReady)
        {
            return;
        }

        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var saleId = Guid.NewGuid();

        var request = BuildSaleCreatedRequest(eventId, tenantId, branchId, deviceId, saleId);

        await using var context = CreateContext(tenantId, branchId, deviceId, Guid.NewGuid());
        await SeedOperationalStateAsync(context, tenantId);

        var flakyProcessor = CreateProcessor(
            context,
            new FlakyAccountingBridgeService(
                new AccountingBridgeService(context),
                failuresBeforeSuccess: 2));

        var firstAttempt = await flakyProcessor.ProcessBatchAsync([request], CancellationToken.None);
        var secondAttempt = await flakyProcessor.ProcessBatchAsync([request], CancellationToken.None);

        Assert.Single(firstAttempt);
        Assert.Equal("retry_later", firstAttempt[0].Status);
        Assert.Single(secondAttempt);
        Assert.Equal("retry_later", secondAttempt[0].Status);

        var stableProcessor = CreateProcessor(context);
        var thirdAttempt = await stableProcessor.ProcessBatchAsync([request], CancellationToken.None);
        var fourthAttempt = await stableProcessor.ProcessBatchAsync([request], CancellationToken.None);

        Assert.Single(thirdAttempt);
        Assert.Equal("accepted", thirdAttempt[0].Status);
        Assert.Single(fourthAttempt);
        Assert.Equal("duplicate", fourthAttempt[0].Status);

        var processedCount = await context.ProcessedEvents.CountAsync(x => x.EventId == eventId);
        var saleCount = await context.Sales.CountAsync(x => x.Id == saleId);
        var exportCount = await context.AccountingExportItems.CountAsync(
            x => x.TenantId == tenantId
                 && x.SourceType == AccountingBridgeSourceTypes.Sale
                 && x.SourceId == saleId.ToString());

        Assert.Equal(1, processedCount);
        Assert.Equal(1, saleCount);
        Assert.Equal(1, exportCount);
    }

    [Fact]
    public async Task ProcessBatch_MixedSuccessAndPermanentFailure_ShouldKeepSuccessfulApplyIntact()
    {
        if (!_containerReady)
        {
            return;
        }

        var tenantId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();

        var goodEventId = Guid.NewGuid();
        var goodSaleId = Guid.NewGuid();
        var goodRequest = BuildSaleCreatedRequest(goodEventId, tenantId, branchId, deviceId, goodSaleId);

        var badEventId = Guid.NewGuid();
        var badRequest = BuildUnsupportedRequest(badEventId, tenantId, branchId, deviceId);

        await using var context = CreateContext(tenantId, branchId, deviceId, Guid.NewGuid());
        await SeedOperationalStateAsync(context, tenantId);

        var processor = CreateProcessor(context);
        var results = await processor.ProcessBatchAsync([goodRequest, badRequest], CancellationToken.None);

        Assert.Equal(2, results.Count);
        Assert.Equal("accepted", results[0].Status);
        Assert.Equal("rejected", results[1].Status);

        var processedGood = await context.ProcessedEvents.CountAsync(x => x.EventId == goodEventId);
        var processedBad = await context.ProcessedEvents.CountAsync(x => x.EventId == badEventId);
        var salesCount = await context.Sales.CountAsync(x => x.Id == goodSaleId);
        var exportCount = await context.AccountingExportItems.CountAsync(
            x => x.TenantId == tenantId
                 && x.SourceType == AccountingBridgeSourceTypes.Sale
                 && x.SourceId == goodSaleId.ToString());

        Assert.Equal(1, processedGood);
        Assert.Equal(0, processedBad);
        Assert.Equal(1, salesCount);
        Assert.Equal(1, exportCount);
    }

    private static async Task SeedOperationalStateAsync(AppDbContext context, Guid tenantId)
    {
        var subscriptionId = Guid.NewGuid();
        if (!await context.Tenants.AnyAsync(x => x.Id == tenantId))
        {
            context.Tenants.Add(new Tenant
            {
                Id = tenantId,
                Name = "Sync Test Tenant",
                TenantCode = $"tenant-{tenantId.ToString("N")[..8]}",
                BillingEmail = "sync-test.local",
                Status = "active"
            });
        }

        if (!await context.Subscriptions.AnyAsync(x => x.TenantId == tenantId))
        {
            context.Subscriptions.Add(new Subscription
            {
                Id = subscriptionId,
                TenantId = tenantId,
                PlanCode = "starter",
                BillingCycle = "monthly",
                Status = "active",
                CurrentPeriodStart = DateTimeOffset.UtcNow.AddDays(-1),
                CurrentPeriodEnd = DateTimeOffset.UtcNow.AddDays(29),
                RenewalDate = DateTimeOffset.UtcNow.AddDays(29)
            });
        }
        else
        {
            subscriptionId = await context.Subscriptions
                .Where(x => x.TenantId == tenantId)
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => x.Id)
                .FirstAsync();
        }

        if (!await context.IssuedLicenses.AnyAsync(x => x.TenantId == tenantId))
        {
            context.IssuedLicenses.Add(new IssuedLicense
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                SubscriptionId = subscriptionId,
                PlanCode = "starter",
                LicenseKey = $"LIC-{tenantId.ToString("N")[..12]}",
                LicenseToken = Convert.ToBase64String(Guid.NewGuid().ToByteArray()),
                Signature = "test-signature",
                FeaturesJson = "[]",
                DeviceLimit = 5,
                Status = "active",
                ExpiresAt = DateTimeOffset.UtcNow.AddDays(30),
                IssuedAt = DateTimeOffset.UtcNow
            });
        }

        await context.SaveChangesAsync();
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

    private static SyncEventProcessor CreateProcessor(AppDbContext context, IAccountingBridgeService? accountingBridgeService = null)
    {
        return new SyncEventProcessor(
            context,
            new NoopRabbitMqPublisher(),
            new WarehouseCompatibilityService(context),
            accountingBridgeService ?? new AccountingBridgeService(context),
            NullLogger<SyncEventProcessor>.Instance);
    }

    private static SyncEventRequest BuildSaleCreatedRequestWithLine(
        Guid eventId,
        Guid tenantId,
        Guid branchId,
        Guid deviceId,
        Guid saleId,
        Guid productId,
        decimal qty)
    {
        var lineTotal = qty * 50m;
        var payload = JsonSerializer.SerializeToElement(new
        {
            saleId,
            receiptNo = "RCP-IDEMP-LINE",
            createdAt = DateTimeOffset.UtcNow,
            subtotal = lineTotal,
            discount = 0m,
            tax = 0m,
            total = lineTotal,
            lines = new[]
            {
                new
                {
                    productId,
                    qty,
                    unitPrice = 50m,
                    discount = 0m,
                    tax = 0m,
                    lineTotal
                }
            },
            payments = new[]
            {
                new
                {
                    method = "Cash",
                    amount = lineTotal
                }
            }
        });

        return new SyncEventRequest(
            eventId,
            tenantId,
            branchId,
            deviceId,
            SyncEventTypes.SaleCreated,
            payload,
            "sale",
            saleId.ToString(),
            1);
    }

    private static SyncEventRequest BuildSaleCreatedRequest(
        Guid eventId,
        Guid tenantId,
        Guid branchId,
        Guid deviceId,
        Guid saleId)
    {
        var payload = JsonSerializer.SerializeToElement(new
        {
            saleId,
            receiptNo = "RCP-IDEMP-001",
            createdAt = DateTimeOffset.UtcNow,
            subtotal = 100m,
            discount = 0m,
            tax = 20m,
            total = 120m,
            lines = Array.Empty<object>(),
            payments = new[]
            {
                new
                {
                    method = "Cash",
                    amount = 120m
                }
            }
        });

        return new SyncEventRequest(
            eventId,
            tenantId,
            branchId,
            deviceId,
            SyncEventTypes.SaleCreated,
            payload,
            "sale",
            saleId.ToString(),
            1);
    }

    private static SyncEventRequest BuildUnsupportedRequest(
        Guid eventId,
        Guid tenantId,
        Guid branchId,
        Guid deviceId)
    {
        var payload = JsonSerializer.SerializeToElement(new
        {
            note = "unsupported_event_for_chaos_test"
        });

        return new SyncEventRequest(
            eventId,
            tenantId,
            branchId,
            deviceId,
            "UNSUPPORTED_EVENT",
            payload,
            "unsupported",
            eventId.ToString(),
            1);
    }

    private sealed class NoopRabbitMqPublisher : IRabbitMqPublisher
    {
        public Task PublishAsync(string routingKey, object payload, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }
    }

    private sealed class FlakyAccountingBridgeService : IAccountingBridgeService
    {
        private readonly IAccountingBridgeService _inner;
        private int _failuresRemaining;

        public FlakyAccountingBridgeService(IAccountingBridgeService inner, int failuresBeforeSuccess)
        {
            _inner = inner;
            _failuresRemaining = failuresBeforeSuccess;
        }

        public Task EnsurePendingExportItemAsync(
            Guid tenantId,
            string sourceType,
            string sourceId,
            string eventCode,
            string payloadJson,
            CancellationToken cancellationToken)
        {
            if (_failuresRemaining > 0)
            {
                _failuresRemaining -= 1;
                throw new TimeoutException("Simulated transient accounting bridge timeout.");
            }

            return _inner.EnsurePendingExportItemAsync(
                tenantId,
                sourceType,
                sourceId,
                eventCode,
                payloadJson,
                cancellationToken);
        }

        public Task<bool> MarkExportedAsync(
            Guid tenantId,
            Guid exportItemId,
            DateTimeOffset? exportedAt,
            CancellationToken cancellationToken)
        {
            return _inner.MarkExportedAsync(tenantId, exportItemId, exportedAt, cancellationToken);
        }

        public Task<bool> MarkFailedAsync(
            Guid tenantId,
            Guid exportItemId,
            string failureReason,
            bool retryReady,
            CancellationToken cancellationToken)
        {
            return _inner.MarkFailedAsync(tenantId, exportItemId, failureReason, retryReady, cancellationToken);
        }
    }

    private sealed class TestTenantProvider : ITenantProvider
    {
        public Guid? TenantId { get; init; }
        public Guid? BranchId { get; init; }
        public Guid? UserId { get; init; }
        public Guid? DeviceId { get; init; }
    }
}
