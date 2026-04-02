using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using LoomaPos.Api.Common;
using LoomaPos.Api.Commerce;
using LoomaPos.Domain.Auditing;
using LoomaPos.Domain.Commerce;
using LoomaPos.Domain.Identity;
using LoomaPos.Infrastructure.Payments;
using LoomaPos.Infrastructure.MultiTenancy;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace LoomaPos.Api.Endpoints;

public static class CommerceEndpoints
{
    public static IEndpointRouteBuilder MapCommercePublicEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/commerce").WithTags("Commerce");

        group.MapGet("/plans", GetPlansAsync)
            .WithName("GetCommercePlans")
            .WithSummary("Gets active subscription plans for marketing and checkout.");

        group.MapPost("/checkout", CheckoutAsync)
            .WithName("CommerceCheckout")
            .WithSummary("Deprecated legacy checkout endpoint. Use /commerce/checkout/session.");

        group.MapGet("/portal/me", GetPortalMeAsync)
            .WithName("CommercePortal")
            .WithSummary("Gets customer subscription portal data for authenticated tenant.");

        group.MapPost("/reseller/apply", ApplyResellerAsync)
            .WithName("ApplyReseller")
            .WithSummary("Creates reseller application.");

        group.MapGet("/reseller/{code}/dashboard", GetResellerDashboardAsync)
            .WithName("GetResellerDashboard")
            .WithSummary("Gets reseller dashboard summary by referral code.");

        return app;
    }

    public static RouteGroupBuilder MapCommerceProtectedEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/license/activate", ActivateLicenseAsync)
            .WithName("ActivateLicense")
            .WithSummary("Activates tenant license on current device and enforces device limits.");

        group.MapGet("/license/status", GetLicenseStatusAsync)
            .WithName("GetLicenseStatus")
            .WithSummary("Gets current tenant license status for desktop/mobile runtime checks.");

        return group;
    }

    private static async Task<IResult> GetPlansAsync(AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var plans = await dbContext.Plans.AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.MonthlyPrice == 0 ? decimal.MaxValue : x.MonthlyPrice)
            .ToListAsync(cancellationToken);

        return Results.Ok(plans.Select(plan => new PlanResponse(
            plan.Code,
            plan.Name,
            plan.MonthlyPrice,
            plan.YearlyPrice,
            plan.MaxBranches,
            plan.MaxUsers,
            plan.MaxDevices,
            ParseFeatures(plan.FeaturesJson))));
    }

    private static Task<IResult> CheckoutAsync(
        CommerceCheckoutRequest request,
        AppDbContext dbContext,
        IPaymentProvider paymentProvider,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        _ = request;
        _ = dbContext;
        _ = paymentProvider;
        _ = configuration;
        _ = cancellationToken;

        return Task.FromResult(Results.Conflict(new
        {
            error = "legacy_checkout_endpoint_disabled",
            message = "Use /commerce/checkout/session and provider-verified completion flow."
        }) as IResult);
    }

    private static async Task<IResult> GetPortalMeAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        AppDbContext dbContext,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        var logger = loggerFactory.CreateLogger("CommercePortal");
        var access = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (access is null)
        {
            logger.LogWarning(
                "portal_access_denied reason {Reason} path {Path} requestId {RequestId} actor {Actor}",
                "missing_or_invalid_session",
                httpContext.Request.Path.Value ?? "/commerce/portal/me",
                httpContext.TraceIdentifier,
                "anonymous");
            return Results.Unauthorized();
        }

        if (!access.TenantId.HasValue || access.TenantId.Value == Guid.Empty)
        {
            logger.LogWarning(
                "portal_access_denied reason {Reason} path {Path} requestId {RequestId} actor {Actor}",
                "tenant_context_missing",
                httpContext.Request.Path.Value ?? "/commerce/portal/me",
                httpContext.TraceIdentifier,
                access.Email);
            return Results.Unauthorized();
        }

        if (!TryResolveExplicitTenantContext(httpContext, out var explicitTenantId))
        {
            logger.LogWarning(
                "portal_access_denied reason {Reason} path {Path} requestId {RequestId} actor {Actor}",
                "invalid_explicit_tenant_context",
                httpContext.Request.Path.Value ?? "/commerce/portal/me",
                httpContext.TraceIdentifier,
                access.Email);
            return Results.Json(
                new { error = "cross-tenant access forbidden" },
                statusCode: StatusCodes.Status403Forbidden);
        }

        var tenantId = access.TenantId.Value;
        if (explicitTenantId.HasValue && explicitTenantId.Value != tenantId)
        {
            logger.LogWarning(
                "portal_access_denied reason {Reason} path {Path} requestId {RequestId} actor {Actor} authenticatedTenantId {AuthenticatedTenantId} requestedTenantId {RequestedTenantId}",
                "cross_tenant_access_attempt",
                httpContext.Request.Path.Value ?? "/commerce/portal/me",
                httpContext.TraceIdentifier,
                access.Email,
                tenantId,
                explicitTenantId.Value);
            return Results.Json(
                new { error = "cross-tenant access forbidden" },
                statusCode: StatusCodes.Status403Forbidden);
        }
        var tenant = await dbContext.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return Results.NotFound();
        }

        var subscription = await dbContext.Subscriptions.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        var invoices = await dbContext.Invoices.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(12)
            .Select(x => new InvoicePortalItemResponse(
                x.InvoiceNo,
                x.Total,
                x.Currency,
                x.Status,
                x.IssuedAt,
                x.PaidAt))
            .ToListAsync(cancellationToken);

        var latestLicense = await dbContext.IssuedLicenses.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        var activeDevices = await dbContext.DeviceActivations.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.RevokedAt == null)
            .OrderByDescending(x => x.LastSeenAt)
            .Select(x => new DevicePortalItemResponse(
                x.DeviceId,
                x.DeviceName,
                x.Platform,
                x.AppVersion,
                x.ActivatedAt,
                x.LastSeenAt))
            .ToListAsync(cancellationToken);

        return Results.Ok(new CommercePortalResponse(
            tenant.Id,
            tenant.Name,
            subscription is null
                ? null
                : new SubscriptionPortalResponse(
                    subscription.PlanCode,
                    subscription.BillingCycle,
                    subscription.Status,
                    subscription.CurrentPeriodStart,
                    subscription.CurrentPeriodEnd),
            latestLicense is null
                ? null
                : new LicensePortalResponse(
                    latestLicense.PlanCode,
                    latestLicense.ExpiresAt,
                    latestLicense.GraceDays,
                    latestLicense.Status),
            invoices,
            activeDevices));
    }

    private static bool TryResolveExplicitTenantContext(HttpContext httpContext, out Guid? explicitTenantId)
    {
        explicitTenantId = null;

        var queryTenant = httpContext.Request.Query["tenantId"].ToString();
        if (!string.IsNullOrWhiteSpace(queryTenant))
        {
            if (!Guid.TryParse(queryTenant, out var parsedQueryTenant))
            {
                return false;
            }

            explicitTenantId = parsedQueryTenant;
            return true;
        }

        var headerTenant = httpContext.Request.Headers["X-Tenant-Id"].ToString();
        if (!string.IsNullOrWhiteSpace(headerTenant))
        {
            if (!Guid.TryParse(headerTenant, out var parsedHeaderTenant))
            {
                return false;
            }

            explicitTenantId = parsedHeaderTenant;
        }

        return true;
    }

    private static async Task<IResult> ApplyResellerAsync(
        ResellerApplyRequest request,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Email))
        {
            return Results.BadRequest(new { error = "name and email are required." });
        }

        var email = request.Email.Trim().ToLowerInvariant();
        var existing = await dbContext.ResellerAccounts
            .FirstOrDefaultAsync(x => x.Email == email, cancellationToken);
        if (existing is not null)
        {
            existing.Name = request.Name.Trim();
            existing.CompanyName = NormalizeNullable(request.CompanyName);
            existing.City = NormalizeNullable(request.City);
            existing.Phone = NormalizeNullable(request.Phone);
            existing.WebsiteOrSocialProof = NormalizeNullable(request.WebsiteOrSocialProof);
            existing.Experience = NormalizeNullable(request.Experience);
            existing.Message = NormalizeNullable(request.Message);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Results.Ok(new ResellerApplyResponse(existing.Code, existing.Status, existing.CommissionRate));
        }

        var baseCode = BuildResellerCode(request.Name);
        var code = baseCode;
        var counter = 1;
        while (await dbContext.ResellerAccounts.AsNoTracking().AnyAsync(x => x.Code == code, cancellationToken))
        {
            counter += 1;
            code = $"{baseCode}{counter:00}";
        }

        var reseller = new ResellerAccount
        {
            Code = code,
            Name = request.Name.Trim(),
            CompanyName = NormalizeNullable(request.CompanyName),
            City = NormalizeNullable(request.City),
            Phone = NormalizeNullable(request.Phone),
            Email = email,
            WebsiteOrSocialProof = NormalizeNullable(request.WebsiteOrSocialProof),
            Experience = NormalizeNullable(request.Experience),
            Message = NormalizeNullable(request.Message),
            Status = "pending",
            CommissionRate = request.CommissionRate is > 0 and <= 1 ? request.CommissionRate.Value : 0.10m
        };

        dbContext.ResellerAccounts.Add(reseller);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new ResellerApplyResponse(reseller.Code, reseller.Status, reseller.CommissionRate));
    }

    private static async Task<IResult> ProcessPaymentWebhookAsync(
        PaymentWebhookRequest request,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Provider) || string.IsNullOrWhiteSpace(request.EventId))
        {
            return Results.BadRequest(new { error = "provider and eventId are required." });
        }

        var provider = NormalizeCode(request.Provider, "mock");
        var eventId = request.EventId.Trim();
        var now = DateTimeOffset.UtcNow;

        var existing = await dbContext.PaymentWebhooks
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Provider == provider && x.EventId == eventId, cancellationToken);
        if (existing is not null)
        {
            return Results.Ok(new { alreadyProcessed = true, message = "Webhook already processed." });
        }

        var webhook = new PaymentWebhook
        {
            Provider = provider,
            EventId = eventId,
            PayloadJson = request.PayloadJson ?? "{}",
            Status = "received",
            ReceivedAt = now
        };
        dbContext.PaymentWebhooks.Add(webhook);

        if (!string.IsNullOrWhiteSpace(request.PaymentRef))
        {
            try
            {
                var payment = await dbContext.SubscriptionPayments
                    .FirstOrDefaultAsync(x => x.PaymentRef == request.PaymentRef.Trim(), cancellationToken);

                if (payment is not null)
                {
                    var status = NormalizeCode(request.PaymentStatus, "paid");
                    payment.Status = status;
                    payment.PaidAt = status == "paid" ? now : payment.PaidAt;
                }
            }
            catch (Exception ex)
            {
                webhook.Error = ex.Message;
            }
        }

        webhook.Status = "processed";
        webhook.ProcessedAt = now;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new { alreadyProcessed = false, message = "Webhook processed." });
    }

    private static async Task<IResult> GetResellerDashboardAsync(
        string code,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var normalizedCode = NormalizeCode(code, string.Empty);
        var reseller = await dbContext.ResellerAccounts.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Code == normalizedCode, cancellationToken);
        if (reseller is null)
        {
            return Results.NotFound();
        }

        var customerCount = await dbContext.ResellerCustomers.AsNoTracking()
            .CountAsync(x => x.ResellerId == reseller.Id, cancellationToken);

        var commissions = await dbContext.Commissions.AsNoTracking()
            .Where(x => x.ResellerId == reseller.Id)
            .OrderByDescending(x => x.CreatedAt)
            .Take(50)
            .ToListAsync(cancellationToken);

        var accrued = commissions.Where(x => x.Status == "accrued").Sum(x => x.Amount);
        var paid = commissions.Where(x => x.Status == "paid").Sum(x => x.Amount);

        return Results.Ok(new ResellerDashboardResponse(
            reseller.Code,
            reseller.Name,
            reseller.Status,
            reseller.CommissionRate,
            customerCount,
            accrued,
            paid,
            commissions.Select(x => new CommissionItemResponse(
                x.Id,
                x.TenantId,
                x.Amount,
                x.Rate,
                x.Status,
                x.AccruedAt,
                x.PaidAt)).ToList()));
    }

    private static async Task<IResult> ActivateLicenseAsync(
        LicenseActivateRequest request,
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!tenantProvider.TenantId.HasValue)
        {
            return Results.BadRequest(new { error = "tenant context is required." });
        }

        var tenantId = tenantProvider.TenantId.Value;
        var now = DateTimeOffset.UtcNow;
        var deviceId = request.DeviceId ?? tenantProvider.DeviceId;
        if (!deviceId.HasValue)
        {
            return Results.BadRequest(new { error = "deviceId is required." });
        }

        var license = await dbContext.IssuedLicenses
            .Where(x => x.TenantId == tenantId && x.Status == "active")
            .OrderByDescending(x => x.ExpiresAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (license is null)
        {
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        }

        var mode = ResolveLicenseMode(now, license.ExpiresAt, license.GraceDays);
        if (mode == "LOCKED")
        {
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        }

        var activeCount = await dbContext.DeviceActivations
            .CountAsync(x => x.TenantId == tenantId && x.RevokedAt == null, cancellationToken);

        var existingActivation = await dbContext.DeviceActivations
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.DeviceId == deviceId.Value, cancellationToken);

        if (existingActivation is null && license.DeviceLimit.HasValue && activeCount >= license.DeviceLimit.Value)
        {
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        }

        if (existingActivation is null)
        {
            existingActivation = new DeviceActivation
            {
                TenantId = tenantId,
                DeviceId = deviceId.Value,
                DeviceName = request.DeviceName?.Trim() is { Length: > 0 } name ? name : $"Device-{deviceId.Value.ToString()[..8]}",
                Platform = NormalizeCode(request.Platform, "desktop"),
                AppVersion = NormalizeNullable(request.AppVersion),
                ActivationSource = NormalizeCode(request.Source, "desktop"),
                ActivatedAt = now,
                LastSeenAt = now
            };
            dbContext.DeviceActivations.Add(existingActivation);
        }
        else
        {
            existingActivation.DeviceName = request.DeviceName?.Trim() is { Length: > 0 } name ? name : existingActivation.DeviceName;
            existingActivation.Platform = NormalizeCode(request.Platform, existingActivation.Platform);
            existingActivation.AppVersion = NormalizeNullable(request.AppVersion) ?? existingActivation.AppVersion;
            existingActivation.LastSeenAt = now;
            existingActivation.RevokedAt = null;
        }

        dbContext.LicenseEvents.Add(new LicenseEvent
        {
            TenantId = tenantId,
            LicenseId = license.Id,
            EventType = existingActivation.ActivatedAt == now ? "DEVICE_ACTIVATED" : "DEVICE_HEARTBEAT",
            PayloadJson = JsonSerializer.Serialize(new
            {
                deviceId = existingActivation.DeviceId,
                existingActivation.DeviceName,
                existingActivation.Platform,
                existingActivation.AppVersion,
                mode
            }),
            CreatedAt = now
        });

        AuditLogWriter.Add(
            dbContext,
            tenantProvider,
            tenantId,
            "LICENSE_DEVICE_ACTIVATED",
            "device_activations",
            existingActivation.Id.ToString(),
            new
            {
                existingActivation.DeviceId,
                existingActivation.DeviceName,
                existingActivation.Platform,
                mode
            });

        await dbContext.SaveChangesAsync(cancellationToken);

        var freshActiveCount = await dbContext.DeviceActivations.AsNoTracking()
            .CountAsync(x => x.TenantId == tenantId && x.RevokedAt == null, cancellationToken);

        return Results.Ok(new LicenseActivationResponse(
            license.LicenseToken,
            license.PlanCode,
            mode,
            license.ExpiresAt,
            license.GraceDays,
            license.DeviceLimit,
            freshActiveCount,
            ParseFeatures(license.FeaturesJson),
            now.AddDays(license.GraceDays)));
    }

    private static async Task<IResult> GetLicenseStatusAsync(
        ITenantProvider tenantProvider,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!tenantProvider.TenantId.HasValue)
        {
            return Results.BadRequest(new { error = "tenant context is required." });
        }

        var tenantId = tenantProvider.TenantId.Value;
        var now = DateTimeOffset.UtcNow;
        var license = await dbContext.IssuedLicenses.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.Status == "active")
            .OrderByDescending(x => x.ExpiresAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (license is null)
        {
            return Results.NotFound();
        }

        var deviceCount = await dbContext.DeviceActivations.AsNoTracking()
            .CountAsync(x => x.TenantId == tenantId && x.RevokedAt == null, cancellationToken);
        var mode = ResolveLicenseMode(now, license.ExpiresAt, license.GraceDays);

        return Results.Ok(new LicenseStatusResponse(
            license.PlanCode,
            mode,
            license.ExpiresAt,
            license.GraceDays,
            license.DeviceLimit,
            deviceCount,
            ParseFeatures(license.FeaturesJson)));
    }

    private static string NormalizeCode(string? input, string fallback)
    {
        var normalized = input?.Trim().ToLowerInvariant();
        return string.IsNullOrWhiteSpace(normalized) ? fallback : normalized;
    }

    private static string NormalizeBillingCycle(string? cycle)
    {
        var normalized = NormalizeCode(cycle, "monthly");
        return normalized is "monthly" or "yearly" ? normalized : "monthly";
    }

    private static string? NormalizeNullable(string? input)
    {
        var normalized = input?.Trim();
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
    }

    private static string BuildInvoiceNo(DateTimeOffset now)
    {
        return $"INV-{now:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}";
    }

    private static string BuildLicenseToken(
        IConfiguration configuration,
        Guid tenantId,
        string planCode,
        string billingCycle,
        int? maxBranches,
        int? maxUsers,
        int? maxDevices,
        string featuresJson,
        DateTimeOffset expiresAt,
        int graceDays)
    {
        var signingKey = configuration["Licensing:SigningKey"] ?? "loomapos-dev-license-key-change-me";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: "loomapos-api",
            audience: "loomapos-clients",
            claims:
            [
                new Claim("tenant_id", tenantId.ToString()),
                new Claim("plan", planCode),
                new Claim("billing_cycle", billingCycle),
                new Claim("max_branches", maxBranches?.ToString() ?? string.Empty),
                new Claim("max_users", maxUsers?.ToString() ?? string.Empty),
                new Claim("max_devices", maxDevices?.ToString() ?? string.Empty),
                new Claim("features", featuresJson),
                new Claim("grace_days", graceDays.ToString())
            ],
            notBefore: DateTime.UtcNow.AddMinutes(-1),
            expires: expiresAt.UtcDateTime,
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string ResolveLicenseMode(DateTimeOffset now, DateTimeOffset expiresAt, int graceDays)
    {
        if (now <= expiresAt)
        {
            return "ACTIVE";
        }

        return now <= expiresAt.AddDays(graceDays) ? "READ_ONLY" : "LOCKED";
    }

    private static string[] ParseFeatures(string featuresJson)
    {
        try
        {
            return JsonSerializer.Deserialize<string[]>(featuresJson) ?? [];
        }
        catch
        {
            return [];
        }
    }

    private static string BuildResellerCode(string name)
    {
        var alnum = new string(name.Trim().ToUpperInvariant().Where(char.IsLetterOrDigit).ToArray());
        var prefix = string.IsNullOrWhiteSpace(alnum) ? "RSL" : alnum[..Math.Min(6, alnum.Length)];
        return $"{prefix}{Random.Shared.Next(100, 999)}";
    }

    public sealed record PlanResponse(
        string Code,
        string Name,
        decimal MonthlyPrice,
        decimal YearlyPrice,
        int? MaxBranches,
        int? MaxUsers,
        int? MaxDevices,
        string[] Features);

    public sealed record CommerceCheckoutRequest(
        string CompanyName,
        string Email,
        string? ContactName,
        string? PlanCode,
        string? BillingCycle,
        string? Provider,
        string? ResellerCode);

    public sealed record DownloadLinksResponse(
        string DesktopWindows,
        string MobileAndroid,
        string MobileIos);

    public sealed record CommerceCheckoutResponse(
        Guid TenantId,
        Guid SubscriptionId,
        string PlanCode,
        string BillingCycle,
        string InvoiceNo,
        decimal Amount,
        string Provider,
        string LicenseToken,
        DateTimeOffset ExpiresAt,
        DownloadLinksResponse Downloads,
        string PortalUrl);

    public sealed record CommercePortalResponse(
        Guid TenantId,
        string TenantName,
        SubscriptionPortalResponse? Subscription,
        LicensePortalResponse? License,
        IReadOnlyList<InvoicePortalItemResponse> Invoices,
        IReadOnlyList<DevicePortalItemResponse> Devices);

    public sealed record SubscriptionPortalResponse(
        string PlanCode,
        string BillingCycle,
        string Status,
        DateTimeOffset CurrentPeriodStart,
        DateTimeOffset CurrentPeriodEnd);

    public sealed record LicensePortalResponse(
        string PlanCode,
        DateTimeOffset ExpiresAt,
        int GraceDays,
        string Status);

    public sealed record InvoicePortalItemResponse(
        string InvoiceNo,
        decimal Total,
        string Currency,
        string Status,
        DateTimeOffset IssuedAt,
        DateTimeOffset? PaidAt);

    public sealed record DevicePortalItemResponse(
        Guid DeviceId,
        string DeviceName,
        string Platform,
        string? AppVersion,
        DateTimeOffset ActivatedAt,
        DateTimeOffset LastSeenAt);

    public sealed record ResellerApplyRequest(
        string Name,
        string Email,
        string? CompanyName,
        string? City,
        string? Phone,
        string? WebsiteOrSocialProof,
        string? Experience,
        string? Message,
        decimal? CommissionRate);

    public sealed record PaymentWebhookRequest(
        string Provider,
        string EventId,
        string? PaymentRef,
        string? PaymentStatus,
        string? PayloadJson);

    public sealed record ResellerApplyResponse(
        string Code,
        string Status,
        decimal CommissionRate);

    public sealed record ResellerDashboardResponse(
        string Code,
        string Name,
        string Status,
        decimal CommissionRate,
        int CustomerCount,
        decimal AccruedTotal,
        decimal PaidTotal,
        IReadOnlyList<CommissionItemResponse> Commissions);

    public sealed record CommissionItemResponse(
        Guid Id,
        Guid TenantId,
        decimal Amount,
        decimal Rate,
        string Status,
        DateTimeOffset AccruedAt,
        DateTimeOffset? PaidAt);

    public sealed record LicenseActivateRequest(
        Guid? DeviceId,
        string? DeviceName,
        string? Platform,
        string? AppVersion,
        string? Source);

    public sealed record LicenseActivationResponse(
        string LicenseToken,
        string PlanCode,
        string Mode,
        DateTimeOffset ExpiresAt,
        int GraceDays,
        int? MaxDevices,
        int ActiveDevices,
        string[] Features,
        DateTimeOffset OfflineGraceUntil);

    public sealed record LicenseStatusResponse(
        string PlanCode,
        string Mode,
        DateTimeOffset ExpiresAt,
        int GraceDays,
        int? MaxDevices,
        int ActiveDevices,
        string[] Features);
}
