import { apiFetch } from "@/lib/api-client";

export interface OpsOverview {
  environment: string;
  deploymentState: string;
  activeAlerts: number;
  openIncidents: number;
  failedBackups: number;
  failedRestoreValidations: number;
  securityWarnings: number;
  abuseFlags: number;
  queueHealth: string;
  latestRelease: string;
  apiAvailabilityTarget: string;
  lastDeploymentAt: string;
}

export interface OpsDeployment {
  id: string;
  environment: string;
  serviceName: string;
  version: string;
  commitSha: string;
  status: string;
  releaseChannel: string;
  artifactType: string;
  createdAt: string;
}

export interface OpsBackup {
  id: string;
  environment: string;
  backupType: string;
  status: string;
  region: string;
  retentionPolicy: string;
  startedAt: string;
  completedAt?: string | null;
}

export interface OpsRestoreValidation {
  id: string;
  environment: string;
  status: string;
  validationType: string;
  startedAt: string;
  completedAt?: string | null;
  backupRunId?: string | null;
}

export interface OpsIncident {
  id: string;
  environment: string;
  severity: string;
  title: string;
  status: string;
  category: string;
  owner?: string | null;
  openedAt: string;
  linkedRunbookCode?: string | null;
}

export interface OpsAlert {
  id: string;
  environment: string;
  severity: string;
  summary: string;
  status: string;
  triggeredAt: string;
  alertRuleCode?: string | null;
}

export interface OpsAuditLog {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string | null;
  createdAt: string;
}

export interface OpsRunbook {
  id: string;
  code: string;
  title: string;
  category: string;
  severity: string;
  markdownPath: string;
  status: string;
}

export interface OpsSlo {
  id: string;
  environment: string;
  serviceName: string;
  sloCode: string;
  objective: string;
  measurementWindow: string;
  alertPolicy: string;
  status: string;
}

export interface OpsSecurity {
  lastSecretRotation: string;
  openSecurityEvents: number;
  abuseFlags: number;
  rateLimitState: string;
  tenantIsolationState: string;
}

export interface OpsWorkspaceSnapshot {
  overview: OpsOverview;
  deployments: OpsDeployment[];
  backups: OpsBackup[];
  restoreValidations: OpsRestoreValidation[];
  incidents: OpsIncident[];
  alerts: OpsAlert[];
  opsAuditLogs: OpsAuditLog[];
  runbooks: OpsRunbook[];
  slos: OpsSlo[];
  security: OpsSecurity;
  dependencies: Array<Record<string, string | null>>;
  capacity: Array<Record<string, string | null>>;
  policies: Array<Record<string, string | null>>;
}

const fallbackWorkspace: OpsWorkspaceSnapshot = {
  overview: {
    environment: "production",
    deploymentState: "healthy",
    activeAlerts: 3,
    openIncidents: 1,
    failedBackups: 0,
    failedRestoreValidations: 0,
    securityWarnings: 2,
    abuseFlags: 1,
    queueHealth: "watch",
    latestRelease: "desktop 2.4.1",
    apiAvailabilityTarget: "99.9%",
    lastDeploymentAt: "2026-03-09T17:45:00Z"
  },
  deployments: [
    {
      id: "dep-api-1",
      environment: "production",
      serviceName: "api",
      version: "2026.03.09.1",
      commitSha: "7c2f4ad",
      status: "succeeded",
      releaseChannel: "stable",
      artifactType: "container",
      createdAt: "2026-03-09T17:45:00Z"
    },
    {
      id: "dep-web-1",
      environment: "production",
      serviceName: "web-admin",
      version: "2026.03.09.1",
      commitSha: "7c2f4ad",
      status: "canary",
      releaseChannel: "stable",
      artifactType: "bundle",
      createdAt: "2026-03-09T17:48:00Z"
    }
  ],
  backups: [
    {
      id: "backup-1",
      environment: "production",
      backupType: "postgres",
      status: "completed",
      region: "eu-central",
      retentionPolicy: "35d hot / 365d archive",
      startedAt: "2026-03-09T01:20:00Z",
      completedAt: "2026-03-09T01:27:00Z"
    }
  ],
  restoreValidations: [
    {
      id: "restore-1",
      environment: "dr",
      status: "completed",
      validationType: "restore_test",
      startedAt: "2026-03-09T02:00:00Z",
      completedAt: "2026-03-09T02:18:00Z",
      backupRunId: "backup-1"
    }
  ],
  incidents: [
    {
      id: "incident-1",
      environment: "production",
      severity: "sev2",
      title: "Provider webhook latency spike",
      status: "monitoring",
      category: "integrations",
      owner: "Ops rotation",
      openedAt: "2026-03-09T14:05:00Z",
      linkedRunbookCode: "provider-outage"
    }
  ],
  alerts: [
    {
      id: "alert-1",
      environment: "production",
      severity: "warning",
      summary: "Queue backlog exceeded warning threshold.",
      status: "open",
      triggeredAt: "2026-03-09T17:20:00Z",
      alertRuleCode: "queue_backlog_growth"
    }
  ],
  opsAuditLogs: [
    {
      id: "ops-audit-1",
      actorEmail: "ops@loomapos.local",
      action: "ops.alert.acknowledged",
      targetType: "alert_event",
      targetId: "alert-1",
      reason: "Validated and monitored",
      createdAt: "2026-03-09T17:45:00Z"
    }
  ],
  runbooks: [
    {
      id: "runbook-1",
      code: "failed-deploy-rollback",
      title: "Failed deployment rollback",
      category: "release",
      severity: "sev2",
      markdownPath: "docs/runbooks/failed-deployment-rollback.md",
      status: "active"
    }
  ],
  slos: [
    {
      id: "slo-1",
      environment: "production",
      serviceName: "api",
      sloCode: "api_availability",
      objective: "99.9%",
      measurementWindow: "30d",
      alertPolicy: "page on burn > 5%",
      status: "active"
    }
  ],
  security: {
    lastSecretRotation: "2026-03-01T09:00:00Z",
    openSecurityEvents: 2,
    abuseFlags: 1,
    rateLimitState: "active",
    tenantIsolationState: "tenant-keyed cache and queue fairness enforced"
  },
  dependencies: [
    { dependencyCode: "queue-rabbitmq", status: "healthy", lastErrorSummary: null, lastSuccessAt: "2026-03-09T18:10:00Z" },
    { dependencyCode: "payments-provider", status: "degraded", lastErrorSummary: "Elevated timeout p95", lastSuccessAt: "2026-03-09T18:07:00Z" }
  ],
  capacity: [
    { resourceType: "postgres", scope: "production-primary", utilizationSummary: "CPU 48% / Storage 62%", headroomState: "healthy", createdAt: "2026-03-09T18:00:00Z" },
    { resourceType: "queue", scope: "sync-workers", utilizationSummary: "Backlog 1.2k / Drain 8m", headroomState: "watch", createdAt: "2026-03-09T18:00:00Z" }
  ],
  policies: [
    { policyCode: "sync-events", scope: "tenant", target: "all", limitSummary: "600 req/min", status: "active" },
    { policyCode: "public-api", scope: "api-client", target: "partner", limitSummary: "120 req/min", status: "active" }
  ]
};

async function optionalOpsFetch<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path, { ignoreTenantHeaders: true });
  } catch {
    return null;
  }
}

export async function loadOpsWorkspace(): Promise<OpsWorkspaceSnapshot> {
  const remote = await optionalOpsFetch<OpsWorkspaceSnapshot>("/internal/admin/ops/workspace");
  return remote ?? fallbackWorkspace;
}

export async function acknowledgeOpsAlert(alertId: string, reason: string) {
  return await apiFetch<{ id: string; status: string; acknowledgedAt: string }>(`/internal/admin/ops/alerts/${alertId}/ack`, {
    method: "POST",
    body: JSON.stringify({ reason }),
    ignoreTenantHeaders: true
  });
}

export async function createOpsIncident(input: {
  title: string;
  category: string;
  severity: string;
  owner?: string;
  linkedRunbookCode?: string;
  impactSummary?: string;
  reason?: string;
}) {
  return await apiFetch<{ id: string; status: string }>(`/internal/admin/ops/incidents`, {
    method: "POST",
    body: JSON.stringify(input),
    ignoreTenantHeaders: true
  });
}

export async function updateOpsIncidentStatus(incidentId: string, status: string, reason: string, owner?: string, linkedRunbookCode?: string) {
  return await apiFetch<{ id: string; status: string }>(`/internal/admin/ops/incidents/${incidentId}/status`, {
    method: "POST",
    body: JSON.stringify({ status, reason, owner, linkedRunbookCode }),
    ignoreTenantHeaders: true
  });
}

export async function upsertOpsDependency(input: {
  dependencyCode: string;
  status: string;
  reason: string;
  environment?: string;
  lastErrorSummary?: string;
}) {
  return await apiFetch<{ dependencyCode: string; status: string }>(`/internal/admin/ops/dependencies/upsert`, {
    method: "POST",
    body: JSON.stringify(input),
    ignoreTenantHeaders: true
  });
}

export async function createOpsCapacitySnapshot(input: {
  resourceType: string;
  scope: string;
  utilizationSummary: string;
  headroomState: string;
  reason: string;
  environment?: string;
}) {
  return await apiFetch<{ id: string; resourceType: string }>(`/internal/admin/ops/capacity/snapshots`, {
    method: "POST",
    body: JSON.stringify(input),
    ignoreTenantHeaders: true
  });
}

export async function createOpsBackupRun(input: {
  backupType: string;
  region: string;
  retentionPolicy: string;
  reason: string;
  environment?: string;
}) {
  return await apiFetch<{ id: string; status: string }>(`/internal/admin/ops/backups/runs`, {
    method: "POST",
    body: JSON.stringify(input),
    ignoreTenantHeaders: true
  });
}

export async function createOpsRestoreValidationRun(input: {
  validationType: string;
  reason: string;
  backupRunId?: string;
  environment?: string;
  findingsJson?: string;
}) {
  return await apiFetch<{ id: string; status: string }>(`/internal/admin/ops/restore-validations/runs`, {
    method: "POST",
    body: JSON.stringify(input),
    ignoreTenantHeaders: true
  });
}
