using LoomaPos.Api.Commerce;

namespace LoomaPos.Api.Endpoints;

public static class CommerceAuthCoreEndpoints
{
    public static IEndpointRouteBuilder MapCommerceAuthCoreEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/commerce/auth").WithTags("Commerce Auth");

        group.MapPost("/register", RegisterAsync)
            .WithName("CommerceRegister")
            .WithSummary("Registers a customer account for the commercial portal.")
            .RequireRateLimiting("auth");

        group.MapPost("/login", LoginAsync)
            .WithName("CommerceLogin")
            .WithSummary("Authenticates a customer account for the commercial portal.")
            .RequireRateLimiting("auth");

        group.MapPost("/desktop-login", DesktopLoginAsync)
            .WithName("CommerceDesktopLogin")
            .WithSummary("Authenticates a desktop bootstrap user for activation and operational handoff.")
            .RequireRateLimiting("auth");

        group.MapPost("/mobile-login", MobileLoginAsync)
            .WithName("CommerceMobileLogin")
            .WithSummary("Authenticates a mobile operational user for activation and field workflows.")
            .RequireRateLimiting("auth");

        group.MapPost("/reseller-login", ResellerLoginAsync)
            .WithName("CommerceResellerLogin")
            .WithSummary("Authenticates an approved reseller account for the reseller portal.")
            .RequireRateLimiting("auth");

        group.MapPost("/forgot-password", ForgotPasswordAsync)
            .WithName("CommerceForgotPassword")
            .WithSummary("Creates a password reset request for a customer account.")
            .RequireRateLimiting("auth");

        group.MapPost("/reset-password", ResetPasswordAsync)
            .WithName("CommerceResetPassword")
            .WithSummary("Resets customer password by using a reset token.")
            .RequireRateLimiting("auth");

        group.MapPost("/verify-email", VerifyEmailAsync)
            .WithName("CommerceVerifyEmail")
            .WithSummary("Verifies customer e-mail by using a verification token.")
            .RequireRateLimiting("auth");

        group.MapPost("/refresh", RefreshAsync)
            .WithName("CommerceRefresh")
            .WithSummary("Refreshes customer or reseller portal session.")
            .RequireRateLimiting("auth-refresh");

        group.MapGet("/me", MeAsync)
            .WithName("CommerceMe")
            .WithSummary("Returns current customer portal identity.");

        group.MapPost("/logout", LogoutAsync)
            .WithName("CommerceLogout")
            .WithSummary("Revokes current customer portal session.");

        return app;
    }

    private static async Task<IResult> RegisterAsync(
        CustomerRegisterRequest request,
        HttpContext httpContext,
        IPortalAuthService authService,
        CancellationToken cancellationToken)
    {
        var result = await authService.RegisterCustomerAsync(
            request.Email,
            request.Password,
            request.FullName,
            request.Phone,
            request.CompanyName,
            httpContext,
            cancellationToken);
        return Results.Ok(ToAuthResponse(result));
    }

    private static async Task<IResult> LoginAsync(
        CustomerLoginRequest request,
        HttpContext httpContext,
        IPortalAuthService authService,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await authService.LoginCustomerAsync(
                request.Email,
                request.Password,
                httpContext,
                cancellationToken);
            return Results.Ok(ToAuthResponse(result));
        }
        catch (InvalidOperationException ex)
        {
            return Results.Json(new { message = ex.Message }, statusCode: 401);
        }
    }

    private static async Task<IResult> DesktopLoginAsync(
        CustomerLoginRequest request,
        HttpContext httpContext,
        IPortalAuthService authService,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await authService.LoginCustomerAsync(
                request.Email,
                request.Password,
                httpContext,
                cancellationToken);
            return Results.Ok(ToAuthResponse(result));
        }
        catch (InvalidOperationException ex)
        {
            return Results.Json(new { message = ex.Message }, statusCode: 401);
        }
    }

    private static async Task<IResult> MobileLoginAsync(
        CustomerLoginRequest request,
        HttpContext httpContext,
        IPortalAuthService authService,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await authService.LoginCustomerAsync(
                request.Email,
                request.Password,
                httpContext,
                cancellationToken);
            return Results.Ok(ToAuthResponse(result));
        }
        catch (InvalidOperationException ex)
        {
            return Results.Json(new { message = ex.Message }, statusCode: 401);
        }
    }

    private static async Task<IResult> ResellerLoginAsync(
        ResellerLoginRequest request,
        HttpContext httpContext,
        IPortalAuthService authService,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await authService.LoginResellerAsync(
                request.Email,
                request.Password,
                httpContext,
                cancellationToken);
            return Results.Ok(ToAuthResponse(result));
        }
        catch (InvalidOperationException ex)
        {
            return Results.Json(new { message = ex.Message }, statusCode: 401);
        }
    }

    private static async Task<IResult> ForgotPasswordAsync(
        ForgotPasswordRequest request,
        IPortalAuthService authService,
        CancellationToken cancellationToken)
    {
        await authService.RequestPasswordResetAsync(request.Email, cancellationToken);
        return Results.Ok(new { queued = true });
    }

    private static async Task<IResult> ResetPasswordAsync(
        ResetPasswordRequest request,
        IPortalAuthService authService,
        CancellationToken cancellationToken)
    {
        await authService.ResetPasswordAsync(request.Token, request.Password, cancellationToken);
        return Results.Ok(new { reset = true });
    }

    private static async Task<IResult> VerifyEmailAsync(
        VerifyEmailRequest request,
        IPortalAuthService authService,
        CancellationToken cancellationToken)
    {
        await authService.VerifyEmailAsync(request.Token, cancellationToken);
        return Results.Ok(new { verified = true });
    }

    private static async Task<IResult> RefreshAsync(
        RefreshSessionRequest request,
        HttpContext httpContext,
        IPortalAuthService authService,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await authService.RefreshSessionAsync(request.RefreshToken, httpContext, cancellationToken);
            return Results.Ok(ToAuthResponse(result));
        }
        catch (InvalidOperationException ex)
        {
            return Results.Json(new { message = ex.Message }, statusCode: 401);
        }
    }

    private static async Task<IResult> MeAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        CancellationToken cancellationToken)
    {
        var access = await authService.GetAccessContextAsync(httpContext, cancellationToken);
        return access is null
            ? Results.Unauthorized()
            : Results.Ok(new
            {
                access.PortalType,
                Role = access.RoleCode,
                access.Email,
                access.DisplayName,
                access.TenantId,
                access.CompanyName,
                access.ResellerCode
            });
    }

    private static async Task<IResult> LogoutAsync(
        HttpContext httpContext,
        IPortalAuthService authService,
        CancellationToken cancellationToken)
    {
        await authService.LogoutAsync(httpContext, cancellationToken);
        return Results.Ok(new { loggedOut = true });
    }

    private static PortalAuthResponse ToAuthResponse(PortalTokenEnvelope result)
    {
        return new PortalAuthResponse(
            result.AccessToken,
            result.RefreshToken,
            result.ExpiresAt,
            result.RefreshExpiresAt,
            result.PortalType,
            result.Roles,
            result.Email,
            result.DisplayName,
            result.TenantId,
            result.CompanyName,
            result.ResellerCode);
    }

    public sealed record CustomerRegisterRequest(
        string FullName,
        string CompanyName,
        string Email,
        string? Phone,
        string Password);

    public sealed record CustomerLoginRequest(string Email, string Password);
    public sealed record ResellerLoginRequest(string Email, string Password);
    public sealed record ForgotPasswordRequest(string Email);
    public sealed record ResetPasswordRequest(string Token, string Password);
    public sealed record VerifyEmailRequest(string Token);
    public sealed record RefreshSessionRequest(string RefreshToken);

    public sealed record PortalAuthResponse(
        string AccessToken,
        string RefreshToken,
        DateTimeOffset ExpiresAt,
        DateTimeOffset RefreshExpiresAt,
        string PortalType,
        string[] Roles,
        string Email,
        string DisplayName,
        Guid? TenantId,
        string? CompanyName,
        string? ResellerCode);
}
