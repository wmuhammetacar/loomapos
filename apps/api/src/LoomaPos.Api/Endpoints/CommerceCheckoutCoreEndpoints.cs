using LoomaPos.Api.Commerce;
using LoomaPos.Infrastructure.Payments;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class CommerceCheckoutCoreEndpoints
{
    public static IEndpointRouteBuilder MapCommerceCheckoutCoreEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/commerce").WithTags("Commerce Checkout");

        group.MapGet("/pricing", GetPricingAsync)
            .WithName("GetPricing")
            .WithSummary("Gets public pricing catalog with monthly/yearly plan prices.");

        group.MapPost("/checkout/session", CreateCheckoutSessionAsync)
            .WithName("CreateCheckoutSession")
            .WithSummary("Creates a checkout session and starts provider-side payment flow.");

        group.MapGet("/checkout/status/{checkoutSessionId:guid}", GetCheckoutStatusAsync)
            .WithName("GetCheckoutStatus")
            .WithSummary("Gets checkout, payment and provisioning status.");

        group.MapPost("/payments/webhooks", PaymentWebhookAsync)
            .WithName("CommerceWebhook")
            .WithSummary("Verifies and processes payment provider webhooks.");

        group.MapGet("/downloads/public", ListPublicDownloadsAsync)
            .WithName("ListPublicDownloads")
            .WithSummary("Lists public download teaser entries.");

        group.MapGet("/reseller/referral/{code}", ValidateReferralAsync)
            .WithName("ValidateReferralCode")
            .WithSummary("Validates a reseller/referral code for checkout.");

        group.MapPost("/checkout/referral", AttachReferralAsync)
            .WithName("AttachReferral")
            .WithSummary("Attaches and validates a reseller referral during checkout.");

        return app;
    }

    private static async Task<IResult> GetPricingAsync(
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var plans = await dbContext.SubscriptionPlans.AsNoTracking()
            .Where(x => x.IsPublic && x.IsActive)
            .OrderBy(x => x.DeviceLimit ?? int.MaxValue)
            .ToListAsync(cancellationToken);
        var prices = await dbContext.PlanPrices.AsNoTracking()
            .Where(x => x.IsActive)
            .ToListAsync(cancellationToken);
        var planFeatures = await (
            from link in dbContext.PlanFeatureFlags.AsNoTracking()
            join feature in dbContext.FeatureFlags.AsNoTracking() on link.FeatureFlagId equals feature.Id
            where link.IsEnabled && feature.IsActive
            select new { link.SubscriptionPlanId, feature.Code, feature.Name })
            .ToListAsync(cancellationToken);

        var response = plans.Select(plan => new PricingPlanResponse(
            plan.Id,
            plan.Code,
            plan.Name,
            plan.Description,
            plan.BranchLimit,
            plan.UserLimit,
            plan.DeviceLimit,
            plan.SupportTier,
            plan.ResellerCommissionEligibility,
            plan.HighlightLabel,
            prices.Where(price => price.SubscriptionPlanId == plan.Id)
                .Select(price => new PlanPriceResponse(
                    price.Id,
                    price.BillingPeriod,
                    price.Currency,
                    price.Amount,
                    price.PromoAmount,
                    price.TrialDays))
                .OrderBy(x => x.BillingPeriod)
                .ToList(),
            planFeatures.Where(feature => feature.SubscriptionPlanId == plan.Id)
                .Select(feature => new FeatureFlagResponse(feature.Code, feature.Name))
                .ToList()));

        return Results.Ok(response);
    }

    private static async Task<IResult> CreateCheckoutSessionAsync(
        CheckoutCreateRequest request,
        ICommerceProvisioningService provisioningService,
        CancellationToken cancellationToken)
    {
        var snapshot = await provisioningService.CreateCheckoutSessionAsync(
            new CreateCheckoutSessionCommand(
                request.PlanCode,
                request.BillingPeriod,
                request.FullName,
                request.CompanyName,
                request.Email,
                request.Password,
                request.Phone,
                request.BillingTitle,
                string.IsNullOrWhiteSpace(request.BillingEmail) ? request.Email : request.BillingEmail,
                request.TaxOffice,
                request.TaxNumber,
                request.AddressLine,
                request.City,
                string.IsNullOrWhiteSpace(request.Country) ? "TR" : request.Country,
                string.IsNullOrWhiteSpace(request.Locale) ? "tr-TR" : request.Locale,
                request.PaymentMethod,
                request.Provider,
                request.ResellerCode,
                request.CouponCode,
                request.SuccessUrl,
                request.CancelUrl),
            cancellationToken);

        return Results.Ok(snapshot);
    }

    private static async Task<IResult> GetCheckoutStatusAsync(
        Guid checkoutSessionId,
        HttpContext httpContext,
        ICommerceProvisioningService provisioningService,
        IPortalAuthService authService,
        CancellationToken cancellationToken)
    {
        var snapshot = await provisioningService.GetCheckoutStatusAsync(checkoutSessionId, cancellationToken);
        if (snapshot is null)
        {
            return Results.NotFound();
        }

        CommerceAuthCoreEndpoints.PortalAuthResponse? auth = null;
        if (snapshot.Status == "provisioned" && snapshot.CustomerAccountId.HasValue)
        {
            var existingAccess = await authService.GetAccessContextAsync(httpContext, cancellationToken);
            if (existingAccess is null || existingAccess.CustomerAccountId != snapshot.CustomerAccountId.Value)
            {
                var session = await authService.CreateCustomerPortalSessionAsync(
                    snapshot.CustomerAccountId.Value,
                    snapshot.TenantId,
                    httpContext,
                    cancellationToken);
                auth = new CommerceAuthCoreEndpoints.PortalAuthResponse(
                    session.AccessToken,
                    session.RefreshToken,
                    session.ExpiresAt,
                    session.RefreshExpiresAt,
                    session.PortalType,
                    session.Roles,
                    session.Email,
                    session.DisplayName,
                    session.TenantId,
                    session.CompanyName,
                    session.ResellerCode);
            }
        }

        return Results.Ok(new CheckoutStatusResponse(snapshot, auth));
    }

    private static async Task<IResult> PaymentWebhookAsync(
        PaymentWebhookBody request,
        IPaymentProviderResolver paymentProviderResolver,
        ICommerceProvisioningService provisioningService,
        CancellationToken cancellationToken)
    {
        var provider = paymentProviderResolver.Resolve(request.Provider);
        var verification = await provider.VerifyWebhookAsync(
            new PaymentWebhookVerificationRequest(request.Provider, request.PayloadJson, request.Signature),
            cancellationToken);
        if (!verification.IsValid)
        {
            return Results.BadRequest(new { error = verification.Error ?? "invalid webhook" });
        }

        var snapshot = await provisioningService.ProcessPaymentWebhookAsync(
            request.Provider,
            verification.EventId,
            verification.PayloadJson,
            request.ProviderPaymentReference ?? verification.ProviderPaymentReference,
            verification.Status,
            cancellationToken);

        return Results.Ok(new
        {
            processed = snapshot is not null,
            snapshot
        });
    }

    private static async Task<IResult> ListPublicDownloadsAsync(
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var assets = await (
            from asset in dbContext.DownloadableAssets.AsNoTracking()
            join release in dbContext.AppReleases.AsNoTracking() on asset.AppReleaseId equals release.Id
            where asset.IsActive && release.IsActive && asset.Visibility == "public"
            select new
            {
                asset.Id,
                asset.Platform,
                asset.Label,
                asset.DownloadUrl,
                release.Version,
                release.ReleaseDate,
                release.ReleaseNotesMarkdown,
                release.InstallGuideMarkdown,
                release.MinimumRequirements
            }).ToListAsync(cancellationToken);

        return Results.Ok(assets);
    }

    private static async Task<IResult> ValidateReferralAsync(
        string code,
        ICommerceProvisioningService provisioningService,
        CancellationToken cancellationToken)
    {
        return Results.Ok(await provisioningService.ValidateReferralAsync(code, cancellationToken));
    }

    private static async Task<IResult> AttachReferralAsync(
        ReferralAttachRequest request,
        ICommerceProvisioningService provisioningService,
        CancellationToken cancellationToken)
    {
        return Results.Ok(await provisioningService.ValidateReferralAsync(request.Code, cancellationToken));
    }

    public sealed record PricingPlanResponse(
        Guid Id,
        string Code,
        string Name,
        string Description,
        int? BranchLimit,
        int? UserLimit,
        int? DeviceLimit,
        string SupportTier,
        bool ResellerCommissionEligibility,
        string HighlightLabel,
        IReadOnlyList<PlanPriceResponse> Prices,
        IReadOnlyList<FeatureFlagResponse> Features);

    public sealed record PlanPriceResponse(
        Guid Id,
        string BillingPeriod,
        string Currency,
        decimal Amount,
        decimal? PromoAmount,
        int TrialDays);

    public sealed record FeatureFlagResponse(string Code, string Name);

    public sealed record CheckoutCreateRequest(
        string PlanCode,
        string BillingPeriod,
        string FullName,
        string CompanyName,
        string Email,
        string Password,
        string? Phone,
        string BillingTitle,
        string? BillingEmail,
        string? TaxOffice,
        string? TaxNumber,
        string? AddressLine,
        string? City,
        string Country,
        string Locale,
        string PaymentMethod,
        string Provider,
        string? ResellerCode,
        string? CouponCode,
        string SuccessUrl,
        string CancelUrl);

    public sealed record PaymentWebhookBody(
        string Provider,
        string PayloadJson,
        string? Signature,
        string? ProviderPaymentReference);

    public sealed record CheckoutStatusResponse(
        CheckoutStatusSnapshot Checkout,
        CommerceAuthCoreEndpoints.PortalAuthResponse? PortalAccess);

    public sealed record ReferralAttachRequest(string Code);
}
