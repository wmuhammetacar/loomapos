"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { AdminCrmPanel } from "@/components/admin/admin-crm-panels";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { endSupportAccessSession, loadAdminWorkspace, startSupportAccessSession, type AdminWorkspaceSnapshot } from "@/lib/admin-service";

export type AdminSection =
  | "overview"
  | "tenants"
  | "subscriptions"
  | "licenses"
  | "devices"
  | "payments"
  | "invoices"
  | "resellers"
  | "support"
  | "sync"
  | "queues"
  | "dead-letter"
  | "integrations"
  | "releases"
  | "feature-flags"
  | "coupons"
  | "campaigns"
  | "notices"
  | "crm"
  | "security"
  | "audit"
  | "settings";

export function AdminPanels({ section }: { section: AdminSection }) {
  const [snapshot, setSnapshot] = useState<AdminWorkspaceSnapshot | null>(null);
  const [supportTenantId, setSupportTenantId] = useState("");
  const [supportReason, setSupportReason] = useState("");
  const [supportMode, setSupportMode] = useState<"shadow_view" | "impersonation">("shadow_view");
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadAdminWorkspace().then(setSnapshot);
  }, []);

  if (section === "crm") {
    return <AdminCrmPanel />;
  }

  if (!snapshot) {
    return (
      <Card>
        <CardTitle>Loading internal workspace</CardTitle>
        <p className="mt-3 text-sm leading-6 text-text/68">
          Collecting tenant, billing, support and observability signals.
        </p>
      </Card>
    );
  }

  if (section === "overview") {
    return (
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Metric label="Active tenants" value={String(snapshot.overview.activeTenants)} />
        <Metric label="Trial tenants" value={String(snapshot.overview.trialTenants)} />
        <Metric label="Past due" value={String(snapshot.overview.pastDueSubscriptions)} />
        <Metric label="Failed renewals" value={String(snapshot.overview.failedRenewals)} />
        <Metric label="Active devices" value={String(snapshot.overview.activeDevices)} />
        <Metric label="Device limit violations" value={String(snapshot.overview.deviceLimitViolations)} />
        <Metric label="Sync failure rate" value={snapshot.overview.syncFailureRate} />
        <Metric label="Dead letters" value={String(snapshot.overview.deadLetterCount)} />
        <Metric label="Open cases" value={String(snapshot.overview.openSupportCases)} />
        <Metric label="Billing issues" value={String(snapshot.overview.unresolvedBillingIssues)} />
        <Metric label="Reseller conversions" value={String(snapshot.overview.resellerMonthlyConversions)} />
        <Metric label="Release adoption" value={snapshot.overview.latestReleaseAdoption} />
      </div>
    );
  }

  if (section === "tenants") {
    return (
      <ListCard title="Tenant search and inspection">
        {snapshot.tenants.map((tenant) => (
          <div key={tenant.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-semibold text-text">{tenant.companyName}</p>
                <p className="mt-1 text-sm text-text/72">
                  {tenant.tenantCode} - {tenant.planCode} - {tenant.subscriptionStatus}
                </p>
                <p className="mt-2 text-sm text-text/72">
                  {tenant.ownerEmail} | Devices {tenant.deviceCount}/{tenant.deviceLimit}
                </p>
              </div>
              <Link href={`/admin/tenants/${tenant.id}`} className="text-sm font-semibold text-brand">
                Inspect tenant
              </Link>
            </div>
          </div>
        ))}
      </ListCard>
    );
  }

  if (section === "resellers") {
    return (
      <ListCard title="Reseller operations">
        {snapshot.resellers.map((reseller) => (
          <div key={reseller.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-semibold text-text">{reseller.name}</p>
                <p className="mt-1 text-sm text-text/72">
                  {reseller.code} - {reseller.status} - customers {reseller.customers}
                </p>
                <p className="mt-2 text-sm text-text/72">
                  Pending {formatCurrency(reseller.pendingCommission)} | Paid {formatCurrency(reseller.paidOut)}
                </p>
              </div>
              <Link href={`/admin/resellers/${reseller.id}`} className="text-sm font-semibold text-brand">
                Inspect reseller
              </Link>
            </div>
          </div>
        ))}
      </ListCard>
    );
  }

  if (section === "support") {
    return (
      <ListCard title="Support cases">
        {snapshot.supportCases.map((item) => (
          <div key={item.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
            <p className="font-semibold text-text">{item.title}</p>
            <p className="mt-1 text-sm text-text/72">
              {item.category} - {item.priority} - {item.status}
            </p>
            <p className="mt-2 text-sm leading-6 text-text/72">{item.summary}</p>
            <Link href={`/admin/support/cases/${item.id}`} className="mt-3 inline-block text-sm font-semibold text-brand">
              Open case
            </Link>
          </div>
        ))}
      </ListCard>
    );
  }

  if (section === "dead-letter") {
    return (
      <ListCard title="Dead-letter events">
        {snapshot.deadLetters.map((item) => (
          <div key={item.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
            <p className="font-semibold text-text">{item.eventType}</p>
            <p className="mt-1 text-sm text-text/72">
              Tenant {item.tenantId} - Device {item.deviceId}
            </p>
            <p className="mt-2 text-sm leading-6 text-text/72">{item.failureReason}</p>
          </div>
        ))}
      </ListCard>
    );
  }

  if (section === "releases") {
    return (
      <ListCard title="Release oversight">
        {snapshot.releases.map((item) => (
          <div key={item.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
            <p className="font-semibold text-text">{item.platform} {item.version}</p>
            <p className="mt-1 text-sm text-text/72">
              {item.status} - adoption {item.adoption} - min {item.minSupportedVersion}
            </p>
          </div>
        ))}
      </ListCard>
    );
  }

  if (section === "feature-flags") {
    return (
      <ListCard title="Feature flag control">
        {snapshot.featureFlags.map((item) => (
          <div key={item.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
            <p className="font-semibold text-text">{item.code}</p>
            <p className="mt-1 text-sm text-text/72">
              {item.scope} - {item.state} - {item.target}
            </p>
          </div>
        ))}
      </ListCard>
    );
  }

  if (section === "coupons") {
    return (
      <ListCard title="Coupons and trial offers">
        {snapshot.coupons.map((item) => (
          <div key={item.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
            <p className="font-semibold text-text">{item.code}</p>
            <p className="mt-1 text-sm text-text/72">
              {item.type} - {item.value} - {item.usage}
            </p>
            <p className="mt-2 text-sm text-text/72">Expires {formatDate(item.expiresAt)} - {item.status}</p>
          </div>
        ))}
      </ListCard>
    );
  }

  if (section === "notices") {
    return (
      <ListCard title="Internal and customer notices">
        {snapshot.notices.map((item) => (
          <div key={item.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
            <p className="font-semibold text-text">{item.title}</p>
            <p className="mt-1 text-sm text-text/72">
              {item.audience} - {item.status}
            </p>
          </div>
        ))}
      </ListCard>
    );
  }

  if (section === "security") {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Metric label="Active admin sessions" value={String(snapshot.security.activeSessions)} />
        <Metric label="Impersonation sessions" value={String(snapshot.security.impersonationSessions)} />
        <Metric label="Last secret rotation" value={formatDate(snapshot.security.lastSecretRotation)} />
        <Card>
          <CardTitle>Support access session control</CardTitle>
          <div className="mt-5 grid gap-3">
            <Input value={supportTenantId} onChange={(event) => setSupportTenantId(event.target.value)} placeholder="Tenant ID (optional)" />
            <Input value={supportMode} onChange={(event) => setSupportMode(event.target.value === "impersonation" ? "impersonation" : "shadow_view")} placeholder="Mode: shadow_view | impersonation" />
            <Input value={supportReason} onChange={(event) => setSupportReason(event.target.value)} placeholder="Reason (required)" />
            <Button
              variant="outline"
              disabled={!supportReason}
              onClick={async () => {
                await startSupportAccessSession(supportTenantId || null, supportMode, supportReason);
                setSecurityMessage("Support access session started.");
                setSnapshot(await loadAdminWorkspace());
              }}
            >
              Start session
            </Button>
          </div>
          {securityMessage ? <p className="mt-4 text-sm text-brand">{securityMessage}</p> : null}
        </Card>
        <ListCard title="Internal users">
          {snapshot.security.internalUsers.map((item) => (
            <div key={item.email} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
              <p className="font-semibold text-text">{item.email}</p>
              <p className="mt-1 text-sm text-text/72">
                {item.role} - {item.status}
              </p>
            </div>
          ))}
        </ListCard>
        <ListCard title="Recent support access sessions">
          {(snapshot.security.supportAccessSessions ?? []).map((item) => (
            <div key={item.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
              <p className="font-semibold text-text">{item.accessMode}</p>
              <p className="mt-1 text-sm text-text/72">
                {item.status} - {item.tenantId ?? "global"} - expires {formatDate(item.expiresAt)}
              </p>
              <p className="mt-2 text-sm text-text/72">{item.reason}</p>
              {item.status === "active" ? (
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={async () => {
                    const reason = `Ended from security panel at ${new Date().toISOString()}`;
                    await endSupportAccessSession(item.id, reason);
                    setSecurityMessage("Support access session ended.");
                    setSnapshot(await loadAdminWorkspace());
                  }}
                >
                  End session
                </Button>
              ) : null}
            </div>
          ))}
          {(snapshot.security.supportAccessSessions ?? []).length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-line px-4 py-4 text-sm text-text/68">
              No recent support access sessions.
            </div>
          ) : null}
        </ListCard>
      </div>
    );
  }

  return (
    <ListCard title={sectionLabel(section)}>
      <div className="rounded-[24px] border border-dashed border-line px-4 py-5 text-sm leading-6 text-text/68">
        This section is scaffolded for Phase 7 internal operations. The route, navigation and typed service contract are in place for deeper backend wiring.
      </div>
    </ListCard>
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

function formatCurrency(value: number, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function sectionLabel(section: AdminSection) {
  return section
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
