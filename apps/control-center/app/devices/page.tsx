import type { Route } from "next";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { getDevices, toUiError } from "@/lib/api";
import type { DeviceStatus } from "@/types";

interface PageProps {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    tenantId?: string;
  }>;
}

const validStatuses: Array<DeviceStatus | "all"> = ["all", "active", "stale", "offline", "blocked"];

function statusBadgeClass(status: DeviceStatus): string {
  if (status === "active") {
    return "bg-success/10 text-success";
  }
  if (status === "stale") {
    return "bg-warning/10 text-warning";
  }
  if (status === "blocked") {
    return "bg-danger/10 text-danger";
  }
  return "bg-muted text-gray-700";
}

export default async function DevicesPage({ searchParams }: PageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const query = resolvedParams.q ?? "";
  const tenantId = resolvedParams.tenantId ?? "";

  const statusCandidate = resolvedParams.status ?? "all";
  const status = validStatuses.includes(statusCandidate as DeviceStatus | "all")
    ? (statusCandidate as DeviceStatus | "all")
    : "all";

  try {
    const source = await getDevices({
      query,
      status,
      tenantId: tenantId.length > 0 ? tenantId : undefined
    });

    const devices = source.items;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Devices</h2>
          <p className="text-sm text-gray-600">Operational device visibility from canonical .NET backend</p>
        </div>

        <form className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-[1fr_220px_260px_auto]">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search device id or tenant"
            className="h-10 rounded-md border border-line px-3"
          />
          <select name="status" defaultValue={status} className="h-10 rounded-md border border-line px-3">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="stale">Stale</option>
            <option value="offline">Offline</option>
            <option value="blocked">Blocked</option>
          </select>
          <input
            type="text"
            name="tenantId"
            defaultValue={tenantId}
            placeholder="Tenant ID"
            className="h-10 rounded-md border border-line px-3"
          />
          <button
            type="submit"
            className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white"
          >
            Apply
          </button>
        </form>

        <DataTable
          headers={[
            "Device ID",
            "Tenant",
            "Branch",
            "Status",
            "Last Seen",
            "Last Sync",
            "App Version",
            "License",
            "Online",
            "Stale"
          ]}
        >
          {devices.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-6 text-center text-sm text-gray-600">
                No device found for current filters.
              </td>
            </tr>
          ) : (
            devices.map((device) => (
              <tr key={device.deviceId} className={device.isStale ? "bg-warning/5" : undefined}>
                <td className="px-4 py-3 font-mono text-xs">{device.deviceId}</td>
                <td className="px-4 py-3 text-brand">
                  <p className="font-medium">
                    <Link href={(`/tenants/${device.tenantId}` as Route)}>{device.tenantName}</Link>
                  </p>
                  <p className="text-xs text-gray-500">{device.tenantId}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{device.branchId ?? "-"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(
                      device.status
                    )}`}
                  >
                    {device.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{device.lastSeenAt ?? "-"}</td>
                <td className="px-4 py-3 text-gray-600">{device.lastSyncAt ?? "-"}</td>
                <td className="px-4 py-3">{device.appVersion ?? "-"}</td>
                <td className="px-4 py-3">{device.licenseStatus}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      device.isOnline ? "bg-success/10 text-success" : "bg-muted text-gray-700"
                    }`}
                  >
                    {device.isOnline ? "yes" : "no"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      device.isStale ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                    }`}
                  >
                    {device.isStale ? "yes" : "no"}
                  </span>
                </td>
              </tr>
            ))
          )}
        </DataTable>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Devices</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load devices: {toUiError(error)}
        </div>
      </div>
    );
  }
}
