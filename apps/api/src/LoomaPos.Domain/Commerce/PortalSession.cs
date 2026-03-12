using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class PortalSession : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? CustomerAccountId { get; set; }
    public Guid? ResellerAccountId { get; set; }
    public Guid? TenantId { get; set; }
    public string PortalType { get; set; } = "customer";
    public string RoleCode { get; set; } = "tenant_owner";
    public string AccessTokenHash { get; set; } = string.Empty;
    public string RefreshTokenHash { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; set; } = DateTimeOffset.UtcNow.AddHours(8);
    public DateTimeOffset RefreshExpiresAt { get; set; } = DateTimeOffset.UtcNow.AddDays(30);
    public string? UserAgent { get; set; }
    public string? IpAddress { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
