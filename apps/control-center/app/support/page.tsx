import { DataTable } from "@/components/data-table";
import { getSupportCases, toUiError } from "@/lib/api";

interface PageProps {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    priority?: string;
  }>;
}

function statusBadgeClass(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized.includes("closed") || normalized.includes("resolved")) {
    return "bg-success/10 text-success";
  }
  if (normalized.includes("in_progress") || normalized.includes("in-progress") || normalized.includes("pending")) {
    return "bg-warning/10 text-warning";
  }
  return "bg-info/10 text-info";
}

function priorityBadgeClass(priority: string): string {
  const normalized = priority.trim().toLowerCase();
  if (normalized === "critical" || normalized === "high") {
    return "bg-danger/10 text-danger";
  }
  if (normalized === "medium") {
    return "bg-warning/10 text-warning";
  }
  return "bg-info/10 text-info";
}

export default async function SupportPage({ searchParams }: PageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const query = resolvedParams.q ?? "";
  const selectedStatus = resolvedParams.status ?? "all";
  const selectedPriority = resolvedParams.priority ?? "all";

  try {
    const allCasesSource = await getSupportCases();
    const statusOptions = Array.from(new Set(allCasesSource.items.map((item) => item.status))).sort();
    const priorityOptions = Array.from(new Set(allCasesSource.items.map((item) => item.priority))).sort();

    const filteredSource = await getSupportCases({
      query,
      status: selectedStatus,
      priority: selectedPriority
    });

    const cases = filteredSource.items;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Support Cases</h2>
          <p className="text-sm text-gray-600">Live support visibility from canonical .NET backend</p>
        </div>

        <form className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-[1fr_220px_220px_auto]">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search case id, tenant, subject, summary"
            className="h-10 rounded-md border border-line px-3"
          />
          <select
            name="status"
            defaultValue={selectedStatus}
            className="h-10 rounded-md border border-line px-3"
          >
            <option value="all">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            name="priority"
            defaultValue={selectedPriority}
            className="h-10 rounded-md border border-line px-3"
          >
            <option value="all">All priorities</option>
            {priorityOptions.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white"
          >
            Apply
          </button>
        </form>

        <DataTable
          headers={[
            "Case",
            "Tenant",
            "Priority",
            "Status",
            "Subject",
            "Summary",
            "Assigned",
            "Created",
            "Updated"
          ]}
        >
          {cases.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-6 text-center text-sm text-gray-600">
                No support case found for current filters.
              </td>
            </tr>
          ) : (
            cases.map((item) => (
              <tr key={item.caseId}>
                <td className="px-4 py-3 font-mono text-xs">{item.caseId}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{item.tenantName}</p>
                  <p className="text-xs text-gray-500">{item.tenantId ?? "-"}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${priorityBadgeClass(
                      item.priority
                    )}`}
                  >
                    {item.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(
                      item.status
                    )}`}
                  >
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">{item.subject}</td>
                <td className="max-w-[360px] px-4 py-3 text-sm">{item.summary}</td>
                <td className="px-4 py-3">{item.assignee}</td>
                <td className="px-4 py-3 text-gray-600">{item.createdAt}</td>
                <td className="px-4 py-3 text-gray-600">{item.updatedAt}</td>
              </tr>
            ))
          )}
        </DataTable>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Support Cases</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load support cases: {toUiError(error)}
        </div>
      </div>
    );
  }
}
