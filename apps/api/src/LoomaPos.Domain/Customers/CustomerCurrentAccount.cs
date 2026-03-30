using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Customers;

public sealed class CustomerCurrentAccount : ITenantEntity, IUpdatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid CustomerId { get; set; }
    public decimal Balance { get; set; }
    public string Currency { get; set; } = "TRY";
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
