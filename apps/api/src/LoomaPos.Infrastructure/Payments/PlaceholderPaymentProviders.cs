using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace LoomaPos.Infrastructure.Payments;

public sealed class StripePaymentProvider : PlaceholderPaymentProvider
{
    public StripePaymentProvider(IConfiguration configuration, ILoggerFactory loggerFactory)
        : base(configuration, loggerFactory.CreateLogger<StripePaymentProvider>())
    {
    }

    public override string ProviderCode => "stripe";
}

public sealed class IyzicoPaymentProvider : PlaceholderPaymentProvider
{
    public IyzicoPaymentProvider(IConfiguration configuration, ILoggerFactory loggerFactory)
        : base(configuration, loggerFactory.CreateLogger<IyzicoPaymentProvider>())
    {
    }

    public override string ProviderCode => "iyzico";
}

public sealed class PayTrPaymentProvider : PlaceholderPaymentProvider
{
    public PayTrPaymentProvider(IConfiguration configuration, ILoggerFactory loggerFactory)
        : base(configuration, loggerFactory.CreateLogger<PayTrPaymentProvider>())
    {
    }

    public override string ProviderCode => "paytr";
}

public abstract class PlaceholderPaymentProvider : IPaymentProvider
{
    private readonly IConfiguration _configuration;
    private readonly ILogger _logger;

    protected PlaceholderPaymentProvider(IConfiguration configuration, ILogger logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

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
        var eventId = ResolveEventId(request.PayloadJson);
        if (!TryVerifySignature(request.PayloadJson, request.SignatureHeader, out var signatureError))
        {
            _logger.LogWarning(
                "payment_webhook_signature_rejected provider {Provider} eventId {EventId} reason {Reason}",
                ProviderCode,
                eventId,
                signatureError);

            return Task.FromResult(new PaymentWebhookVerificationResult(
                false,
                eventId,
                null,
                "rejected",
                request.PayloadJson,
                signatureError));
        }

        return Task.FromResult(new PaymentWebhookVerificationResult(
            true,
            eventId,
            ResolveString(request.PayloadJson, "providerPaymentReference", "paymentRef", "payment_ref", "paymentId"),
            ResolveString(request.PayloadJson, "status", "paymentStatus") ?? "pending",
            request.PayloadJson));
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

    private bool TryVerifySignature(string payloadJson, string? signatureHeader, out string error)
    {
        if (string.IsNullOrWhiteSpace(signatureHeader))
        {
            error = "signature is required";
            return false;
        }

        var secret = _configuration[$"Payments:WebhookSecrets:{ProviderCode}"]
            ?? _configuration[$"Payments:WebhookSecrets:{ProviderCode.ToUpperInvariant()}"]
            ?? _configuration["Payments:WebhookSecrets:default"];
        if (string.IsNullOrWhiteSpace(secret))
        {
            error = "webhook signing secret is not configured";
            return false;
        }

        if (!TryExtractSignature(signatureHeader, out var signature))
        {
            error = "signature format is invalid";
            return false;
        }

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var digest = hmac.ComputeHash(Encoding.UTF8.GetBytes(payloadJson));
        var expectedHex = Convert.ToHexString(digest).ToLowerInvariant();
        var expectedBase64 = Convert.ToBase64String(digest);

        if (FixedTimeEquals(signature, expectedHex) || FixedTimeEquals(signature, expectedBase64))
        {
            error = string.Empty;
            return true;
        }

        error = "invalid signature";
        return false;
    }

    private static bool TryExtractSignature(string signatureHeader, out string signature)
    {
        signature = string.Empty;
        var trimmed = signatureHeader.Trim();
        if (trimmed.Length == 0)
        {
            return false;
        }

        if (trimmed.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase))
        {
            signature = trimmed[7..].Trim();
            return signature.Length > 0;
        }

        if (trimmed.StartsWith("v1=", StringComparison.OrdinalIgnoreCase))
        {
            signature = trimmed[3..].Trim();
            return signature.Length > 0;
        }

        if (trimmed.Contains(","))
        {
            var fragments = trimmed.Split(",", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            foreach (var fragment in fragments)
            {
                if (fragment.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase))
                {
                    signature = fragment[7..].Trim();
                    return signature.Length > 0;
                }

                if (fragment.StartsWith("v1=", StringComparison.OrdinalIgnoreCase))
                {
                    signature = fragment[3..].Trim();
                    return signature.Length > 0;
                }
            }
        }

        signature = trimmed;
        return signature.Length > 0;
    }

    private string ResolveEventId(string payloadJson)
    {
        var resolved = ResolveString(payloadJson, "eventId", "event_id", "id");
        if (!string.IsNullOrWhiteSpace(resolved))
        {
            return resolved.Length > 120 ? resolved[..120] : resolved;
        }

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(payloadJson));
        return $"{ProviderCode}-{Convert.ToHexString(hash)[..24].ToLowerInvariant()}";
    }

    private static string? ResolveString(string payloadJson, params string[] propertyNames)
    {
        try
        {
            using var document = JsonDocument.Parse(payloadJson);
            foreach (var propertyName in propertyNames)
            {
                if (document.RootElement.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.String)
                {
                    var value = property.GetString();
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        return value.Trim();
                    }
                }
            }
        }
        catch (JsonException)
        {
            return null;
        }

        return null;
    }

    private static bool FixedTimeEquals(string left, string right)
    {
        var leftBytes = Encoding.UTF8.GetBytes(left);
        var rightBytes = Encoding.UTF8.GetBytes(right);
        return leftBytes.Length == rightBytes.Length && CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
    }
}
