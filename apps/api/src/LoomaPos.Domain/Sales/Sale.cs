using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Sales;

public sealed class Sale : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid BranchId { get; set; }
    public Guid DeviceId { get; set; }
    public string ReceiptNo { get; set; } = string.Empty;
    public SaleStatus Status { get; set; } = SaleStatus.Completed;
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Tax { get; set; }
    public decimal Total { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<SaleLine> Lines { get; set; } = new List<SaleLine>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}
