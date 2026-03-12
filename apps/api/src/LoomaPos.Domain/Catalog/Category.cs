using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Catalog;

public sealed class Category : ITenantEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid? ParentId { get; set; }
}
