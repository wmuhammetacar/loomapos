"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createResellerSupportRequest,
  loadResellerPortalExperience,
  type ResellerPortalExperience
} from "@/lib/portal-service";

export type ResellerPortalSectionPhase6 =
  | "overview"
  | "customers"
  | "referrals"
  | "commissions"
  | "payouts"
  | "licenses"
  | "assets"
  | "support"
  | "settings";

export function ResellerPortalPanelsPhase6({
  section
}: {
  section: ResellerPortalSectionPhase6;
}) {
  const [snapshot, setSnapshot] = useState<ResellerPortalExperience | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supportForm, setSupportForm] = useState({
    subject: "",
    category: "reseller",
    priority: "normal",
    message: "",
    contactPreference: "email"
  });

  const reload = async () => {
    setBusy(true);
    try {
      const next = await loadResellerPortalExperience();
      setSnapshot(next);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Reseller portal data could not be loaded.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const run = async (fn: () => Promise<unknown>, successText: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
      await reload();
      setMessage(successText);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Reseller action failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!snapshot) {
    return (
      <Card>
        <CardTitle>Reseller portal data is not available</CardTitle>
        <p className="mt-3 text-sm leading-6 text-text/72">
          Sign in with an approved reseller account and reload the page.
        </p>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </Card>
    );
  }

  let sectionContent: ReactNode;

  if (section === "overview") {
    sectionContent = (
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardTitle>Partner announcements</CardTitle>
          <div className="mt-5 space-y-3">
            {snapshot.overview.partnerAnnouncements.map((item) => (
              <div key={item} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="text-sm leading-6 text-text/80">{item}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>Referral tools</CardTitle>
          <div className="mt-5 space-y-3 text-sm text-text/72">
            <p>
              Primary code: <span className="font-semibold text-text">{snapshot.referrals.primaryCode}</span>
            </p>
            <p className="break-all">{snapshot.referrals.primaryLink}</p>
          </div>
        </Card>
      </div>
    );
  } else if (section === "customers") {
    sectionContent = (
      <Card>
        <CardTitle>Referred customers</CardTitle>
        <div className="mt-5 space-y-3">
          {snapshot.customers.map((customer) => (
            <div key={customer.tenantId} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
              <p className="font-semibold text-text">{customer.companyName}</p>
              <p className="mt-1 text-sm text-text/72">
                {customer.plan ?? "-"} - {customer.subscriptionStatus ?? "-"} - {customer.billingPeriod ?? "-"}
              </p>
              <p className="mt-2 text-sm text-text/72">
                Devices: {customer.activeDevices} | Users: {customer.userCount} | Branches: {customer.branchCount}
              </p>
              <p className="mt-2 text-sm text-text/72">
                Revenue {formatCurrency(customer.revenueAmount)} | Commission {formatCurrency(customer.commissionAmount)}
              </p>
            </div>
          ))}
        </div>
      </Card>
    );
  } else if (section === "referrals") {
    sectionContent = (
      <div className="space-y-6">
        <Card>
          <CardTitle>Referral performance</CardTitle>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Metric label="Clicked" value={String(snapshot.referrals.clicked)} />
            <Metric label="Registered" value={String(snapshot.referrals.registered)} />
            <Metric label="Purchased" value={String(snapshot.referrals.purchased)} />
            <Metric label="Active" value={String(snapshot.referrals.active)} />
            <Metric label="Canceled" value={String(snapshot.referrals.canceled)} />
          </div>
        </Card>
        <Card>
          <CardTitle>Attribution history</CardTitle>
          <div className="mt-5 space-y-3">
            {snapshot.referrals.history.map((item) => (
              <div key={item.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="font-semibold text-text">{item.companyName ?? item.code}</p>
                <p className="mt-1 text-sm text-text/72">{item.status}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.24em] text-text/55">{formatDate(item.createdAt)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  } else if (section === "commissions") {
    sectionContent = (
      <Card>
        <CardTitle>Commission events</CardTitle>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-text/55">
                <th className="py-3">Customer</th>
                <th className="py-3">Plan</th>
                <th className="py-3">Amount</th>
                <th className="py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.commissions.map((item) => (
                <tr key={item.id} className="border-b border-line/80">
                  <td className="py-3">{item.companyName ?? item.tenantId}</td>
                  <td className="py-3">{item.planCode ?? "-"}</td>
                  <td className="py-3">{formatCurrency(item.amount)}</td>
                  <td className="py-3 uppercase">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  } else if (section === "payouts") {
    sectionContent = (
      <Card>
        <CardTitle>Payout history</CardTitle>
        <div className="mt-5 space-y-3">
          {snapshot.payouts.map((item) => (
            <div key={item.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
              <p className="font-semibold text-text">{formatCurrency(item.total)}</p>
              <p className="mt-1 text-sm text-text/72">{item.status}</p>
              <p className="mt-2 text-sm text-text/72">
                {formatDate(item.periodStart)} - {formatDate(item.periodEnd)}
              </p>
            </div>
          ))}
        </div>
      </Card>
    );
  } else if (section === "licenses") {
    sectionContent = (
      <Card>
        <CardTitle>License visibility</CardTitle>
        <div className="mt-5 space-y-3">
          {snapshot.licenses.map((item) => (
            <div key={item.tenantId} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
              <p className="font-semibold text-text">{item.companyName}</p>
              <p className="mt-1 text-sm text-text/72">
                {item.planCode ?? "-"} - {item.licenseStatus ?? "-"}
              </p>
              <p className="mt-2 text-sm text-text/72">
                Devices {item.activeDevices}{item.deviceLimit ? ` / ${item.deviceLimit}` : ""}
              </p>
            </div>
          ))}
        </div>
      </Card>
    );
  } else if (section === "assets") {
    sectionContent = (
      <Card>
        <CardTitle>Partner assets</CardTitle>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {snapshot.assets.map((asset) => (
            <div key={asset.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
              <p className="font-semibold text-text">{asset.title}</p>
              <p className="mt-1 text-sm text-text/72">{asset.description}</p>
              <a href={asset.href} className="mt-3 inline-block text-sm font-semibold text-brand">
                Open asset
              </a>
            </div>
          ))}
        </div>
      </Card>
    );
  } else if (section === "support") {
    sectionContent = (
      <div className="space-y-6">
        <Card>
          <CardTitle>Create partner support request</CardTitle>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Input
              value={supportForm.subject}
              onChange={(event) => setSupportForm((current) => ({ ...current, subject: event.target.value }))}
              placeholder="Subject"
            />
            <Input
              value={supportForm.category}
              onChange={(event) => setSupportForm((current) => ({ ...current, category: event.target.value }))}
              placeholder="Category"
            />
          </div>
          <textarea
            className="mt-4 min-h-32 w-full rounded-[24px] border border-line px-4 py-3 text-sm text-text outline-none transition focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
            value={supportForm.message}
            onChange={(event) => setSupportForm((current) => ({ ...current, message: event.target.value }))}
            placeholder="Message"
          />
          <Button
            className="mt-6"
            disabled={busy || !supportForm.subject || !supportForm.message}
            onClick={() => void run(() => createResellerSupportRequest(supportForm), "Partner support request created.")}
          >
            Submit request
          </Button>
        </Card>
        <Card>
          <CardTitle>Support links</CardTitle>
          <div className="mt-5 flex flex-wrap gap-3">
            {snapshot.supportLinks.map((link) => (
              <a
                key={`${link.label}-${link.href}`}
                href={link.href}
                className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-text/80"
              >
                {link.label}
              </a>
            ))}
          </div>
        </Card>
      </div>
    );
  } else {
    sectionContent = (
      <Card>
        <CardTitle>Partner settings</CardTitle>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Metric label="Reseller" value={snapshot.settings.resellerName} />
          <Metric label="Email" value={snapshot.settings.email} />
          <Metric label="Status" value={snapshot.settings.status} />
          <Metric label="Commission" value={`${(snapshot.settings.commissionRate * 100).toFixed(0)}%`} />
          <Metric label="Payout method" value={snapshot.settings.payoutMethod} />
          <Metric label="Company" value={snapshot.settings.companyName ?? "-"} />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Phase 6 Reseller Portal</CardTitle>
        <p className="mt-3 text-sm text-text/72">
          Section: <span className="font-semibold text-text">{section}</span>
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Referral code" value={snapshot.overview.referralCode} />
          <Metric label="Customers" value={String(snapshot.overview.totals.referredCustomers)} />
          <Metric label="Pending commission" value={formatCurrency(snapshot.overview.totals.pendingCommission)} />
          <Metric label="Paid out" value={formatCurrency(snapshot.overview.totals.paidOutCommission)} />
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
      {sectionContent}
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

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatCurrency(value: number, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}
