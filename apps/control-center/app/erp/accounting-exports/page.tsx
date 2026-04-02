import type { Route } from "next";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { getAccountingExportItems, toUiError } from "@/lib/api";
import type { AccountingExportStatus } from "@/types";

interface PageProps {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    sourceType?: string;
  }>;
}

const validStatuses: Array<AccountingExportStatus | "all"> = ["all", "pending", "exported", "failed"];

function statusBadge(status: AccountingExportStatus): string {
  if (status === "exported") {
    return "bg-success/10 text-success";
  }
  if (status === "failed") {
    return "bg-danger/10 text-danger";
  }
  return "bg-warning/10 text-warning";
}

function shortText(value: string | null, maxLength = 72): string {
  if (!value) {
    return "-";
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

export default async function ErpAccountingExportsPage({ searchParams }: PageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const query = resolvedParams.q ?? "";
  const sourceType = (resolvedParams.sourceType ?? "all").trim();

  const statusCandidate = resolvedParams.status ?? "all";
  const status = validStatuses.includes(statusCandidate as AccountingExportStatus | "all")
    ? (statusCandidate as AccountingExportStatus | "all")
    : "all";

  try {
    const source = await getAccountingExportItems({
      query,
      status,
      sourceType,
      take: 500
    });
    const rows = source.items;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">ERP · Accounting Exports</h2>
          <p className="text-sm text-gray-600">
            Accounting bridge export queue backed by canonical .NET accounting export contracts
          </p>
        </div>

        <form className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-[1fr_180px_240px_auto]">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by source, event code, failure or id"
            className="h-10 rounded-md border border-line px-3"
          />
          <select name="status" defaultValue={status} className="h-10 rounded-md border border-line px-3">
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="exported">Exported</option>
            <option value="failed">Failed</option>
          </select>
          <select
            name="sourceType"
            defaultValue={sourceType}
            className="h-10 rounded-md border border-line px-3"
          >
            <option value="all">All source types</option>
            <option value="sale">sale</option>
            <option value="sale_reversal">sale_reversal</option>
            <option value="cash_movement">cash_movement</option>
            <option value="purchase_receipt">purchase_receipt</option>
            <option value="customer_collection">customer_collection</option>
            <option value="customer_account_adjustment">customer_account_adjustment</option>
          </select>
          <button type="submit" className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white">
            Apply
          </button>
        </form>

        <DataTable
          headers={[
            "Source Type",
            "Source Id",
            "Event Code",
            "Status",
            "Created At",
            "Exported At",
            "Failure",
            "Tenant"
          ]}
        >
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-600">
                No accounting export item found for current filters.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-brand">
                    <Link href={(`/erp/accounting-exports/${row.id}` as Route)}>{row.sourceType}</Link>
                  </p>
                  <p className="mt-1 font-mono text-xs text-gray-500">{row.id}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{row.sourceId}</td>
                <td className="px-4 py-3">{row.eventCode}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(row.status)}`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{row.createdAt}</td>
                <td className="px-4 py-3 text-gray-600">{row.exportedAt ?? "-"}</td>
                <td className="px-4 py-3 text-gray-600">{shortText(row.failureReason)}</td>
                <td className="px-4 py-3 text-gray-600">{row.tenantId ?? "-"}</td>
              </tr>
            ))
          )}
        </DataTable>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">ERP · Accounting Exports</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load accounting export items: {toUiError(error)}
        </div>
      </div>
    );
  }
}
