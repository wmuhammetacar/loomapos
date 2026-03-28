using LoomaPos.Domain.Common;
using LoomaPos.Domain.Integrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LoomaPos.Infrastructure.Persistence;

internal static class IntegrationModelBuilderExtensions
{
    public static void ConfigureIntegrationEntities(this ModelBuilder modelBuilder, Guid? currentTenantId)
    {
        modelBuilder.Entity<IntegrationConnection>(entity =>
        {
            entity.ToTable("integration_connections");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.IntegrationDomain, x.ProviderCode });
            entity.HasIndex(x => new { x.TenantId, x.Status, x.HealthState });
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<IntegrationCredential>(entity =>
        {
            entity.ToTable("integration_credentials");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.IntegrationConnectionId, x.SecretName }).IsUnique();
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<IntegrationConfig>(entity =>
        {
            entity.ToTable("integration_configs");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.IntegrationConnectionId }).IsUnique();
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<IntegrationMapping>(entity =>
        {
            entity.ToTable("integration_mappings");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.IntegrationConnectionId, x.MappingType, x.SourceValue }).IsUnique();
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<IntegrationJob>(entity =>
        {
            entity.ToTable("integration_jobs");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.Status, x.NextRetryAt });
            entity.HasIndex(x => new { x.TenantId, x.IdempotencyKey }).IsUnique();
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<IntegrationJobAttempt>(entity =>
        {
            entity.ToTable("integration_job_attempts");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.IntegrationJobId, x.AttemptNo }).IsUnique();
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<IntegrationEvent>(entity =>
        {
            entity.ToTable("integration_events");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.EventType, x.CreatedAt });
            entity.HasIndex(x => new { x.TenantId, x.IdempotencyKey }).IsUnique();
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<IntegrationLog>(entity =>
        {
            entity.ToTable("integration_logs");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.CreatedAt });
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<IntegrationFailure>(entity =>
        {
            entity.ToTable("integration_failures");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.Status, x.Severity, x.CreatedAt });
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<IntegrationHealthSnapshot>(entity =>
        {
            entity.ToTable("integration_health_snapshots");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.CreatedAt });
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<IntegrationRateLimitRecord>(entity =>
        {
            entity.ToTable("integration_rate_limit_records");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.CounterKey, x.WindowCode }).IsUnique();
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<ProviderWebhookEvent>(entity =>
        {
            entity.ToTable("provider_webhook_events");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.ProviderCode, x.EventKey }).IsUnique();
            entity.HasIndex(x => new { x.Status, x.CreatedAt });
        });

        modelBuilder.Entity<OutboundWebhookEndpoint>(entity =>
        {
            entity.ToTable("outbound_webhook_endpoints");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.TargetUrl }).IsUnique();
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<OutboundWebhookSubscription>(entity =>
        {
            entity.ToTable("outbound_webhook_subscriptions");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.OutboundWebhookEndpointId, x.Topic }).IsUnique();
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<OutboundWebhookDelivery>(entity =>
        {
            entity.ToTable("outbound_webhook_deliveries");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.OutboundWebhookEndpointId, x.Status, x.CreatedAt });
            entity.HasIndex(x => new { x.TenantId, x.IdempotencyKey }).IsUnique();
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<ApiClient>(entity =>
        {
            entity.ToTable("api_clients");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.Name }).IsUnique();
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<ApiKey>(entity =>
        {
            entity.ToTable("api_keys");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.ApiClientId, x.KeyPrefix }).IsUnique();
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<ApiScope>(entity =>
        {
            entity.ToTable("api_scopes");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.ApiClientId, x.ScopeCode }).IsUnique();
        });

        modelBuilder.Entity<ApiUsageLog>(entity =>
        {
            entity.ToTable("api_usage_logs");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.CreatedAt });
            entity.HasIndex(x => new { x.ApiClientId, x.CreatedAt });
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<InvoiceDocument>(entity =>
        {
            entity.ToTable("invoice_documents");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.DocumentNumber }).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.Status, x.CreatedAt });
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<InvoiceDocumentLine>(entity =>
        {
            entity.ToTable("invoice_document_lines");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.InvoiceDocumentId });
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<InvoiceDocumentStatusHistory>(entity =>
        {
            entity.ToTable("invoice_document_status_history");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.InvoiceDocumentId, x.CreatedAt });
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<InvoiceProviderSubmission>(entity =>
        {
            entity.ToTable("invoice_provider_submissions");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.InvoiceDocumentId, x.IdempotencyKey }).IsUnique();
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<InvoiceArtifact>(entity =>
        {
            entity.ToTable("invoice_artifacts");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.InvoiceDocumentId, x.ArtifactType });
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<InvoiceMappingError>(entity =>
        {
            entity.ToTable("invoice_mapping_errors");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.Status, x.CreatedAt });
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<FiscalDeviceBinding>(entity =>
        {
            entity.ToTable("fiscal_device_bindings");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.ProviderCode, x.TerminalCode }).IsUnique();
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<FiscalCommandLog>(entity =>
        {
            entity.ToTable("fiscal_command_logs");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.FiscalDeviceBindingId, x.CreatedAt });
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<AccountingSyncRecord>(entity =>
        {
            entity.ToTable("accounting_sync_records");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.RecordType, x.InternalReference }).IsUnique();
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<EcommerceSyncRecord>(entity =>
        {
            entity.ToTable("ecommerce_sync_records");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.ChannelCode, x.InternalReference, x.SyncType }).IsUnique();
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<MessagingDeliveryRecord>(entity =>
        {
            entity.ToTable("messaging_delivery_records");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.Channel, x.CreatedAt });
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<IntegrationArtifact>(entity =>
        {
            entity.ToTable("integration_artifacts");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.ArtifactDomain, x.CreatedAt });
            ApplyTenantFilter(entity, currentTenantId);
        });

        modelBuilder.Entity<IntegrationAuditLog>(entity =>
        {
            entity.ToTable("integration_audit_logs");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.CreatedAt });
            entity.HasIndex(x => new { x.TenantId, x.Action, x.CreatedAt });
            ApplyTenantFilter(entity, currentTenantId);
        });
    }

    private static void ApplyTenantFilter<TEntity>(EntityTypeBuilder<TEntity> entity, Guid? currentTenantId)
        where TEntity : class, ITenantEntity
    {
        entity.HasQueryFilter(x => !currentTenantId.HasValue || x.TenantId == (currentTenantId ?? Guid.Empty));
    }
}
