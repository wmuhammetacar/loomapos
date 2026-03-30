namespace LoomaPos.Domain.Manufacturing;

public sealed class BillOfMaterialsLine
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BomId { get; set; }
    public Guid ComponentProductId { get; set; }
    public decimal Quantity { get; set; }
}
