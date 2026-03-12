namespace LoomaPos.Domain.Commerce;

public sealed class PaymentWebhook
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Provider { get; set; } = "mock";
    public string EventId { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = "{}";
    public string Status { get; set; } = "received";
    public string? Error { get; set; }
    public DateTimeOffset ReceivedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ProcessedAt { get; set; }
}

