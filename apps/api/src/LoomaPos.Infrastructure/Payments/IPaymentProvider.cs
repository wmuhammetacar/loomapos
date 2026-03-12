namespace LoomaPos.Infrastructure.Payments;

public interface IPaymentProvider
{
    string ProviderCode { get; }
    Task<PaymentChargeResult> CreateChargeAsync(PaymentChargeRequest request, CancellationToken cancellationToken);
    Task<PaymentCheckoutSessionResult> CreateCheckoutSessionAsync(
        PaymentCheckoutSessionRequest request,
        CancellationToken cancellationToken);
    Task<PaymentWebhookVerificationResult> VerifyWebhookAsync(
        PaymentWebhookVerificationRequest request,
        CancellationToken cancellationToken);
    Task<PaymentStatusResult> FetchPaymentStatusAsync(
        string providerReference,
        CancellationToken cancellationToken);
    Task<ProviderSubscriptionResult> CreateRecurringSubscriptionAsync(
        ProviderSubscriptionRequest request,
        CancellationToken cancellationToken);
    Task CancelSubscriptionAsync(string providerSubscriptionId, CancellationToken cancellationToken);
    Task<ProviderSubscriptionResult> ChangePlanAsync(
        ProviderPlanChangeRequest request,
        CancellationToken cancellationToken);
    string? GetProviderCustomerReference(string email);
}

public sealed record PaymentChargeRequest(
    Guid TenantId,
    string Provider,
    decimal Amount,
    string Currency,
    string Description);

public sealed record PaymentChargeResult(
    string Provider,
    string PaymentRef,
    string Status,
    DateTimeOffset ProcessedAt,
    string? Message = null);

public sealed record PaymentCheckoutSessionRequest(
    Guid CheckoutSessionId,
    string Provider,
    decimal Amount,
    decimal TaxAmount,
    string Currency,
    string Description,
    string CustomerEmail,
    string CustomerName,
    string SuccessUrl,
    string CancelUrl,
    string BillingPeriod,
    string PlanCode,
    string? ExistingProviderCustomerReference);

public sealed record PaymentCheckoutSessionResult(
    string Provider,
    string ProviderSessionId,
    string ProviderPaymentReference,
    string Status,
    string? CheckoutUrl,
    DateTimeOffset CreatedAt,
    string? Message = null);

public sealed record PaymentWebhookVerificationRequest(
    string Provider,
    string PayloadJson,
    string? SignatureHeader);

public sealed record PaymentWebhookVerificationResult(
    bool IsValid,
    string EventId,
    string? ProviderPaymentReference,
    string Status,
    string PayloadJson,
    string? Error = null);

public sealed record PaymentStatusResult(
    string Provider,
    string ProviderPaymentReference,
    string Status,
    DateTimeOffset CheckedAt,
    string? Message = null);

public sealed record ProviderSubscriptionRequest(
    Guid SubscriptionId,
    string Provider,
    string PlanCode,
    string BillingPeriod,
    decimal Amount,
    string Currency,
    string? ExistingProviderCustomerReference);

public sealed record ProviderPlanChangeRequest(
    string ProviderSubscriptionId,
    string NewPlanCode,
    string BillingPeriod,
    decimal Amount,
    string Currency);

public sealed record ProviderSubscriptionResult(
    string Provider,
    string ProviderSubscriptionId,
    string Status,
    string? ProviderCustomerReference,
    DateTimeOffset ProcessedAt,
    string? Message = null);
