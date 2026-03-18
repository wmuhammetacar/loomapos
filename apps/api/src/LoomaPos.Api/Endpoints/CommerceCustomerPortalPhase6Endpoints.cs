using System.Text.Json;
using LoomaPos.Api.Commerce;
using LoomaPos.Domain.Auditing;
using LoomaPos.Domain.Commerce;
using LoomaPos.Domain.Internal;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class CommerceCustomerPortalPhase6Endpoints
{
    public static IEndpointRouteBuilder MapCommerceCustomerPortalPhase6Endpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/commerce/portal").WithTags("Customer Portal Phase 6");

        group.MapGet("/subscription/usage", GetUsageAsync);
        group.MapGet("/subscription/trial-status", GetTrialStatusAsync);
        group.MapGet("/notices", GetNoticesAsync);
        group.MapGet("/onboarding", GetOnboardingAsync);
        group.MapGet("/users", GetUsersAsync);
        group.MapPost("/users/invite", InviteUserAsync);
        group.MapPatch("/users/{tenantUserId:guid}/role", UpdateUserRoleAsync);
        group.MapDelete("/users/{tenantUserId:guid}", RemoveUserAsync);
        group.MapGet("/security", GetSecurityAsync);
        group.MapPost("/security/change-password", ChangePasswordAsync);
        group.MapPost("/security/sessions/{sessionId:guid}/revoke", RevokeSessionAsync);
        group.MapPost("/devices/{deviceActivationId:guid}/rename", RenameDeviceAsync);
        group.MapPost("/devices/{deviceActivationId:guid}/deactivate", DeactivateDeviceAsync);
        group.MapGet("/support", GetSupportAsync);
        group.MapPost("/support", CreateSupportAsync);
        group.MapPost("/support/{caseId:guid}/messages", AddSupportMessageAsync);

        return app;
    }

    private static async Task<IResult> GetUsageAsync(HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null)
        {
            return Results.Unauthorized();
        }

        var subscription = await GetLatestSubscriptionAsync(dbContext, access.TenantId.Value, cancellationToken);
        if (subscription is null)
        {
            return Results.NotFound();
        }

        var snapshot = ParsePlanSnapshot(subscription.PlanSnapshotJson);
        var branches = await dbContext.Branches.AsNoTracking().CountAsync(x => x.TenantId == access.TenantId.Value, cancellationToken);
        var users = await dbContext.TenantUsers.AsNoTracking().CountAsync(x => x.TenantId == access.TenantId.Value && x.Status == "active", cancellationToken);
        var devices = await dbContext.DeviceActivations.AsNoTracking().CountAsync(x => x.TenantId == access.TenantId.Value && x.RevokedAt == null, cancellationToken);
        var pending = await GetPendingPlanChangeAsync(dbContext, access.TenantId.Value, cancellationToken);

        return Results.Ok(new
        {
            planCode = subscription.PlanCode,
            supportTier = snapshot.SupportTier,
            limits = new { branches = snapshot.BranchLimit, users = snapshot.UserLimit, devices = snapshot.DeviceLimit },
            usage = new { branches, users, devices },
            overLimit = new
            {
                branches = snapshot.BranchLimit.HasValue && branches > snapshot.BranchLimit.Value,
                users = snapshot.UserLimit.HasValue && users > snapshot.UserLimit.Value,
                devices = snapshot.DeviceLimit.HasValue && devices > snapshot.DeviceLimit.Value
            },
            featureFlags = snapshot.FeatureFlags,
            nextBillingAmount = snapshot.PromoPrice ?? snapshot.Price,
            promoAmount = snapshot.PromoPrice,
            currency = "TRY",
            couponCode = (string?)null,
            pendingPlanChange = pending
        });
    }

    private static async Task<IResult> GetTrialStatusAsync(HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null)
        {
            return Results.Unauthorized();
        }

        var subscription = await GetLatestSubscriptionAsync(dbContext, access.TenantId.Value, cancellationToken);
        if (subscription is null)
        {
            return Results.NotFound();
        }

        var snapshot = ParsePlanSnapshot(subscription.PlanSnapshotJson);
        var remaining = subscription.TrialEndsAt.HasValue ? Math.Max(0, (int)Math.Ceiling((subscription.TrialEndsAt.Value - DateTimeOffset.UtcNow).TotalDays)) : (int?)null;

        return Results.Ok(new
        {
            trialEndsAt = subscription.TrialEndsAt,
            trialRemainingDays = remaining,
            couponCode = (string?)null,
            promoAmount = snapshot.PromoPrice,
            annualDiscountLabel = subscription.BillingCycle == "yearly" ? "Annual billing active" : null,
            conversionState = subscription.TrialEndsAt.HasValue ? remaining > 0 ? "trialing" : "trial_expired" : snapshot.PromoPrice.HasValue ? "coupon_applied" : "paid"
        });
    }

    private static async Task<IResult> GetNoticesAsync(HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null)
        {
            return Results.Unauthorized();
        }

        var subscription = await GetLatestSubscriptionAsync(dbContext, access.TenantId.Value, cancellationToken);
        var license = await dbContext.IssuedLicenses.AsNoTracking().Where(x => x.TenantId == access.TenantId.Value).OrderByDescending(x => x.IssuedAt).FirstOrDefaultAsync(cancellationToken);
        var devices = await dbContext.DeviceActivations.AsNoTracking().CountAsync(x => x.TenantId == access.TenantId.Value && x.RevokedAt == null, cancellationToken);
        var snapshot = subscription is null ? new PlanSnapshot() : ParsePlanSnapshot(subscription.PlanSnapshotJson);
        var notices = new List<object>();

        if (subscription?.CancelAtPeriodEnd == true)
        {
            notices.Add(new { id = "cancel", level = "warning", title = "Subscription ends at period close", description = $"Service remains active until {subscription.CurrentPeriodEnd:yyyy-MM-dd}.", href = "/portal/subscription" });
        }
        if (subscription?.Status is "past_due" or "suspended")
        {
            notices.Add(new { id = "payment", level = "danger", title = "Subscription needs attention", description = $"Current subscription status is {subscription.Status}.", href = "/portal/billing" });
        }
        if (license is not null && license.Status != "active")
        {
            notices.Add(new { id = "license", level = "warning", title = "License requires validation", description = $"Current license status is {license.Status}.", href = "/portal/licenses" });
        }
        if (snapshot.DeviceLimit.HasValue && devices >= snapshot.DeviceLimit.Value)
        {
            notices.Add(new { id = "devices", level = "danger", title = "Device limit reached", description = "Deactivate unused devices before activating a new one.", href = "/portal/devices" });
        }
        if (notices.Count == 0)
        {
            notices.Add(new { id = "healthy", level = "success", title = "Account is healthy", description = "Subscription, license and device usage are within current limits.", href = "/portal" });
        }

        return Results.Ok(notices);
    }

    private static async Task<IResult> GetOnboardingAsync(HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null)
        {
            return Results.Unauthorized();
        }

        var tenant = await dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == access.TenantId.Value, cancellationToken);
        var license = await dbContext.IssuedLicenses.AsNoTracking().Where(x => x.TenantId == access.TenantId.Value).OrderByDescending(x => x.IssuedAt).FirstOrDefaultAsync(cancellationToken);
        var downloads = await dbContext.DownloadAccesses.AsNoTracking().CountAsync(x => x.TenantId == access.TenantId.Value && x.Status == "active", cancellationToken);
        var devices = await dbContext.DeviceActivations.AsNoTracking().CountAsync(x => x.TenantId == access.TenantId.Value && x.RevokedAt == null, cancellationToken);
        var users = await dbContext.TenantUsers.AsNoTracking().CountAsync(x => x.TenantId == access.TenantId.Value && x.Status == "active", cancellationToken);

        return Results.Ok(new object[]
        {
            new { code = "company_profile", label = "Complete company profile", description = "Confirm billing, legal placeholders and tenant details.", status = !string.IsNullOrWhiteSpace(tenant?.BillingEmail) ? "complete" : "pending", href = "/portal/company" },
            new { code = "desktop_download", label = "Download Desktop POS", description = "Use portal download assets for desktop installation.", status = downloads > 0 ? "complete" : "pending", href = "/portal/downloads" },
            new { code = "license_activation", label = "Activate license", description = "Verify active license and limits before setup.", status = license is null ? "attention" : license.Status == "active" ? "complete" : "attention", href = "/portal/licenses" },
            new { code = "device_registration", label = "Register first device", description = "Activate at least one Desktop or Mobile device.", status = devices > 0 ? "complete" : "pending", href = "/portal/devices" },
            new { code = "first_branch", label = "Create first branch", description = "Complete first branch setup in operational apps.", status = "pending", href = "/docs/desktop-guide" },
            new { code = "first_product", label = "Add first product", description = "Create or import first product catalog items.", status = "pending", href = "/docs/installation" },
            new { code = "first_staff", label = "Create first staff member", description = "Define initial staff access and role scope.", status = users > 1 ? "complete" : "pending", href = "/docs/mobile-guide" },
            new { code = "first_sale", label = "Complete first test sale", description = "Run first sale simulation inside Desktop POS.", status = "pending", href = "/docs/getting-started" }
        });
    }

    private static async Task<IResult> GetUsersAsync(HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null)
        {
            return Results.Unauthorized();
        }

        var rows = await (from tenantUser in dbContext.TenantUsers.AsNoTracking()
                          join customer in dbContext.CustomerAccounts.AsNoTracking() on tenantUser.CustomerAccountId equals customer.Id
                          where tenantUser.TenantId == access.TenantId.Value
                          orderby tenantUser.IsOwner descending, tenantUser.CreatedAt descending
                          select new
                          {
                              id = tenantUser.Id,
                              customerAccountId = customer.Id,
                              fullName = customer.FullName,
                              email = customer.Email,
                              phone = customer.Phone,
                              roleCode = tenantUser.RoleCode,
                              status = tenantUser.Status,
                              isOwner = tenantUser.IsOwner,
                              createdAt = tenantUser.CreatedAt,
                              lastLoginAt = customer.LastLoginAt
                          }).ToListAsync(cancellationToken);

        return Results.Ok(rows);
    }

    private static async Task<IResult> InviteUserAsync(InviteRequest request, HttpContext httpContext, IPortalAuthService authService, IPortalCryptoService cryptoService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null || !HasRole(access, "tenant_owner", "company_admin"))
        {
            return Results.Forbid();
        }

        var email = request.Email.Trim().ToLowerInvariant();
        var customer = await dbContext.CustomerAccounts.FirstOrDefaultAsync(x => x.Email == email, cancellationToken);
        if (customer is null)
        {
            customer = new CustomerAccount
            {
                Email = email,
                FullName = request.FullName.Trim(),
                Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
                PasswordHash = cryptoService.HashPassword(cryptoService.GenerateOpaqueToken(18)),
                AccountStatus = "active"
            };
            dbContext.CustomerAccounts.Add(customer);
        }

        var tenantUser = await dbContext.TenantUsers.FirstOrDefaultAsync(x => x.TenantId == access.TenantId.Value && x.CustomerAccountId == customer.Id, cancellationToken);
        if (tenantUser is null)
        {
            tenantUser = new TenantUser
            {
                TenantId = access.TenantId.Value,
                CustomerAccountId = customer.Id,
                RoleCode = request.RoleCode,
                Status = "active",
                IsOwner = false
            };
            dbContext.TenantUsers.Add(tenantUser);
        }
        else
        {
            tenantUser.RoleCode = request.RoleCode;
            tenantUser.Status = "active";
        }

        dbContext.AuditLogs.Add(BuildAudit(access, "portal.user.invited", "tenant_user", tenantUser.Id.ToString(), request));
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new { id = tenantUser.Id, customerAccountId = customer.Id, fullName = customer.FullName, email = customer.Email, phone = customer.Phone, roleCode = tenantUser.RoleCode, status = tenantUser.Status, isOwner = tenantUser.IsOwner, createdAt = tenantUser.CreatedAt, lastLoginAt = customer.LastLoginAt });
    }

    private static async Task<IResult> UpdateUserRoleAsync(Guid tenantUserId, RoleRequest request, HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null || !HasRole(access, "tenant_owner", "company_admin"))
        {
            return Results.Forbid();
        }

        var tenantUser = await dbContext.TenantUsers.FirstOrDefaultAsync(x => x.Id == tenantUserId && x.TenantId == access.TenantId.Value, cancellationToken);
        if (tenantUser is null)
        {
            return Results.NotFound();
        }
        if (tenantUser.IsOwner)
        {
            return Results.Conflict(new { message = "Owner role cannot be changed from the portal." });
        }

        tenantUser.RoleCode = request.RoleCode;
        dbContext.AuditLogs.Add(BuildAudit(access, "portal.user.role_changed", "tenant_user", tenantUser.Id.ToString(), request));
        await dbContext.SaveChangesAsync(cancellationToken);
        var customer = await dbContext.CustomerAccounts.AsNoTracking().FirstAsync(x => x.Id == tenantUser.CustomerAccountId, cancellationToken);
        return Results.Ok(new { id = tenantUser.Id, customerAccountId = customer.Id, fullName = customer.FullName, email = customer.Email, phone = customer.Phone, roleCode = tenantUser.RoleCode, status = tenantUser.Status, isOwner = tenantUser.IsOwner, createdAt = tenantUser.CreatedAt, lastLoginAt = customer.LastLoginAt });
    }

    private static async Task<IResult> RemoveUserAsync(Guid tenantUserId, HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null || !HasRole(access, "tenant_owner", "company_admin"))
        {
            return Results.Forbid();
        }

        var tenantUser = await dbContext.TenantUsers.FirstOrDefaultAsync(x => x.Id == tenantUserId && x.TenantId == access.TenantId.Value, cancellationToken);
        if (tenantUser is null)
        {
            return Results.NotFound();
        }
        if (tenantUser.IsOwner)
        {
            return Results.Conflict(new { message = "Owner access cannot be removed." });
        }

        tenantUser.Status = "inactive";
        var sessions = await dbContext.PortalSessions.Where(x => x.CustomerAccountId == tenantUser.CustomerAccountId && x.TenantId == access.TenantId.Value && x.RevokedAt == null).ToListAsync(cancellationToken);
        foreach (var session in sessions)
        {
            session.RevokedAt = DateTimeOffset.UtcNow;
        }

        dbContext.AuditLogs.Add(BuildAudit(access, "portal.user.removed", "tenant_user", tenantUser.Id.ToString(), new { tenantUser.CustomerAccountId }));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { removed = true, userId = tenantUser.Id });
    }

    private static async Task<IResult> GetSecurityAsync(HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.CustomerAccountId is null || access.TenantId is null)
        {
            return Results.Unauthorized();
        }

        var customer = await dbContext.CustomerAccounts.AsNoTracking().FirstAsync(x => x.Id == access.CustomerAccountId.Value, cancellationToken);
        var sessions = await dbContext.PortalSessions.AsNoTracking()
            .Where(x => x.CustomerAccountId == access.CustomerAccountId.Value && x.TenantId == access.TenantId.Value)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new { id = x.Id, roleCode = x.RoleCode, createdAt = x.CreatedAt, expiresAt = x.ExpiresAt, revokedAt = x.RevokedAt, userAgent = x.UserAgent, ipAddress = x.IpAddress, current = x.Id == access.SessionId })
            .ToListAsync(cancellationToken);
        var activity = await dbContext.AuditLogs.AsNoTracking()
            .Where(x => x.TenantId == access.TenantId.Value)
            .OrderByDescending(x => x.CreatedAt)
            .Take(12)
            .Select(x => new { id = x.Id.ToString(), action = x.Action, entity = x.Entity, createdAt = x.CreatedAt, detail = x.PayloadJson })
            .ToListAsync(cancellationToken);

        return Results.Ok(new { email = customer.Email, emailVerifiedAt = customer.EmailVerifiedAt, mfaReady = false, sessions, activity });
    }

    private static async Task<IResult> ChangePasswordAsync(PasswordChangeRequest request, HttpContext httpContext, IPortalAuthService authService, IPortalCryptoService cryptoService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.CustomerAccountId is null || access.TenantId is null)
        {
            return Results.Unauthorized();
        }

        var customer = await dbContext.CustomerAccounts.FirstAsync(x => x.Id == access.CustomerAccountId.Value, cancellationToken);
        if (!cryptoService.VerifyPassword(customer.PasswordHash, request.CurrentPassword))
        {
            return Results.BadRequest(new { message = "Current password is not valid." });
        }

        customer.PasswordHash = cryptoService.HashPassword(request.NewPassword);
        dbContext.AuditLogs.Add(BuildAudit(access, "portal.security.password_changed", "customer_account", customer.Id.ToString(), new { }));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { changed = true });
    }

    private static async Task<IResult> RevokeSessionAsync(Guid sessionId, HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.CustomerAccountId is null || access.TenantId is null)
        {
            return Results.Unauthorized();
        }

        var session = await dbContext.PortalSessions.FirstOrDefaultAsync(x => x.Id == sessionId && x.CustomerAccountId == access.CustomerAccountId.Value && x.TenantId == access.TenantId.Value, cancellationToken);
        if (session is null)
        {
            return Results.NotFound();
        }

        session.RevokedAt = DateTimeOffset.UtcNow;
        dbContext.AuditLogs.Add(BuildAudit(access, "portal.security.session_revoked", "portal_session", session.Id.ToString(), new { }));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { revoked = true, sessionId = session.Id });
    }

    private static async Task<IResult> RenameDeviceAsync(Guid deviceActivationId, DeviceRenameRequest request, HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null || !HasRole(access, "tenant_owner", "company_admin"))
        {
            return Results.Forbid();
        }

        var device = await dbContext.DeviceActivations.FirstOrDefaultAsync(x => x.Id == deviceActivationId && x.TenantId == access.TenantId.Value, cancellationToken);
        if (device is null)
        {
            return Results.NotFound();
        }

        device.DeviceName = request.DeviceName.Trim();
        dbContext.AuditLogs.Add(BuildAudit(access, "portal.device.renamed", "device_activation", device.Id.ToString(), request));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { renamed = true, deviceId = device.Id, deviceName = device.DeviceName });
    }

    private static async Task<IResult> DeactivateDeviceAsync(Guid deviceActivationId, HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.TenantId is null || !HasRole(access, "tenant_owner", "company_admin"))
        {
            return Results.Forbid();
        }

        var device = await dbContext.DeviceActivations.FirstOrDefaultAsync(x => x.Id == deviceActivationId && x.TenantId == access.TenantId.Value, cancellationToken);
        if (device is null)
        {
            return Results.NotFound();
        }

        device.Status = "revoked";
        device.RevokedAt = DateTimeOffset.UtcNow;
        dbContext.AuditLogs.Add(BuildAudit(access, "portal.device.deactivated", "device_activation", device.Id.ToString(), new { }));
        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { deactivated = true, deviceId = device.Id });
    }

    private static async Task<IResult> GetSupportAsync(HttpContext httpContext, IPortalAuthService authService, AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.CustomerAccountId is null || access.TenantId is null)
        {
            return Results.Unauthorized();
        }

        var rows = await dbContext.SupportCases.AsNoTracking()
            .Where(x => x.CustomerAccountId == access.CustomerAccountId.Value && x.TenantId == access.TenantId.Value && x.Source == "customer_portal")
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
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.CustomerAccountId is null || access.TenantId is null)
        {
            return Results.Unauthorized();
        }

        var supportCase = new SupportCase
        {
            TenantId = access.TenantId,
            CustomerAccountId = access.CustomerAccountId,
            Source = "customer_portal",
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
            AuthorType = "customer",
            AuthorCustomerAccountId = access.CustomerAccountId,
            Body = request.Message.Trim(),
            IsInternal = false
        });

        var notification = new EmailNotification
        {
            TenantId = access.TenantId,
            CustomerAccountId = access.CustomerAccountId,
            EventCode = "portal_support_request",
            ToEmail = access.Email,
            Subject = request.Subject.Trim(),
            BodyMarkdown = JsonSerializer.Serialize(request),
            Status = "queued"
        };

        dbContext.EmailNotifications.Add(notification);
        dbContext.AuditLogs.Add(BuildAudit(access, "portal.support_request.created", "support_request", supportCase.Id.ToString(), request));
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
        var access = await RequireCustomerPortalAsync(httpContext, authService, cancellationToken);
        if (access?.CustomerAccountId is null || access.TenantId is null)
        {
            return Results.Unauthorized();
        }
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return Results.BadRequest(new { message = "Message is required." });
        }

        var supportCase = await dbContext.SupportCases.FirstOrDefaultAsync(x =>
            x.Id == caseId &&
            x.Source == "customer_portal" &&
            x.TenantId == access.TenantId.Value &&
            x.CustomerAccountId == access.CustomerAccountId.Value, cancellationToken);
        if (supportCase is null)
        {
            return Results.NotFound();
        }
        if (supportCase.Status is "resolved" or "closed")
        {
            return Results.Conflict(new { message = "This case is already closed." });
        }

        var body = request.Message.Trim();
        dbContext.SupportCaseMessages.Add(new SupportCaseMessage
        {
            SupportCaseId = supportCase.Id,
            AuthorType = "customer",
            AuthorCustomerAccountId = access.CustomerAccountId,
            Body = body,
            IsInternal = false
        });

        supportCase.Status = "pending_internal";
        supportCase.UpdatedAt = DateTimeOffset.UtcNow;
        dbContext.AuditLogs.Add(BuildAudit(access, "portal.support_request.message_added", "support_request", supportCase.Id.ToString(), new { bodyLength = body.Length }));
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new { caseId = supportCase.Id, status = supportCase.Status, updatedAt = supportCase.UpdatedAt });
    }

    private static async Task<PortalAccessContext?> RequireCustomerPortalAsync(HttpContext httpContext, IPortalAuthService authService, CancellationToken cancellationToken)
    {
        var access = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        return access is { PortalType: "customer" } ? access : null;
    }

    private static bool HasRole(PortalAccessContext access, params string[] roles) => roles.Contains(access.RoleCode, StringComparer.OrdinalIgnoreCase);

    private static async Task<Subscription?> GetLatestSubscriptionAsync(AppDbContext dbContext, Guid tenantId, CancellationToken cancellationToken)
    {
        return await dbContext.Subscriptions.AsNoTracking().Where(x => x.TenantId == tenantId).OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(cancellationToken);
    }

    private static async Task<object?> GetPendingPlanChangeAsync(AppDbContext dbContext, Guid tenantId, CancellationToken cancellationToken)
    {
        var audit = await dbContext.AuditLogs.AsNoTracking().Where(x => x.TenantId == tenantId && x.Action == "portal.subscription.plan_change_requested").OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(cancellationToken);
        if (audit is null)
        {
            return null;
        }

        using var document = JsonDocument.Parse(audit.PayloadJson);
        var root = document.RootElement;
        return new
        {
            targetPlanCode = root.TryGetProperty("planCode", out var planCode) ? planCode.GetString() : null,
            targetBillingCycle = root.TryGetProperty("billingCycle", out var cycle) ? cycle.GetString() : null,
            effectiveAt = root.TryGetProperty("effectiveAt", out var effectiveAt) ? effectiveAt.GetDateTimeOffset() : audit.CreatedAt,
            requestedAt = audit.CreatedAt,
            mode = root.TryGetProperty("mode", out var mode) ? mode.GetString() : "scheduled",
            warnings = root.TryGetProperty("warnings", out var warnings) && warnings.ValueKind == JsonValueKind.Array ? warnings.EnumerateArray().Select(x => x.GetString()).Where(x => !string.IsNullOrWhiteSpace(x)).ToArray() : Array.Empty<string>()
        };
    }

    private static PlanSnapshot ParsePlanSnapshot(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new PlanSnapshot();
        }

        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            return new PlanSnapshot
            {
                BranchLimit = root.TryGetProperty("BranchLimit", out var branches) && branches.ValueKind != JsonValueKind.Null ? branches.GetInt32() : null,
                UserLimit = root.TryGetProperty("UserLimit", out var users) && users.ValueKind != JsonValueKind.Null ? users.GetInt32() : null,
                DeviceLimit = root.TryGetProperty("DeviceLimit", out var devices) && devices.ValueKind != JsonValueKind.Null ? devices.GetInt32() : null,
                SupportTier = root.TryGetProperty("SupportTier", out var supportTier) ? supportTier.GetString() : null,
                FeatureFlags = root.TryGetProperty("featureFlags", out var features) && features.ValueKind == JsonValueKind.Array ? features.EnumerateArray().Select(x => x.GetString()).Where(x => !string.IsNullOrWhiteSpace(x)).Cast<string>().ToArray() : Array.Empty<string>(),
                Price = root.TryGetProperty("price", out var price) && price.ValueKind != JsonValueKind.Null ? price.GetDecimal() : null,
                PromoPrice = root.TryGetProperty("promoPrice", out var promo) && promo.ValueKind != JsonValueKind.Null ? promo.GetDecimal() : null
            };
        }
        catch
        {
            return new PlanSnapshot();
        }
    }

    private static AuditLog BuildAudit(PortalAccessContext access, string action, string entity, string entityId, object payload)
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

    private static SupportPayload ParseSupport(string raw)
    {
        try
        {
            return JsonSerializer.Deserialize<SupportPayload>(raw) ?? new SupportPayload();
        }
        catch
        {
            return new SupportPayload { Message = raw };
        }
    }

    private sealed record InviteRequest(string FullName, string Email, string? Phone, string RoleCode);
    private sealed record RoleRequest(string RoleCode);
    private sealed record PasswordChangeRequest(string CurrentPassword, string NewPassword);
    private sealed record DeviceRenameRequest(string DeviceName);
    private sealed record SupportRequest(string Subject, string Category, string Priority, string Message, string? ContactPreference);
    private sealed record SupportMessageRequest(string Message);
    private sealed record SupportPayload
    {
        public string Category { get; init; } = "general";
        public string Priority { get; init; } = "normal";
        public string Message { get; init; } = string.Empty;
        public string? ContactPreference { get; init; }
    }

    private sealed record PlanSnapshot
    {
        public int? BranchLimit { get; init; }
        public int? UserLimit { get; init; }
        public int? DeviceLimit { get; init; }
        public string? SupportTier { get; init; }
        public IReadOnlyList<string> FeatureFlags { get; init; } = Array.Empty<string>();
        public decimal? Price { get; init; }
        public decimal? PromoPrice { get; init; }
    }
}
