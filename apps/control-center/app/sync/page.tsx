import { DataTable } from "@/components/data-table";
import { getSyncIssues, toUiError } from "@/lib/api";
import type { SyncIssueStatus } from "@/types";

interface PageProps {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    retryable?: string;
  }>;
}

const validStatuses: Array<SyncIssueStatus | "all"> = ["all", "retrying", "failed", "dead_letter"];
const validRetryableFilters = ["all", "true", "false"] as const;
type RetryableFilter = (typeof validRetryableFilters)[number];

function statusBadgeClass(status: SyncIssueStatus): string {
  if (status === "retrying") {
    return "bg-warning/10 text-warning";
  }
  if (status === "dead_letter") {
    return "bg-danger/10 text-danger";
  }
  return "bg-info/10 text-info";
}

export default async function SyncPage({ searchParams }: PageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const query = resolvedParams.q ?? "";

  const statusCandidate = resolvedParams.status ?? "all";
  const status = validStatuses.includes(statusCandidate as SyncIssueStatus | "all")
    ? (statusCandidate as SyncIssueStatus | "all")
    : "all";

  const retryableCandidate = resolvedParams.retryable ?? "all";
  const retryable = validRetryableFilters.includes(retryableCandidate as RetryableFilter)
    ? (retryableCandidate as RetryableFilter)
    : "all";

  try {
    const source = await getSyncIssues({ query, status, retryable });
    const issues = source.items;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Sync Issues</h2>
          <p className="text-sm text-gray-600">Operational sync failures from canonical .NET backend</p>
        </div>

        <form className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-[1fr_220px_180px_auto]">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search tenant, device, event id, reason"
            className="h-10 rounded-md border border-line px-3"
          />
          <select
            name="status"
            defaultValue={status}
            className="h-10 rounded-md border border-line px-3"
          >
            <option value="all">All statuses</option>
            <option value="retrying">Retrying</option>
            <option value="failed">Failed</option>
            <option value="dead_letter">Dead letter</option>
          </select>
          <select
            name="retryable"
            defaultValue={retryable}
            className="h-10 rounded-md border border-line px-3"
          >
            <option value="all">Retryable: all</option>
            <option value="true">Retryable only</option>
            <option value="false">Permanent only</option>
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
            "Tenant",
            "Device",
            "Event",
            "Status",
            "Retry",
            "Reason",
            "Created",
            "Last Attempt",
            "Failure Type"
          ]}
        >
          {issues.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-6 text-center text-sm text-gray-600">
                No sync issue found for current filters.
              </td>
            </tr>
          ) : (
            issues.map((issue) => (
              <tr key={issue.issueId}>
                <td className="px-4 py-3">
                  <p className="font-medium">{issue.tenantName}</p>
                  <p className="text-xs text-gray-500">{issue.tenantId}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{issue.deviceId ?? "-"}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{issue.eventType}</p>
                  <p className="text-xs text-gray-500">{issue.eventId}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(
                      issue.status
                    )}`}
                  >
                    {issue.status}
                  </span>
                </td>
                <td className="px-4 py-3">{issue.retryCount}</td>
                <td className="max-w-[420px] px-4 py-3 text-sm">{issue.reason}</td>
                <td className="px-4 py-3 text-gray-600">{issue.createdAt}</td>
                <td className="px-4 py-3 text-gray-600">{issue.lastAttemptAt ?? "-"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      issue.isRetryable
                        ? "bg-warning/10 text-warning"
                        : "bg-danger/10 text-danger"
                    }`}
                  >
                    {issue.isRetryable ? "retryable" : "permanent"}
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
        <h2 className="text-2xl font-semibold">Sync Issues</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load sync issues: {toUiError(error)}
        </div>
      </div>
    );
  }
}
