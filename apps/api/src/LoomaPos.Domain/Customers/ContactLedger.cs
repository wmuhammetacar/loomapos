using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Customers;

public sealed class ContactLedger : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ContactId { get; set; }
    public decimal AmountDelta { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string RefType { get; set; } = string.Empty;
    public string RefId { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
