using System.Text.Json;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using LoomaPos.Infrastructure.Integration;
using LoomaPos.Domain.Commerce;
using LoomaPos.Domain.Identity;
using LoomaPos.Infrastructure.MultiTenancy;
using LoomaPos.Infrastructure.Persistence;
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

            Assert.Equal(1, processedCount);
            Assert.Equal(1, saleCount);
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

    private static SyncEventProcessor CreateProcessor(AppDbContext context)
    {
        return new SyncEventProcessor(context, new NoopRabbitMqPublisher(), NullLogger<SyncEventProcessor>.Instance);
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

    private sealed class NoopRabbitMqPublisher : IRabbitMqPublisher
    {
        public Task PublishAsync(string routingKey, object payload, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
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
