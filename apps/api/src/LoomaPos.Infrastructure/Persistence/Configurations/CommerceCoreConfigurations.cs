using LoomaPos.Domain.Commerce;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LoomaPos.Infrastructure.Persistence.Configurations;

internal sealed class CustomerAccountConfiguration : IEntityTypeConfiguration<CustomerAccount>
{
    public void Configure(EntityTypeBuilder<CustomerAccount> entity)
    {
        entity.ToTable("customer_accounts");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.Email).HasColumnName("email").HasMaxLength(320).IsRequired();
        entity.Property(x => x.PasswordHash).HasColumnName("password_hash").IsRequired();
        entity.Property(x => x.FullName).HasColumnName("full_name").HasMaxLength(200).IsRequired();
        entity.Property(x => x.Phone).HasColumnName("phone").HasMaxLength(40);
        entity.Property(x => x.AccountStatus).HasColumnName("account_status").HasMaxLength(30).IsRequired();
        entity.Property(x => x.EmailVerifiedAt).HasColumnName("email_verified_at");
        entity.Property(x => x.EmailVerificationTokenHash).HasColumnName("email_verification_token_hash");
        entity.Property(x => x.EmailVerificationExpiresAt).HasColumnName("email_verification_expires_at");
        entity.Property(x => x.LastLoginAt).HasColumnName("last_login_at");
        entity.Property(x => x.PasswordResetTokenHash).HasColumnName("password_reset_token_hash");
        entity.Property(x => x.PasswordResetExpiresAt).HasColumnName("password_reset_expires_at");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        entity.HasIndex(x => x.Email).IsUnique();
        entity.HasIndex(x => new { x.AccountStatus, x.CreatedAt });
    }
}

internal sealed class PortalSessionConfiguration : IEntityTypeConfiguration<PortalSession>
{
    public void Configure(EntityTypeBuilder<PortalSession> entity)
    {
        entity.ToTable("portal_sessions");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.CustomerAccountId).HasColumnName("customer_account_id");
        entity.Property(x => x.ResellerAccountId).HasColumnName("reseller_account_id");
        entity.Property(x => x.TenantId).HasColumnName("tenant_id");
        entity.Property(x => x.PortalType).HasColumnName("portal_type").HasMaxLength(30).IsRequired();
        entity.Property(x => x.RoleCode).HasColumnName("role_code").HasMaxLength(50).IsRequired();
        entity.Property(x => x.AccessTokenHash).HasColumnName("access_token_hash").IsRequired();
        entity.Property(x => x.RefreshTokenHash).HasColumnName("refresh_token_hash").IsRequired();
        entity.Property(x => x.ExpiresAt).HasColumnName("expires_at");
        entity.Property(x => x.RefreshExpiresAt).HasColumnName("refresh_expires_at");
        entity.Property(x => x.UserAgent).HasColumnName("user_agent").HasMaxLength(500);
        entity.Property(x => x.IpAddress).HasColumnName("ip_address").HasMaxLength(80);
        entity.Property(x => x.RevokedAt).HasColumnName("revoked_at");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        entity.HasIndex(x => x.AccessTokenHash).IsUnique();
        entity.HasIndex(x => x.RefreshTokenHash).IsUnique();
        entity.HasIndex(x => new { x.CustomerAccountId, x.RevokedAt });
    }
}

internal sealed class TenantUserConfiguration : IEntityTypeConfiguration<TenantUser>
{
    public void Configure(EntityTypeBuilder<TenantUser> entity)
    {
        entity.ToTable("tenant_users");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.TenantId).HasColumnName("tenant_id");
        entity.Property(x => x.CustomerAccountId).HasColumnName("customer_account_id");
        entity.Property(x => x.RoleCode).HasColumnName("role_code").HasMaxLength(50).IsRequired();
        entity.Property(x => x.IsOwner).HasColumnName("is_owner");
        entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        entity.HasIndex(x => new { x.TenantId, x.CustomerAccountId }).IsUnique();
        entity.HasIndex(x => new { x.TenantId, x.RoleCode });
    }
}

internal sealed class SubscriptionPlanConfiguration : IEntityTypeConfiguration<SubscriptionPlan>
{
    public void Configure(EntityTypeBuilder<SubscriptionPlan> entity)
    {
        entity.ToTable("subscription_plans");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.Code).HasColumnName("code").HasMaxLength(50).IsRequired();
        entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(150).IsRequired();
        entity.Property(x => x.Description).HasColumnName("description").HasMaxLength(500).IsRequired();
        entity.Property(x => x.BranchLimit).HasColumnName("branch_limit");
        entity.Property(x => x.UserLimit).HasColumnName("user_limit");
        entity.Property(x => x.DeviceLimit).HasColumnName("device_limit");
        entity.Property(x => x.SupportTier).HasColumnName("support_tier").HasMaxLength(60).IsRequired();
        entity.Property(x => x.ResellerCommissionEligibility).HasColumnName("reseller_commission_eligibility");
        entity.Property(x => x.IsPublic).HasColumnName("is_public");
        entity.Property(x => x.IsActive).HasColumnName("is_active");
        entity.Property(x => x.HighlightLabel).HasColumnName("highlight_label").HasMaxLength(120).IsRequired();
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        entity.HasIndex(x => x.Code).IsUnique();
        entity.HasIndex(x => new { x.IsPublic, x.IsActive });
    }
}

internal sealed class PlanPriceConfiguration : IEntityTypeConfiguration<PlanPrice>
{
    public void Configure(EntityTypeBuilder<PlanPrice> entity)
    {
        entity.ToTable("plan_prices");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.SubscriptionPlanId).HasColumnName("subscription_plan_id");
        entity.Property(x => x.BillingPeriod).HasColumnName("billing_period").HasMaxLength(20).IsRequired();
        entity.Property(x => x.Currency).HasColumnName("currency").HasMaxLength(8).IsRequired();
        entity.Property(x => x.Amount).HasColumnName("amount").HasPrecision(18, 2);
        entity.Property(x => x.PromoAmount).HasColumnName("promo_amount").HasPrecision(18, 2);
        entity.Property(x => x.ExternalPriceId).HasColumnName("external_price_id").HasMaxLength(150);
        entity.Property(x => x.TrialDays).HasColumnName("trial_days");
        entity.Property(x => x.IsActive).HasColumnName("is_active");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        entity.HasIndex(x => new { x.SubscriptionPlanId, x.BillingPeriod, x.Currency }).IsUnique();
    }
}

internal sealed class FeatureFlagConfiguration : IEntityTypeConfiguration<FeatureFlag>
{
    public void Configure(EntityTypeBuilder<FeatureFlag> entity)
    {
        entity.ToTable("feature_flags");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.Code).HasColumnName("code").HasMaxLength(80).IsRequired();
        entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(150).IsRequired();
        entity.Property(x => x.Description).HasColumnName("description").HasMaxLength(500).IsRequired();
        entity.Property(x => x.IsPublic).HasColumnName("is_public");
        entity.Property(x => x.IsActive).HasColumnName("is_active");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        entity.HasIndex(x => x.Code).IsUnique();
    }
}

internal sealed class PlanFeatureFlagConfiguration : IEntityTypeConfiguration<PlanFeatureFlag>
{
    public void Configure(EntityTypeBuilder<PlanFeatureFlag> entity)
    {
        entity.ToTable("plan_feature_flags");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.SubscriptionPlanId).HasColumnName("subscription_plan_id");
        entity.Property(x => x.FeatureFlagId).HasColumnName("feature_flag_id");
        entity.Property(x => x.IsEnabled).HasColumnName("is_enabled");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.HasIndex(x => new { x.SubscriptionPlanId, x.FeatureFlagId }).IsUnique();
    }
}

internal sealed class BillingProfileConfiguration : IEntityTypeConfiguration<BillingProfile>
{
    public void Configure(EntityTypeBuilder<BillingProfile> entity)
    {
        entity.ToTable("billing_profiles");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.TenantId).HasColumnName("tenant_id");
        entity.Property(x => x.CustomerAccountId).HasColumnName("customer_account_id");
        entity.Property(x => x.CompanyName).HasColumnName("company_name").HasMaxLength(200).IsRequired();
        entity.Property(x => x.BillingEmail).HasColumnName("billing_email").HasMaxLength(320).IsRequired();
        entity.Property(x => x.Phone).HasColumnName("phone").HasMaxLength(40);
        entity.Property(x => x.TaxOffice).HasColumnName("tax_office").HasMaxLength(120);
        entity.Property(x => x.TaxNumber).HasColumnName("tax_number").HasMaxLength(50);
        entity.Property(x => x.AddressLine).HasColumnName("address_line").HasMaxLength(500);
        entity.Property(x => x.City).HasColumnName("city").HasMaxLength(120);
        entity.Property(x => x.Country).HasColumnName("country").HasMaxLength(8).IsRequired();
        entity.Property(x => x.Locale).HasColumnName("locale").HasMaxLength(20).IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        entity.HasIndex(x => new { x.TenantId, x.BillingEmail });
    }
}

internal sealed class InvoiceLineConfiguration : IEntityTypeConfiguration<InvoiceLine>
{
    public void Configure(EntityTypeBuilder<InvoiceLine> entity)
    {
        entity.ToTable("invoice_lines");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.TenantId).HasColumnName("tenant_id");
        entity.Property(x => x.InvoiceId).HasColumnName("invoice_id");
        entity.Property(x => x.Description).HasColumnName("description").HasMaxLength(500).IsRequired();
        entity.Property(x => x.Quantity).HasColumnName("quantity");
        entity.Property(x => x.UnitAmount).HasColumnName("unit_amount").HasPrecision(18, 2);
        entity.Property(x => x.TaxAmount).HasColumnName("tax_amount").HasPrecision(18, 2);
        entity.Property(x => x.TotalAmount).HasColumnName("total_amount").HasPrecision(18, 2);
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.HasIndex(x => new { x.TenantId, x.InvoiceId });
    }
}

internal sealed class PaymentTransactionConfiguration : IEntityTypeConfiguration<PaymentTransaction>
{
    public void Configure(EntityTypeBuilder<PaymentTransaction> entity)
    {
        entity.ToTable("payment_transactions");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.TenantId).HasColumnName("tenant_id");
        entity.Property(x => x.SubscriptionId).HasColumnName("subscription_id");
        entity.Property(x => x.InvoiceId).HasColumnName("invoice_id");
        entity.Property(x => x.CheckoutSessionId).HasColumnName("checkout_session_id");
        entity.Property(x => x.Provider).HasColumnName("provider").HasMaxLength(40).IsRequired();
        entity.Property(x => x.ProviderPaymentId).HasColumnName("provider_payment_id").HasMaxLength(150).IsRequired();
        entity.Property(x => x.ProviderCustomerReference).HasColumnName("provider_customer_reference").HasMaxLength(150);
        entity.Property(x => x.Amount).HasColumnName("amount").HasPrecision(18, 2);
        entity.Property(x => x.TaxAmount).HasColumnName("tax_amount").HasPrecision(18, 2);
        entity.Property(x => x.Currency).HasColumnName("currency").HasMaxLength(8).IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
        entity.Property(x => x.PaymentMethodSummary).HasColumnName("payment_method_summary").HasMaxLength(120).IsRequired();
        entity.Property(x => x.MetadataJson).HasColumnName("metadata_json").IsRequired();
        entity.Property(x => x.PaidAt).HasColumnName("paid_at");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        entity.HasIndex(x => x.ProviderPaymentId);
        entity.HasIndex(x => new { x.TenantId, x.CreatedAt });
    }
}

internal sealed class PaymentAttemptConfiguration : IEntityTypeConfiguration<PaymentAttempt>
{
    public void Configure(EntityTypeBuilder<PaymentAttempt> entity)
    {
        entity.ToTable("payment_attempts");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.CheckoutSessionId).HasColumnName("checkout_session_id");
        entity.Property(x => x.PaymentTransactionId).HasColumnName("payment_transaction_id");
        entity.Property(x => x.Provider).HasColumnName("provider").HasMaxLength(40).IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
        entity.Property(x => x.FailureReason).HasColumnName("failure_reason").HasMaxLength(500);
        entity.Property(x => x.MetadataJson).HasColumnName("metadata_json").IsRequired();
        entity.Property(x => x.AttemptedAt).HasColumnName("attempted_at");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.HasIndex(x => new { x.CheckoutSessionId, x.AttemptedAt });
    }
}

internal sealed class ActivationEventConfiguration : IEntityTypeConfiguration<ActivationEvent>
{
    public void Configure(EntityTypeBuilder<ActivationEvent> entity)
    {
        entity.ToTable("activation_events");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.TenantId).HasColumnName("tenant_id");
        entity.Property(x => x.DeviceActivationId).HasColumnName("device_activation_id");
        entity.Property(x => x.EventType).HasColumnName("event_type").HasMaxLength(80).IsRequired();
        entity.Property(x => x.PayloadJson).HasColumnName("payload_json").IsRequired();
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.HasIndex(x => new { x.TenantId, x.CreatedAt });
    }
}

internal sealed class AppReleaseConfiguration : IEntityTypeConfiguration<AppRelease>
{
    public void Configure(EntityTypeBuilder<AppRelease> entity)
    {
        entity.ToTable("app_releases");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.Platform).HasColumnName("platform").HasMaxLength(30).IsRequired();
        entity.Property(x => x.Channel).HasColumnName("channel").HasMaxLength(30).IsRequired();
        entity.Property(x => x.Version).HasColumnName("version").HasMaxLength(40).IsRequired();
        entity.Property(x => x.ReleaseDate).HasColumnName("release_date");
        entity.Property(x => x.ReleaseNotesMarkdown).HasColumnName("release_notes_markdown").IsRequired();
        entity.Property(x => x.InstallGuideMarkdown).HasColumnName("install_guide_markdown").IsRequired();
        entity.Property(x => x.MinimumRequirements).HasColumnName("minimum_requirements").IsRequired();
        entity.Property(x => x.IsPublic).HasColumnName("is_public");
        entity.Property(x => x.IsActive).HasColumnName("is_active");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        entity.HasIndex(x => new { x.Platform, x.Channel, x.Version }).IsUnique();
    }
}

internal sealed class DownloadableAssetConfiguration : IEntityTypeConfiguration<DownloadableAsset>
{
    public void Configure(EntityTypeBuilder<DownloadableAsset> entity)
    {
        entity.ToTable("downloadable_assets");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.AppReleaseId).HasColumnName("app_release_id");
        entity.Property(x => x.Label).HasColumnName("label").HasMaxLength(150).IsRequired();
        entity.Property(x => x.Platform).HasColumnName("platform").HasMaxLength(30).IsRequired();
        entity.Property(x => x.Visibility).HasColumnName("visibility").HasMaxLength(20).IsRequired();
        entity.Property(x => x.DownloadUrl).HasColumnName("download_url").HasMaxLength(500).IsRequired();
        entity.Property(x => x.Checksum).HasColumnName("checksum").HasMaxLength(128).IsRequired();
        entity.Property(x => x.RequiresActiveLicense).HasColumnName("requires_active_license");
        entity.Property(x => x.IsActive).HasColumnName("is_active");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        entity.HasIndex(x => new { x.AppReleaseId, x.Platform });
    }
}

internal sealed class DownloadAccessConfiguration : IEntityTypeConfiguration<DownloadAccess>
{
    public void Configure(EntityTypeBuilder<DownloadAccess> entity)
    {
        entity.ToTable("download_accesses");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.TenantId).HasColumnName("tenant_id");
        entity.Property(x => x.DownloadableAssetId).HasColumnName("downloadable_asset_id");
        entity.Property(x => x.SubscriptionId).HasColumnName("subscription_id");
        entity.Property(x => x.LicenseId).HasColumnName("license_id");
        entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
        entity.Property(x => x.ExpiresAt).HasColumnName("expires_at");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        entity.HasIndex(x => new { x.TenantId, x.DownloadableAssetId }).IsUnique();
    }
}

internal sealed class ResellerCodeConfiguration : IEntityTypeConfiguration<ResellerCode>
{
    public void Configure(EntityTypeBuilder<ResellerCode> entity)
    {
        entity.ToTable("reseller_codes");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.ResellerAccountId).HasColumnName("reseller_account_id");
        entity.Property(x => x.Code).HasColumnName("code").HasMaxLength(50).IsRequired();
        entity.Property(x => x.IsPrimary).HasColumnName("is_primary");
        entity.Property(x => x.IsActive).HasColumnName("is_active");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        entity.HasIndex(x => x.Code).IsUnique();
    }
}

internal sealed class ResellerReferralConfiguration : IEntityTypeConfiguration<ResellerReferral>
{
    public void Configure(EntityTypeBuilder<ResellerReferral> entity)
    {
        entity.ToTable("reseller_referrals");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.ResellerAccountId).HasColumnName("reseller_account_id");
        entity.Property(x => x.CheckoutSessionId).HasColumnName("checkout_session_id");
        entity.Property(x => x.TenantId).HasColumnName("tenant_id");
        entity.Property(x => x.ReferralCode).HasColumnName("referral_code").HasMaxLength(50).IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
        entity.Property(x => x.CommissionEligible).HasColumnName("commission_eligible");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        entity.HasIndex(x => new { x.CheckoutSessionId, x.ReferralCode }).IsUnique();
    }
}

internal sealed class ResellerCustomerLinkConfiguration : IEntityTypeConfiguration<ResellerCustomerLink>
{
    public void Configure(EntityTypeBuilder<ResellerCustomerLink> entity)
    {
        entity.ToTable("reseller_customer_links");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.TenantId).HasColumnName("tenant_id");
        entity.Property(x => x.ResellerAccountId).HasColumnName("reseller_account_id");
        entity.Property(x => x.CustomerAccountId).HasColumnName("customer_account_id");
        entity.Property(x => x.SubscriptionId).HasColumnName("subscription_id");
        entity.Property(x => x.ReferralCode).HasColumnName("referral_code").HasMaxLength(50).IsRequired();
        entity.Property(x => x.LinkedAt).HasColumnName("linked_at");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.HasIndex(x => new { x.ResellerAccountId, x.TenantId }).IsUnique();
    }
}

internal sealed class ResellerCommissionEventConfiguration : IEntityTypeConfiguration<ResellerCommissionEvent>
{
    public void Configure(EntityTypeBuilder<ResellerCommissionEvent> entity)
    {
        entity.ToTable("reseller_commission_events");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.TenantId).HasColumnName("tenant_id");
        entity.Property(x => x.ResellerAccountId).HasColumnName("reseller_account_id");
        entity.Property(x => x.SubscriptionId).HasColumnName("subscription_id");
        entity.Property(x => x.InvoiceId).HasColumnName("invoice_id");
        entity.Property(x => x.Rate).HasColumnName("rate").HasPrecision(8, 4);
        entity.Property(x => x.Amount).HasColumnName("amount").HasPrecision(18, 2);
        entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
        entity.Property(x => x.EventAt).HasColumnName("event_at");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.HasIndex(x => new { x.ResellerAccountId, x.Status, x.EventAt });
    }
}

internal sealed class EmailNotificationConfiguration : IEntityTypeConfiguration<EmailNotification>
{
    public void Configure(EntityTypeBuilder<EmailNotification> entity)
    {
        entity.ToTable("email_notifications");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id");
        entity.Property(x => x.TenantId).HasColumnName("tenant_id");
        entity.Property(x => x.CustomerAccountId).HasColumnName("customer_account_id");
        entity.Property(x => x.EventCode).HasColumnName("event_code").HasMaxLength(80).IsRequired();
        entity.Property(x => x.ToEmail).HasColumnName("to_email").HasMaxLength(320).IsRequired();
        entity.Property(x => x.Subject).HasColumnName("subject").HasMaxLength(200).IsRequired();
        entity.Property(x => x.BodyMarkdown).HasColumnName("body_markdown").IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
        entity.Property(x => x.SentAt).HasColumnName("sent_at");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        entity.HasIndex(x => new { x.EventCode, x.Status, x.CreatedAt });
    }
}
