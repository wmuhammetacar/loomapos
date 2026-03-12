using LoomaPos.Api.Analytics;
using LoomaPos.Api.Commerce;
using LoomaPos.Api.Security;

namespace LoomaPos.Api.Endpoints;

public static class AnalyticsEndpoints
{
    public static IEndpointRouteBuilder MapAnalyticsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/analytics").WithTags("Analytics");

        group.MapGet("/catalog/kpis", (IAnalyticsReadModelService service) => Results.Ok(service.GetKpiCatalog()));
        group.MapGet("/catalog/reports", (IAnalyticsReadModelService service) => Results.Ok(service.GetReportCatalog()));
        group.MapGet("/tenant/workspace", GetTenantWorkspaceAsync);
        group.MapGet("/tenant/export/{reportCode}", ExportTenantReportAsync);
        group.MapGet("/tenant/schedules", GetTenantSchedulesAsync);
        group.MapPost("/tenant/schedules", UpsertTenantScheduleAsync);
        group.MapGet("/tenant/saved-views", GetTenantSavedViewsAsync);
        group.MapPost("/tenant/saved-views", SaveTenantSavedViewAsync);
        group.MapDelete("/tenant/saved-views/{viewId:guid}", DeleteTenantSavedViewAsync);
        group.MapGet("/reseller/workspace", GetResellerWorkspaceAsync);
        group.MapGet("/internal/workspace", GetInternalWorkspaceAsync);
        group.MapGet("/internal/quality", GetQualitySummaryAsync);
        group.MapPost("/internal/refresh/tenant/{tenantId:guid}", RefreshTenantWarehouseAsync);

        return app;
    }

    private static async Task<IResult> GetTenantWorkspaceAsync(
        int? days,
        Guid? branchId,
        string? timezone,
        HttpContext httpContext,
        IPortalAuthService authService,
        IAnalyticsReadModelService analyticsService,
        CancellationToken cancellationToken)
    {
        var access = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (access is not { PortalType: "customer", TenantId: not null })
        {
            return Results.Unauthorized();
        }
        if (!CanViewTenantAnalytics(access.RoleCode))
        {
            return Results.Forbid();
        }

        return Results.Ok(await analyticsService.BuildTenantWorkspaceAsync(
            access.TenantId.Value,
            new AnalyticsQuery(days ?? 30, branchId, timezone),
            cancellationToken));
    }

    private static async Task<IResult> ExportTenantReportAsync(
        string reportCode,
        int? days,
        Guid? branchId,
        string? timezone,
        HttpContext httpContext,
        IPortalAuthService authService,
        IAnalyticsReadModelService analyticsService,
        CancellationToken cancellationToken)
    {
        var access = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (access is not { PortalType: "customer", TenantId: not null })
        {
            return Results.Unauthorized();
        }
        if (!CanViewTenantAnalytics(access.RoleCode))
        {
            return Results.Forbid();
        }

        var csv = await analyticsService.ExportTenantReportCsvAsync(
            access.TenantId.Value,
            reportCode,
            new AnalyticsQuery(days ?? 30, branchId, timezone),
            cancellationToken);

        return csv is null
            ? Results.NotFound()
            : Results.Text(csv, "text/csv");
    }

    private static async Task<IResult> GetResellerWorkspaceAsync(
        int? days,
        string? timezone,
        HttpContext httpContext,
        IPortalAuthService authService,
        IAnalyticsReadModelService analyticsService,
        CancellationToken cancellationToken)
    {
        var access = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (access is not { PortalType: "reseller", ResellerAccountId: not null })
        {
            return Results.Unauthorized();
        }

        return Results.Ok(await analyticsService.BuildResellerWorkspaceAsync(
            access.ResellerAccountId.Value,
            new AnalyticsQuery(days ?? 30, null, timezone),
            cancellationToken));
    }

    private static async Task<IResult> GetTenantSchedulesAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        IAnalyticsReadModelService analyticsService,
        CancellationToken cancellationToken)
    {
        var access = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (access is not { PortalType: "customer", TenantId: not null })
        {
            return Results.Unauthorized();
        }
        if (!CanViewTenantAnalytics(access.RoleCode))
        {
            return Results.Forbid();
        }

        return Results.Ok(await analyticsService.GetTenantSchedulesAsync(access.TenantId.Value, cancellationToken));
    }

    private static async Task<IResult> UpsertTenantScheduleAsync(
        TenantScheduleUpsertRequest request,
        HttpContext httpContext,
        IPortalAuthService authService,
        IAnalyticsReadModelService analyticsService,
        CancellationToken cancellationToken)
    {
        var access = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (access is not { PortalType: "customer", TenantId: not null })
        {
            return Results.Unauthorized();
        }
        if (!CanViewTenantAnalytics(access.RoleCode))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.ReportCode) || string.IsNullOrWhiteSpace(request.Frequency) || string.IsNullOrWhiteSpace(request.Format))
        {
            return Results.BadRequest(new { message = "Name, reportCode, frequency and format are required." });
        }

        var row = await analyticsService.UpsertTenantScheduleAsync(
            access.TenantId.Value,
            request.ScheduleId,
            request.Name,
            request.ReportCode,
            request.Frequency,
            request.Format,
            string.IsNullOrWhiteSpace(request.Timezone) ? "Europe/Istanbul" : request.Timezone,
            request.Recipients ?? Array.Empty<string>(),
            request.FiltersJson ?? "{}",
            request.IsActive,
            cancellationToken);
        return Results.Ok(row);
    }

    private static async Task<IResult> GetTenantSavedViewsAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        IAnalyticsReadModelService analyticsService,
        CancellationToken cancellationToken)
    {
        var access = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (access is not { PortalType: "customer", TenantId: not null })
        {
            return Results.Unauthorized();
        }
        if (!CanViewTenantAnalytics(access.RoleCode))
        {
            return Results.Forbid();
        }

        return Results.Ok(await analyticsService.GetTenantSavedViewsAsync(access.TenantId.Value, access.CustomerAccountId, cancellationToken));
    }

    private static async Task<IResult> SaveTenantSavedViewAsync(
        TenantSavedViewRequest request,
        HttpContext httpContext,
        IPortalAuthService authService,
        IAnalyticsReadModelService analyticsService,
        CancellationToken cancellationToken)
    {
        var access = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (access is not { PortalType: "customer", TenantId: not null })
        {
            return Results.Unauthorized();
        }
        if (!CanViewTenantAnalytics(access.RoleCode))
        {
            return Results.Forbid();
        }
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.ViewCode))
        {
            return Results.BadRequest(new { message = "Name and viewCode are required." });
        }

        var row = await analyticsService.SaveTenantViewAsync(
            access.TenantId.Value,
            access.CustomerAccountId,
            request.Name,
            request.ViewCode,
            request.FiltersJson ?? "{}",
            request.IsDefault,
            cancellationToken);
        return Results.Ok(row);
    }

    private static async Task<IResult> DeleteTenantSavedViewAsync(
        Guid viewId,
        HttpContext httpContext,
        IPortalAuthService authService,
        IAnalyticsReadModelService analyticsService,
        CancellationToken cancellationToken)
    {
        var access = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (access is not { PortalType: "customer", TenantId: not null })
        {
            return Results.Unauthorized();
        }
        if (!CanViewTenantAnalytics(access.RoleCode))
        {
            return Results.Forbid();
        }

        var deleted = await analyticsService.DeleteTenantViewAsync(access.TenantId.Value, access.CustomerAccountId, viewId, cancellationToken);
        return deleted ? Results.Ok(new { deleted = true, viewId }) : Results.NotFound();
    }

    private static async Task<IResult> GetInternalWorkspaceAsync(
        int? days,
        string? timezone,
        HttpContext httpContext,
        IInternalAdminAuthService internalAuthService,
        IAnalyticsReadModelService analyticsService,
        CancellationToken cancellationToken)
    {
        if (await internalAuthService.GetAccessContextAsync(httpContext, cancellationToken) is null)
        {
            return Results.Unauthorized();
        }

        return Results.Ok(await analyticsService.BuildInternalWorkspaceAsync(
            new AnalyticsQuery(days ?? 30, null, timezone),
            cancellationToken));
    }

    private static async Task<IResult> GetQualitySummaryAsync(
        HttpContext httpContext,
        IInternalAdminAuthService internalAuthService,
        IAnalyticsReadModelService analyticsService,
        CancellationToken cancellationToken)
    {
        if (await internalAuthService.GetAccessContextAsync(httpContext, cancellationToken) is null)
        {
            return Results.Unauthorized();
        }

        return Results.Ok(await analyticsService.BuildQualitySummaryAsync(cancellationToken));
    }

    private static async Task<IResult> RefreshTenantWarehouseAsync(
        Guid tenantId,
        HttpContext httpContext,
        IInternalAdminAuthService internalAuthService,
        IAnalyticsWarehouseService warehouseService,
        CancellationToken cancellationToken)
    {
        if (await internalAuthService.GetAccessContextAsync(httpContext, cancellationToken) is null)
        {
            return Results.Unauthorized();
        }

        await warehouseService.EnsureTenantWarehouseFreshAsync(tenantId, cancellationToken);
        return Results.Accepted($"/analytics/internal/refresh/tenant/{tenantId}", new { tenantId, status = "queued_or_fresh" });
    }

    private static bool CanViewTenantAnalytics(string? roleCode)
    {
        return roleCode is not null &&
               (roleCode.Equals("tenant_owner", StringComparison.OrdinalIgnoreCase) ||
                roleCode.Equals("company_admin", StringComparison.OrdinalIgnoreCase));
    }

    private sealed record TenantScheduleUpsertRequest(
        string? ScheduleId,
        string Name,
        string ReportCode,
        string Frequency,
        string Format,
        string? Timezone,
        string[]? Recipients,
        string? FiltersJson,
        bool IsActive = true);

    private sealed record TenantSavedViewRequest(
        string Name,
        string ViewCode,
        string? FiltersJson,
        bool IsDefault = false);
}
