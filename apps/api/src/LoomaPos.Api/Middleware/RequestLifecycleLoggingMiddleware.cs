using System.Diagnostics;
using System.Security.Claims;
using LoomaPos.Infrastructure.MultiTenancy;

namespace LoomaPos.Api.Middleware;

public sealed class RequestLifecycleLoggingMiddleware
{
    private const string CorrelationHeader = "x-correlation-id";

    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLifecycleLoggingMiddleware> _logger;
    private readonly long _slowRequestThresholdMs;

    public RequestLifecycleLoggingMiddleware(
        RequestDelegate next,
        ILogger<RequestLifecycleLoggingMiddleware> logger,
        IConfiguration configuration)
    {
        _next = next;
        _logger = logger;
        _slowRequestThresholdMs = configuration.GetValue("Logging:SlowRequestThresholdMs", 1200L);
    }

    public async Task InvokeAsync(HttpContext context, RequestTenantProvider tenantProvider)
    {
        var correlationId = EnsureCorrelationId(context);
        var actor = ResolveActor(context.User);
        var tenantId = tenantProvider.TenantId?.ToString();
        var branchId = tenantProvider.BranchId?.ToString();
        var deviceId = tenantProvider.DeviceId?.ToString();
        var endpoint = context.GetEndpoint()?.DisplayName ?? "unmatched";
        var method = context.Request.Method;
        var path = context.Request.Path.Value ?? "/";

        var stopwatch = Stopwatch.StartNew();
        Exception? failure = null;

        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            failure = ex;
            stopwatch.Stop();

            _logger.LogError(
                ex,
                "request_unhandled_error method {Method} path {Path} statusCode {StatusCode} durationMs {DurationMs} requestId {RequestId} correlationId {CorrelationId} endpoint {Endpoint} actor {Actor} tenantId {TenantId} branchId {BranchId} deviceId {DeviceId} exceptionType {ExceptionType} errorMessage {ErrorMessage}",
                method,
                path,
                StatusCodes.Status500InternalServerError,
                stopwatch.ElapsedMilliseconds,
                context.TraceIdentifier,
                correlationId,
                endpoint,
                actor,
                tenantId,
                branchId,
                deviceId,
                ex.GetType().Name,
                ex.Message);

            throw;
        }
        finally
        {
            if (failure is null)
            {
                stopwatch.Stop();
                var statusCode = context.Response.StatusCode;
                var isSlowRequest = stopwatch.ElapsedMilliseconds >= _slowRequestThresholdMs;
                var level = statusCode >= 500 || isSlowRequest
                    ? LogLevel.Warning
                    : LogLevel.Information;

                _logger.Log(
                    level,
                    "request_completed method {Method} path {Path} statusCode {StatusCode} durationMs {DurationMs} requestId {RequestId} correlationId {CorrelationId} endpoint {Endpoint} actor {Actor} tenantId {TenantId} branchId {BranchId} deviceId {DeviceId} slowRequest {SlowRequest}",
                    method,
                    path,
                    statusCode,
                    stopwatch.ElapsedMilliseconds,
                    context.TraceIdentifier,
                    correlationId,
                    endpoint,
                    actor,
                    tenantId,
                    branchId,
                    deviceId,
                    isSlowRequest);
            }
        }
    }

    private static string EnsureCorrelationId(HttpContext context)
    {
        var incoming = context.Request.Headers[CorrelationHeader].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(incoming))
        {
            var trimmed = incoming.Trim();
            if (trimmed.Length <= 128)
            {
                context.TraceIdentifier = trimmed;
            }
        }

        context.Response.Headers[CorrelationHeader] = context.TraceIdentifier;
        return context.TraceIdentifier;
    }

    private static string ResolveActor(ClaimsPrincipal user)
    {
        if (user.Identity?.IsAuthenticated != true)
        {
            return "anonymous";
        }

        return user.FindFirstValue("preferred_username")
            ?? user.FindFirstValue(ClaimTypes.Email)
            ?? user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue("sub")
            ?? "authenticated";
    }
}
