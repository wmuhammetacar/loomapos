using System.Text.Json;
using LoomaPos.Api.Commerce;
using LoomaPos.Domain.Internal;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Security;

public sealed record InternalAdminTokenEnvelope(
    string AccessToken,
    string RefreshToken,
    DateTimeOffset ExpiresAt,
    DateTimeOffset RefreshExpiresAt,
    string Email,
    string DisplayName,
    string[] Roles);

public sealed record InternalAdminAccessContext(
    Guid UserId,
    Guid SessionId,
    string Email,
    string DisplayName,
    string[] Roles);

public interface IInternalAdminAuthService
{
    Task<InternalAdminTokenEnvelope> LoginAsync(string email, string password, HttpContext httpContext, CancellationToken cancellationToken);
    Task<InternalAdminAccessContext?> GetAccessContextAsync(HttpContext httpContext, CancellationToken cancellationToken);
    Task LogoutAsync(HttpContext httpContext, CancellationToken cancellationToken);
    Task<IReadOnlyList<object>> ListSessionsAsync(Guid userId, CancellationToken cancellationToken);
}

public interface IAdminApprovalService
{
    Task<AdminActionRequest> RecordActionAsync(
        InternalAdminAccessContext access,
        string actionCode,
        string targetType,
        string targetId,
        string reason,
        bool requiresApproval,
        object? metadata,
        CancellationToken cancellationToken);
}

public sealed class InternalAdminAuthService : IInternalAdminAuthService
{
    private readonly AppDbContext _dbContext;
    private readonly IPortalCryptoService _cryptoService;
    private readonly IConfiguration _configuration;

    public InternalAdminAuthService(AppDbContext dbContext, IPortalCryptoService cryptoService, IConfiguration configuration)
    {
        _dbContext = dbContext;
        _cryptoService = cryptoService;
        _configuration = configuration;
    }

    public async Task<InternalAdminTokenEnvelope> LoginAsync(string email, string password, HttpContext httpContext, CancellationToken cancellationToken)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await _dbContext.InternalUsers.FirstOrDefaultAsync(x => x.Email == normalizedEmail, cancellationToken);
        if (user is null)
        {
            user = await TryProvisionBootstrapUserAsync(normalizedEmail, password, cancellationToken)
                ?? throw new InvalidOperationException("Internal admin account not found or password invalid.");
        }

        if (user.Status != "active" || !_cryptoService.VerifyPassword(user.PasswordHash, password))
        {
            throw new InvalidOperationException("Internal admin account not found or password invalid.");
        }

        var roles = await _dbContext.InternalUserRoles.AsNoTracking()
            .Where(x => x.InternalUserId == user.Id)
            .Select(x => x.RoleCode)
            .ToArrayAsync(cancellationToken);
        if (roles.Length == 0)
        {
            throw new InvalidOperationException("Internal admin role assignment missing.");
        }

        var now = DateTimeOffset.UtcNow;
        var accessToken = _cryptoService.GenerateOpaqueToken();
        var refreshToken = _cryptoService.GenerateOpaqueToken();
        _dbContext.InternalSessions.Add(new InternalSession
        {
            InternalUserId = user.Id,
            AccessTokenHash = _cryptoService.HashOpaqueToken(accessToken),
            RefreshTokenHash = _cryptoService.HashOpaqueToken(refreshToken),
            ExpiresAt = now.AddHours(12),
            RefreshExpiresAt = now.AddDays(30),
            UserAgent = httpContext.Request.Headers.UserAgent.ToString(),
            IpAddress = httpContext.Connection.RemoteIpAddress?.ToString()
        });

        user.LastLoginAt = now;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new InternalAdminTokenEnvelope(accessToken, refreshToken, now.AddHours(12), now.AddDays(30), user.Email, user.DisplayName, roles);
    }

    public async Task<InternalAdminAccessContext?> GetAccessContextAsync(HttpContext httpContext, CancellationToken cancellationToken)
    {
        var authorization = httpContext.Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(authorization) || !authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var accessToken = authorization["Bearer ".Length..].Trim();
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return null;
        }

        var accessTokenHash = _cryptoService.HashOpaqueToken(accessToken);
        var session = await _dbContext.InternalSessions.AsNoTracking()
            .FirstOrDefaultAsync(x => x.AccessTokenHash == accessTokenHash && x.RevokedAt == null && x.ExpiresAt > DateTimeOffset.UtcNow, cancellationToken);
        if (session is null)
        {
            return null;
        }

        var user = await _dbContext.InternalUsers.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == session.InternalUserId && x.Status == "active", cancellationToken);
        if (user is null)
        {
            return null;
        }

        var roles = await _dbContext.InternalUserRoles.AsNoTracking()
            .Where(x => x.InternalUserId == user.Id)
            .Select(x => x.RoleCode)
            .ToArrayAsync(cancellationToken);

        return new InternalAdminAccessContext(user.Id, session.Id, user.Email, user.DisplayName, roles);
    }

    public async Task LogoutAsync(HttpContext httpContext, CancellationToken cancellationToken)
    {
        var authorization = httpContext.Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(authorization) || !authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var accessToken = authorization["Bearer ".Length..].Trim();
        var accessTokenHash = _cryptoService.HashOpaqueToken(accessToken);
        var session = await _dbContext.InternalSessions.FirstOrDefaultAsync(x => x.AccessTokenHash == accessTokenHash && x.RevokedAt == null, cancellationToken);
        if (session is null)
        {
            return;
        }

        session.RevokedAt = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<object>> ListSessionsAsync(Guid userId, CancellationToken cancellationToken)
    {
        return await _dbContext.InternalSessions.AsNoTracking()
            .Where(x => x.InternalUserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(20)
            .Select(x => (object)new
            {
                x.Id,
                x.CreatedAt,
                x.ExpiresAt,
                x.RevokedAt,
                x.UserAgent,
                x.IpAddress
            })
            .ToListAsync(cancellationToken);
    }

    private async Task<InternalUser?> TryProvisionBootstrapUserAsync(string normalizedEmail, string password, CancellationToken cancellationToken)
    {
        var bootstrapEmail = (_configuration["InternalAdmin:BootstrapEmail"] ?? "ops@loomapos.local").Trim().ToLowerInvariant();
        var bootstrapPassword = _configuration["InternalAdmin:BootstrapPassword"] ?? "ChangeThisNow123!";
        var bootstrapDisplayName = _configuration["InternalAdmin:BootstrapDisplayName"] ?? "LoomaPOS Operations";
        var bootstrapRole = _configuration["InternalAdmin:BootstrapRole"] ?? "super_admin";

        if (!string.Equals(normalizedEmail, bootstrapEmail, StringComparison.OrdinalIgnoreCase) || password != bootstrapPassword)
        {
            return null;
        }

        var user = new InternalUser
        {
            Email = bootstrapEmail,
            DisplayName = bootstrapDisplayName,
            PasswordHash = _cryptoService.HashPassword(bootstrapPassword),
            Status = "active"
        };
        _dbContext.InternalUsers.Add(user);
        _dbContext.InternalUserRoles.Add(new InternalUserRole
        {
            InternalUserId = user.Id,
            RoleCode = bootstrapRole
        });
        await _dbContext.SaveChangesAsync(cancellationToken);
        return user;
    }
}

public sealed class AdminApprovalService(AppDbContext dbContext) : IAdminApprovalService
{
    public async Task<AdminActionRequest> RecordActionAsync(
        InternalAdminAccessContext access,
        string actionCode,
        string targetType,
        string targetId,
        string reason,
        bool requiresApproval,
        object? metadata,
        CancellationToken cancellationToken)
    {
        var request = new AdminActionRequest
        {
            RequestedByInternalUserId = access.UserId,
            ActionCode = actionCode,
            TargetType = targetType,
            TargetId = targetId,
            Reason = reason,
            RequiresApproval = requiresApproval,
            Status = requiresApproval ? "approved" : "applied",
            MetadataJson = metadata is null ? null : JsonSerializer.Serialize(metadata)
        };
        dbContext.AdminActionRequests.Add(request);

        if (requiresApproval)
        {
            dbContext.AdminActionApprovals.Add(new AdminActionApproval
            {
                AdminActionRequestId = request.Id,
                ApprovedByInternalUserId = access.UserId,
                Decision = "approved",
                Note = "Same-session approval foundation"
            });
        }

        dbContext.OpsAuditLogs.Add(new Domain.Ops.OpsAuditLog
        {
            ActorEmail = access.Email,
            Action = actionCode,
            TargetType = targetType,
            TargetId = targetId,
            Reason = reason,
            MetadataJson = request.MetadataJson
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return request;
    }
}
