using System.Text.Json;
using LoomaPos.Api.Commerce;
using LoomaPos.Application.Integrations;
using LoomaPos.Domain.Auditing;
using LoomaPos.Domain.Integrations;
using LoomaPos.Infrastructure.Integration;
using LoomaPos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace LoomaPos.Api.Integrations;

public interface IIntegrationPlatformService
{
    Task<TenantIntegrationWorkspaceDto> GetTenantWorkspaceAsync(Guid tenantId, CancellationToken cancellationToken);
    Task<IntegrationConnectionDto> SaveConnectionAsync(Guid tenantId, SaveIntegrationConnectionRequest request, string actor, CancellationToken cancellationToken);
    Task<IntegrationConnectionDto> UpdateConnectionAsync(Guid tenantId, Guid connectionId, UpdateIntegrationConnectionRequest request, string actor, CancellationToken cancellationToken);
    Task<IntegrationConnectionDto> ValidateConnectionAsync(Guid tenantId, Guid connectionId, string actor, CancellationToken cancellationToken);
    Task<IntegrationConnectionDto> ToggleConnectionAsync(Guid tenantId, Guid connectionId, bool enabled, string actor, CancellationToken cancellationToken);
    Task<IntegrationWebhookDto> CreateWebhookEndpointAsync(Guid tenantId, CreateWebhookEndpointRequest request, string actor, CancellationToken cancellationToken);
    Task<IntegrationWebhookDto> RotateWebhookSecretAsync(Guid tenantId, Guid endpointId, string actor, CancellationToken cancellationToken);
    Task<IntegrationJobDto> TestWebhookAsync(Guid tenantId, Guid endpointId, string actor, CancellationToken cancellationToken);
    Task<(IntegrationApiClientDto Client, string PlaintextKey)> CreateApiClientAsync(Guid tenantId, CreateApiClientRequest request, string actor, CancellationToken cancellationToken);
    Task<bool> RevokeApiKeyAsync(Guid tenantId, Guid apiKeyId, string actor, CancellationToken cancellationToken);
    Task<AdminIntegrationWorkspaceDto> GetAdminWorkspaceAsync(CancellationToken cancellationToken);
    Task<IntegrationJobDto?> RetryJobAsync(Guid jobId, string reason, string actor, CancellationToken cancellationToken);
    Task<IReadOnlyList<IntegrationJobDto>> ReplayDeadLetterJobsAsync(Guid? tenantId, int maxCount, string reason, string actor, CancellationToken cancellationToken);
    Task<IntegrationMappingPreviewDto> PreviewMappingAsync(Guid tenantId, Guid connectionId, IntegrationMappingPreviewRequest request, CancellationToken cancellationToken);
    Task<IntegrationProviderEventDto> RecordInboundWebhookAsync(string providerCode, string eventKey, string eventType, string signature, string payloadJson, Guid? tenantId, CancellationToken cancellationToken);
}

public sealed class IntegrationPlatformService : IIntegrationPlatformService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly AppDbContext _dbContext;
    private readonly IIntegrationProviderRegistry _providerRegistry;
    private readonly IIntegrationSecretService _secretService;
    private readonly IPortalCryptoService _cryptoService;

    public IntegrationPlatformService(
        AppDbContext dbContext,
        IIntegrationProviderRegistry providerRegistry,
        IIntegrationSecretService secretService,
        IPortalCryptoService cryptoService)
    {
        _dbContext = dbContext;
        _providerRegistry = providerRegistry;
        _secretService = secretService;
        _cryptoService = cryptoService;
    }

    public async Task<TenantIntegrationWorkspaceDto> GetTenantWorkspaceAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var connections = await _dbContext.IntegrationConnections.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderBy(x => x.IntegrationDomain)
            .ThenBy(x => x.DisplayName)
            .ToListAsync(cancellationToken);
        var mappings = await _dbContext.IntegrationMappings.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToListAsync(cancellationToken);
        var jobs = await _dbContext.IntegrationJobs.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(20)
            .ToListAsync(cancellationToken);
        var failures = await _dbContext.IntegrationFailures.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(12)
            .ToListAsync(cancellationToken);
        var webhooks = await _dbContext.OutboundWebhookEndpoints.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);
        var webhookTopics = await _dbContext.OutboundWebhookSubscriptions.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToListAsync(cancellationToken);
        var apiClients = await _dbContext.ApiClients.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);
        var apiKeys = await _dbContext.ApiKeys.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToListAsync(cancellationToken);
        var clientIds = apiClients.Select(client => client.Id).ToArray();
        var scopes = await _dbContext.ApiScopes.AsNoTracking()
            .Where(x => x.ApiClientId != null && clientIds.Contains(x.ApiClientId.Value))
            .ToListAsync(cancellationToken);

        return new TenantIntegrationWorkspaceDto(
            Catalog: BuildCatalog(),
            Connections: connections.Select(connection => ToConnectionDto(connection, mappings, jobs)).ToArray(),
            Webhooks: webhooks.Select(endpoint => ToWebhookDto(endpoint, webhookTopics)).ToArray(),
            ApiClients: apiClients.Select(client => ToApiClientDto(client, apiKeys, scopes)).ToArray(),
            RecentJobs: jobs.Select(ToJobDto).ToArray(),
            RecentFailures: failures.Select(ToFailureDto).ToArray(),
            Notices: BuildTenantNotices(connections, failures, jobs));
    }

    public async Task<IntegrationConnectionDto> SaveConnectionAsync(Guid tenantId, SaveIntegrationConnectionRequest request, string actor, CancellationToken cancellationToken)
    {
        var adapter = ResolveAdapter(request.Domain, request.ProviderCode);
        var connection = await _dbContext.IntegrationConnections
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.IntegrationDomain == request.Domain && x.ProviderCode == request.ProviderCode, cancellationToken);

        if (connection is null)
        {
            connection = new IntegrationConnection
            {
                TenantId = tenantId,
                IntegrationDomain = request.Domain,
                ProviderCode = request.ProviderCode,
                DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? adapter.DisplayName : request.DisplayName.Trim(),
                Status = "draft",
                Enabled = request.Enabled,
                Mode = request.Mode,
                SyncMode = request.SyncMode,
                HealthState = "pending",
                CreatedBy = actor,
                UpdatedBy = actor
            };
            _dbContext.IntegrationConnections.Add(connection);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        else
        {
            connection.DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? connection.DisplayName : request.DisplayName.Trim();
            connection.Enabled = request.Enabled;
            connection.Mode = request.Mode;
            connection.SyncMode = request.SyncMode;
            connection.UpdatedBy = actor;
        }

        await UpsertCredentialsAsync(tenantId, connection.Id, request.Secrets, cancellationToken);
        await UpsertConfigAsync(tenantId, connection.Id, request.Settings, request.RequiredMappings.Keys.ToArray(), cancellationToken);
        await UpsertMappingsAsync(tenantId, connection.Id, request.RequiredMappings, cancellationToken);
        await ValidateCoreAsync(connection, actor, cancellationToken);
        await RecordAuditAsync(tenantId, connection.Id, "integration.connection.saved", actor, $"Saved {request.Domain}/{request.ProviderCode} connection.", request, cancellationToken);

        return await BuildConnectionAsync(tenantId, connection.Id, cancellationToken)
            ?? throw new InvalidOperationException("Connection could not be loaded.");
    }

    public async Task<IntegrationConnectionDto> UpdateConnectionAsync(Guid tenantId, Guid connectionId, UpdateIntegrationConnectionRequest request, string actor, CancellationToken cancellationToken)
    {
        var connection = await _dbContext.IntegrationConnections.FirstOrDefaultAsync(x => x.Id == connectionId && x.TenantId == tenantId, cancellationToken)
            ?? throw new InvalidOperationException("Integration connection not found.");

        if (!string.IsNullOrWhiteSpace(request.DisplayName))
        {
            connection.DisplayName = request.DisplayName.Trim();
        }
        if (!string.IsNullOrWhiteSpace(request.Mode))
        {
            connection.Mode = request.Mode.Trim();
        }
        if (!string.IsNullOrWhiteSpace(request.SyncMode))
        {
            connection.SyncMode = request.SyncMode.Trim();
        }
        if (request.Enabled.HasValue)
        {
            connection.Enabled = request.Enabled.Value;
        }
        connection.UpdatedBy = actor;

        if (request.Secrets is not null)
        {
            await UpsertCredentialsAsync(tenantId, connection.Id, request.Secrets, cancellationToken);
        }
        if (request.Settings is not null)
        {
            await UpsertConfigAsync(tenantId, connection.Id, request.Settings, null, cancellationToken);
        }
        if (request.RequiredMappings is not null)
        {
            await UpsertMappingsAsync(tenantId, connection.Id, request.RequiredMappings, cancellationToken);
        }

        await ValidateCoreAsync(connection, actor, cancellationToken);
        await RecordAuditAsync(tenantId, connection.Id, "integration.connection.updated", actor, $"Updated {connection.IntegrationDomain}/{connection.ProviderCode}.", request, cancellationToken);

        return await BuildConnectionAsync(tenantId, connection.Id, cancellationToken)
            ?? throw new InvalidOperationException("Connection could not be loaded.");
    }

    public async Task<IntegrationConnectionDto> ValidateConnectionAsync(Guid tenantId, Guid connectionId, string actor, CancellationToken cancellationToken)
    {
        var connection = await _dbContext.IntegrationConnections.FirstOrDefaultAsync(x => x.Id == connectionId && x.TenantId == tenantId, cancellationToken)
            ?? throw new InvalidOperationException("Integration connection not found.");

        await ValidateCoreAsync(connection, actor, cancellationToken);
        await RecordAuditAsync(tenantId, connection.Id, "integration.connection.validated", actor, "Connection validation requested.", new { connectionId }, cancellationToken);

        return await BuildConnectionAsync(tenantId, connection.Id, cancellationToken)
            ?? throw new InvalidOperationException("Connection could not be loaded.");
    }

    public async Task<IntegrationConnectionDto> ToggleConnectionAsync(Guid tenantId, Guid connectionId, bool enabled, string actor, CancellationToken cancellationToken)
    {
        var connection = await _dbContext.IntegrationConnections.FirstOrDefaultAsync(x => x.Id == connectionId && x.TenantId == tenantId, cancellationToken)
            ?? throw new InvalidOperationException("Integration connection not found.");

        connection.Enabled = enabled;
        connection.Status = enabled ? "active" : "disabled";
        connection.HealthState = enabled ? connection.HealthState : "disabled";
        connection.UpdatedBy = actor;
        await _dbContext.SaveChangesAsync(cancellationToken);

        await RecordAuditAsync(tenantId, connection.Id, enabled ? "integration.connection.enabled" : "integration.connection.disabled", actor, "Connection state changed.", new { enabled }, cancellationToken);

        return await BuildConnectionAsync(tenantId, connection.Id, cancellationToken)
            ?? throw new InvalidOperationException("Connection could not be loaded.");
    }

    public async Task<IntegrationWebhookDto> CreateWebhookEndpointAsync(Guid tenantId, CreateWebhookEndpointRequest request, string actor, CancellationToken cancellationToken)
    {
        var secret = _cryptoService.GenerateOpaqueToken(20);
        var endpoint = new OutboundWebhookEndpoint
        {
            TenantId = tenantId,
            Name = request.Name.Trim(),
            TargetUrl = request.TargetUrl.Trim(),
            SecretCiphertext = _secretService.Protect(secret),
            SecretMask = _secretService.Mask(secret),
            Enabled = request.Enabled,
            Status = request.Enabled ? "active" : "disabled"
        };
        _dbContext.OutboundWebhookEndpoints.Add(endpoint);
        await _dbContext.SaveChangesAsync(cancellationToken);

        foreach (var topic in request.Topics.Where(topic => !string.IsNullOrWhiteSpace(topic)).Select(topic => topic.Trim()).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            _dbContext.OutboundWebhookSubscriptions.Add(new OutboundWebhookSubscription
            {
                TenantId = tenantId,
                OutboundWebhookEndpointId = endpoint.Id,
                Topic = topic,
                Enabled = true
            });
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        await RecordAuditAsync(tenantId, endpoint.Id, "integration.webhook.created", actor, "Outbound webhook endpoint created.", request, cancellationToken);

        var subscriptions = await _dbContext.OutboundWebhookSubscriptions.AsNoTracking().Where(x => x.TenantId == tenantId && x.OutboundWebhookEndpointId == endpoint.Id).ToListAsync(cancellationToken);
        return ToWebhookDto(endpoint, subscriptions);
    }

    public async Task<IntegrationWebhookDto> RotateWebhookSecretAsync(Guid tenantId, Guid endpointId, string actor, CancellationToken cancellationToken)
    {
        var endpoint = await _dbContext.OutboundWebhookEndpoints.FirstOrDefaultAsync(x => x.Id == endpointId && x.TenantId == tenantId, cancellationToken)
            ?? throw new InvalidOperationException("Webhook endpoint not found.");
        var secret = _cryptoService.GenerateOpaqueToken(20);
        endpoint.SecretCiphertext = _secretService.Protect(secret);
        endpoint.SecretMask = _secretService.Mask(secret);
        endpoint.UpdatedAt = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        await RecordAuditAsync(tenantId, endpoint.Id, "integration.webhook.secret_rotated", actor, "Webhook secret rotated.", new { endpointId }, cancellationToken);

        var subscriptions = await _dbContext.OutboundWebhookSubscriptions.AsNoTracking().Where(x => x.TenantId == tenantId && x.OutboundWebhookEndpointId == endpoint.Id).ToListAsync(cancellationToken);
        return ToWebhookDto(endpoint, subscriptions);
    }

    public async Task<IntegrationJobDto> TestWebhookAsync(Guid tenantId, Guid endpointId, string actor, CancellationToken cancellationToken)
    {
        var endpoint = await _dbContext.OutboundWebhookEndpoints.AsNoTracking().FirstOrDefaultAsync(x => x.Id == endpointId && x.TenantId == tenantId, cancellationToken)
            ?? throw new InvalidOperationException("Webhook endpoint not found.");
        var payload = JsonSerializer.Serialize(new
        {
            eventType = "integration.test",
            generatedAt = DateTimeOffset.UtcNow,
            tenantId
        }, JsonOptions);
        var secret = _secretService.Unprotect(endpoint.SecretCiphertext);
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        var signature = WebhookSignatureV1.BuildHeader(secret, payload, timestamp);
        var eventEntity = new IntegrationEvent
        {
            TenantId = tenantId,
            EventType = "integration.test",
            AggregateType = "webhook",
            AggregateId = endpoint.Id.ToString(),
            PayloadJson = payload,
            Status = "sent",
            IdempotencyKey = $"wh-test-{Guid.NewGuid():N}"
        };
        _dbContext.IntegrationEvents.Add(eventEntity);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var delivery = new OutboundWebhookDelivery
        {
            TenantId = tenantId,
            OutboundWebhookEndpointId = endpointId,
            IntegrationEventId = eventEntity.Id,
            Topic = "integration.test",
            PayloadJson = payload,
            Signature = signature,
            Status = "sent",
            IdempotencyKey = eventEntity.IdempotencyKey,
            DeliveredAt = DateTimeOffset.UtcNow,
            ResponseSummary = "Phase 9 test delivery stored for diagnostics."
        };
        var job = new IntegrationJob
        {
            TenantId = tenantId,
            IntegrationConnectionId = null,
            IntegrationEventId = eventEntity.Id,
            JobType = "webhook_delivery_test",
            Status = "sent",
            IdempotencyKey = eventEntity.IdempotencyKey,
            CorrelationId = Guid.NewGuid().ToString("N"),
            BusinessObjectType = "outbound_webhook_endpoint",
            BusinessObjectId = endpointId.ToString(),
            PayloadJson = payload,
            LastAttemptAt = DateTimeOffset.UtcNow
        };
        _dbContext.OutboundWebhookDeliveries.Add(delivery);
        _dbContext.IntegrationJobs.Add(job);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await RecordAuditAsync(tenantId, endpointId, "integration.webhook.test_sent", actor, "Stored outbound webhook test delivery.", new { endpointId }, cancellationToken);
        return ToJobDto(job);
    }

    public async Task<(IntegrationApiClientDto Client, string PlaintextKey)> CreateApiClientAsync(Guid tenantId, CreateApiClientRequest request, string actor, CancellationToken cancellationToken)
    {
        var client = new ApiClient
        {
            TenantId = tenantId,
            Name = request.Name.Trim(),
            ClientType = request.ClientType.Trim(),
            Environment = request.Environment.Trim(),
            Status = "active",
            ContactEmail = string.IsNullOrWhiteSpace(request.ContactEmail) ? null : request.ContactEmail.Trim()
        };
        _dbContext.ApiClients.Add(client);
        await _dbContext.SaveChangesAsync(cancellationToken);

        foreach (var scope in request.Scopes.Where(scope => !string.IsNullOrWhiteSpace(scope)).Select(ApiScopeSet.Normalize).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            _dbContext.ApiScopes.Add(new ApiScope
            {
                ApiClientId = client.Id,
                ScopeCode = scope,
                Description = scope,
                IsGranted = true,
                ExpiresAt = request.ExpiresAt
            });
        }

        var generated = _secretService.CreateApiKey(_cryptoService);
        var apiKey = new ApiKey
        {
            TenantId = tenantId,
            ApiClientId = client.Id,
            KeyPrefix = generated.Prefix,
            SecretHash = generated.SecretHash,
            MaskedKey = generated.Masked,
            Status = "active",
            ExpiresAt = request.ExpiresAt
        };
        _dbContext.ApiKeys.Add(apiKey);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await RecordAuditAsync(tenantId, client.Id, "integration.api_client.created", actor, "Public API client created.", request, cancellationToken);

        var scopes = await _dbContext.ApiScopes.AsNoTracking().Where(x => x.ApiClientId == client.Id).ToListAsync(cancellationToken);
        return (ToApiClientDto(client, [apiKey], scopes), generated.Plaintext);
    }

    public async Task<bool> RevokeApiKeyAsync(Guid tenantId, Guid apiKeyId, string actor, CancellationToken cancellationToken)
    {
        var apiKey = await _dbContext.ApiKeys.FirstOrDefaultAsync(x => x.Id == apiKeyId && x.TenantId == tenantId, cancellationToken);
        if (apiKey is null)
        {
            return false;
        }

        apiKey.Status = "revoked";
        apiKey.RevokedAt = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        await RecordAuditAsync(tenantId, apiKey.Id, "integration.api_key.revoked", actor, "Public API key revoked.", new { apiKeyId }, cancellationToken);
        return true;
    }

    public async Task<AdminIntegrationWorkspaceDto> GetAdminWorkspaceAsync(CancellationToken cancellationToken)
    {
        var connections = await _dbContext.IntegrationConnections.AsNoTracking().OrderByDescending(x => x.UpdatedAt).Take(100).ToListAsync(cancellationToken);
        var mappings = await _dbContext.IntegrationMappings.AsNoTracking().ToListAsync(cancellationToken);
        var jobs = await _dbContext.IntegrationJobs.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(80).ToListAsync(cancellationToken);
        var failures = await _dbContext.IntegrationFailures.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(80).ToListAsync(cancellationToken);
        var webhooks = await _dbContext.OutboundWebhookEndpoints.AsNoTracking().OrderByDescending(x => x.UpdatedAt).Take(50).ToListAsync(cancellationToken);
        var subscriptions = await _dbContext.OutboundWebhookSubscriptions.AsNoTracking().ToListAsync(cancellationToken);
        var providerEvents = await _dbContext.ProviderWebhookEvents.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(80).ToListAsync(cancellationToken);
        var apiClients = await _dbContext.ApiClients.AsNoTracking().ToListAsync(cancellationToken);
        var expiredCredentials = await _dbContext.IntegrationCredentials.AsNoTracking().CountAsync(x => x.ExpiresAt != null && x.ExpiresAt < DateTimeOffset.UtcNow, cancellationToken);
        var tenantNames = await _dbContext.Tenants.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        var tenantSummaries = connections
            .GroupBy(x => x.TenantId)
            .Select(group =>
            {
                var tenantJobs = jobs.Where(job => job.TenantId == group.Key).ToArray();
                var worstHealth = group.Any(x => x.HealthState == "error") ? "error" :
                    group.Any(x => x.HealthState == "warning") ? "warning" : "healthy";

                return new AdminTenantIntegrationSummaryDto(
                    TenantId: group.Key,
                    CompanyName: tenantNames.TryGetValue(group.Key, out var companyName) ? companyName : group.Key.ToString(),
                    ConnectionCount: group.Count(),
                    UnhealthyConnections: group.Count(x => x.HealthState is "error" or "warning"),
                    PendingJobs: tenantJobs.Count(x => x.Status is "pending" or "retrying" or "queued"),
                    FailedJobs: tenantJobs.Count(x => x.Status == "failed"),
                    LastSuccessAt: group.Max(x => x.LastSuccessAt),
                    WorstHealthState: worstHealth);
            })
            .OrderByDescending(x => x.UnhealthyConnections)
            .ThenBy(x => x.CompanyName)
            .ToArray();

        var overview = new AdminIntegrationOverviewDto(
            ActiveConnections: connections.Count(x => x.Enabled),
            UnhealthyConnections: connections.Count(x => x.HealthState is "error" or "warning"),
            PendingJobs: jobs.Count(x => x.Status is "pending" or "retrying" or "queued"),
            FailedJobs: jobs.Count(x => x.Status == "failed"),
            DeadLetters: jobs.Count(x => x.Status == "dead_letter"),
            WebhookFailures: webhooks.Count(x => x.LastFailureAt.HasValue),
            MappingIssues: mappings.Count(x => x.Status is "warning" or "needs_review"),
            ExpiredCredentials: expiredCredentials,
            PublicApiClients: apiClients.Count);

        var incidents = new List<string>();
        if (overview.UnhealthyConnections > 0)
        {
            incidents.Add($"{overview.UnhealthyConnections} integration connection(s) require intervention.");
        }
        if (overview.DeadLetters > 0)
        {
            incidents.Add($"{overview.DeadLetters} integration job(s) are in dead-letter state.");
        }
        if (overview.ExpiredCredentials > 0)
        {
            incidents.Add($"{overview.ExpiredCredentials} credential record(s) are expired.");
        }
        if (incidents.Count == 0)
        {
            incidents.Add("Integration platform health is stable.");
        }

        return new AdminIntegrationWorkspaceDto(
            Overview: overview,
            TenantSummaries: tenantSummaries,
            Connections: connections.Select(connection => ToConnectionDto(connection, mappings, jobs)).ToArray(),
            Jobs: jobs.Select(ToJobDto).ToArray(),
            Failures: failures.Select(ToFailureDto).ToArray(),
            ProviderEvents: providerEvents.Select(ToProviderEventDto).ToArray(),
            Webhooks: webhooks.Select(endpoint => ToWebhookDto(endpoint, subscriptions)).ToArray(),
            Incidents: incidents);
    }

    public async Task<IntegrationJobDto?> RetryJobAsync(Guid jobId, string reason, string actor, CancellationToken cancellationToken)
    {
        var job = await _dbContext.IntegrationJobs.FirstOrDefaultAsync(x => x.Id == jobId, cancellationToken);
        if (job is null)
        {
            return null;
        }

        job.Status = "retrying";
        job.NextRetryAt = DateTimeOffset.UtcNow;
        job.ErrorCode = null;
        job.ErrorMessage = null;
        job.UpdatedAt = DateTimeOffset.UtcNow;
        _dbContext.IntegrationJobAttempts.Add(new IntegrationJobAttempt
        {
            TenantId = job.TenantId,
            IntegrationJobId = job.Id,
            AttemptNo = job.RetryCount + 1,
            Status = "retry_requested",
            ErrorMessage = reason
        });
        await _dbContext.SaveChangesAsync(cancellationToken);
        await RecordAuditAsync(job.TenantId, job.Id, "integration.job.retry_requested", actor, reason, new { jobId }, cancellationToken);
        return ToJobDto(job);
    }

    public async Task<IReadOnlyList<IntegrationJobDto>> ReplayDeadLetterJobsAsync(Guid? tenantId, int maxCount, string reason, string actor, CancellationToken cancellationToken)
    {
        var take = Math.Clamp(maxCount, 1, 200);
        var query = _dbContext.IntegrationJobs
            .Where(x => x.Status == "dead_letter");
        if (tenantId.HasValue)
        {
            query = query.Where(x => x.TenantId == tenantId.Value);
        }

        var jobs = await query
            .OrderBy(x => x.CreatedAt)
            .Take(take)
            .ToListAsync(cancellationToken);

        var now = DateTimeOffset.UtcNow;
        foreach (var job in jobs)
        {
            job.Status = "retrying";
            job.NextRetryAt = now;
            job.LastAttemptAt = now;
            job.ErrorCode = null;
            job.ErrorMessage = null;
            job.UpdatedAt = now;
            _dbContext.IntegrationJobAttempts.Add(new IntegrationJobAttempt
            {
                TenantId = job.TenantId,
                IntegrationJobId = job.Id,
                AttemptNo = job.RetryCount + 1,
                Status = "retry_requested",
                ErrorMessage = reason
            });

            _dbContext.AuditLogs.Add(new AuditLog
            {
                TenantId = job.TenantId,
                Action = "integration.dead_letter.replay_requested",
                Entity = "integration_job",
                EntityId = job.Id.ToString(),
                PayloadJson = JsonSerializer.Serialize(new { actor, reason, tenantId = job.TenantId }, JsonOptions)
            });
            _dbContext.IntegrationAuditLogs.Add(new IntegrationAuditLog
            {
                TenantId = job.TenantId,
                IntegrationConnectionId = job.IntegrationConnectionId,
                Action = "integration.dead_letter.replay_requested",
                Actor = actor,
                TargetType = "integration_job",
                TargetId = job.Id.ToString(),
                Reason = reason,
                PayloadJson = JsonSerializer.Serialize(new
                {
                    jobType = job.JobType,
                    businessObjectType = job.BusinessObjectType,
                    businessObjectId = job.BusinessObjectId
                }, JsonOptions)
            });
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return jobs.Select(ToJobDto).ToArray();
    }

    public async Task<IntegrationMappingPreviewDto> PreviewMappingAsync(Guid tenantId, Guid connectionId, IntegrationMappingPreviewRequest request, CancellationToken cancellationToken)
    {
        var connection = await _dbContext.IntegrationConnections.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == connectionId && x.TenantId == tenantId, cancellationToken)
            ?? throw new InvalidOperationException("Integration connection not found.");

        var mappings = await _dbContext.IntegrationMappings.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.IntegrationConnectionId == connectionId)
            .ToListAsync(cancellationToken);
        var source = new Dictionary<string, string>(request.SourceFields ?? new Dictionary<string, string>(), StringComparer.OrdinalIgnoreCase);
        var transformed = new Dictionary<string, string>(source, StringComparer.OrdinalIgnoreCase);

        var warnings = new List<string>();
        var mappingWarnings = mappings
            .Where(x => x.Status is "warning" or "needs_review")
            .Select(x => $"{x.MappingType}: {x.Warning ?? "mapping requires review"}");
        warnings.AddRange(mappingWarnings);

        var requiredMappings = GetRequiredMappingTypes(connection.IntegrationDomain);
        var validMappings = mappings
            .Where(x => !string.IsNullOrWhiteSpace(x.MappingType) && !string.IsNullOrWhiteSpace(x.TargetValue))
            .GroupBy(x => x.MappingType, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .ToArray();
        var missingMappings = IntegrationMappingValidator.MissingRequiredMappings(
            validMappings.Select(x => x.MappingType),
            requiredMappings);
        warnings.AddRange(missingMappings.Select(x => $"Missing required mapping: {x}"));

        var appliedMappings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var mapping in validMappings)
        {
            var mappingType = mapping.MappingType.Trim();
            var targetKey = mapping.TargetValue.Trim();
            appliedMappings[mappingType] = targetKey;

            if (source.TryGetValue(mappingType, out var value))
            {
                transformed[targetKey] = value;
            }
            else if (requiredMappings.Contains(mappingType, StringComparer.OrdinalIgnoreCase))
            {
                warnings.Add($"Source field missing for required mapping: {mappingType}");
            }
        }

        var distinctWarnings = warnings
            .Where(warning => !string.IsNullOrWhiteSpace(warning))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(warning => warning)
            .ToArray();

        return new IntegrationMappingPreviewDto(
            ConnectionId: connection.Id,
            Domain: connection.IntegrationDomain,
            ProviderCode: connection.ProviderCode,
            AggregateType: string.IsNullOrWhiteSpace(request.AggregateType) ? "unknown" : request.AggregateType.Trim(),
            EventType: string.IsNullOrWhiteSpace(request.EventType) ? "mapping.preview" : request.EventType.Trim(),
            SourceFields: new Dictionary<string, string>(source, StringComparer.OrdinalIgnoreCase),
            AppliedMappings: appliedMappings,
            TransformedFields: transformed,
            Warnings: distinctWarnings,
            ReadyToSubmit: distinctWarnings.Length == 0,
            GeneratedAt: DateTimeOffset.UtcNow);
    }

    public async Task<IntegrationProviderEventDto> RecordInboundWebhookAsync(string providerCode, string eventKey, string eventType, string signature, string payloadJson, Guid? tenantId, CancellationToken cancellationToken)
    {
        var existing = await _dbContext.ProviderWebhookEvents.FirstOrDefaultAsync(x => x.ProviderCode == providerCode && x.EventKey == eventKey, cancellationToken);
        if (existing is not null)
        {
            existing.Status = "duplicate";
            existing.UpdatedAt = DateTimeOffset.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
            return ToProviderEventDto(existing);
        }

        var connection = tenantId.HasValue
            ? await _dbContext.IntegrationConnections.AsNoTracking().FirstOrDefaultAsync(x => x.TenantId == tenantId.Value && x.ProviderCode == providerCode, cancellationToken)
            : await _dbContext.IntegrationConnections.AsNoTracking().FirstOrDefaultAsync(x => x.ProviderCode == providerCode, cancellationToken);
        var adapter = _providerRegistry.GetCatalog().FirstOrDefault(x => string.Equals(x.ProviderCode, providerCode, StringComparison.OrdinalIgnoreCase));
        var eventEntity = new ProviderWebhookEvent
        {
            TenantId = tenantId ?? connection?.TenantId,
            IntegrationConnectionId = connection?.Id,
            ProviderCode = providerCode,
            EventKey = eventKey,
            EventType = eventType,
            Signature = signature,
            PayloadJson = payloadJson,
            Status = "received"
        };
        _dbContext.ProviderWebhookEvents.Add(eventEntity);
        await _dbContext.SaveChangesAsync(cancellationToken);

        if (adapter is not null)
        {
            var result = await adapter.ReceiveWebhookAsync(new ProviderWebhookRequest(providerCode, eventKey, eventType, signature, payloadJson), cancellationToken);
            eventEntity.Status = result.Status;
            eventEntity.ErrorMessage = result.Accepted ? null : result.Message;
            eventEntity.ProcessedAt = DateTimeOffset.UtcNow;
            if (!result.Accepted && eventEntity.TenantId.HasValue)
            {
                _dbContext.IntegrationFailures.Add(new IntegrationFailure
                {
                    TenantId = eventEntity.TenantId.Value,
                    IntegrationConnectionId = eventEntity.IntegrationConnectionId,
                    FailureType = "provider_webhook",
                    Severity = "warning",
                    Status = "open",
                    Summary = result.Message,
                    DetailJson = payloadJson,
                    LastSeenAt = DateTimeOffset.UtcNow
                });
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return ToProviderEventDto(eventEntity);
    }

    private IReadOnlyList<IntegrationProviderCatalogItemDto> BuildCatalog()
    {
        return _providerRegistry.GetCatalog()
            .Select(adapter => new IntegrationProviderCatalogItemDto(
                Domain: adapter.Domain,
                ProviderCode: adapter.ProviderCode,
                DisplayName: adapter.DisplayName,
                Description: DescribeProvider(adapter.Domain, adapter.ProviderCode),
                SupportedModes: adapter.SupportedModes,
                SupportedCapabilities: adapter.SupportedCapabilities))
            .ToArray();
    }

    private async Task<IntegrationConnectionDto?> BuildConnectionAsync(Guid tenantId, Guid connectionId, CancellationToken cancellationToken)
    {
        var connection = await _dbContext.IntegrationConnections.AsNoTracking().FirstOrDefaultAsync(x => x.Id == connectionId && x.TenantId == tenantId, cancellationToken);
        if (connection is null)
        {
            return null;
        }

        var mappings = await _dbContext.IntegrationMappings.AsNoTracking().Where(x => x.TenantId == tenantId && x.IntegrationConnectionId == connection.Id).ToListAsync(cancellationToken);
        var jobs = await _dbContext.IntegrationJobs.AsNoTracking().Where(x => x.TenantId == tenantId && x.IntegrationConnectionId == connection.Id).ToListAsync(cancellationToken);
        return ToConnectionDto(connection, mappings, jobs);
    }

    private async Task ValidateCoreAsync(IntegrationConnection connection, string actor, CancellationToken cancellationToken)
    {
        var adapter = ResolveAdapter(connection.IntegrationDomain, connection.ProviderCode);
        var secrets = await _dbContext.IntegrationCredentials.AsNoTracking()
            .Where(x => x.TenantId == connection.TenantId && x.IntegrationConnectionId == connection.Id)
            .ToDictionaryAsync(x => x.SecretName, x => _secretService.Unprotect(x.SecretCiphertext), cancellationToken);
        var config = await _dbContext.IntegrationConfigs.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == connection.TenantId && x.IntegrationConnectionId == connection.Id, cancellationToken);
        var settings = ParseJsonDictionary(config?.SettingsJson);

        var credentialContext = new ProviderCredentialContext(connection.TenantId, connection.ProviderCode, connection.Mode, secrets, settings);
        var validation = await adapter.ValidateCredentialsAsync(credentialContext, cancellationToken);
        var health = await adapter.HealthCheckAsync(credentialContext, cancellationToken);

        connection.LastValidatedAt = DateTimeOffset.UtcNow;
        connection.Status = validation.IsValid ? (connection.Enabled ? "active" : "disabled") : "needs_review";
        connection.HealthState = validation.IsValid ? health.HealthState : "error";
        connection.LastSuccessAt = validation.IsValid ? DateTimeOffset.UtcNow : connection.LastSuccessAt;
        connection.LastErrorAt = validation.IsValid ? null : DateTimeOffset.UtcNow;
        connection.UpdatedAt = DateTimeOffset.UtcNow;
        connection.UpdatedBy = actor;

        _dbContext.IntegrationHealthSnapshots.Add(new IntegrationHealthSnapshot
        {
            TenantId = connection.TenantId,
            IntegrationConnectionId = connection.Id,
            HealthState = connection.HealthState,
            PendingJobs = await _dbContext.IntegrationJobs.AsNoTracking().CountAsync(
                x => x.TenantId == connection.TenantId &&
                    x.IntegrationConnectionId == connection.Id &&
                    (x.Status == "pending" || x.Status == "retrying" || x.Status == "queued"),
                cancellationToken),
            FailedJobs = await _dbContext.IntegrationJobs.AsNoTracking().CountAsync(x => x.TenantId == connection.TenantId && x.IntegrationConnectionId == connection.Id && x.Status == "failed", cancellationToken),
            DeadLetters = await _dbContext.IntegrationJobs.AsNoTracking().CountAsync(x => x.TenantId == connection.TenantId && x.IntegrationConnectionId == connection.Id && x.Status == "dead_letter", cancellationToken),
            LastErrorSummary = validation.IsValid ? null : validation.Message,
            LastSuccessAt = validation.IsValid ? DateTimeOffset.UtcNow : connection.LastSuccessAt
        });

        if (!validation.IsValid)
        {
            _dbContext.IntegrationFailures.Add(new IntegrationFailure
            {
                TenantId = connection.TenantId,
                IntegrationConnectionId = connection.Id,
                FailureType = "credential_validation",
                Severity = "error",
                Status = "open",
                Summary = validation.Message,
                DetailJson = JsonSerializer.Serialize(new { validation.Status, connection.ProviderCode }),
                LastSeenAt = DateTimeOffset.UtcNow
            });
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task UpsertCredentialsAsync(Guid tenantId, Guid connectionId, IEnumerable<KeyValuePair<string, string>> secrets, CancellationToken cancellationToken)
    {
        foreach (var pair in secrets.Where(pair => !string.IsNullOrWhiteSpace(pair.Key) && !string.IsNullOrWhiteSpace(pair.Value)))
        {
            var key = pair.Key.Trim();
            var value = pair.Value.Trim();
            var existing = await _dbContext.IntegrationCredentials
                .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.IntegrationConnectionId == connectionId && x.SecretName == key, cancellationToken);
            if (existing is null)
            {
                _dbContext.IntegrationCredentials.Add(new IntegrationCredential
                {
                    TenantId = tenantId,
                    IntegrationConnectionId = connectionId,
                    SecretName = key,
                    SecretCiphertext = _secretService.Protect(value),
                    SecretMask = _secretService.Mask(value),
                    IsValid = false,
                    LastRotatedAt = DateTimeOffset.UtcNow
                });
            }
            else
            {
                existing.SecretCiphertext = _secretService.Protect(value);
                existing.SecretMask = _secretService.Mask(value);
                existing.LastRotatedAt = DateTimeOffset.UtcNow;
                existing.IsValid = false;
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task UpsertConfigAsync(Guid tenantId, Guid connectionId, IDictionary<string, string> settings, IReadOnlyList<string>? mappingTypes, CancellationToken cancellationToken)
    {
        var config = await _dbContext.IntegrationConfigs
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.IntegrationConnectionId == connectionId, cancellationToken);
        if (config is null)
        {
            config = new IntegrationConfig
            {
                TenantId = tenantId,
                IntegrationConnectionId = connectionId
            };
            _dbContext.IntegrationConfigs.Add(config);
        }

        config.SettingsJson = JsonSerializer.Serialize(settings ?? new Dictionary<string, string>(), JsonOptions);
        if (mappingTypes is not null)
        {
            config.MappingPolicyJson = JsonSerializer.Serialize(new { required = mappingTypes }, JsonOptions);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task UpsertMappingsAsync(Guid tenantId, Guid connectionId, IEnumerable<KeyValuePair<string, string>> mappings, CancellationToken cancellationToken)
    {
        foreach (var pair in mappings.Where(pair => !string.IsNullOrWhiteSpace(pair.Key)))
        {
            var key = pair.Key.Trim();
            var existing = await _dbContext.IntegrationMappings
                .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.IntegrationConnectionId == connectionId && x.MappingType == key && x.SourceValue == key, cancellationToken);

            if (existing is null)
            {
                _dbContext.IntegrationMappings.Add(new IntegrationMapping
                {
                    TenantId = tenantId,
                    IntegrationConnectionId = connectionId,
                    MappingType = key,
                    SourceValue = key,
                    TargetValue = string.IsNullOrWhiteSpace(pair.Value) ? string.Empty : pair.Value.Trim(),
                    Direction = "bidirectional",
                    Status = string.IsNullOrWhiteSpace(pair.Value) ? "warning" : "complete",
                    Warning = string.IsNullOrWhiteSpace(pair.Value) ? "Mapping target is empty." : null
                });
            }
            else
            {
                existing.TargetValue = string.IsNullOrWhiteSpace(pair.Value) ? string.Empty : pair.Value.Trim();
                existing.Status = string.IsNullOrWhiteSpace(pair.Value) ? "warning" : "complete";
                existing.Warning = string.IsNullOrWhiteSpace(pair.Value) ? "Mapping target is empty." : null;
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task RecordAuditAsync(Guid tenantId, Guid targetId, string action, string actor, string reason, object payload, CancellationToken cancellationToken)
    {
        _dbContext.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId,
            Action = action,
            Entity = "integration",
            EntityId = targetId.ToString(),
            PayloadJson = JsonSerializer.Serialize(new { actor, reason, payload }, JsonOptions)
        });
        _dbContext.IntegrationAuditLogs.Add(new IntegrationAuditLog
        {
            TenantId = tenantId,
            IntegrationConnectionId = null,
            Action = action,
            Actor = actor,
            TargetType = "integration",
            TargetId = targetId.ToString(),
            Reason = reason,
            PayloadJson = JsonSerializer.Serialize(payload, JsonOptions)
        });
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private IIntegrationProviderAdapter ResolveAdapter(string domain, string providerCode)
    {
        return _providerRegistry.Find(domain, providerCode)
            ?? throw new InvalidOperationException($"Provider adapter not found for {domain}/{providerCode}.");
    }

    private static IntegrationConnectionDto ToConnectionDto(IntegrationConnection connection, IEnumerable<IntegrationMapping> mappings, IEnumerable<IntegrationJob> jobs)
    {
        var connectionMappings = mappings.Where(x => x.IntegrationConnectionId == connection.Id).ToArray();
        var requiredMappings = GetRequiredMappingTypes(connection.IntegrationDomain);
        var mappingWarnings = connectionMappings
            .Where(x => x.Status is "warning" or "needs_review")
            .Select(x => $"{x.MappingType}: {x.Warning ?? "mapping requires review"}")
            .ToList();
        var missingMappings = IntegrationMappingValidator.MissingRequiredMappings(connectionMappings.Select(x => x.MappingType), requiredMappings);
        mappingWarnings.AddRange(missingMappings.Select(x => $"Missing required mapping: {x}"));

        var connectionJobs = jobs.Where(x => x.IntegrationConnectionId == connection.Id).ToArray();
        var pendingJobs = connectionJobs.Count(x => x.Status is "pending" or "retrying" or "queued");
        var deadLetters = connectionJobs.Count(x => x.Status == "dead_letter");
        var configurationState = mappingWarnings.Count == 0 ? "complete" : "needs_attention";

        return new IntegrationConnectionDto(
            Id: connection.Id,
            Domain: connection.IntegrationDomain,
            ProviderCode: connection.ProviderCode,
            DisplayName: connection.DisplayName,
            Status: connection.Status,
            Enabled: connection.Enabled,
            Mode: connection.Mode,
            HealthState: connection.HealthState,
            SyncMode: connection.SyncMode,
            LastSuccessAt: connection.LastSuccessAt,
            LastErrorAt: connection.LastErrorAt,
            LastValidatedAt: connection.LastValidatedAt,
            MappingWarnings: mappingWarnings,
            PendingJobs: pendingJobs,
            DeadLetters: deadLetters,
            ConfigurationState: configurationState);
    }

    private static IntegrationWebhookDto ToWebhookDto(OutboundWebhookEndpoint endpoint, IEnumerable<OutboundWebhookSubscription> subscriptions)
    {
        return new IntegrationWebhookDto(
            Id: endpoint.Id,
            Name: endpoint.Name,
            TargetUrl: endpoint.TargetUrl,
            Status: endpoint.Status,
            Enabled: endpoint.Enabled,
            PayloadVersion: endpoint.PayloadVersion,
            SecretMask: endpoint.SecretMask,
            Topics: subscriptions.Where(x => x.OutboundWebhookEndpointId == endpoint.Id && x.Enabled).Select(x => x.Topic).OrderBy(x => x).ToArray(),
            LastSuccessAt: endpoint.LastSuccessAt,
            LastFailureAt: endpoint.LastFailureAt);
    }

    private static IntegrationApiClientDto ToApiClientDto(ApiClient client, IEnumerable<ApiKey> apiKeys, IEnumerable<ApiScope> scopes)
    {
        return new IntegrationApiClientDto(
            Id: client.Id,
            Name: client.Name,
            ClientType: client.ClientType,
            Status: client.Status,
            Environment: client.Environment,
            ContactEmail: client.ContactEmail,
            Scopes: scopes.Where(x => x.ApiClientId == client.Id && x.IsGranted).Select(x => x.ScopeCode).OrderBy(x => x).ToArray(),
            Keys: apiKeys.Where(x => x.ApiClientId == client.Id).Select(x => x.MaskedKey).OrderBy(x => x).ToArray(),
            LastUsedAt: client.LastUsedAt,
            CreatedAt: client.CreatedAt);
    }

    private static IntegrationJobDto ToJobDto(IntegrationJob job)
    {
        return new IntegrationJobDto(
            Id: job.Id,
            ConnectionId: job.IntegrationConnectionId,
            JobType: job.JobType,
            Status: job.Status,
            IdempotencyKey: job.IdempotencyKey,
            CorrelationId: job.CorrelationId,
            BusinessObjectType: job.BusinessObjectType,
            BusinessObjectId: job.BusinessObjectId,
            RetryCount: job.RetryCount,
            MaxRetryCount: job.MaxRetryCount,
            NextRetryAt: job.NextRetryAt,
            LastAttemptAt: job.LastAttemptAt,
            ErrorCode: job.ErrorCode,
            ErrorMessage: job.ErrorMessage,
            CreatedAt: job.CreatedAt);
    }

    private static IntegrationFailureDto ToFailureDto(IntegrationFailure failure)
    {
        return new IntegrationFailureDto(
            Id: failure.Id,
            ConnectionId: failure.IntegrationConnectionId,
            FailureType: failure.FailureType,
            Severity: failure.Severity,
            Status: failure.Status,
            Summary: failure.Summary,
            Detail: failure.DetailJson,
            CreatedAt: failure.CreatedAt,
            LastSeenAt: failure.LastSeenAt);
    }

    private static IntegrationProviderEventDto ToProviderEventDto(ProviderWebhookEvent providerEvent)
    {
        return new IntegrationProviderEventDto(
            Id: providerEvent.Id,
            TenantId: providerEvent.TenantId,
            ConnectionId: providerEvent.IntegrationConnectionId,
            ProviderCode: providerEvent.ProviderCode,
            EventKey: providerEvent.EventKey,
            EventType: providerEvent.EventType,
            Status: providerEvent.Status,
            CreatedAt: providerEvent.CreatedAt,
            ProcessedAt: providerEvent.ProcessedAt,
            ErrorMessage: providerEvent.ErrorMessage);
    }

    private static IReadOnlyList<string> BuildTenantNotices(IEnumerable<IntegrationConnection> connections, IEnumerable<IntegrationFailure> failures, IEnumerable<IntegrationJob> jobs)
    {
        var notices = new List<string>();
        if (connections.Any(x => x.HealthState == "error"))
        {
            notices.Add("One or more provider connections are unhealthy.");
        }
        if (failures.Any())
        {
            notices.Add("Recent integration failures require review.");
        }
        if (jobs.Any(x => x.Status == "dead_letter"))
        {
            notices.Add("Dead-letter integration jobs exist. Manual retry may be required.");
        }
        if (notices.Count == 0)
        {
            notices.Add("Integration health is stable.");
        }
        return notices;
    }

    private static string DescribeProvider(string domain, string providerCode)
    {
        return (domain, providerCode) switch
        {
            ("einvoice", _) => "E-invoice and e-archive submission with async document state tracking.",
            ("fiscal", _) => "Fiscal bridge and cash-register device coordination with local-first safety.",
            ("collections", _) => "Online collection and payment-link callbacks decoupled from core POS flows.",
            ("accounting", _) => "ERP/accounting export with explicit mapping and reconciliation references.",
            ("ecommerce", _) => "Marketplace product, stock and order sync with channel-aware mapping.",
            ("messaging", _) => "Email/SMS delivery with provider abstraction and delivery logging.",
            _ => "Provider-agnostic integration adapter."
        };
    }

    private static IReadOnlyList<string> GetRequiredMappingTypes(string domain)
    {
        return domain switch
        {
            "einvoice" => ["document_type", "tax_code", "customer_account"],
            "fiscal" => ["branch_register"],
            "collections" => ["payment_method"],
            "accounting" => ["customer_account", "product_code", "payment_method", "tax_code"],
            "ecommerce" => ["product_code", "warehouse", "order_status"],
            "messaging" => ["sender_id"],
            _ => Array.Empty<string>()
        };
    }

    private static Dictionary<string, string> ParseJsonDictionary(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(json, JsonOptions)
                ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }
        catch
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }
    }
}
