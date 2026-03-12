using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Catalog;

public sealed class ProductVariant : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ProductId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Sku { get; set; }
    public string? Barcode { get; set; }
    public string AttributesJson { get; set; } = "{}";
    public decimal PriceDelta { get; set; }
    public bool StockTrackingEnabled { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

