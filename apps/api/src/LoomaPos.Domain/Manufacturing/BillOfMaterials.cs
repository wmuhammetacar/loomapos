using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Manufacturing;

public sealed class BillOfMaterials : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ProductId { get; set; }
    public string? Code { get; set; }
    public int Version { get; set; } = 1;
    public bool IsActive { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<BillOfMaterialsLine> Lines { get; set; } = new List<BillOfMaterialsLine>();
}
