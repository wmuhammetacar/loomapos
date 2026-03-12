using System.Net;
using System.Net.Http.Headers;
using System.Net.Mail;
using System.Text;
using System.Text.Json;
using LoomaPos.Application.Integrations;

namespace LoomaPos.Infrastructure.Integration;

public sealed class RestEInvoiceAdapter(HttpClient httpClient) : GenericRestIntegrationAdapterBase(httpClient)
{
    public override string Domain => "einvoice";
    public override string ProviderCode => "generic-rest-einvoice";
    public override string DisplayName => "Generic REST E-Invoice";
    public override IReadOnlyList<string> SupportedCapabilities => ["authorize", "submit", "status", "webhook", "health"];
}

public sealed class RestFiscalBridgeAdapter(HttpClient httpClient) : GenericRestIntegrationAdapterBase(httpClient)
{
    public override string Domain => "fiscal";
    public override string ProviderCode => "rest-fiscal-bridge";
    public override string DisplayName => "REST Fiscal Bridge";
    public override IReadOnlyList<string> SupportedCapabilities => ["authorize", "submit", "status", "webhook", "health"];
}

public sealed class RestCollectionAdapter(HttpClient httpClient) : GenericRestIntegrationAdapterBase(httpClient)
{
    public override string Domain => "collections";
    public override string ProviderCode => "generic-rest-collection";
    public override string DisplayName => "Generic REST Collection";
    public override IReadOnlyList<string> SupportedCapabilities => ["authorize", "submit", "status", "webhook", "health", "payment_link"];
}

public sealed class RestAccountingAdapter(HttpClient httpClient) : GenericRestIntegrationAdapterBase(httpClient)
{
    public override string Domain => "accounting";
    public override string ProviderCode => "generic-rest-accounting";
    public override string DisplayName => "Generic REST Accounting";
    public override IReadOnlyList<string> SupportedCapabilities => ["authorize", "submit", "status", "webhook", "health", "mapping"];
}

public sealed class RestEcommerceAdapter(HttpClient httpClient) : GenericRestIntegrationAdapterBase(httpClient)
{
    public override string Domain => "ecommerce";
    public override string ProviderCode => "generic-rest-ecommerce";
    public override string DisplayName => "Generic REST Ecommerce";
    public override IReadOnlyList<string> SupportedCapabilities => ["authorize", "submit", "status", "webhook", "health", "mapping"];
}

public sealed class SmtpMessagingAdapter : IIntegrationProviderAdapter
{
    public string Domain => "messaging";
    public string ProviderCode => "smtp-email";
    public string DisplayName => "SMTP Email";
    public IReadOnlyList<string> SupportedModes => ["sandbox", "live"];
    public IReadOnlyList<string> SupportedCapabilities => ["authorize", "submit", "status", "health"];

    public Task<ProviderConnectionValidationResult> ValidateCredentialsAsync(
        ProviderCredentialContext credentialContext,
        CancellationToken cancellationToken)
    {
        var host = GetRequired(credentialContext.Settings, "smtp_host");
        var fromEmail = GetRequired(credentialContext.Settings, "from_email");
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(fromEmail))
        {
            return Task.FromResult(new ProviderConnectionValidationResult(
                false,
                "missing_configuration",
                "smtp_host and from_email are required."));
        }

        return Task.FromResult(new ProviderConnectionValidationResult(
            true,
            "validated",
            "SMTP provider settings are complete.",
            fromEmail));
    }

    public Task<ProviderAccountInfo> FetchAccountInfoAsync(
        ProviderCredentialContext credentialContext,
        CancellationToken cancellationToken)
    {
        var fromEmail = GetRequired(credentialContext.Settings, "from_email") ?? "unknown@localhost";
        var host = GetRequired(credentialContext.Settings, "smtp_host") ?? "localhost";
        return Task.FromResult(new ProviderAccountInfo(
            fromEmail,
            $"SMTP sender via {host}",
            credentialContext.Mode,
            new Dictionary<string, string>
            {
                ["host"] = host,
                ["from"] = fromEmail
            }));
    }

    public async Task<ProviderSubmissionResult> SubmitRecordAsync(
        ProviderSubmissionRequest request,
        CancellationToken cancellationToken)
    {
        using var document = JsonDocument.Parse(request.PayloadJson);
        var recipient = ReadPayloadValue(document.RootElement, "recipient", "to", "email");
        var subject = ReadPayloadValue(document.RootElement, "subject", "title") ?? $"{request.RecordType} notification";
        var body = ReadPayloadValue(document.RootElement, "body", "text", "message") ?? request.PayloadJson;

        if (string.IsNullOrWhiteSpace(recipient))
        {
            return new ProviderSubmissionResult("rejected", request.ExternalReference, "recipient is required in payload.");
        }

        var providerReference = $"smtp-{Guid.NewGuid():N}";
        return await Task.FromResult(new ProviderSubmissionResult(
            "queued",
            providerReference,
            "SMTP payload accepted. Delivery execution is environment-driven.",
            request.PayloadJson));
    }

    public Task<ProviderStatusResult> FetchStatusAsync(
        ProviderStatusRequest request,
        CancellationToken cancellationToken)
    {
        return Task.FromResult(new ProviderStatusResult(
            "accepted",
            request.ExternalReference,
            "SMTP delivery status is terminal once queued in the application layer."));
    }

    public Task<ProviderWebhookResult> ReceiveWebhookAsync(
        ProviderWebhookRequest request,
        CancellationToken cancellationToken)
    {
        return Task.FromResult(new ProviderWebhookResult(
            true,
            "accepted",
            "SMTP provider does not use inbound webhooks in this adapter.",
            ProviderReference: request.EventKey));
    }

    public Task<ProviderHealthResult> HealthCheckAsync(
        ProviderCredentialContext credentialContext,
        CancellationToken cancellationToken)
    {
        var host = GetRequired(credentialContext.Settings, "smtp_host");
        return Task.FromResult(new ProviderHealthResult(
            string.IsNullOrWhiteSpace(host) ? "error" : "healthy",
            string.IsNullOrWhiteSpace(host) ? "SMTP host is missing." : $"SMTP host configured: {host}",
            DateTimeOffset.UtcNow));
    }

    public async Task<ProviderSubmissionResult> SendAsync(
        ProviderCredentialContext credentialContext,
        ProviderSubmissionRequest request,
        CancellationToken cancellationToken)
    {
        using var document = JsonDocument.Parse(request.PayloadJson);
        var recipient = ReadPayloadValue(document.RootElement, "recipient", "to", "email");
        var subject = ReadPayloadValue(document.RootElement, "subject", "title") ?? $"{request.RecordType} notification";
        var body = ReadPayloadValue(document.RootElement, "body", "text", "message") ?? request.PayloadJson;
        if (string.IsNullOrWhiteSpace(recipient))
        {
            return new ProviderSubmissionResult("rejected", request.ExternalReference, "recipient is required in payload.");
        }

        var host = GetRequired(credentialContext.Settings, "smtp_host");
        var fromEmail = GetRequired(credentialContext.Settings, "from_email");
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(fromEmail))
        {
            return new ProviderSubmissionResult("rejected", request.ExternalReference, "smtp_host and from_email are required.");
        }

        var port = int.TryParse(GetRequired(credentialContext.Settings, "smtp_port"), out var parsedPort) ? parsedPort : 587;
        var enableSsl = !string.Equals(GetRequired(credentialContext.Settings, "enable_ssl"), "false", StringComparison.OrdinalIgnoreCase);
        var username = GetRequired(credentialContext.Secrets, "smtp_username");
        var password = GetRequired(credentialContext.Secrets, "smtp_password");
        var pickupDirectory = GetRequired(credentialContext.Settings, "pickup_directory");
        var providerReference = $"smtp-{Guid.NewGuid():N}";

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = enableSsl
        };
        if (!string.IsNullOrWhiteSpace(pickupDirectory))
        {
            client.DeliveryMethod = SmtpDeliveryMethod.SpecifiedPickupDirectory;
            client.PickupDirectoryLocation = pickupDirectory;
        }
        else if (!string.IsNullOrWhiteSpace(username))
        {
            client.Credentials = new NetworkCredential(username, password);
        }

        using var message = new MailMessage(fromEmail, recipient, subject, body)
        {
            IsBodyHtml = body.Contains('<') && body.Contains('>')
        };

        cancellationToken.ThrowIfCancellationRequested();
        await client.SendMailAsync(message, cancellationToken);
        return new ProviderSubmissionResult("sent", providerReference, "SMTP message sent.", request.PayloadJson);
    }

    internal static string? ReadPayloadValue(JsonElement root, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (root.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String)
            {
                return value.GetString();
            }
        }

        return null;
    }

    internal static string? GetRequired(IReadOnlyDictionary<string, string> values, string key)
    {
        return values.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value)
            ? value.Trim()
            : null;
    }
}

public abstract class GenericRestIntegrationAdapterBase(HttpClient httpClient) : IIntegrationProviderAdapter
{
    public abstract string Domain { get; }
    public abstract string ProviderCode { get; }
    public abstract string DisplayName { get; }
    public IReadOnlyList<string> SupportedModes => ["sandbox", "live"];
    public virtual IReadOnlyList<string> SupportedCapabilities => ["authorize", "submit", "status", "webhook", "health"];

    public virtual Task<ProviderConnectionValidationResult> ValidateCredentialsAsync(
        ProviderCredentialContext credentialContext,
        CancellationToken cancellationToken)
    {
        var baseUrl = GetRequiredValue(credentialContext.Settings, "base_url");
        var apiKey = GetRequiredValue(credentialContext.Secrets, "api_key");
        if (string.IsNullOrWhiteSpace(baseUrl) || string.IsNullOrWhiteSpace(apiKey))
        {
            return Task.FromResult(new ProviderConnectionValidationResult(
                false,
                "missing_credentials",
                "base_url setting and api_key secret are required."));
        }

        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out _))
        {
            return Task.FromResult(new ProviderConnectionValidationResult(
                false,
                "invalid_base_url",
                "base_url must be an absolute URI."));
        }

        return Task.FromResult(new ProviderConnectionValidationResult(
            true,
            "validated",
            "Provider connection settings are complete.",
            baseUrl));
    }

    public virtual Task<ProviderAccountInfo> FetchAccountInfoAsync(
        ProviderCredentialContext credentialContext,
        CancellationToken cancellationToken)
    {
        var baseUrl = GetRequiredValue(credentialContext.Settings, "base_url") ?? "https://provider.local";
        var host = Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri) ? uri.Host : baseUrl;
        return Task.FromResult(new ProviderAccountInfo(
            AccountReference: $"{ProviderCode}:{host}",
            DisplayName: $"{DisplayName} account",
            Environment: credentialContext.Mode,
            Metadata: new Dictionary<string, string>
            {
                ["baseUrl"] = baseUrl
            }));
    }

    public virtual async Task<ProviderSubmissionResult> SubmitRecordAsync(
        ProviderSubmissionRequest request,
        CancellationToken cancellationToken)
    {
        var (baseUrl, apiKey, submitPath, webhookSecret) = ResolveRequestContext(request.PayloadJson);
        if (string.IsNullOrWhiteSpace(baseUrl) || string.IsNullOrWhiteSpace(apiKey))
        {
            return new ProviderSubmissionResult("rejected", request.ExternalReference, "base_url and api_key are required.");
        }

        var url = BuildUrl(baseUrl, submitPath ?? $"/api/{Domain}/{request.RecordType}");
        using var message = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(request.PayloadJson, Encoding.UTF8, "application/json")
        };
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        message.Headers.Add("Idempotency-Key", request.IdempotencyKey);
        message.Headers.Add("X-Provider-Code", ProviderCode);
        if (!string.IsNullOrWhiteSpace(webhookSecret))
        {
            message.Headers.Add("X-Webhook-Secret-Hint", "configured");
        }

        using var response = await httpClient.SendAsync(message, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        var classification = IntegrationRetryClassifier.Classify((int)response.StatusCode, response.StatusCode == HttpStatusCode.Unauthorized);
        var status = classification switch
        {
            "accepted" => "submitted",
            "retryable" => "retryable",
            "retry_later" => "retry_later",
            "credential_expired" => "credential_expired",
            _ => "rejected"
        };

        return new ProviderSubmissionResult(
            status,
            ExtractProviderReference(body) ?? request.ExternalReference,
            $"HTTP {(int)response.StatusCode} {response.ReasonPhrase}",
            body);
    }

    public virtual async Task<ProviderStatusResult> FetchStatusAsync(
        ProviderStatusRequest request,
        CancellationToken cancellationToken)
    {
        var url = request.ExternalReference;
        if (string.IsNullOrWhiteSpace(url))
        {
            return new ProviderStatusResult("unknown", null, "External reference is required.");
        }

        return await Task.FromResult(new ProviderStatusResult(
            "pending",
            request.ExternalReference,
            "Status fetch requires provider-specific polling context."));
    }

    public virtual Task<ProviderWebhookResult> ReceiveWebhookAsync(
        ProviderWebhookRequest request,
        CancellationToken cancellationToken)
    {
        var timestamp = ExtractHeaderValue(request.Signature, "t");
        var signature = ExtractHeaderValue(request.Signature, "v1");
        var webhookSecret = ExtractWebhookSecret(request.PayloadJson);
        if (!string.IsNullOrWhiteSpace(webhookSecret))
        {
            if (string.IsNullOrWhiteSpace(timestamp) || string.IsNullOrWhiteSpace(signature))
            {
                return Task.FromResult(new ProviderWebhookResult(false, "invalid_signature", "Webhook signature header is incomplete."));
            }

            if (!WebhookSignatureV1.Verify(webhookSecret, request.PayloadJson, timestamp, signature))
            {
                return Task.FromResult(new ProviderWebhookResult(false, "invalid_signature", "Webhook signature verification failed."));
            }
        }

        return Task.FromResult(new ProviderWebhookResult(
            true,
            "accepted",
            "Provider webhook accepted.",
            ProviderReference: request.EventKey));
    }

    public virtual Task<ProviderHealthResult> HealthCheckAsync(
        ProviderCredentialContext credentialContext,
        CancellationToken cancellationToken)
    {
        var validation = ValidateCredentialsAsync(credentialContext, cancellationToken).GetAwaiter().GetResult();
        return Task.FromResult(new ProviderHealthResult(
            validation.IsValid ? "healthy" : "error",
            validation.Message,
            DateTimeOffset.UtcNow));
    }

    internal static string? GetRequiredValue(IReadOnlyDictionary<string, string> values, string key)
    {
        return values.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value)
            ? value.Trim()
            : null;
    }

    internal static string BuildUrl(string baseUrl, string path)
    {
        return $"{baseUrl.TrimEnd('/')}/{path.TrimStart('/')}";
    }

    internal static string? ExtractProviderReference(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(body);
            foreach (var candidate in new[] { "providerReference", "reference", "id", "documentId", "paymentId" })
            {
                if (document.RootElement.TryGetProperty(candidate, out var value) && value.ValueKind == JsonValueKind.String)
                {
                    return value.GetString();
                }
            }
        }
        catch
        {
        }

        return null;
    }

    internal static string? ExtractHeaderValue(string header, string key)
    {
        foreach (var segment in header.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var parts = segment.Split('=', 2, StringSplitOptions.TrimEntries);
            if (parts.Length == 2 && string.Equals(parts[0], key, StringComparison.OrdinalIgnoreCase))
            {
                return parts[1];
            }
        }

        return null;
    }

    private static (string? BaseUrl, string? ApiKey, string? SubmitPath, string? WebhookSecret) ResolveRequestContext(string payloadJson)
    {
        try
        {
            using var document = JsonDocument.Parse(payloadJson);
            if (!document.RootElement.TryGetProperty("providerContext", out var providerContext))
            {
                return (null, null, null, null);
            }

            return (
                ReadString(providerContext, "baseUrl"),
                ReadString(providerContext, "apiKey"),
                ReadString(providerContext, "submitPath"),
                ReadString(providerContext, "webhookSecret"));
        }
        catch
        {
            return (null, null, null, null);
        }
    }

    private static string? ExtractWebhookSecret(string payloadJson)
    {
        try
        {
            using var document = JsonDocument.Parse(payloadJson);
            return document.RootElement.TryGetProperty("providerContext", out var providerContext)
                ? ReadString(providerContext, "webhookSecret")
                : null;
        }
        catch
        {
            return null;
        }
    }

    private static string? ReadString(JsonElement parent, string key)
    {
        return parent.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
    }
}
