using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace LoomaPos.Infrastructure.Payments;

public sealed class IyzicoPaymentProvider : IPaymentProvider
{
    private const string DefaultBaseUrl = "https://sandbox-api.iyzipay.com";
    private const string DefaultCheckoutInitializePath = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
    private const string DefaultCheckoutDetailPath = "/payment/iyzipos/checkoutform/auth/ecom/detail";

    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    private readonly ILogger<IyzicoPaymentProvider> _logger;

    public IyzicoPaymentProvider(
        IConfiguration configuration,
        HttpClient httpClient,
        ILogger<IyzicoPaymentProvider> logger)
    {
        _configuration = configuration;
        _httpClient = httpClient;
        _logger = logger;
    }

    public string ProviderCode => "iyzico";

    public Task<PaymentChargeResult> CreateChargeAsync(PaymentChargeRequest request, CancellationToken cancellationToken)
    {
        throw new NotSupportedException("Iyzico card charge path is disabled. Use checkout session flow.");
    }

    public async Task<PaymentCheckoutSessionResult> CreateCheckoutSessionAsync(
        PaymentCheckoutSessionRequest request,
        CancellationToken cancellationToken)
    {
        var settings = LoadSettings(requireWebhookSecret: false);
        var amount = request.Amount + request.TaxAmount;
        var customerName = SplitCustomerName(request.CustomerName);

        var payload = JsonSerializer.Serialize(new
        {
            locale = "tr",
            conversationId = request.CheckoutSessionId.ToString("N"),
            price = FormatAmount(amount),
            paidPrice = FormatAmount(amount),
            currency = NormalizeCurrency(request.Currency),
            basketId = request.CheckoutSessionId.ToString("N"),
            paymentGroup = "SUBSCRIPTION",
            callbackUrl = request.SuccessUrl,
            enabledInstallments = Array.Empty<int>(),
            buyer = new
            {
                id = request.CheckoutSessionId.ToString("N"),
                name = customerName.FirstName,
                surname = customerName.LastName,
                gsmNumber = string.Empty,
                email = request.CustomerEmail,
                identityNumber = "11111111111",
                registrationAddress = "N/A",
                ip = "127.0.0.1",
                city = "Istanbul",
                country = "Turkey",
                zipCode = "34000"
            },
            shippingAddress = new
            {
                contactName = request.CustomerName,
                city = "Istanbul",
                country = "Turkey",
                address = "N/A",
                zipCode = "34000"
            },
            billingAddress = new
            {
                contactName = request.CustomerName,
                city = "Istanbul",
                country = "Turkey",
                address = "N/A",
                zipCode = "34000"
            },
            basketItems = new[]
            {
                new
                {
                    id = request.PlanCode,
                    name = request.Description,
                    category1 = "Subscription",
                    itemType = "VIRTUAL",
                    price = FormatAmount(amount)
                }
            }
        });

        using var document = await SendSignedRequestAsync(
            settings,
            HttpMethod.Post,
            settings.CheckoutInitializePath,
            payload,
            cancellationToken);

        var root = document.RootElement;
        var iyzicoStatus = NormalizeIyzicoStatus(ReadString(root, "status"));
        if (!string.Equals(iyzicoStatus, "success", StringComparison.Ordinal))
        {
            var failureMessage = ReadString(root, "errorMessage", "errorCode", "errorGroup") ?? "iyzico_checkout_initialize_failed";
            _logger.LogWarning(
                "iyzico_checkout_initialize_failed checkoutSessionId {CheckoutSessionId} reason {Reason}",
                request.CheckoutSessionId,
                failureMessage);

            return new PaymentCheckoutSessionResult(
                ProviderCode,
                $"iyzico-session-{request.CheckoutSessionId:N}",
                $"iyzico-payment-{request.CheckoutSessionId:N}",
                "failed",
                null,
                DateTimeOffset.UtcNow,
                failureMessage);
        }

        var token = ReadString(root, "token") ?? $"iyzico-token-{request.CheckoutSessionId:N}";
        var checkoutUrl = ReadString(root, "paymentPageUrl", "checkoutUrl");
        var providerPaymentReference = ReadString(root, "paymentId", "paymentConversationId") ?? token;

        return new PaymentCheckoutSessionResult(
            ProviderCode,
            token,
            providerPaymentReference,
            "success",
            checkoutUrl,
            DateTimeOffset.UtcNow,
            ReadString(root, "status"));
    }

    public Task<PaymentWebhookVerificationResult> VerifyWebhookAsync(
        PaymentWebhookVerificationRequest request,
        CancellationToken cancellationToken)
    {
        var settings = LoadSettings(requireWebhookSecret: true);
        var eventId = ResolveEventId(request.PayloadJson);

        if (string.IsNullOrWhiteSpace(request.SignatureHeader))
        {
            return Task.FromResult(new PaymentWebhookVerificationResult(
                false,
                eventId,
                null,
                "rejected",
                request.PayloadJson,
                "signature is required"));
        }

        if (!TryExtractSignature(request.SignatureHeader, out var providedSignature))
        {
            return Task.FromResult(new PaymentWebhookVerificationResult(
                false,
                eventId,
                null,
                "rejected",
                request.PayloadJson,
                "signature format is invalid"));
        }

        if (!IsValidWebhookSignature(settings.WebhookSecret!, request.PayloadJson, providedSignature))
        {
            _logger.LogWarning(
                "iyzico_webhook_signature_rejected eventId {EventId}",
                eventId);

            return Task.FromResult(new PaymentWebhookVerificationResult(
                false,
                eventId,
                null,
                "rejected",
                request.PayloadJson,
                "invalid signature"));
        }

        var providerPaymentReference = ResolveString(request.PayloadJson, "paymentId", "paymentConversationId", "token");
        var providerStatus = NormalizeIyzicoStatus(ResolveString(request.PayloadJson, "paymentStatus", "status"));

        return Task.FromResult(new PaymentWebhookVerificationResult(
            true,
            eventId,
            providerPaymentReference,
            providerStatus,
            request.PayloadJson));
    }

    public async Task<PaymentStatusResult> FetchPaymentStatusAsync(
        string providerReference,
        CancellationToken cancellationToken)
    {
        var settings = LoadSettings(requireWebhookSecret: false);
        var trimmedReference = providerReference.Trim();
        var payload = JsonSerializer.Serialize(new
        {
            locale = "tr",
            conversationId = trimmedReference,
            token = trimmedReference
        });

        using var document = await SendSignedRequestAsync(
            settings,
            HttpMethod.Post,
            settings.CheckoutDetailPath,
            payload,
            cancellationToken);

        var root = document.RootElement;
        var topLevelStatus = NormalizeIyzicoStatus(ReadString(root, "status"));
        if (!string.Equals(topLevelStatus, "success", StringComparison.Ordinal))
        {
            var reason = ReadString(root, "errorMessage", "errorCode", "errorGroup") ?? "iyzico_status_fetch_failed";
            return new PaymentStatusResult(
                ProviderCode,
                trimmedReference,
                "failed",
                DateTimeOffset.UtcNow,
                reason);
        }

        var rawPaymentStatus = NormalizeIyzicoStatus(ReadString(root, "paymentStatus", "status"));
        var providerStatus = rawPaymentStatus switch
        {
            "success" or "paid" or "succeeded" => "success",
            "failure" or "failed" => "failed",
            "cancelled" or "canceled" => "canceled",
            "expired" => "expired",
            _ => "pending"
        };

        var providerPaymentReference = ReadString(root, "paymentId", "paymentConversationId", "conversationId")
            ?? trimmedReference;

        return new PaymentStatusResult(
            ProviderCode,
            providerPaymentReference,
            providerStatus,
            DateTimeOffset.UtcNow,
            ReadString(root, "status", "paymentStatus"));
    }

    public Task<ProviderSubscriptionResult> CreateRecurringSubscriptionAsync(
        ProviderSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        return Task.FromResult(new ProviderSubscriptionResult(
            ProviderCode,
            $"iyzico-subscription-{request.SubscriptionId:N}",
            "active",
            request.ExistingProviderCustomerReference,
            DateTimeOffset.UtcNow,
            "iyzico recurring lifecycle placeholder while checkout is live."));
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
            "iyzico plan change placeholder while recurring bridge is pending."));
    }

    public string? GetProviderCustomerReference(string email)
    {
        var normalizedEmail = string.IsNullOrWhiteSpace(email)
            ? "customer"
            : email.Trim().ToLowerInvariant();
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes(normalizedEmail));
        return "iyzico-customer-" + Convert.ToHexString(digest)[..20].ToLowerInvariant();
    }

    private async Task<JsonDocument> SendSignedRequestAsync(
        IyzicoSettings settings,
        HttpMethod method,
        string path,
        string payload,
        CancellationToken cancellationToken)
    {
        var target = BuildTargetUri(settings.BaseUrl, path);
        var randomKey = Guid.NewGuid().ToString("N");
        var authorization = BuildAuthorizationHeader(settings.ApiKey, settings.SecretKey, randomKey, target.PathAndQuery, payload);

        using var request = new HttpRequestMessage(method, target)
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json")
        };

        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Headers.TryAddWithoutValidation("x-iyzi-rnd", randomKey);
        request.Headers.TryAddWithoutValidation("x-iyzi-client-version", "loomapos-api-iyzico-v1");
        request.Headers.TryAddWithoutValidation("Authorization", authorization);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning(
                "iyzico_http_failure path {Path} statusCode {StatusCode}",
                target.PathAndQuery,
                (int)response.StatusCode);

            throw new InvalidOperationException($"Iyzico request failed with status {(int)response.StatusCode}.");
        }

        try
        {
            return JsonDocument.Parse(body);
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException("Iyzico returned invalid JSON payload.", ex);
        }
    }

    private IyzicoSettings LoadSettings(bool requireWebhookSecret)
    {
        var apiKey = ReadConfiguration(
            "Payments:Providers:Iyzico:ApiKey",
            "Payments:Iyzico:ApiKey",
            "Iyzico:ApiKey");
        var secretKey = ReadConfiguration(
            "Payments:Providers:Iyzico:SecretKey",
            "Payments:Iyzico:SecretKey",
            "Iyzico:SecretKey");
        var baseUrl = ReadConfiguration(
            "Payments:Providers:Iyzico:BaseUrl",
            "Payments:Iyzico:BaseUrl",
            "Iyzico:BaseUrl")
            ?? DefaultBaseUrl;
        var checkoutInitializePath = ReadConfiguration(
            "Payments:Providers:Iyzico:CheckoutInitializePath",
            "Payments:Iyzico:CheckoutInitializePath")
            ?? DefaultCheckoutInitializePath;
        var checkoutDetailPath = ReadConfiguration(
            "Payments:Providers:Iyzico:CheckoutDetailPath",
            "Payments:Iyzico:CheckoutDetailPath")
            ?? DefaultCheckoutDetailPath;
        var webhookSecret = ReadConfiguration(
            "Payments:Providers:Iyzico:WebhookSecret",
            "Payments:WebhookSecrets:iyzico",
            "Payments:WebhookSecrets:IYZICO",
            "Payments:WebhookSecrets:default");

        if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(secretKey))
        {
            throw new InvalidOperationException("Iyzico provider is not configured. ApiKey/SecretKey are required.");
        }

        if (requireWebhookSecret && string.IsNullOrWhiteSpace(webhookSecret))
        {
            throw new InvalidOperationException("Iyzico webhook secret is not configured.");
        }

        return new IyzicoSettings(
            apiKey.Trim(),
            secretKey.Trim(),
            baseUrl.Trim().TrimEnd('/'),
            NormalizePath(checkoutInitializePath),
            NormalizePath(checkoutDetailPath),
            string.IsNullOrWhiteSpace(webhookSecret) ? null : webhookSecret.Trim());
    }

    private static Uri BuildTargetUri(string baseUrl, string path)
    {
        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var root))
        {
            throw new InvalidOperationException("Iyzico base url is invalid.");
        }

        return Uri.TryCreate(root, NormalizePath(path), out var target)
            ? target
            : throw new InvalidOperationException("Iyzico path is invalid.");
    }

    private static string BuildAuthorizationHeader(
        string apiKey,
        string secretKey,
        string randomKey,
        string requestPathAndQuery,
        string payload)
    {
        var contentToSign = randomKey + requestPathAndQuery + payload;
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secretKey));
        var signature = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(contentToSign))).ToLowerInvariant();
        var authBody = $"apiKey:{apiKey}&randomKey:{randomKey}&signature:{signature}";
        return "IYZWSv2 " + Convert.ToBase64String(Encoding.UTF8.GetBytes(authBody));
    }

    private static bool IsValidWebhookSignature(string secret, string payload, string signature)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var digest = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        var expectedHex = Convert.ToHexString(digest).ToLowerInvariant();
        var expectedBase64 = Convert.ToBase64String(digest);

        return FixedTimeEquals(signature, expectedHex) || FixedTimeEquals(signature, expectedBase64);
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

        if (trimmed.Contains(','))
        {
            var fragments = trimmed.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
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

    private static string ResolveEventId(string payloadJson)
    {
        var resolved = ResolveString(payloadJson, "eventId", "event_id", "iyziEventId", "id");
        if (!string.IsNullOrWhiteSpace(resolved))
        {
            return resolved.Length > 120 ? resolved[..120] : resolved;
        }

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(payloadJson));
        return "iyzico-" + Convert.ToHexString(hash)[..24].ToLowerInvariant();
    }

    private static string? ResolveString(string payloadJson, params string[] propertyNames)
    {
        try
        {
            using var document = JsonDocument.Parse(payloadJson);
            return ReadString(document.RootElement, propertyNames);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? ReadString(JsonElement root, params string[] propertyNames)
    {
        foreach (var propertyName in propertyNames)
        {
            if (root.TryGetProperty(propertyName, out var direct) && direct.ValueKind == JsonValueKind.String)
            {
                var value = direct.GetString();
                if (!string.IsNullOrWhiteSpace(value))
                {
                    return value.Trim();
                }
            }

            foreach (var property in root.EnumerateObject())
            {
                if (!property.Name.Equals(propertyName, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (property.Value.ValueKind != JsonValueKind.String)
                {
                    continue;
                }

                var value = property.Value.GetString();
                if (!string.IsNullOrWhiteSpace(value))
                {
                    return value.Trim();
                }
            }
        }

        return null;
    }

    private static string FormatAmount(decimal amount)
    {
        return amount.ToString("0.00", CultureInfo.InvariantCulture);
    }

    private static string NormalizeCurrency(string? currency)
    {
        var normalized = string.IsNullOrWhiteSpace(currency)
            ? "TRY"
            : currency.Trim().ToUpperInvariant();
        return normalized.Length > 3 ? normalized[..3] : normalized;
    }

    private static string NormalizePath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return "/";
        }

        return path.StartsWith('/') ? path : "/" + path;
    }

    private static string NormalizeIyzicoStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return "pending";
        }

        return status.Trim().ToLowerInvariant();
    }

    private static bool FixedTimeEquals(string left, string right)
    {
        var leftBytes = Encoding.UTF8.GetBytes(left);
        var rightBytes = Encoding.UTF8.GetBytes(right);
        return leftBytes.Length == rightBytes.Length && CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
    }

    private string? ReadConfiguration(params string[] keys)
    {
        foreach (var key in keys)
        {
            var value = _configuration[key];
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return null;
    }

    private static (string FirstName, string LastName) SplitCustomerName(string rawFullName)
    {
        var fullName = string.IsNullOrWhiteSpace(rawFullName) ? "Looma Customer" : rawFullName.Trim();
        var segments = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (segments.Length == 1)
        {
            return (segments[0], "Customer");
        }

        return (segments[0], string.Join(' ', segments.Skip(1)));
    }

    private sealed record IyzicoSettings(
        string ApiKey,
        string SecretKey,
        string BaseUrl,
        string CheckoutInitializePath,
        string CheckoutDetailPath,
        string? WebhookSecret);
}
