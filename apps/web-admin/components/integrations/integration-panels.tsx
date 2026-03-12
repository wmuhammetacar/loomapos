"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createPortalApiClient,
  createPortalIntegrationWebhook,
  loadPublicApiMeta,
  loadAdminIntegrationWorkspace,
  loadPortalIntegrationWorkspace,
  previewPortalIntegrationMapping,
  replayAdminDeadLetterJobs,
  retryAdminIntegrationJob,
  rotatePortalIntegrationWebhookSecret,
  savePortalIntegrationConnection,
  testPortalIntegrationWebhook,
  togglePortalIntegrationConnection,
  validatePortalIntegrationConnection,
  type AdminIntegrationWorkspace,
  type IntegrationMappingPreview,
  type IntegrationPublicApiMeta,
  type TenantIntegrationWorkspace
} from "@/lib/integration-service";

export function PortalIntegrationPanel() {
  const [workspace, setWorkspace] = useState<TenantIntegrationWorkspace | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewBusyConnectionId, setPreviewBusyConnectionId] = useState<string | null>(null);
  const [connectionForm, setConnectionForm] = useState({
    domain: "einvoice",
    providerCode: "mock-einvoice",
    displayName: "Mock E-Invoice Gateway",
    mode: "sandbox",
    syncMode: "async",
    enabled: true,
    apiKey: "",
    apiSecret: "",
    endpointUrl: "",
    paymentMethod: "",
    taxCode: "",
    customerAccount: ""
  });
  const [webhookForm, setWebhookForm] = useState({
    name: "ERP Automation",
    targetUrl: "https://example.test/hooks/erp",
    topics: "sale.created,invoice.generated"
  });
  const [apiClientForm, setApiClientForm] = useState({
    name: "Warehouse BI",
    clientType: "tenant",
    environment: "sandbox",
    contactEmail: "api@example.test",
    scopes: "products:read,analytics:read"
  });
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [mappingPreview, setMappingPreview] = useState<IntegrationMappingPreview | null>(null);
  const [publicApiMeta, setPublicApiMeta] = useState<IntegrationPublicApiMeta | null>(null);

  const reload = async () => {
    const [workspaceData, publicMeta] = await Promise.all([
      loadPortalIntegrationWorkspace(),
      loadPublicApiMeta()
    ]);
    setWorkspace(workspaceData);
    setPublicApiMeta(publicMeta);
  };

  useEffect(() => {
    void reload();
  }, []);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
      await reload();
      setMessage(success);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Integration action failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!workspace) {
    return (
      <Card>
        <CardTitle>Integration workspace is loading</CardTitle>
        <p className="mt-3 text-sm leading-6 text-text/72">
          Loading provider catalog, connection health and webhook diagnostics.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Phase 9 Integration Control Center</CardTitle>
        <p className="mt-3 text-sm leading-6 text-text/72">
          Configure third-party providers, monitor retries and manage public API access without moving POS execution to the web.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {workspace.notices.map((notice) => (
            <span key={notice} className="rounded-full border border-line bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-text/70">
              {notice}
            </span>
          ))}
        </div>
      </Card>

      {message ? (
        <Card className="border-success/30 bg-success/10 p-5">
          <p className="text-sm font-semibold text-success">{message}</p>
        </Card>
      ) : null}
      {error ? (
        <Card className="border-danger/30 bg-danger/10 p-5">
          <p className="text-sm font-semibold text-danger">{error}</p>
        </Card>
      ) : null}
      {issuedKey ? (
        <Card className="border-brand/20 bg-brand/5 p-5">
          <p className="text-sm font-semibold text-text">One-time API key reveal</p>
          <p className="mt-3 font-mono text-sm text-text">{issuedKey}</p>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardTitle>Provider connections</CardTitle>
          <div className="mt-5 space-y-4">
            {workspace.connections.map((connection) => (
              <div key={connection.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-semibold text-text">{connection.displayName}</p>
                    <p className="mt-1 text-sm text-text/72">
                      {connection.domain} / {connection.providerCode} · {connection.mode} · {connection.healthState}
                    </p>
                    <p className="mt-2 text-sm text-text/72">
                      Pending jobs {connection.pendingJobs} · Dead letters {connection.deadLetters}
                    </p>
                    {connection.mappingWarnings.length > 0 ? (
                      <div className="mt-3 space-y-1 text-sm text-amber-900">
                        {connection.mappingWarnings.map((warning) => (
                          <p key={warning}>{warning}</p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || previewBusyConnectionId === connection.id}
                      onClick={async () => {
                        setPreviewBusyConnectionId(connection.id);
                        setError(null);
                        setMessage(null);
                        try {
                          const preview = await previewPortalIntegrationMapping(connection.id, {
                            aggregateType: "sale",
                            eventType: "sale.created",
                            sourceFields: buildPreviewSource(connection.domain)
                          });
                          setMappingPreview(preview);
                          setMessage(`Mapping preview generated for ${connection.displayName}.`);
                        } catch (actionError) {
                          setError(actionError instanceof Error ? actionError.message : "Mapping preview failed.");
                        } finally {
                          setPreviewBusyConnectionId(null);
                        }
                      }}
                    >
                      Preview mapping
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void run(() => validatePortalIntegrationConnection(connection.id), "Connection validated.")}
                    >
                      Test connection
                    </Button>
                    <Button
                      size="sm"
                      variant={connection.enabled ? "outline" : "primary"}
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => togglePortalIntegrationConnection(connection.id, !connection.enabled),
                          connection.enabled ? "Connection disabled." : "Connection enabled."
                        )
                      }
                    >
                      {connection.enabled ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>Create provider connection</CardTitle>
          <div className="mt-5 grid gap-4">
            <select
              className="h-12 rounded-full border border-line px-4 text-sm text-text"
              value={connectionForm.domain}
              onChange={(event) =>
                setConnectionForm((current) => {
                  const selected = workspace.catalog.find((item) => item.domain === event.target.value) ?? workspace.catalog[0];
                  return {
                    ...current,
                    domain: selected?.domain ?? "einvoice",
                    providerCode: selected?.providerCode ?? "mock-einvoice",
                    displayName: selected?.displayName ?? "Mock Provider"
                  };
                })
              }
            >
              {workspace.catalog.map((item) => (
                <option key={`${item.domain}-${item.providerCode}`} value={item.domain}>
                  {item.displayName}
                </option>
              ))}
            </select>
            <Input value={connectionForm.displayName} onChange={(event) => setConnectionForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="Display name" />
            <div className="grid gap-4 md:grid-cols-2">
              <Input value={connectionForm.apiKey} onChange={(event) => setConnectionForm((current) => ({ ...current, apiKey: event.target.value }))} placeholder="Credential: API key" />
              <Input value={connectionForm.apiSecret} onChange={(event) => setConnectionForm((current) => ({ ...current, apiSecret: event.target.value }))} placeholder="Credential: API secret" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input value={connectionForm.endpointUrl} onChange={(event) => setConnectionForm((current) => ({ ...current, endpointUrl: event.target.value }))} placeholder="Setting: endpoint URL" />
              <Input value={connectionForm.paymentMethod} onChange={(event) => setConnectionForm((current) => ({ ...current, paymentMethod: event.target.value }))} placeholder="Mapping: payment method" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input value={connectionForm.taxCode} onChange={(event) => setConnectionForm((current) => ({ ...current, taxCode: event.target.value }))} placeholder="Mapping: tax code" />
              <Input value={connectionForm.customerAccount} onChange={(event) => setConnectionForm((current) => ({ ...current, customerAccount: event.target.value }))} placeholder="Mapping: customer account" />
            </div>
            <Button
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    savePortalIntegrationConnection({
                      domain: connectionForm.domain,
                      providerCode: connectionForm.providerCode,
                      displayName: connectionForm.displayName,
                      mode: connectionForm.mode,
                      syncMode: connectionForm.syncMode,
                      enabled: connectionForm.enabled,
                      secrets: {
                        api_key: connectionForm.apiKey,
                        api_secret: connectionForm.apiSecret
                      },
                      settings: {
                        endpoint_url: connectionForm.endpointUrl
                      },
                      requiredMappings: {
                        payment_method: connectionForm.paymentMethod,
                        tax_code: connectionForm.taxCode,
                        customer_account: connectionForm.customerAccount
                      }
                    }),
                  "Integration connection saved."
                )
              }
            >
              Save connection
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle>Outbound webhooks</CardTitle>
          <div className="mt-5 space-y-4">
            {workspace.webhooks.map((webhook) => (
              <div key={webhook.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="font-semibold text-text">{webhook.name}</p>
                <p className="mt-1 text-sm text-text/72">{webhook.targetUrl}</p>
                <p className="mt-2 text-sm text-text/72">
                  Topics: {webhook.topics.join(", ")} · secret {webhook.secretMask}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => rotatePortalIntegrationWebhookSecret(webhook.id), "Webhook secret rotated.")}>
                    Rotate secret
                  </Button>
                  <Button size="sm" disabled={busy} onClick={() => void run(() => testPortalIntegrationWebhook(webhook.id), "Webhook test stored in delivery log.")}>
                    Test send
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-4">
            <Input value={webhookForm.name} onChange={(event) => setWebhookForm((current) => ({ ...current, name: event.target.value }))} placeholder="Endpoint name" />
            <Input value={webhookForm.targetUrl} onChange={(event) => setWebhookForm((current) => ({ ...current, targetUrl: event.target.value }))} placeholder="Target URL" />
            <Input value={webhookForm.topics} onChange={(event) => setWebhookForm((current) => ({ ...current, topics: event.target.value }))} placeholder="Topics comma separated" />
            <Button
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    createPortalIntegrationWebhook({
                      name: webhookForm.name,
                      targetUrl: webhookForm.targetUrl,
                      topics: webhookForm.topics.split(",").map((item) => item.trim()).filter(Boolean),
                      enabled: true
                    }),
                  "Webhook endpoint created."
                )
              }
            >
              Create webhook endpoint
            </Button>
          </div>
        </Card>

        <Card>
          <CardTitle>Public API clients</CardTitle>
          <div className="mt-5 space-y-4">
            {workspace.apiClients.map((client) => (
              <div key={client.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="font-semibold text-text">{client.name}</p>
                <p className="mt-1 text-sm text-text/72">
                  {client.environment} · {client.status} · scopes {client.scopes.join(", ")}
                </p>
                <p className="mt-2 text-sm text-text/72">Keys: {client.keys.join(", ")}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-4">
            <Input value={apiClientForm.name} onChange={(event) => setApiClientForm((current) => ({ ...current, name: event.target.value }))} placeholder="Client name" />
            <Input value={apiClientForm.contactEmail} onChange={(event) => setApiClientForm((current) => ({ ...current, contactEmail: event.target.value }))} placeholder="Contact email" />
            <Input value={apiClientForm.scopes} onChange={(event) => setApiClientForm((current) => ({ ...current, scopes: event.target.value }))} placeholder="Scopes comma separated" />
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const created = await createPortalApiClient({
                    name: apiClientForm.name,
                    clientType: apiClientForm.clientType,
                    environment: apiClientForm.environment,
                    contactEmail: apiClientForm.contactEmail,
                    scopes: apiClientForm.scopes.split(",").map((item) => item.trim()).filter(Boolean),
                    expiresAt: null
                  });
                  setIssuedKey(created.plaintextKey);
                }, "API client created.")
              }
            >
              Create API client
            </Button>
          </div>
          <div className="mt-6 rounded-[24px] border border-line bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text/55">Public API docs</p>
            <p className="mt-2 text-sm text-text/72">
              {publicApiMeta ? `Version ${publicApiMeta.version} · auth ${publicApiMeta.authentication.header}` : "Docs metadata unavailable."}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <a className="font-semibold text-brand underline-offset-4 hover:underline" href={publicApiMeta?.docs.swaggerUi ?? "/swagger"} target="_blank" rel="noreferrer">
                Swagger UI
              </a>
              <a className="font-semibold text-brand underline-offset-4 hover:underline" href={publicApiMeta?.docs.openApiJson ?? "/swagger/v1/swagger.json"} target="_blank" rel="noreferrer">
                OpenAPI JSON
              </a>
            </div>
          </div>
        </Card>
      </div>

      {mappingPreview ? (
        <Card>
          <CardTitle>Latest mapping preview</CardTitle>
          <p className="mt-3 text-sm text-text/72">
            {mappingPreview.domain} / {mappingPreview.providerCode} · {mappingPreview.eventType} · {mappingPreview.readyToSubmit ? "ready" : "needs review"}
          </p>
          {mappingPreview.warnings.length > 0 ? (
            <div className="mt-3 space-y-1">
              {mappingPreview.warnings.map((warning) => (
                <p key={warning} className="text-sm text-amber-900">{warning}</p>
              ))}
            </div>
          ) : null}
          <pre className="mt-4 overflow-auto rounded-2xl border border-line bg-muted/30 p-4 text-xs leading-6 text-text/80">
{JSON.stringify(mappingPreview.transformedFields, null, 2)}
          </pre>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle>Recent jobs</CardTitle>
          <div className="mt-5 space-y-3">
            {workspace.recentJobs.map((job) => (
              <div key={job.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="font-semibold text-text">{job.jobType}</p>
                <p className="mt-1 text-sm text-text/72">
                  {job.status} · retry {job.retryCount}/{job.maxRetryCount}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-text/55">{formatDate(job.createdAt)}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>Recent failures</CardTitle>
          <div className="mt-5 space-y-3">
            {workspace.recentFailures.map((failure) => (
              <div key={failure.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="font-semibold text-text">{failure.failureType}</p>
                <p className="mt-1 text-sm text-text/72">
                  {failure.severity} · {failure.status}
                </p>
                <p className="mt-2 text-sm leading-6 text-text/72">{failure.summary}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function AdminIntegrationPanel() {
  const [workspace, setWorkspace] = useState<AdminIntegrationWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [replayBusy, setReplayBusy] = useState(false);

  const reload = async () => {
    try {
      setWorkspace(await loadAdminIntegrationWorkspace());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Admin integration workspace could not be loaded.");
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  if (!workspace) {
    return (
      <Card>
        <CardTitle>Loading integration diagnostics</CardTitle>
        <p className="mt-3 text-sm leading-6 text-text/72">
          Collecting connection health, queue state and provider callback diagnostics.
        </p>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {message ? (
        <Card className="border-success/30 bg-success/10 p-5">
          <p className="text-sm font-semibold text-success">{message}</p>
        </Card>
      ) : null}
      {error ? (
        <Card className="border-danger/30 bg-danger/10 p-5">
          <p className="text-sm font-semibold text-danger">{error}</p>
        </Card>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric label="Active connections" value={String(workspace.overview.activeConnections)} />
        <Metric label="Unhealthy" value={String(workspace.overview.unhealthyConnections)} />
        <Metric label="Pending jobs" value={String(workspace.overview.pendingJobs)} />
        <Metric label="Dead letters" value={String(workspace.overview.deadLetters)} />
        <Metric label="API clients" value={String(workspace.overview.publicApiClients)} />
      </div>

      <Card>
        <CardTitle>Incidents</CardTitle>
        <div className="mt-5 flex flex-wrap gap-3">
          {workspace.incidents.map((incident) => (
            <span key={incident} className="rounded-full border border-line bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-text/70">
              {incident}
            </span>
          ))}
        </div>
        <div className="mt-4">
          <Button
            size="sm"
            disabled={replayBusy}
            onClick={async () => {
              setReplayBusy(true);
              setError(null);
              setMessage(null);
              try {
                const replayResult = await replayAdminDeadLetterJobs("Manual dead-letter replay requested from admin integrations panel.", 25);
                await reload();
                setMessage(`${replayResult.replayed} dead-letter job(s) moved to retrying state.`);
              } catch (actionError) {
                setError(actionError instanceof Error ? actionError.message : "Dead-letter replay failed.");
              } finally {
                setReplayBusy(false);
              }
            }}
          >
            Replay dead letters
          </Button>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle>Tenant health</CardTitle>
          <div className="mt-5 space-y-3">
            {workspace.tenantSummaries.map((tenant) => (
              <div key={tenant.tenantId} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="font-semibold text-text">{tenant.companyName}</p>
                <p className="mt-1 text-sm text-text/72">
                  Connections {tenant.connectionCount} · unhealthy {tenant.unhealthyConnections} · pending {tenant.pendingJobs}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-text/55">{tenant.worstHealthState}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>Provider webhook events</CardTitle>
          <div className="mt-5 space-y-3">
            {workspace.providerEvents.map((event) => (
              <div key={event.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="font-semibold text-text">{event.providerCode}</p>
                <p className="mt-1 text-sm text-text/72">{event.eventType} · {event.status}</p>
                <p className="mt-2 text-sm text-text/72">{event.eventKey}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle>Connections</CardTitle>
          <div className="mt-5 space-y-3">
            {workspace.connections.map((connection) => (
              <div key={connection.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="font-semibold text-text">{connection.displayName}</p>
                <p className="mt-1 text-sm text-text/72">
                  {connection.domain} / {connection.providerCode} · {connection.healthState} · jobs {connection.pendingJobs}
                </p>
                {connection.mappingWarnings.length > 0 ? (
                  <p className="mt-2 text-sm leading-6 text-amber-900">{connection.mappingWarnings[0]}</p>
                ) : null}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>Queue and retry</CardTitle>
          <div className="mt-5 space-y-3">
            {workspace.jobs.map((job) => (
              <div key={job.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="font-semibold text-text">{job.jobType}</p>
                <p className="mt-1 text-sm text-text/72">
                  {job.status} · {job.idempotencyKey}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyJobId === job.id}
                    onClick={async () => {
                      setBusyJobId(job.id);
                      try {
                        await retryAdminIntegrationJob(job.id, "Manual retry requested from admin integrations panel.");
                        await reload();
                      } catch (actionError) {
                        setError(actionError instanceof Error ? actionError.message : "Retry action failed.");
                      } finally {
                        setBusyJobId(null);
                      }
                    }}
                  >
                    Retry
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function buildPreviewSource(domain: string): Record<string, string> {
  if (domain === "accounting") {
    return {
      customer_account: "CARI-1001",
      product_code: "SKU-001",
      payment_method: "card",
      tax_code: "KDV20"
    };
  }

  if (domain === "ecommerce") {
    return {
      product_code: "SKU-001",
      warehouse: "MERKEZ",
      order_status: "paid"
    };
  }

  if (domain === "einvoice") {
    return {
      document_type: "e_archive",
      tax_code: "KDV20",
      customer_account: "CARI-1001"
    };
  }

  if (domain === "collections") {
    return {
      payment_method: "card"
    };
  }

  if (domain === "messaging") {
    return {
      sender_id: "LOOMAPOS"
    };
  }

  return {
    reference: "sample"
  };
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-text/60">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-text">{value}</p>
    </Card>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
