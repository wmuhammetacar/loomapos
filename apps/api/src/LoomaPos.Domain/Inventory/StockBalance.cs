using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Inventory;

public sealed class StockBalance : ITenantEntity
{
    public Guid TenantId { get; set; }
    public Guid BranchId { get; set; }
    public Guid ProductId { get; set; }
    public decimal Qty { get; set; }
}
