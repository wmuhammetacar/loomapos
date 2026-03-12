using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Cashbook;

public sealed class CashTransaction : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid BranchId { get; set; }
    public CashTransactionType Type { get; set; } = CashTransactionType.In;
    public decimal Amount { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
