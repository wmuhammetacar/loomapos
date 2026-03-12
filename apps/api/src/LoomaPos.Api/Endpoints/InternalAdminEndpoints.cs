using System.Text.Json;
using LoomaPos.Domain.Auditing;
using LoomaPos.Domain.Internal;
using LoomaPos.Api.Security;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class InternalAdminEndpoints
{
    public static IEndpointRouteBuilder MapInternalAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/internal/admin").WithTags("Internal Admin");

        group.MapGet("/overview", GetOverviewAsync);
        group.MapGet("/tenants", GetTenantsAsync);
        group.MapGet("/tenants/{tenantId:guid}", GetTenantDetailAsync);
        group.MapPost("/tenants/{tenantId:guid}/suspend", SuspendTenantAsync);
        group.MapPost("/tenants/{tenantId:guid}/unsuspend", UnsuspendTenantAsync);
        group.MapPost("/tenants/{tenantId:guid}/billing-recheck", BillingRecheckAsync);
        group.MapPost("/tenants/{tenantId:guid}/refresh-flags", RefreshFlagsAsync);
        group.MapGet("/support/cases", GetSupportCasesAsync);
        group.MapGet("/support/cases/{caseId:guid}", GetSupportCaseDetailAsync);
        group.MapPost("/support/cases/{caseId:guid}/assign", AssignSupportCaseAsync);
        group.MapPost("/support/cases/{caseId:guid}/status", ChangeSupportCaseStatusAsync);
        group.MapPost("/support/cases/{caseId:guid}/messages", AddSupportCaseMessageAsync);
        group.MapPost("/support/cases/{caseId:guid}/notes", AddSupportCaseNoteAsync);
        group.MapPost("/support/cases/{caseId:guid}/links", AddSupportCaseLinkAsync);
        group.MapPost("/support/cases/{caseId:guid}/escalate", EscalateSupportCaseAsync);
        group.MapGet("/resellers", GetResellersAsync);
        group.MapGet("/resellers/{resellerId:guid}", GetResellerDetailAsync);
        group.MapGet("/dead-letter", GetDeadLetters);
        group.MapGet("/releases", GetReleasesAsync);
        group.MapGet("/feature-flags", GetFeatureFlagsAsync);
        group.MapGet("/coupons", GetCouponsAsync);
        group.MapGet("/notices", GetNotices);
        group.MapGet("/security", GetSecurityAsync);
        group.MapGet("/support-access/sessions", GetSupportAccessSessionsAsync);
        group.MapPost("/support-access/sessions/start", StartSupportAccessSessionAsync);
        group.MapPost("/support-access/sessions/{sessionId:guid}/end", EndSupportAccessSessionAsync);

        return app;
    }

    private static async Task<IResult> GetOverviewAsync(HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
        {
            return Results.Unauthorized();
        }

        var activeTenants = await dbContext.Tenants.AsNoTracking().CountAsync(x => x.Status == "active", cancellationToken);
        var trialTenants = await dbContext.Subscriptions.AsNoTracking().CountAsync(x => x.TrialEndsAt != null && x.TrialEndsAt > DateTimeOffset.UtcNow, cancellationToken);
        var pastDue = await dbContext.Subscriptions.AsNoTracking().CountAsync(x => x.Status == "past_due", cancellationToken);
        var failedRenewals = await dbContext.PaymentTransactions.AsNoTracking().CountAsync(x => x.Status == "failed", cancellationToken);
        var activeDevices = await dbContext.DeviceActivations.AsNoTracking().CountAsync(x => x.RevokedAt == null, cancellationToken);
        var deadLetters = 9;
        var supportCases = await dbContext.SupportCases.AsNoTracking().CountAsync(x => x.Status != "resolved" && x.Status != "closed", cancellationToken);
        var resellerConversions = await dbContext.ResellerCustomerLinks.AsNoTracking().CountAsync(x => x.LinkedAt >= DateTimeOffset.UtcNow.AddDays(-30), cancellationToken);
        var latestRelease = await dbContext.AppReleases.AsNoTracking().OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(cancellationToken);

        return Results.Ok(new
        {
            activeTenants,
            trialTenants,
            pastDueSubscriptions = pastDue,
            failedRenewals,
            activeDevices,
            deviceLimitViolations = 3,
            syncFailureRate = "1.8%",
            deadLetterCount = deadLetters,
            openSupportCases = supportCases,
            unresolvedBillingIssues = pastDue + failedRenewals,
            resellerMonthlyConversions = resellerConversions,
            latestReleaseAdoption = latestRelease is null ? "n/a" : $"{latestRelease.Platform} {latestRelease.Version}",
            integrationIncidents = 2
        });
    }

    private static async Task<IResult> GetTenantsAsync(HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
        {
            return Results.Unauthorized();
        }

        var tenants = await dbContext.Tenants.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(100).ToListAsync(cancellationToken);
        var rows = new List<object>();
        foreach (var tenant in tenants)
        {
            var subscription = await dbContext.Subscriptions.AsNoTracking().Where(x => x.TenantId == tenant.Id).OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(cancellationToken);
            var license = await dbContext.IssuedLicenses.AsNoTracking().Where(x => x.TenantId == tenant.Id).OrderByDescending(x => x.IssuedAt).FirstOrDefaultAsync(cancellationToken);
            var ownerEmail = await (from user in dbContext.TenantUsers.AsNoTracking()
                                    join account in dbContext.CustomerAccounts.AsNoTracking() on user.CustomerAccountId equals account.Id
                                    where user.TenantId == tenant.Id
                                    orderby user.IsOwner descending, user.CreatedAt descending
                                    select account.Email).FirstOrDefaultAsync(cancellationToken) ?? tenant.BillingEmail;
            var phone = await (from billing in dbContext.BillingProfiles.AsNoTracking()
                               where billing.TenantId == tenant.Id
                               orderby billing.UpdatedAt descending
                               select billing.Phone).FirstOrDefaultAsync(cancellationToken) ?? "-";
            var devices = await dbContext.DeviceActivations.AsNoTracking().CountAsync(x => x.TenantId == tenant.Id && x.RevokedAt == null, cancellationToken);

            rows.Add(new
            {
                id = tenant.Id,
                tenantCode = tenant.TenantCode,
                companyName = tenant.Name,
                ownerEmail,
                phone,
                status = tenant.Status,
                planCode = subscription?.PlanCode ?? "starter",
                billingCycle = subscription?.BillingCycle ?? "monthly",
                subscriptionStatus = subscription?.Status ?? "inactive",
                licenseStatus = license?.Status ?? "inactive",
                deviceCount = devices,
                deviceLimit = license?.DeviceLimit ?? 0,
                resellerCode = subscription?.ResellerCode,
                lastSyncAt = DateTimeOffset.UtcNow.AddMinutes(-8)
            });
        }

        return Results.Ok(rows);
    }

    private static async Task<IResult> GetTenantDetailAsync(Guid tenantId, HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
        {
            return Results.Unauthorized();
        }

        var tenant = await dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return Results.NotFound();
        }

        var subscription = await dbContext.Subscriptions.AsNoTracking().Where(x => x.TenantId == tenant.Id).OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(cancellationToken);
        var license = await dbContext.IssuedLicenses.AsNoTracking().Where(x => x.TenantId == tenant.Id).OrderByDescending(x => x.IssuedAt).FirstOrDefaultAsync(cancellationToken);
        var devices = await dbContext.DeviceActivations.AsNoTracking().CountAsync(x => x.TenantId == tenant.Id && x.RevokedAt == null, cancellationToken);

        return Results.Ok(new
        {
            id = tenant.Id,
            tenantCode = tenant.TenantCode,
            companyName = tenant.Name,
            ownerEmail = tenant.BillingEmail,
            phone = "+90 850 000 56 62",
            status = tenant.Status,
            planCode = subscription?.PlanCode ?? "starter",
            billingCycle = subscription?.BillingCycle ?? "monthly",
            subscriptionStatus = subscription?.Status ?? "inactive",
            licenseStatus = license?.Status ?? "inactive",
            deviceCount = devices,
            deviceLimit = license?.DeviceLimit ?? 0,
            resellerCode = subscription?.ResellerCode,
            lastSyncAt = DateTimeOffset.UtcNow.AddMinutes(-8),
            notes = new[] { "Support follow-up recommended.", "Latest release adoption should be verified." },
            featureFlags = ParseFlags(license?.FeaturesJson),
            recentNotices = new[] { "Billing recheck pending", "Device limit warning" },
            appVersions = new[] { "Desktop 2.4.1", "Android 1.9.3" },
            latestInvoiceNo = await dbContext.Invoices.AsNoTracking().Where(x => x.TenantId == tenant.Id).OrderByDescending(x => x.IssuedAt).Select(x => x.InvoiceNo).FirstOrDefaultAsync(cancellationToken) ?? "-",
            onboardingState = "9/10 complete",
            supportSummary = "Internal case summary available"
        });
    }

    private static async Task<IResult> SuspendTenantAsync(Guid tenantId, AdminReasonRequest request, HttpContext httpContext, IInternalAdminAuthService authService, IAdminApprovalService approvalService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        return await ApplyTenantActionAsync(tenantId, request, httpContext, authService, approvalService, dbContext, cancellationToken, "suspended", "internal.tenant.suspended", new[] { "super_admin", "ops_admin" });
    }

    private static async Task<IResult> UnsuspendTenantAsync(Guid tenantId, AdminReasonRequest request, HttpContext httpContext, IInternalAdminAuthService authService, IAdminApprovalService approvalService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        return await ApplyTenantActionAsync(tenantId, request, httpContext, authService, approvalService, dbContext, cancellationToken, "active", "internal.tenant.unsuspended", new[] { "super_admin", "ops_admin" });
    }

    private static async Task<IResult> BillingRecheckAsync(Guid tenantId, AdminReasonRequest request, HttpContext httpContext, IInternalAdminAuthService authService, IAdminApprovalService approvalService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        return await RecordAdminActionAsync(tenantId, request, httpContext, authService, approvalService, dbContext, cancellationToken, "internal.billing.recheck_requested", new[] { "super_admin", "ops_admin", "billing_admin" });
    }

    private static async Task<IResult> RefreshFlagsAsync(Guid tenantId, AdminReasonRequest request, HttpContext httpContext, IInternalAdminAuthService authService, IAdminApprovalService approvalService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        return await RecordAdminActionAsync(tenantId, request, httpContext, authService, approvalService, dbContext, cancellationToken, "internal.flags.refresh_requested", new[] { "super_admin", "ops_admin", "release_manager" });
    }

    private static async Task<IResult> GetSupportCasesAsync(HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
        {
            return Results.Unauthorized();
        }

        var rows = await dbContext.SupportCases.AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .Take(50)
            .Select(x => new
            {
                id = x.Id.ToString(),
                tenantId = x.TenantId,
                title = x.Title,
                category = x.Category,
                priority = x.Priority,
                status = x.Status,
                assignee = x.AssigneeEmail ?? "Unassigned",
                createdAt = x.CreatedAt,
                updatedAt = x.UpdatedAt,
                summary = x.Summary
            })
            .ToListAsync(cancellationToken);

        return Results.Ok(rows);
    }

    private static async Task<IResult> GetSupportCaseDetailAsync(Guid caseId, HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
        {
            return Results.Unauthorized();
        }

        var item = await dbContext.SupportCases.AsNoTracking().FirstOrDefaultAsync(x => x.Id == caseId, cancellationToken);
        if (item is null)
        {
            return Results.NotFound();
        }

        var messages = await dbContext.SupportCaseMessages.AsNoTracking()
            .Where(x => x.SupportCaseId == caseId)
            .OrderBy(x => x.CreatedAt)
            .Select(x => new
            {
                at = x.CreatedAt,
                label = x.IsInternal
                    ? "Internal message"
                    : x.AuthorType == "reseller"
                        ? "Reseller message"
                        : x.AuthorType == "internal"
                            ? "Support reply"
                            : "Customer message",
                detail = x.Body
            })
            .ToListAsync(cancellationToken);
        var notes = await dbContext.SupportCaseNotes.AsNoTracking()
            .Where(x => x.SupportCaseId == caseId)
            .OrderBy(x => x.CreatedAt)
            .Select(x => new { at = x.CreatedAt, label = "Internal note", detail = x.Note })
            .ToListAsync(cancellationToken);
        var links = await dbContext.SupportCaseLinks.AsNoTracking()
            .Where(x => x.SupportCaseId == caseId)
            .OrderBy(x => x.CreatedAt)
            .Select(x => new { at = x.CreatedAt, label = $"Linked {x.EntityType}", detail = x.Label ?? x.EntityId })
            .ToListAsync(cancellationToken);

        return Results.Ok(new
        {
            id = item.Id.ToString(),
            tenantId = item.TenantId,
            title = item.Title,
            category = item.Category,
            priority = item.Priority,
            status = item.Status,
            assignee = item.AssigneeEmail ?? "Unassigned",
            source = item.Source,
            escalationLevel = item.EscalationLevel,
            createdAt = item.CreatedAt,
            updatedAt = item.UpdatedAt,
            summary = item.Summary,
            links = await dbContext.SupportCaseLinks.AsNoTracking()
                .Where(x => x.SupportCaseId == caseId)
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => new { id = x.Id, entityType = x.EntityType, entityId = x.EntityId, label = x.Label, createdAt = x.CreatedAt })
                .ToListAsync(cancellationToken),
            notes = await dbContext.SupportCaseNotes.AsNoTracking()
                .Where(x => x.SupportCaseId == caseId)
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => new { id = x.Id, note = x.Note, createdAt = x.CreatedAt })
                .ToListAsync(cancellationToken),
            timeline = (new[]
            {
                new { at = item.CreatedAt, label = "Case created", detail = item.Title },
                new { at = item.UpdatedAt, label = "Current state", detail = item.Status }
            }).Concat(messages).Concat(notes).Concat(links).OrderBy(x => x.at).ToArray()
        });
    }

    private static async Task<IResult> AssignSupportCaseAsync(Guid caseId, AssignSupportCaseRequest request, HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context, new[] { "super_admin", "ops_admin", "support_agent" }))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.AssigneeEmail) || string.IsNullOrWhiteSpace(request.Reason))
        {
            return Results.BadRequest(new { message = "Assignee and reason are required." });
        }

        var supportCase = await dbContext.SupportCases.FirstOrDefaultAsync(x => x.Id == caseId, cancellationToken);
        if (supportCase is null)
        {
            return Results.NotFound();
        }

        supportCase.AssigneeEmail = request.AssigneeEmail.Trim().ToLowerInvariant();
        supportCase.Status = supportCase.Status is "new" ? "open" : supportCase.Status;
        dbContext.SupportCaseNotes.Add(new SupportCaseNote { SupportCaseId = caseId, InternalUserId = context.UserId, Note = $"Assigned to {supportCase.AssigneeEmail}. Reason: {request.Reason.Trim()}" });
        dbContext.AuditLogs.Add(BuildAudit(supportCase.TenantId ?? Guid.Empty, "internal.support_case.assigned", context.Email, string.Join(",", context.Roles), request.Reason.Trim()));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { id = supportCase.Id, assignee = supportCase.AssigneeEmail, status = supportCase.Status, updatedAt = supportCase.UpdatedAt });
    }

    private static async Task<IResult> ChangeSupportCaseStatusAsync(Guid caseId, UpdateSupportCaseStatusRequest request, HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context, new[] { "super_admin", "ops_admin", "support_agent" }))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.Status) || string.IsNullOrWhiteSpace(request.Reason))
        {
            return Results.BadRequest(new { message = "Status and reason are required." });
        }

        var supportCase = await dbContext.SupportCases.FirstOrDefaultAsync(x => x.Id == caseId, cancellationToken);
        if (supportCase is null)
        {
            return Results.NotFound();
        }

        var normalizedStatus = request.Status.Trim().ToLowerInvariant();
        supportCase.Status = normalizedStatus;
        if (normalizedStatus is "open" && supportCase.FirstResponseAt is null)
        {
            supportCase.FirstResponseAt = DateTimeOffset.UtcNow;
        }
        if (normalizedStatus is "resolved" or "closed")
        {
            supportCase.ResolvedAt = DateTimeOffset.UtcNow;
        }

        dbContext.SupportCaseNotes.Add(new SupportCaseNote { SupportCaseId = caseId, InternalUserId = context.UserId, Note = $"Status changed to {normalizedStatus}. Reason: {request.Reason.Trim()}" });
        dbContext.AuditLogs.Add(BuildAudit(supportCase.TenantId ?? Guid.Empty, "internal.support_case.status_changed", context.Email, string.Join(",", context.Roles), request.Reason.Trim()));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { id = supportCase.Id, status = supportCase.Status, resolvedAt = supportCase.ResolvedAt, updatedAt = supportCase.UpdatedAt });
    }

    private static async Task<IResult> AddSupportCaseMessageAsync(Guid caseId, AddSupportCaseMessageRequest request, HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context, new[] { "super_admin", "ops_admin", "support_agent", "billing_admin", "reseller_manager" }))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return Results.BadRequest(new { message = "Message is required." });
        }

        var supportCase = await dbContext.SupportCases.FirstOrDefaultAsync(x => x.Id == caseId, cancellationToken);
        if (supportCase is null)
        {
            return Results.NotFound();
        }
        if (supportCase.Status is "resolved" or "closed")
        {
            return Results.Conflict(new { message = "This case is already closed." });
        }

        var message = new SupportCaseMessage
        {
            SupportCaseId = caseId,
            AuthorType = "internal",
            AuthorInternalUserId = context.UserId,
            Body = request.Message.Trim(),
            IsInternal = request.IsInternal
        };

        dbContext.SupportCaseMessages.Add(message);
        supportCase.UpdatedAt = DateTimeOffset.UtcNow;
        if (!request.IsInternal)
        {
            supportCase.Status = "pending_customer";
            supportCase.FirstResponseAt ??= DateTimeOffset.UtcNow;
        }

        dbContext.AuditLogs.Add(BuildAudit(
            supportCase.TenantId ?? Guid.Empty,
            "internal.support_case.message_added",
            context.Email,
            string.Join(",", context.Roles),
            request.IsInternal ? "internal message" : "customer-facing message"));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new
        {
            id = message.Id,
            supportCaseId = supportCase.Id,
            isInternal = message.IsInternal,
            createdAt = message.CreatedAt,
            status = supportCase.Status
        });
    }

    private static async Task<IResult> AddSupportCaseNoteAsync(Guid caseId, AddSupportCaseNoteRequest request, HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context, new[] { "super_admin", "ops_admin", "support_agent", "billing_admin", "reseller_manager" }))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.Note))
        {
            return Results.BadRequest(new { message = "Note is required." });
        }

        var supportCase = await dbContext.SupportCases.AsNoTracking().FirstOrDefaultAsync(x => x.Id == caseId, cancellationToken);
        if (supportCase is null)
        {
            return Results.NotFound();
        }

        var note = new SupportCaseNote
        {
            SupportCaseId = caseId,
            InternalUserId = context.UserId,
            Note = request.Note.Trim()
        };
        dbContext.SupportCaseNotes.Add(note);
        dbContext.AuditLogs.Add(BuildAudit(supportCase.TenantId ?? Guid.Empty, "internal.support_case.note_added", context.Email, string.Join(",", context.Roles), request.Note.Trim()));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { id = note.Id, note = note.Note, createdAt = note.CreatedAt });
    }

    private static async Task<IResult> AddSupportCaseLinkAsync(Guid caseId, AddSupportCaseLinkRequest request, HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context, new[] { "super_admin", "ops_admin", "support_agent", "billing_admin", "reseller_manager" }))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.EntityType) || string.IsNullOrWhiteSpace(request.EntityId) || string.IsNullOrWhiteSpace(request.Reason))
        {
            return Results.BadRequest(new { message = "Entity type, entity id and reason are required." });
        }

        var supportCase = await dbContext.SupportCases.AsNoTracking().FirstOrDefaultAsync(x => x.Id == caseId, cancellationToken);
        if (supportCase is null)
        {
            return Results.NotFound();
        }

        var existing = await dbContext.SupportCaseLinks.FirstOrDefaultAsync(x => x.SupportCaseId == caseId && x.EntityType == request.EntityType && x.EntityId == request.EntityId, cancellationToken);
        if (existing is not null)
        {
            return Results.Conflict(new { message = "Link already exists for this case." });
        }

        var link = new SupportCaseLink
        {
            SupportCaseId = caseId,
            EntityType = request.EntityType.Trim().ToLowerInvariant(),
            EntityId = request.EntityId.Trim(),
            Label = string.IsNullOrWhiteSpace(request.Label) ? null : request.Label.Trim()
        };
        dbContext.SupportCaseLinks.Add(link);
        dbContext.SupportCaseNotes.Add(new SupportCaseNote { SupportCaseId = caseId, InternalUserId = context.UserId, Note = $"Linked {link.EntityType}:{link.EntityId}. Reason: {request.Reason.Trim()}" });
        dbContext.AuditLogs.Add(BuildAudit(supportCase.TenantId ?? Guid.Empty, "internal.support_case.link_added", context.Email, string.Join(",", context.Roles), request.Reason.Trim()));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { id = link.Id, entityType = link.EntityType, entityId = link.EntityId, label = link.Label, createdAt = link.CreatedAt });
    }

    private static async Task<IResult> EscalateSupportCaseAsync(Guid caseId, EscalateSupportCaseRequest request, HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context, new[] { "super_admin", "ops_admin", "support_agent" }))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.Level) || string.IsNullOrWhiteSpace(request.Reason))
        {
            return Results.BadRequest(new { message = "Escalation level and reason are required." });
        }

        var supportCase = await dbContext.SupportCases.FirstOrDefaultAsync(x => x.Id == caseId, cancellationToken);
        if (supportCase is null)
        {
            return Results.NotFound();
        }

        supportCase.EscalationLevel = request.Level.Trim().ToLowerInvariant();
        supportCase.Status = "escalated";
        dbContext.SupportCaseNotes.Add(new SupportCaseNote { SupportCaseId = caseId, InternalUserId = context.UserId, Note = $"Escalated to {supportCase.EscalationLevel}. Reason: {request.Reason.Trim()}" });
        dbContext.AuditLogs.Add(BuildAudit(supportCase.TenantId ?? Guid.Empty, "internal.support_case.escalated", context.Email, string.Join(",", context.Roles), request.Reason.Trim()));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { id = supportCase.Id, escalationLevel = supportCase.EscalationLevel, status = supportCase.Status, updatedAt = supportCase.UpdatedAt });
    }

    private static async Task<IResult> GetResellersAsync(HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
        {
            return Results.Unauthorized();
        }

        var rows = await dbContext.ResellerAccounts.AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new
            {
                id = x.Id,
                name = x.Name,
                code = x.Code,
                status = x.Status,
                customers = 0,
                monthlyConversions = 0,
                pendingCommission = 0m,
                paidOut = 0m,
                suspicious = x.Status == "pending"
            })
            .ToListAsync(cancellationToken);

        return Results.Ok(rows);
    }

    private static async Task<IResult> GetResellerDetailAsync(Guid resellerId, HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
        {
            return Results.Unauthorized();
        }

        var reseller = await dbContext.ResellerAccounts.AsNoTracking().FirstOrDefaultAsync(x => x.Id == resellerId, cancellationToken);
        return reseller is null
            ? Results.NotFound()
            : Results.Ok(new
            {
                id = reseller.Id,
                name = reseller.Name,
                code = reseller.Code,
                status = reseller.Status,
                customers = await dbContext.ResellerCustomerLinks.AsNoTracking().CountAsync(x => x.ResellerAccountId == reseller.Id, cancellationToken),
                monthlyConversions = await dbContext.ResellerCustomerLinks.AsNoTracking().CountAsync(x => x.ResellerAccountId == reseller.Id && x.LinkedAt >= DateTimeOffset.UtcNow.AddDays(-30), cancellationToken),
                pendingCommission = await dbContext.ResellerCommissionEvents.AsNoTracking().Where(x => x.ResellerAccountId == reseller.Id && x.Status != "paid").SumAsync(x => (decimal?)x.Amount, cancellationToken) ?? 0m,
                paidOut = await dbContext.Payouts.AsNoTracking().Where(x => x.ResellerId == reseller.Id && x.Status == "paid").SumAsync(x => (decimal?)x.Total, cancellationToken) ?? 0m,
                suspicious = reseller.Status == "pending"
            });
    }

    private static async Task<IResult> GetDeadLetters(HttpContext httpContext, IInternalAdminAuthService authService, CancellationToken cancellationToken)
    {
        if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
        {
            return Results.Unauthorized();
        }

        return Results.Ok(new[]
        {
            new
            {
                id = "dead-1",
                eventType = "SALE_CREATED",
                tenantId = "tenant-demo-2",
                deviceId = "desktop-ank-04",
                createdAt = DateTimeOffset.UtcNow.AddHours(-1),
                lastRetryAt = DateTimeOffset.UtcNow.AddMinutes(-20),
                failureReason = "Payment reconciliation mismatch",
                payloadSummary = "Local sale accepted but enrichment failed.",
                status = "dead_letter"
            }
        });
    }

    private static async Task<IResult> GetReleasesAsync(HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
        {
            return Results.Unauthorized();
        }

        return Results.Ok(await dbContext.AppReleases.AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new
            {
                id = x.Id,
                platform = x.Platform,
                version = x.Version,
                status = x.IsActive ? "stable" : "inactive",
                adoption = x.Platform == "desktop" ? "76%" : "58%",
                minSupportedVersion = x.Version,
                createdAt = x.CreatedAt
            })
            .ToListAsync(cancellationToken));
    }

    private static async Task<IResult> GetFeatureFlagsAsync(HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
        {
            return Results.Unauthorized();
        }

        var rows = await dbContext.FeatureFlags.AsNoTracking()
            .OrderBy(x => x.Code)
            .Select(x => new
            {
                id = x.Id,
                code = x.Code,
                scope = x.IsPublic ? "plan" : "tenant",
                state = x.IsActive ? "enabled" : "disabled",
                target = x.IsPublic ? "public" : "restricted"
            })
            .ToListAsync(cancellationToken);

        return Results.Ok(rows);
    }

    private static async Task<IResult> GetCouponsAsync(HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
        {
            return Results.Unauthorized();
        }

        var prices = await dbContext.PlanPrices.AsNoTracking().Where(x => x.PromoAmount != null).Take(10).ToListAsync(cancellationToken);
        return Results.Ok(prices.Select(x => new
        {
            id = x.Id,
            code = $"PROMO-{x.Id.ToString()[..6].ToUpperInvariant()}",
            type = "price_override",
            value = x.PromoAmount.HasValue ? $"{x.PromoAmount.Value:0.##} TRY" : "-",
            usage = "provider-ready",
            expiresAt = x.UpdatedAt.AddMonths(1),
            status = x.IsActive ? "active" : "inactive"
        }));
    }

    private static async Task<IResult> GetNotices(HttpContext httpContext, IInternalAdminAuthService authService, CancellationToken cancellationToken)
    {
        if (await authService.GetAccessContextAsync(httpContext, cancellationToken) is null)
        {
            return Results.Unauthorized();
        }

        return Results.Ok(new[]
        {
            new { id = "notice-1", title = "Desktop 2.4.1 upgrade recommended", audience = "desktop_outdated", status = "active", scheduledAt = (DateTimeOffset?)null }
        });
    }

    private static async Task<IResult> GetSecurityAsync(HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null)
        {
            return Results.Unauthorized();
        }

        var activeSupportAccessCount = await dbContext.SupportAccessSessions.AsNoTracking()
            .CountAsync(x => x.Status == "active" && x.EndedAt == null && x.ExpiresAt > DateTimeOffset.UtcNow, cancellationToken);
        var recentSupportAccess = await dbContext.SupportAccessSessions.AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .Take(20)
            .Select(x => new
            {
                id = x.Id,
                tenantId = x.TenantId,
                accessMode = x.AccessMode,
                reason = x.Reason,
                status = x.Status,
                createdAt = x.CreatedAt,
                expiresAt = x.ExpiresAt,
                endedAt = x.EndedAt
            })
            .ToListAsync(cancellationToken);

        return Results.Ok(new
        {
            internalUsers = await dbContext.InternalUsers.AsNoTracking()
                .OrderBy(x => x.Email)
                .Select(x => new
                {
                    email = x.Email,
                    role = dbContext.InternalUserRoles.Where(role => role.InternalUserId == x.Id).Select(role => role.RoleCode).FirstOrDefault() ?? "read_only_analyst",
                    status = x.Status
                })
                .ToListAsync(cancellationToken),
            activeSessions = await dbContext.InternalSessions.AsNoTracking().CountAsync(x => x.RevokedAt == null && x.ExpiresAt > DateTimeOffset.UtcNow, cancellationToken),
            impersonationSessions = activeSupportAccessCount,
            supportAccessSessions = recentSupportAccess,
            lastSecretRotation = DateTimeOffset.UtcNow.AddDays(-8)
        });
    }

    private static async Task<IResult> GetSupportAccessSessionsAsync(HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context, new[] { "super_admin", "ops_admin", "support_agent", "security_auditor" }))
        {
            return Results.Forbid();
        }

        var rows = await dbContext.SupportAccessSessions.AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .Take(100)
            .Select(x => new
            {
                id = x.Id,
                tenantId = x.TenantId,
                accessMode = x.AccessMode,
                reason = x.Reason,
                status = x.Status,
                createdAt = x.CreatedAt,
                expiresAt = x.ExpiresAt,
                endedAt = x.EndedAt
            })
            .ToListAsync(cancellationToken);

        return Results.Ok(rows);
    }

    private static async Task<IResult> StartSupportAccessSessionAsync(StartSupportAccessSessionRequest request, HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context, new[] { "super_admin", "ops_admin", "support_agent" }))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return Results.BadRequest(new { message = "Reason is required." });
        }

        var accessMode = string.IsNullOrWhiteSpace(request.AccessMode)
            ? "shadow_view"
            : request.AccessMode.Trim().ToLowerInvariant();
        if (accessMode is not ("shadow_view" or "impersonation"))
        {
            return Results.BadRequest(new { message = "Access mode must be shadow_view or impersonation." });
        }

        var ttlMinutes = request.ExpiresInMinutes is >= 5 and <= 120
            ? request.ExpiresInMinutes.Value
            : 30;

        if (request.TenantId.HasValue)
        {
            var tenantExists = await dbContext.Tenants.AsNoTracking().AnyAsync(x => x.Id == request.TenantId.Value, cancellationToken);
            if (!tenantExists)
            {
                return Results.NotFound();
            }
        }

        var session = new SupportAccessSession
        {
            InternalUserId = context.UserId,
            TenantId = request.TenantId,
            AccessMode = accessMode,
            Reason = request.Reason.Trim(),
            Status = "active",
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(ttlMinutes)
        };

        dbContext.SupportAccessSessions.Add(session);
        dbContext.AuditLogs.Add(BuildAudit(
            request.TenantId ?? Guid.Empty,
            "internal.support_access.started",
            context.Email,
            string.Join(",", context.Roles),
            request.Reason.Trim()));
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new
        {
            id = session.Id,
            tenantId = session.TenantId,
            accessMode = session.AccessMode,
            reason = session.Reason,
            status = session.Status,
            createdAt = session.CreatedAt,
            expiresAt = session.ExpiresAt
        });
    }

    private static async Task<IResult> EndSupportAccessSessionAsync(Guid sessionId, EndSupportAccessSessionRequest request, HttpContext httpContext, IInternalAdminAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context, new[] { "super_admin", "ops_admin", "support_agent", "security_auditor" }))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return Results.BadRequest(new { message = "Reason is required." });
        }

        var session = await dbContext.SupportAccessSessions.FirstOrDefaultAsync(x => x.Id == sessionId, cancellationToken);
        if (session is null)
        {
            return Results.NotFound();
        }
        if (session.Status != "active")
        {
            return Results.Conflict(new { message = "Session is not active." });
        }

        session.Status = "ended";
        session.EndedAt = DateTimeOffset.UtcNow;
        session.UpdatedAt = DateTimeOffset.UtcNow;

        dbContext.AuditLogs.Add(BuildAudit(
            session.TenantId ?? Guid.Empty,
            "internal.support_access.ended",
            context.Email,
            string.Join(",", context.Roles),
            request.Reason.Trim()));
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new
        {
            id = session.Id,
            status = session.Status,
            endedAt = session.EndedAt,
            updatedAt = session.UpdatedAt
        });
    }

    private static async Task<IResult> ApplyTenantActionAsync(Guid tenantId, AdminReasonRequest request, HttpContext httpContext, IInternalAdminAuthService authService, IAdminApprovalService approvalService, AppDbContext dbContext, CancellationToken cancellationToken, string targetStatus, string action, string[] allowedRoles)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context, allowedRoles))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return Results.BadRequest(new { message = "Reason is required." });
        }

        var tenant = await dbContext.Tenants.FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return Results.NotFound();
        }

        tenant.Status = targetStatus;
        await approvalService.RecordActionAsync(context, action, "tenant", tenantId.ToString(), request.Reason, requiresApproval: true, new { targetStatus }, cancellationToken);
        dbContext.AuditLogs.Add(BuildAudit(tenantId, action, context.Email, string.Join(",", context.Roles), request.Reason));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { success = true, message = action });
    }

    private static async Task<IResult> RecordAdminActionAsync(Guid tenantId, AdminReasonRequest request, HttpContext httpContext, IInternalAdminAuthService authService, IAdminApprovalService approvalService, AppDbContext dbContext, CancellationToken cancellationToken, string action, string[] allowedRoles)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context, allowedRoles))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return Results.BadRequest(new { message = "Reason is required." });
        }

        await approvalService.RecordActionAsync(context, action, "tenant", tenantId.ToString(), request.Reason, requiresApproval: false, metadata: null, cancellationToken);
        dbContext.AuditLogs.Add(BuildAudit(tenantId, action, context.Email, string.Join(",", context.Roles), request.Reason));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { success = true, message = action });
    }

    private static bool HasAnyRole(InternalAdminAccessContext context, IEnumerable<string> roles)
        => context.Roles.Any(role => roles.Contains(role, StringComparer.OrdinalIgnoreCase));

    private static AuditLog BuildAudit(Guid tenantId, string action, string email, string roles, string reason)
    {
        return new AuditLog
        {
            TenantId = tenantId,
            Action = action,
            Entity = "internal_admin",
            EntityId = email,
            PayloadJson = JsonSerializer.Serialize(new { email, roles, reason, at = DateTimeOffset.UtcNow })
        };
    }

    private static string[] ParseFlags(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Array.Empty<string>();
        }

        try
        {
            return JsonSerializer.Deserialize<string[]>(json) ?? Array.Empty<string>();
        }
        catch
        {
            return Array.Empty<string>();
        }
    }

    private sealed record AdminReasonRequest(string Reason);
    private sealed record AssignSupportCaseRequest(string AssigneeEmail, string Reason);
    private sealed record UpdateSupportCaseStatusRequest(string Status, string Reason);
    private sealed record AddSupportCaseMessageRequest(string Message, bool IsInternal);
    private sealed record AddSupportCaseNoteRequest(string Note);
    private sealed record AddSupportCaseLinkRequest(string EntityType, string EntityId, string? Label, string Reason);
    private sealed record EscalateSupportCaseRequest(string Level, string Reason);
    private sealed record StartSupportAccessSessionRequest(Guid? TenantId, string AccessMode, string Reason, int? ExpiresInMinutes);
    private sealed record EndSupportAccessSessionRequest(string Reason);
}
