"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  assignLeadToResellerGrowth,
  loadAssignableResellerLeads,
  loadResellerGrowthApplications,
  loadResellerGrowthDashboard,
  loadResellerGrowthResellers,
  reviewResellerGrowthApplication,
  type AssignableCrmLeadSummaryResponse,
  type ResellerProfileSummaryResponse
} from "@/lib/reseller-growth-service";
import type {
  ResellerApplicationRecord,
  ResellerGrowthDashboard
} from "@/lib/reseller-growth-types";

export function AdminResellerGrowthPanel() {
  const [dashboard, setDashboard] = useState<ResellerGrowthDashboard | null>(null);
  const [applications, setApplications] = useState<ResellerApplicationRecord[]>([]);
  const [resellers, setResellers] = useState<ResellerProfileSummaryResponse[]>([]);
  const [leads, setLeads] = useState<AssignableCrmLeadSummaryResponse[]>([]);
  const [query, setQuery] = useState("");
  const [assignmentForm, setAssignmentForm] = useState({
    leadId: "",
    resellerId: "",
    mode: "manual"
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async (search = query) => {
    setBusy(true);
    try {
      const [nextDashboard, nextApplications, nextResellers, nextLeads] = await Promise.all([
        loadResellerGrowthDashboard(),
        loadResellerGrowthApplications(),
        loadResellerGrowthResellers({ query: search || undefined }),
        loadAssignableResellerLeads({ query: search || undefined, minScore: 5 })
      ]);

      setDashboard(nextDashboard);
      setApplications(nextApplications);
      setResellers(nextResellers);
      setLeads(nextLeads.slice(0, 24));
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Reseller growth workspace could not be loaded."
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (task: () => Promise<void>, success: string) => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await task();
      await reload();
      setMessage(success);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Reseller growth control center</CardTitle>
        <p className="mt-3 text-sm leading-6 text-text/68">
          Approve channel applications, assign CRM leads, monitor commissions and track partner
          performance without mixing POS operations.
        </p>
      </Card>

      {dashboard ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Total resellers" value={String(dashboard.totals.totalResellers)} />
          <Metric label="Active resellers" value={String(dashboard.totals.activeResellers)} />
          <Metric
            label="Pending applications"
            value={String(dashboard.totals.pendingApplications)}
          />
          <Metric label="Leads generated" value={String(dashboard.totals.leadsGenerated)} />
          <Metric label="Conversions" value={String(dashboard.totals.conversionCount)} />
          <Metric label="Conversion rate" value={`${dashboard.totals.conversionRate}%`} />
          <Metric label="Revenue" value={formatCurrency(dashboard.totals.revenue)} />
          <Metric label="Pending payout" value={formatCurrency(dashboard.totals.pendingPayout)} />
        </div>
      ) : (
        <Card>
          <p className="text-sm text-text/68">Loading dashboard...</p>
        </Card>
      )}

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

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle>Application review queue</CardTitle>
          <div className="mt-5 space-y-3">
            {applications.length === 0 ? (
              <p className="text-sm text-text/68">No applications in queue.</p>
            ) : (
              applications.slice(0, 12).map((application) => (
                <div
                  key={application.applicationId}
                  className="rounded-[24px] border border-line bg-muted/30 px-4 py-4"
                >
                  <p className="font-semibold text-text">{application.companyName}</p>
                  <p className="mt-1 text-sm text-text/72">
                    {application.name} - {application.email}
                  </p>
                  <p className="mt-1 text-sm text-text/72">
                    {application.region} - {application.businessType} - {application.status}
                  </p>
                  {application.status === "submitted" || application.status === "under_review" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            async () => {
                              await reviewResellerGrowthApplication(
                                application.applicationId,
                                {
                                  decision: "approved",
                                  reviewer: "admin:channel_manager",
                                  note: "Approved from admin channel queue.",
                                  commissionRate: 0.12
                                }
                              );
                            },
                            "Application approved."
                          )
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            async () => {
                              await reviewResellerGrowthApplication(
                                application.applicationId,
                                {
                                  decision: "rejected",
                                  reviewer: "admin:channel_manager",
                                  note: "Rejected from admin channel queue."
                                }
                              );
                            },
                            "Application rejected."
                          )
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Lead assignment</CardTitle>
          <div className="mt-5 grid gap-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search lead or reseller"
            />
            <Button variant="outline" disabled={busy} onClick={() => void reload(query)}>
              Refresh search
            </Button>
            <Input
              value={assignmentForm.leadId}
              onChange={(event) =>
                setAssignmentForm((current) => ({ ...current, leadId: event.target.value }))
              }
              placeholder="Lead ID"
            />
            <Input
              value={assignmentForm.resellerId}
              onChange={(event) =>
                setAssignmentForm((current) => ({ ...current, resellerId: event.target.value }))
              }
              placeholder="Reseller ID"
            />
            <Input
              value={assignmentForm.mode}
              onChange={(event) =>
                setAssignmentForm((current) => ({ ...current, mode: event.target.value }))
              }
              placeholder="Mode (manual/auto_region/auto_performance)"
            />
            <Button
              disabled={busy || !assignmentForm.leadId || !assignmentForm.resellerId}
              onClick={() =>
                void run(
                  async () => {
                    await assignLeadToResellerGrowth({
                      leadId: assignmentForm.leadId,
                      resellerId: assignmentForm.resellerId,
                      assignedBy: "admin:channel_manager",
                      mode:
                        assignmentForm.mode === "auto_region" ||
                        assignmentForm.mode === "auto_performance"
                          ? assignmentForm.mode
                          : "manual"
                    });
                    setAssignmentForm({ leadId: "", resellerId: "", mode: "manual" });
                  },
                  "Lead assignment saved."
                )
              }
            >
              Assign lead
            </Button>
          </div>
          <div className="mt-5 space-y-3">
            {leads.map((lead) => (
              <div key={lead.leadId} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="font-semibold text-text">{lead.companyName}</p>
                <p className="mt-1 text-sm text-text/72">
                  {lead.leadId} - {lead.status} - score {lead.score}
                </p>
                <p className="mt-1 text-xs text-text/60">
                  Assigned reseller: {lead.assignedResellerId ?? "unassigned"}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Reseller performance list</CardTitle>
        <div className="mt-5 space-y-3">
          {resellers.map((item) => (
            <div key={item.reseller.resellerId} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold text-text">{item.reseller.companyName}</p>
                  <p className="mt-1 text-sm text-text/72">
                    {item.reseller.resellerId} - {item.reseller.status} - tier {item.reseller.tier}
                  </p>
                  <p className="mt-2 text-sm text-text/72">
                    Leads {item.metrics.leadsGenerated} | Conversions {item.metrics.conversionCount} | Conversion rate {item.metrics.conversionRate}%
                  </p>
                  <p className="mt-1 text-sm text-text/72">
                    Revenue {formatCurrency(item.metrics.revenue)} | Pending {formatCurrency(item.metrics.pendingCommission)}
                  </p>
                </div>
                <Link
                  href={`/admin/resellers/${item.reseller.resellerId}`}
                  className="text-sm font-semibold text-brand"
                >
                  Open reseller detail
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Card>
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

function formatCurrency(value: number, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}
