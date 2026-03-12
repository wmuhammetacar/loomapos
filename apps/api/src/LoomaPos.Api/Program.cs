using LoomaPos.Api.Endpoints;
using LoomaPos.Api.Commerce;
using LoomaPos.Api.Analytics;
using LoomaPos.Api.Integrations;
using LoomaPos.Api.Ops;
using LoomaPos.Api.Middleware;
using LoomaPos.Api.Security;
using LoomaPos.Infrastructure;
using LoomaPos.Infrastructure.Persistence;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddDataProtection();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddScoped<IPortalCryptoService, PortalCryptoService>();
builder.Services.AddScoped<ILicenseArtifactService, LicenseArtifactService>();
builder.Services.AddScoped<IEmailTemplateService, EmailTemplateService>();
builder.Services.AddScoped<IPortalAuthService, PortalAuthService>();
builder.Services.AddScoped<ICommerceProvisioningService, CommerceProvisioningService>();
builder.Services.AddScoped<ICommerceSeedService, CommerceSeedService>();
builder.Services.AddScoped<IAnalyticsWarehouseService, AnalyticsWarehouseService>();
builder.Services.AddScoped<IAnalyticsReadModelService, AnalyticsReadModelService>();
builder.Services.AddScoped<IIntegrationSecretService, IntegrationSecretService>();
builder.Services.AddScoped<IPublicApiAccessService, PublicApiAccessService>();
builder.Services.AddScoped<IIntegrationPlatformService, IntegrationPlatformService>();
builder.Services.AddScoped<IProductionOpsReadModelService, ProductionOpsReadModelService>();
builder.Services.AddScoped<IInternalAdminAuthService, InternalAdminAuthService>();
builder.Services.AddScoped<IAdminApprovalService, AdminApprovalService>();
builder.Services.AddSingleton<IInvoicePdfService, InvoicePdfService>();
builder.Services.AddScoped<IEmailDispatchService, PickupDirectoryEmailDispatchService>();
builder.Services.AddHostedService<EmailDispatchBackgroundService>();
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("auth", limiterOptions =>
    {
        limiterOptions.PermitLimit = 10;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 0;
    });
    options.AddFixedWindowLimiter("license", limiterOptions =>
    {
        limiterOptions.PermitLimit = 30;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 0;
    });
});

var disableAuth = builder.Configuration.GetValue("Auth:DisableAuth", builder.Environment.IsDevelopment());
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireAssertion(ctx =>
        RoleClaims.HasAnyRole(ctx.User, "tenant_admin")));

    options.AddPolicy("ManagerOrAdmin", policy => policy.RequireAssertion(ctx =>
        RoleClaims.HasAnyRole(ctx.User, "tenant_admin", "branch_manager")));

    options.AddPolicy("CashierOrAbove", policy => policy.RequireAssertion(ctx =>
        RoleClaims.HasAnyRole(ctx.User, "tenant_admin", "branch_manager", "cashier")));
});

if (!disableAuth)
{
    var authority = builder.Configuration["Auth:Authority"] ?? "http://localhost:8081/realms/loomapos";
    var audience = builder.Configuration["Auth:Audience"] ?? "loomapos-api";

    builder.Services
        .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.Authority = authority;
            options.Audience = audience;
            options.RequireHttpsMetadata = false;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateAudience = true,
                NameClaimType = "preferred_username"
            };
        });
}

var otlpEndpoint = builder.Configuration["Observability:OtlpEndpoint"] ?? "http://localhost:4318";
builder.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddOtlpExporter(options => options.Endpoint = new Uri(otlpEndpoint)))
    .WithMetrics(metrics => metrics
        .AddAspNetCoreInstrumentation()
        .AddRuntimeInstrumentation()
        .AddOtlpExporter(options => options.Endpoint = new Uri(otlpEndpoint)));
builder.Logging.AddOpenTelemetry(options =>
{
    options.IncludeFormattedMessage = true;
    options.IncludeScopes = true;
    options.ParseStateValues = true;
    options.AddOtlpExporter(exporterOptions => exporterOptions.Endpoint = new Uri(otlpEndpoint));
});

var app = builder.Build();
RuntimeSecretGuard.Validate(app.Services, builder.Configuration, app.Environment);

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (!disableAuth)
{
    app.UseAuthentication();
}

app.UseAuthorization();
app.UseRateLimiter();
app.UseMiddleware<TenantContextMiddleware>();

using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var commerceSeedService = scope.ServiceProvider.GetRequiredService<ICommerceSeedService>();

    try
    {
        var migrations = dbContext.Database.GetMigrations();
        if (migrations.Any())
        {
            await dbContext.Database.MigrateAsync();
        }
        else
        {
            await dbContext.Database.EnsureCreatedAsync();
        }

        await commerceSeedService.EnsureSeedDataAsync(CancellationToken.None);
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Database migration failed or skipped.");
    }
}

app.MapHealthEndpoints();
app.MapCommercePublicEndpoints();
app.MapCommerceAuthCoreEndpoints();
app.MapCommerceCheckoutCoreEndpoints();
app.MapCommercePortalCoreEndpoints();
app.MapCommerceCustomerPortalPhase6Endpoints();
app.MapCommerceLicenseCoreEndpoints();
app.MapCommerceResellerPortalEndpoints();
app.MapInternalAdminAuthEndpoints();
app.MapInternalAdminEndpoints();
app.MapAnalyticsEndpoints();
app.MapPhase9IntegrationEndpoints();
app.MapProductionOpsEndpoints();
app.MapSyncEndpoints();

var api = app.MapGroup(string.Empty);
if (!disableAuth)
{
    api.RequireAuthorization("CashierOrAbove");
}

var managerApi = api.MapGroup(string.Empty);
var adminApi = api.MapGroup(string.Empty);
if (!disableAuth)
{
    managerApi.RequireAuthorization("ManagerOrAdmin");
    adminApi.RequireAuthorization("AdminOnly");
}

api.MapFileEndpoints();
api.MapCommerceProtectedEndpoints();

managerApi.MapInventoryEndpoints();
managerApi.MapReportsEndpoints();
managerApi.MapContactsEndpoints();
managerApi.MapSalesEndpoints();
managerApi.MapCatalogEndpoints();
managerApi.MapIntegrationEndpoints();

adminApi.MapIdentityEndpoints();
adminApi.MapCashbookEndpoints();

app.Run();

public partial class Program;
