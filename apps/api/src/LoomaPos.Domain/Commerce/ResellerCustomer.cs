using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class ResellerCustomer : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ResellerId { get; set; }
    public DateTimeOffset ReferredAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
