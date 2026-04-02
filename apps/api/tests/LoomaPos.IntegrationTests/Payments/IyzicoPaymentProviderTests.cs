using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using LoomaPos.Infrastructure.Payments;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace LoomaPos.IntegrationTests.Payments;

public sealed class IyzicoPaymentProviderTests
{
    [Fact]
    public async Task CreateCheckoutSessionAsync_WhenProviderReturnsSuccess_ReturnsActionableCheckoutPayload()
    {
        var capturedAuthorization = string.Empty;
        var capturedBody = string.Empty;
        var handler = new StubHttpMessageHandler(async request =>
        {
            capturedAuthorization = request.Headers.TryGetValues("Authorization", out var authorizationValues)
                ? authorizationValues.FirstOrDefault() ?? string.Empty
                : string.Empty;
            capturedBody = await request.Content!.ReadAsStringAsync();
            Assert.Equal(HttpMethod.Post, request.Method);
            Assert.Contains("/payment/iyzipos/checkoutform/initialize/auth/ecom", request.RequestUri!.AbsolutePath);

            var json = """
                {
                  "status": "success",
                  "token": "token-42",
                  "paymentPageUrl": "https://sandbox-iyzico.example/checkout/token-42",
                  "paymentId": "pay-42"
                }
                """;
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
        });

        var provider = CreateProvider(handler);
        var result = await provider.CreateCheckoutSessionAsync(
            new PaymentCheckoutSessionRequest(
                Guid.NewGuid(),
                "iyzico",
                499,
                0,
                "TRY",
                "Starter Monthly",
                "demo.owner@loomapos.local",
                "Demo Owner",
                "https://app.loomapos.com/success?checkout=test",
                "https://app.loomapos.com/checkout?plan=starter&cycle=monthly&checkout=test",
                "monthly",
                "starter",
                null),
            CancellationToken.None);

        Assert.Equal("iyzico", result.Provider);
        Assert.Equal("token-42", result.ProviderSessionId);
        Assert.Equal("pay-42", result.ProviderPaymentReference);
        Assert.Equal("success", result.Status);
        Assert.Equal("https://sandbox-iyzico.example/checkout/token-42", result.CheckoutUrl);
        Assert.StartsWith("IYZWSv2 ", capturedAuthorization);
        Assert.Contains("\"callbackUrl\":\"https://app.loomapos.com/success?checkout=test\"", capturedBody);
    }

    [Fact]
    public async Task FetchPaymentStatusAsync_WhenPaymentSucceeded_MapsToSuccess()
    {
        var handler = new StubHttpMessageHandler(_ =>
        {
            var json = """
                {
                  "status": "success",
                  "paymentStatus": "SUCCESS",
                  "paymentId": "payment-900"
                }
                """;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            });
        });

        var provider = CreateProvider(handler);
        var result = await provider.FetchPaymentStatusAsync("token-900", CancellationToken.None);

        Assert.Equal("iyzico", result.Provider);
        Assert.Equal("payment-900", result.ProviderPaymentReference);
        Assert.Equal("success", result.Status);
    }

    [Fact]
    public async Task VerifyWebhookAsync_WhenSignatureMatches_ReturnsValid()
    {
        const string secret = "iyzico-webhook-secret";
        const string payload = "{\"eventId\":\"evt-iyzi-1\",\"paymentId\":\"payment-1\",\"status\":\"success\"}";
        var signature = BuildHexHmac(secret, payload);
        var provider = CreateProvider(new StubHttpMessageHandler(_ =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK))), secret);

        var result = await provider.VerifyWebhookAsync(
            new PaymentWebhookVerificationRequest("iyzico", payload, $"sha256={signature}"),
            CancellationToken.None);

        Assert.True(result.IsValid);
        Assert.Equal("evt-iyzi-1", result.EventId);
        Assert.Equal("payment-1", result.ProviderPaymentReference);
        Assert.Equal("success", result.Status);
    }

    [Fact]
    public async Task VerifyWebhookAsync_WhenSignatureDoesNotMatch_ReturnsInvalid()
    {
        var provider = CreateProvider(new StubHttpMessageHandler(_ =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK))), "iyzico-webhook-secret");

        var result = await provider.VerifyWebhookAsync(
            new PaymentWebhookVerificationRequest(
                "iyzico",
                "{\"eventId\":\"evt-2\",\"paymentId\":\"payment-2\",\"status\":\"success\"}",
                "sha256=invalid"),
            CancellationToken.None);

        Assert.False(result.IsValid);
        Assert.Equal("invalid signature", result.Error);
    }

    private static IyzicoPaymentProvider CreateProvider(HttpMessageHandler handler, string? webhookSecret = null)
    {
        var configValues = new Dictionary<string, string?>
        {
            ["Payments:Providers:Iyzico:ApiKey"] = "iyzi-api-key",
            ["Payments:Providers:Iyzico:SecretKey"] = "iyzi-secret-key",
            ["Payments:Providers:Iyzico:BaseUrl"] = "https://sandbox-api.iyzipay.com",
            ["Payments:Providers:Iyzico:CheckoutInitializePath"] = "/payment/iyzipos/checkoutform/initialize/auth/ecom",
            ["Payments:Providers:Iyzico:CheckoutDetailPath"] = "/payment/iyzipos/checkoutform/auth/ecom/detail",
            ["Payments:Providers:Iyzico:WebhookSecret"] = webhookSecret ?? "iyzico-webhook-secret"
        };

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(configValues)
            .Build();

        return new IyzicoPaymentProvider(
            configuration,
            new HttpClient(handler),
            NullLogger<IyzicoPaymentProvider>.Instance);
    }

    private static string BuildHexHmac(string secret, string payload)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
    }

    private sealed class StubHttpMessageHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> handler) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return handler(request);
        }
    }
}
