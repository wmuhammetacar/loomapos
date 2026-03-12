using System.Text.Json;
using LoomaPos.Api.Commerce;
using LoomaPos.Domain.Auditing;
using LoomaPos.Domain.Commerce;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class CommercePortalCoreEndpoints
{
    public static IEndpointRouteBuilder MapCommercePortalCoreEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/commerce/portal").WithTags("Commerce Portal");

        group.MapGet("/overview", GetPortalOverviewAsync)
            .WithName("GetPortalOverview")
            .WithSummary("Gets customer portal overview cards and summary.");

        group.MapGet("/subscription", GetPortalSubscriptionAsync)
            .WithName("GetPortalSubscription")
            .WithSummary("Gets current subscription detail.");

        group.MapPost("/subscription/cancel", CancelSubscriptionAsync)
            .WithName("CancelPortalSubscription")
            .WithSummary("Cancels subscription at period end.");

        group.MapPost("/subscription/change-plan", ChangePlanPlaceholderAsync)
            .WithName("ChangePlanPlaceholder")
            .WithSummary("Placeholder endpoint for future plan changes.");

        group.MapPost("/subscription/reactivate", ReactivatePlaceholderAsync)
            .WithName("ReactivateSubscriptionPlaceholder")
            .WithSummary("Placeholder endpoint for future reactivation flow.");

        group.MapGet("/subscription/renewal", GetRenewalInfoAsync)
            .WithName("GetRenewalInfo")
            .WithSummary("Gets renewal date and current billing period details.");

        group.MapGet("/licenses", ListPortalLicensesAsync)
            .WithName("ListPortalLicenses")
            .WithSummary("Lists licenses for current tenant.");

        group.MapGet("/licenses/active", GetActivePortalLicenseAsync)
            .WithName("GetActivePortalLicense")
            .WithSummary("Gets active license for current tenant.");

        group.MapGet("/licenses/{licenseId:guid}", GetPortalLicenseDetailAsync)
            .WithName("GetPortalLicenseDetail")
            .WithSummary("Gets detailed license information.");

        group.MapPost("/licenses/{licenseId:guid}/reissue", ReissueLicensePlaceholderAsync)
            .WithName("ReissueLicensePlaceholder")
            .WithSummary("Placeholder endpoint for future license reissue flow.");

        group.MapGet("/downloads", ListPortalDownloadsAsync)
            .WithName("ListPortalDownloads")
            .WithSummary("Lists authorized downloads for current tenant.");

        group.MapGet("/catalog/products", ListPortalCatalogProductsAsync)
            .WithName("ListPortalCatalogProducts")
            .WithSummary("Returns tenant product catalog snapshots for desktop/mobile offline caching.");

        group.MapGet("/downloads/releases/{releaseId:guid}/notes", GetReleaseNotesAsync)
            .WithName("GetReleaseNotes")
            .WithSummary("Gets release notes for a specific application release.");

        group.MapGet("/downloads/releases/{releaseId:guid}/install-guide", GetInstallGuideAsync)
            .WithName("GetInstallGuide")
            .WithSummary("Gets install guide for a specific application release.");

        group.MapGet("/billing", GetBillingHistoryAsync)
            .WithName("GetBillingHistory")
            .WithSummary("Gets invoice and payment transaction history.");

        group.MapGet("/billing/{invoiceId:guid}", GetInvoiceDetailAsync)
            .WithName("GetInvoiceDetail")
            .WithSummary("Gets invoice detail and invoice lines.");

        group.MapGet("/billing/{invoiceId:guid}/pdf", GetInvoicePdfAsync)
            .WithName("GetInvoicePdf")
            .WithSummary("Generates a downloadable invoice PDF for the current tenant.");

        group.MapGet("/devices", GetPortalDevicesAsync)
            .WithName("GetPortalDevices")
            .WithSummary("Lists activated devices for current tenant.");

        group.MapGet("/company", GetCompanyProfileAsync)
            .WithName("GetCompanyProfile")
            .WithSummary("Gets tenant and billing profile basics for the customer portal.");

        group.MapPut("/company", UpdateCompanyProfileAsync)
            .WithName("UpdateCompanyProfile")
            .WithSummary("Updates tenant and billing profile basics.");

        group.MapGet("/support-links", GetSupportLinksAsync)
            .WithName("GetSupportLinks")
            .WithSummary("Gets support and onboarding links for current tenant.");

        return app;
    }

    private static async Task<IResult> GetPortalOverviewAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }

        var subscription = await GetLatestSubscriptionAsync(dbContext, access.TenantId!.Value, cancellationToken);
        var license = await GetLatestLicenseAsync(dbContext, access.TenantId.Value, cancellationToken);
        var deviceCount = await dbContext.DeviceActivations.AsNoTracking()
            .CountAsync(x => x.TenantId == access.TenantId.Value && x.RevokedAt == null, cancellationToken);
        var invoice = await dbContext.Invoices.AsNoTracking()
            .Where(x => x.TenantId == access.TenantId.Value)
            .OrderByDescending(x => x.IssuedAt)
            .FirstOrDefaultAsync(cancellationToken);
        var downloads = await QueryPortalDownloadsAsync(dbContext, access.TenantId.Value, cancellationToken);

        return Results.Ok(new
        {
            companyName = access.CompanyName,
            activePlan = subscription?.PlanCode,
            renewalDate = subscription?.RenewalDate,
            billingPeriod = subscription?.BillingCycle,
            licenseStatus = license?.Status,
            activeDevices = deviceCount,
            latestInvoice = invoice is null ? null : new
            {
                invoice.Id,
                invoice.InvoiceNo,
                invoice.Total,
                invoice.Currency,
                invoice.Status,
                invoice.IssuedAt
            },
            downloads = downloads.Take(3).ToList()
        });
    }

    private static async Task<IResult> GetPortalSubscriptionAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }

        var subscription = await GetLatestSubscriptionAsync(dbContext, access.TenantId!.Value, cancellationToken);
        return subscription is null ? Results.NotFound() : Results.Ok(subscription);
    }

    private static async Task<IResult> CancelSubscriptionAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }

        var tenantId = access.TenantId!.Value;

        var subscription = await dbContext.Subscriptions
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (subscription is null)
        {
            return Results.NotFound();
        }

        subscription.CancelAtPeriodEnd = true;
        subscription.CanceledAt = DateTimeOffset.UtcNow;
        dbContext.AuditLogs.Add(BuildAudit(access, "portal.subscription.cancel_requested", "subscription", subscription.Id.ToString(), new
        {
            subscription.PlanCode,
            subscription.BillingCycle,
            effectiveAt = subscription.CurrentPeriodEnd
        }));
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new
        {
            subscription.Id,
            subscription.CancelAtPeriodEnd,
            subscription.CanceledAt
        });
    }

    private static async Task<IResult> ChangePlanPlaceholderAsync(
        ChangePlanRequest request,
        HttpContext httpContext,
        IPortalAuthService authService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }

        var tenantId = access.TenantId!.Value;

        var subscription = await dbContext.Subscriptions
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (subscription is null)
        {
            return Results.NotFound();
        }

        var plan = await dbContext.SubscriptionPlans.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Code == request.PlanCode && x.IsActive, cancellationToken);
        if (plan is null)
        {
            return Results.BadRequest(new { message = "Requested plan is not active." });
        }

        var featureFlags = await (
            from planFeature in dbContext.PlanFeatureFlags.AsNoTracking()
            join feature in dbContext.FeatureFlags.AsNoTracking() on planFeature.FeatureFlagId equals feature.Id
            where planFeature.SubscriptionPlanId == plan.Id && planFeature.IsEnabled && feature.IsActive
            select feature.Code)
            .ToListAsync(cancellationToken);

        var price = await dbContext.PlanPrices.AsNoTracking()
            .FirstOrDefaultAsync(x => x.SubscriptionPlanId == plan.Id && x.BillingPeriod == request.BillingCycle && x.IsActive, cancellationToken);

        var deviceCount = await dbContext.DeviceActivations.AsNoTracking()
            .CountAsync(x => x.TenantId == tenantId && x.RevokedAt == null, cancellationToken);
        var userCount = await dbContext.TenantUsers.AsNoTracking()
            .CountAsync(x => x.TenantId == tenantId && x.Status == "active", cancellationToken);
        var branchCount = await dbContext.Branches.AsNoTracking()
            .CountAsync(x => x.TenantId == tenantId, cancellationToken);

        var warnings = new List<string>();
        if (plan.DeviceLimit > 0 && deviceCount > plan.DeviceLimit)
        {
            warnings.Add("Device limit would fall below currently active devices.");
        }
        if (plan.UserLimit > 0 && userCount > plan.UserLimit)
        {
            warnings.Add("User limit would fall below currently active users.");
        }
        if (plan.BranchLimit > 0 && branchCount > plan.BranchLimit)
        {
            warnings.Add("Branch limit would fall below current branch count.");
        }

        var currentSnapshot = ParsePlanSnapshot(subscription.PlanSnapshotJson);
        var currentAmount = currentSnapshot.PromoPrice ?? currentSnapshot.Price ?? 0m;
        var targetAmount = price?.PromoAmount ?? price?.Amount ?? currentAmount;
        var isUpgrade = targetAmount >= currentAmount;
        var immediate = request.Immediate && isUpgrade;
        var effectiveAt = immediate ? DateTimeOffset.UtcNow : subscription.CurrentPeriodEnd;

        if (immediate)
        {
            subscription.PlanCode = plan.Code;
            subscription.BillingCycle = request.BillingCycle;
            subscription.PlanSnapshotJson = JsonSerializer.Serialize(new
            {
                plan.Code,
                plan.Name,
                plan.BranchLimit,
                plan.UserLimit,
                plan.DeviceLimit,
                plan.SupportTier,
                featureFlags,
                price = price?.Amount,
                promoPrice = price?.PromoAmount
            });
        }

        dbContext.AuditLogs.Add(BuildAudit(access, "portal.subscription.plan_change_requested", "subscription", subscription.Id.ToString(), new
        {
            planCode = request.PlanCode,
            billingCycle = request.BillingCycle,
            mode = immediate ? "immediate" : "scheduled",
            effectiveAt,
            warnings
        }));

        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new
        {
            implemented = true,
            immediate,
            scheduled = !immediate,
            effectiveAt,
            warnings
        });
    }

    private static async Task<IResult> ReactivatePlaceholderAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }

        var subscription = await dbContext.Subscriptions
            .Where(x => x.TenantId == access.TenantId!.Value)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (subscription is null)
        {
            return Results.NotFound();
        }

        subscription.CancelAtPeriodEnd = false;
        subscription.CanceledAt = null;
        if (subscription.Status is "canceled" or "expired" && subscription.CurrentPeriodEnd > DateTimeOffset.UtcNow)
        {
            subscription.Status = "active";
        }

        dbContext.AuditLogs.Add(BuildAudit(access, "portal.subscription.reactivated", "subscription", subscription.Id.ToString(), new
        {
            subscription.PlanCode,
            subscription.BillingCycle
        }));

        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { implemented = true, reactivated = true, subscription.Id, subscription.CancelAtPeriodEnd, subscription.Status });
    }

    private static async Task<IResult> GetRenewalInfoAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }

        var subscription = await GetLatestSubscriptionAsync(dbContext, access.TenantId!.Value, cancellationToken);
        return subscription is null
            ? Results.NotFound()
            : Results.Ok(new
            {
                subscription.PlanCode,
                subscription.BillingCycle,
                subscription.RenewalDate,
                subscription.CurrentPeriodStart,
                subscription.CurrentPeriodEnd,
                subscription.Status
            });
    }

    private static async Task<IResult> ListPortalLicensesAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }

        var licenses = await dbContext.IssuedLicenses.AsNoTracking()
            .Where(x => x.TenantId == access.TenantId!.Value)
            .OrderByDescending(x => x.IssuedAt)
            .ToListAsync(cancellationToken);
        return Results.Ok(licenses);
    }

    private static async Task<IResult> GetActivePortalLicenseAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }

        var license = await GetLatestLicenseAsync(dbContext, access.TenantId!.Value, cancellationToken);
        return license is null ? Results.NotFound() : Results.Ok(license);
    }

    private static async Task<IResult> GetPortalLicenseDetailAsync(
        Guid licenseId,
        HttpContext httpContext,
        IPortalAuthService authService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }

        var license = await dbContext.IssuedLicenses.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == licenseId && x.TenantId == access.TenantId!.Value, cancellationToken);
        return license is null ? Results.NotFound() : Results.Ok(license);
    }

    private static IResult ReissueLicensePlaceholderAsync()
    {
        return Results.Ok(new { implemented = false, message = "Reissue workflow is scaffolded for future admin approval." });
    }

    private static async Task<IResult> ListPortalDownloadsAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }

        return Results.Ok(await QueryPortalDownloadsAsync(dbContext, access.TenantId!.Value, cancellationToken));
    }

    private static async Task<IResult> ListPortalCatalogProductsAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        AppDbContext dbContext,
        string? search,
        string? barcode,
        CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }

        var query = dbContext.Products.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x =>
                x.Name.Contains(term) ||
                (x.Sku != null && x.Sku.Contains(term)) ||
                (x.Barcode != null && x.Barcode.Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(barcode))
        {
            query = query.Where(x => x.Barcode == barcode.Trim());
        }

        var rows = await query
            .OrderBy(x => x.Name)
            .Take(1000)
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.Sku,
                x.Barcode,
                x.Unit,
                TaxRate = x.TaxRate,
                Price = x.SalePrice,
                x.IsActive,
                UpdatedAt = x.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Results.Ok(rows);
    }

    private static async Task<IResult> GetReleaseNotesAsync(
        Guid releaseId,
        HttpContext httpContext,
        IPortalAuthService authService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }

        var release = await dbContext.AppReleases.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == releaseId && x.IsActive, cancellationToken);
        return release is null ? Results.NotFound() : Results.Ok(new { release.Id, release.Platform, release.Version, release.ReleaseNotesMarkdown });
    }

    private static async Task<IResult> GetInstallGuideAsync(
        Guid releaseId,
        HttpContext httpContext,
        IPortalAuthService authService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }

        var release = await dbContext.AppReleases.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == releaseId && x.IsActive, cancellationToken);
        return release is null ? Results.NotFound() : Results.Ok(new { release.Id, release.Platform, release.Version, release.InstallGuideMarkdown, release.MinimumRequirements });
    }

    private static async Task<IResult> GetBillingHistoryAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }
        if (!access.TenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var tenantId = access.TenantId.Value;
        var invoices = await dbContext.Invoices.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.IssuedAt)
            .ToListAsync(cancellationToken);
        var transactions = await dbContext.PaymentTransactions.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.PaidAt)
            .ToListAsync(cancellationToken);

        var response = invoices.Select(invoice =>
        {
            var payment = transactions.FirstOrDefault(x => x.InvoiceId == invoice.Id);
            return new
            {
                invoice.Id,
                invoice.InvoiceNo,
                invoice.Description,
                Amount = invoice.Total,
                invoice.Currency,
                invoice.Status,
                invoice.IssuedAt,
                invoice.DueAt,
                PdfUrl = invoice.PdfUrl ?? $"/commerce/portal/billing/{invoice.Id}/pdf",
                PaymentMethodSummary = payment?.PaymentMethodSummary,
                Provider = payment?.Provider
            };
        });

        return Results.Ok(response);
    }

    private static async Task<IResult> GetInvoiceDetailAsync(
        Guid invoiceId,
        HttpContext httpContext,
        IPortalAuthService authService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }
        if (!access.TenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var tenantId = access.TenantId.Value;
        var invoice = await dbContext.Invoices.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == invoiceId && x.TenantId == tenantId, cancellationToken);
        if (invoice is null)
        {
            return Results.NotFound();
        }

        var lines = await dbContext.InvoiceLines.AsNoTracking()
            .Where(x => x.InvoiceId == invoiceId && x.TenantId == tenantId)
            .ToListAsync(cancellationToken);
        var payment = await dbContext.PaymentTransactions.AsNoTracking()
            .FirstOrDefaultAsync(x => x.InvoiceId == invoiceId && x.TenantId == tenantId, cancellationToken);

        return Results.Ok(new
        {
            invoice,
            lines,
            payment,
            PdfUrl = invoice.PdfUrl ?? $"/commerce/portal/billing/{invoice.Id}/pdf"
        });
    }

    private static async Task<IResult> GetInvoicePdfAsync(
        Guid invoiceId,
        HttpContext httpContext,
        IPortalAuthService authService,
        AppDbContext dbContext,
        IInvoicePdfService invoicePdfService,
        CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }
        if (!access.TenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var tenantId = access.TenantId.Value;
        var invoice = await dbContext.Invoices.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == invoiceId && x.TenantId == tenantId, cancellationToken);
        if (invoice is null)
        {
            return Results.NotFound();
        }

        var billingProfile = await dbContext.BillingProfiles.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);
        var tenantName = await dbContext.Tenants.AsNoTracking()
            .Where(x => x.Id == tenantId)
            .Select(x => x.Name)
            .FirstOrDefaultAsync(cancellationToken);
        var lines = await dbContext.InvoiceLines.AsNoTracking()
            .Where(x => x.InvoiceId == invoiceId && x.TenantId == tenantId)
            .OrderBy(x => x.CreatedAt)
            .ToListAsync(cancellationToken);

        var pdfBytes = invoicePdfService.BuildInvoicePdf(
            tenantName ?? access.CompanyName ?? "Tenant",
            invoice,
            lines,
            billingProfile?.BillingEmail,
            billingProfile?.AddressLine,
            billingProfile?.City);

        return Results.File(pdfBytes, "application/pdf", $"{invoice.InvoiceNo}.pdf");
    }

    private static async Task<IResult> GetPortalDevicesAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }
        if (!access.TenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var tenantId = access.TenantId.Value;
        var devices = await dbContext.DeviceActivations.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.LastSeenAt)
            .ToListAsync(cancellationToken);
        return Results.Ok(devices);
    }

    private static async Task<IResult> GetCompanyProfileAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }
        if (!access.TenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var tenantId = access.TenantId.Value;
        var tenant = await dbContext.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken);
        var billingProfile = await dbContext.BillingProfiles.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);
        if (tenant is null || billingProfile is null)
        {
            return Results.NotFound();
        }

        return Results.Ok(new
        {
            tenant.Id,
            CompanyName = tenant.Name,
            tenant.TenantCode,
            tenant.BillingEmail,
            tenant.TaxOffice,
            tenant.TaxNumber,
            tenant.Country,
            Locale = tenant.DefaultLocale,
            billingProfile.Phone,
            billingProfile.AddressLine,
            billingProfile.City,
            billingProfile.Status
        });
    }

    private static async Task<IResult> UpdateCompanyProfileAsync(
        CompanyProfileUpdateRequest request,
        HttpContext httpContext,
        IPortalAuthService authService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }
        if (!access.TenantId.HasValue)
        {
            return Results.Unauthorized();
        }

        var tenantId = access.TenantId.Value;
        var tenant = await dbContext.Tenants.FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken);
        var billingProfile = await dbContext.BillingProfiles.FirstOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);
        if (tenant is null || billingProfile is null)
        {
            return Results.NotFound();
        }

        tenant.Name = string.IsNullOrWhiteSpace(request.CompanyName) ? tenant.Name : request.CompanyName.Trim();
        tenant.BillingEmail = string.IsNullOrWhiteSpace(request.BillingEmail) ? tenant.BillingEmail : request.BillingEmail.Trim().ToLowerInvariant();
        tenant.TaxOffice = request.TaxOffice?.Trim();
        tenant.TaxNumber = request.TaxNumber?.Trim();
        tenant.Country = string.IsNullOrWhiteSpace(request.Country) ? tenant.Country : request.Country.Trim().ToUpperInvariant();
        tenant.DefaultLocale = string.IsNullOrWhiteSpace(request.Locale) ? tenant.DefaultLocale : request.Locale.Trim();

        billingProfile.CompanyName = tenant.Name;
        billingProfile.BillingEmail = tenant.BillingEmail;
        billingProfile.Phone = request.Phone?.Trim();
        billingProfile.TaxOffice = request.TaxOffice?.Trim();
        billingProfile.TaxNumber = request.TaxNumber?.Trim();
        billingProfile.AddressLine = request.AddressLine?.Trim();
        billingProfile.City = request.City?.Trim();
        billingProfile.Country = tenant.Country;
        billingProfile.Locale = tenant.DefaultLocale;

        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new
        {
            tenant.Id,
            CompanyName = tenant.Name,
            tenant.TenantCode,
            tenant.BillingEmail,
            tenant.TaxOffice,
            tenant.TaxNumber,
            tenant.Country,
            Locale = tenant.DefaultLocale,
            billingProfile.Phone,
            billingProfile.AddressLine,
            billingProfile.City,
            billingProfile.Status
        });
    }

    private static IResult GetSupportLinksAsync()
    {
        return Results.Ok(new[]
        {
            new { label = "Docs", href = "/docs" },
            new { label = "FAQ", href = "/faq" },
            new { label = "Download center", href = "/download" },
            new { label = "Support", href = "/contact" }
        });
    }

    private static async Task<PortalAccessContext?> RequireCustomerPortalAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        CancellationToken cancellationToken)
    {
        var access = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        return access is { PortalType: "customer", TenantId: not null } ? access : null;
    }

    private static async Task<Subscription?> GetLatestSubscriptionAsync(
        AppDbContext dbContext,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        return await dbContext.Subscriptions.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static async Task<IssuedLicense?> GetLatestLicenseAsync(
        AppDbContext dbContext,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        return await dbContext.IssuedLicenses.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.IssuedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static async Task<IReadOnlyList<DownloadAssetSnapshot>> QueryPortalDownloadsAsync(
        AppDbContext dbContext,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var allAssets = await (
            from asset in dbContext.DownloadableAssets.AsNoTracking()
            join release in dbContext.AppReleases.AsNoTracking() on asset.AppReleaseId equals release.Id
            where asset.IsActive && release.IsActive
            select new DownloadAssetSnapshot(
                asset.Id,
                release.Id,
                asset.Platform,
                asset.Label,
                release.Version,
                release.ReleaseDate,
                asset.Visibility,
                asset.DownloadUrl,
                release.ReleaseNotesMarkdown,
                release.InstallGuideMarkdown,
                release.MinimumRequirements))
            .ToListAsync(cancellationToken);

        var entitledIds = await dbContext.DownloadAccesses.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.Status == "active")
            .Select(x => x.DownloadableAssetId)
            .ToListAsync(cancellationToken);

        return allAssets.Where(x => x.Visibility == "public" || entitledIds.Contains(x.AssetId)).ToList();
    }

    private static AuditLog BuildAudit(
        PortalAccessContext access,
        string action,
        string entity,
        string entityId,
        object payload)
    {
        return new AuditLog
        {
            TenantId = access.TenantId ?? Guid.Empty,
            UserId = access.CustomerAccountId,
            Action = action,
            Entity = entity,
            EntityId = entityId,
            PayloadJson = JsonSerializer.Serialize(payload)
        };
    }

    private static PlanSnapshotData ParsePlanSnapshot(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new PlanSnapshotData();
        }

        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            return new PlanSnapshotData
            {
                Price = root.TryGetProperty("price", out var price) && price.ValueKind != JsonValueKind.Null ? price.GetDecimal() : null,
                PromoPrice = root.TryGetProperty("promoPrice", out var promo) && promo.ValueKind != JsonValueKind.Null ? promo.GetDecimal() : null
            };
        }
        catch
        {
            return new PlanSnapshotData();
        }
    }

    private sealed record PlanSnapshotData
    {
        public decimal? Price { get; init; }
        public decimal? PromoPrice { get; init; }
    }

    private sealed record ChangePlanRequest(string PlanCode, string BillingCycle, bool Immediate);

    public sealed record CompanyProfileUpdateRequest(
        string? CompanyName,
        string? BillingEmail,
        string? Phone,
        string? TaxOffice,
        string? TaxNumber,
        string? AddressLine,
        string? City,
        string? Country,
        string? Locale);
}
