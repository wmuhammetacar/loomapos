using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using LoomaPos.Domain.Commerce;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace LoomaPos.Api.Commerce;

public interface IPortalCryptoService
{
    string HashPassword(string password);
    bool VerifyPassword(string passwordHash, string password);
    string GenerateOpaqueToken(int size = 48);
    string HashOpaqueToken(string token);
    string BuildTenantCode(string companyName);
    string BuildInvoiceNumber(DateTimeOffset now);
    string BuildCheckoutReference(DateTimeOffset now);
    string BuildLicenseKey();
}

public sealed class PortalCryptoService : IPortalCryptoService
{
    private const int SaltSize = 16;
    private const int KeySize = 32;
    private const int Iterations = 120_000;

    public string HashPassword(string password)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(password);

        Span<byte> salt = stackalloc byte[SaltSize];
        RandomNumberGenerator.Fill(salt);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, KeySize);
        return $"pbkdf2${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    public bool VerifyPassword(string passwordHash, string password)
    {
        if (string.IsNullOrWhiteSpace(passwordHash) || string.IsNullOrWhiteSpace(password))
        {
            return false;
        }

        var parts = passwordHash.Split('$', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 4 || !string.Equals(parts[0], "pbkdf2", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (!int.TryParse(parts[1], out var iterations))
        {
            return false;
        }

        var salt = Convert.FromBase64String(parts[2]);
        var expected = Convert.FromBase64String(parts[3]);
        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }

    public string GenerateOpaqueToken(int size = 48)
    {
        var buffer = RandomNumberGenerator.GetBytes(size);
        return Convert.ToBase64String(buffer)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    public string HashOpaqueToken(string token)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public string BuildTenantCode(string companyName)
    {
        var normalized = new string(companyName.Trim().ToUpperInvariant().Where(char.IsLetterOrDigit).ToArray());
        var prefix = string.IsNullOrWhiteSpace(normalized) ? "TENANT" : normalized[..Math.Min(8, normalized.Length)];
        return $"{prefix}-{Random.Shared.Next(1000, 9999)}";
    }

    public string BuildInvoiceNumber(DateTimeOffset now)
    {
        return $"INV-{now:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}";
    }

    public string BuildCheckoutReference(DateTimeOffset now)
    {
        return $"CHK-{now:yyyyMMddHHmmss}-{Random.Shared.Next(100, 999)}";
    }

    public string BuildLicenseKey()
    {
        var pieces = Enumerable.Range(0, 4)
            .Select(_ => Convert.ToHexString(RandomNumberGenerator.GetBytes(3)))
            .ToArray();
        return $"LMA-{string.Join('-', pieces)}";
    }
}

public sealed record CreatedLicenseArtifact(
    string LicenseKey,
    string LicenseToken,
    string Signature);

public interface ILicenseArtifactService
{
    CreatedLicenseArtifact CreateArtifact(
        Guid tenantId,
        Guid subscriptionId,
        string planCode,
        int? deviceLimit,
        IReadOnlyList<string> featureFlags,
        DateTimeOffset issuedAt,
        DateTimeOffset expiresAt,
        string licenseKey);

    bool TryValidate(string token, out JwtSecurityToken? jwtSecurityToken);
}

public sealed class LicenseArtifactService : ILicenseArtifactService
{
    private readonly IConfiguration _configuration;

    public LicenseArtifactService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public CreatedLicenseArtifact CreateArtifact(
        Guid tenantId,
        Guid subscriptionId,
        string planCode,
        int? deviceLimit,
        IReadOnlyList<string> featureFlags,
        DateTimeOffset issuedAt,
        DateTimeOffset expiresAt,
        string licenseKey)
    {
        var signingKey = _configuration["Licensing:SigningKey"] ?? "loomapos-dev-license-key-change-me";
        var keyBytes = Encoding.UTF8.GetBytes(signingKey);
        var key = new SymmetricSecurityKey(keyBytes);
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var payloadJson = JsonSerializer.Serialize(new
        {
            tenantId,
            subscriptionId,
            planCode,
            deviceLimit,
            featureFlags,
            issuedAt,
            expiresAt,
            licenseKey
        });

        var token = new JwtSecurityToken(
            issuer: "loomapos-api",
            audience: "loomapos-clients",
            claims:
            [
                new Claim("tenant_id", tenantId.ToString()),
                new Claim("subscription_id", subscriptionId.ToString()),
                new Claim("plan_code", planCode),
                new Claim("device_limit", deviceLimit?.ToString() ?? string.Empty),
                new Claim("feature_flags", JsonSerializer.Serialize(featureFlags)),
                new Claim("license_key", licenseKey),
                new Claim("payload", payloadJson)
            ],
            notBefore: issuedAt.UtcDateTime.AddMinutes(-1),
            expires: expiresAt.UtcDateTime,
            signingCredentials: creds);

        var handler = new JwtSecurityTokenHandler();
        var tokenValue = handler.WriteToken(token);
        var signature = Convert.ToHexString(HMACSHA256.HashData(keyBytes, Encoding.UTF8.GetBytes(tokenValue))).ToLowerInvariant();

        return new CreatedLicenseArtifact(licenseKey, tokenValue, signature);
    }

    public bool TryValidate(string token, out JwtSecurityToken? jwtSecurityToken)
    {
        jwtSecurityToken = null;
        if (string.IsNullOrWhiteSpace(token))
        {
            return false;
        }

        try
        {
            var signingKey = _configuration["Licensing:SigningKey"] ?? "loomapos-dev-license-key-change-me";
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey));
            var handler = new JwtSecurityTokenHandler();
            handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = "loomapos-api",
                ValidateAudience = true,
                ValidAudience = "loomapos-clients",
                ValidateLifetime = false,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = key
            }, out var validatedToken);

            jwtSecurityToken = validatedToken as JwtSecurityToken;
            return jwtSecurityToken is not null;
        }
        catch
        {
            return false;
        }
    }
}

public sealed record EmailTemplateResult(string Subject, string BodyMarkdown);

public interface IEmailTemplateService
{
    EmailTemplateResult Build(string eventCode, IReadOnlyDictionary<string, string?> values);
}

public sealed class EmailTemplateService : IEmailTemplateService
{
    public EmailTemplateResult Build(string eventCode, IReadOnlyDictionary<string, string?> values)
    {
        string Value(string key, string fallback = "-") =>
            values.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value)
                ? value!
                : fallback;

        return eventCode switch
        {
            "registration" => new EmailTemplateResult(
                "LoomaPOS hesap kaydiniz alindi",
                $"Merhaba {Value("fullName")},\n\nPortal kaydiniz hazir. Satin alma sonrasinda lisans ve indirme erisiminiz ayni hesapta acilacaktir."),
            "purchase_success" => new EmailTemplateResult(
                "LoomaPOS satin alma isleminiz tamamlandi",
                $"Plan: {Value("planCode")}\nLisans anahtari: {Value("licenseKey")}\nPortal: {Value("portalUrl")}"),
            "subscription_activated" => new EmailTemplateResult(
                "Aboneliginiz aktif",
                $"{Value("companyName")} icin aboneliginiz aktif hale getirildi. Yenileme tarihi: {Value("renewalDate")}."),
            "invoice_available" => new EmailTemplateResult(
                "Faturaniz hazir",
                $"Fatura no: {Value("invoiceNo")}\nTutar: {Value("amount")} {Value("currency")}"),
            "renewal_reminder" => new EmailTemplateResult(
                "Yenileme hatirlatmasi",
                $"Aboneliginiz {Value("renewalDate")} tarihinde yenilenecektir."),
            "payment_failed" => new EmailTemplateResult(
                "Odeme basarisiz",
                "Odemeniz tamamlanamadi. Faturalama bilgilerinizi kontrol ederek tekrar deneyin."),
            "subscription_canceled" => new EmailTemplateResult(
                "Abonelik iptal edildi",
                $"Aboneliginiz {Value("canceledAt")} tarihinde iptal edildi."),
            "license_issued" => new EmailTemplateResult(
                "Lisansiniz olusturuldu",
                $"Lisans anahtari: {Value("licenseKey")}\nBitis tarihi: {Value("expiresAt")}"),
            "device_limit_warning" => new EmailTemplateResult(
                "Cihaz limiti uyarisi",
                $"Aktif cihaz sayiniz plan limitinize yaklasti. Limit: {Value("deviceLimit")}"),
            "reseller_attribution_notice" => new EmailTemplateResult(
                "Bayi referansi kaydedildi",
                $"Refarans kodu {Value("resellerCode")} ile alinan satis hesabiniza baglandi."),
            _ => new EmailTemplateResult("LoomaPOS bildirimi", "Ticari hesap hareketiniz guncellendi.")
        };
    }
}

public sealed record PortalTokenEnvelope(
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

public sealed record PortalAccessContext(
    Guid SessionId,
    string PortalType,
    string RoleCode,
    Guid? CustomerAccountId,
    Guid? ResellerAccountId,
    Guid? TenantId,
    string Email,
    string DisplayName,
    string? CompanyName,
    string? ResellerCode);

public interface IPortalAuthService
{
    Task<PortalTokenEnvelope> RegisterCustomerAsync(
        string email,
        string password,
        string fullName,
        string? phone,
        string? companyName,
        HttpContext httpContext,
        CancellationToken cancellationToken);

    Task<PortalTokenEnvelope> LoginCustomerAsync(
        string email,
        string password,
        HttpContext httpContext,
        CancellationToken cancellationToken);
    Task<PortalTokenEnvelope> LoginResellerAsync(
        string email,
        string password,
        HttpContext httpContext,
        CancellationToken cancellationToken);

    Task RequestPasswordResetAsync(string email, CancellationToken cancellationToken);
    Task ResetPasswordAsync(string resetToken, string password, CancellationToken cancellationToken);
    Task VerifyEmailAsync(string verificationToken, CancellationToken cancellationToken);
    Task<PortalTokenEnvelope> RefreshSessionAsync(
        string refreshToken,
        HttpContext httpContext,
        CancellationToken cancellationToken);
    Task<PortalTokenEnvelope> CreateCustomerPortalSessionAsync(
        Guid customerAccountId,
        Guid? tenantId,
        HttpContext httpContext,
        CancellationToken cancellationToken);
    Task<PortalAccessContext?> GetAccessContextAsync(HttpContext httpContext, CancellationToken cancellationToken);
    Task LogoutAsync(HttpContext httpContext, CancellationToken cancellationToken);
}

public sealed class PortalAuthService : IPortalAuthService
{
    private readonly AppDbContext _dbContext;
    private readonly IPortalCryptoService _cryptoService;
    private readonly IEmailTemplateService _emailTemplateService;
    private readonly IConfiguration _configuration;

    public PortalAuthService(
        AppDbContext dbContext,
        IPortalCryptoService cryptoService,
        IEmailTemplateService emailTemplateService,
        IConfiguration configuration)
    {
        _dbContext = dbContext;
        _cryptoService = cryptoService;
        _emailTemplateService = emailTemplateService;
        _configuration = configuration;
    }

    public async Task<PortalTokenEnvelope> RegisterCustomerAsync(
        string email,
        string password,
        string fullName,
        string? phone,
        string? companyName,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var account = await _dbContext.CustomerAccounts
            .FirstOrDefaultAsync(x => x.Email == normalizedEmail, cancellationToken);

        if (account is null)
        {
            account = new CustomerAccount
            {
                Email = normalizedEmail,
                PasswordHash = _cryptoService.HashPassword(password),
                FullName = fullName.Trim(),
                Phone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim(),
                AccountStatus = "active",
                EmailVerificationTokenHash = _cryptoService.HashOpaqueToken(_cryptoService.GenerateOpaqueToken(32)),
                EmailVerificationExpiresAt = DateTimeOffset.UtcNow.AddDays(2)
            };
            _dbContext.CustomerAccounts.Add(account);

            var template = _emailTemplateService.Build("registration", new Dictionary<string, string?>
            {
                ["fullName"] = account.FullName
            });
            _dbContext.EmailNotifications.Add(new EmailNotification
            {
                CustomerAccountId = account.Id,
                ToEmail = normalizedEmail,
                EventCode = "registration",
                Subject = template.Subject,
                BodyMarkdown = template.BodyMarkdown,
                Status = "queued"
            });
            QueueVerificationEmail(account);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        else if (!_cryptoService.VerifyPassword(account.PasswordHash, password))
        {
            throw new InvalidOperationException("Bu e-posta adresiyle kayitli bir hesap mevcut.");
        }

        var tenantUser = await _dbContext.TenantUsers.AsNoTracking()
            .Where(x => x.CustomerAccountId == account.Id && x.Status == "active")
            .OrderByDescending(x => x.IsOwner)
            .ThenByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        var tenant = tenantUser is null
            ? null
            : await _dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == tenantUser.TenantId, cancellationToken);

        return await IssueCustomerSessionAsync(account, tenantUser, tenant, httpContext, companyName, cancellationToken);
    }

    public async Task<PortalTokenEnvelope> LoginCustomerAsync(
        string email,
        string password,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var account = await _dbContext.CustomerAccounts
            .FirstOrDefaultAsync(x => x.Email == normalizedEmail && x.AccountStatus == "active", cancellationToken)
            ?? throw new InvalidOperationException("Musteri hesabi bulunamadi veya sifre hatali.");

        if (!_cryptoService.VerifyPassword(account.PasswordHash, password))
        {
            throw new InvalidOperationException("Musteri hesabi bulunamadi veya sifre hatali.");
        }

        if (RequireVerifiedEmail() && account.EmailVerifiedAt is null)
        {
            throw new InvalidOperationException("E-posta dogrulamasi tamamlanmadan portal girisi acilamaz.");
        }

        var tenantUser = await _dbContext.TenantUsers.AsNoTracking()
            .Where(x => x.CustomerAccountId == account.Id && x.Status == "active")
            .OrderByDescending(x => x.IsOwner)
            .ThenByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        var tenant = tenantUser is null
            ? null
            : await _dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == tenantUser.TenantId, cancellationToken);

        return await IssueCustomerSessionAsync(account, tenantUser, tenant, httpContext, null, cancellationToken);
    }

    public async Task<PortalTokenEnvelope> LoginResellerAsync(
        string email,
        string password,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var reseller = await _dbContext.ResellerAccounts
            .FirstOrDefaultAsync(x => x.Email == normalizedEmail && x.Status == "approved", cancellationToken)
            ?? throw new InvalidOperationException("Onayli bayi hesabi bulunamadi veya sifre hatali.");

        if (string.IsNullOrWhiteSpace(reseller.PasswordHash) ||
            !_cryptoService.VerifyPassword(reseller.PasswordHash, password))
        {
            throw new InvalidOperationException("Onayli bayi hesabi bulunamadi veya sifre hatali.");
        }

        return await IssueResellerSessionAsync(reseller, httpContext, cancellationToken);
    }

    public async Task RequestPasswordResetAsync(string email, CancellationToken cancellationToken)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var account = await _dbContext.CustomerAccounts
            .FirstOrDefaultAsync(x => x.Email == normalizedEmail && x.AccountStatus == "active", cancellationToken);
        if (account is null)
        {
            return;
        }

        var resetToken = _cryptoService.GenerateOpaqueToken(32);
        account.PasswordResetTokenHash = _cryptoService.HashOpaqueToken(resetToken);
        account.PasswordResetExpiresAt = DateTimeOffset.UtcNow.AddHours(2);
        _dbContext.EmailNotifications.Add(new EmailNotification
        {
            CustomerAccountId = account.Id,
            ToEmail = account.Email,
            EventCode = "password_reset",
            Subject = "LoomaPOS sifre sifirlama",
            BodyMarkdown = $"Merhaba {account.FullName},\n\nSifre sifirlama kodunuz: `{resetToken}`\nBu kod 2 saat boyunca gecerlidir.",
            Status = "queued"
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task ResetPasswordAsync(string resetToken, string password, CancellationToken cancellationToken)
    {
        var tokenHash = _cryptoService.HashOpaqueToken(resetToken);
        var account = await _dbContext.CustomerAccounts
            .FirstOrDefaultAsync(x =>
                x.PasswordResetTokenHash == tokenHash &&
                x.PasswordResetExpiresAt != null &&
                x.PasswordResetExpiresAt > DateTimeOffset.UtcNow,
                cancellationToken)
            ?? throw new InvalidOperationException("Gecersiz veya suresi dolmus sifirlama tokeni.");

        account.PasswordHash = _cryptoService.HashPassword(password);
        account.PasswordResetTokenHash = null;
        account.PasswordResetExpiresAt = null;
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task VerifyEmailAsync(string verificationToken, CancellationToken cancellationToken)
    {
        var tokenHash = _cryptoService.HashOpaqueToken(verificationToken);
        var account = await _dbContext.CustomerAccounts
            .FirstOrDefaultAsync(x =>
                x.EmailVerificationTokenHash == tokenHash &&
                x.EmailVerificationExpiresAt != null &&
                x.EmailVerificationExpiresAt > DateTimeOffset.UtcNow,
                cancellationToken)
            ?? throw new InvalidOperationException("Gecersiz veya suresi dolmus e-posta dogrulama tokeni.");

        account.EmailVerifiedAt = DateTimeOffset.UtcNow;
        account.EmailVerificationTokenHash = null;
        account.EmailVerificationExpiresAt = null;
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<PortalTokenEnvelope> RefreshSessionAsync(
        string refreshToken,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var refreshTokenHash = _cryptoService.HashOpaqueToken(refreshToken);
        var session = await _dbContext.PortalSessions
            .FirstOrDefaultAsync(x =>
                x.RefreshTokenHash == refreshTokenHash &&
                x.RevokedAt == null &&
                x.RefreshExpiresAt > DateTimeOffset.UtcNow,
                cancellationToken)
            ?? throw new InvalidOperationException("Refresh oturumu bulunamadi veya suresi doldu.");

        if (session.PortalType == "reseller")
        {
            var reseller = session.ResellerAccountId.HasValue
                ? await _dbContext.ResellerAccounts.FirstOrDefaultAsync(x => x.Id == session.ResellerAccountId.Value, cancellationToken)
                : null;
            if (reseller is null)
            {
                throw new InvalidOperationException("Bayi hesabi bulunamadi.");
            }

            return await RotateSessionAsync(session, reseller.Email, reseller.CompanyName ?? reseller.Name, null, reseller.Code, httpContext, cancellationToken);
        }

        var account = session.CustomerAccountId.HasValue
            ? await _dbContext.CustomerAccounts.FirstOrDefaultAsync(x => x.Id == session.CustomerAccountId.Value && x.AccountStatus == "active", cancellationToken)
            : null;
        if (account is null)
        {
            throw new InvalidOperationException("Musteri hesabi bulunamadi.");
        }

        if (RequireVerifiedEmail() && account.EmailVerifiedAt is null)
        {
            throw new InvalidOperationException("E-posta dogrulamasi tamamlanmadan oturum yenilenemez.");
        }

        var companyName = session.TenantId.HasValue
            ? await _dbContext.Tenants.AsNoTracking().Where(x => x.Id == session.TenantId.Value).Select(x => x.Name).FirstOrDefaultAsync(cancellationToken)
            : null;

        return await RotateSessionAsync(session, account.Email, account.FullName, session.TenantId, null, httpContext, cancellationToken);
    }

    public async Task<PortalTokenEnvelope> CreateCustomerPortalSessionAsync(
        Guid customerAccountId,
        Guid? tenantId,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var account = await _dbContext.CustomerAccounts
            .FirstOrDefaultAsync(x => x.Id == customerAccountId && x.AccountStatus == "active", cancellationToken)
            ?? throw new InvalidOperationException("Customer account not found.");
        var tenantUser = tenantId.HasValue
            ? await _dbContext.TenantUsers.AsNoTracking()
                .Where(x => x.CustomerAccountId == account.Id && x.TenantId == tenantId.Value && x.Status == "active")
                .OrderByDescending(x => x.IsOwner)
                .FirstOrDefaultAsync(cancellationToken)
            : await _dbContext.TenantUsers.AsNoTracking()
                .Where(x => x.CustomerAccountId == account.Id && x.Status == "active")
                .OrderByDescending(x => x.IsOwner)
                .ThenByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);
        var tenant = tenantUser is null
            ? null
            : await _dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == tenantUser.TenantId, cancellationToken);

        return await IssueCustomerSessionAsync(account, tenantUser, tenant, httpContext, null, cancellationToken);
    }

    public async Task<PortalAccessContext?> GetAccessContextAsync(HttpContext httpContext, CancellationToken cancellationToken)
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
        var session = await _dbContext.PortalSessions
            .AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.AccessTokenHash == accessTokenHash &&
                x.RevokedAt == null &&
                x.ExpiresAt > DateTimeOffset.UtcNow,
                cancellationToken);
        if (session is null)
        {
            return null;
        }

        if (session.PortalType == "reseller")
        {
            var reseller = session.ResellerAccountId.HasValue
                ? await _dbContext.ResellerAccounts.AsNoTracking().FirstOrDefaultAsync(x => x.Id == session.ResellerAccountId.Value, cancellationToken)
                : null;
            if (reseller is null)
            {
                return null;
            }

            return new PortalAccessContext(
                session.Id,
                "reseller",
                session.RoleCode,
                null,
                reseller.Id,
                null,
                reseller.Email,
                reseller.CompanyName ?? reseller.Name,
                null,
                reseller.Code);
        }

        var customer = session.CustomerAccountId.HasValue
            ? await _dbContext.CustomerAccounts.AsNoTracking().FirstOrDefaultAsync(x => x.Id == session.CustomerAccountId.Value, cancellationToken)
            : null;
        if (customer is null)
        {
            return null;
        }

        var tenantName = session.TenantId.HasValue
            ? await _dbContext.Tenants.AsNoTracking()
                .Where(x => x.Id == session.TenantId.Value)
                .Select(x => x.Name)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        return new PortalAccessContext(
            session.Id,
            session.PortalType,
            session.RoleCode,
            customer.Id,
            null,
            session.TenantId,
            customer.Email,
            customer.FullName,
            tenantName,
            null);
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
        var session = await _dbContext.PortalSessions
            .FirstOrDefaultAsync(x => x.AccessTokenHash == accessTokenHash && x.RevokedAt == null, cancellationToken);
        if (session is null)
        {
            return;
        }

        session.RevokedAt = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<PortalTokenEnvelope> IssueCustomerSessionAsync(
        CustomerAccount account,
        TenantUser? tenantUser,
        Domain.Identity.Tenant? tenant,
        HttpContext httpContext,
        string? fallbackCompanyName,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var accessToken = _cryptoService.GenerateOpaqueToken();
        var refreshToken = _cryptoService.GenerateOpaqueToken();
        var session = new PortalSession
        {
            CustomerAccountId = account.Id,
            TenantId = tenantUser?.TenantId,
            PortalType = "customer",
            RoleCode = tenantUser?.RoleCode ?? "tenant_owner",
            AccessTokenHash = _cryptoService.HashOpaqueToken(accessToken),
            RefreshTokenHash = _cryptoService.HashOpaqueToken(refreshToken),
            ExpiresAt = now.AddHours(12),
            RefreshExpiresAt = now.AddDays(30),
            UserAgent = httpContext.Request.Headers.UserAgent.ToString(),
            IpAddress = httpContext.Connection.RemoteIpAddress?.ToString()
        };

        account.LastLoginAt = now;
        _dbContext.PortalSessions.Add(session);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new PortalTokenEnvelope(
            accessToken,
            refreshToken,
            session.ExpiresAt,
            session.RefreshExpiresAt,
            "customer",
            [tenantUser?.RoleCode ?? "tenant_owner"],
            account.Email,
            account.FullName,
            tenantUser?.TenantId,
            tenant?.Name ?? fallbackCompanyName,
            null);
    }

    private async Task<PortalTokenEnvelope> IssueResellerSessionAsync(
        ResellerAccount reseller,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var accessToken = _cryptoService.GenerateOpaqueToken();
        var refreshToken = _cryptoService.GenerateOpaqueToken();
        var session = new PortalSession
        {
            ResellerAccountId = reseller.Id,
            PortalType = "reseller",
            RoleCode = "reseller_user",
            AccessTokenHash = _cryptoService.HashOpaqueToken(accessToken),
            RefreshTokenHash = _cryptoService.HashOpaqueToken(refreshToken),
            ExpiresAt = now.AddHours(12),
            RefreshExpiresAt = now.AddDays(30),
            UserAgent = httpContext.Request.Headers.UserAgent.ToString(),
            IpAddress = httpContext.Connection.RemoteIpAddress?.ToString()
        };

        reseller.LastLoginAt = now;
        _dbContext.PortalSessions.Add(session);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new PortalTokenEnvelope(
            accessToken,
            refreshToken,
            session.ExpiresAt,
            session.RefreshExpiresAt,
            "reseller",
            ["reseller_user"],
            reseller.Email,
            reseller.CompanyName ?? reseller.Name,
            null,
            null,
            reseller.Code);
    }

    private void QueueVerificationEmail(CustomerAccount account)
    {
        if (account.EmailVerificationTokenHash is null || account.EmailVerificationExpiresAt is null)
        {
            return;
        }

        var token = _cryptoService.GenerateOpaqueToken(32);
        account.EmailVerificationTokenHash = _cryptoService.HashOpaqueToken(token);
        account.EmailVerificationExpiresAt = DateTimeOffset.UtcNow.AddDays(2);

        _dbContext.EmailNotifications.Add(new EmailNotification
        {
            CustomerAccountId = account.Id,
            ToEmail = account.Email,
            EventCode = "email_verification",
            Subject = "LoomaPOS e-posta dogrulamasi",
            BodyMarkdown = $"Merhaba {account.FullName},\n\nE-posta dogrulama kodunuz: `{token}`\nBu kod 48 saat gecerlidir.",
            Status = "queued"
        });
    }

    private async Task<PortalTokenEnvelope> RotateSessionAsync(
        PortalSession session,
        string email,
        string displayName,
        Guid? tenantId,
        string? resellerCode,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var accessToken = _cryptoService.GenerateOpaqueToken();
        var refreshToken = _cryptoService.GenerateOpaqueToken();

        session.AccessTokenHash = _cryptoService.HashOpaqueToken(accessToken);
        session.RefreshTokenHash = _cryptoService.HashOpaqueToken(refreshToken);
        session.ExpiresAt = now.AddHours(12);
        session.RefreshExpiresAt = now.AddDays(30);
        session.UserAgent = httpContext.Request.Headers.UserAgent.ToString();
        session.IpAddress = httpContext.Connection.RemoteIpAddress?.ToString();

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new PortalTokenEnvelope(
            accessToken,
            refreshToken,
            session.ExpiresAt,
            session.RefreshExpiresAt,
            session.PortalType,
            [session.RoleCode],
            email,
            displayName,
            tenantId,
            session.PortalType == "customer" ? await ResolveCompanyNameAsync(tenantId, cancellationToken) : null,
            resellerCode);
    }

    private async Task<string?> ResolveCompanyNameAsync(Guid? tenantId, CancellationToken cancellationToken)
    {
        if (!tenantId.HasValue)
        {
            return null;
        }

        return await _dbContext.Tenants.AsNoTracking()
            .Where(x => x.Id == tenantId.Value)
            .Select(x => x.Name)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private bool RequireVerifiedEmail()
    {
        return bool.TryParse(_configuration["CommerceAuth:RequireVerifiedEmail"], out var enabled) && enabled;
    }
}
