namespace LoomaPos.Infrastructure.Integration;

public sealed class MockEInvoiceAdapter : IIntegrationProviderAdapter
{
    public string Domain => "einvoice";
    public string ProviderCode => "mock-einvoice";
    public string DisplayName => "Mock E-Invoice Gateway";
    public IReadOnlyList<string> SupportedModes => ["sandbox", "live"];
    public IReadOnlyList<string> SupportedCapabilities => ["authorize", "submit", "status", "webhook", "health"];

    public Task<ProviderConnectionValidationResult> ValidateCredentialsAsync(ProviderCredentialContext credentialContext, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderConnectionValidationResult(
            credentialContext.Secrets.Count > 0,
            credentialContext.Secrets.Count > 0 ? "validated" : "missing_credentials",
            credentialContext.Secrets.Count > 0 ? "Credentials accepted by mock provider." : "At least one credential is required.",
            credentialContext.Secrets.Keys.FirstOrDefault()));

    public Task<ProviderAccountInfo> FetchAccountInfoAsync(ProviderCredentialContext credentialContext, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderAccountInfo(
            AccountReference: $"EINV-{credentialContext.TenantId.ToString()[..8]}",
            DisplayName: "Mock E-Invoice Tenant",
            Environment: credentialContext.Mode,
            Metadata: new Dictionary<string, string> { ["documentType"] = "e_archive" }));

    public Task<ProviderSubmissionResult> SubmitRecordAsync(ProviderSubmissionRequest request, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderSubmissionResult(
            Status: "submitted",
            ProviderReference: $"INV-{request.IdempotencyKey[..Math.Min(12, request.IdempotencyKey.Length)]}",
            Message: "Document queued by mock provider.",
            PayloadJson: request.PayloadJson));

    public Task<ProviderStatusResult> FetchStatusAsync(ProviderStatusRequest request, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderStatusResult(
            Status: "accepted",
            ProviderReference: request.ExternalReference,
            Message: "Document accepted by mock provider."));

    public Task<ProviderWebhookResult> ReceiveWebhookAsync(ProviderWebhookRequest request, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderWebhookResult(
            Accepted: true,
            Status: "accepted",
            Message: "Mock e-invoice callback accepted.",
            ProviderReference: request.EventKey));

    public Task<ProviderHealthResult> HealthCheckAsync(ProviderCredentialContext credentialContext, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderHealthResult("healthy", "Mock e-invoice provider is available.", DateTimeOffset.UtcNow));
}

public sealed class MockFiscalAdapter : IIntegrationProviderAdapter
{
    public string Domain => "fiscal";
    public string ProviderCode => "mock-fiscal";
    public string DisplayName => "Mock Fiscal Bridge";
    public IReadOnlyList<string> SupportedModes => ["sandbox", "live"];
    public IReadOnlyList<string> SupportedCapabilities => ["authorize", "submit", "status", "health"];

    public Task<ProviderConnectionValidationResult> ValidateCredentialsAsync(ProviderCredentialContext credentialContext, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderConnectionValidationResult(true, "validated", "Fiscal bridge is reachable."));

    public Task<ProviderAccountInfo> FetchAccountInfoAsync(ProviderCredentialContext credentialContext, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderAccountInfo(
            AccountReference: $"FISC-{credentialContext.TenantId.ToString()[..8]}",
            DisplayName: "Mock Fiscal Device Group",
            Environment: credentialContext.Mode));

    public Task<ProviderSubmissionResult> SubmitRecordAsync(ProviderSubmissionRequest request, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderSubmissionResult(
            Status: "queued",
            ProviderReference: $"FISC-{request.IdempotencyKey[..Math.Min(10, request.IdempotencyKey.Length)]}",
            Message: "Fiscal command queued.",
            PayloadJson: request.PayloadJson));

    public Task<ProviderStatusResult> FetchStatusAsync(ProviderStatusRequest request, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderStatusResult("connected", request.ExternalReference, "Fiscal bridge is connected."));

    public Task<ProviderWebhookResult> ReceiveWebhookAsync(ProviderWebhookRequest request, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderWebhookResult(true, "accepted", "Fiscal callback accepted.", ProviderReference: request.EventKey));

    public Task<ProviderHealthResult> HealthCheckAsync(ProviderCredentialContext credentialContext, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderHealthResult("healthy", "Mock fiscal bridge is healthy.", DateTimeOffset.UtcNow));
}

public sealed class MockCollectionAdapter : IIntegrationProviderAdapter
{
    public string Domain => "collections";
    public string ProviderCode => "mock-collection";
    public string DisplayName => "Mock Payment Collection";
    public IReadOnlyList<string> SupportedModes => ["sandbox", "live"];
    public IReadOnlyList<string> SupportedCapabilities => ["authorize", "submit", "status", "webhook", "health", "payment_link"];

    public Task<ProviderConnectionValidationResult> ValidateCredentialsAsync(ProviderCredentialContext credentialContext, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderConnectionValidationResult(true, "validated", "Collection gateway credentials accepted."));

    public Task<ProviderAccountInfo> FetchAccountInfoAsync(ProviderCredentialContext credentialContext, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderAccountInfo($"COL-{credentialContext.TenantId.ToString()[..8]}", "Mock Collection Merchant", credentialContext.Mode));

    public Task<ProviderSubmissionResult> SubmitRecordAsync(ProviderSubmissionRequest request, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderSubmissionResult("submitted", $"PAY-{request.IdempotencyKey[..Math.Min(10, request.IdempotencyKey.Length)]}", "Payment link created.", request.PayloadJson));

    public Task<ProviderStatusResult> FetchStatusAsync(ProviderStatusRequest request, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderStatusResult("paid", request.ExternalReference, "Payment completed."));

    public Task<ProviderWebhookResult> ReceiveWebhookAsync(ProviderWebhookRequest request, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderWebhookResult(true, "accepted", "Collection callback accepted.", ProviderReference: request.EventKey));

    public Task<ProviderHealthResult> HealthCheckAsync(ProviderCredentialContext credentialContext, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderHealthResult("healthy", "Mock collection provider is available.", DateTimeOffset.UtcNow));
}

public sealed class MockAccountingAdapter : IIntegrationProviderAdapter
{
    public string Domain => "accounting";
    public string ProviderCode => "mock-accounting";
    public string DisplayName => "Mock Accounting / ERP";
    public IReadOnlyList<string> SupportedModes => ["sandbox", "live"];
    public IReadOnlyList<string> SupportedCapabilities => ["authorize", "submit", "status", "health", "mapping"];

    public Task<ProviderConnectionValidationResult> ValidateCredentialsAsync(ProviderCredentialContext credentialContext, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderConnectionValidationResult(true, "validated", "Accounting credentials accepted."));

    public Task<ProviderAccountInfo> FetchAccountInfoAsync(ProviderCredentialContext credentialContext, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderAccountInfo($"ERP-{credentialContext.TenantId.ToString()[..8]}", "Mock ERP Company", credentialContext.Mode));

    public Task<ProviderSubmissionResult> SubmitRecordAsync(ProviderSubmissionRequest request, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderSubmissionResult("queued", $"ERP-{request.IdempotencyKey[..Math.Min(10, request.IdempotencyKey.Length)]}", "Accounting export queued.", request.PayloadJson));

    public Task<ProviderStatusResult> FetchStatusAsync(ProviderStatusRequest request, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderStatusResult("synced", request.ExternalReference, "Accounting record synced."));

    public Task<ProviderWebhookResult> ReceiveWebhookAsync(ProviderWebhookRequest request, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderWebhookResult(true, "accepted", "Accounting callback accepted.", ProviderReference: request.EventKey));

    public Task<ProviderHealthResult> HealthCheckAsync(ProviderCredentialContext credentialContext, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderHealthResult("healthy", "Mock accounting provider is healthy.", DateTimeOffset.UtcNow));
}

public sealed class MockEcommerceAdapter : IIntegrationProviderAdapter
{
    public string Domain => "ecommerce";
    public string ProviderCode => "mock-ecommerce";
    public string DisplayName => "Mock Marketplace Connector";
    public IReadOnlyList<string> SupportedModes => ["sandbox", "live"];
    public IReadOnlyList<string> SupportedCapabilities => ["authorize", "submit", "status", "health", "mapping", "webhook"];

    public Task<ProviderConnectionValidationResult> ValidateCredentialsAsync(ProviderCredentialContext credentialContext, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderConnectionValidationResult(true, "validated", "Marketplace credentials accepted."));

    public Task<ProviderAccountInfo> FetchAccountInfoAsync(ProviderCredentialContext credentialContext, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderAccountInfo($"ECM-{credentialContext.TenantId.ToString()[..8]}", "Mock Ecommerce Store", credentialContext.Mode));

    public Task<ProviderSubmissionResult> SubmitRecordAsync(ProviderSubmissionRequest request, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderSubmissionResult("queued", $"ORD-{request.IdempotencyKey[..Math.Min(10, request.IdempotencyKey.Length)]}", "E-commerce sync queued.", request.PayloadJson));

    public Task<ProviderStatusResult> FetchStatusAsync(ProviderStatusRequest request, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderStatusResult("synced", request.ExternalReference, "Marketplace item synced."));

    public Task<ProviderWebhookResult> ReceiveWebhookAsync(ProviderWebhookRequest request, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderWebhookResult(true, "accepted", "Marketplace webhook accepted.", ProviderReference: request.EventKey));

    public Task<ProviderHealthResult> HealthCheckAsync(ProviderCredentialContext credentialContext, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderHealthResult("healthy", "Mock ecommerce provider is healthy.", DateTimeOffset.UtcNow));
}

public sealed class MockMessagingAdapter : IIntegrationProviderAdapter
{
    public string Domain => "messaging";
    public string ProviderCode => "mock-messaging";
    public string DisplayName => "Mock Messaging Hub";
    public IReadOnlyList<string> SupportedModes => ["sandbox", "live"];
    public IReadOnlyList<string> SupportedCapabilities => ["authorize", "submit", "status", "health"];

    public Task<ProviderConnectionValidationResult> ValidateCredentialsAsync(ProviderCredentialContext credentialContext, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderConnectionValidationResult(true, "validated", "Messaging credentials accepted."));

    public Task<ProviderAccountInfo> FetchAccountInfoAsync(ProviderCredentialContext credentialContext, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderAccountInfo($"MSG-{credentialContext.TenantId.ToString()[..8]}", "Mock Messaging Sender", credentialContext.Mode));

    public Task<ProviderSubmissionResult> SubmitRecordAsync(ProviderSubmissionRequest request, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderSubmissionResult("queued", $"MSG-{request.IdempotencyKey[..Math.Min(10, request.IdempotencyKey.Length)]}", "Message queued.", request.PayloadJson));

    public Task<ProviderStatusResult> FetchStatusAsync(ProviderStatusRequest request, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderStatusResult("delivered", request.ExternalReference, "Message delivered."));

    public Task<ProviderWebhookResult> ReceiveWebhookAsync(ProviderWebhookRequest request, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderWebhookResult(true, "accepted", "Messaging callback accepted.", ProviderReference: request.EventKey));

    public Task<ProviderHealthResult> HealthCheckAsync(ProviderCredentialContext credentialContext, CancellationToken cancellationToken)
        => Task.FromResult(new ProviderHealthResult("healthy", "Mock messaging provider is healthy.", DateTimeOffset.UtcNow));
}

public interface IIntegrationProviderRegistry
{
    IReadOnlyList<IIntegrationProviderAdapter> GetCatalog();
    IIntegrationProviderAdapter? Find(string domain, string providerCode);
    IReadOnlyList<IIntegrationProviderAdapter> FindByDomain(string domain);
}

public sealed class IntegrationProviderRegistry : IIntegrationProviderRegistry
{
    private readonly IReadOnlyList<IIntegrationProviderAdapter> _adapters;

    public IntegrationProviderRegistry(IEnumerable<IIntegrationProviderAdapter> adapters)
    {
        _adapters = adapters.OrderBy(x => x.Domain).ThenBy(x => x.DisplayName).ToArray();
    }

    public IReadOnlyList<IIntegrationProviderAdapter> GetCatalog() => _adapters;

    public IIntegrationProviderAdapter? Find(string domain, string providerCode)
    {
        return _adapters.FirstOrDefault(x =>
            string.Equals(x.Domain, domain, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(x.ProviderCode, providerCode, StringComparison.OrdinalIgnoreCase));
    }

    public IReadOnlyList<IIntegrationProviderAdapter> FindByDomain(string domain)
    {
        return _adapters.Where(x => string.Equals(x.Domain, domain, StringComparison.OrdinalIgnoreCase)).ToArray();
    }
}
