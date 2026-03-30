using System.Text.Json;
using LoomaPos.Domain.Auditing;
using LoomaPos.Domain.Commerce;
using LoomaPos.Domain.Identity;
using LoomaPos.Infrastructure.Payments;
using LoomaPos.Infrastructure.Inventory;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Commerce;

internal sealed record CheckoutIdentityPayload(
    string FullName,
    string Email,
    string PasswordHash,
    string? Phone);

internal sealed record CheckoutBillingPayload(
    string BillingTitle,
    string BillingEmail,
    string? TaxOffice,
    string? TaxNumber,
    string? AddressLine,
    string? City,
    string Country,
    string Locale,
    string PaymentMethod);

public interface ICommerceProvisioningService
{
    Task<CheckoutStatusSnapshot> CreateCheckoutSessionAsync(
        CreateCheckoutSessionCommand command,
        CancellationToken cancellationToken);

    Task<CheckoutStatusSnapshot?> GetCheckoutStatusAsync(
        Guid checkoutSessionId,
        CancellationToken cancellationToken);

    Task<CheckoutStatusSnapshot?> ProcessPaymentWebhookAsync(
        string providerCode,
        string eventId,
        string payloadJson,
        string? providerPaymentReference,
        string paymentStatus,
        CancellationToken cancellationToken);

    Task<ReferralValidationSnapshot> ValidateReferralAsync(string? code, CancellationToken cancellationToken);
}

public sealed class CommerceProvisioningService : ICommerceProvisioningService
{
    private readonly AppDbContext _dbContext;
    private readonly IPaymentProviderResolver _paymentProviderResolver;
    private readonly IPortalCryptoService _cryptoService;
    private readonly ILicenseArtifactService _licenseArtifactService;
    private readonly IEmailTemplateService _emailTemplateService;
    private readonly IConfiguration _configuration;
    private readonly IWarehouseCompatibilityService _warehouseCompatibilityService;

    public CommerceProvisioningService(
        AppDbContext dbContext,
        IPaymentProviderResolver paymentProviderResolver,
        IPortalCryptoService cryptoService,
        ILicenseArtifactService licenseArtifactService,
        IEmailTemplateService emailTemplateService,
        IConfiguration configuration,
        IWarehouseCompatibilityService warehouseCompatibilityService)
    {
        _dbContext = dbContext;
        _paymentProviderResolver = paymentProviderResolver;
        _cryptoService = cryptoService;
        _licenseArtifactService = licenseArtifactService;
        _emailTemplateService = emailTemplateService;
        _configuration = configuration;
        _warehouseCompatibilityService = warehouseCompatibilityService;
    }

    public async Task<CheckoutStatusSnapshot> CreateCheckoutSessionAsync(
        CreateCheckoutSessionCommand command,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = command.Email.Trim().ToLowerInvariant();
        var normalizedBillingEmail = string.IsNullOrWhiteSpace(command.BillingEmail)
            ? normalizedEmail
            : command.BillingEmail.Trim().ToLowerInvariant();
        var billingPeriod = NormalizeBillingPeriod(command.BillingPeriod);
        var providerCode = NormalizeCode(command.Provider, "mock");

        var plan = await _dbContext.SubscriptionPlans
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Code == NormalizeCode(command.PlanCode, "starter") && x.IsActive, cancellationToken)
            ?? throw new InvalidOperationException("Gecersiz plan secimi.");

        var price = await _dbContext.PlanPrices
            .AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.SubscriptionPlanId == plan.Id &&
                x.BillingPeriod == billingPeriod &&
                x.IsActive,
                cancellationToken)
            ?? throw new InvalidOperationException("Secilen plan icin fiyat bulunamadi.");

        var existingAccount = await _dbContext.CustomerAccounts
            .FirstOrDefaultAsync(x => x.Email == normalizedEmail, cancellationToken);
        if (existingAccount is not null && !_cryptoService.VerifyPassword(existingAccount.PasswordHash, command.Password))
        {
            throw new InvalidOperationException("Bu e-posta adresiyle kayitli musteri hesabi mevcut.");
        }

        var referral = await ResolveReferralAsync(command.ResellerCode, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var checkoutSession = new CheckoutSession
        {
            CustomerAccountId = existingAccount?.Id,
            CheckoutReference = _cryptoService.BuildCheckoutReference(now),
            CompanyName = command.CompanyName.Trim(),
            ContactName = command.FullName.Trim(),
            Email = normalizedEmail,
            Phone = NormalizeOptional(command.Phone),
            PlanCode = plan.Code,
            BillingCycle = billingPeriod,
            Provider = providerCode,
            ResellerCode = referral?.Code,
            CouponCode = NormalizeOptional(command.CouponCode),
            Amount = price.PromoAmount ?? price.Amount,
            TaxAmount = 0,
            Currency = price.Currency,
            Status = "pending_payment",
            PaymentStatus = "pending",
            CheckoutPayloadJson = JsonSerializer.Serialize(new CheckoutIdentityPayload(
                command.FullName.Trim(),
                normalizedEmail,
                existingAccount?.PasswordHash ?? _cryptoService.HashPassword(command.Password),
                NormalizeOptional(command.Phone))),
            BillingPayloadJson = JsonSerializer.Serialize(new CheckoutBillingPayload(
                command.BillingTitle.Trim(),
                normalizedBillingEmail,
                NormalizeOptional(command.TaxOffice),
                NormalizeOptional(command.TaxNumber),
                NormalizeOptional(command.AddressLine),
                NormalizeOptional(command.City),
                NormalizeCode(command.Country, "tr"),
                string.IsNullOrWhiteSpace(command.Locale) ? "tr-TR" : command.Locale.Trim(),
                NormalizeCode(command.PaymentMethod, "card")))
        };

        _dbContext.CheckoutSessions.Add(checkoutSession);
        await _dbContext.SaveChangesAsync(cancellationToken);

        if (referral is not null)
        {
            _dbContext.ResellerReferrals.Add(new ResellerReferral
            {
                ResellerAccountId = referral.Id,
                CheckoutSessionId = checkoutSession.Id,
                ReferralCode = referral.Code,
                Status = "attached",
                CommissionEligible = true
            });
        }

        _dbContext.PaymentAttempts.Add(new PaymentAttempt
        {
            CheckoutSessionId = checkoutSession.Id,
            Provider = providerCode,
            Status = "created",
            MetadataJson = JsonSerializer.Serialize(new
            {
                plan.Code,
                billingPeriod
            })
        });
        await _dbContext.SaveChangesAsync(cancellationToken);

        var provider = _paymentProviderResolver.Resolve(providerCode);
        EnsureProviderAllowed(providerCode, provider);
        var checkoutResult = await provider.CreateCheckoutSessionAsync(
            new PaymentCheckoutSessionRequest(
                checkoutSession.Id,
                providerCode,
                checkoutSession.Amount,
                checkoutSession.TaxAmount,
                checkoutSession.Currency,
                $"{plan.Name} ({billingPeriod}) subscription",
                normalizedEmail,
                command.FullName.Trim(),
                command.SuccessUrl,
                command.CancelUrl,
                billingPeriod,
                plan.Code,
                existingAccount is null ? null : provider.GetProviderCustomerReference(existingAccount.Email)),
            cancellationToken);

        checkoutSession.ProviderSessionId = checkoutResult.ProviderSessionId;
        checkoutSession.ProviderPaymentReference = checkoutResult.ProviderPaymentReference;
        checkoutSession.PaymentStatus = checkoutResult.Status;
        checkoutSession.Status = checkoutResult.Status == "paid" ? "payment_confirmed" : "awaiting_confirmation";
        await _dbContext.SaveChangesAsync(cancellationToken);

        if (checkoutResult.Status == "paid")
        {
            await ProcessPaymentWebhookAsync(
                providerCode,
                $"auto-{checkoutSession.Id:N}",
                JsonSerializer.Serialize(new
                {
                    checkoutSessionId = checkoutSession.Id,
                    checkoutSession.ProviderPaymentReference,
                    status = checkoutResult.Status
                }),
                checkoutSession.ProviderPaymentReference,
                checkoutResult.Status,
                cancellationToken);
        }

        return await BuildCheckoutStatusAsync(checkoutSession.Id, cancellationToken)
            ?? throw new InvalidOperationException("Checkout status could not be loaded.");
    }

    public async Task<CheckoutStatusSnapshot?> GetCheckoutStatusAsync(
        Guid checkoutSessionId,
        CancellationToken cancellationToken)
    {
        return await BuildCheckoutStatusAsync(checkoutSessionId, cancellationToken);
    }

    public async Task<CheckoutStatusSnapshot?> ProcessPaymentWebhookAsync(
        string providerCode,
        string eventId,
        string payloadJson,
        string? providerPaymentReference,
        string paymentStatus,
        CancellationToken cancellationToken)
    {
        var normalizedProvider = NormalizeCode(providerCode, "mock");
        var normalizedEventId = string.IsNullOrWhiteSpace(eventId) ? Guid.NewGuid().ToString("N") : eventId.Trim();
        var existingWebhook = await _dbContext.PaymentWebhooks
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Provider == normalizedProvider && x.EventId == normalizedEventId, cancellationToken);
        if (existingWebhook is not null)
        {
            var existingSessionId = TryExtractCheckoutSessionId(existingWebhook.PayloadJson);
            return existingSessionId.HasValue
                ? await BuildCheckoutStatusAsync(existingSessionId.Value, cancellationToken)
                : null;
        }

        var checkoutSession = await ResolveCheckoutSessionForWebhookAsync(
            payloadJson,
            providerPaymentReference,
            cancellationToken);
        if (checkoutSession is null)
        {
            _dbContext.PaymentWebhooks.Add(new PaymentWebhook
            {
                Provider = normalizedProvider,
                EventId = normalizedEventId,
                PayloadJson = payloadJson,
                Status = "ignored",
                Error = "checkout session not found",
                ReceivedAt = DateTimeOffset.UtcNow,
                ProcessedAt = DateTimeOffset.UtcNow
            });
            await _dbContext.SaveChangesAsync(cancellationToken);
            return null;
        }

        _dbContext.PaymentWebhooks.Add(new PaymentWebhook
        {
            Provider = normalizedProvider,
            EventId = normalizedEventId,
            PayloadJson = payloadJson,
            Status = "processed",
            ReceivedAt = DateTimeOffset.UtcNow,
            ProcessedAt = DateTimeOffset.UtcNow
        });

        checkoutSession.PaymentStatus = NormalizeCode(paymentStatus, "paid");
        checkoutSession.Status = checkoutSession.PaymentStatus == "paid"
            ? "payment_confirmed"
            : "payment_failed";
        await _dbContext.SaveChangesAsync(cancellationToken);

        if (checkoutSession.PaymentStatus == "paid")
        {
            await ProvisionCheckoutAsync(checkoutSession, normalizedProvider, providerPaymentReference, cancellationToken);
        }

        return await BuildCheckoutStatusAsync(checkoutSession.Id, cancellationToken);
    }

    public async Task<ReferralValidationSnapshot> ValidateReferralAsync(string? code, CancellationToken cancellationToken)
    {
        var referral = await ResolveReferralAsync(code, cancellationToken);
        return referral is null
            ? new ReferralValidationSnapshot(false, null, null, 0)
            : new ReferralValidationSnapshot(true, referral.Code, referral.Name, referral.CommissionRate);
    }

    private async Task ProvisionCheckoutAsync(
        CheckoutSession checkoutSession,
        string providerCode,
        string? providerPaymentReference,
        CancellationToken cancellationToken)
    {
        if (checkoutSession.ProvisionedAt.HasValue)
        {
            return;
        }

        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        await _dbContext.Entry(checkoutSession).ReloadAsync(cancellationToken);
        if (checkoutSession.ProvisionedAt.HasValue)
        {
            await transaction.RollbackAsync(cancellationToken);
            return;
        }

        var identity = JsonSerializer.Deserialize<CheckoutIdentityPayload>(checkoutSession.CheckoutPayloadJson)
            ?? throw new InvalidOperationException("Checkout identity payload is missing.");
        var billing = JsonSerializer.Deserialize<CheckoutBillingPayload>(checkoutSession.BillingPayloadJson)
            ?? throw new InvalidOperationException("Checkout billing payload is missing.");

        var account = await _dbContext.CustomerAccounts
            .FirstOrDefaultAsync(x => x.Email == checkoutSession.Email, cancellationToken);
        if (account is null)
        {
            account = new CustomerAccount
            {
                Email = checkoutSession.Email,
                PasswordHash = identity.PasswordHash,
                FullName = identity.FullName,
                Phone = identity.Phone,
                AccountStatus = "active"
            };
            _dbContext.CustomerAccounts.Add(account);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        else
        {
            account.FullName = identity.FullName;
            account.Phone = identity.Phone;
            if (string.IsNullOrWhiteSpace(account.PasswordHash))
            {
                account.PasswordHash = identity.PasswordHash;
            }
        }

        var tenantUser = await _dbContext.TenantUsers
            .FirstOrDefaultAsync(x => x.CustomerAccountId == account.Id && x.Status == "active", cancellationToken);
        Tenant tenant;
        if (tenantUser is not null)
        {
            tenant = await _dbContext.Tenants.FirstAsync(x => x.Id == tenantUser.TenantId, cancellationToken);
        }
        else
        {
            tenant = new Tenant
            {
                Name = checkoutSession.CompanyName,
                TenantCode = _cryptoService.BuildTenantCode(checkoutSession.CompanyName),
                BillingEmail = billing.BillingEmail,
                TaxOffice = billing.TaxOffice,
                TaxNumber = billing.TaxNumber,
                Country = billing.Country.ToUpperInvariant(),
                DefaultLocale = billing.Locale,
                Status = "active",
                SettingsJson = JsonSerializer.Serialize(new
                {
                    commercialWebsite = true,
                    websiteCannotRunPos = true
                })
            };
            _dbContext.Tenants.Add(tenant);
            await _dbContext.SaveChangesAsync(cancellationToken);

            tenantUser = new TenantUser
            {
                TenantId = tenant.Id,
                CustomerAccountId = account.Id,
                RoleCode = "tenant_owner",
                IsOwner = true,
                Status = "active"
            };
            _dbContext.TenantUsers.Add(tenantUser);
        }

        await _warehouseCompatibilityService.EnsureDefaultWarehouseAsync(tenant.Id, cancellationToken);

        var plan = await _dbContext.SubscriptionPlans
            .AsNoTracking()
            .FirstAsync(x => x.Code == checkoutSession.PlanCode, cancellationToken);
        var planPrice = await _dbContext.PlanPrices
            .AsNoTracking()
            .FirstAsync(x => x.SubscriptionPlanId == plan.Id && x.BillingPeriod == checkoutSession.BillingCycle && x.IsActive, cancellationToken);
        var featureFlags = await (
            from planFeature in _dbContext.PlanFeatureFlags.AsNoTracking()
            join featureFlag in _dbContext.FeatureFlags.AsNoTracking() on planFeature.FeatureFlagId equals featureFlag.Id
            where planFeature.SubscriptionPlanId == plan.Id && planFeature.IsEnabled && featureFlag.IsActive
            select featureFlag.Code
        ).ToListAsync(cancellationToken);

        var billingProfile = await _dbContext.BillingProfiles
            .FirstOrDefaultAsync(x => x.TenantId == tenant.Id, cancellationToken);
        if (billingProfile is null)
        {
            billingProfile = new BillingProfile
            {
                TenantId = tenant.Id,
                CustomerAccountId = account.Id,
                CompanyName = billing.BillingTitle,
                BillingEmail = billing.BillingEmail,
                Phone = identity.Phone,
                TaxOffice = billing.TaxOffice,
                TaxNumber = billing.TaxNumber,
                AddressLine = billing.AddressLine,
                City = billing.City,
                Country = billing.Country.ToUpperInvariant(),
                Locale = billing.Locale,
                Status = "active"
            };
            _dbContext.BillingProfiles.Add(billingProfile);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        var now = DateTimeOffset.UtcNow;
        var renewalDate = checkoutSession.BillingCycle == "yearly" ? now.AddYears(1) : now.AddMonths(1);
        var planSnapshotJson = JsonSerializer.Serialize(new
        {
            plan.Code,
            plan.Name,
            plan.BranchLimit,
            plan.UserLimit,
            plan.DeviceLimit,
            plan.SupportTier,
            featureFlags,
            price = planPrice.Amount,
            promoPrice = planPrice.PromoAmount
        });

        var provider = _paymentProviderResolver.Resolve(providerCode);
        var providerSubscription = await provider.CreateRecurringSubscriptionAsync(
            new ProviderSubscriptionRequest(
                Guid.NewGuid(),
                providerCode,
                plan.Code,
                checkoutSession.BillingCycle,
                checkoutSession.Amount,
                checkoutSession.Currency,
                provider.GetProviderCustomerReference(account.Email)),
            cancellationToken);

        var subscription = new Subscription
        {
            TenantId = tenant.Id,
            BillingProfileId = billingProfile.Id,
            PlanCode = plan.Code,
            BillingCycle = checkoutSession.BillingCycle,
            Status = "active",
            CurrentPeriodStart = now,
            CurrentPeriodEnd = renewalDate,
            RenewalDate = renewalDate,
            ProviderSubscriptionId = providerSubscription.ProviderSubscriptionId,
            ProviderCustomerReference = providerSubscription.ProviderCustomerReference,
            PlanSnapshotJson = planSnapshotJson,
            ResellerCode = checkoutSession.ResellerCode
        };
        _dbContext.Subscriptions.Add(subscription);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var invoiceId = Guid.NewGuid();
        var invoice = new Invoice
        {
            Id = invoiceId,
            TenantId = tenant.Id,
            SubscriptionId = subscription.Id,
            BillingProfileId = billingProfile.Id,
            InvoiceNo = _cryptoService.BuildInvoiceNumber(now),
            Description = $"{plan.Name} {checkoutSession.BillingCycle} abonelik",
            Subtotal = checkoutSession.Amount,
            TaxAmount = checkoutSession.TaxAmount,
            Total = checkoutSession.Amount + checkoutSession.TaxAmount,
            Currency = checkoutSession.Currency,
            Status = "paid",
            IssuedAt = now,
            DueAt = now,
            PaidAt = now,
            BillingPeriodStart = now,
            BillingPeriodEnd = renewalDate,
            ProviderInvoiceReference = checkoutSession.ProviderPaymentReference,
            PdfUrl = $"/commerce/portal/billing/{invoiceId}/pdf"
        };
        _dbContext.Invoices.Add(invoice);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _dbContext.InvoiceLines.Add(new InvoiceLine
        {
            TenantId = tenant.Id,
            InvoiceId = invoice.Id,
            Description = invoice.Description,
            Quantity = 1,
            UnitAmount = checkoutSession.Amount,
            TaxAmount = checkoutSession.TaxAmount,
            TotalAmount = invoice.Total
        });

        var paymentTransaction = new PaymentTransaction
        {
            TenantId = tenant.Id,
            SubscriptionId = subscription.Id,
            InvoiceId = invoice.Id,
            CheckoutSessionId = checkoutSession.Id,
            Provider = providerCode,
            ProviderPaymentId = providerPaymentReference ?? checkoutSession.ProviderPaymentReference ?? checkoutSession.CheckoutReference,
            ProviderCustomerReference = providerSubscription.ProviderCustomerReference,
            Amount = checkoutSession.Amount,
            TaxAmount = checkoutSession.TaxAmount,
            Currency = checkoutSession.Currency,
            Status = "paid",
            PaymentMethodSummary = NormalizeCode(billing.PaymentMethod, "card"),
            MetadataJson = JsonSerializer.Serialize(new
            {
                checkoutSessionId = checkoutSession.Id,
                invoice.InvoiceNo
            }),
            PaidAt = now
        };
        _dbContext.PaymentTransactions.Add(paymentTransaction);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var licenseKey = _cryptoService.BuildLicenseKey();
        var artifact = _licenseArtifactService.CreateArtifact(
            tenant.Id,
            subscription.Id,
            plan.Code,
            plan.DeviceLimit,
            featureFlags,
            now,
            renewalDate,
            licenseKey);

        var license = new IssuedLicense
        {
            TenantId = tenant.Id,
            SubscriptionId = subscription.Id,
            PlanCode = plan.Code,
            LicenseKey = artifact.LicenseKey,
            LicenseToken = artifact.LicenseToken,
            Signature = artifact.Signature,
            FeaturesJson = JsonSerializer.Serialize(featureFlags),
            DeviceLimit = plan.DeviceLimit,
            IssuedAt = now,
            ExpiresAt = renewalDate,
            GraceDays = 7,
            Status = "active"
        };
        _dbContext.IssuedLicenses.Add(license);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _dbContext.LicenseEvents.Add(new LicenseEvent
        {
            TenantId = tenant.Id,
            LicenseId = license.Id,
            EventType = "LICENSE_ISSUED",
            PayloadJson = JsonSerializer.Serialize(new
            {
                artifact.LicenseKey,
                plan.Code,
                featureFlags
            }),
            CreatedAt = now
        });

        var assets = await _dbContext.DownloadableAssets
            .AsNoTracking()
            .Where(x => x.IsActive)
            .ToListAsync(cancellationToken);
        foreach (var asset in assets)
        {
            if (await _dbContext.DownloadAccesses.AnyAsync(
                    x => x.TenantId == tenant.Id && x.DownloadableAssetId == asset.Id,
                    cancellationToken))
            {
                continue;
            }

            _dbContext.DownloadAccesses.Add(new DownloadAccess
            {
                TenantId = tenant.Id,
                DownloadableAssetId = asset.Id,
                SubscriptionId = subscription.Id,
                LicenseId = license.Id,
                Status = "active",
                ExpiresAt = renewalDate
            });
        }

        if (!string.IsNullOrWhiteSpace(checkoutSession.ResellerCode))
        {
            var reseller = await ResolveReferralAsync(checkoutSession.ResellerCode, cancellationToken);
            if (reseller is not null)
            {
                if (!await _dbContext.ResellerCustomerLinks.AnyAsync(
                        x => x.ResellerAccountId == reseller.Id && x.TenantId == tenant.Id,
                        cancellationToken))
                {
                    _dbContext.ResellerCustomerLinks.Add(new ResellerCustomerLink
                    {
                        TenantId = tenant.Id,
                        ResellerAccountId = reseller.Id,
                        CustomerAccountId = account.Id,
                        SubscriptionId = subscription.Id,
                        ReferralCode = reseller.Code,
                        LinkedAt = now
                    });
                }

                _dbContext.ResellerCommissionEvents.Add(new ResellerCommissionEvent
                {
                    TenantId = tenant.Id,
                    ResellerAccountId = reseller.Id,
                    SubscriptionId = subscription.Id,
                    InvoiceId = invoice.Id,
                    Rate = reseller.CommissionRate,
                    Amount = Math.Round(invoice.Total * reseller.CommissionRate, 2, MidpointRounding.AwayFromZero),
                    Status = "accrued",
                    EventAt = now
                });
            }
        }

        checkoutSession.CustomerAccountId = account.Id;
        checkoutSession.TenantId = tenant.Id;
        checkoutSession.SubscriptionId = subscription.Id;
        checkoutSession.BillingProfileId = billingProfile.Id;
        checkoutSession.LicenseId = license.Id;
        checkoutSession.CompletedAt = now;
        checkoutSession.ProvisionedAt = now;
        checkoutSession.Status = "provisioned";

        _dbContext.AuditLogs.AddRange(
            new AuditLog
            {
                TenantId = tenant.Id,
                UserId = null,
                Action = "CHECKOUT_PROVISIONED",
                Entity = "checkout_sessions",
                EntityId = checkoutSession.Id.ToString(),
                PayloadJson = JsonSerializer.Serialize(new
                {
                    plan.Code,
                    checkoutSession.BillingCycle,
                    invoice.InvoiceNo
                })
            },
            new AuditLog
            {
                TenantId = tenant.Id,
                UserId = null,
                Action = "LICENSE_ISSUED",
                Entity = "licenses",
                EntityId = license.Id.ToString(),
                PayloadJson = JsonSerializer.Serialize(new
                {
                    artifact.LicenseKey,
                    license.ExpiresAt
                })
            });

        QueueEmail("purchase_success", tenant.Id, account.Id, account.Email, new Dictionary<string, string?>
        {
            ["planCode"] = plan.Code,
            ["licenseKey"] = artifact.LicenseKey,
            ["portalUrl"] = "/portal"
        });
        QueueEmail("subscription_activated", tenant.Id, account.Id, account.Email, new Dictionary<string, string?>
        {
            ["companyName"] = tenant.Name,
            ["renewalDate"] = renewalDate.ToString("yyyy-MM-dd")
        });
        QueueEmail("invoice_available", tenant.Id, account.Id, account.Email, new Dictionary<string, string?>
        {
            ["invoiceNo"] = invoice.InvoiceNo,
            ["amount"] = invoice.Total.ToString("0.##"),
            ["currency"] = invoice.Currency
        });
        QueueEmail("license_issued", tenant.Id, account.Id, account.Email, new Dictionary<string, string?>
        {
            ["licenseKey"] = artifact.LicenseKey,
            ["expiresAt"] = renewalDate.ToString("yyyy-MM-dd")
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private async Task<CheckoutStatusSnapshot?> BuildCheckoutStatusAsync(
        Guid checkoutSessionId,
        CancellationToken cancellationToken)
    {
        var checkoutSession = await _dbContext.CheckoutSessions.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == checkoutSessionId, cancellationToken);
        if (checkoutSession is null)
        {
            return null;
        }

        string? invoiceNo = null;
        CheckoutLicenseSnapshot? licenseSnapshot = null;

        if (checkoutSession.TenantId.HasValue)
        {
            try
            {
                invoiceNo = await _dbContext.Invoices.AsNoTracking()
                    .Where(x => EF.Property<Guid?>(x, "TenantId") == checkoutSession.TenantId.Value)
                    .OrderByDescending(x => EF.Property<DateTimeOffset?>(x, "IssuedAt") ?? DateTimeOffset.MinValue)
                    .Select(x => EF.Property<string?>(x, "InvoiceNo"))
                    .FirstOrDefaultAsync(cancellationToken);

                licenseSnapshot = await _dbContext.IssuedLicenses.AsNoTracking()
                    .Where(x => EF.Property<Guid?>(x, "TenantId") == checkoutSession.TenantId.Value)
                    .OrderByDescending(x => EF.Property<DateTimeOffset?>(x, "IssuedAt") ?? DateTimeOffset.MinValue)
                    .Select(x => new CheckoutLicenseSnapshot(
                        EF.Property<string?>(x, "LicenseKey"),
                        EF.Property<string?>(x, "LicenseToken"),
                        EF.Property<string?>(x, "Status"),
                        EF.Property<DateTimeOffset?>(x, "ExpiresAt")))
                    .FirstOrDefaultAsync(cancellationToken);
            }
            catch (InvalidOperationException)
            {
                invoiceNo = null;
                licenseSnapshot = null;
            }
        }

        var downloads = await BuildDownloadSnapshotsAsync(checkoutSession.TenantId, cancellationToken);

        return new CheckoutStatusSnapshot(
            checkoutSession.Id,
            checkoutSession.CheckoutReference,
            checkoutSession.CompanyName,
            checkoutSession.PlanCode,
            checkoutSession.BillingCycle,
            checkoutSession.Status,
            checkoutSession.PaymentStatus,
            checkoutSession.Provider,
            checkoutSession.ProviderSessionId,
            checkoutSession.ProviderPaymentReference,
            checkoutSession.Amount,
            checkoutSession.TaxAmount,
            checkoutSession.Currency,
            checkoutSession.TenantId,
            checkoutSession.CustomerAccountId,
            checkoutSession.SubscriptionId,
            invoiceNo,
            licenseSnapshot?.LicenseKey,
            licenseSnapshot?.LicenseToken,
            licenseSnapshot?.Status,
            licenseSnapshot?.ExpiresAt,
            downloads);
    }

    private sealed record CheckoutLicenseSnapshot(
        string? LicenseKey,
        string? LicenseToken,
        string? Status,
        DateTimeOffset? ExpiresAt);

    private void QueueEmail(
        string eventCode,
        Guid tenantId,
        Guid customerAccountId,
        string toEmail,
        IReadOnlyDictionary<string, string?> values)
    {
        var template = _emailTemplateService.Build(eventCode, values);
        _dbContext.EmailNotifications.Add(new EmailNotification
        {
            TenantId = tenantId,
            CustomerAccountId = customerAccountId,
            EventCode = eventCode,
            ToEmail = toEmail,
            Subject = template.Subject,
            BodyMarkdown = template.BodyMarkdown,
            Status = "queued"
        });
    }

    private async Task<IReadOnlyList<DownloadAssetSnapshot>> BuildDownloadSnapshotsAsync(
        Guid? tenantId,
        CancellationToken cancellationToken)
    {
        var allAssets = await (
            from asset in _dbContext.DownloadableAssets.AsNoTracking()
            join release in _dbContext.AppReleases.AsNoTracking() on asset.AppReleaseId equals release.Id
            where asset.IsActive && release.IsActive
            select new DownloadAssetSnapshot(
                asset.Id,
                release.Id,
                asset.Platform,
                asset.Label,
                release.Version,
                release.ReleaseDate,
                asset.Visibility,
                asset.DownloadUrl,
                release.ReleaseNotesMarkdown,
                release.InstallGuideMarkdown,
                release.MinimumRequirements))
            .ToListAsync(cancellationToken);

        if (!tenantId.HasValue)
        {
            return allAssets.Where(x => string.Equals(x.Visibility, "public", StringComparison.OrdinalIgnoreCase)).ToList();
        }

        var entitledAssetIds = await _dbContext.DownloadAccesses.AsNoTracking()
            .Where(x => x.TenantId == tenantId.Value && x.Status == "active")
            .Select(x => x.DownloadableAssetId)
            .ToListAsync(cancellationToken);

        return allAssets.Where(x =>
                string.Equals(x.Visibility, "public", StringComparison.OrdinalIgnoreCase) ||
                entitledAssetIds.Contains(x.AssetId))
            .ToList();
    }

    private async Task<ResellerAccount?> ResolveReferralAsync(string? code, CancellationToken cancellationToken)
    {
        var normalizedCode = NormalizeOptional(code)?.ToUpperInvariant();
        if (normalizedCode is null)
        {
            return null;
        }

        var resellerByDedicatedCode = await (
            from resellerCode in _dbContext.ResellerCodes
            join reseller in _dbContext.ResellerAccounts on resellerCode.ResellerAccountId equals reseller.Id
            where resellerCode.Code == normalizedCode && resellerCode.IsActive && reseller.Status == "approved"
            select reseller).FirstOrDefaultAsync(cancellationToken);
        if (resellerByDedicatedCode is not null)
        {
            return resellerByDedicatedCode;
        }

        return await _dbContext.ResellerAccounts
            .FirstOrDefaultAsync(x => x.Code == normalizedCode && x.Status == "approved", cancellationToken);
    }

    private async Task<CheckoutSession?> ResolveCheckoutSessionForWebhookAsync(
        string payloadJson,
        string? providerPaymentReference,
        CancellationToken cancellationToken)
    {
        var payloadSessionId = TryExtractCheckoutSessionId(payloadJson);
        if (payloadSessionId.HasValue)
        {
            return await _dbContext.CheckoutSessions
                .FirstOrDefaultAsync(x => x.Id == payloadSessionId.Value, cancellationToken);
        }

        var normalizedPaymentRef = NormalizeOptional(providerPaymentReference);
        if (normalizedPaymentRef is null)
        {
            return null;
        }

        return await _dbContext.CheckoutSessions
            .FirstOrDefaultAsync(x => x.ProviderPaymentReference == normalizedPaymentRef, cancellationToken);
    }

    private static Guid? TryExtractCheckoutSessionId(string payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(payloadJson);
            if (document.RootElement.TryGetProperty("checkoutSessionId", out var sessionElement) &&
                Guid.TryParse(sessionElement.GetString(), out var checkoutSessionId))
            {
                return checkoutSessionId;
            }
        }
        catch
        {
            return null;
        }

        return null;
    }

    private static string NormalizeBillingPeriod(string? billingPeriod)
    {
        var normalized = NormalizeCode(billingPeriod, "monthly");
        return normalized is "monthly" or "yearly" ? normalized : "monthly";
    }

    private static string NormalizeCode(string? value, string fallback)
    {
        var normalized = value?.Trim().ToLowerInvariant();
        return string.IsNullOrWhiteSpace(normalized) ? fallback : normalized;
    }

    private static string? NormalizeOptional(string? value)
    {
        var normalized = value?.Trim();
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
    }

    private void EnsureProviderAllowed(string providerCode, IPaymentProvider provider)
    {
        if (string.Equals(providerCode, "mock", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var allowPlaceholder = bool.TryParse(_configuration["CommercePayments:AllowPlaceholderProviders"], out var enabled) && enabled;
        if (provider is PlaceholderPaymentProvider && !allowPlaceholder)
        {
            throw new InvalidOperationException($"{providerCode} odeme saglayicisi bu ortamda aktif degil.");
        }
    }
}
