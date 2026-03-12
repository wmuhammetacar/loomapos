using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Customers;

public sealed class Contact : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public ContactType Type { get; set; } = ContactType.Customer;
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
