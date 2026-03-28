import { notFound } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { getTenantDetail, toUiError } from "@/lib/api";
import type { DataConnectionStatus, TenantLifecycleState } from "@/types";

function connectionBadge(status: DataConnectionStatus) {
  if (status === "connected") {
    return "bg-success/10 text-success";
  }
  if (status === "partial") {
    return "bg-warning/10 text-warning";
  }
  return "bg-danger/10 text-danger";
}

function lifecycleBadge(state: TenantLifecycleState) {
  if (state === "trial_active") {
    return "bg-brand/10 text-brand";
  }
  if (state === "trial_expiring") {
    return "bg-warning/10 text-warning";
  }
  if (state === "subscription_active") {
    return "bg-success/10 text-success";
  }
  if (state === "subscription_past_due") {
    return "bg-warning/10 text-warning";
  }
  return "bg-danger/10 text-danger";
}

function lifecycleLabel(state: TenantLifecycleState) {
  switch (state) {
    case "trial_active":
      return "Deneme aktif";
    case "trial_expiring":
      return "Deneme bitmek uzere";
    case "trial_expired":
      return "Deneme bitti / salt-okunur";
    case "subscription_past_due":
      return "Odeme gecikmis";
    case "subscription_canceled":
      return "Abonelik iptal";
    case "suspended_blocked":
      return "Askida / bloklu";
    default:
      return "Abonelik aktif";
  }
}

function lifecycleMessage(state: TenantLifecycleState) {
  switch (state) {
    case "trial_active":
      return "Operasyon acik. Deneme donemi devam ediyor.";
    case "trial_expiring":
      return "Kesinti olmamasi icin plan secimi yakinda tamamlanmali.";
    case "trial_expired":
      return "Sistem salt-okunur moda gecmis durumda; satis ve aktivasyon kapali.";
    case "subscription_past_due":
      return "Odeme gecikmis durumda. Operasyon acik ancak riskli durum takip edilmelidir.";
    case "subscription_canceled":
      return "Abonelik iptal isaretli. Donem sonuna kadar operasyon acik, yenileme kapali.";
    case "suspended_blocked":
      return "Tenant bloklu. Operasyon aksiyonlari devre disi.";
    default:
      return "Abonelik aktif. Tum operasyon akislari acik.";
  }
}

export default async function TenantDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;

  try {
    const tenant = await getTenantDetail(resolvedParams.id);
    if (tenant === null) {
      notFound();
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">{tenant.name}</h2>
          <p className="text-sm text-gray-600">Tenant detail from canonical .NET backend</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <section className="rounded-lg border border-line bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Plan</p>
            <p className="mt-1 text-lg font-semibold uppercase">{tenant.plan}</p>
            <p className="text-xs text-gray-500">{tenant.subscriptionStatus}</p>
          </section>
          <section className="rounded-lg border border-line bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Status</p>
            <p className="mt-1 text-lg font-semibold">{tenant.status}</p>
            <p className="text-xs text-gray-500">License: {tenant.licenseStatus}</p>
          </section>
          <section className="rounded-lg border border-line bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Lifecycle</p>
            <p className="mt-1">
              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${lifecycleBadge(tenant.lifecycleState)}`}>
                {lifecycleLabel(tenant.lifecycleState)}
              </span>
            </p>
            <p className="mt-2 text-xs text-gray-500">{lifecycleMessage(tenant.lifecycleState)}</p>
          </section>
          <section className="rounded-lg border border-line bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Devices</p>
            <p className="mt-1 text-lg font-semibold">{tenant.devices}</p>
            <p className="text-xs text-gray-500">Limit: {tenant.deviceLimit}</p>
          </section>
        </div>

        <section className="grid gap-4 rounded-lg border border-line bg-surface p-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Tenant code</p>
            <p className="mt-1 font-semibold">{tenant.tenantCode}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Owner</p>
            <p className="mt-1 font-semibold">{tenant.ownerEmail}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Phone</p>
            <p className="mt-1 font-semibold">{tenant.phone}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Reseller code</p>
            <p className="mt-1 font-semibold">{tenant.resellerCode ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Onboarding</p>
            <p className="mt-1 font-semibold">{tenant.onboardingState}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Last activity</p>
            <p className="mt-1 font-semibold">{tenant.lastActivity}</p>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-line bg-surface p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Support cases</h3>
            <span
              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${connectionBadge(
                tenant.supportConnection
              )}`}
            >
              {tenant.supportConnection}
            </span>
          </div>
          {tenant.supportNotes.length === 0 ? (
            <p className="text-sm text-gray-600">No support case found for this tenant or support feed is unavailable.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {tenant.supportNotes.map((note) => (
                <li key={note} className="rounded-md bg-muted p-3">
                  {note}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-gray-500">Summary: {tenant.supportSummary}</p>
        </section>

        <section className="space-y-3 rounded-lg border border-line bg-surface p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Recent activity</h3>
            <span
              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${connectionBadge(
                tenant.auditConnection
              )}`}
            >
              {tenant.auditConnection}
            </span>
          </div>
          <DataTable headers={["Time", "Action", "Actor", "Target"]}>
            {tenant.recentActivity.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-600">
                  Audit preview not connected or no event exists for this tenant.
                </td>
              </tr>
            ) : (
              tenant.recentActivity.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-gray-600">{item.time}</td>
                  <td className="px-4 py-3 font-medium">{item.action}</td>
                  <td className="px-4 py-3">{item.actor}</td>
                  <td className="px-4 py-3">{item.target}</td>
                </tr>
              ))
            )}
          </DataTable>
        </section>

        <section className="rounded-lg border border-line bg-surface p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Sync summary</h3>
            <span
              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${connectionBadge(
                tenant.syncConnection
              )}`}
            >
              {tenant.syncConnection}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-700">{tenant.syncSummary}</p>
        </section>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Tenant detail</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load tenant detail: {toUiError(error)}
        </div>
      </div>
    );
  }
}
