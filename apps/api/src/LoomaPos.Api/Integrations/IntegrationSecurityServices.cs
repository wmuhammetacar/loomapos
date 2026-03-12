using LoomaPos.Api.Commerce;
using LoomaPos.Application.Integrations;
using LoomaPos.Domain.Integrations;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.DataProtection;

namespace LoomaPos.Api.Integrations;

public interface IIntegrationSecretService
{
    string Protect(string raw);
    string Unprotect(string protectedValue);
    string Mask(string raw);
    (string Plaintext, string Prefix, string Masked, string SecretHash) CreateApiKey(IPortalCryptoService cryptoService);
}

public sealed class IntegrationSecretService : IIntegrationSecretService
{
    private readonly IDataProtector _protector;

    public IntegrationSecretService(IDataProtectionProvider dataProtectionProvider)
    {
        _protector = dataProtectionProvider.CreateProtector("LoomaPos.Integrations.Secrets.v1");
    }

    public string Protect(string raw) => _protector.Protect(raw);

    public string Unprotect(string protectedValue) => _protector.Unprotect(protectedValue);

    public string Mask(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return "not-set";
        }

        return raw.Length <= 6
            ? $"{raw[0]}***{raw[^1]}"
            : $"{raw[..3]}***{raw[^3..]}";
    }

    public (string Plaintext, string Prefix, string Masked, string SecretHash) CreateApiKey(IPortalCryptoService cryptoService)
    {
        var raw = $"lp_{cryptoService.GenerateOpaqueToken(18)}";
        var prefix = raw[..Math.Min(12, raw.Length)];
        return (raw, prefix, $"{prefix}***", cryptoService.HashPassword(raw));
    }
}

public sealed record PublicApiAccessContext(Guid TenantId, Guid ApiClientId, Guid ApiKeyId, string ClientName, IReadOnlyList<string> Scopes);

public interface IPublicApiAccessService
{
    Task<PublicApiAccessContext?> RequireAsync(HttpContext httpContext, string requiredScope, CancellationToken cancellationToken);
}

public sealed class PublicApiAccessService : IPublicApiAccessService
{
    private readonly AppDbContext _dbContext;
    private readonly IPortalCryptoService _cryptoService;

    public PublicApiAccessService(AppDbContext dbContext, IPortalCryptoService cryptoService)
    {
        _dbContext = dbContext;
        _cryptoService = cryptoService;
    }

    public async Task<PublicApiAccessContext?> RequireAsync(HttpContext httpContext, string requiredScope, CancellationToken cancellationToken)
    {
        var presentedKey = httpContext.Request.Headers["X-Api-Key"].ToString();
        if (string.IsNullOrWhiteSpace(presentedKey))
        {
            return null;
        }

        var prefix = presentedKey[..Math.Min(12, presentedKey.Length)];
        var keys = await _dbContext.ApiKeys
            .AsNoTracking()
            .Where(x => x.KeyPrefix == prefix && x.Status == "active" && (x.ExpiresAt == null || x.ExpiresAt > DateTimeOffset.UtcNow))
            .ToListAsync(cancellationToken);

        var apiKey = keys.FirstOrDefault(x => _cryptoService.VerifyPassword(x.SecretHash, presentedKey));
        if (apiKey is null)
        {
            return null;
        }

        var client = await _dbContext.ApiClients.AsNoTracking().FirstOrDefaultAsync(x => x.Id == apiKey.ApiClientId && x.Status == "active", cancellationToken);
        if (client is null)
        {
            return null;
        }

        var scopes = await _dbContext.ApiScopes.AsNoTracking()
            .Where(x => x.ApiClientId == client.Id && x.IsGranted && (x.ExpiresAt == null || x.ExpiresAt > DateTimeOffset.UtcNow))
            .Select(x => x.ScopeCode)
            .ToListAsync(cancellationToken);
        if (!ApiScopeSet.Allows(scopes, requiredScope))
        {
            return null;
        }

        var counterKey = $"{client.Id}:{requiredScope}:{DateTimeOffset.UtcNow:yyyyMMddHHmm}";
        var rateRecord = await _dbContext.IntegrationRateLimitRecords.FirstOrDefaultAsync(x => x.ApiClientId == client.Id && x.CounterKey == counterKey, cancellationToken);
        if (rateRecord is null)
        {
            rateRecord = new IntegrationRateLimitRecord
            {
                TenantId = client.TenantId,
                ApiClientId = client.Id,
                CounterKey = counterKey,
                WindowCode = "minute",
                RequestCount = 0,
                WindowStartedAt = DateTimeOffset.UtcNow
            };
            _dbContext.IntegrationRateLimitRecords.Add(rateRecord);
        }

        rateRecord.RequestCount += 1;
        apiKey.LastUsedAt = DateTimeOffset.UtcNow;
        client.LastUsedAt = DateTimeOffset.UtcNow;
        _dbContext.ApiKeys.Update(apiKey);
        _dbContext.ApiClients.Update(client);
        _dbContext.ApiUsageLogs.Add(new ApiUsageLog
        {
            TenantId = client.TenantId,
            ApiClientId = client.Id,
            ApiKeyId = apiKey.Id,
            Method = httpContext.Request.Method,
            Path = httpContext.Request.Path,
            ScopeCode = requiredScope,
            StatusCode = "pending",
            DurationMs = 0,
            RequestId = httpContext.TraceIdentifier
        });
        await _dbContext.SaveChangesAsync(cancellationToken);

        if (rateRecord.RequestCount > 120)
        {
            return null;
        }

        return new PublicApiAccessContext(client.TenantId, client.Id, apiKey.Id, client.Name, scopes);
    }
}
