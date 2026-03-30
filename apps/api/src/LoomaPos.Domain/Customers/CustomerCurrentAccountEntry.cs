using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Customers;

public sealed class CustomerCurrentAccountEntry : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid CustomerId { get; set; }
    public string Type { get; set; } = CustomerCurrentAccountEntryTypes.Adjustment;
    public decimal Amount { get; set; }
    public string RefType { get; set; } = "manual";
    public string RefId { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string? Note { get; set; }
}
