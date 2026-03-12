namespace LoomaPos.Domain.Catalog;

public sealed class ProductBarcode
{
    public Guid ProductId { get; set; }
    public string Barcode { get; set; } = string.Empty;
}
