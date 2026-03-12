using LoomaPos.Application.Integrations;

namespace LoomaPos.UnitTests.Integrations;

public sealed class IntegrationPrimitivesTests
{
    [Fact]
    public void WebhookSignature_ShouldRoundTrip()
    {
        const string secret = "phase9-secret";
        const string payload = "{\"event\":\"sale.created\"}";
        const string timestamp = "1741501200";

        var header = WebhookSignatureV1.BuildHeader(secret, payload, timestamp);
        var signature = header.Split("v1=", StringSplitOptions.RemoveEmptyEntries)[1];

        Assert.True(WebhookSignatureV1.Verify(secret, payload, timestamp, signature));
    }

    [Fact]
    public void ApiScopeSet_ShouldRequireAllScopes()
    {
        var granted = new[] { "products:read", "analytics:read", "webhooks:write" };

        Assert.True(ApiScopeSet.Allows(granted, "products:read"));
        Assert.True(ApiScopeSet.Allows(granted, "products:read", "analytics:read"));
        Assert.False(ApiScopeSet.Allows(granted, "licenses:write"));
    }

    [Fact]
    public void IntegrationRetryClassifier_ShouldClassifyRetryableResponses()
    {
        Assert.Equal("retryable", IntegrationRetryClassifier.Classify(503));
        Assert.Equal("retry_later", IntegrationRetryClassifier.Classify(429));
        Assert.Equal("credential_expired", IntegrationRetryClassifier.Classify(401, credentialsExpired: true));
        Assert.Equal("rejected", IntegrationRetryClassifier.Classify(422));
        Assert.True(IntegrationRetryClassifier.ShouldRetry("retryable"));
        Assert.False(IntegrationRetryClassifier.ShouldRetry("rejected"));
    }

    [Fact]
    public void IntegrationMappingValidator_ShouldReportMissingMappings()
    {
        var missing = IntegrationMappingValidator.MissingRequiredMappings(
            availableMappingTypes: ["tax_code", "customer_account"],
            requiredMappingTypes: ["tax_code", "payment_method", "customer_account"]);

        Assert.Single(missing);
        Assert.Equal("payment_method", missing[0]);
    }
}
