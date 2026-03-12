using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Identity;

public sealed class Role : ITenantEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
}
