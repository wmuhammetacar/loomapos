using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Inventory;

public sealed class WarehouseTransfer : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid FromWarehouseId { get; set; }
    public Guid ToWarehouseId { get; set; }
    public string Status { get; set; } = WarehouseTransferStatuses.Draft;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAt { get; set; }

    public ICollection<WarehouseTransferLine> Lines { get; set; } = new List<WarehouseTransferLine>();
}
