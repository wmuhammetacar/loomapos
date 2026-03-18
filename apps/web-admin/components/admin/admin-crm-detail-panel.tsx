"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addCrmLeadNote,
  loadCrmDashboard,
  loadCrmLeadDetail,
  patchCrmLead,
  scheduleCrmLeadDemo
} from "@/lib/crm-service";
import {
  crmDemoStatuses,
  crmLeadStatuses,
  type CrmDemoStatus,
  type CrmLeadDetailResponse,
  type CrmLeadStatus,
  type CrmSalesUser
} from "@/lib/crm-types";

const selectClassName =
  "h-10 w-full rounded-full border border-line bg-white px-4 text-sm text-text outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

function labelize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function AdminCrmLeadDetailPanel({ leadId }: { leadId: string }) {
  const [detail, setDetail] = useState<CrmLeadDetailResponse | null>(null);
  const [salesUsers, setSalesUsers] = useState<CrmSalesUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [status, setStatus] = useState<CrmLeadStatus>("new");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [note, setNote] = useState("");

  const [demoDate, setDemoDate] = useState("");
  const [demoTime, setDemoTime] = useState("");
  const [demoRep, setDemoRep] = useState("");
  const [demoLink, setDemoLink] = useState("");
  const [demoStatus, setDemoStatus] = useState<CrmDemoStatus>("scheduled");

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextDetail, dashboard] = await Promise.all([
        loadCrmLeadDetail(leadId),
        loadCrmDashboard()
      ]);
      setDetail(nextDetail);
      setSalesUsers(dashboard.salesUsers);
      setStatus(nextDetail.lead.status);
      setAssignedTo(nextDetail.lead.assignedTo ?? "");

      const latestDemo = nextDetail.demos[0];
      if (latestDemo) {
        setDemoDate(latestDemo.date);
        setDemoTime(latestDemo.time);
        setDemoRep(latestDemo.assignedSalesRep);
        setDemoLink(latestDemo.meetingLink ?? "");
        setDemoStatus(latestDemo.status);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Lead detail could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (isLoading || !detail) {
    return (
      <Card>
        <CardTitle>Loading lead detail</CardTitle>
        <p className="mt-3 text-sm leading-6 text-text/72">Collecting profile, activity and pipeline context.</p>
      </Card>
    );
  }

  const { lead, activities, notes, demos, audit } = detail;

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>{lead.companyName}</CardTitle>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Lead owner" value={lead.name} />
          <Metric label="Email" value={lead.email} />
          <Metric label="Status" value={labelize(lead.status)} />
          <Metric label="Score" value={String(lead.score)} />
          <Metric label="Source" value={labelize(lead.source)} />
          <Metric label="Assigned" value={salesUsers.find((user) => user.userId === lead.assignedTo)?.name ?? "Unassigned"} />
          <Metric label="Tenant" value={lead.tenantId ?? "-"} />
          <Metric label="Converted at" value={formatDate(lead.conversionDate ?? undefined)} />
        </div>
      </Card>

      <Card>
        <CardTitle>Lead actions</CardTitle>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select value={status} className={selectClassName} onChange={(event) => setStatus(event.target.value as CrmLeadStatus)}>
            {crmLeadStatuses.map((item) => (
              <option key={item} value={item}>{labelize(item)}</option>
            ))}
          </select>

          <select value={assignedTo} className={selectClassName} onChange={(event) => setAssignedTo(event.target.value)}>
            <option value="">Unassigned</option>
            {salesUsers.map((item) => (
              <option key={item.userId} value={item.userId}>{item.name}</option>
            ))}
          </select>

          <Button
            variant="outline"
            onClick={async () => {
              await patchCrmLead(leadId, {
                status,
                assignedTo: assignedTo || null
              });
              setMessage("Lead status and assignment updated.");
              await refresh();
            }}
          >
            Update stage
          </Button>

          <Button
            onClick={async () => {
              await patchCrmLead(leadId, { status: "converted" });
              setMessage("Lead marked as converted.");
              await refresh();
            }}
          >
            Mark converted
          </Button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
          <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add sales note" />
          <Button
            variant="outline"
            disabled={!note.trim()}
            onClick={async () => {
              await addCrmLeadNote(leadId, note, assignedTo || "sales-user");
              setNote("");
              setMessage("Note saved.");
              await refresh();
            }}
          >
            Add note
          </Button>
        </div>

        {message ? <p className="mt-4 text-sm text-brand">{message}</p> : null}
      </Card>

      <Card>
        <CardTitle>Demo scheduling</CardTitle>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input value={demoDate} onChange={(event) => setDemoDate(event.target.value)} placeholder="YYYY-MM-DD" />
          <Input value={demoTime} onChange={(event) => setDemoTime(event.target.value)} placeholder="HH:mm" />
          <select value={demoRep} className={selectClassName} onChange={(event) => setDemoRep(event.target.value)}>
            <option value="">Assign sales rep</option>
            {salesUsers.map((item) => (
              <option key={item.userId} value={item.userId}>{item.name}</option>
            ))}
          </select>
          <select
            value={demoStatus}
            className={selectClassName}
            onChange={(event) => setDemoStatus(event.target.value as CrmDemoStatus)}
          >
            {crmDemoStatuses.map((item) => (
              <option key={item} value={item}>{labelize(item)}</option>
            ))}
          </select>
          <Input value={demoLink} onChange={(event) => setDemoLink(event.target.value)} placeholder="Meeting link" />
        </div>
        <div className="mt-4">
          <Button
            variant="outline"
            disabled={!demoDate || !demoTime || !demoRep}
            onClick={async () => {
              await scheduleCrmLeadDemo(leadId, {
                date: demoDate,
                time: demoTime,
                assignedSalesRep: demoRep,
                meetingLink: demoLink || undefined,
                status: demoStatus,
                createdBy: assignedTo || "sales-user"
              });
              setMessage("Demo schedule saved.");
              await refresh();
            }}
          >
            Save demo schedule
          </Button>
        </div>
        <div className="mt-5 space-y-3">
          {demos.map((item) => (
            <div key={item.demoId} className="rounded-[20px] border border-line bg-muted/30 px-4 py-4">
              <p className="font-semibold text-text">{item.date} {item.time}</p>
              <p className="mt-1 text-sm text-text/72">Status: {labelize(item.status)}</p>
              <p className="mt-1 text-sm text-text/72">Assigned rep: {salesUsers.find((user) => user.userId === item.assignedSalesRep)?.name ?? item.assignedSalesRep}</p>
              <p className="mt-1 text-sm text-text/72">{item.meetingLink ?? "No link"}</p>
            </div>
          ))}
          {demos.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-line px-4 py-4 text-sm text-text/70">
              No demo scheduled yet.
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardTitle>Activity history</CardTitle>
        <div className="mt-5 space-y-3">
          {activities.map((activity) => (
            <div key={activity.activityId} className="rounded-[20px] border border-line bg-muted/30 px-4 py-4">
              <p className="font-semibold text-text">{activity.title}</p>
              <p className="mt-1 text-sm text-text/72">{labelize(activity.type)} - {formatDate(activity.createdAt)}</p>
              {activity.detail ? <p className="mt-2 text-sm leading-6 text-text/72">{activity.detail}</p> : null}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Notes</CardTitle>
        <div className="mt-5 space-y-3">
          {notes.map((item) => (
            <div key={item.noteId} className="rounded-[20px] border border-line bg-muted/30 px-4 py-4">
              <p className="text-sm leading-6 text-text/72">{item.note}</p>
              <p className="mt-2 text-xs text-text/55">{item.createdBy} - {formatDate(item.createdAt)}</p>
            </div>
          ))}
          {notes.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-line px-4 py-4 text-sm text-text/70">
              No notes yet.
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardTitle>Audit trail</CardTitle>
        <div className="mt-5 space-y-3">
          {audit.map((item) => (
            <div key={item.logId} className="rounded-[20px] border border-line bg-muted/30 px-4 py-4">
              <p className="font-semibold text-text">{item.action}</p>
              <p className="mt-1 text-xs text-text/55">{item.actor} - {formatDate(item.createdAt)}</p>
            </div>
          ))}
          {audit.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-line px-4 py-4 text-sm text-text/70">
              No audit entries yet.
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
      <p className="mt-2 text-sm font-semibold text-text">{value}</p>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
