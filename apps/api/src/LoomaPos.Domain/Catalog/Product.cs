using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Catalog;

public sealed class Product : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Sku { get; set; }
    public string? Barcode { get; set; }
    public string Unit { get; set; } = "adet";
    public decimal SalePrice { get; set; }
    public decimal PurchasePrice { get; set; }
    public decimal TaxRate { get; set; }
    public bool StockTrackingEnabled { get; set; } = true;
    public decimal MinStock { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
