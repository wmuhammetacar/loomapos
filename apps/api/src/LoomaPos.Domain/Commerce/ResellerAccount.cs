using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class ResellerAccount : ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? CompanyName { get; set; }
    public string? City { get; set; }
    public string? Phone { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? WebsiteOrSocialProof { get; set; }
    public string? Experience { get; set; }
    public string? Message { get; set; }
    public string? PasswordHash { get; set; }
    public string Status { get; set; } = "pending";
    public decimal CommissionRate { get; set; }
    public DateTimeOffset? ApprovedAt { get; set; }
    public DateTimeOffset? LastLoginAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
