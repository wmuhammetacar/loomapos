using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class TenantUser : ITenantEntity, ICreatedAtEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid CustomerAccountId { get; set; }
    public string RoleCode { get; set; } = "tenant_admin";
    public bool IsOwner { get; set; }
    public string Status { get; set; } = "active";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
