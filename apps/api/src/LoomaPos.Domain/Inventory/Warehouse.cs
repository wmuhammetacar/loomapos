using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Inventory;

public sealed class Warehouse : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = "DEFAULT";
    public string Type { get; set; } = "main";
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
