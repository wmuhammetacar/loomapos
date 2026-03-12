using LoomaPos.Domain.Common;

namespace LoomaPos.Domain.Commerce;

public sealed class PaymentAttempt : ICreatedAtEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CheckoutSessionId { get; set; }
    public Guid? PaymentTransactionId { get; set; }
    public string Provider { get; set; } = "mock";
    public string Status { get; set; } = "pending";
    public string? FailureReason { get; set; }
    public string MetadataJson { get; set; } = "{}";
    public DateTimeOffset AttemptedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
