using LoomaPos.Api.Security;

namespace LoomaPos.Api.Endpoints;

public static class InternalAdminAuthEndpoints
{
    public static IEndpointRouteBuilder MapInternalAdminAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/internal/admin/auth").WithTags("Internal Admin Auth");

        group.MapPost("/login", LoginAsync)
            .RequireRateLimiting("internal-auth");

        var authenticated = group.MapGroup(string.Empty)
            .RequireInternalAdminAccess();

        authenticated.MapGet("/me", MeAsync);
        authenticated.MapPost("/logout", LogoutAsync)
            .RequireRateLimiting("internal-auth");

        return app;
    }

    private static async Task<IResult> LoginAsync(LoginRequest request, HttpContext httpContext, IInternalAdminAuthService authService, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return Results.BadRequest(new { message = "Email and password are required." });
        }

        try
        {
            return Results.Ok(await authService.LoginAsync(request.Email, request.Password, httpContext, cancellationToken));
        }
        catch (InvalidOperationException exception)
        {
            return Results.BadRequest(new { message = exception.Message });
        }
    }

    private static async Task<IResult> MeAsync(HttpContext httpContext, IInternalAdminAuthService authService, CancellationToken cancellationToken)
    {
        var access = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        if (access is null)
        {
            return Results.Unauthorized();
        }

        var sessions = await authService.ListSessionsAsync(access.UserId, cancellationToken);
        return Results.Ok(new
        {
            access.UserId,
            access.Email,
            access.DisplayName,
            access.Roles,
            sessions
        });
    }

    private static async Task<IResult> LogoutAsync(HttpContext httpContext, IInternalAdminAuthService authService, CancellationToken cancellationToken)
    {
        await authService.LogoutAsync(httpContext, cancellationToken);
        return Results.Ok(new { success = true });
    }

    private sealed record LoginRequest(string Email, string Password);
}
