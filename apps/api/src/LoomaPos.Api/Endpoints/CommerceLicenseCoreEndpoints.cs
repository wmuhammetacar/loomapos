using System.Text.Json;
using LoomaPos.Api.Commerce;
using LoomaPos.Domain.Commerce;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Endpoints;

public static class CommerceLicenseCoreEndpoints
{
    public static IEndpointRouteBuilder MapCommerceLicenseCoreEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/commerce/license").WithTags("Commerce License");

        group.MapPost("/validate", ValidateLicenseAsync)
            .WithName("ValidateCommercialLicense")
            .WithSummary("Validates license token or license key for desktop/mobile activation prep.")
            .RequireRateLimiting("license");

        group.MapPost("/activate", ActivateDeviceAsync)
            .WithName("ActivateCommercialDevice")
            .WithSummary("Activates a device for a license and enforces device limits.")
            .RequireRateLimiting("license");

        group.MapPost("/heartbeat", DeviceHeartbeatAsync)
            .WithName("CommercialDeviceHeartbeat")
            .WithSummary("Updates device last seen and returns current license state.")
            .RequireRateLimiting("license");

        group.MapPost("/deactivate", DeactivateDeviceAsync)
            .WithName("DeactivateCommercialDevice")
            .WithSummary("Deactivates a bound device for future reuse.")
            .RequireRateLimiting("license");

        return app;
    }

    private static async Task<IResult> ValidateLicenseAsync(
        LicenseLookupRequest request,
        AppDbContext dbContext,
        ILicenseArtifactService licenseArtifactService,
        CancellationToken cancellationToken)
    {
        var license = await FindLicenseAsync(dbContext, request, cancellationToken);
        if (license is null)
        {
            return Results.NotFound();
        }

        var tokenValid = !string.IsNullOrWhiteSpace(request.LicenseToken)
            ? licenseArtifactService.TryValidate(request.LicenseToken, out _)
            : licenseArtifactService.TryValidate(license.LicenseToken, out _);

        return Results.Ok(new
        {
            license.Id,
            license.LicenseKey,
            license.PlanCode,
            license.Status,
            license.ExpiresAt,
            license.DeviceLimit,
            Features = JsonSerializer.Deserialize<string[]>(license.FeaturesJson) ?? [],
            TokenValid = tokenValid
        });
    }

    private static async Task<IResult> ActivateDeviceAsync(
        LicenseDeviceRequest request,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var license = await FindLicenseAsync(dbContext, new LicenseLookupRequest(request.LicenseKey, request.LicenseToken), cancellationToken);
        if (license is null)
        {
            return Results.NotFound();
        }

        if (!string.Equals(license.Status, "active", StringComparison.OrdinalIgnoreCase))
        {
            return Results.BadRequest(new { error = "license is not active" });
        }

        var activeCount = await dbContext.DeviceActivations
            .CountAsync(x => x.TenantId == license.TenantId && x.RevokedAt == null, cancellationToken);
        var deviceId = request.DeviceId == Guid.Empty ? Guid.NewGuid() : request.DeviceId;
        var existing = await dbContext.DeviceActivations
            .FirstOrDefaultAsync(x => x.TenantId == license.TenantId && x.DeviceId == deviceId, cancellationToken);

        if (existing is null && license.DeviceLimit.HasValue && activeCount >= license.DeviceLimit.Value)
        {
            return Results.BadRequest(new { error = "device limit reached" });
        }

        if (existing is null)
        {
            existing = new DeviceActivation
            {
                TenantId = license.TenantId,
                LicenseId = license.Id,
                DeviceId = deviceId,
                DeviceName = string.IsNullOrWhiteSpace(request.DeviceName) ? $"Device-{deviceId:N}" : request.DeviceName.Trim(),
                Platform = request.Platform.Trim().ToLowerInvariant(),
                AppVersion = request.AppVersion?.Trim(),
                ActivationSource = request.Source?.Trim().ToLowerInvariant() ?? "desktop",
                Status = "active",
                ActivatedAt = DateTimeOffset.UtcNow,
                LastSeenAt = DateTimeOffset.UtcNow
            };
            dbContext.DeviceActivations.Add(existing);
        }
        else
        {
            existing.LastSeenAt = DateTimeOffset.UtcNow;
            existing.AppVersion = request.AppVersion?.Trim();
            existing.Status = "active";
            existing.RevokedAt = null;
        }

        dbContext.ActivationEvents.Add(new ActivationEvent
        {
            TenantId = license.TenantId,
            DeviceActivationId = existing.Id,
            EventType = "device_activated",
            PayloadJson = JsonSerializer.Serialize(new
            {
                existing.DeviceId,
                existing.DeviceName,
                existing.Platform,
                existing.AppVersion
            })
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(existing);
    }

    private static async Task<IResult> DeviceHeartbeatAsync(
        LicenseDeviceHeartbeatRequest request,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var activation = await dbContext.DeviceActivations
            .FirstOrDefaultAsync(x => x.DeviceId == request.DeviceId && x.RevokedAt == null, cancellationToken);
        if (activation is null)
        {
            return Results.NotFound();
        }

        activation.LastSeenAt = DateTimeOffset.UtcNow;
        activation.AppVersion = request.AppVersion?.Trim() ?? activation.AppVersion;
        dbContext.ActivationEvents.Add(new ActivationEvent
        {
            TenantId = activation.TenantId,
            DeviceActivationId = activation.Id,
            EventType = "heartbeat",
            PayloadJson = JsonSerializer.Serialize(new
            {
                activation.DeviceId,
                activation.AppVersion
            })
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        var license = await dbContext.IssuedLicenses.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == activation.LicenseId, cancellationToken);
        return Results.Ok(new
        {
            activation.DeviceId,
            activation.LastSeenAt,
            activation.Status,
            LicenseStatus = license?.Status,
            license?.ExpiresAt
        });
    }

    private static async Task<IResult> DeactivateDeviceAsync(
        DeactivateDeviceRequest request,
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var activation = await dbContext.DeviceActivations
            .FirstOrDefaultAsync(x => x.DeviceId == request.DeviceId && x.RevokedAt == null, cancellationToken);
        if (activation is null)
        {
            return Results.NotFound();
        }

        activation.RevokedAt = DateTimeOffset.UtcNow;
        activation.Status = "revoked";
        dbContext.ActivationEvents.Add(new ActivationEvent
        {
            TenantId = activation.TenantId,
            DeviceActivationId = activation.Id,
            EventType = "device_deactivated",
            PayloadJson = JsonSerializer.Serialize(new { activation.DeviceId })
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        return Results.Ok(new { deactivated = true, activation.DeviceId });
    }

    private static async Task<IssuedLicense?> FindLicenseAsync(
        AppDbContext dbContext,
        LicenseLookupRequest request,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(request.LicenseKey))
        {
            return await dbContext.IssuedLicenses.AsNoTracking()
                .FirstOrDefaultAsync(x => x.LicenseKey == request.LicenseKey.Trim(), cancellationToken);
        }

        if (!string.IsNullOrWhiteSpace(request.LicenseToken))
        {
            return await dbContext.IssuedLicenses.AsNoTracking()
                .FirstOrDefaultAsync(x => x.LicenseToken == request.LicenseToken.Trim(), cancellationToken);
        }

        return null;
    }

    public sealed record LicenseLookupRequest(string? LicenseKey, string? LicenseToken);
    public sealed record LicenseDeviceRequest(
        string? LicenseKey,
        string? LicenseToken,
        Guid DeviceId,
        string DeviceName,
        string Platform,
        string? AppVersion,
        string? Source);

    public sealed record LicenseDeviceHeartbeatRequest(Guid DeviceId, string? AppVersion);
    public sealed record DeactivateDeviceRequest(Guid DeviceId);
}
