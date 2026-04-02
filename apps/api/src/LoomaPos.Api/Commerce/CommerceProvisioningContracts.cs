using LoomaPos.Domain.Commerce;
using LoomaPos.Domain.Identity;

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

public sealed record CheckoutSessionLaunchSnapshot(
    CheckoutStatusSnapshot Snapshot,
    string ProviderStatus,
    string? CheckoutUrl,
    bool RequiresProviderAction);

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

public static class CheckoutFlowStatusPolicy
{
    public const string Created = "created";
    public const string PendingProvider = "pending_provider";
    public const string Succeeded = "succeeded";
    public const string Failed = "failed";
    public const string Canceled = "canceled";
    public const string Expired = "expired";

    private static readonly HashSet<string> SuccessStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "paid",
        "success",
        "succeeded",
        "captured",
        "authorized",
        "completed"
    };

    private static readonly HashSet<string> FailedStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "failed",
        "failure",
        "declined",
        "error"
    };

    private static readonly HashSet<string> CanceledStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "canceled",
        "cancelled",
        "voided",
        "aborted"
    };

    private static readonly HashSet<string> ExpiredStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "expired",
        "timed_out",
        "timeout"
    };

    private static readonly Dictionary<string, string> LegacyStatusMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["pending_payment"] = Created,
        ["awaiting_confirmation"] = PendingProvider,
        ["payment_confirmed"] = Succeeded,
        ["payment_failed"] = Failed,
        ["provisioned"] = Succeeded,
        ["cancelled"] = Canceled,
        ["processing"] = PendingProvider,
        ["requires_action"] = PendingProvider
    };

    public sealed record StatusResolution(
        string CheckoutStatus,
        string PaymentStatus,
        bool IsSuccessful,
        bool IsFinal,
        string ProviderStatus);

    public static string NormalizeCheckoutStatus(string? rawStatus)
    {
        if (string.IsNullOrWhiteSpace(rawStatus))
        {
            return Created;
        }

        var normalized = rawStatus.Trim().ToLowerInvariant();
        if (LegacyStatusMap.TryGetValue(normalized, out var mapped))
        {
            normalized = mapped;
        }

        return normalized switch
        {
            Created => Created,
            PendingProvider => PendingProvider,
            Succeeded => Succeeded,
            Failed => Failed,
            Canceled => Canceled,
            Expired => Expired,
            _ => PendingProvider
        };
    }

    public static string NormalizePaymentStatus(string? providerStatus)
    {
        if (string.IsNullOrWhiteSpace(providerStatus))
        {
            return PendingProvider;
        }

        var normalized = providerStatus.Trim().ToLowerInvariant();
        if (LegacyStatusMap.TryGetValue(normalized, out var mapped))
        {
            normalized = mapped;
        }

        if (SuccessStatuses.Contains(normalized))
        {
            return Succeeded;
        }

        if (FailedStatuses.Contains(normalized))
        {
            return Failed;
        }

        if (CanceledStatuses.Contains(normalized))
        {
            return Canceled;
        }

        if (ExpiredStatuses.Contains(normalized))
        {
            return Expired;
        }

        return normalized switch
        {
            Created => Created,
            PendingProvider => PendingProvider,
            Succeeded => Succeeded,
            Failed => Failed,
            Canceled => Canceled,
            Expired => Expired,
            _ => PendingProvider
        };
    }

    public static StatusResolution ResolveProviderStart(string? providerStatus)
    {
        var callbackResolution = ResolveProviderCallback(providerStatus);

        if (callbackResolution.IsSuccessful)
        {
            return new StatusResolution(
                PendingProvider,
                PendingProvider,
                IsSuccessful: false,
                IsFinal: false,
                callbackResolution.ProviderStatus);
        }

        return callbackResolution;
    }

    public static StatusResolution ResolveProviderCallback(string? providerStatus)
    {
        var normalizedProvider = NormalizePaymentStatus(providerStatus);
        return normalizedProvider switch
        {
            Succeeded => new StatusResolution(Succeeded, Succeeded, IsSuccessful: true, IsFinal: true, normalizedProvider),
            Failed => new StatusResolution(Failed, Failed, IsSuccessful: false, IsFinal: true, normalizedProvider),
            Canceled => new StatusResolution(Canceled, Canceled, IsSuccessful: false, IsFinal: true, normalizedProvider),
            Expired => new StatusResolution(Expired, Expired, IsSuccessful: false, IsFinal: true, normalizedProvider),
            Created => new StatusResolution(PendingProvider, Created, IsSuccessful: false, IsFinal: false, normalizedProvider),
            _ => new StatusResolution(PendingProvider, PendingProvider, IsSuccessful: false, IsFinal: false, normalizedProvider)
        };
    }

    public static bool ShouldProvision(string checkoutStatus)
    {
        return string.Equals(NormalizeCheckoutStatus(checkoutStatus), Succeeded, StringComparison.Ordinal);
    }

    public static bool IsFinal(string checkoutStatus)
    {
        return NormalizeCheckoutStatus(checkoutStatus) is Succeeded or Failed or Canceled or Expired;
    }
}

public static class SubscriptionLifecyclePolicy
{
    public const string TrialActive = "trial_active";
    public const string TrialExpiring = "trial_expiring";
    public const string TrialExpired = "trial_expired";
    public const string SubscriptionActive = "subscription_active";
    public const string SubscriptionPastDue = "subscription_past_due";
    public const string SubscriptionCanceled = "subscription_canceled";
    public const string SuspendedBlocked = "suspended_blocked";

    private static readonly Dictionary<string, string> LegacyStateMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["trial"] = TrialActive,
        ["trialing"] = TrialActive,
        ["trial_active"] = TrialActive,
        ["active_trial"] = TrialActive,
        ["trial_expiring"] = TrialExpiring,
        ["trial_expiring_soon"] = TrialExpiring,
        ["trial_expired"] = TrialExpired,
        ["trial_expired_read_only"] = TrialExpired,
        ["read_only"] = TrialExpired,
        ["read-only"] = TrialExpired,
        ["active"] = SubscriptionActive,
        ["paid_active"] = SubscriptionActive,
        ["past_due"] = SubscriptionPastDue,
        ["subscription_past_due"] = SubscriptionPastDue,
        ["canceled"] = SubscriptionCanceled,
        ["cancelled"] = SubscriptionCanceled,
        ["subscription_canceled"] = SubscriptionCanceled,
        ["suspended"] = SuspendedBlocked,
        ["blocked"] = SuspendedBlocked,
        ["revoked"] = SuspendedBlocked,
        ["suspended_blocked"] = SuspendedBlocked
    };

    private static readonly Dictionary<string, HashSet<string>> AllowedTransitions = new(StringComparer.Ordinal)
    {
        [TrialActive] = new HashSet<string>(StringComparer.Ordinal)
        {
            TrialExpiring,
            TrialExpired,
            SubscriptionActive,
            SubscriptionCanceled,
            SuspendedBlocked
        },
        [TrialExpiring] = new HashSet<string>(StringComparer.Ordinal)
        {
            TrialExpired,
            SubscriptionActive,
            SubscriptionCanceled,
            SuspendedBlocked
        },
        [TrialExpired] = new HashSet<string>(StringComparer.Ordinal)
        {
            SubscriptionActive,
            SubscriptionCanceled,
            SuspendedBlocked
        },
        [SubscriptionActive] = new HashSet<string>(StringComparer.Ordinal)
        {
            SubscriptionPastDue,
            SubscriptionCanceled,
            SuspendedBlocked
        },
        [SubscriptionPastDue] = new HashSet<string>(StringComparer.Ordinal)
        {
            SubscriptionActive,
            SuspendedBlocked,
            SubscriptionCanceled
        },
        [SubscriptionCanceled] = new HashSet<string>(StringComparer.Ordinal)
        {
            SubscriptionActive,
            SuspendedBlocked
        },
        [SuspendedBlocked] = new HashSet<string>(StringComparer.Ordinal)
        {
            SubscriptionActive,
            SubscriptionPastDue,
            SubscriptionCanceled,
            TrialActive,
            TrialExpiring,
            TrialExpired
        }
    };

    public sealed record Descriptor(
        string State,
        string Label,
        string Message,
        IReadOnlyList<string> AllowedActions,
        IReadOnlyList<string> BlockedActions,
        bool CanCheckout,
        bool CanWrite,
        bool CanSync,
        bool CanView,
        bool RequiresUpgradeAction,
        bool RequiresBlock,
        bool AllowsOperationalWrites,
        bool AllowsDeviceActivation,
        bool AllowsSyncWrites);

    public static string NormalizeState(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return SubscriptionActive;
        }

        var normalized = raw.Trim().ToLowerInvariant();
        return LegacyStateMap.TryGetValue(normalized, out var mapped)
            ? mapped
            : SubscriptionActive;
    }

    public static bool IsValidTransition(string fromState, string toState)
    {
        var normalizedFrom = NormalizeState(fromState);
        var normalizedTo = NormalizeState(toState);

        if (normalizedFrom == normalizedTo)
        {
            return true;
        }

        return AllowedTransitions.TryGetValue(normalizedFrom, out var allowed)
               && allowed.Contains(normalizedTo);
    }

    public static Descriptor Describe(string state)
    {
        var normalized = NormalizeState(state);
        return normalized switch
        {
            TrialActive => new Descriptor(
                TrialActive,
                "Deneme aktif",
                "Deneme suresi aktif. Operasyon yazma islemleri acik.",
                ["Desktop satis", "Mobil operasyon", "Cihaz aktivasyonu", "Senkron yazma"],
                ["-"],
                CanCheckout: true,
                CanWrite: true,
                CanSync: true,
                CanView: true,
                RequiresUpgradeAction: false,
                RequiresBlock: false,
                AllowsOperationalWrites: true,
                AllowsDeviceActivation: true,
                AllowsSyncWrites: true),
            TrialExpiring => new Descriptor(
                TrialExpiring,
                "Deneme bitmek uzere",
                "Deneme suresi kritik seviyede. Operasyon devam eder ancak plan secimi yapilmalidir.",
                ["Desktop satis", "Mobil operasyon", "Cihaz aktivasyonu", "Senkron yazma"],
                ["-"],
                CanCheckout: true,
                CanWrite: true,
                CanSync: true,
                CanView: true,
                RequiresUpgradeAction: true,
                RequiresBlock: false,
                AllowsOperationalWrites: true,
                AllowsDeviceActivation: true,
                AllowsSyncWrites: true),
            TrialExpired => new Descriptor(
                TrialExpired,
                "Deneme bitti / salt-okunur",
                "Deneme suresi doldu. Yazma islemleri kapali, yalnizca goruntuleme acik.",
                ["Rapor goruntuleme", "Durum izleme"],
                ["Desktop satis", "Stok mutasyonu", "Sync push", "Yeni cihaz aktivasyonu"],
                CanCheckout: false,
                CanWrite: false,
                CanSync: false,
                CanView: true,
                RequiresUpgradeAction: true,
                RequiresBlock: false,
                AllowsOperationalWrites: false,
                AllowsDeviceActivation: false,
                AllowsSyncWrites: false),
            SubscriptionPastDue => new Descriptor(
                SubscriptionPastDue,
                "Odeme gecikmis",
                "Abonelik odemesi gecikmis. Operasyon acik, yeni cihaz aktivasyonu kisitli.",
                ["Desktop satis", "Mobil operasyon", "Senkron yazma"],
                ["Yeni cihaz aktivasyonu"],
                CanCheckout: true,
                CanWrite: true,
                CanSync: true,
                CanView: true,
                RequiresUpgradeAction: true,
                RequiresBlock: false,
                AllowsOperationalWrites: true,
                AllowsDeviceActivation: false,
                AllowsSyncWrites: true),
            SubscriptionCanceled => new Descriptor(
                SubscriptionCanceled,
                "Abonelik iptal durumunda",
                "Abonelik iptal isaretli. Donem sonuna kadar operasyon acik, yeni cihaz aktivasyonu kapali.",
                ["Desktop satis", "Mobil operasyon", "Senkron yazma"],
                ["Yeni cihaz aktivasyonu"],
                CanCheckout: true,
                CanWrite: true,
                CanSync: true,
                CanView: true,
                RequiresUpgradeAction: true,
                RequiresBlock: false,
                AllowsOperationalWrites: true,
                AllowsDeviceActivation: false,
                AllowsSyncWrites: true),
            SuspendedBlocked => new Descriptor(
                SuspendedBlocked,
                "Aski / blok",
                "Hesap bloklu. Operasyon yazma akisleri kapali.",
                ["Rapor goruntuleme", "Durum izleme"],
                ["Desktop satis", "Stok mutasyonu", "Sync push", "Cihaz aktivasyonu"],
                CanCheckout: false,
                CanWrite: false,
                CanSync: false,
                CanView: true,
                RequiresUpgradeAction: true,
                RequiresBlock: true,
                AllowsOperationalWrites: false,
                AllowsDeviceActivation: false,
                AllowsSyncWrites: false),
            _ => new Descriptor(
                SubscriptionActive,
                "Abonelik aktif",
                "Abonelik aktif. Tum operasyon akisleri acik.",
                ["Desktop satis", "Mobil operasyon", "Cihaz aktivasyonu", "Senkron yazma"],
                ["-"],
                CanCheckout: true,
                CanWrite: true,
                CanSync: true,
                CanView: true,
                RequiresUpgradeAction: false,
                RequiresBlock: false,
                AllowsOperationalWrites: true,
                AllowsDeviceActivation: true,
                AllowsSyncWrites: true)
        };
    }

    public static string ResolveState(
        Tenant? tenant,
        Subscription? subscription,
        IssuedLicense? license,
        DateTimeOffset nowUtc)
    {
        if (IsSuspendedLike(tenant?.Status) || IsSuspendedLike(license?.Status) || IsSuspendedLike(subscription?.Status))
        {
            return SuspendedBlocked;
        }

        var subscriptionStatus = NormalizeOptional(subscription?.Status);
        var hasTrial = subscription?.TrialEndsAt.HasValue == true || subscriptionStatus.Contains("trial", StringComparison.Ordinal);

        if (hasTrial)
        {
            var trialEndsAt = subscription?.TrialEndsAt;
            var expiredByDate = trialEndsAt.HasValue && trialEndsAt.Value <= nowUtc;
            var expiredByStatus = subscriptionStatus.Contains("expired", StringComparison.Ordinal)
                                  || subscriptionStatus.Contains("read_only", StringComparison.Ordinal)
                                  || subscriptionStatus.Contains("read-only", StringComparison.Ordinal);
            var expiredByLicense = IsTrialExpiredLike(license?.Status, license?.ExpiresAt, nowUtc);
            if (expiredByDate || expiredByStatus || expiredByLicense)
            {
                return TrialExpired;
            }

            if (trialEndsAt.HasValue)
            {
                var remainingDays = Math.Max(0, (int)Math.Ceiling((trialEndsAt.Value - nowUtc).TotalDays));
                if (remainingDays <= 3)
                {
                    return TrialExpiring;
                }
            }

            return TrialActive;
        }

        if (subscriptionStatus.Contains("past_due", StringComparison.Ordinal)
            || subscriptionStatus.Contains("past-due", StringComparison.Ordinal))
        {
            return SubscriptionPastDue;
        }

        var canceledLike = subscriptionStatus.Contains("canceled", StringComparison.Ordinal)
                           || subscriptionStatus.Contains("cancelled", StringComparison.Ordinal)
                           || (subscription?.CancelAtPeriodEnd ?? false);
        if (canceledLike)
        {
            return SubscriptionCanceled;
        }

        return SubscriptionActive;
    }

    private static bool IsTrialExpiredLike(string? licenseStatus, DateTimeOffset? expiresAt, DateTimeOffset nowUtc)
    {
        var normalizedLicense = NormalizeOptional(licenseStatus);
        if (normalizedLicense.Contains("expired", StringComparison.Ordinal)
            || normalizedLicense.Contains("read_only", StringComparison.Ordinal)
            || normalizedLicense.Contains("read-only", StringComparison.Ordinal))
        {
            return true;
        }

        return expiresAt.HasValue && expiresAt.Value <= nowUtc;
    }

    private static bool IsSuspendedLike(string? status)
    {
        var normalized = NormalizeOptional(status);
        return normalized.Contains("suspend", StringComparison.Ordinal)
               || normalized.Contains("block", StringComparison.Ordinal)
               || normalized.Contains("revok", StringComparison.Ordinal)
               || normalized.Contains("invalid", StringComparison.Ordinal);
    }

    private static string NormalizeOptional(string? value) => (value ?? string.Empty).Trim().ToLowerInvariant();
}
