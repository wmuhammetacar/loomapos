using System.Security.Claims;
using LoomaPos.Api.Commerce;
using LoomaPos.Infrastructure.MultiTenancy;

namespace LoomaPos.Api.Middleware;

public sealed class TenantContextMiddleware
{
    private static readonly PathString[] TenantOptionalPrefixes =
    [
        new PathString("/health"),
        new PathString("/swagger"),
        new PathString("/internal"),
        new PathString("/public")
    ];

    private readonly RequestDelegate _next;

    public TenantContextMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, RequestTenantProvider tenantProvider)
    {
        var tenantId = ResolveGuid(context, "tenant_id", "tenantId", "tenant");
        var branchId = ResolveGuid(context, "branch_id", "branchId", "branch");
        var deviceId = ResolveGuid(context, "device_id", "deviceId");

        var userId = TryParseGuid(
            context.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? context.User.FindFirstValue("sub"));

        if (!tenantId.HasValue)
        {
            var authService = context.RequestServices.GetService<IPortalAuthService>();
            if (authService is not null)
            {
                var access = await authService.GetAccessContextAsync(context, context.RequestAborted);
                if (access?.TenantId is Guid accessTenantId)
                {
                    tenantId = accessTenantId;
                }

                if (!userId.HasValue && access?.CustomerAccountId is Guid accessUserId)
                {
                    userId = accessUserId;
                }
            }
        }

        if (!tenantId.HasValue && IsTenantRequiredAuthenticatedRequest(context.Request, context.User))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { error = "tenant context is required" }, context.RequestAborted);
            return;
        }

        tenantProvider.SetContext(tenantId, branchId, userId, deviceId);
        await _next(context);
    }

    private static bool IsTenantRequiredAuthenticatedRequest(HttpRequest request, ClaimsPrincipal user)
    {
        if (!IsAuthenticatedRequest(request, user))
        {
            return false;
        }

        var path = request.Path;
        if (TenantOptionalPrefixes.Any(prefix => path.StartsWithSegments(prefix, StringComparison.OrdinalIgnoreCase)))
        {
            return false;
        }

        if (path.StartsWithSegments("/commerce/pricing", StringComparison.OrdinalIgnoreCase)
            || path.StartsWithSegments("/commerce/checkout", StringComparison.OrdinalIgnoreCase)
            || path.StartsWithSegments("/commerce/downloads/public", StringComparison.OrdinalIgnoreCase)
            || path.StartsWithSegments("/commerce/reseller", StringComparison.OrdinalIgnoreCase)
            || path.StartsWithSegments("/commerce/auth", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return true;
    }

    private static bool IsAuthenticatedRequest(HttpRequest request, ClaimsPrincipal user)
    {
        if (user.Identity?.IsAuthenticated == true)
        {
            return true;
        }

        var authorization = request.Headers.Authorization.ToString();
        return !string.IsNullOrWhiteSpace(authorization)
            && authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase);
    }

    private static Guid? ResolveGuid(HttpContext context, params string[] keys)
    {
        foreach (var key in keys)
        {
            var claimValue = context.User.FindFirstValue(key);
            if (TryParseGuid(claimValue) is { } parsedClaim)
            {
                return parsedClaim;
            }
        }

        return null;
    }

    private static Guid? TryParseGuid(string? value)
    {
        return Guid.TryParse(value, out var guid) ? guid : null;
    }
}
