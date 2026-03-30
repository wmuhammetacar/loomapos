using LoomaPos.Api.Endpoints;
using LoomaPos.Api.Commerce;
using LoomaPos.Api.Analytics;
using LoomaPos.Api.Integrations;
using LoomaPos.Api.Ops;
using LoomaPos.Api.Middleware;
using LoomaPos.Api.Security;
using LoomaPos.Infrastructure;
using LoomaPos.Infrastructure.Persistence;
using System.Security.Claims;
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
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = (rateLimitContext, _) =>
    {
        var httpContext = rateLimitContext.HttpContext;
        var logger = httpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("RateLimiter");

        var endpoint = httpContext.GetEndpoint();
        var policyName = endpoint?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName ?? "unknown";
        var tenantId = ResolveRateLimitGuid(httpContext, "tenant_id", "tenantId", "tenant");
        var deviceId = ResolveRateLimitGuid(httpContext, "device_id", "deviceId");
        var clientIp = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var clientIdentity = ResolveRateLimitClientIdentity(httpContext);

        logger.LogWarning(
            "rate_limit_rejected policy {PolicyName} method {Method} path {Path} requestId {RequestId} clientIdentity {ClientIdentity} clientIp {ClientIp} tenantId {TenantId} deviceId {DeviceId}",
            policyName,
            httpContext.Request.Method,
            httpContext.Request.Path.Value ?? "/",
            httpContext.TraceIdentifier,
            clientIdentity,
            clientIp,
            tenantId,
            deviceId);

        return ValueTask.CompletedTask;
    };

    options.AddFixedWindowLimiter("auth", limiterOptions =>
    {
        limiterOptions.PermitLimit = 12;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 0;
    });

    options.AddFixedWindowLimiter("auth-refresh", limiterOptions =>
    {
        limiterOptions.PermitLimit = 40;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 0;
    });

    options.AddFixedWindowLimiter("license", limiterOptions =>
    {
        limiterOptions.PermitLimit = 60;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 0;
    });

    options.AddFixedWindowLimiter("license-activation", limiterOptions =>
    {
        limiterOptions.PermitLimit = 24;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 0;
    });

    options.AddFixedWindowLimiter("license-heartbeat", limiterOptions =>
    {
        limiterOptions.PermitLimit = 240;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 0;
    });

    options.AddFixedWindowLimiter("sync-push", limiterOptions =>
    {
        limiterOptions.PermitLimit = 360;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 0;
    });

    options.AddFixedWindowLimiter("internal-auth", limiterOptions =>
    {
        limiterOptions.PermitLimit = 12;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 0;
    });

    options.AddFixedWindowLimiter("internal-mutation", limiterOptions =>
    {
        limiterOptions.PermitLimit = 60;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueLimit = 0;
    });
});

var corsOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>()
    ?? builder.Configuration["Cors:AllowedOrigins"]?
        .Split(new[] { ",", ";" }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    ?? new[]
    {
        "http://127.0.0.1:3100",
        "http://localhost:3100",
        "http://127.0.0.1:3300",
        "http://localhost:3300",
        "http://127.0.0.1:4200",
        "http://localhost:4200",
        "http://127.0.0.1:5000",
        "http://localhost:5000"
    };

builder.Services.AddCors(options =>
{
    options.AddPolicy("loomapos-frontends", policy =>
    {
        policy
            .WithOrigins(corsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
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
var startupLogger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");

try
{
    RuntimeSecretGuard.Validate(app.Services, builder.Configuration, app.Environment);
}
catch (Exception ex)
{
    startupLogger.LogCritical(
        ex,
        "startup_configuration_validation_failed phase {StartupPhase} environment {EnvironmentName}",
        "runtime_secret_guard",
        app.Environment.EnvironmentName);
    throw;
}

app.UseExceptionHandler();
app.UseCors("loomapos-frontends");

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
app.UseMiddleware<RequestLifecycleLoggingMiddleware>();

using (var scope = app.Services.CreateScope())
{
    var migrationLogger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Startup.Migration");
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var commerceSeedService = scope.ServiceProvider.GetRequiredService<ICommerceSeedService>();

    try
    {
        migrationLogger.LogInformation(
            "startup_database_initialization_started phase {StartupPhase} provider {DatabaseProvider}",
            "database_migration",
            dbContext.Database.ProviderName ?? "unknown");

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

        migrationLogger.LogInformation(
            "startup_database_initialization_completed phase {StartupPhase} provider {DatabaseProvider}",
            "database_migration",
            dbContext.Database.ProviderName ?? "unknown");
    }
    catch (Exception ex)
    {
        migrationLogger.LogCritical(
            ex,
            "startup_database_initialization_failed phase {StartupPhase} provider {DatabaseProvider}",
            "database_migration",
            dbContext.Database.ProviderName ?? "unknown");
        throw;
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
managerApi.MapManufacturingPreparationEndpoints();
managerApi.MapReportsEndpoints();
managerApi.MapContactsEndpoints();
managerApi.MapSalesEndpoints();
managerApi.MapCatalogEndpoints();
managerApi.MapIntegrationEndpoints();
managerApi.MapAccountingBridgeEndpoints();

adminApi.MapIdentityEndpoints();
adminApi.MapCashbookEndpoints();

app.Run();

static string ResolveRateLimitClientIdentity(HttpContext context)
{
    var actor = context.User.FindFirstValue("preferred_username")
        ?? context.User.FindFirstValue(ClaimTypes.Email)
        ?? context.User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? context.User.FindFirstValue("sub");

    if (!string.IsNullOrWhiteSpace(actor))
    {
        return actor;
    }

    return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}

static string? ResolveRateLimitGuid(HttpContext context, params string[] keys)
{
    foreach (var key in keys)
    {
        var claimValue = context.User.FindFirstValue(key);
        if (Guid.TryParse(claimValue, out var claimGuid))
        {
            return claimGuid.ToString();
        }
    }

    return null;
}

public partial class Program;
