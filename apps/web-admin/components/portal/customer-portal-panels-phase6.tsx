"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { OnboardingActivationDashboard } from "@/components/portal/onboarding-activation-dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  cancelPortalSubscription,
  changePortalPassword,
  changePortalPlan,
  createPortalSupportRequest,
  deactivatePortalDevice,
  invitePortalUser,
  loadCustomerPortalExperience,
  portalRoleOptions,
  portalSupportCategories,
  reactivatePortalSubscription,
  removePortalUser,
  revokePortalSession,
  renamePortalDevice,
  updatePortalCompanyProfile,
  updatePortalUserRole,
  type CompanyProfileInput,
  type CustomerPortalExperience,
  type PortalNotice,
  type PortalRole
} from "@/lib/portal-service";
import { pricingPlans, type BillingCycle, type PlanCode } from "@/lib/site-content";

export type CustomerPortalSectionPhase6 =
  | "overview"
  | "subscription"
  | "licenses"
  | "downloads"
  | "billing"
  | "devices"
  | "company"
  | "users"
  | "security"
  | "support"
  | "onboarding";

export function CustomerPortalPanelsPhase6({
  section
}: {
  section: CustomerPortalSectionPhase6;
}) {
  const [snapshot, setSnapshot] = useState<CustomerPortalExperience | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftDeviceNames, setDraftDeviceNames] = useState<Record<string, string>>({});
  const [companyForm, setCompanyForm] = useState<CompanyProfileInput>({
    companyName: "",
    billingEmail: "",
    phone: "",
    taxOffice: "",
    taxNumber: "",
    addressLine: "",
    city: "",
    country: "TR",
    locale: "tr-TR"
  });
  const [inviteForm, setInviteForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    roleCode: "support_contact" as PortalRole
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: ""
  });
  const [supportForm, setSupportForm] = useState({
    subject: "",
    category: portalSupportCategories[0] ?? "billing",
    priority: "normal",
    message: "",
    contactPreference: "email"
  });

  const reload = async () => {
    setBusy(true);
    try {
      const next = await loadCustomerPortalExperience();
      setSnapshot(next);
      if (next?.customer) {
        setCompanyForm({
          companyName: next.customer.companyName ?? "",
          billingEmail: next.customer.billingEmail ?? "",
          phone: next.customer.phone ?? "",
          taxOffice: next.customer.taxOffice ?? "",
          taxNumber: next.customer.taxNumber ?? "",
          addressLine: next.customer.addressLine ?? "",
          city: next.customer.city ?? "",
          country: next.customer.country ?? "TR",
          locale: next.customer.locale ?? "tr-TR"
        });
      }
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Portal data could not be loaded.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const notices = useMemo(() => buildNotices(snapshot), [snapshot]);
  const lifecycle = useMemo(() => resolvePortalTrialLifecycle(snapshot), [snapshot]);
  const run = async (fn: () => Promise<unknown>, successText: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
      await reload();
      setMessage(successText);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Portal action failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!snapshot) {
    return (
      <Card>
        <CardTitle>Portal data is not available</CardTitle>
        <p className="mt-3 text-sm leading-6 text-text/70">
          Sign in with a customer portal session and reload the page.
        </p>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </Card>
    );
  }

  const canManageBilling = hasAnyRole(snapshot.roleCode, ["tenant_owner", "billing_admin", "company_admin"]);
  const canManageUsers = hasAnyRole(snapshot.roleCode, ["tenant_owner", "company_admin"]);
  const canManageDevices = hasAnyRole(snapshot.roleCode, ["tenant_owner", "company_admin"]);
  const canUseSupport = snapshot.roleCode.toLowerCase() !== "read_only_portal_user";
  const currentPlan = pricingPlans.find((plan) => plan.code === snapshot.subscription?.planCode);
  let sectionContent: ReactNode;

  if (section === "overview") {
    sectionContent = (
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardTitle>Account health notices</CardTitle>
          <div className="mt-5 space-y-3">
            {notices.map((notice) => (
              <div key={notice.id} className={noticeCardClassName(notice.level)}>
                <p className="font-semibold">{notice.title}</p>
                <p className="mt-1 text-sm leading-6 opacity-80">{notice.description}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>Quick actions</CardTitle>
          <div className="mt-5 rounded-[24px] border border-line bg-muted/30 px-4 py-4">
            <p className="text-sm font-semibold text-text">{lifecycle.message}</p>
            <p className="mt-2 text-xs text-text/70">
              Sonraki adim: <Link href={lifecycle.nextActionHref as never} className="font-semibold text-brand">{lifecycle.nextActionLabel}</Link>
            </p>
            <p className="mt-2 text-[11px] text-text/60">
              Acik: {lifecycle.allowedActions.join(" • ")}
            </p>
            <p className="mt-1 text-[11px] text-text/60">
              Kapali: {lifecycle.blockedActions.join(" • ")}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/portal/subscription" className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white">Aboneligi Yonet / Yukselt</Link>
            <Link href="/portal/licenses" className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-text/80">Licenses</Link>
            <Link href="/portal/devices" className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-text/80">Devices</Link>
            <Link href="/portal/downloads" className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-text/80">Downloads</Link>
            <Link href="/portal/support" className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-text/80">Support</Link>
          </div>
          <p className="mt-5 text-sm leading-6 text-text/72">
            Bu portal sadece abonelik, faturalama, lisans ve cihaz yonetimi icindir. Canli satis/odeme Desktop POS tarafinda calisir; Mobile uygulama operasyon takip ve kontrol icindir.
          </p>
        </Card>
      </div>
    );
  } else if (section === "subscription") {
    sectionContent = (
      <div className="space-y-6">
        <Card>
          <CardTitle>Subscription lifecycle</CardTitle>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Plan" value={snapshot.subscription?.planCode?.toUpperCase() ?? "-"} />
            <Metric label="Status" value={snapshot.subscription?.status ?? "-"} />
            <Metric label="Cycle" value={snapshot.subscription?.billingCycle ?? "-"} />
            <Metric label="Renewal" value={formatDate(snapshot.subscription?.renewalDate ?? snapshot.subscription?.currentPeriodEnd)} />
            <Metric label="Next billing" value={snapshot.usage.nextBillingAmount ? formatCurrency(snapshot.usage.nextBillingAmount) : "-"} />
            <Metric label="Support tier" value={snapshot.usage.supportTier ?? currentPlan?.supportLevel ?? "-"} />
            <Metric label="Pending change" value={snapshot.usage.pendingPlanChange?.targetPlanCode ?? "-"} />
            <Metric label="Lifecycle" value={lifecycle.label} />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={busy || !canManageBilling || snapshot.subscription?.cancelAtPeriodEnd}
              onClick={() => void run(() => cancelPortalSubscription(), "Subscription will cancel at period end.")}
            >
              Cancel at period end
            </Button>
            <Button
              disabled={busy || !canManageBilling}
              onClick={() => void run(() => reactivatePortalSubscription(), "Auto-renew enabled again.")}
            >
              Re-enable auto-renew
            </Button>
          </div>
        </Card>
        <div className="grid gap-4 xl:grid-cols-3">
          {pricingPlans.map((plan) => {
            const currentAmount =
              currentPlan && snapshot.subscription?.billingCycle === "yearly"
                ? currentPlan.yearlyPrice
                : currentPlan?.monthlyPrice ?? 0;
            const targetAmount =
              snapshot.subscription?.billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
            const isCurrent = plan.code === snapshot.subscription?.planCode;
            const isUpgrade = targetAmount > currentAmount;
            return (
              <Card key={plan.code}>
                <CardTitle>{plan.name}</CardTitle>
                <p className="mt-2 text-sm leading-6 text-text/72">{plan.summary}</p>
                <p className="mt-5 text-3xl font-semibold text-text">
                  {formatCurrency(snapshot.subscription?.billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice)}
                </p>
                <Button
                  className="mt-6 w-full"
                  variant={isCurrent ? "outline" : "primary"}
                  disabled={busy || !canManageBilling || isCurrent}
                  onClick={() =>
                    void run(
                      () =>
                        changePortalPlan({
                          planCode: plan.code as PlanCode,
                          billingCycle: (snapshot.subscription?.billingCycle as BillingCycle | undefined) ?? "monthly",
                          immediate: isUpgrade
                        }),
                      isUpgrade ? `${plan.name} applied.` : `${plan.name} scheduled for the next cycle.`
                    )
                  }
                >
                  {isCurrent ? "Current plan" : isUpgrade ? "Upgrade now" : "Schedule change"}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
    );
  } else if (section === "licenses" || section === "downloads" || section === "billing") {
    sectionContent = (
      <Card>
        <CardTitle>
          {section === "licenses"
            ? "Licenses"
            : section === "downloads"
              ? "Downloads"
              : "Billing history"}
        </CardTitle>
        <div className="mt-5 space-y-3">
          {section === "licenses"
            ? snapshot.licenses.map((license) => (
                <div key={license.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                  <p className="font-semibold text-text">{license.planCode.toUpperCase()} · {license.status}</p>
                  <p className="mt-2 font-mono text-sm text-text">{license.licenseKey}</p>
                  <p className="mt-2 text-sm text-text/72">Expiry: {formatDate(license.expiresAt)}</p>
                </div>
              ))
            : section === "downloads"
              ? snapshot.downloads.map((asset) => (
                  <div key={asset.assetId} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                    <p className="font-semibold text-text">{asset.title}</p>
                    <p className="mt-2 text-sm text-text/72">{asset.version} · {asset.platform}</p>
                    <a href={asset.downloadUrl} className="mt-3 inline-block text-sm font-semibold text-brand">Download</a>
                  </div>
                ))
              : snapshot.billing.map((item) => (
                  <div key={item.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                    <p className="font-semibold text-text">{item.invoiceNo}</p>
                    <p className="mt-2 text-sm text-text/72">{item.description}</p>
                    <p className="mt-2 text-sm text-text/72">{formatCurrency(item.amount, item.currency)} · {item.status}</p>
                  </div>
                ))}
        </div>
      </Card>
    );
  } else if (section === "devices") {
    sectionContent = (
      <div className="grid gap-4">
        {snapshot.devices.map((device) => (
          <Card key={device.id}>
            <CardTitle>{device.deviceName}</CardTitle>
            <p className="mt-2 text-sm text-text/72">{device.platform} · {device.appVersion ?? "n/a"}</p>
            <div className="mt-5 flex flex-col gap-3 md:flex-row">
              <Input
                value={draftDeviceNames[device.id] ?? device.deviceName}
                onChange={(event) =>
                  setDraftDeviceNames((current) => ({ ...current, [device.id]: event.target.value }))
                }
              />
              <Button
                variant="outline"
                disabled={!canManageDevices || busy}
                onClick={() =>
                  void run(
                    () => renamePortalDevice(device.id, draftDeviceNames[device.id] ?? device.deviceName),
                    "Device name updated."
                  )
                }
              >
                Rename
              </Button>
              <Button
                variant="danger"
                disabled={!canManageDevices || busy || Boolean(device.revokedAt)}
                onClick={() => void run(() => deactivatePortalDevice(device.id), "Device deactivated.")}
              >
                Deactivate
              </Button>
            </div>
          </Card>
        ))}
      </div>
    );
  } else if (section === "company") {
    sectionContent = (
      <Card>
        <CardTitle>Company and billing profile</CardTitle>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Input value={companyForm.companyName} onChange={(event) => setCompanyForm((current) => ({ ...current, companyName: event.target.value }))} placeholder="Company name" />
          <Input value={companyForm.billingEmail} onChange={(event) => setCompanyForm((current) => ({ ...current, billingEmail: event.target.value }))} placeholder="Billing email" />
          <Input value={companyForm.phone ?? ""} onChange={(event) => setCompanyForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone" />
          <Input value={companyForm.taxOffice ?? ""} onChange={(event) => setCompanyForm((current) => ({ ...current, taxOffice: event.target.value }))} placeholder="Tax office" />
          <Input value={companyForm.taxNumber ?? ""} onChange={(event) => setCompanyForm((current) => ({ ...current, taxNumber: event.target.value }))} placeholder="Tax number" />
          <Input value={companyForm.city ?? ""} onChange={(event) => setCompanyForm((current) => ({ ...current, city: event.target.value }))} placeholder="City" />
        </div>
        <Button
          className="mt-6"
          disabled={busy || !canManageBilling}
          onClick={() => void run(() => updatePortalCompanyProfile(companyForm), "Company profile updated.")}
        >
          Save company profile
        </Button>
      </Card>
    );
  } else if (section === "users") {
    sectionContent = (
      <div className="space-y-6">
        <Card>
          <CardTitle>Portal users</CardTitle>
          <div className="mt-5 space-y-3">
            {snapshot.users.map((user) => (
              <div key={user.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="font-semibold text-text">{user.fullName}</p>
                <p className="mt-1 text-sm text-text/72">{user.email} · {user.roleCode}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <select
                    className="h-11 rounded-full border border-line px-4 text-sm"
                    defaultValue={user.roleCode}
                    disabled={!canManageUsers || busy || user.isOwner}
                    onChange={(event) => void run(() => updatePortalUserRole(user.id, event.target.value), "User role updated.")}
                  >
                    {portalRoleOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canManageUsers || busy || user.isOwner}
                    onClick={() => void run(() => removePortalUser(user.id), "Portal access revoked.")}
                  >
                    Revoke access
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>Invite portal user</CardTitle>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Input value={inviteForm.fullName} onChange={(event) => setInviteForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Full name" />
            <Input value={inviteForm.email} onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" />
            <Input value={inviteForm.phone} onChange={(event) => setInviteForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone" />
            <select
              className="h-12 w-full rounded-full border border-line px-4 text-sm text-text"
              value={inviteForm.roleCode}
              onChange={(event) => setInviteForm((current) => ({ ...current, roleCode: event.target.value }))}
            >
              {portalRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <Button
            className="mt-6"
            disabled={busy || !canManageUsers || !inviteForm.fullName || !inviteForm.email}
            onClick={() => void run(() => invitePortalUser(inviteForm), "Portal user invited.")}
          >
            Invite user
          </Button>
        </Card>
      </div>
    );
  } else if (section === "security") {
    sectionContent = (
      <div className="space-y-6">
        <Card>
          <CardTitle>Account security</CardTitle>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Metric label="Portal email" value={snapshot.security.email} />
            <Metric label="Email verification" value={snapshot.security.emailVerifiedAt ? "Verified" : "Pending"} />
            <Metric label="MFA readiness" value={snapshot.security.mfaReady ? "Ready" : "Placeholder"} />
          </div>
        </Card>
        <Card>
          <CardTitle>Active sessions</CardTitle>
          <div className="mt-5 space-y-3">
            {snapshot.security.sessions.map((session) => (
              <div key={session.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="font-semibold text-text">{session.current ? "Current session" : session.roleCode}</p>
                <p className="mt-1 text-sm text-text/72">
                  Created {formatDate(session.createdAt)} - expires {formatDate(session.expiresAt)}
                </p>
                <p className="mt-1 text-sm text-text/72">
                  {session.userAgent ?? "Unknown browser"} / {session.ipAddress ?? "Unknown IP"}
                </p>
                <Button
                  className="mt-4"
                  size="sm"
                  variant="outline"
                  disabled={busy || session.current || Boolean(session.revokedAt)}
                  onClick={() => void run(() => revokePortalSession(session.id), "Session revoked.")}
                >
                  {session.revokedAt ? "Revoked" : "Revoke session"}
                </Button>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>Change password</CardTitle>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} placeholder="Current password" />
            <Input type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} placeholder="New password" />
          </div>
          <Button
            className="mt-6"
            disabled={busy || !passwordForm.currentPassword || !passwordForm.newPassword}
            onClick={() => void run(() => changePortalPassword(passwordForm.currentPassword, passwordForm.newPassword), "Password updated.")}
          >
            Update password
          </Button>
        </Card>
        <Card>
          <CardTitle>Security activity</CardTitle>
          <div className="mt-5 space-y-3">
            {snapshot.security.activity.map((item) => (
              <div key={item.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="font-semibold text-text">{item.action}</p>
                <p className="mt-1 text-sm text-text/72">{item.entity}</p>
                <p className="mt-2 text-sm leading-6 text-text/72">{item.detail}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.24em] text-text/55">{formatDate(item.createdAt)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  } else if (section === "support") {
    sectionContent = (
      <div className="space-y-6">
        <Card>
          <CardTitle>Create support request</CardTitle>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Input value={supportForm.subject} onChange={(event) => setSupportForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Subject" />
            <select
              className="h-12 w-full rounded-full border border-line px-4 text-sm text-text"
              value={supportForm.category}
              onChange={(event) => setSupportForm((current) => ({ ...current, category: event.target.value }))}
            >
              {portalSupportCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <textarea
            className="mt-4 min-h-32 w-full rounded-[24px] border border-line px-4 py-3 text-sm text-text outline-none transition focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
            value={supportForm.message}
            onChange={(event) => setSupportForm((current) => ({ ...current, message: event.target.value }))}
            placeholder="Message"
          />
          <Button
            className="mt-6"
            disabled={busy || !canUseSupport || !supportForm.subject || !supportForm.message}
            onClick={() => void run(() => createPortalSupportRequest(supportForm), "Support request created.")}
          >
            Submit request
          </Button>
        </Card>
        <Card>
          <CardTitle>Recent support requests</CardTitle>
          <div className="mt-5 space-y-3">
            {snapshot.supportRequests.map((request) => (
              <div key={request.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="font-semibold text-text">{request.subject}</p>
                <p className="mt-1 text-sm text-text/72">
                  {request.category} - {request.priority} - {request.status}
                </p>
                <p className="mt-2 text-sm leading-6 text-text/72">{request.message}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.24em] text-text/55">{formatDate(request.createdAt)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  } else if (section === "onboarding") {
    sectionContent = <OnboardingActivationDashboard snapshot={snapshot} />;
  } else {
    sectionContent = (
      <Card>
        <CardTitle>Section not found</CardTitle>
        <p className="mt-3 text-sm leading-6 text-text/72">
          This portal section is not available for the current role.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Phase 6 Customer Portal</CardTitle>
        <p className="mt-3 text-sm text-text/72">
          Section: <span className="font-semibold text-text">{section}</span>
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Plan" value={snapshot.subscription?.planCode?.toUpperCase() ?? "-"} />
          <Metric label="Renewal" value={formatDate(snapshot.subscription?.renewalDate ?? snapshot.overview?.renewalDate)} />
          <Metric label="License" value={snapshot.license?.status ?? "-"} />
          <Metric label="Devices" value={`${snapshot.usage.usage.devices}${snapshot.usage.limits.devices ? ` / ${snapshot.usage.limits.devices}` : ""}`} />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/portal/subscription" className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white">Subscription</Link>
          <Link href="/portal/billing" className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-text/80">Billing</Link>
          <Link href="/portal/licenses" className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-text/80">Licenses</Link>
          <Link href="/portal/devices" className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-text/80">Devices</Link>
          <Link href="/portal/support" className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-text/80">Support</Link>
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

function hasAnyRole(roleCode: string | null | undefined, allowed: string[]) {
  if (!roleCode) {
    return false;
  }

  return allowed.includes(roleCode);
}

type PortalLifecycleState =
  | "trial_active"
  | "trial_expiring"
  | "trial_expired"
  | "subscription_active"
  | "subscription_past_due"
  | "subscription_canceled"
  | "suspended_blocked";

interface PortalLifecycleDescriptor {
  state: PortalLifecycleState;
  label: string;
  message: string;
  nextActionLabel: string;
  nextActionHref: string;
  allowedActions: string[];
  blockedActions: string[];
}

function resolvePortalTrialLifecycle(snapshot: CustomerPortalExperience | null): PortalLifecycleDescriptor {
  if (snapshot === null) {
    return {
      state: "subscription_active",
      label: "Abonelik aktif",
      message: "Abonelik durumu yukleniyor.",
      nextActionLabel: "Abonelik yonet",
      nextActionHref: "/portal/subscription",
      allowedActions: ["Desktop satis", "Mobil operasyon", "Cihaz aktivasyonu", "Senkron yazma"],
      blockedActions: ["-"]
    };
  }

  const backendLifecycle = (snapshot.promo.lifecycleState ?? "").toLowerCase();
  const backendAllowed = snapshot.promo.allowedActions?.length ? snapshot.promo.allowedActions : undefined;
  const backendBlocked = snapshot.promo.blockedActions?.length ? snapshot.promo.blockedActions : undefined;

  const describe = (
    state: PortalLifecycleState,
    fallbackLabel: string,
    fallbackMessage: string,
    nextActionLabel: string,
    nextActionHref: string,
    allowed: string[],
    blocked: string[]
  ): PortalLifecycleDescriptor => ({
    state,
    label: snapshot.promo.lifecycleLabel ?? fallbackLabel,
    message: snapshot.promo.lifecycleMessage ?? fallbackMessage,
    nextActionLabel,
    nextActionHref,
    allowedActions: backendAllowed ?? allowed,
    blockedActions: backendBlocked ?? blocked
  });

  if (backendLifecycle === "trial_active") {
    return describe(
      "trial_active",
      "Deneme aktif",
      "Deneme aktif. Operasyon yazma islemleri acik. Deneme sonunda yukseltme yapilmazsa sistem salt-okunur moda gecer.",
      "Abonelik planlarini gor",
      "/portal/subscription",
      ["Desktop satis", "Mobil operasyon", "Cihaz aktivasyonu", "Senkron yazma"],
      ["-"]
    );
  }

  if (backendLifecycle === "trial_expiring" || backendLifecycle === "trial_expiring_soon") {
    return describe(
      "trial_expiring",
      "Deneme bitmek uzere",
      "Deneme bitmek uzere. Sure dolunca sistem salt-okunur moda gecer ve yazma akisleri kapanir.",
      "Simdi yukselt",
      "/portal/subscription",
      ["Desktop satis", "Mobil operasyon", "Cihaz aktivasyonu", "Senkron yazma"],
      ["-"]
    );
  }

  if (backendLifecycle === "trial_expired" || backendLifecycle === "trial_expired_read_only") {
    return describe(
      "trial_expired",
      "Deneme bitti (salt-okunur)",
      "Deneme suresi doldu. Goruntuleme acik, operasyon yazma akisleri kapali.",
      "Yukselt ve yazmayi ac",
      "/portal/subscription",
      ["Rapor ve verileri goruntuleme"],
      ["Desktop satis", "Stok mutasyonu", "Sync push", "Yeni cihaz aktivasyonu"]
    );
  }

  if (backendLifecycle === "subscription_past_due" || backendLifecycle === "past_due") {
    return describe(
      "subscription_past_due",
      "Odeme gecikmis",
      "Abonelik odemesi gecikmis. Operasyon kisitlanmadan once odeme guncellenmelidir.",
      "Odeme durumunu guncelle",
      "/portal/billing",
      ["Desktop satis", "Mobil operasyon", "Senkron yazma"],
      ["Yeni cihaz aktivasyonu"]
    );
  }

  if (backendLifecycle === "subscription_canceled" || backendLifecycle === "canceled" || backendLifecycle === "cancelled") {
    return describe(
      "subscription_canceled",
      "Abonelik iptal",
      "Abonelik iptal durumunda. Donem sonunda operasyon yazma akisleri kapanabilir.",
      "Yenilemeyi tekrar ac",
      "/portal/subscription",
      ["Desktop satis", "Mobil operasyon", "Senkron yazma"],
      ["Yeni cihaz aktivasyonu"]
    );
  }

  if (backendLifecycle === "suspended_blocked" || backendLifecycle === "suspended" || backendLifecycle === "blocked") {
    return describe(
      "suspended_blocked",
      "Askida / bloklu",
      "Hesap bloklu oldugu icin operasyon yazma akisleri kapali.",
      "Abonelik/Lisans durumunu kontrol et",
      "/portal/subscription",
      ["Rapor ve verileri goruntuleme"],
      ["Desktop satis", "Stok mutasyonu", "Sync push", "Cihaz aktivasyonu"]
    );
  }

  return describe(
    "subscription_active",
    "Abonelik aktif",
    "Abonelik aktif. Tum izinli operasyon akislari acik.",
    "Abonelik yonet",
    "/portal/subscription",
    ["Desktop satis", "Mobil operasyon", "Cihaz aktivasyonu", "Senkron yazma"],
    ["-"]
  );
}

function buildNotices(snapshot: CustomerPortalExperience | null): PortalNotice[] {
  if (!snapshot) {
    return [];
  }

  const notices = [...snapshot.notices];
  const renewalDate = snapshot.subscription?.renewalDate ?? snapshot.overview?.renewalDate ?? null;
  const lifecycle = resolvePortalTrialLifecycle(snapshot);

  notices.push({
    id: "trial-lifecycle",
    level:
      lifecycle.state === "suspended_blocked" || lifecycle.state === "trial_expired"
        ? "danger"
        : lifecycle.state === "trial_expiring" || lifecycle.state === "subscription_past_due" || lifecycle.state === "subscription_canceled"
          ? "warning"
          : lifecycle.state === "trial_active"
            ? "info"
            : "success",
    title: lifecycle.label,
    description: lifecycle.message,
    href: lifecycle.nextActionHref
  });

  if (snapshot.subscription?.cancelAtPeriodEnd) {
    notices.push({
      id: "cancel-at-period-end",
      level: "warning",
      title: "Abonelik donem sonunda kapanacak",
      description: renewalDate
        ? `Otomatik yenileme kapali. Hizmet ${formatDate(renewalDate)} tarihine kadar aktif kalir.`
        : "Mevcut abonelikte otomatik yenileme kapali.",
      href: "/portal/subscription"
    });
  }

  if (snapshot.usage.overLimit.devices) {
    notices.push({
      id: "device-limit",
      level: "danger",
      title: "Cihaz limiti doldu",
      description: "Yeni cihaz aktivasyonu veya dusuk plana gecis oncesinde kullanilmayan cihazlari devre disi birakin.",
      href: "/portal/devices"
    });
  }

  if (notices.length === 0) {
    notices.push({
      id: "healthy",
      level: "success",
      title: "Hesap durumu saglikli",
      description: "Abonelik, lisans ve cihaz kullanimi mevcut limitler icinde."
    });
  }

  return notices;
}

function noticeCardClassName(level: PortalNotice["level"]) {
  switch (level) {
    case "danger":
      return "rounded-[24px] border border-danger/30 bg-danger/10 px-4 py-4 text-danger";
    case "warning":
      return "rounded-[24px] border border-amber-300/60 bg-amber-50 px-4 py-4 text-amber-900";
    case "success":
      return "rounded-[24px] border border-success/30 bg-success/10 px-4 py-4 text-success";
    default:
      return "rounded-[24px] border border-brand/20 bg-brand/5 px-4 py-4 text-text";
  }
}
