using System.Net;
using System.Net.Http;
using System.Text;
using LoomaPos.Application.Integrations;
using LoomaPos.Infrastructure.Integration;

namespace LoomaPos.UnitTests.Integrations;

public sealed class RealIntegrationProviderAdapterTests
{
    [Fact]
    public async Task RestEInvoiceAdapter_ShouldRequireBaseUrlAndApiKey()
    {
        var adapter = new RestEInvoiceAdapter(new HttpClient(new StubHttpMessageHandler((_, _) => throw new InvalidOperationException())));

        var result = await adapter.ValidateCredentialsAsync(
            new ProviderCredentialContext(
                Guid.NewGuid(),
                adapter.ProviderCode,
                "live",
                new Dictionary<string, string>(),
                new Dictionary<string, string>()),
            CancellationToken.None);

        Assert.False(result.IsValid);
        Assert.Equal("missing_credentials", result.Status);
    }

    [Fact]
    public async Task RestCollectionAdapter_ShouldSubmitWithBearerAndIdempotencyHeaders()
    {
        HttpRequestMessage? captured = null;
        var adapter = new RestCollectionAdapter(new HttpClient(new StubHttpMessageHandler((request, cancellationToken) =>
        {
            captured = request;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"paymentId\":\"pay_123\"}", Encoding.UTF8, "application/json")
            });
        })));

        var payload = """
        {
          "providerContext": {
            "baseUrl": "https://provider.example",
            "apiKey": "secret-token",
            "submitPath": "/links"
          },
          "amount": 1250.50,
          "currency": "TRY"
        }
        """;

        var result = await adapter.SubmitRecordAsync(
            new ProviderSubmissionRequest(
                Guid.NewGuid(),
                adapter.Domain,
                adapter.ProviderCode,
                "idem-123",
                "payment_link",
                "order-42",
                payload),
            CancellationToken.None);

        Assert.NotNull(captured);
        Assert.Equal(HttpMethod.Post, captured!.Method);
        Assert.Equal("https://provider.example/links", captured.RequestUri!.ToString());
        Assert.Equal("Bearer", captured.Headers.Authorization?.Scheme);
        Assert.Equal("secret-token", captured.Headers.Authorization?.Parameter);
        Assert.Equal("idem-123", captured.Headers.GetValues("Idempotency-Key").Single());
        Assert.Equal("submitted", result.Status);
        Assert.Equal("pay_123", result.ProviderReference);
    }

    [Fact]
    public async Task RestEInvoiceAdapter_ShouldVerifyWebhookSignature()
    {
        var adapter = new RestEInvoiceAdapter(new HttpClient(new StubHttpMessageHandler((_, _) => throw new InvalidOperationException())));
        const string payload = "{\"event\":\"invoice.accepted\"}";
        const string timestamp = "1741501200";
        const string secret = "whsec_123";

        var secretKey = "LOOMAPOS_INTEGRATIONS_WEBHOOK_SECRET_" + adapter.ProviderCode.ToUpperInvariant().Replace("-", "_");
        var previousSecret = Environment.GetEnvironmentVariable(secretKey);
        Environment.SetEnvironmentVariable(secretKey, secret);

        try
        {
            var header = WebhookSignatureV1.BuildHeader(secret, payload, timestamp);

            var accepted = await adapter.ReceiveWebhookAsync(
                new ProviderWebhookRequest(adapter.ProviderCode, "evt_1", "invoice.accepted", header, payload),
                CancellationToken.None);
            var rejected = await adapter.ReceiveWebhookAsync(
                new ProviderWebhookRequest(adapter.ProviderCode, "evt_2", "invoice.accepted", "t=" + timestamp + ",v1=bad", payload),
                CancellationToken.None);

            Assert.True(accepted.Accepted);
            Assert.Equal("accepted", accepted.Status);
            Assert.False(rejected.Accepted);
            Assert.Equal("invalid_signature", rejected.Status);
        }
        finally
        {
            Environment.SetEnvironmentVariable(secretKey, previousSecret);
        }
    }

    [Fact]
    public async Task SmtpMessagingAdapter_ShouldValidateHostAndFromEmail()
    {
        var adapter = new SmtpMessagingAdapter();

        var invalid = await adapter.ValidateCredentialsAsync(
            new ProviderCredentialContext(
                Guid.NewGuid(),
                adapter.ProviderCode,
                "live",
                new Dictionary<string, string>(),
                new Dictionary<string, string>()),
            CancellationToken.None);

        var valid = await adapter.ValidateCredentialsAsync(
            new ProviderCredentialContext(
                Guid.NewGuid(),
                adapter.ProviderCode,
                "sandbox",
                new Dictionary<string, string>(),
                new Dictionary<string, string>
                {
                    ["smtp_host"] = "smtp.example.com",
                    ["from_email"] = "noreply@example.com"
                }),
            CancellationToken.None);

        Assert.False(invalid.IsValid);
        Assert.True(valid.IsValid);
    }

    [Fact]
    public async Task SmtpMessagingAdapter_ShouldRequireRecipientInPayload()
    {
        var adapter = new SmtpMessagingAdapter();

        var rejected = await adapter.SubmitRecordAsync(
            new ProviderSubmissionRequest(
                Guid.NewGuid(),
                adapter.Domain,
                adapter.ProviderCode,
                "msg-1",
                "email",
                "support-1",
                "{\"subject\":\"Hello\"}"),
            CancellationToken.None);

        var queued = await adapter.SubmitRecordAsync(
            new ProviderSubmissionRequest(
                Guid.NewGuid(),
                adapter.Domain,
                adapter.ProviderCode,
                "msg-2",
                "email",
                "support-2",
                "{\"recipient\":\"owner@example.com\",\"subject\":\"Hello\",\"body\":\"World\"}"),
            CancellationToken.None);

        Assert.Equal("rejected", rejected.Status);
        Assert.Equal("queued", queued.Status);
    }

    private sealed class StubHttpMessageHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> handler) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return handler(request, cancellationToken);
        }
    }
}
