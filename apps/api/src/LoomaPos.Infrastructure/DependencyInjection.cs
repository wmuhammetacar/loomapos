using LoomaPos.Infrastructure.MultiTenancy;
using LoomaPos.Infrastructure.Persistence;
using LoomaPos.Infrastructure.Integration;
using LoomaPos.Infrastructure.Storage;
using LoomaPos.Infrastructure.Payments;
using LoomaPos.Infrastructure.Sync;
using LoomaPos.Infrastructure.Inventory;
using LoomaPos.Infrastructure.Purchasing;
using LoomaPos.Infrastructure.Manufacturing;
using LoomaPos.Infrastructure.Customers;
using LoomaPos.Infrastructure.Accounting;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace LoomaPos.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var postgresConnectionString = configuration.GetConnectionString("Postgres")
            ?? throw new InvalidOperationException("ConnectionStrings:Postgres is missing.");

        services.AddScoped<RequestTenantProvider>();
        services.AddScoped<ITenantProvider>(sp => sp.GetRequiredService<RequestTenantProvider>());

        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(postgresConnectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__ef_migrations_history", "public")));

        var redisConnectionString = configuration.GetConnectionString("Redis");
        if (!string.IsNullOrWhiteSpace(redisConnectionString))
        {
            services.AddStackExchangeRedisCache(options => options.Configuration = redisConnectionString);
        }

        var hangfireEnabled = configuration.GetValue("Hangfire:Enabled", true);
        if (hangfireEnabled)
        {
            services.AddHangfire(config =>
                config.SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
                    .UseSimpleAssemblyNameTypeSerializer()
                    .UseRecommendedSerializerSettings()
                    .UsePostgreSqlStorage(options => options.UseNpgsqlConnection(postgresConnectionString)));
            services.AddHangfireServer();
        }

        services.Configure<RabbitMqOptions>(configuration.GetSection("RabbitMq"));
        services.AddHttpClient<RabbitMqHttpPublisher>();
        services.AddScoped<IRabbitMqPublisher, RabbitMqHttpPublisher>();
        services.AddScoped<IEInvoiceProvider, MockEInvoiceProvider>();
        services.AddScoped<IFiscalProvider, MockFiscalProvider>();
        services.AddHttpClient<RestEInvoiceAdapter>();
        services.AddHttpClient<RestFiscalBridgeAdapter>();
        services.AddHttpClient<RestCollectionAdapter>();
        services.AddHttpClient<RestAccountingAdapter>();
        services.AddHttpClient<RestEcommerceAdapter>();
        services.AddScoped<IIntegrationProviderAdapter>(sp => sp.GetRequiredService<RestEInvoiceAdapter>());
        services.AddScoped<IIntegrationProviderAdapter>(sp => sp.GetRequiredService<RestFiscalBridgeAdapter>());
        services.AddScoped<IIntegrationProviderAdapter>(sp => sp.GetRequiredService<RestCollectionAdapter>());
        services.AddScoped<IIntegrationProviderAdapter>(sp => sp.GetRequiredService<RestAccountingAdapter>());
        services.AddScoped<IIntegrationProviderAdapter>(sp => sp.GetRequiredService<RestEcommerceAdapter>());
        services.AddScoped<IIntegrationProviderAdapter, SmtpMessagingAdapter>();
        services.AddScoped<IIntegrationProviderAdapter, MockEInvoiceAdapter>();
        services.AddScoped<IIntegrationProviderAdapter, MockFiscalAdapter>();
        services.AddScoped<IIntegrationProviderAdapter, MockCollectionAdapter>();
        services.AddScoped<IIntegrationProviderAdapter, MockAccountingAdapter>();
        services.AddScoped<IIntegrationProviderAdapter, MockEcommerceAdapter>();
        services.AddScoped<IIntegrationProviderAdapter, MockMessagingAdapter>();
        services.AddScoped<IIntegrationProviderRegistry, IntegrationProviderRegistry>();
        services.AddScoped<MockPaymentProvider>();
        services.AddScoped<StripePaymentProvider>();
        services.AddScoped<IyzicoPaymentProvider>();
        services.AddScoped<PayTrPaymentProvider>();
        services.AddScoped<IPaymentProvider>(sp => sp.GetRequiredService<MockPaymentProvider>());
        services.AddScoped<IEnumerable<IPaymentProvider>>(sp =>
            new IPaymentProvider[]
            {
                sp.GetRequiredService<MockPaymentProvider>(),
                sp.GetRequiredService<StripePaymentProvider>(),
                sp.GetRequiredService<IyzicoPaymentProvider>(),
                sp.GetRequiredService<PayTrPaymentProvider>()
            });
        services.AddScoped<IPaymentProviderResolver, PaymentProviderResolver>();

        services.Configure<FileStorageOptions>(configuration.GetSection("FileStorage"));
        services.AddHttpClient<S3CompatibleFileStorage>();
        services.AddScoped<LocalFileStorage>();
        services.AddScoped<IFileStorage>(sp =>
        {
            var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<FileStorageOptions>>().Value;
            return string.Equals(options.Provider, "S3", StringComparison.OrdinalIgnoreCase)
                ? sp.GetRequiredService<S3CompatibleFileStorage>()
                : sp.GetRequiredService<LocalFileStorage>();
        });

        services.AddScoped<IWarehouseCompatibilityService, WarehouseCompatibilityService>();
        services.AddScoped<IWarehouseTransferService, WarehouseTransferService>();
        services.AddScoped<IManufacturingPreparationService, ManufacturingPreparationService>();
        services.AddScoped<IPurchasingService, PurchasingService>();
        services.AddScoped<ICustomerCurrentAccountService, CustomerCurrentAccountService>();
        services.AddScoped<IAccountingBridgeService, AccountingBridgeService>();
        services.AddScoped<ISyncEventProcessor, SyncEventProcessor>();

        return services;
    }
}
