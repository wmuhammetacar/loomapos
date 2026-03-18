"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { loadCrmLeads, patchCrmLead } from "@/lib/crm-service";
import {
  crmLeadSources,
  crmLeadStatuses,
  type CrmLead,
  type CrmLeadSource,
  type CrmLeadStatus
} from "@/lib/crm-types";

const pipelineOrder: CrmLeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "demo_scheduled",
  "proposal_sent",
  "converted",
  "lost"
];

const selectClassName =
  "h-10 w-full rounded-full border border-line bg-white px-4 text-sm text-text outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

function labelize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function AdminCrmPanel() {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [statusFilter, setStatusFilter] = useState<CrmLeadStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<CrmLeadSource | "all">("all");
  const [query, setQuery] = useState("");
  const [minScore, setMinScore] = useState<string>("");
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof loadCrmLeads>>["metrics"] | null>(null);
  const [salesUsers, setSalesUsers] = useState<Awaited<ReturnType<typeof loadCrmLeads>>["salesUsers"]>([]);
  const [notifications, setNotifications] = useState<Awaited<ReturnType<typeof loadCrmLeads>>["notifications"]>([]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const snapshot = await loadCrmLeads({
        status: statusFilter === "all" ? undefined : statusFilter,
        source: sourceFilter === "all" ? undefined : sourceFilter,
        query: query.trim() || undefined,
        minScore: minScore ? Number(minScore) : undefined
      });

      setLeads(snapshot.leads);
      setMetrics(snapshot.metrics);
      setSalesUsers(snapshot.salesUsers);
      setNotifications(snapshot.notifications.slice(0, 8));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "CRM data could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, sourceFilter, query, minScore]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const leadByStatus = useMemo(() => {
    return pipelineOrder.reduce<Record<CrmLeadStatus, CrmLead[]>>((acc, status) => {
      acc[status] = leads.filter((lead) => lead.status === status);
      return acc;
    }, {
      new: [],
      contacted: [],
      qualified: [],
      demo_scheduled: [],
      proposal_sent: [],
      converted: [],
      lost: []
    });
  }, [leads]);

  async function moveLead(leadId: string, nextStatus: CrmLeadStatus) {
    await patchCrmLead(leadId, { status: nextStatus });
    await refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Sales CRM dashboard</CardTitle>
        <p className="mt-3 text-sm leading-6 text-text/72">
          Capture and prioritize website leads, manage pipeline stages, schedule demos and track lead-to-customer conversion.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Total leads" value={String(metrics?.totalLeads ?? 0)} />
          <Metric label="New today" value={String(metrics?.newLeadsToday ?? 0)} />
          <Metric label="Conversion rate" value={`${metrics?.conversionRate ?? 0}%`} />
          <Metric label="High score leads" value={String(metrics?.highScoreLeads ?? 0)} />
          <Metric label="Abandoned checkouts" value={String(metrics?.abandonedCheckoutLeads ?? 0)} />
          <Metric label="Top sales rep" value={metrics?.topSalesReps[0]?.name ?? "-"} />
          <Metric
            label="Pipeline: Qualified"
            value={String(metrics?.pipelineDistribution.qualified ?? 0)}
          />
          <Metric
            label="Pipeline: Converted"
            value={String(metrics?.pipelineDistribution.converted ?? 0)}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Lead filters and search</CardTitle>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input
            placeholder="Search name, company or email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            value={statusFilter}
            className={selectClassName}
            onChange={(event) =>
              setStatusFilter((event.target.value as CrmLeadStatus | "all") ?? "all")
            }
          >
            <option value="all">All statuses</option>
            {crmLeadStatuses.map((status) => (
              <option key={status} value={status}>
                {labelize(status)}
              </option>
            ))}
          </select>
          <select
            value={sourceFilter}
            className={selectClassName}
            onChange={(event) =>
              setSourceFilter((event.target.value as CrmLeadSource | "all") ?? "all")
            }
          >
            <option value="all">All sources</option>
            {crmLeadSources.map((source) => (
              <option key={source} value={source}>
                {labelize(source)}
              </option>
            ))}
          </select>
          <Input
            placeholder="Minimum score"
            value={minScore}
            onChange={(event) => setMinScore(event.target.value.replace(/[^0-9]/g, ""))}
          />
          <Button variant="outline" onClick={() => void refresh()}>
            Apply filters
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <Card>
          <CardTitle>Loading CRM pipeline</CardTitle>
          <p className="mt-3 text-sm text-text/70">Collecting lead, scoring and activity data...</p>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <CardTitle>CRM load error</CardTitle>
          <p className="mt-3 text-sm text-danger">{error}</p>
        </Card>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-7">
        {pipelineOrder.map((status) => (
          <Card
            key={status}
            className="min-h-[420px]"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (!dragLeadId) {
                return;
              }
              void moveLead(dragLeadId, status);
              setDragLeadId(null);
            }}
          >
            <CardTitle>{labelize(status)}</CardTitle>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-text/55">
              {leadByStatus[status].length} lead
            </p>
            <div className="mt-4 space-y-3">
              {leadByStatus[status].map((lead) => (
                <div
                  key={lead.leadId}
                  draggable
                  onDragStart={() => setDragLeadId(lead.leadId)}
                  className="rounded-[20px] border border-line bg-muted/30 px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-text">{lead.companyName}</p>
                    <span className={badgeClass(lead.score)}>Score {lead.score}</span>
                  </div>
                  <p className="mt-2 text-sm text-text/72">{lead.name}</p>
                  <p className="mt-1 text-xs text-text/55">{lead.email}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-text/55">
                    {labelize(lead.source)}
                  </p>
                  <p className="mt-1 text-xs text-text/55">
                    Assigned: {salesUsers.find((user) => user.userId === lead.assignedTo)?.name ?? "Unassigned"}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Link href={`/admin/crm/leads/${lead.leadId}`} className="text-xs font-semibold text-brand">
                      Open detail
                    </Link>
                    <button
                      type="button"
                      className="text-xs font-semibold text-text/72"
                      onClick={() => void moveLead(lead.leadId, nextQuickStatus(lead.status))}
                    >
                      Next stage
                    </button>
                  </div>
                </div>
              ))}
              {leadByStatus[status].length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-line px-4 py-4 text-xs text-text/55">
                  No leads in this stage.
                </div>
              ) : null}
            </div>
          </Card>
        ))}
      </section>

      <Card>
        <CardTitle>Sales notifications</CardTitle>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {notifications.map((item) => (
            <div key={item.notificationId} className="rounded-[20px] border border-line bg-muted/30 px-4 py-4">
              <p className="font-semibold text-text">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-text/72">{item.detail}</p>
            </div>
          ))}
          {notifications.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-line px-4 py-4 text-sm text-text/70">
              No notifications at the moment.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-line bg-muted/30 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.14em] text-text/55">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text">{value}</p>
    </div>
  );
}

function badgeClass(score: number) {
  if (score >= 80) {
    return "rounded-full border border-success/40 bg-success/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-success";
  }
  if (score >= 50) {
    return "rounded-full border border-brand/30 bg-brand/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand";
  }
  return "rounded-full border border-line bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text/70";
}

function nextQuickStatus(status: CrmLeadStatus): CrmLeadStatus {
  switch (status) {
    case "new":
      return "contacted";
    case "contacted":
      return "qualified";
    case "qualified":
      return "demo_scheduled";
    case "demo_scheduled":
      return "proposal_sent";
    case "proposal_sent":
      return "converted";
    case "converted":
      return "converted";
    case "lost":
      return "lost";
    default:
      return status;
  }
}
