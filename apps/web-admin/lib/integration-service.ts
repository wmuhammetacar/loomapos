import { apiFetch, commerceFetch } from "@/lib/api-client";

export interface IntegrationProviderCatalogItem {
  domain: string;
  providerCode: string;
  displayName: string;
  description: string;
  supportedModes: string[];
  supportedCapabilities: string[];
}

export interface IntegrationConnection {
  id: string;
  domain: string;
  providerCode: string;
  displayName: string;
  status: string;
  enabled: boolean;
  mode: string;
  healthState: string;
  syncMode: string;
  lastSuccessAt?: string | null;
  lastErrorAt?: string | null;
  lastValidatedAt?: string | null;
  mappingWarnings: string[];
  pendingJobs: number;
  deadLetters: number;
  configurationState: string;
}

export interface IntegrationWebhook {
  id: string;
  name: string;
  targetUrl: string;
  status: string;
  enabled: boolean;
  payloadVersion: string;
  secretMask: string;
  topics: string[];
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
}

export interface IntegrationApiClient {
  id: string;
  name: string;
  clientType: string;
  status: string;
  environment: string;
  contactEmail?: string | null;
  scopes: string[];
  keys: string[];
  lastUsedAt?: string | null;
  createdAt: string;
}

export interface IntegrationJob {
  id: string;
  connectionId?: string | null;
  jobType: string;
  status: string;
  idempotencyKey: string;
  correlationId: string;
  businessObjectType?: string | null;
  businessObjectId?: string | null;
  retryCount: number;
  maxRetryCount: number;
  nextRetryAt?: string | null;
  lastAttemptAt?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export interface IntegrationFailure {
  id: string;
  connectionId?: string | null;
  failureType: string;
  severity: string;
  status: string;
  summary: string;
  detail: string;
  createdAt: string;
  lastSeenAt?: string | null;
}

export interface IntegrationMappingPreview {
  connectionId: string;
  domain: string;
  providerCode: string;
  aggregateType: string;
  eventType: string;
  sourceFields: Record<string, string>;
  appliedMappings: Record<string, string>;
  transformedFields: Record<string, string>;
  warnings: string[];
  readyToSubmit: boolean;
  generatedAt: string;
}

export interface IntegrationPublicApiMeta {
  version: string;
  generatedAt: string;
  authentication: {
    header: string;
    oneTimeReveal: boolean;
  };
  docs: {
    openApiJson: string;
    swaggerUi: string;
    quickStart: string;
  };
  scopes: string[];
  endpoints: Array<{
    method: string;
    path: string;
    scope: string;
  }>;
}

export interface TenantIntegrationWorkspace {
  catalog: IntegrationProviderCatalogItem[];
  connections: IntegrationConnection[];
  webhooks: IntegrationWebhook[];
  apiClients: IntegrationApiClient[];
  recentJobs: IntegrationJob[];
  recentFailures: IntegrationFailure[];
  notices: string[];
}

export interface AdminIntegrationOverview {
  activeConnections: number;
  unhealthyConnections: number;
  pendingJobs: number;
  failedJobs: number;
  deadLetters: number;
  webhookFailures: number;
  mappingIssues: number;
  expiredCredentials: number;
  publicApiClients: number;
}

export interface AdminTenantIntegrationSummary {
  tenantId: string;
  companyName: string;
  connectionCount: number;
  unhealthyConnections: number;
  pendingJobs: number;
  failedJobs: number;
  lastSuccessAt?: string | null;
  worstHealthState: string;
}

export interface IntegrationProviderEvent {
  id: string;
  tenantId?: string | null;
  connectionId?: string | null;
  providerCode: string;
  eventKey: string;
  eventType: string;
  status: string;
  createdAt: string;
  processedAt?: string | null;
  errorMessage?: string | null;
}

export interface AdminIntegrationWorkspace {
  overview: AdminIntegrationOverview;
  tenantSummaries: AdminTenantIntegrationSummary[];
  connections: IntegrationConnection[];
  jobs: IntegrationJob[];
  failures: IntegrationFailure[];
  providerEvents: IntegrationProviderEvent[];
  webhooks: IntegrationWebhook[];
  incidents: string[];
}

export interface SaveIntegrationConnectionInput {
  domain: string;
  providerCode: string;
  displayName: string;
  mode: string;
  syncMode: string;
  enabled: boolean;
  secrets: Record<string, string>;
  settings: Record<string, string>;
  requiredMappings: Record<string, string>;
}

export interface UpdateIntegrationConnectionInput {
  displayName?: string;
  mode?: string;
  syncMode?: string;
  enabled?: boolean;
  secrets?: Record<string, string>;
  settings?: Record<string, string>;
  requiredMappings?: Record<string, string>;
}

export interface IntegrationMappingPreviewInput {
  aggregateType: string;
  eventType: string;
  sourceFields: Record<string, string>;
}

export interface CreateWebhookInput {
  name: string;
  targetUrl: string;
  topics: string[];
  enabled: boolean;
}

export interface CreateApiClientInput {
  name: string;
  clientType: string;
  environment: string;
  contactEmail?: string;
  scopes: string[];
  expiresAt?: string | null;
}

export interface CreatedApiClientResponse {
  client: IntegrationApiClient;
  plaintextKey: string;
}

const fallbackPortalWorkspace: TenantIntegrationWorkspace = {
  catalog: [
    {
      domain: "einvoice",
      providerCode: "mock-einvoice",
      displayName: "Mock E-Invoice Gateway",
      description: "E-invoice and e-archive submission with async document state tracking.",
      supportedModes: ["sandbox", "live"],
      supportedCapabilities: ["authorize", "submit", "status", "webhook", "health"]
    },
    {
      domain: "accounting",
      providerCode: "mock-accounting",
      displayName: "Mock Accounting / ERP",
      description: "ERP/accounting export with explicit mapping and reconciliation references.",
      supportedModes: ["sandbox", "live"],
      supportedCapabilities: ["authorize", "submit", "status", "health", "mapping"]
    },
    {
      domain: "ecommerce",
      providerCode: "mock-ecommerce",
      displayName: "Mock Marketplace Connector",
      description: "Marketplace product, stock and order sync with channel-aware mapping.",
      supportedModes: ["sandbox", "live"],
      supportedCapabilities: ["authorize", "submit", "status", "health", "mapping", "webhook"]
    }
  ],
  connections: [
    {
      id: "connection-demo-1",
      domain: "einvoice",
      providerCode: "mock-einvoice",
      displayName: "Mock E-Invoice Gateway",
      status: "active",
      enabled: true,
      mode: "sandbox",
      healthState: "healthy",
      syncMode: "async",
      lastSuccessAt: "2026-03-09T08:10:00Z",
      lastErrorAt: null,
      lastValidatedAt: "2026-03-09T08:00:00Z",
      mappingWarnings: [],
      pendingJobs: 2,
      deadLetters: 0,
      configurationState: "complete"
    },
    {
      id: "connection-demo-2",
      domain: "accounting",
      providerCode: "mock-accounting",
      displayName: "Mock Accounting / ERP",
      status: "needs_review",
      enabled: true,
      mode: "live",
      healthState: "warning",
      syncMode: "push_pull",
      lastSuccessAt: "2026-03-08T17:50:00Z",
      lastErrorAt: "2026-03-09T07:20:00Z",
      lastValidatedAt: "2026-03-09T07:10:00Z",
      mappingWarnings: ["Missing required mapping: payment_method"],
      pendingJobs: 4,
      deadLetters: 1,
      configurationState: "needs_attention"
    }
  ],
  webhooks: [
    {
      id: "webhook-demo-1",
      name: "ERP Automation",
      targetUrl: "https://example.test/hooks/erp",
      status: "active",
      enabled: true,
      payloadVersion: "v1",
      secretMask: "lp_abc***xyz",
      topics: ["sale.created", "invoice.generated"],
      lastSuccessAt: "2026-03-09T08:15:00Z",
      lastFailureAt: null
    }
  ],
  apiClients: [
    {
      id: "client-demo-1",
      name: "Warehouse BI",
      clientType: "tenant",
      status: "active",
      environment: "sandbox",
      contactEmail: "api@istanbulmarket.test",
      scopes: ["products:read", "analytics:read"],
      keys: ["lp_demo_key***"],
      lastUsedAt: "2026-03-09T08:12:00Z",
      createdAt: "2026-03-07T10:00:00Z"
    }
  ],
  recentJobs: [
    {
      id: "job-demo-1",
      connectionId: "connection-demo-1",
      jobType: "invoice_submission",
      status: "sent",
      idempotencyKey: "demo-job-1",
      correlationId: "corr-1",
      businessObjectType: "invoice_document",
      businessObjectId: "inv-doc-1",
      retryCount: 0,
      maxRetryCount: 5,
      nextRetryAt: null,
      lastAttemptAt: "2026-03-09T08:10:00Z",
      errorCode: null,
      errorMessage: null,
      createdAt: "2026-03-09T08:09:00Z"
    }
  ],
  recentFailures: [
    {
      id: "failure-demo-1",
      connectionId: "connection-demo-2",
      failureType: "mapping_validation",
      severity: "warning",
      status: "open",
      summary: "Payment method mapping is missing.",
      detail: "{\"missing\":\"payment_method\"}",
      createdAt: "2026-03-09T07:20:00Z",
      lastSeenAt: "2026-03-09T08:00:00Z"
    }
  ],
  notices: [
    "One or more provider connections are unhealthy.",
    "Dead-letter integration jobs exist. Manual retry may be required."
  ]
};

const fallbackAdminWorkspace: AdminIntegrationWorkspace = {
  overview: {
    activeConnections: 14,
    unhealthyConnections: 3,
    pendingJobs: 27,
    failedJobs: 4,
    deadLetters: 2,
    webhookFailures: 1,
    mappingIssues: 5,
    expiredCredentials: 1,
    publicApiClients: 6
  },
  tenantSummaries: [
    {
      tenantId: "tenant-demo-1",
      companyName: "Istanbul Market Group",
      connectionCount: 4,
      unhealthyConnections: 1,
      pendingJobs: 6,
      failedJobs: 1,
      lastSuccessAt: "2026-03-09T08:10:00Z",
      worstHealthState: "warning"
    }
  ],
  connections: fallbackPortalWorkspace.connections,
  jobs: fallbackPortalWorkspace.recentJobs,
  failures: fallbackPortalWorkspace.recentFailures,
  providerEvents: [
    {
      id: "provider-event-1",
      tenantId: "tenant-demo-1",
      connectionId: "connection-demo-1",
      providerCode: "mock-einvoice",
      eventKey: "evt-001",
      eventType: "invoice.accepted",
      status: "accepted",
      createdAt: "2026-03-09T08:11:00Z",
      processedAt: "2026-03-09T08:11:10Z",
      errorMessage: null
    }
  ],
  webhooks: fallbackPortalWorkspace.webhooks,
  incidents: [
    "3 integration connection(s) require intervention.",
    "2 integration job(s) are in dead-letter state."
  ]
};

async function optionalCommerceFetch<T>(path: string): Promise<T | null> {
  try {
    return await commerceFetch<T>(path);
  } catch {
    return null;
  }
}

async function optionalAdminFetch<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path, { ignoreTenantHeaders: true });
  } catch {
    return null;
  }
}

export async function loadPortalIntegrationWorkspace(): Promise<TenantIntegrationWorkspace> {
  return (await optionalCommerceFetch<TenantIntegrationWorkspace>("/commerce/portal/integrations")) ?? fallbackPortalWorkspace;
}

export async function savePortalIntegrationConnection(input: SaveIntegrationConnectionInput) {
  return await commerceFetch<IntegrationConnection>("/commerce/portal/integrations/connections", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updatePortalIntegrationConnection(connectionId: string, input: UpdateIntegrationConnectionInput) {
  return await commerceFetch<IntegrationConnection>(`/commerce/portal/integrations/connections/${connectionId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function validatePortalIntegrationConnection(connectionId: string) {
  return await commerceFetch<IntegrationConnection>(`/commerce/portal/integrations/connections/${connectionId}/validate`, {
    method: "POST"
  });
}

export async function togglePortalIntegrationConnection(connectionId: string, enabled: boolean) {
  return await commerceFetch<IntegrationConnection>(`/commerce/portal/integrations/connections/${connectionId}/toggle`, {
    method: "POST",
    body: JSON.stringify({ enabled })
  });
}

export async function previewPortalIntegrationMapping(connectionId: string, input: IntegrationMappingPreviewInput) {
  return await commerceFetch<IntegrationMappingPreview>(`/commerce/portal/integrations/connections/${connectionId}/mapping-preview`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function createPortalIntegrationWebhook(input: CreateWebhookInput) {
  return await commerceFetch<IntegrationWebhook>("/commerce/portal/integrations/webhooks", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function rotatePortalIntegrationWebhookSecret(endpointId: string) {
  return await commerceFetch<IntegrationWebhook>(`/commerce/portal/integrations/webhooks/${endpointId}/rotate-secret`, {
    method: "POST"
  });
}

export async function testPortalIntegrationWebhook(endpointId: string) {
  return await commerceFetch<IntegrationJob>(`/commerce/portal/integrations/webhooks/${endpointId}/test`, {
    method: "POST"
  });
}

export async function createPortalApiClient(input: CreateApiClientInput) {
  return await commerceFetch<CreatedApiClientResponse>("/commerce/portal/integrations/api-clients", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function revokePortalApiKey(apiKeyId: string) {
  return await commerceFetch<{ revoked: boolean; apiKeyId: string }>(`/commerce/portal/integrations/api-keys/${apiKeyId}/revoke`, {
    method: "POST"
  });
}

export async function loadAdminIntegrationWorkspace(): Promise<AdminIntegrationWorkspace> {
  return (await optionalAdminFetch<AdminIntegrationWorkspace>("/internal/admin/integrations")) ?? fallbackAdminWorkspace;
}

export async function retryAdminIntegrationJob(jobId: string, reason: string) {
  return await apiFetch<IntegrationJob>(`/internal/admin/integrations/jobs/${jobId}/retry`, {
    method: "POST",
    body: JSON.stringify({ reason }),
    ignoreTenantHeaders: true
  });
}

export async function replayAdminDeadLetterJobs(reason: string, maxCount = 25, tenantId?: string) {
  return await apiFetch<{ requested: number; replayed: number; jobs: IntegrationJob[] }>("/internal/admin/integrations/dead-letter/replay", {
    method: "POST",
    body: JSON.stringify({ reason, maxCount, tenantId: tenantId ?? null }),
    ignoreTenantHeaders: true
  });
}

export async function loadPublicApiMeta(): Promise<IntegrationPublicApiMeta | null> {
  return await optionalCommerceFetch<IntegrationPublicApiMeta>("/public/v1/meta");
}
