import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { getDashboardMetrics, toUiError } from "@/lib/api";

export default async function DashboardPage() {
  try {
    const data = await getDashboardMetrics();

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Dashboard</h2>
          <p className="text-sm text-gray-600">Internal operational snapshot (.NET backend)</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-8">
          <StatCard title="Total tenants" value={data.totalTenants} />
          <StatCard title="Paid active" value={data.activeTenants} tone="success" />
          <StatCard title="Trial active" value={data.trialTenants} tone="warning" />
          <StatCard title="Trial expiring" value={data.trialExpiringSoonTenants} tone="warning" />
          <StatCard title="Trial read-only" value={data.trialExpiredReadOnlyTenants} tone="danger" />
          <StatCard title="Suspended" value={data.suspendedBlockedTenants} tone="danger" />
          <StatCard title="Devices online" value={data.devicesOnline} tone="success" />
          <StatCard title="Sync issues" value={data.syncIssues} tone="danger" />
        </div>

        <section>
          <h3 className="mb-3 text-base font-semibold">Recent activity</h3>
          <DataTable headers={["Time", "Action", "Actor", "Target"]}>
            {data.recentActivity.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-600">
                  No recent activity returned from backend.
                </td>
              </tr>
            ) : (
              data.recentActivity.map((item) => (
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
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load dashboard from canonical .NET backend: {toUiError(error)}
        </div>
      </div>
    );
  }
}
