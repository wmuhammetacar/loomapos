using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Accounting;

public sealed class AccountingExportItem : ITenantEntity, ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string SourceType { get; set; } = AccountingBridgeSourceTypes.Sale;
    public string SourceId { get; set; } = string.Empty;
    public string EventCode { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = "{}";
    public string Status { get; set; } = AccountingBridgeStatuses.Pending;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ExportedAt { get; set; }
    public string? FailureReason { get; set; }
}
