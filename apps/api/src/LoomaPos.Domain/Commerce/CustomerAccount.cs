using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class CustomerAccount : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string AccountStatus { get; set; } = "active";
    public DateTimeOffset? EmailVerifiedAt { get; set; }
    public string? EmailVerificationTokenHash { get; set; }
    public DateTimeOffset? EmailVerificationExpiresAt { get; set; }
    public DateTimeOffset? LastLoginAt { get; set; }
    public string? PasswordResetTokenHash { get; set; }
    public DateTimeOffset? PasswordResetExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
