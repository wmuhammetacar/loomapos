using System.Text.Json;
using LoomaPos.Domain.Auditing;
using LoomaPos.Domain.Internal;
using LoomaPos.Api.Commerce;
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
        group.MapGet("/devices", GetDevicesAsync);
        group.MapGet("/sync-issues", GetSyncIssuesAsync);
        group.MapPost("/tenants/{tenantId:guid}/suspend", SuspendTenantAsync)
            .RequireRateLimiting("internal-mutation");
        group.MapPost("/tenants/{tenantId:guid}/unsuspend", UnsuspendTenantAsync)
            .RequireRateLimiting("internal-mutation");
        group.MapPost("/tenants/{tenantId:guid}/billing-recheck", BillingRecheckAsync)
            .RequireRateLimiting("internal-mutation");
        group.MapPost("/tenants/{tenantId:guid}/refresh-flags", RefreshFlagsAsync)
            .RequireRateLimiting("internal-mutation");
        group.MapGet("/support/cases", GetSupportCasesAsync);
        group.MapGet("/support/cases/{caseId:guid}", GetSupportCaseDetailAsync);
        group.MapPost("/support/cases/{caseId:guid}/assign", AssignSupportCaseAsync)
            .RequireRateLimiting("internal-mutation");
        group.MapPost("/support/cases/{caseId:guid}/status", ChangeSupportCaseStatusAsync)
            .RequireRateLimiting("internal-mutation");
        group.MapPost("/support/cases/{caseId:guid}/messages", AddSupportCaseMessageAsync)
            .RequireRateLimiting("internal-mutation");
        group.MapPost("/support/cases/{caseId:guid}/notes", AddSupportCaseNoteAsync)
            .RequireRateLimiting("internal-mutation");
        group.MapPost("/support/cases/{caseId:guid}/links", AddSupportCaseLinkAsync)
            .RequireRateLimiting("internal-mutation");
        group.MapPost("/support/cases/{caseId:guid}/escalate", EscalateSupportCaseAsync)
            .RequireRateLimiting("internal-mutation");
        group.MapGet("/resellers", GetResellersAsync);
        group.MapGet("/resellers/{resellerId:guid}", GetResellerDetailAsync);
        group.MapGet("/dead-letter", GetDeadLetters);
        group.MapGet("/releases", GetReleasesAsync);
        group.MapGet("/feature-flags", GetFeatureFlagsAsync);
        group.MapGet("/coupons", GetCouponsAsync);
        group.MapGet("/notices", GetNotices);
        group.MapGet("/security", GetSecurityAsync);
        group.MapGet("/support-access/sessions", GetSupportAccessSessionsAsync);
        group.MapPost("/support-access/sessions/start", StartSupportAccessSessionAsync)
            .RequireRateLimiting("internal-mutation");
        group.MapPost("/support-access/sessions/{sessionId:guid}/end", EndSupportAccessSessionAsync)
            .RequireRateLimiting("internal-mutation");

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
            var lifecycleState = SubscriptionLifecyclePolicy.ResolveState(tenant, subscription, license, DateTimeOffset.UtcNow);
            var lifecycle = SubscriptionLifecyclePolicy.Describe(lifecycleState);

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
                lifecycleState,
                lifecycleLabel = lifecycle.Label,
                lifecycleMessage = lifecycle.Message,
                canCheckout = lifecycle.CanCheckout,
                canWrite = lifecycle.CanWrite,
                canSync = lifecycle.CanSync,
                canView = lifecycle.CanView,
                requiresUpgradeAction = lifecycle.RequiresUpgradeAction,
                requiresBlock = lifecycle.RequiresBlock,
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
        var lifecycleState = SubscriptionLifecyclePolicy.ResolveState(tenant, subscription, license, DateTimeOffset.UtcNow);
        var lifecycle = SubscriptionLifecyclePolicy.Describe(lifecycleState);

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
            lifecycleState,
                lifecycleLabel = lifecycle.Label,
                lifecycleMessage = lifecycle.Message,
                canCheckout = lifecycle.CanCheckout,
                canWrite = lifecycle.CanWrite,
                canSync = lifecycle.CanSync,
                canView = lifecycle.CanView,
                requiresUpgradeAction = lifecycle.RequiresUpgradeAction,
                requiresBlock = lifecycle.RequiresBlock,
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


    private static async Task<IResult> GetDevicesAsync(
        Guid? tenantId,
        string? status,
        string? search,
        HttpContext httpContext,
        IInternalAdminAuthService authService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context, new[] { "super_admin", "ops_admin", "support_agent", "security_auditor", "release_manager", "read_only_analyst" }))
        {
            return Results.Forbid();
        }

        var normalizedStatusFilter = NormalizeDeviceStatusFilter(status);
        if (status is not null && normalizedStatusFilter is null)
        {
            return Results.BadRequest(new { message = "status must be one of: active, stale, offline, blocked." });
        }

        var now = DateTimeOffset.UtcNow;
        var activeThreshold = now.AddMinutes(-2);
        var staleThreshold = now.AddMinutes(-10);

        var query = from device in dbContext.Devices.AsNoTracking()
                    join tenant in dbContext.Tenants.AsNoTracking() on device.TenantId equals tenant.Id
                    select new
                    {
                        DeviceId = device.Id,
                        device.TenantId,
                        TenantName = tenant.Name,
                        TenantStatus = tenant.Status,
                        device.BranchId,
                        DeviceName = device.Name,
                        DeviceType = device.Type,
                        DeviceLastSeenAt = device.LastSeenAt
                    };

        if (tenantId.HasValue)
        {
            query = query.Where(x => x.TenantId == tenantId.Value);
        }

        var normalizedSearch = search?.Trim();
        if (!string.IsNullOrWhiteSpace(normalizedSearch))
        {
            var likePattern = $"%{normalizedSearch}%";
            var hasDeviceIdSearch = Guid.TryParse(normalizedSearch, out var parsedDeviceId);
            query = query.Where(x =>
                EF.Functions.ILike(x.TenantName, likePattern) ||
                EF.Functions.ILike(x.DeviceName, likePattern) ||
                (hasDeviceIdSearch && x.DeviceId == parsedDeviceId));
        }

        var baseRows = await query
            .OrderByDescending(x => x.DeviceLastSeenAt)
            .Take(5000)
            .ToListAsync(cancellationToken);

        if (baseRows.Count == 0)
        {
            return Results.Ok(Array.Empty<AdminDeviceResponse>());
        }

        var tenantIds = baseRows.Select(x => x.TenantId).Distinct().ToArray();
        var deviceIds = baseRows.Select(x => x.DeviceId).Distinct().ToArray();

        var activationRows = await dbContext.DeviceActivations.AsNoTracking()
            .Where(x => tenantIds.Contains(x.TenantId) && deviceIds.Contains(x.DeviceId))
            .OrderByDescending(x => x.LastSeenAt)
            .ThenByDescending(x => x.UpdatedAt)
            .Select(x => new
            {
                x.TenantId,
                x.DeviceId,
                x.AppVersion,
                ActivationLastSeenAt = x.LastSeenAt,
                x.Status
            })
            .ToListAsync(cancellationToken);

        var activationLookup = activationRows
            .GroupBy(x => (x.TenantId, x.DeviceId))
            .ToDictionary(x => x.Key, x => x.First());

        var lastSyncRows = await dbContext.ProcessedEvents.AsNoTracking()
            .Where(x => tenantIds.Contains(x.TenantId) && deviceIds.Contains(x.DeviceId))
            .GroupBy(x => new { x.TenantId, x.DeviceId })
            .Select(x => new
            {
                x.Key.TenantId,
                x.Key.DeviceId,
                LastSyncAt = x.Max(y => y.ProcessedAt)
            })
            .ToListAsync(cancellationToken);

        var lastSyncLookup = lastSyncRows.ToDictionary(x => (x.TenantId, x.DeviceId), x => (DateTimeOffset?)x.LastSyncAt);

        var licenseRows = await dbContext.IssuedLicenses.AsNoTracking()
            .Where(x => tenantIds.Contains(x.TenantId))
            .OrderByDescending(x => x.IssuedAt)
            .ThenByDescending(x => x.CreatedAt)
            .Select(x => new
            {
                x.TenantId,
                x.Status,
                x.ExpiresAt
            })
            .ToListAsync(cancellationToken);

        var licenseLookup = licenseRows
            .GroupBy(x => x.TenantId)
            .ToDictionary(x => x.Key, x => x.First());

        var response = new List<AdminDeviceResponse>(baseRows.Count);
        foreach (var row in baseRows)
        {
            activationLookup.TryGetValue((row.TenantId, row.DeviceId), out var activation);
            lastSyncLookup.TryGetValue((row.TenantId, row.DeviceId), out var lastSyncAt);
            licenseLookup.TryGetValue(row.TenantId, out var license);

            var lastSeenAt = activation?.ActivationLastSeenAt ?? row.DeviceLastSeenAt;
            var licenseStatus = ResolveLicenseStatus(row.TenantStatus, license?.Status, license?.ExpiresAt, now);
            var blocked = licenseStatus != "valid";
            var derivedStatus = blocked
                ? "blocked"
                : ResolveDeviceStatus(lastSeenAt, activeThreshold, staleThreshold);

            var isOnline = derivedStatus is "active" or "stale";
            var isStale = derivedStatus == "stale";
            var branchId = row.BranchId == Guid.Empty ? (Guid?)null : row.BranchId;

            response.Add(new AdminDeviceResponse(
                row.DeviceId,
                row.TenantId,
                row.TenantName,
                branchId,
                derivedStatus,
                lastSeenAt,
                lastSyncAt,
                activation?.AppVersion,
                licenseStatus,
                isOnline,
                isStale));
        }

        var filtered = normalizedStatusFilter is null
            ? response
            : response.Where(x => x.Status == normalizedStatusFilter).ToList();

        return Results.Ok(filtered);
    }


    private static async Task<IResult> GetSyncIssuesAsync(
        Guid? tenantId,
        string? status,
        string? eventType,
        string? search,
        bool? retryable,
        HttpContext httpContext,
        IInternalAdminAuthService authService,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context, new[] { "super_admin", "ops_admin", "support_agent", "security_auditor", "release_manager", "read_only_analyst" }))
        {
            return Results.Forbid();
        }

        var normalizedStatusFilter = NormalizeSyncIssueStatusFilter(status);
        if (status is not null && normalizedStatusFilter is null)
        {
            return Results.BadRequest(new { message = "status must be one of: retrying, failed, dead_letter." });
        }

        var normalizedEventTypeFilter = string.IsNullOrWhiteSpace(eventType) ? null : eventType.Trim();
        var normalizedSearch = string.IsNullOrWhiteSpace(search) ? null : search.Trim();

        var auditQuery = dbContext.AuditLogs.AsNoTracking()
            .Where(x => x.Action == "SYNC_EVENT_FAILED");
        if (tenantId.HasValue)
        {
            auditQuery = auditQuery.Where(x => x.TenantId == tenantId.Value);
        }

        var auditRows = await auditQuery
            .OrderByDescending(x => x.CreatedAt)
            .Take(5000)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.EntityId,
                x.PayloadJson,
                x.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var auditParsedRows = new List<AdminSyncIssueIntermediateRow>(auditRows.Count);
        foreach (var log in auditRows)
        {
            var parsedEventId = string.IsNullOrWhiteSpace(log.EntityId) ? $"audit-{log.Id}" : log.EntityId;
            string eventTypeValue = "sync.unknown";
            string rawStatus = "failed";
            string? errorCode = null;
            string reason = "Sync event failed.";
            Guid? deviceIdValue = null;
            DateTimeOffset? payloadAttemptAt = null;

            if (!string.IsNullOrWhiteSpace(log.PayloadJson))
            {
                try
                {
                    using var doc = JsonDocument.Parse(log.PayloadJson);
                    var root = doc.RootElement;

                    parsedEventId = ReadStringProperty(root, "eventId", "EventId") ?? parsedEventId;
                    eventTypeValue = ReadStringProperty(root, "eventType", "EventType") ?? eventTypeValue;
                    rawStatus = ReadStringProperty(root, "status", "Status") ?? rawStatus;
                    errorCode = ReadStringProperty(root, "errorCode", "ErrorCode");
                    reason = ReadStringProperty(root, "message", "Message") ?? reason;
                    deviceIdValue = ReadGuidProperty(root, "deviceId", "DeviceId");
                    payloadAttemptAt = ReadDateTimeOffsetProperty(root, "lastAttemptAt", "LastAttemptAt", "failedAt", "FailedAt");
                }
                catch
                {
                    // Ignore malformed payloads and keep fallback values.
                }
            }

            if (string.IsNullOrWhiteSpace(parsedEventId))
            {
                parsedEventId = $"audit-{log.Id}";
            }

            auditParsedRows.Add(new AdminSyncIssueIntermediateRow(
                IssueId: $"sync-audit-{log.Id}",
                TenantId: log.TenantId,
                TenantName: string.Empty,
                DeviceId: deviceIdValue,
                EventId: parsedEventId,
                EventType: eventTypeValue,
                Status: rawStatus,
                RetryCount: 0,
                Reason: reason,
                ErrorCode: errorCode,
                CreatedAt: log.CreatedAt,
                LastAttemptAt: payloadAttemptAt ?? log.CreatedAt,
                IsPermanentFailure: false,
                IsRetryable: false,
                SortAt: payloadAttemptAt ?? log.CreatedAt));
        }

        var groupedAuditIssues = auditParsedRows
            .GroupBy(x => new { x.TenantId, x.EventId })
            .Select(group =>
            {
                var ordered = group.OrderBy(x => x.CreatedAt).ToList();
                var latest = ordered[^1];
                var retryCountValue = Math.Max(0, ordered.Count - 1);
                var createdAtValue = ordered[0].CreatedAt;
                var lastAttemptAtValue = ordered.Max(x => x.LastAttemptAt ?? x.CreatedAt);
                var classification = ClassifySyncIssue(latest.Status, latest.ErrorCode, latest.Reason, retryCountValue, null);

                return latest with
                {
                    RetryCount = retryCountValue,
                    Status = classification.Status,
                    IsPermanentFailure = classification.IsPermanentFailure,
                    IsRetryable = classification.IsRetryable,
                    CreatedAt = createdAtValue,
                    LastAttemptAt = lastAttemptAtValue,
                    SortAt = lastAttemptAtValue
                };
            })
            .ToList();

        var integrationQuery = dbContext.IntegrationJobs.AsNoTracking()
            .Where(x => x.Status == "retrying" || x.Status == "failed" || x.Status == "dead_letter");
        if (tenantId.HasValue)
        {
            integrationQuery = integrationQuery.Where(x => x.TenantId == tenantId.Value);
        }

        var integrationRows = await integrationQuery
            .OrderByDescending(x => x.UpdatedAt)
            .Take(2000)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.IntegrationEventId,
                x.JobType,
                x.Status,
                x.RetryCount,
                x.MaxRetryCount,
                x.ErrorCode,
                x.ErrorMessage,
                x.PayloadJson,
                x.IdempotencyKey,
                x.CreatedAt,
                x.LastAttemptAt,
                x.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        var integrationIssues = new List<AdminSyncIssueIntermediateRow>(integrationRows.Count);
        foreach (var job in integrationRows)
        {
            var classification = ClassifySyncIssue(job.Status, job.ErrorCode, job.ErrorMessage, job.RetryCount, job.MaxRetryCount);
            var deviceIdValue = TryExtractDeviceIdFromPayload(job.PayloadJson);
            var resolvedEventId = job.IntegrationEventId?.ToString()
                ?? (!string.IsNullOrWhiteSpace(job.IdempotencyKey) ? job.IdempotencyKey : job.Id.ToString());

            integrationIssues.Add(new AdminSyncIssueIntermediateRow(
                IssueId: $"integration-job-{job.Id}",
                TenantId: job.TenantId,
                TenantName: string.Empty,
                DeviceId: deviceIdValue,
                EventId: resolvedEventId,
                EventType: string.IsNullOrWhiteSpace(job.JobType) ? "integration.unknown" : job.JobType,
                Status: classification.Status,
                RetryCount: Math.Max(0, job.RetryCount),
                Reason: !string.IsNullOrWhiteSpace(job.ErrorMessage) ? job.ErrorMessage : (!string.IsNullOrWhiteSpace(job.ErrorCode) ? job.ErrorCode : "Integration sync issue."),
                ErrorCode: job.ErrorCode,
                CreatedAt: job.CreatedAt,
                LastAttemptAt: job.LastAttemptAt ?? job.UpdatedAt,
                IsPermanentFailure: classification.IsPermanentFailure,
                IsRetryable: classification.IsRetryable,
                SortAt: job.LastAttemptAt ?? job.UpdatedAt));
        }

        var allIssues = groupedAuditIssues.Concat(integrationIssues).ToList();
        if (allIssues.Count == 0)
        {
            return Results.Ok(Array.Empty<AdminSyncIssueResponse>());
        }

        var tenantIds = allIssues.Select(x => x.TenantId).Distinct().ToArray();
        var tenantNameLookup = await dbContext.Tenants.AsNoTracking()
            .Where(x => tenantIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        var hydrated = allIssues
            .Select(x => x with { TenantName = tenantNameLookup.GetValueOrDefault(x.TenantId) ?? "Unknown tenant" })
            .ToList();

        if (!string.IsNullOrWhiteSpace(normalizedStatusFilter))
        {
            hydrated = hydrated.Where(x => x.Status.Equals(normalizedStatusFilter, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        if (!string.IsNullOrWhiteSpace(normalizedEventTypeFilter))
        {
            hydrated = hydrated.Where(x => x.EventType.Contains(normalizedEventTypeFilter, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        if (retryable.HasValue)
        {
            hydrated = hydrated.Where(x => x.IsRetryable == retryable.Value).ToList();
        }

        if (!string.IsNullOrWhiteSpace(normalizedSearch))
        {
            hydrated = hydrated.Where(x =>
                    x.TenantName.Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase) ||
                    x.EventId.Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase) ||
                    x.Reason.Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase) ||
                    x.DeviceId?.ToString().Contains(normalizedSearch, StringComparison.OrdinalIgnoreCase) == true)
                .ToList();
        }

        var response = hydrated
            .OrderByDescending(x => x.SortAt ?? x.CreatedAt)
            .Take(1000)
            .Select(x => new AdminSyncIssueResponse(
                x.IssueId,
                x.TenantId,
                x.TenantName,
                x.DeviceId,
                x.EventId,
                x.EventType,
                x.Status,
                x.RetryCount,
                x.Reason,
                x.CreatedAt,
                x.LastAttemptAt,
                x.IsPermanentFailure,
                x.IsRetryable))
            .ToList();

        return Results.Ok(response);
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
        var logger = httpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("InternalAdmin.Actions");
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context, new[] { "super_admin", "ops_admin", "support_agent" }))
        {
            logger.LogWarning(
                "internal_admin_action_forbidden action {Action} actor {Actor} tenantId {TenantId}",
                "internal.support_access.started",
                context?.Email ?? "unknown",
                request.TenantId);
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

        logger.LogInformation(
            "internal_admin_action_applied action {Action} actor {Actor} tenantId {TenantId} supportSessionId {SupportSessionId} accessMode {AccessMode}",
            "internal.support_access.started",
            context.Email,
            request.TenantId,
            session.Id,
            accessMode);

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
        var logger = httpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("InternalAdmin.Actions");
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context, new[] { "super_admin", "ops_admin", "support_agent", "security_auditor" }))
        {
            logger.LogWarning(
                "internal_admin_action_forbidden action {Action} actor {Actor} supportSessionId {SupportSessionId}",
                "internal.support_access.ended",
                context?.Email ?? "unknown",
                sessionId);
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

        logger.LogInformation(
            "internal_admin_action_applied action {Action} actor {Actor} tenantId {TenantId} supportSessionId {SupportSessionId}",
            "internal.support_access.ended",
            context.Email,
            session.TenantId,
            session.Id);

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
        var logger = httpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("InternalAdmin.Actions");
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context, allowedRoles))
        {
            logger.LogWarning(
                "internal_admin_action_forbidden action {Action} actor {Actor} tenantId {TenantId}",
                action,
                context?.Email ?? "unknown",
                tenantId);
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

        logger.LogInformation(
            "internal_admin_action_applied action {Action} actor {Actor} tenantId {TenantId} targetStatus {TargetStatus}",
            action,
            context.Email,
            tenantId,
            targetStatus);

        return Results.Ok(new { success = true, message = action });
    }

    private static async Task<IResult> RecordAdminActionAsync(Guid tenantId, AdminReasonRequest request, HttpContext httpContext, IInternalAdminAuthService authService, IAdminApprovalService approvalService, AppDbContext dbContext, CancellationToken cancellationToken, string action, string[] allowedRoles)
    {
        var logger = httpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("InternalAdmin.Actions");
        var context = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (context is null || !HasAnyRole(context, allowedRoles))
        {
            logger.LogWarning(
                "internal_admin_action_forbidden action {Action} actor {Actor} tenantId {TenantId}",
                action,
                context?.Email ?? "unknown",
                tenantId);
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return Results.BadRequest(new { message = "Reason is required." });
        }

        await approvalService.RecordActionAsync(context, action, "tenant", tenantId.ToString(), request.Reason, requiresApproval: false, metadata: null, cancellationToken);
        dbContext.AuditLogs.Add(BuildAudit(tenantId, action, context.Email, string.Join(",", context.Roles), request.Reason));
        await dbContext.SaveChangesAsync(cancellationToken);

        logger.LogInformation(
            "internal_admin_action_applied action {Action} actor {Actor} tenantId {TenantId}",
            action,
            context.Email,
            tenantId);

        return Results.Ok(new { success = true, message = action });
    }

    private static bool HasAnyRole(InternalAdminAccessContext context, IEnumerable<string> roles)
        => context.Roles.Any(role => roles.Contains(role, StringComparer.OrdinalIgnoreCase));



    private static SyncIssueClassification ClassifySyncIssue(string? rawStatus, string? errorCode, string? reason, int retryCount, int? maxRetryCount)
    {
        var normalizedStatus = rawStatus?.Trim().ToLowerInvariant();
        if (normalizedStatus is "dead_letter" or "dead-letter")
        {
            return new SyncIssueClassification("dead_letter", true, false);
        }

        if (normalizedStatus is "retrying" or "retry_later" or "pending_retry" or "queued")
        {
            return new SyncIssueClassification("retrying", false, true);
        }

        var permanent = IsPermanentFailure(errorCode, reason) || normalizedStatus == "rejected";
        if (!permanent && maxRetryCount.HasValue && maxRetryCount.Value > 0 && retryCount >= maxRetryCount.Value)
        {
            permanent = true;
        }

        return new SyncIssueClassification("failed", permanent, !permanent);
    }

    private static bool IsPermanentFailure(string? errorCode, string? reason)
    {
        var normalizedCode = errorCode?.Trim().ToLowerInvariant() ?? string.Empty;
        var normalizedReason = reason?.Trim().ToLowerInvariant() ?? string.Empty;

        var permanentSignals = new[]
        {
            "validation",
            "unsupported",
            "business_rule",
            "invalid",
            "forbidden",
            "not_found",
            "schema",
            "conflict"
        };

        return permanentSignals.Any(signal => normalizedCode.Contains(signal, StringComparison.Ordinal))
            || permanentSignals.Any(signal => normalizedReason.Contains(signal, StringComparison.Ordinal));
    }

    private static string? NormalizeSyncIssueStatusFilter(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return null;
        }

        return status.Trim().ToLowerInvariant() switch
        {
            "retrying" => "retrying",
            "failed" => "failed",
            "dead_letter" => "dead_letter",
            "dead-letter" => "dead_letter",
            _ => null
        };
    }

    private static Guid? TryExtractDeviceIdFromPayload(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(payloadJson);
            return ReadGuidProperty(document.RootElement, "deviceId", "DeviceId");
        }
        catch
        {
            return null;
        }
    }

    private static string? ReadStringProperty(JsonElement root, params string[] propertyNames)
    {
        foreach (var propertyName in propertyNames)
        {
            if (!TryGetPropertyIgnoreCase(root, propertyName, out var value))
            {
                continue;
            }

            if (value.ValueKind == JsonValueKind.String)
            {
                return value.GetString();
            }

            if (value.ValueKind is JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False)
            {
                return value.ToString();
            }
        }

        return null;
    }

    private static DateTimeOffset? ReadDateTimeOffsetProperty(JsonElement root, params string[] propertyNames)
    {
        foreach (var propertyName in propertyNames)
        {
            if (!TryGetPropertyIgnoreCase(root, propertyName, out var value))
            {
                continue;
            }

            if (value.ValueKind == JsonValueKind.String && DateTimeOffset.TryParse(value.GetString(), out var parsed))
            {
                return parsed;
            }
        }

        return null;
    }

    private static Guid? ReadGuidProperty(JsonElement root, params string[] propertyNames)
    {
        foreach (var propertyName in propertyNames)
        {
            if (!TryGetPropertyIgnoreCase(root, propertyName, out var value))
            {
                continue;
            }

            if (value.ValueKind == JsonValueKind.String && Guid.TryParse(value.GetString(), out var parsed))
            {
                return parsed;
            }
        }

        return null;
    }

    private static bool TryGetPropertyIgnoreCase(JsonElement root, string propertyName, out JsonElement value)
    {
        if (root.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in root.EnumerateObject())
            {
                if (property.Name.Equals(propertyName, StringComparison.OrdinalIgnoreCase))
                {
                    value = property.Value;
                    return true;
                }
            }
        }

        value = default;
        return false;
    }

    private static string ResolveDeviceStatus(DateTimeOffset? lastSeenAt, DateTimeOffset activeThreshold, DateTimeOffset staleThreshold)
    {
        if (!lastSeenAt.HasValue)
        {
            return "offline";
        }

        if (lastSeenAt.Value >= activeThreshold)
        {
            return "active";
        }

        if (lastSeenAt.Value >= staleThreshold)
        {
            return "stale";
        }

        return "offline";
    }

    private static string ResolveLicenseStatus(string? tenantStatus, string? licenseStatus, DateTimeOffset? licenseExpiresAt, DateTimeOffset now)
    {
        var normalizedTenantStatus = tenantStatus?.Trim().ToLowerInvariant();
        if (normalizedTenantStatus is "suspended" or "blocked")
        {
            return "blocked";
        }

        if (string.IsNullOrWhiteSpace(licenseStatus))
        {
            return "expired";
        }

        var normalizedLicenseStatus = licenseStatus.Trim().ToLowerInvariant();
        if (normalizedLicenseStatus is "blocked" or "suspended" or "revoked" or "invalid" or "canceled")
        {
            return "blocked";
        }

        if (normalizedLicenseStatus == "expired" || (licenseExpiresAt.HasValue && licenseExpiresAt.Value <= now))
        {
            return "expired";
        }

        return normalizedLicenseStatus is "active" or "valid" ? "valid" : "expired";
    }

    private static string? NormalizeDeviceStatusFilter(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return null;
        }

        return status.Trim().ToLowerInvariant() switch
        {
            "active" => "active",
            "stale" => "stale",
            "offline" => "offline",
            "blocked" => "blocked",
            _ => null
        };
    }

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


    private sealed record SyncIssueClassification(
        string Status,
        bool IsPermanentFailure,
        bool IsRetryable);

    private sealed record AdminSyncIssueIntermediateRow(
        string IssueId,
        Guid TenantId,
        string TenantName,
        Guid? DeviceId,
        string EventId,
        string EventType,
        string Status,
        int RetryCount,
        string Reason,
        string? ErrorCode,
        DateTimeOffset CreatedAt,
        DateTimeOffset? LastAttemptAt,
        bool IsPermanentFailure,
        bool IsRetryable,
        DateTimeOffset? SortAt);

    private sealed record AdminSyncIssueResponse(
        string IssueId,
        Guid TenantId,
        string TenantName,
        Guid? DeviceId,
        string EventId,
        string EventType,
        string Status,
        int RetryCount,
        string Reason,
        DateTimeOffset CreatedAt,
        DateTimeOffset? LastAttemptAt,
        bool IsPermanentFailure,
        bool IsRetryable);

    private sealed record AdminDeviceResponse(
        Guid DeviceId,
        Guid TenantId,
        string TenantName,
        Guid? BranchId,
        string Status,
        DateTimeOffset? LastSeenAt,
        DateTimeOffset? LastSyncAt,
        string? AppVersion,
        string LicenseStatus,
        bool IsOnline,
        bool IsStale);
}
