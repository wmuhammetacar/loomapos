using System.Security.Claims;
using LoomaPos.Infrastructure.MultiTenancy;

namespace LoomaPos.Api.Middleware;

public sealed class TenantContextMiddleware
{
    private readonly RequestDelegate _next;

    public TenantContextMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, RequestTenantProvider tenantProvider)
    {
        var tenantId = ResolveGuid(context, "tenant_id", "tenantId", "tenant", "X-Tenant-Id");
        var branchId = ResolveGuid(context, "branch_id", "branchId", "branch", "X-Branch-Id");
        var deviceId = ResolveGuid(context, "device_id", "deviceId", "X-Device-Id");

        var userId = TryParseGuid(
            context.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? context.User.FindFirstValue("sub")
            ?? context.Request.Headers["X-User-Id"].FirstOrDefault());

        tenantProvider.SetContext(tenantId, branchId, userId, deviceId);
        await _next(context);
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

            var headerValue = context.Request.Headers[key].FirstOrDefault();
            if (TryParseGuid(headerValue) is { } parsedHeader)
            {
                return parsedHeader;
            }
        }

        return null;
    }

    private static Guid? TryParseGuid(string? value)
    {
        return Guid.TryParse(value, out var guid) ? guid : null;
    }
}
