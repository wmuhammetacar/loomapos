namespace LoomaPos.Infrastructure.Payments;

public sealed class MockPaymentProvider : IPaymentProvider
{
    public string ProviderCode => "mock";

    public Task<PaymentChargeResult> CreateChargeAsync(PaymentChargeRequest request, CancellationToken cancellationToken)
    {
        var provider = string.IsNullOrWhiteSpace(request.Provider) ? "mock" : request.Provider.Trim().ToLowerInvariant();
        var now = DateTimeOffset.UtcNow;
        var paymentRef = $"{provider}-{now:yyyyMMddHHmmss}-{Guid.NewGuid():N}".ToLowerInvariant();

        return Task.FromResult(new PaymentChargeResult(
            provider,
            paymentRef,
            "paid",
            now,
            "Mock payment adapter approved."));
    }

    public Task<PaymentCheckoutSessionResult> CreateCheckoutSessionAsync(
        PaymentCheckoutSessionRequest request,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        return Task.FromResult(new PaymentCheckoutSessionResult(
            ProviderCode,
            $"mock-session-{request.CheckoutSessionId:N}",
            $"mock-payment-{request.CheckoutSessionId:N}",
            "paid",
            null,
            now,
            "Mock checkout approved immediately."));
    }

    public Task<PaymentWebhookVerificationResult> VerifyWebhookAsync(
        PaymentWebhookVerificationRequest request,
        CancellationToken cancellationToken)
    {
        return Task.FromResult(new PaymentWebhookVerificationResult(
            true,
            $"mock-event-{Guid.NewGuid():N}",
            null,
            "paid",
            request.PayloadJson));
    }

    public Task<PaymentStatusResult> FetchPaymentStatusAsync(
        string providerReference,
        CancellationToken cancellationToken)
    {
        return Task.FromResult(new PaymentStatusResult(
            ProviderCode,
            providerReference,
            "paid",
            DateTimeOffset.UtcNow,
            "Mock payment status."));
    }

    public Task<ProviderSubscriptionResult> CreateRecurringSubscriptionAsync(
        ProviderSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        return Task.FromResult(new ProviderSubscriptionResult(
            ProviderCode,
            $"mock-subscription-{request.SubscriptionId:N}",
            "active",
            request.ExistingProviderCustomerReference ?? GetProviderCustomerReference("mock@loomapos.local"),
            DateTimeOffset.UtcNow,
            "Mock recurring subscription created."));
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
            "active",
            null,
            DateTimeOffset.UtcNow,
            $"Plan changed to {request.NewPlanCode}."));
    }

    public string? GetProviderCustomerReference(string email)
    {
        var normalizedEmail = string.IsNullOrWhiteSpace(email) ? "customer" : email.Trim().ToLowerInvariant();
        return $"mock-customer-{normalizedEmail.GetHashCode(StringComparison.OrdinalIgnoreCase):x}";
    }
}
