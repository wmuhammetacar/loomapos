"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  acknowledgeOpsAlert,
  createOpsBackupRun,
  createOpsCapacitySnapshot,
  createOpsIncident,
  createOpsRestoreValidationRun,
  loadOpsWorkspace,
  updateOpsIncidentStatus,
  upsertOpsDependency,
  type OpsWorkspaceSnapshot
} from "@/lib/ops-service";

export type OpsSection = "deployments" | "backups" | "incidents" | "runbooks" | "slo";

export function AdminOpsPanel({ section }: { section: OpsSection }) {
  const [snapshot, setSnapshot] = useState<OpsWorkspaceSnapshot | null>(null);
  const [reason, setReason] = useState("");
  const [incidentTitle, setIncidentTitle] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState("sev3");
  const [incidentCategory, setIncidentCategory] = useState("operations");
  const [incidentId, setIncidentId] = useState("");
  const [incidentStatus, setIncidentStatus] = useState("investigating");
  const [dependencyCode, setDependencyCode] = useState("");
  const [dependencyStatus, setDependencyStatus] = useState("healthy");
  const [capacityResource, setCapacityResource] = useState("");
  const [capacityScope, setCapacityScope] = useState("");
  const [capacityUtilization, setCapacityUtilization] = useState("");
  const [backupType, setBackupType] = useState("postgres");
  const [backupRegion, setBackupRegion] = useState("eu-central-1");
  const [backupRetention, setBackupRetention] = useState("35d hot / 365d archive");
  const [restoreType, setRestoreType] = useState("restore_test");
  const [restoreBackupId, setRestoreBackupId] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadOpsWorkspace().then(setSnapshot);
  }, []);

  if (!snapshot) {
    return (
      <Card>
        <CardTitle>Loading production ops workspace</CardTitle>
        <p className="mt-3 text-sm leading-6 text-text/68">
          Collecting deployment, backup, incident and SLO telemetry.
        </p>
      </Card>
    );
  }

  if (section === "deployments") {
    return (
      <div className="space-y-6">
        <Metrics snapshot={snapshot} />
        <Card>
          <CardTitle>Live telemetry updates</CardTitle>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Input value={dependencyCode} onChange={(event) => setDependencyCode(event.target.value)} placeholder="Dependency code (queue-rabbitmq)" />
            <Input value={dependencyStatus} onChange={(event) => setDependencyStatus(event.target.value)} placeholder="Status (healthy/degraded/down)" />
            <Button
              variant="outline"
              disabled={!dependencyCode || !dependencyStatus || !reason}
              onClick={async () => {
                await upsertOpsDependency({ dependencyCode, status: dependencyStatus, reason });
                setActionMessage("Dependency status updated.");
                setSnapshot(await loadOpsWorkspace());
              }}
            >
              Update dependency
            </Button>
            <Input value={capacityResource} onChange={(event) => setCapacityResource(event.target.value)} placeholder="Resource type (postgres/queue)" />
            <Input value={capacityScope} onChange={(event) => setCapacityScope(event.target.value)} placeholder="Scope (production-primary)" />
            <Input value={capacityUtilization} onChange={(event) => setCapacityUtilization(event.target.value)} placeholder="Utilization summary" />
            <Button
              variant="outline"
              disabled={!capacityResource || !capacityScope || !capacityUtilization || !reason}
              onClick={async () => {
                await createOpsCapacitySnapshot({
                  resourceType: capacityResource,
                  scope: capacityScope,
                  utilizationSummary: capacityUtilization,
                  headroomState: "watch",
                  reason
                });
                setActionMessage("Capacity snapshot added.");
                setSnapshot(await loadOpsWorkspace());
              }}
            >
              Add capacity snapshot
            </Button>
          </div>
          <Input
            className="mt-4"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason required for operational changes"
          />
          {actionMessage ? <p className="mt-4 text-sm text-brand">{actionMessage}</p> : null}
        </Card>
        <ListCard title="Deployments and release state">
          {snapshot.deployments.map((item) => (
            <RowCard
              key={item.id}
              title={`${item.serviceName} ${item.version}`}
              meta={`${item.environment} - ${item.status} - ${item.releaseChannel}`}
              body={`Commit ${item.commitSha} deployed as ${item.artifactType} on ${formatDateTime(item.createdAt)}.`}
            />
          ))}
        </ListCard>
        <ListCard title="Dependency visibility">
          {snapshot.dependencies.map((item, index) => (
            <RowCard
              key={`${item.dependencyCode ?? "dep"}-${index}`}
              title={String(item.dependencyCode ?? "dependency")}
              meta={String(item.status ?? "unknown")}
              body={`Last success: ${item.lastSuccessAt ?? "n/a"}${item.lastErrorSummary ? ` | Last error: ${item.lastErrorSummary}` : ""}`}
            />
          ))}
        </ListCard>
      </div>
    );
  }

  if (section === "backups") {
    return (
      <div className="space-y-6">
        <Metrics snapshot={snapshot} />
        <Card>
          <CardTitle>Backup and restore actions</CardTitle>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Input value={backupType} onChange={(event) => setBackupType(event.target.value)} placeholder="Backup type" />
            <Input value={backupRegion} onChange={(event) => setBackupRegion(event.target.value)} placeholder="Region" />
            <Input value={backupRetention} onChange={(event) => setBackupRetention(event.target.value)} placeholder="Retention policy" />
            <Button
              variant="outline"
              disabled={!backupType || !backupRegion || !backupRetention || !reason}
              onClick={async () => {
                await createOpsBackupRun({
                  backupType,
                  region: backupRegion,
                  retentionPolicy: backupRetention,
                  reason
                });
                setActionMessage("Backup run created.");
                setSnapshot(await loadOpsWorkspace());
              }}
            >
              Create backup run
            </Button>
            <Input value={restoreType} onChange={(event) => setRestoreType(event.target.value)} placeholder="Validation type" />
            <Input value={restoreBackupId} onChange={(event) => setRestoreBackupId(event.target.value)} placeholder="Backup run id (optional)" />
            <Button
              variant="outline"
              disabled={!restoreType || !reason}
              onClick={async () => {
                await createOpsRestoreValidationRun({
                  validationType: restoreType,
                  backupRunId: restoreBackupId || undefined,
                  reason
                });
                setActionMessage("Restore validation run created.");
                setSnapshot(await loadOpsWorkspace());
              }}
            >
              Create restore validation
            </Button>
          </div>
          <Input
            className="mt-4"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason required for backup/restore actions"
          />
          {actionMessage ? <p className="mt-4 text-sm text-brand">{actionMessage}</p> : null}
        </Card>
        <ListCard title="Backup and restore validation">
          {snapshot.backups.map((item) => (
            <RowCard
              key={item.id}
              title={`${item.backupType} - ${item.status}`}
              meta={`${item.environment} - ${item.region}`}
              body={`Started ${formatDateTime(item.startedAt)}. Retention ${item.retentionPolicy}. Completed ${item.completedAt ? formatDateTime(item.completedAt) : "pending"}.`}
            />
          ))}
        </ListCard>
        <ListCard title="Restore validation timeline">
          {snapshot.restoreValidations.map((item) => (
            <RowCard
              key={item.id}
              title={`${item.validationType} - ${item.status}`}
              meta={`${item.environment} - ${item.backupRunId ?? "no backup link"}`}
              body={`Started ${formatDateTime(item.startedAt)}. Completed ${item.completedAt ? formatDateTime(item.completedAt) : "pending"}.`}
            />
          ))}
        </ListCard>
        <ListCard title="Ops audit trail">
          {snapshot.opsAuditLogs.map((item) => (
            <RowCard
              key={item.id}
              title={`${item.action} (${item.actorEmail})`}
              meta={`${item.targetType} - ${item.targetId}`}
              body={`${item.reason ?? "No reason"} | ${formatDateTime(item.createdAt)}`}
            />
          ))}
        </ListCard>
      </div>
    );
  }

  if (section === "incidents") {
    return (
      <div className="space-y-6">
        <Metrics snapshot={snapshot} />
        <Card>
          <CardTitle>Incident and alert actions</CardTitle>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Input value={incidentTitle} onChange={(event) => setIncidentTitle(event.target.value)} placeholder="Incident title" />
            <Input value={incidentCategory} onChange={(event) => setIncidentCategory(event.target.value)} placeholder="Category" />
            <Input value={incidentSeverity} onChange={(event) => setIncidentSeverity(event.target.value)} placeholder="Severity (sev1/sev2/sev3)" />
            <Button
              variant="outline"
              disabled={!incidentTitle || !incidentCategory || !incidentSeverity || !reason}
              onClick={async () => {
                await createOpsIncident({
                  title: incidentTitle,
                  category: incidentCategory,
                  severity: incidentSeverity,
                  reason
                });
                setActionMessage("Incident created.");
                setIncidentTitle("");
                setSnapshot(await loadOpsWorkspace());
              }}
            >
              Create incident
            </Button>
            <Input value={incidentId} onChange={(event) => setIncidentId(event.target.value)} placeholder="Incident id" />
            <Input value={incidentStatus} onChange={(event) => setIncidentStatus(event.target.value)} placeholder="Next status" />
            <Button
              variant="outline"
              disabled={!incidentId || !incidentStatus || !reason}
              onClick={async () => {
                await updateOpsIncidentStatus(incidentId, incidentStatus, reason);
                setActionMessage("Incident status updated.");
                setSnapshot(await loadOpsWorkspace());
              }}
            >
              Update incident status
            </Button>
          </div>
          <Input
            className="mt-4"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason required for incident/alert actions"
          />
          {actionMessage ? <p className="mt-4 text-sm text-brand">{actionMessage}</p> : null}
        </Card>
        <ListCard title="Incident lifecycle">
          {snapshot.incidents.map((item) => (
            <RowCard
              key={item.id}
              title={item.title}
              meta={`${item.severity} - ${item.status} - ${item.category}`}
              body={`Opened ${formatDateTime(item.openedAt)}${item.owner ? ` | Owner ${item.owner}` : ""}${item.linkedRunbookCode ? ` | Runbook ${item.linkedRunbookCode}` : ""}`}
            />
          ))}
        </ListCard>
        <ListCard title="Alerts">
          {snapshot.alerts.map((item) => (
            <div key={item.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
              <p className="font-semibold text-text">{item.summary}</p>
              <p className="mt-1 text-sm text-text/72">
                {item.severity} - {item.status} - {formatDateTime(item.triggeredAt)}
              </p>
              <p className="mt-2 text-sm text-text/72">Rule: {item.alertRuleCode ?? "-"}</p>
              {item.status === "open" ? (
                <Button
                  variant="outline"
                  className="mt-3"
                  disabled={!reason}
                  onClick={async () => {
                    await acknowledgeOpsAlert(item.id, reason);
                    setActionMessage("Alert acknowledged.");
                    setSnapshot(await loadOpsWorkspace());
                  }}
                >
                  Acknowledge alert
                </Button>
              ) : null}
            </div>
          ))}
        </ListCard>
      </div>
    );
  }

  if (section === "runbooks") {
    return (
      <ListCard title="Runbooks">
        {snapshot.runbooks.map((item) => (
          <RowCard
            key={item.id}
            title={`${item.code} - ${item.title}`}
            meta={`${item.category} - ${item.severity} - ${item.status}`}
            body={`Source: ${item.markdownPath}`}
          />
        ))}
      </ListCard>
    );
  }

  return (
    <div className="space-y-6">
      <Metrics snapshot={snapshot} />
      <ListCard title="Service objectives">
        {snapshot.slos.map((item) => (
          <RowCard
            key={item.id}
            title={`${item.serviceName} - ${item.sloCode}`}
            meta={`${item.objective} - ${item.measurementWindow}`}
            body={`Alert policy: ${item.alertPolicy} | Status ${item.status}`}
          />
        ))}
      </ListCard>
      <ListCard title="Rate-limit and fairness policies">
        {snapshot.policies.map((item, index) => (
          <RowCard
            key={`${item.policyCode ?? "policy"}-${index}`}
            title={String(item.policyCode ?? "policy")}
            meta={`${item.scope ?? "scope"} - ${item.status ?? "status"}`}
            body={`Target ${item.target ?? "all"} | ${item.limitSummary ?? "n/a"}`}
          />
        ))}
      </ListCard>
    </div>
  );
}

function Metrics({ snapshot }: { snapshot: OpsWorkspaceSnapshot }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Metric label="Environment" value={snapshot.overview.environment} />
      <Metric label="Deployment state" value={snapshot.overview.deploymentState} />
      <Metric label="Open incidents" value={String(snapshot.overview.openIncidents)} />
      <Metric label="Failed backups" value={String(snapshot.overview.failedBackups)} />
      <Metric label="Security warnings" value={String(snapshot.overview.securityWarnings)} />
      <Metric label="Abuse flags" value={String(snapshot.overview.abuseFlags)} />
      <Metric label="Queue health" value={snapshot.overview.queueHealth} />
      <Metric label="Latest release" value={snapshot.overview.latestRelease} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-text/60">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-text">{value}</p>
    </Card>
  );
}

function ListCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div className="mt-5 space-y-3">{children}</div>
    </Card>
  );
}

function RowCard({ title, meta, body }: { title: string; meta: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
      <p className="font-semibold text-text">{title}</p>
      <p className="mt-1 text-sm text-text/72">{meta}</p>
      <p className="mt-2 text-sm leading-6 text-text/72">{body}</p>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
