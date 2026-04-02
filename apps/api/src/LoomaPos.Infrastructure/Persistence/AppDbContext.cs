using LoomaPos.Domain.Auditing;
using LoomaPos.Domain.Analytics;
using LoomaPos.Domain.Accounting;
using LoomaPos.Domain.Cashbook;
using LoomaPos.Domain.Catalog;
using LoomaPos.Domain.Common;
using LoomaPos.Domain.Commerce;
using LoomaPos.Domain.Customers;
using LoomaPos.Domain.Identity;
using LoomaPos.Domain.Integrations;
using LoomaPos.Domain.Inventory;
using LoomaPos.Domain.Internal;
using LoomaPos.Domain.Ops;
using LoomaPos.Domain.Purchasing;
using LoomaPos.Domain.Manufacturing;
using LoomaPos.Domain.Sales;
using LoomaPos.Domain.Sync;
using LoomaPos.Infrastructure.MultiTenancy;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Infrastructure.Persistence;

public sealed class AppDbContext : DbContext
{
    private readonly ITenantProvider _tenantProvider;

    public AppDbContext(DbContextOptions<AppDbContext> options, ITenantProvider tenantProvider)
        : base(options)
    {
        _tenantProvider = tenantProvider;
    }

    private Guid? CurrentTenantId => _tenantProvider.TenantId;

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<CustomerAccount> CustomerAccounts => Set<CustomerAccount>();
    public DbSet<PortalSession> PortalSessions => Set<PortalSession>();
    public DbSet<TenantUser> TenantUsers => Set<TenantUser>();
    public DbSet<SubscriptionPlan> SubscriptionPlans => Set<SubscriptionPlan>();
    public DbSet<PlanPrice> PlanPrices => Set<PlanPrice>();
    public DbSet<FeatureFlag> FeatureFlags => Set<FeatureFlag>();
    public DbSet<PlanFeatureFlag> PlanFeatureFlags => Set<PlanFeatureFlag>();
    public DbSet<BillingProfile> BillingProfiles => Set<BillingProfile>();
    public DbSet<Plan> Plans => Set<Plan>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceLine> InvoiceLines => Set<InvoiceLine>();
    public DbSet<SubscriptionPayment> SubscriptionPayments => Set<SubscriptionPayment>();
    public DbSet<PaymentTransaction> PaymentTransactions => Set<PaymentTransaction>();
    public DbSet<PaymentAttempt> PaymentAttempts => Set<PaymentAttempt>();
    public DbSet<PaymentWebhook> PaymentWebhooks => Set<PaymentWebhook>();
    public DbSet<IssuedLicense> IssuedLicenses => Set<IssuedLicense>();
    public DbSet<LicenseEvent> LicenseEvents => Set<LicenseEvent>();
    public DbSet<DeviceActivation> DeviceActivations => Set<DeviceActivation>();
    public DbSet<ActivationEvent> ActivationEvents => Set<ActivationEvent>();
    public DbSet<AppRelease> AppReleases => Set<AppRelease>();
    public DbSet<DownloadableAsset> DownloadableAssets => Set<DownloadableAsset>();
    public DbSet<DownloadAccess> DownloadAccesses => Set<DownloadAccess>();
    public DbSet<IntegrationConnection> IntegrationConnections => Set<IntegrationConnection>();
    public DbSet<IntegrationCredential> IntegrationCredentials => Set<IntegrationCredential>();
    public DbSet<IntegrationConfig> IntegrationConfigs => Set<IntegrationConfig>();
    public DbSet<IntegrationMapping> IntegrationMappings => Set<IntegrationMapping>();
    public DbSet<IntegrationJob> IntegrationJobs => Set<IntegrationJob>();
    public DbSet<IntegrationJobAttempt> IntegrationJobAttempts => Set<IntegrationJobAttempt>();
    public DbSet<IntegrationEvent> IntegrationEvents => Set<IntegrationEvent>();
    public DbSet<IntegrationLog> IntegrationLogs => Set<IntegrationLog>();
    public DbSet<IntegrationFailure> IntegrationFailures => Set<IntegrationFailure>();
    public DbSet<IntegrationHealthSnapshot> IntegrationHealthSnapshots => Set<IntegrationHealthSnapshot>();
    public DbSet<IntegrationRateLimitRecord> IntegrationRateLimitRecords => Set<IntegrationRateLimitRecord>();
    public DbSet<ProviderWebhookEvent> ProviderWebhookEvents => Set<ProviderWebhookEvent>();
    public DbSet<OutboundWebhookEndpoint> OutboundWebhookEndpoints => Set<OutboundWebhookEndpoint>();
    public DbSet<OutboundWebhookSubscription> OutboundWebhookSubscriptions => Set<OutboundWebhookSubscription>();
    public DbSet<OutboundWebhookDelivery> OutboundWebhookDeliveries => Set<OutboundWebhookDelivery>();
    public DbSet<ApiClient> ApiClients => Set<ApiClient>();
    public DbSet<ApiKey> ApiKeys => Set<ApiKey>();
    public DbSet<ApiScope> ApiScopes => Set<ApiScope>();
    public DbSet<ApiUsageLog> ApiUsageLogs => Set<ApiUsageLog>();
    public DbSet<InvoiceDocument> InvoiceDocuments => Set<InvoiceDocument>();
    public DbSet<InvoiceDocumentLine> InvoiceDocumentLines => Set<InvoiceDocumentLine>();
    public DbSet<InvoiceDocumentStatusHistory> InvoiceDocumentStatusHistory => Set<InvoiceDocumentStatusHistory>();
    public DbSet<InvoiceProviderSubmission> InvoiceProviderSubmissions => Set<InvoiceProviderSubmission>();
    public DbSet<InvoiceArtifact> InvoiceArtifacts => Set<InvoiceArtifact>();
    public DbSet<InvoiceMappingError> InvoiceMappingErrors => Set<InvoiceMappingError>();
    public DbSet<FiscalDeviceBinding> FiscalDeviceBindings => Set<FiscalDeviceBinding>();
    public DbSet<FiscalCommandLog> FiscalCommandLogs => Set<FiscalCommandLog>();
    public DbSet<AccountingSyncRecord> AccountingSyncRecords => Set<AccountingSyncRecord>();
    public DbSet<EcommerceSyncRecord> EcommerceSyncRecords => Set<EcommerceSyncRecord>();
    public DbSet<MessagingDeliveryRecord> MessagingDeliveryRecords => Set<MessagingDeliveryRecord>();
    public DbSet<IntegrationArtifact> IntegrationArtifacts => Set<IntegrationArtifact>();
    public DbSet<IntegrationAuditLog> IntegrationAuditLogs => Set<IntegrationAuditLog>();
    public DbSet<ResellerAccount> ResellerAccounts => Set<ResellerAccount>();
    public DbSet<ResellerCode> ResellerCodes => Set<ResellerCode>();
    public DbSet<ResellerReferral> ResellerReferrals => Set<ResellerReferral>();
    public DbSet<ResellerCustomerLink> ResellerCustomerLinks => Set<ResellerCustomerLink>();
    public DbSet<ResellerCommissionEvent> ResellerCommissionEvents => Set<ResellerCommissionEvent>();
    public DbSet<ResellerCustomer> ResellerCustomers => Set<ResellerCustomer>();
    public DbSet<Commission> Commissions => Set<Commission>();
    public DbSet<Payout> Payouts => Set<Payout>();
    public DbSet<CheckoutSession> CheckoutSessions => Set<CheckoutSession>();
    public DbSet<EmailNotification> EmailNotifications => Set<EmailNotification>();
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<ProductBarcode> ProductBarcodes => Set<ProductBarcode>();
    public DbSet<StockMove> StockMoves => Set<StockMove>();
    public DbSet<StockBalance> StockBalances => Set<StockBalance>();
    public DbSet<Warehouse> Warehouses => Set<Warehouse>();
    public DbSet<StockByWarehouse> StockByWarehouses => Set<StockByWarehouse>();
    public DbSet<WarehouseTransfer> WarehouseTransfers => Set<WarehouseTransfer>();
    public DbSet<WarehouseTransferLine> WarehouseTransferLines => Set<WarehouseTransferLine>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderLine> PurchaseOrderLines => Set<PurchaseOrderLine>();
    public DbSet<BillOfMaterials> BillOfMaterials => Set<BillOfMaterials>();
    public DbSet<BillOfMaterialsLine> BillOfMaterialsLines => Set<BillOfMaterialsLine>();
    public DbSet<ProductionOrder> ProductionOrders => Set<ProductionOrder>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleLine> SaleLines => Set<SaleLine>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Contact> Contacts => Set<Contact>();
    public DbSet<ContactLedger> ContactLedger => Set<ContactLedger>();
    public DbSet<CustomerCurrentAccount> CustomerCurrentAccounts => Set<CustomerCurrentAccount>();
    public DbSet<CustomerCurrentAccountEntry> CustomerCurrentAccountEntries => Set<CustomerCurrentAccountEntry>();
    public DbSet<AccountingExportItem> AccountingExportItems => Set<AccountingExportItem>();
    public DbSet<CashTransaction> CashTransactions => Set<CashTransaction>();
    public DbSet<ProcessedEvent> ProcessedEvents => Set<ProcessedEvent>();
    public DbSet<AggDailySales> AggDailySales => Set<AggDailySales>();
    public DbSet<AggBranchDailySales> AggBranchDailySales => Set<AggBranchDailySales>();
    public DbSet<AggPaymentMethodDaily> AggPaymentMethodDaily => Set<AggPaymentMethodDaily>();
    public DbSet<AggCustomerHealthSnapshot> AggCustomerHealthSnapshots => Set<AggCustomerHealthSnapshot>();
    public DbSet<AnalyticsRefreshRun> AnalyticsRefreshRuns => Set<AnalyticsRefreshRun>();
    public DbSet<AnalyticsReportSchedule> AnalyticsReportSchedules => Set<AnalyticsReportSchedule>();
    public DbSet<AnalyticsSavedView> AnalyticsSavedViews => Set<AnalyticsSavedView>();
    public DbSet<DeploymentRecord> DeploymentRecords => Set<DeploymentRecord>();
    public DbSet<ServiceVersionRecord> ServiceVersions => Set<ServiceVersionRecord>();
    public DbSet<EnvironmentConfigRecord> EnvironmentConfigs => Set<EnvironmentConfigRecord>();
    public DbSet<SecretReferenceRecord> SecretReferences => Set<SecretReferenceRecord>();
    public DbSet<MigrationRun> MigrationRuns => Set<MigrationRun>();
    public DbSet<BackupRun> BackupRuns => Set<BackupRun>();
    public DbSet<RestoreValidationRun> RestoreValidationRuns => Set<RestoreValidationRun>();
    public DbSet<IncidentRecord> IncidentRecords => Set<IncidentRecord>();
    public DbSet<IncidentTimelineEvent> IncidentTimelineEvents => Set<IncidentTimelineEvent>();
    public DbSet<RunbookRecord> RunbookRecords => Set<RunbookRecord>();
    public DbSet<AlertRule> AlertRules => Set<AlertRule>();
    public DbSet<AlertEvent> AlertEvents => Set<AlertEvent>();
    public DbSet<SloDefinition> SloDefinitions => Set<SloDefinition>();
    public DbSet<CapacitySnapshot> CapacitySnapshots => Set<CapacitySnapshot>();
    public DbSet<RateLimitPolicyRecord> RateLimitPolicies => Set<RateLimitPolicyRecord>();
    public DbSet<RetentionPolicyRecord> RetentionPolicies => Set<RetentionPolicyRecord>();
    public DbSet<SecurityEventRecord> SecurityEvents => Set<SecurityEventRecord>();
    public DbSet<AbuseFlag> AbuseFlags => Set<AbuseFlag>();
    public DbSet<DependencyStatusRecord> DependencyStatusRecords => Set<DependencyStatusRecord>();
    public DbSet<RolloutRecord> RolloutRecords => Set<RolloutRecord>();
    public DbSet<OpsAuditLog> OpsAuditLogs => Set<OpsAuditLog>();
    public DbSet<InternalUser> InternalUsers => Set<InternalUser>();
    public DbSet<InternalUserRole> InternalUserRoles => Set<InternalUserRole>();
    public DbSet<InternalSession> InternalSessions => Set<InternalSession>();
    public DbSet<AdminActionRequest> AdminActionRequests => Set<AdminActionRequest>();
    public DbSet<AdminActionApproval> AdminActionApprovals => Set<AdminActionApproval>();
    public DbSet<SupportAccessSession> SupportAccessSessions => Set<SupportAccessSession>();
    public DbSet<SupportCase> SupportCases => Set<SupportCase>();
    public DbSet<SupportCaseMessage> SupportCaseMessages => Set<SupportCaseMessage>();
    public DbSet<SupportCaseNote> SupportCaseNotes => Set<SupportCaseNote>();
    public DbSet<SupportCaseLink> SupportCaseLinks => Set<SupportCaseLink>();

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyTenantRules();
        ApplyCreatedAtRules();
        ApplyUpdatedAtRules();
        return base.SaveChangesAsync(cancellationToken);
    }

    public override int SaveChanges()
    {
        ApplyTenantRules();
        ApplyCreatedAtRules();
        ApplyUpdatedAtRules();
        return base.SaveChanges();
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Tenant>(entity =>
        {
            entity.ToTable("tenants");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
            entity.Property(x => x.TenantCode).HasColumnName("tenant_code").HasMaxLength(80).IsRequired();
            entity.Property(x => x.BillingEmail).HasColumnName("billing_email").HasMaxLength(320).IsRequired();
            entity.Property(x => x.TaxOffice).HasColumnName("tax_office").HasMaxLength(120);
            entity.Property(x => x.TaxNumber).HasColumnName("tax_number").HasMaxLength(50);
            entity.Property(x => x.Country).HasColumnName("country").HasMaxLength(8).IsRequired();
            entity.Property(x => x.DefaultLocale).HasColumnName("default_locale").HasMaxLength(20).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.SettingsJson).HasColumnName("settings_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => x.TenantCode).IsUnique();
            entity.HasIndex(x => x.BillingEmail);
        });

        modelBuilder.Entity<Branch>(entity =>
        {
            entity.ToTable("branches");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
            entity.Property(x => x.Address).HasColumnName("address").HasMaxLength(500);
            entity.Property(x => x.Phone).HasColumnName("phone").HasMaxLength(40);
            entity.Property(x => x.TaxNumber).HasColumnName("tax_number").HasMaxLength(50);
            entity.Property(x => x.SettingsJson).HasColumnName("settings_json");
            entity.HasIndex(x => new { x.TenantId, x.Name }).IsUnique();
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.BranchId).HasColumnName("branch_id");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
            entity.Property(x => x.Email).HasColumnName("email").HasMaxLength(320).IsRequired();
            entity.Property(x => x.Phone).HasColumnName("phone").HasMaxLength(40);
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.HasIndex(x => new { x.TenantId, x.Email }).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.BranchId });
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.ToTable("roles");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.Name }).IsUnique();
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.ToTable("user_roles");
            entity.HasKey(x => new { x.UserId, x.RoleId });
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.RoleId).HasColumnName("role_id");
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("audit_logs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.Action).HasColumnName("action").HasMaxLength(100).IsRequired();
            entity.Property(x => x.Entity).HasColumnName("entity").HasMaxLength(100).IsRequired();
            entity.Property(x => x.EntityId).HasMaxLength(100).HasColumnName("entity_id");
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.TenantId, x.CreatedAt });
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<Plan>(entity =>
        {
            entity.ToTable("plans");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Code).HasColumnName("code").HasMaxLength(50).IsRequired();
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(150).IsRequired();
            entity.Property(x => x.MonthlyPrice).HasColumnName("monthly_price").HasPrecision(18, 2);
            entity.Property(x => x.YearlyPrice).HasColumnName("yearly_price").HasPrecision(18, 2);
            entity.Property(x => x.MaxBranches).HasColumnName("max_branches");
            entity.Property(x => x.MaxUsers).HasColumnName("max_users");
            entity.Property(x => x.MaxDevices).HasColumnName("max_devices");
            entity.Property(x => x.FeaturesJson).HasColumnName("features_json");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => x.Code).IsUnique();
        });

        modelBuilder.Entity<Subscription>(entity =>
        {
            entity.ToTable("subscriptions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.BillingProfileId).HasColumnName("billing_profile_id");
            entity.Property(x => x.PlanCode).HasColumnName("plan_code").HasMaxLength(50).IsRequired();
            entity.Property(x => x.BillingCycle).HasColumnName("billing_cycle").HasMaxLength(20).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.CurrentPeriodStart).HasColumnName("current_period_start");
            entity.Property(x => x.CurrentPeriodEnd).HasColumnName("current_period_end");
            entity.Property(x => x.RenewalDate).HasColumnName("renewal_date");
            entity.Property(x => x.CancelAtPeriodEnd).HasColumnName("cancel_at_period_end");
            entity.Property(x => x.TrialEndsAt).HasColumnName("trial_ends_at");
            entity.Property(x => x.GraceEndsAt).HasColumnName("grace_ends_at");
            entity.Property(x => x.CanceledAt).HasColumnName("canceled_at");
            entity.Property(x => x.ProviderSubscriptionId).HasColumnName("provider_subscription_id").HasMaxLength(150);
            entity.Property(x => x.ProviderCustomerReference).HasColumnName("provider_customer_reference").HasMaxLength(150);
            entity.Property(x => x.PlanSnapshotJson).HasColumnName("plan_snapshot_json").IsRequired();
            entity.Property(x => x.ResellerCode).HasColumnName("reseller_code").HasMaxLength(50);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.TenantId, x.Status, x.CreatedAt });
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<Invoice>(entity =>
        {
            entity.ToTable("invoices");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.SubscriptionId).HasColumnName("subscription_id");
            entity.Property(x => x.BillingProfileId).HasColumnName("billing_profile_id");
            entity.Property(x => x.InvoiceNo).HasColumnName("invoice_no").HasMaxLength(80).IsRequired();
            entity.Property(x => x.Description).HasColumnName("description").HasMaxLength(500).IsRequired();
            entity.Property(x => x.Subtotal).HasColumnName("subtotal").HasPrecision(18, 2);
            entity.Property(x => x.TaxAmount).HasColumnName("tax_amount").HasPrecision(18, 2);
            entity.Property(x => x.Total).HasColumnName("total").HasPrecision(18, 2);
            entity.Property(x => x.Currency).HasColumnName("currency").HasMaxLength(8).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.IssuedAt).HasColumnName("issued_at");
            entity.Property(x => x.DueAt).HasColumnName("due_at");
            entity.Property(x => x.PaidAt).HasColumnName("paid_at");
            entity.Property(x => x.BillingPeriodStart).HasColumnName("billing_period_start");
            entity.Property(x => x.BillingPeriodEnd).HasColumnName("billing_period_end");
            entity.Property(x => x.ProviderInvoiceReference).HasColumnName("provider_invoice_reference").HasMaxLength(150);
            entity.Property(x => x.PdfUrl).HasColumnName("pdf_url").HasMaxLength(500);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.TenantId, x.CreatedAt });
            entity.HasIndex(x => x.InvoiceNo).IsUnique();
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<SubscriptionPayment>(entity =>
        {
            entity.ToTable("subscription_payments");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.SubscriptionId).HasColumnName("subscription_id");
            entity.Property(x => x.InvoiceId).HasColumnName("invoice_id");
            entity.Property(x => x.Provider).HasColumnName("provider").HasMaxLength(40).IsRequired();
            entity.Property(x => x.PaymentRef).HasColumnName("payment_ref").HasMaxLength(120).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.Amount).HasColumnName("amount").HasPrecision(18, 2);
            entity.Property(x => x.Currency).HasColumnName("currency").HasMaxLength(8).IsRequired();
            entity.Property(x => x.PaidAt).HasColumnName("paid_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.TenantId, x.CreatedAt });
            entity.HasIndex(x => x.PaymentRef);
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<PaymentWebhook>(entity =>
        {
            entity.ToTable("payment_webhooks");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Provider).HasColumnName("provider").HasMaxLength(40).IsRequired();
            entity.Property(x => x.EventId).HasColumnName("event_id").HasMaxLength(150).IsRequired();
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json").IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.Error).HasColumnName("error");
            entity.Property(x => x.ReceivedAt).HasColumnName("received_at");
            entity.Property(x => x.ProcessedAt).HasColumnName("processed_at");
            entity.HasIndex(x => new { x.Provider, x.EventId }).IsUnique();
        });

        modelBuilder.Entity<IssuedLicense>(entity =>
        {
            entity.ToTable("licenses");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.SubscriptionId).HasColumnName("subscription_id");
            entity.Property(x => x.PlanCode).HasColumnName("plan_code").HasMaxLength(50).IsRequired();
            entity.Property(x => x.LicenseKey).HasColumnName("license_key").HasMaxLength(120).IsRequired();
            entity.Property(x => x.LicenseToken).HasColumnName("license_token").IsRequired();
            entity.Property(x => x.Signature).HasColumnName("signature").HasMaxLength(256).IsRequired();
            entity.Property(x => x.FeaturesJson).HasColumnName("features_json").IsRequired();
            entity.Property(x => x.DeviceLimit).HasColumnName("device_limit");
            entity.Property(x => x.IssuedAt).HasColumnName("issued_at");
            entity.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            entity.Property(x => x.GraceDays).HasColumnName("grace_days");
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.TenantId, x.Status, x.ExpiresAt });
            entity.HasIndex(x => x.LicenseKey).IsUnique();
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<LicenseEvent>(entity =>
        {
            entity.ToTable("license_events");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.LicenseId).HasColumnName("license_id");
            entity.Property(x => x.EventType).HasColumnName("event_type").HasMaxLength(80).IsRequired();
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json").IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.TenantId, x.CreatedAt });
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<DeviceActivation>(entity =>
        {
            entity.ToTable("device_activations");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.LicenseId).HasColumnName("license_id");
            entity.Property(x => x.DeviceId).HasColumnName("device_id");
            entity.Property(x => x.DeviceName).HasColumnName("device_name").HasMaxLength(150).IsRequired();
            entity.Property(x => x.Platform).HasColumnName("platform").HasMaxLength(40).IsRequired();
            entity.Property(x => x.AppVersion).HasColumnName("app_version").HasMaxLength(40);
            entity.Property(x => x.ActivationSource).HasColumnName("activation_source").HasMaxLength(40).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.ActivatedAt).HasColumnName("activated_at");
            entity.Property(x => x.LastSeenAt).HasColumnName("last_seen_at");
            entity.Property(x => x.RevokedAt).HasColumnName("revoked_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.TenantId, x.DeviceId }).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.RevokedAt });
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<ResellerAccount>(entity =>
        {
            entity.ToTable("reseller_accounts");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Code).HasColumnName("code").HasMaxLength(50).IsRequired();
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
            entity.Property(x => x.CompanyName).HasColumnName("company_name").HasMaxLength(200);
            entity.Property(x => x.City).HasColumnName("city").HasMaxLength(120);
            entity.Property(x => x.Phone).HasColumnName("phone").HasMaxLength(40);
            entity.Property(x => x.Email).HasColumnName("email").HasMaxLength(320).IsRequired();
            entity.Property(x => x.WebsiteOrSocialProof).HasColumnName("website_or_social_proof").HasMaxLength(500);
            entity.Property(x => x.Experience).HasColumnName("experience");
            entity.Property(x => x.Message).HasColumnName("message");
            entity.Property(x => x.PasswordHash).HasColumnName("password_hash");
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.CommissionRate).HasColumnName("commission_rate").HasPrecision(8, 4);
            entity.Property(x => x.ApprovedAt).HasColumnName("approved_at");
            entity.Property(x => x.LastLoginAt).HasColumnName("last_login_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => x.Code).IsUnique();
            entity.HasIndex(x => x.Email);
        });

        modelBuilder.Entity<ResellerCustomer>(entity =>
        {
            entity.ToTable("reseller_customers");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.ResellerId).HasColumnName("reseller_id");
            entity.Property(x => x.ReferredAt).HasColumnName("referred_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.ResellerId, x.TenantId }).IsUnique();
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<Commission>(entity =>
        {
            entity.ToTable("commissions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.ResellerId).HasColumnName("reseller_id");
            entity.Property(x => x.SubscriptionId).HasColumnName("subscription_id");
            entity.Property(x => x.InvoiceId).HasColumnName("invoice_id");
            entity.Property(x => x.Rate).HasColumnName("rate").HasPrecision(8, 4);
            entity.Property(x => x.Amount).HasColumnName("amount").HasPrecision(18, 2);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.AccruedAt).HasColumnName("accrued_at");
            entity.Property(x => x.PaidAt).HasColumnName("paid_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.ResellerId, x.Status, x.CreatedAt });
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<Payout>(entity =>
        {
            entity.ToTable("payouts");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ResellerId).HasColumnName("reseller_id");
            entity.Property(x => x.PeriodStart).HasColumnName("period_start");
            entity.Property(x => x.PeriodEnd).HasColumnName("period_end");
            entity.Property(x => x.Total).HasColumnName("total").HasPrecision(18, 2);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.PaidAt).HasColumnName("paid_at");
            entity.HasIndex(x => new { x.ResellerId, x.CreatedAt });
        });

        modelBuilder.Entity<CheckoutSession>(entity =>
        {
            entity.ToTable("checkout_sessions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.CustomerAccountId).HasColumnName("customer_account_id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.SubscriptionId).HasColumnName("subscription_id");
            entity.Property(x => x.BillingProfileId).HasColumnName("billing_profile_id");
            entity.Property(x => x.LicenseId).HasColumnName("license_id");
            entity.Property(x => x.CheckoutReference).HasColumnName("checkout_reference").HasMaxLength(80).IsRequired();
            entity.Property(x => x.CompanyName).HasColumnName("company_name").HasMaxLength(200).IsRequired();
            entity.Property(x => x.ContactName).HasColumnName("contact_name").HasMaxLength(200).IsRequired();
            entity.Property(x => x.Email).HasColumnName("email").HasMaxLength(320).IsRequired();
            entity.Property(x => x.Phone).HasColumnName("phone").HasMaxLength(40);
            entity.Property(x => x.PlanCode).HasColumnName("plan_code").HasMaxLength(50).IsRequired();
            entity.Property(x => x.BillingCycle).HasColumnName("billing_cycle").HasMaxLength(20).IsRequired();
            entity.Property(x => x.Provider).HasColumnName("provider").HasMaxLength(40).IsRequired();
            entity.Property(x => x.ProviderSessionId).HasColumnName("provider_session_id").HasMaxLength(150);
            entity.Property(x => x.ProviderPaymentReference).HasColumnName("provider_payment_reference").HasMaxLength(150);
            entity.Property(x => x.ResellerCode).HasColumnName("reseller_code").HasMaxLength(50);
            entity.Property(x => x.CouponCode).HasColumnName("coupon_code").HasMaxLength(50);
            entity.Property(x => x.Amount).HasColumnName("amount").HasPrecision(18, 2);
            entity.Property(x => x.TaxAmount).HasColumnName("tax_amount").HasPrecision(18, 2);
            entity.Property(x => x.Currency).HasColumnName("currency").HasMaxLength(8).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.PaymentStatus).HasColumnName("payment_status").HasMaxLength(30).IsRequired();
            entity.Property(x => x.CheckoutPayloadJson).HasColumnName("checkout_payload_json").IsRequired();
            entity.Property(x => x.BillingPayloadJson).HasColumnName("billing_payload_json").IsRequired();
            entity.Property(x => x.IdempotencyKey).HasColumnName("idempotency_key").HasMaxLength(120);
            entity.Property(x => x.CompletedAt).HasColumnName("completed_at");
            entity.Property(x => x.ProvisionedAt).HasColumnName("provisioned_at");
            entity.Property(x => x.Error).HasColumnName("error");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => x.CheckoutReference).IsUnique();
            entity.HasIndex(x => x.ProviderPaymentReference);
            entity.HasIndex(x => x.IdempotencyKey);
            entity.HasIndex(x => x.CreatedAt);
        });

        modelBuilder.Entity<Device>(entity =>
        {
            entity.ToTable("devices");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.BranchId).HasColumnName("branch_id");
            entity.Property(x => x.Type).HasColumnName("type").HasMaxLength(50).IsRequired();
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(150).IsRequired();
            entity.Property(x => x.LastSeenAt).HasColumnName("last_seen_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.TenantId, x.BranchId, x.Name });
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.ToTable("categories");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.ParentId).HasColumnName("parent_id");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.Name });
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.ToTable("products");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.CategoryId).HasColumnName("category_id");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
            entity.Property(x => x.Sku).HasColumnName("sku").HasMaxLength(100);
            entity.Property(x => x.Barcode).HasColumnName("barcode").HasMaxLength(64);
            entity.Property(x => x.Unit).HasColumnName("unit").HasMaxLength(20).IsRequired();
            entity.Property(x => x.SalePrice).HasColumnName("sale_price").HasPrecision(18, 2);
            entity.Property(x => x.PurchasePrice).HasColumnName("purchase_price").HasPrecision(18, 2);
            entity.Property(x => x.TaxRate).HasPrecision(18, 4).HasColumnName("tax_rate");
            entity.Property(x => x.StockTrackingEnabled).HasColumnName("stock_tracking_enabled");
            entity.Property(x => x.MinStock).HasColumnName("min_stock").HasPrecision(18, 4);
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.TenantId, x.Sku }).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.Barcode })
                .IsUnique()
                .HasFilter("\"barcode\" IS NOT NULL AND btrim(\"barcode\") <> ''");
            entity.HasIndex(x => new { x.TenantId, x.CategoryId });
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<ProductVariant>(entity =>
        {
            entity.ToTable("product_variants");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.ProductId).HasColumnName("product_id");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(160).IsRequired();
            entity.Property(x => x.Sku).HasColumnName("sku").HasMaxLength(100);
            entity.Property(x => x.Barcode).HasColumnName("barcode").HasMaxLength(64);
            entity.Property(x => x.AttributesJson).HasColumnName("attributes_json").IsRequired();
            entity.Property(x => x.PriceDelta).HasColumnName("price_delta").HasPrecision(18, 2);
            entity.Property(x => x.StockTrackingEnabled).HasColumnName("stock_tracking_enabled");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.TenantId, x.ProductId });
            entity.HasIndex(x => new { x.TenantId, x.Barcode });
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<ProductBarcode>(entity =>
        {
            entity.ToTable("product_barcodes");
            entity.HasKey(x => new { x.ProductId, x.Barcode });
            entity.Property(x => x.ProductId).HasColumnName("product_id");
            entity.Property(x => x.Barcode).HasColumnName("barcode").HasMaxLength(64).IsRequired();
            entity.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId);
        });

        modelBuilder.Entity<Warehouse>(entity =>
        {
            entity.ToTable("warehouses");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(150).IsRequired();
            entity.Property(x => x.Type).HasColumnName("type").HasMaxLength(30).IsRequired();
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.TenantId, x.Name }).IsUnique();
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<StockByWarehouse>(entity =>
        {
            entity.ToTable("stock_by_warehouse");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.ProductId).HasColumnName("product_id");
            entity.Property(x => x.WarehouseId).HasColumnName("warehouse_id");
            entity.Property(x => x.Quantity).HasColumnName("quantity").HasPrecision(18, 4);
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.TenantId, x.ProductId, x.WarehouseId }).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.WarehouseId, x.ProductId });
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<WarehouseTransfer>(entity =>
        {
            entity.ToTable("warehouse_transfers");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.FromWarehouseId).HasColumnName("from_warehouse_id");
            entity.Property(x => x.ToWarehouseId).HasColumnName("to_warehouse_id");
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.CompletedAt).HasColumnName("completed_at");
            entity.HasIndex(x => new { x.TenantId, x.Status, x.CreatedAt });
            entity.HasMany(x => x.Lines).WithOne().HasForeignKey(x => x.TransferId).OnDelete(DeleteBehavior.Cascade);
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<WarehouseTransferLine>(entity =>
        {
            entity.ToTable("warehouse_transfer_lines");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TransferId).HasColumnName("transfer_id");
            entity.Property(x => x.ProductId).HasColumnName("product_id");
            entity.Property(x => x.Quantity).HasColumnName("quantity").HasPrecision(18, 4);
            entity.HasIndex(x => new { x.TransferId, x.ProductId });
        });

        modelBuilder.Entity<Supplier>(entity =>
        {
            entity.ToTable("suppliers");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
            entity.Property(x => x.TaxNumber).HasColumnName("tax_number").HasMaxLength(50);
            entity.Property(x => x.Phone).HasColumnName("phone").HasMaxLength(40);
            entity.Property(x => x.Email).HasColumnName("email").HasMaxLength(320);
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.TenantId, x.Name });
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<PurchaseOrder>(entity =>
        {
            entity.ToTable("purchase_orders");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.SupplierId).HasColumnName("supplier_id");
            entity.Property(x => x.WarehouseId).HasColumnName("warehouse_id");
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.ReceivedAt).HasColumnName("received_at");
            entity.HasIndex(x => new { x.TenantId, x.Status, x.CreatedAt });
            entity.HasMany(x => x.Lines).WithOne().HasForeignKey(x => x.PurchaseOrderId).OnDelete(DeleteBehavior.Cascade);
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<PurchaseOrderLine>(entity =>
        {
            entity.ToTable("purchase_order_lines");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.PurchaseOrderId).HasColumnName("purchase_order_id");
            entity.Property(x => x.ProductId).HasColumnName("product_id");
            entity.Property(x => x.Quantity).HasColumnName("quantity").HasPrecision(18, 4);
            entity.Property(x => x.UnitCost).HasColumnName("unit_cost").HasPrecision(18, 4);
            entity.HasIndex(x => new { x.PurchaseOrderId, x.ProductId });
        });

        modelBuilder.Entity<BillOfMaterials>(entity =>
        {
            entity.ToTable("bill_of_materials");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.ProductId).HasColumnName("product_id");
            entity.Property(x => x.Code).HasColumnName("code").HasMaxLength(80);
            entity.Property(x => x.Version).HasColumnName("version");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.TenantId, x.ProductId, x.Version }).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.ProductId, x.IsActive });
            entity.HasMany(x => x.Lines).WithOne().HasForeignKey(x => x.BomId).OnDelete(DeleteBehavior.Cascade);
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<BillOfMaterialsLine>(entity =>
        {
            entity.ToTable("bill_of_material_lines");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.BomId).HasColumnName("bom_id");
            entity.Property(x => x.ComponentProductId).HasColumnName("component_product_id");
            entity.Property(x => x.Quantity).HasColumnName("quantity").HasPrecision(18, 4);
            entity.HasIndex(x => new { x.BomId, x.ComponentProductId }).IsUnique();
        });

        modelBuilder.Entity<ProductionOrder>(entity =>
        {
            entity.ToTable("production_orders");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.BomId).HasColumnName("bom_id");
            entity.Property(x => x.FinishedProductId).HasColumnName("finished_product_id");
            entity.Property(x => x.PlannedQuantity).HasColumnName("planned_quantity").HasPrecision(18, 4);
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.TenantId, x.Status, x.CreatedAt });
            entity.HasIndex(x => new { x.TenantId, x.FinishedProductId, x.CreatedAt });
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<StockMove>(entity =>
        {
            entity.ToTable("stock_moves");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.BranchId).HasColumnName("branch_id");
            entity.Property(x => x.ProductId).HasColumnName("product_id");
            entity.Property(x => x.WarehouseId).HasColumnName("warehouse_id");
            entity.Property(x => x.QtyDelta).HasPrecision(18, 4).HasColumnName("qty_delta");
            entity.Property(x => x.Reason).HasColumnName("reason").HasMaxLength(150).IsRequired();
            entity.Property(x => x.RefType).HasMaxLength(100).HasColumnName("ref_type");
            entity.Property(x => x.RefId).HasMaxLength(100).HasColumnName("ref_id");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.TenantId, x.BranchId, x.ProductId, x.CreatedAt });
            entity.HasIndex(x => new { x.TenantId, x.WarehouseId, x.ProductId, x.CreatedAt });
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<StockBalance>(entity =>
        {
            entity.ToTable("stock_balances");
            entity.HasKey(x => new { x.TenantId, x.BranchId, x.ProductId });
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.BranchId).HasColumnName("branch_id");
            entity.Property(x => x.ProductId).HasColumnName("product_id");
            entity.Property(x => x.Qty).HasColumnName("qty").HasPrecision(18, 4);
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<Sale>(entity =>
        {
            entity.ToTable("sales");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.BranchId).HasColumnName("branch_id");
            entity.Property(x => x.DeviceId).HasColumnName("device_id");
            entity.Property(x => x.ReceiptNo).HasColumnName("receipt_no").HasMaxLength(80).IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20);
            entity.Property(x => x.Subtotal).HasColumnName("subtotal").HasPrecision(18, 2);
            entity.Property(x => x.Discount).HasColumnName("discount").HasPrecision(18, 2);
            entity.Property(x => x.Tax).HasColumnName("tax").HasPrecision(18, 2);
            entity.Property(x => x.Total).HasColumnName("total").HasPrecision(18, 2);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.TenantId, x.BranchId, x.CreatedAt });
            entity.HasIndex(x => new { x.TenantId, x.ReceiptNo });
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
            entity.HasMany(x => x.Lines).WithOne().HasForeignKey(x => x.SaleId);
            entity.HasMany(x => x.Payments).WithOne().HasForeignKey(x => x.SaleId);
        });

        modelBuilder.Entity<SaleLine>(entity =>
        {
            entity.ToTable("sale_lines");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.SaleId).HasColumnName("sale_id");
            entity.Property(x => x.ProductId).HasColumnName("product_id");
            entity.Property(x => x.Qty).HasColumnName("qty").HasPrecision(18, 4);
            entity.Property(x => x.UnitPrice).HasColumnName("unit_price").HasPrecision(18, 2);
            entity.Property(x => x.Discount).HasColumnName("discount").HasPrecision(18, 2);
            entity.Property(x => x.Tax).HasColumnName("tax").HasPrecision(18, 2);
            entity.Property(x => x.LineTotal).HasColumnName("line_total").HasPrecision(18, 2);
        });

        modelBuilder.Entity<Payment>(entity =>
        {
            entity.ToTable("payments");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.SaleId).HasColumnName("sale_id");
            entity.Property(x => x.Method).HasColumnName("method").HasConversion<string>().HasMaxLength(20);
            entity.Property(x => x.Amount).HasColumnName("amount").HasPrecision(18, 2);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<Contact>(entity =>
        {
            entity.ToTable("contacts");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.Type).HasColumnName("type").HasConversion<string>().HasMaxLength(20);
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
            entity.Property(x => x.Phone).HasColumnName("phone").HasMaxLength(40);
            entity.Property(x => x.Email).HasColumnName("email").HasMaxLength(320);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.TenantId, x.Type, x.Name });
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<ContactLedger>(entity =>
        {
            entity.ToTable("contact_ledger");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.ContactId).HasColumnName("contact_id");
            entity.Property(x => x.AmountDelta).HasColumnName("amount_delta").HasPrecision(18, 2);
            entity.Property(x => x.Reason).HasColumnName("reason").HasMaxLength(150).IsRequired();
            entity.Property(x => x.RefType).HasColumnName("ref_type").HasMaxLength(100);
            entity.Property(x => x.RefId).HasColumnName("ref_id").HasMaxLength(100);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.TenantId, x.ContactId, x.CreatedAt });
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<CustomerCurrentAccount>(entity =>
        {
            entity.ToTable("customer_current_accounts");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.CustomerId).HasColumnName("customer_id");
            entity.Property(x => x.Balance).HasColumnName("balance").HasPrecision(18, 2);
            entity.Property(x => x.Currency).HasColumnName("currency").HasMaxLength(10).IsRequired();
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.TenantId, x.CustomerId }).IsUnique();
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<CustomerCurrentAccountEntry>(entity =>
        {
            entity.ToTable("customer_account_entries");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.CustomerId).HasColumnName("customer_id");
            entity.Property(x => x.Type).HasColumnName("type").HasMaxLength(40).IsRequired();
            entity.Property(x => x.Amount).HasColumnName("amount").HasPrecision(18, 2);
            entity.Property(x => x.RefType).HasColumnName("ref_type").HasMaxLength(100).IsRequired();
            entity.Property(x => x.RefId).HasColumnName("ref_id").HasMaxLength(120).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.Note).HasColumnName("note").HasMaxLength(500);
            entity.HasIndex(x => new { x.TenantId, x.CustomerId, x.CreatedAt });
            entity.HasIndex(x => new { x.TenantId, x.CustomerId, x.Type, x.RefType, x.RefId }).IsUnique();
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<AccountingExportItem>(entity =>
        {
            entity.ToTable("accounting_export_items");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.SourceType).HasColumnName("source_type").HasMaxLength(40).IsRequired();
            entity.Property(x => x.SourceId).HasColumnName("source_id").HasMaxLength(120).IsRequired();
            entity.Property(x => x.EventCode).HasColumnName("event_code").HasMaxLength(80).IsRequired();
            entity.Property(x => x.PayloadJson).HasColumnName("payload_json").IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.ExportedAt).HasColumnName("exported_at");
            entity.Property(x => x.FailureReason).HasColumnName("failure_reason").HasMaxLength(600);
            entity.HasIndex(x => new { x.TenantId, x.Status, x.CreatedAt });
            entity.HasIndex(x => new { x.TenantId, x.SourceType, x.SourceId }).IsUnique();
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<CashTransaction>(entity =>
        {
            entity.ToTable("cash_transactions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.BranchId).HasColumnName("branch_id");
            entity.Property(x => x.Type).HasColumnName("type").HasConversion<string>().HasMaxLength(20);
            entity.Property(x => x.Amount).HasColumnName("amount").HasPrecision(18, 2);
            entity.Property(x => x.Reason).HasColumnName("reason").HasMaxLength(150).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.TenantId, x.BranchId, x.CreatedAt });
            entity.HasQueryFilter(x => !CurrentTenantId.HasValue || x.TenantId == (CurrentTenantId ?? Guid.Empty));
        });

        modelBuilder.Entity<ProcessedEvent>(entity =>
        {
            entity.ToTable("processed_events");
            entity.HasKey(x => x.EventId);
            entity.Property(x => x.EventId).HasColumnName("event_id");
            entity.Property(x => x.TenantId).HasColumnName("tenant_id");
            entity.Property(x => x.DeviceId).HasColumnName("device_id");
            entity.Property(x => x.ProcessedAt).HasColumnName("processed_at");
            entity.HasIndex(x => new { x.TenantId, x.DeviceId, x.ProcessedAt });
        });

        modelBuilder.ConfigureIntegrationEntities(CurrentTenantId);
        modelBuilder.ConfigureAnalyticsWarehouseEntities();
        modelBuilder.ConfigureInternalAdminEntities();
        modelBuilder.ConfigureProductionOpsEntities();
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        base.OnModelCreating(modelBuilder);
    }

    private void ApplyTenantRules()
    {
        var trackedTenantEntities = ChangeTracker
            .Entries()
            .Where(e => e.Entity is ITenantEntity && e.State == EntityState.Added);

        foreach (var trackedEntity in trackedTenantEntities)
        {
            var entity = (ITenantEntity)trackedEntity.Entity;
            if (entity.TenantId != Guid.Empty)
            {
                continue;
            }

            if (!CurrentTenantId.HasValue)
            {
                throw new InvalidOperationException("Tenant context is required for tenant scoped entities.");
            }

            entity.TenantId = CurrentTenantId.Value;
        }
    }

    private void ApplyCreatedAtRules()
    {
        var trackedCreatedAtEntities = ChangeTracker
            .Entries()
            .Where(e => e.Entity is ICreatedAtEntity && e.State == EntityState.Added);

        foreach (var trackedEntity in trackedCreatedAtEntities)
        {
            var entity = (ICreatedAtEntity)trackedEntity.Entity;
            if (entity.CreatedAt == default)
            {
                entity.CreatedAt = DateTimeOffset.UtcNow;
            }
        }
    }

    private void ApplyUpdatedAtRules()
    {
        var trackedUpdatedAtEntities = ChangeTracker
            .Entries()
            .Where(e => e.Entity is IUpdatedAtEntity &&
                (e.State == EntityState.Added || e.State == EntityState.Modified));

        foreach (var trackedEntity in trackedUpdatedAtEntities)
        {
            var entity = (IUpdatedAtEntity)trackedEntity.Entity;
            entity.UpdatedAt = DateTimeOffset.UtcNow;
        }
    }
}
