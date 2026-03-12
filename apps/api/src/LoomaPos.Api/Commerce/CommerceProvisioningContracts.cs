namespace LoomaPos.Api.Commerce;

public sealed record CreateCheckoutSessionCommand(
    string PlanCode,
    string BillingPeriod,
    string FullName,
    string CompanyName,
    string Email,
    string Password,
    string? Phone,
    string BillingTitle,
    string BillingEmail,
    string? TaxOffice,
    string? TaxNumber,
    string? AddressLine,
    string? City,
    string Country,
    string Locale,
    string PaymentMethod,
    string Provider,
    string? ResellerCode,
    string? CouponCode,
    string SuccessUrl,
    string CancelUrl);

public sealed record CheckoutStatusSnapshot(
    Guid CheckoutSessionId,
    string CheckoutReference,
    string CompanyName,
    string PlanCode,
    string BillingPeriod,
    string Status,
    string PaymentStatus,
    string Provider,
    string? ProviderSessionId,
    string? ProviderPaymentReference,
    decimal Amount,
    decimal TaxAmount,
    string Currency,
    Guid? TenantId,
    Guid? CustomerAccountId,
    Guid? SubscriptionId,
    string? InvoiceNo,
    string? LicenseKey,
    string? LicenseToken,
    string? LicenseStatus,
    DateTimeOffset? LicenseExpiresAt,
    IReadOnlyList<DownloadAssetSnapshot> Downloads);

public sealed record DownloadAssetSnapshot(
    Guid AssetId,
    Guid ReleaseId,
    string Platform,
    string Title,
    string Version,
    DateOnly ReleaseDate,
    string Visibility,
    string DownloadUrl,
    string ReleaseNotesMarkdown,
    string InstallGuideMarkdown,
    string MinimumRequirements);

public sealed record ReferralValidationSnapshot(
    bool IsValid,
    string? Code,
    string? ResellerName,
    decimal CommissionRate);
