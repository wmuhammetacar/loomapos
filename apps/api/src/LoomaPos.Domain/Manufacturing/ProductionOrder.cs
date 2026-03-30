using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Manufacturing;

public sealed class ProductionOrder : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? BomId { get; set; }
    public Guid FinishedProductId { get; set; }
    public decimal PlannedQuantity { get; set; }
    public string Status { get; set; } = ProductionOrderStatuses.Draft;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
