import type { Route } from "next";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { getTenants, toUiError } from "@/lib/api";
import type { TenantLifecycleState, TenantStatus } from "@/types";

interface PageProps {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    lifecycle?: string;
  }>;
}

const validStatuses: Array<TenantStatus | "all"> = ["all", "active", "trial", "suspended"];
const validLifecycles: Array<TenantLifecycleState | "all"> = [
  "all",
  "trial_active",
  "trial_expiring",
  "trial_expired",
  "subscription_active",
  "subscription_past_due",
  "subscription_canceled",
  "suspended_blocked"
];

function statusBadge(status: TenantStatus) {
  if (status === "active") {
    return "bg-success/10 text-success";
  }
  if (status === "trial") {
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
      return "Ucretli aktif";
  }
}

export default async function TenantsPage({ searchParams }: PageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const query = resolvedParams.q ?? "";
  const statusCandidate = resolvedParams.status ?? "all";
  const lifecycleCandidate = resolvedParams.lifecycle ?? "all";

  const status = validStatuses.includes(statusCandidate as TenantStatus | "all")
    ? (statusCandidate as TenantStatus | "all")
    : "all";
  const lifecycle = validLifecycles.includes(lifecycleCandidate as TenantLifecycleState | "all")
    ? (lifecycleCandidate as TenantLifecycleState | "all")
    : "all";

  try {
    const source = await getTenants({ query, status });
    const tenants = source.filter((tenant) => (lifecycle === "all" ? true : tenant.lifecycleState === lifecycle));

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Tenants</h2>
          <p className="text-sm text-gray-600">Live tenant visibility from canonical .NET backend</p>
        </div>

        <form className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-[1fr_180px_220px_auto]">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search tenant name"
            className="h-10 rounded-md border border-line px-3"
          />
          <select
            name="status"
            defaultValue={status}
            className="h-10 rounded-md border border-line px-3"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspended</option>
          </select>
          <select
            name="lifecycle"
            defaultValue={lifecycle}
            className="h-10 rounded-md border border-line px-3"
          >
            <option value="all">All lifecycle states</option>
            <option value="trial_active">Deneme aktif</option>
            <option value="trial_expiring">Deneme bitmek uzere</option>
            <option value="trial_expired">Deneme bitti / salt-okunur</option>
            <option value="subscription_active">Abonelik aktif</option>
            <option value="subscription_past_due">Odeme gecikmis</option>
            <option value="subscription_canceled">Abonelik iptal</option>
            <option value="suspended_blocked">Askida / bloklu</option>
          </select>
          <button
            type="submit"
            className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white"
          >
            Apply
          </button>
        </form>

        <DataTable headers={["Name", "Plan", "Status", "Lifecycle", "Devices", "Last activity"]}>
          {tenants.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-600">
                No tenant matches this filter.
              </td>
            </tr>
          ) : (
            tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td className="px-4 py-3 font-medium text-brand">
                  <Link href={("/tenants/" + tenant.id) as Route}>{tenant.name}</Link>
                </td>
                <td className="px-4 py-3 uppercase">{tenant.plan}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(
                      tenant.status
                    )}`}
                  >
                    {tenant.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${lifecycleBadge(
                      tenant.lifecycleState
                    )}`}
                  >
                    {lifecycleLabel(tenant.lifecycleState)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {tenant.devices}
                  <span className="ml-2 text-xs text-gray-500">/ {tenant.deviceLimit}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">{tenant.lastActivity}</td>
              </tr>
            ))
          )}
        </DataTable>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Tenants</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load tenants: {toUiError(error)}
        </div>
      </div>
    );
  }
}
