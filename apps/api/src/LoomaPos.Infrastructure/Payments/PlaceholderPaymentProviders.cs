namespace LoomaPos.Infrastructure.Payments;

public sealed class StripePaymentProvider : PlaceholderPaymentProvider
{
    public override string ProviderCode => "stripe";
}

public sealed class IyzicoPaymentProvider : PlaceholderPaymentProvider
{
    public override string ProviderCode => "iyzico";
}

public sealed class PayTrPaymentProvider : PlaceholderPaymentProvider
{
    public override string ProviderCode => "paytr";
}

public abstract class PlaceholderPaymentProvider : IPaymentProvider
{
    public abstract string ProviderCode { get; }

    public Task<PaymentChargeResult> CreateChargeAsync(PaymentChargeRequest request, CancellationToken cancellationToken)
    {
        throw new NotSupportedException($"{ProviderCode} adapter is scaffolded but not configured.");
    }

    public Task<PaymentCheckoutSessionResult> CreateCheckoutSessionAsync(
        PaymentCheckoutSessionRequest request,
        CancellationToken cancellationToken)
    {
        return Task.FromResult(new PaymentCheckoutSessionResult(
            ProviderCode,
            $"{ProviderCode}-session-{request.CheckoutSessionId:N}",
            $"{ProviderCode}-payment-{request.CheckoutSessionId:N}",
            "pending",
            $"https://payments.loomapos.local/{ProviderCode}/{request.CheckoutSessionId:N}",
            DateTimeOffset.UtcNow,
            $"{ProviderCode} adapter placeholder."));
    }

    public Task<PaymentWebhookVerificationResult> VerifyWebhookAsync(
        PaymentWebhookVerificationRequest request,
        CancellationToken cancellationToken)
    {
        return Task.FromResult(new PaymentWebhookVerificationResult(
            true,
            $"{ProviderCode}-event-{Guid.NewGuid():N}",
            null,
            "pending",
            request.PayloadJson,
            $"{ProviderCode} webhook placeholder."));
    }

    public Task<PaymentStatusResult> FetchPaymentStatusAsync(
        string providerReference,
        CancellationToken cancellationToken)
    {
        return Task.FromResult(new PaymentStatusResult(
            ProviderCode,
            providerReference,
            "pending",
            DateTimeOffset.UtcNow,
            $"{ProviderCode} payment status placeholder."));
    }

    public Task<ProviderSubscriptionResult> CreateRecurringSubscriptionAsync(
        ProviderSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        return Task.FromResult(new ProviderSubscriptionResult(
            ProviderCode,
            $"{ProviderCode}-subscription-{request.SubscriptionId:N}",
            "pending",
            GetProviderCustomerReference("placeholder@loomapos.local"),
            DateTimeOffset.UtcNow,
            $"{ProviderCode} recurring subscription placeholder."));
    }

    public Task CancelSubscriptionAsync(string providerSubscriptionId, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }

    public Task<ProviderSubscriptionResult> ChangePlanAsync(
        ProviderPlanChangeRequest request,
        CancellationToken cancellationToken)
    {
        return Task.FromResult(new ProviderSubscriptionResult(
            ProviderCode,
            request.ProviderSubscriptionId,
            "pending",
            null,
            DateTimeOffset.UtcNow,
            $"{ProviderCode} change-plan placeholder."));
    }

    public string? GetProviderCustomerReference(string email)
    {
        return $"{ProviderCode}-customer-{Math.Abs(email.GetHashCode(StringComparison.OrdinalIgnoreCase))}";
    }
}
