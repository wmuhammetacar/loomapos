using LoomaPos.Domain.Commerce;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Commerce;

public interface ICommerceSeedService
{
    Task EnsureSeedDataAsync(CancellationToken cancellationToken);
}

public sealed class CommerceSeedService : ICommerceSeedService
{
    private readonly AppDbContext _dbContext;
    private readonly IPortalCryptoService _cryptoService;

    public CommerceSeedService(AppDbContext dbContext, IPortalCryptoService cryptoService)
    {
        _dbContext = dbContext;
        _cryptoService = cryptoService;
    }

    public async Task EnsureSeedDataAsync(CancellationToken cancellationToken)
    {
        await EnsurePlansAsync(cancellationToken);
        await EnsureReleasesAsync(cancellationToken);
        await EnsureDemoResellerAsync(cancellationToken);
        await EnsureResellerCodesAsync(cancellationToken);
    }

    private async Task EnsurePlansAsync(CancellationToken cancellationToken)
    {
        var featureDefinitions = new (string Code, string Name, string Description)[]
        {
            ("sales_operations", "Sales Operations", "Desktop ve mobile operasyon modulu"),
            ("inventory_management", "Inventory Management", "Stok ve urun hareketi modulu"),
            ("reporting", "Reporting", "Yonetici raporlama modulu"),
            ("staff_management", "Staff Management", "Rol ve personel modulu"),
            ("branch_management", "Branch Management", "Cok sube yonetimi"),
            ("online_collection", "Online Collection", "Uzak tahsilat entegrasyonu"),
            ("variant_products", "Variant Products", "Varyantli urun modulu"),
            ("e_invoice", "E-Invoice", "E-fatura uyumlulugu"),
            ("fiscal_integrations", "Fiscal Integrations", "Mali cihaz entegrasyonlari"),
            ("management_dashboard", "Management Dashboard", "Yonetici dashboard modulu"),
            ("download_center", "Download Center", "Uygulama indirme merkezi")
        };

        foreach (var feature in featureDefinitions)
        {
            if (await _dbContext.FeatureFlags.AnyAsync(x => x.Code == feature.Code, cancellationToken))
            {
                continue;
            }

            _dbContext.FeatureFlags.Add(new FeatureFlag
            {
                Code = feature.Code,
                Name = feature.Name,
                Description = feature.Description,
                IsPublic = true,
                IsActive = true
            });
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        var allFeatures = await _dbContext.FeatureFlags.AsNoTracking().ToListAsync(cancellationToken);

        var plans = new[]
        {
            new
            {
                Code = "starter",
                Name = "Starter",
                Description = "Tek sube ile lisansli POS ekosistemine gecis.",
                BranchLimit = (int?)1,
                UserLimit = (int?)3,
                DeviceLimit = (int?)1,
                SupportTier = "standard",
                ResellerEligible = false,
                Highlight = "",
                Monthly = 1490m,
                Yearly = 14900m,
                Features = new[] { "sales_operations", "inventory_management", "reporting", "download_center" }
            },
            new
            {
                Code = "pro",
                Name = "Pro",
                Description = "Bayi ve cok subeli perakende ekipleri icin ana paket.",
                BranchLimit = (int?)5,
                UserLimit = (int?)10,
                DeviceLimit = (int?)5,
                SupportTier = "priority",
                ResellerEligible = true,
                Highlight = "Most popular",
                Monthly = 2990m,
                Yearly = 29900m,
                Features = new[] { "sales_operations", "inventory_management", "reporting", "staff_management", "branch_management", "online_collection", "variant_products", "e_invoice", "download_center" }
            },
            new
            {
                Code = "enterprise",
                Name = "Enterprise",
                Description = "Kurumsal zincirler icin kurumsal rollout paketi.",
                BranchLimit = (int?)null,
                UserLimit = (int?)null,
                DeviceLimit = (int?)null,
                SupportTier = "enterprise",
                ResellerEligible = true,
                Highlight = "Custom SLA",
                Monthly = 5990m,
                Yearly = 59900m,
                Features = new[] { "sales_operations", "inventory_management", "reporting", "staff_management", "branch_management", "online_collection", "variant_products", "e_invoice", "fiscal_integrations", "management_dashboard", "download_center" }
            }
        };

        foreach (var definition in plans)
        {
            var plan = await _dbContext.SubscriptionPlans
                .FirstOrDefaultAsync(x => x.Code == definition.Code, cancellationToken);
            if (plan is null)
            {
                plan = new SubscriptionPlan
                {
                    Code = definition.Code,
                    Name = definition.Name,
                    Description = definition.Description,
                    BranchLimit = definition.BranchLimit,
                    UserLimit = definition.UserLimit,
                    DeviceLimit = definition.DeviceLimit,
                    SupportTier = definition.SupportTier,
                    ResellerCommissionEligibility = definition.ResellerEligible,
                    IsPublic = true,
                    IsActive = true,
                    HighlightLabel = definition.Highlight
                };
                _dbContext.SubscriptionPlans.Add(plan);
                await _dbContext.SaveChangesAsync(cancellationToken);
            }

            await UpsertPlanPriceAsync(plan.Id, "monthly", definition.Monthly, cancellationToken);
            await UpsertPlanPriceAsync(plan.Id, "yearly", definition.Yearly, cancellationToken);

            foreach (var featureCode in definition.Features)
            {
                var featureFlag = allFeatures.First(x => x.Code == featureCode);
                if (await _dbContext.PlanFeatureFlags.AnyAsync(
                        x => x.SubscriptionPlanId == plan.Id && x.FeatureFlagId == featureFlag.Id,
                        cancellationToken))
                {
                    continue;
                }

                _dbContext.PlanFeatureFlags.Add(new PlanFeatureFlag
                {
                    SubscriptionPlanId = plan.Id,
                    FeatureFlagId = featureFlag.Id,
                    IsEnabled = true
                });
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task UpsertPlanPriceAsync(
        Guid subscriptionPlanId,
        string billingPeriod,
        decimal amount,
        CancellationToken cancellationToken)
    {
        var price = await _dbContext.PlanPrices
            .FirstOrDefaultAsync(x => x.SubscriptionPlanId == subscriptionPlanId && x.BillingPeriod == billingPeriod, cancellationToken);
        if (price is null)
        {
            _dbContext.PlanPrices.Add(new PlanPrice
            {
                SubscriptionPlanId = subscriptionPlanId,
                BillingPeriod = billingPeriod,
                Currency = "TRY",
                Amount = amount,
                IsActive = true
            });
            return;
        }

        price.Amount = amount;
        price.IsActive = true;
    }

    private async Task EnsureReleasesAsync(CancellationToken cancellationToken)
    {
        var releases = new[]
        {
            new
            {
                Platform = "windows",
                Version = "1.4.2",
                ReleaseDate = new DateOnly(2026, 2, 28),
                Notes = "Yeni lisans aktivasyon sihirbazi ve rollout iyilestirmeleri.",
                Guide = "1. Kurulum paketini indirin.\n2. Yonetici olarak calistirin.\n3. Portal lisans anahtarini girin.",
                Requirements = "Windows 10 veya 11, 4 GB RAM, 500 MB alan.",
                Visibility = "portal",
                DownloadUrl = "https://downloads.loomapos.com/desktop/windows"
            },
            new
            {
                Platform = "android",
                Version = "1.4.2",
                ReleaseDate = new DateOnly(2026, 2, 28),
                Notes = "Mobil aktivasyon ve saha dogrulama iyilestirmeleri.",
                Guide = "1. APK veya store linkini acin.\n2. Lisansli tenant hesabi ile giris yapin.",
                Requirements = "Android 10+, 200 MB alan.",
                Visibility = "portal",
                DownloadUrl = "https://downloads.loomapos.com/mobile/android"
            },
            new
            {
                Platform = "ios",
                Version = "1.4.2",
                ReleaseDate = new DateOnly(2026, 2, 28),
                Notes = "iOS dagitim bilgisi ve aktivasyon rehberi.",
                Guide = "1. App Store/TestFlight dagitimini takip edin.\n2. Lisansli tenant ile giris yapin.",
                Requirements = "iOS 17+.",
                Visibility = "public",
                DownloadUrl = "https://downloads.loomapos.com/mobile/ios"
            }
        };

        foreach (var releaseDefinition in releases)
        {
            var release = await _dbContext.AppReleases
                .FirstOrDefaultAsync(x => x.Platform == releaseDefinition.Platform && x.Version == releaseDefinition.Version, cancellationToken);
            if (release is null)
            {
                release = new AppRelease
                {
                    Platform = releaseDefinition.Platform,
                    Channel = "stable",
                    Version = releaseDefinition.Version,
                    ReleaseDate = releaseDefinition.ReleaseDate,
                    ReleaseNotesMarkdown = releaseDefinition.Notes,
                    InstallGuideMarkdown = releaseDefinition.Guide,
                    MinimumRequirements = releaseDefinition.Requirements,
                    IsPublic = releaseDefinition.Visibility == "public",
                    IsActive = true
                };
                _dbContext.AppReleases.Add(release);
                await _dbContext.SaveChangesAsync(cancellationToken);
            }

            if (await _dbContext.DownloadableAssets.AnyAsync(
                    x => x.AppReleaseId == release.Id && x.Platform == releaseDefinition.Platform,
                    cancellationToken))
            {
                continue;
            }

            _dbContext.DownloadableAssets.Add(new DownloadableAsset
            {
                AppReleaseId = release.Id,
                Label = releaseDefinition.Platform switch
                {
                    "windows" => "Windows Desktop Installer",
                    "android" => "Android App",
                    _ => "iOS Information"
                },
                Platform = releaseDefinition.Platform,
                Visibility = releaseDefinition.Visibility,
                DownloadUrl = releaseDefinition.DownloadUrl,
                Checksum = "placeholder-checksum",
                RequiresActiveLicense = releaseDefinition.Visibility != "public",
                IsActive = true
            });
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureResellerCodesAsync(CancellationToken cancellationToken)
    {
        var approvedResellers = await _dbContext.ResellerAccounts
            .Where(x => x.Status == "approved")
            .ToListAsync(cancellationToken);
        foreach (var reseller in approvedResellers)
        {
            if (await _dbContext.ResellerCodes.AnyAsync(x => x.ResellerAccountId == reseller.Id, cancellationToken))
            {
                continue;
            }

            _dbContext.ResellerCodes.Add(new ResellerCode
            {
                ResellerAccountId = reseller.Id,
                Code = reseller.Code,
                IsPrimary = true,
                IsActive = true
            });
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureDemoResellerAsync(CancellationToken cancellationToken)
    {
        const string email = "partner@loomapos.com";
        var reseller = await _dbContext.ResellerAccounts
            .FirstOrDefaultAsync(x => x.Email == email, cancellationToken);

        if (reseller is null)
        {
            reseller = new ResellerAccount
            {
                Code = "MARMAR429",
                Name = "Aylin Demir",
                CompanyName = "Marmara POS Danismanlik",
                City = "Istanbul",
                Phone = "+90 532 111 22 33",
                Email = email,
                WebsiteOrSocialProof = "linkedin.com/company/marmarapos",
                Experience = "7 yil perakende yazilim satis ve saha kurulum deneyimi",
                Message = "Marmara bolgesi icin aktif cozum ortakligi yurutmek istiyoruz.",
                PasswordHash = _cryptoService.HashPassword("Bayi123!"),
                Status = "approved",
                CommissionRate = 0.12m,
                ApprovedAt = DateTimeOffset.UtcNow
            };

            _dbContext.ResellerAccounts.Add(reseller);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return;
        }

        if (string.IsNullOrWhiteSpace(reseller.PasswordHash))
        {
            reseller.PasswordHash = _cryptoService.HashPassword("Bayi123!");
        }

        reseller.Code = string.IsNullOrWhiteSpace(reseller.Code) ? "MARMAR429" : reseller.Code;
        reseller.Status = "approved";
        reseller.CommissionRate = reseller.CommissionRate <= 0 ? 0.12m : reseller.CommissionRate;
        reseller.ApprovedAt ??= DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
