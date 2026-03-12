using System.Text.Json;
using LoomaPos.Api.Commerce;
using LoomaPos.Domain.Commerce;
using LoomaPos.Domain.Internal;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class CommerceResellerPortalEndpoints
{
    public static IEndpointRouteBuilder MapCommerceResellerPortalEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/commerce/reseller-portal").WithTags("Reseller Portal");

        group.MapGet("/overview", GetOverviewAsync);
        group.MapGet("/customers", GetCustomersAsync);
        group.MapGet("/referrals", GetReferralsAsync);
        group.MapGet("/commissions", GetCommissionsAsync);
        group.MapGet("/payouts", GetPayoutsAsync);
        group.MapGet("/licenses", GetLicensesAsync);
        group.MapGet("/assets", GetAssets);
        group.MapGet("/support", GetSupportAsync);
        group.MapPost("/support", CreateSupportAsync);
        group.MapPost("/support/{caseId:guid}/messages", AddSupportMessageAsync);
        group.MapGet("/support-links", GetSupportLinks);
        group.MapGet("/settings", GetSettingsAsync);

        return app;
    }

    private static async Task<IResult> GetOverviewAsync(HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireResellerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.ResellerAccountId is null)
        {
            return Results.Unauthorized();
        }

        var reseller = await dbContext.ResellerAccounts.AsNoTracking().FirstAsync(x => x.Id == access.ResellerAccountId.Value, cancellationToken);
        var links = await dbContext.ResellerCustomerLinks.AsNoTracking().Where(x => x.ResellerAccountId == reseller.Id).ToListAsync(cancellationToken);
        var commissions = await dbContext.ResellerCommissionEvents.AsNoTracking().Where(x => x.ResellerAccountId == reseller.Id).ToListAsync(cancellationToken);
        var payouts = await dbContext.Payouts.AsNoTracking().Where(x => x.ResellerId == reseller.Id).ToListAsync(cancellationToken);

        return Results.Ok(new
        {
            resellerName = reseller.Name,
            referralCode = await GetPrimaryCodeAsync(dbContext, reseller.Id, cancellationToken) ?? reseller.Code,
            commissionRate = reseller.CommissionRate,
            totals = new
            {
                referredCustomers = links.Select(x => x.TenantId).Distinct().Count(),
                activeCustomers = links.Count,
                monthlyConversions = links.Count(x => x.LinkedAt >= DateTimeOffset.UtcNow.AddDays(-30)),
                totalEarnedCommission = commissions.Where(x => x.Status != "reversed").Sum(x => x.Amount),
                pendingCommission = commissions.Where(x => x.Status is "pending" or "accrued" or "approved").Sum(x => x.Amount),
                paidOutCommission = payouts.Where(x => x.Status == "paid").Sum(x => x.Total),
                availablePayout = commissions.Where(x => x.Status is "approved" or "locked").Sum(x => x.Amount)
            },
            partnerAnnouncements = new[]
            {
                "Reseller portal exposes only commercial metadata, not store operations.",
                "Referral, commission and payout flows remain auditable.",
                "Use partner assets for onboarding and plan conversion."
            }
        });
    }

    private static async Task<IResult> GetCustomersAsync(HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireResellerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.ResellerAccountId is null)
        {
            return Results.Unauthorized();
        }

        var links = await dbContext.ResellerCustomerLinks.AsNoTracking()
            .Where(x => x.ResellerAccountId == access.ResellerAccountId.Value)
            .OrderByDescending(x => x.LinkedAt)
            .ToListAsync(cancellationToken);

        var rows = new List<object>();
        foreach (var link in links)
        {
            var tenant = await dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == link.TenantId, cancellationToken);
            if (tenant is null)
            {
                continue;
            }

            var subscription = await dbContext.Subscriptions.AsNoTracking().Where(x => x.TenantId == link.TenantId).OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(cancellationToken);
            var license = await dbContext.IssuedLicenses.AsNoTracking().Where(x => x.TenantId == link.TenantId).OrderByDescending(x => x.IssuedAt).FirstOrDefaultAsync(cancellationToken);
            var devices = await dbContext.DeviceActivations.AsNoTracking().CountAsync(x => x.TenantId == link.TenantId && x.RevokedAt == null, cancellationToken);
            var branches = await dbContext.Branches.AsNoTracking().CountAsync(x => x.TenantId == link.TenantId, cancellationToken);
            var users = await dbContext.TenantUsers.AsNoTracking().CountAsync(x => x.TenantId == link.TenantId && x.Status == "active", cancellationToken);
            var revenue = await dbContext.Invoices.AsNoTracking().Where(x => x.TenantId == link.TenantId && x.Status == "paid").SumAsync(x => (decimal?)x.Total, cancellationToken) ?? 0m;
            var commission = await dbContext.ResellerCommissionEvents.AsNoTracking().Where(x => x.ResellerAccountId == access.ResellerAccountId.Value && x.TenantId == link.TenantId && x.Status != "reversed").SumAsync(x => (decimal?)x.Amount, cancellationToken) ?? 0m;

            rows.Add(new
            {
                tenantId = tenant.Id,
                companyName = tenant.Name,
                signupDate = link.LinkedAt,
                plan = subscription?.PlanCode,
                subscriptionStatus = subscription?.Status,
                billingPeriod = subscription?.BillingCycle,
                licenseStatus = license?.Status,
                activeDevices = devices,
                branchCount = branches,
                userCount = users,
                revenueAmount = revenue,
                commissionAmount = commission
            });
        }

        return Results.Ok(rows);
    }

    private static async Task<IResult> GetReferralsAsync(HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireResellerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.ResellerAccountId is null)
        {
            return Results.Unauthorized();
        }

        var code = await GetPrimaryCodeAsync(dbContext, access.ResellerAccountId.Value, cancellationToken) ?? access.ResellerCode ?? "reseller";
        var rows = await dbContext.ResellerReferrals.AsNoTracking()
            .Where(x => x.ResellerAccountId == access.ResellerAccountId.Value)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);

        return Results.Ok(new
        {
            primaryCode = code,
            primaryLink = $"/pricing?ref={code}",
            clicked = rows.Count,
            registered = rows.Count(x => x.Status is not "attached"),
            purchased = rows.Count(x => x.TenantId.HasValue),
            active = rows.Count(x => x.Status == "active"),
            canceled = rows.Count(x => x.Status == "canceled"),
            history = rows.Select(x => new
            {
                id = x.Id,
                status = x.Status,
                code = x.ReferralCode,
                companyName = (string?)null,
                createdAt = x.CreatedAt
            })
        });
    }

    private static async Task<IResult> GetCommissionsAsync(HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireResellerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.ResellerAccountId is null)
        {
            return Results.Unauthorized();
        }

        var rows = await dbContext.ResellerCommissionEvents.AsNoTracking()
            .Where(x => x.ResellerAccountId == access.ResellerAccountId.Value)
            .OrderByDescending(x => x.EventAt)
            .Select(x => new
            {
                id = x.Id,
                tenantId = x.TenantId,
                amount = x.Amount,
                rate = x.Rate,
                status = x.Status,
                eventAt = x.EventAt,
                companyName = (string?)null,
                planCode = (string?)null
            })
            .ToListAsync(cancellationToken);

        return Results.Ok(rows);
    }

    private static async Task<IResult> GetPayoutsAsync(HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireResellerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.ResellerAccountId is null)
        {
            return Results.Unauthorized();
        }

        return Results.Ok(await dbContext.Payouts.AsNoTracking()
            .Where(x => x.ResellerId == access.ResellerAccountId.Value)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new
            {
                id = x.Id,
                periodStart = x.PeriodStart,
                periodEnd = x.PeriodEnd,
                total = x.Total,
                status = x.Status,
                createdAt = x.CreatedAt,
                paidAt = x.PaidAt
            })
            .ToListAsync(cancellationToken));
    }

    private static async Task<IResult> GetLicensesAsync(HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireResellerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.ResellerAccountId is null)
        {
            return Results.Unauthorized();
        }

        var links = await dbContext.ResellerCustomerLinks.AsNoTracking().Where(x => x.ResellerAccountId == access.ResellerAccountId.Value).ToListAsync(cancellationToken);
        var rows = new List<object>();
        foreach (var link in links)
        {
            var tenant = await dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == link.TenantId, cancellationToken);
            var subscription = await dbContext.Subscriptions.AsNoTracking().Where(x => x.TenantId == link.TenantId).OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(cancellationToken);
            var license = await dbContext.IssuedLicenses.AsNoTracking().Where(x => x.TenantId == link.TenantId).OrderByDescending(x => x.IssuedAt).FirstOrDefaultAsync(cancellationToken);
            var deviceCount = await dbContext.DeviceActivations.AsNoTracking().CountAsync(x => x.TenantId == link.TenantId && x.RevokedAt == null, cancellationToken);
            if (tenant is null)
            {
                continue;
            }

            rows.Add(new
            {
                tenantId = tenant.Id,
                companyName = tenant.Name,
                planCode = subscription?.PlanCode,
                licenseStatus = license?.Status,
                issuedAt = license?.IssuedAt,
                renewalDate = subscription?.RenewalDate,
                activeDevices = deviceCount,
                deviceLimit = license?.DeviceLimit
            });
        }

        return Results.Ok(rows);
    }

    private static IResult GetAssets()
    {
        return Results.Ok(new object[]
        {
            new { id = "logo-kit", title = "Logo kit", type = "brand", description = "Brand assets for reseller proposals.", href = "/download" },
            new { id = "pricing-sheet", title = "Pricing sheet", type = "sales", description = "Monthly and yearly SaaS pricing summary.", href = "/pricing" },
            new { id = "partner-docs", title = "Partner docs", type = "docs", description = "Onboarding and sales collateral for resellers.", href = "/docs" }
        });
    }

    private static async Task<IResult> GetSupportAsync(HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireResellerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.ResellerAccountId is null)
        {
            return Results.Unauthorized();
        }

        var rows = await dbContext.SupportCases.AsNoTracking()
            .Where(x => x.ResellerAccountId == access.ResellerAccountId.Value && x.Source == "reseller_portal")
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new
            {
                x.Id,
                x.Title,
                x.Category,
                x.Priority,
                x.Status,
                x.Summary,
                x.CreatedAt,
                x.ContactPreference
            })
            .ToListAsync(cancellationToken);

        return Results.Ok(rows.Select(x => new
        {
            id = x.Id,
            subject = x.Title,
            category = x.Category,
            priority = x.Priority,
            status = x.Status,
            message = x.Summary,
            createdAt = x.CreatedAt,
            contactPreference = x.ContactPreference
        }));
    }

    private static async Task<IResult> CreateSupportAsync(SupportRequest request, HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireResellerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.ResellerAccountId is null)
        {
            return Results.Unauthorized();
        }

        var supportCase = new SupportCase
        {
            ResellerAccountId = access.ResellerAccountId,
            Source = "reseller_portal",
            Category = request.Category.Trim().ToLowerInvariant(),
            Priority = request.Priority.Trim().ToLowerInvariant(),
            Status = "new",
            Title = request.Subject.Trim(),
            Summary = request.Message.Trim(),
            ContactPreference = string.IsNullOrWhiteSpace(request.ContactPreference) ? null : request.ContactPreference.Trim().ToLowerInvariant()
        };
        dbContext.SupportCases.Add(supportCase);

        dbContext.SupportCaseMessages.Add(new SupportCaseMessage
        {
            SupportCaseId = supportCase.Id,
            AuthorType = "reseller",
            Body = request.Message.Trim(),
            IsInternal = false
        });

        var notification = new EmailNotification
        {
            EventCode = "reseller_support_request",
            ToEmail = access.Email,
            Subject = request.Subject.Trim(),
            BodyMarkdown = JsonSerializer.Serialize(request),
            Status = "queued"
        };

        dbContext.EmailNotifications.Add(notification);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new
        {
            id = supportCase.Id,
            subject = supportCase.Title,
            category = supportCase.Category,
            priority = supportCase.Priority,
            status = supportCase.Status,
            message = supportCase.Summary,
            createdAt = supportCase.CreatedAt,
            contactPreference = supportCase.ContactPreference
        });
    }

    private static async Task<IResult> AddSupportMessageAsync(Guid caseId, SupportMessageRequest request, HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireResellerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.ResellerAccountId is null)
        {
            return Results.Unauthorized();
        }
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return Results.BadRequest(new { message = "Message is required." });
        }

        var supportCase = await dbContext.SupportCases.FirstOrDefaultAsync(x =>
            x.Id == caseId &&
            x.Source == "reseller_portal" &&
            x.ResellerAccountId == access.ResellerAccountId.Value, cancellationToken);
        if (supportCase is null)
        {
            return Results.NotFound();
        }
        if (supportCase.Status is "resolved" or "closed")
        {
            return Results.Conflict(new { message = "This case is already closed." });
        }

        dbContext.SupportCaseMessages.Add(new SupportCaseMessage
        {
            SupportCaseId = supportCase.Id,
            AuthorType = "reseller",
            Body = request.Message.Trim(),
            IsInternal = false
        });

        supportCase.Status = "pending_internal";
        supportCase.UpdatedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new { caseId = supportCase.Id, status = supportCase.Status, updatedAt = supportCase.UpdatedAt });
    }

    private static IResult GetSupportLinks()
    {
        return Results.Ok(new[]
        {
            new { label = "Partner docs", href = "/docs" },
            new { label = "Partner FAQ", href = "/faq" },
            new { label = "Support", href = "/contact" }
        });
    }

    private static async Task<IResult> GetSettingsAsync(HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireResellerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.ResellerAccountId is null)
        {
            return Results.Unauthorized();
        }

        var reseller = await dbContext.ResellerAccounts.AsNoTracking().FirstAsync(x => x.Id == access.ResellerAccountId.Value, cancellationToken);
        return Results.Ok(new
        {
            resellerName = reseller.Name,
            companyName = reseller.CompanyName,
            email = reseller.Email,
            phone = reseller.Phone,
            commissionRate = reseller.CommissionRate,
            payoutMethod = "Manual payout review",
            status = reseller.Status
        });
    }

    private static async Task<PortalAccessContext?> RequireResellerPortalAsync(HttpContext httpContext, IPortalAuthService authService, CancellationToken cancellationToken)
    {
        var access = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        return access is { PortalType: "reseller" } ? access : null;
    }

    private static async Task<string?> GetPrimaryCodeAsync(AppDbContext dbContext, Guid resellerAccountId, CancellationToken cancellationToken)
    {
        return await dbContext.ResellerCodes.AsNoTracking()
            .Where(x => x.ResellerAccountId == resellerAccountId && x.IsActive)
            .OrderByDescending(x => x.IsPrimary)
            .ThenByDescending(x => x.CreatedAt)
            .Select(x => x.Code)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private sealed record SupportRequest(string Subject, string Category, string Priority, string Message, string? ContactPreference);
    private sealed record SupportMessageRequest(string Message);
}
