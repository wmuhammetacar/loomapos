"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addSupportCaseMessage,
  addSupportCaseLink,
  addSupportCaseNote,
  assignSupportCase,
  changeSupportCaseStatus,
  escalateSupportCase,
  loadAdminResellerDetail,
  loadAdminSupportCase,
  loadAdminTenantDetail,
  runAdminAction,
  type AdminResellerSummary,
  type AdminSupportCase,
  type AdminTenantDetail
} from "@/lib/admin-service";

export function AdminTenantDetailPanel({ tenantId }: { tenantId: string }) {
  const [detail, setDetail] = useState<AdminTenantDetail | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadAdminTenantDetail(tenantId).then(setDetail);
  }, [tenantId]);

  if (!detail) {
    return <PlaceholderCard title="Tenant detail" body="Loading tenant diagnostics and intervention context." />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>{detail.companyName}</CardTitle>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Plan" value={detail.planCode} />
          <Metric label="Subscription" value={detail.subscriptionStatus} />
          <Metric label="License" value={detail.licenseStatus} />
          <Metric label="Onboarding" value={detail.onboardingState} />
        </div>
      </Card>

      <Card>
        <CardTitle>Controlled admin actions</CardTitle>
        <Input
          className="mt-5"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason required for sensitive actions"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <ActionButton label="Suspend tenant" path={`/internal/admin/tenants/${tenantId}/suspend`} reason={reason} setMessage={setMessage} />
          <ActionButton label="Unsuspend tenant" path={`/internal/admin/tenants/${tenantId}/unsuspend`} reason={reason} setMessage={setMessage} />
          <ActionButton label="Billing recheck" path={`/internal/admin/tenants/${tenantId}/billing-recheck`} reason={reason} setMessage={setMessage} />
          <ActionButton label="Force flag refresh" path={`/internal/admin/tenants/${tenantId}/refresh-flags`} reason={reason} setMessage={setMessage} />
        </div>
        {message ? <p className="mt-4 text-sm text-brand">{message}</p> : null}
      </Card>

      <Card>
        <CardTitle>Operational context</CardTitle>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <InfoList title="Feature flags" items={detail.featureFlags} />
          <InfoList title="Recent notices" items={detail.recentNotices} />
          <InfoList title="Internal notes" items={detail.notes} />
          <InfoList title="App version adoption" items={detail.appVersions} />
        </div>
      </Card>
    </div>
  );
}

export function AdminResellerDetailPanel({ resellerId }: { resellerId: string }) {
  const [detail, setDetail] = useState<AdminResellerSummary | null>(null);

  useEffect(() => {
    void loadAdminResellerDetail(resellerId).then(setDetail);
  }, [resellerId]);

  if (!detail) {
    return <PlaceholderCard title="Reseller detail" body="Loading reseller performance and exception data." />;
  }

  return (
    <Card>
      <CardTitle>{detail.name}</CardTitle>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Code" value={detail.code} />
        <Metric label="Status" value={detail.status} />
        <Metric label="Customers" value={String(detail.customers)} />
        <Metric label="Conversions" value={String(detail.monthlyConversions)} />
      </div>
      <p className="mt-5 text-sm leading-6 text-text/68">
        Pending commission {formatCurrency(detail.pendingCommission)}. Paid out {formatCurrency(detail.paidOut)}. Suspicion flag: {detail.suspicious ? "watch" : "clear"}.
      </p>
    </Card>
  );
}

export function AdminSupportCaseDetailPanel({ caseId }: { caseId: string }) {
  const [detail, setDetail] = useState<AdminSupportCase | null>(null);
  const [reason, setReason] = useState("");
  const [assigneeEmail, setAssigneeEmail] = useState("");
  const [nextStatus, setNextStatus] = useState("");
  const [caseMessage, setCaseMessage] = useState("");
  const [note, setNote] = useState("");
  const [linkType, setLinkType] = useState("tenant");
  const [linkId, setLinkId] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [escalationLevel, setEscalationLevel] = useState("l2");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadAdminSupportCase(caseId).then(setDetail);
  }, [caseId]);

  if (!detail) {
    return <PlaceholderCard title="Support case detail" body="Loading case timeline and linked context." />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>{detail.title}</CardTitle>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Category" value={detail.category} />
          <Metric label="Priority" value={detail.priority} />
          <Metric label="Status" value={detail.status} />
          <Metric label="Assignee" value={detail.assignee} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Metric label="Source" value={detail.source ?? "-"} />
          <Metric label="Escalation" value={detail.escalationLevel ?? "-"} />
          <Metric label="Created" value={formatDate(detail.createdAt)} />
        </div>
        <p className="mt-5 text-sm leading-6 text-text/68">{detail.summary}</p>
      </Card>

      <Card>
        <CardTitle>Case actions</CardTitle>
        <Input
          className="mt-5"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason required for assignment, status or escalation"
        />
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <Input
            value={assigneeEmail}
            onChange={(event) => setAssigneeEmail(event.target.value)}
            placeholder="Assignee email"
          />
          <Button
            variant="outline"
            disabled={!reason || !assigneeEmail}
            onClick={async () => {
              await assignSupportCase(caseId, assigneeEmail, reason);
              setMessage("Case assigned.");
              setDetail(await loadAdminSupportCase(caseId));
            }}
          >
            Assign
          </Button>
          <Input
            value={nextStatus}
            onChange={(event) => setNextStatus(event.target.value)}
            placeholder="Status (open/pending_internal/resolved/closed)"
          />
          <Button
            variant="outline"
            disabled={!reason || !nextStatus}
            onClick={async () => {
              await changeSupportCaseStatus(caseId, nextStatus, reason);
              setMessage("Status updated.");
              setDetail(await loadAdminSupportCase(caseId));
            }}
          >
            Change status
          </Button>
          <Input
            value={escalationLevel}
            onChange={(event) => setEscalationLevel(event.target.value)}
            placeholder="Escalation level"
          />
          <Button
            variant="outline"
            disabled={!reason || !escalationLevel}
            onClick={async () => {
              await escalateSupportCase(caseId, escalationLevel, reason);
              setMessage("Case escalated.");
              setDetail(await loadAdminSupportCase(caseId));
            }}
          >
            Escalate
          </Button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <Input
            value={caseMessage}
            onChange={(event) => setCaseMessage(event.target.value)}
            placeholder="Case message"
          />
          <Button
            variant="outline"
            disabled={!caseMessage}
            onClick={async () => {
              await addSupportCaseMessage(caseId, caseMessage, false);
              setCaseMessage("");
              setMessage("Customer-facing message sent.");
              setDetail(await loadAdminSupportCase(caseId));
            }}
          >
            Send external message
          </Button>
          <Button
            variant="outline"
            disabled={!caseMessage}
            onClick={async () => {
              await addSupportCaseMessage(caseId, caseMessage, true);
              setCaseMessage("");
              setMessage("Internal message added.");
              setDetail(await loadAdminSupportCase(caseId));
            }}
          >
            Send internal message
          </Button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Internal note" />
          <Button
            variant="outline"
            disabled={!note}
            onClick={async () => {
              await addSupportCaseNote(caseId, note);
              setNote("");
              setMessage("Internal note added.");
              setDetail(await loadAdminSupportCase(caseId));
            }}
          >
            Add note
          </Button>
          <Input value={linkType} onChange={(event) => setLinkType(event.target.value)} placeholder="Link type (tenant/subscription/device)" />
          <Input value={linkId} onChange={(event) => setLinkId(event.target.value)} placeholder="Link id" />
          <Input value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} placeholder="Link label (optional)" />
          <Button
            variant="outline"
            disabled={!reason || !linkType || !linkId}
            onClick={async () => {
              await addSupportCaseLink(caseId, linkType, linkId, reason, linkLabel || undefined);
              setMessage("Linked entity added.");
              setDetail(await loadAdminSupportCase(caseId));
            }}
          >
            Add link
          </Button>
        </div>
        {message ? <p className="mt-4 text-sm text-brand">{message}</p> : null}
      </Card>

      <Card>
        <CardTitle>Timeline</CardTitle>
        <div className="mt-5 space-y-3">
          {detail.timeline.map((item) => (
            <div key={`${item.at}-${item.label}`} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
              <p className="font-semibold text-text">{item.label}</p>
              <p className="mt-1 text-sm text-text/72">{formatDate(item.at)}</p>
              <p className="mt-2 text-sm leading-6 text-text/72">{item.detail}</p>
            </div>
          ))}
        </div>
      </Card>

      {detail.notes && detail.notes.length > 0 ? (
        <Card>
          <CardTitle>Internal notes</CardTitle>
          <div className="mt-5 space-y-3">
            {detail.notes.map((item) => (
              <div key={item.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="text-sm leading-6 text-text/72">{item.note}</p>
                <p className="mt-2 text-xs text-text/60">{formatDate(item.createdAt)}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {detail.links && detail.links.length > 0 ? (
        <Card>
          <CardTitle>Linked entities</CardTitle>
          <div className="mt-5 space-y-3">
            {detail.links.map((item) => (
              <div key={item.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="font-semibold text-text">{item.entityType}: {item.entityId}</p>
                <p className="mt-2 text-sm text-text/72">{item.label ?? "-"}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function ActionButton({
  label,
  path,
  reason,
  setMessage
}: {
  label: string;
  path: string;
  reason: string;
  setMessage: (value: string) => void;
}) {
  return (
    <Button
      variant="outline"
      disabled={!reason}
      onClick={async () => {
        await runAdminAction(path, { reason });
        setMessage(`${label} completed with reason logged.`);
      }}
    >
      {label}
    </Button>
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

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
      <p className="font-semibold text-text">{title}</p>
      <div className="mt-3 space-y-2 text-sm text-text/72">
        {items.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </div>
  );
}

function PlaceholderCard({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <p className="mt-3 text-sm leading-6 text-text/68">{body}</p>
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
