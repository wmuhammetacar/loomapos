using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Inventory;

public sealed class StockMove : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid BranchId { get; set; }
    public Guid ProductId { get; set; }
    public decimal QtyDelta { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string RefType { get; set; } = string.Empty;
    public string RefId { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
