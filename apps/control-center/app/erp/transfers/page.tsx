import type { Route } from "next";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { getWarehouseTransfers, toUiError } from "@/lib/api";
import type { WarehouseTransferStatus } from "@/types";

interface PageProps {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    tenantId?: string;
  }>;
}

const validStatuses: Array<WarehouseTransferStatus | "all"> = [
  "all",
  "draft",
  "in_transit",
  "completed",
  "canceled"
];

function statusBadge(status: WarehouseTransferStatus): string {
  if (status === "completed") {
    return "bg-success/10 text-success";
  }
  if (status === "in_transit") {
    return "bg-info/10 text-info";
  }
  if (status === "canceled") {
    return "bg-danger/10 text-danger";
  }
  return "bg-warning/10 text-warning";
}

export default async function ErpTransfersPage({ searchParams }: PageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const query = resolvedParams.q ?? "";
  const tenantId = resolvedParams.tenantId ?? "";

  const statusCandidate = resolvedParams.status ?? "all";
  const status = validStatuses.includes(statusCandidate as WarehouseTransferStatus | "all")
    ? (statusCandidate as WarehouseTransferStatus | "all")
    : "all";

  try {
    const source = await getWarehouseTransfers({
      query,
      status,
      tenantId: tenantId.length > 0 ? tenantId : undefined
    });
    const rows = source.items;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">ERP · Transfers</h2>
            <p className="text-sm text-gray-600">Warehouse transfer operations from canonical .NET backend</p>
          </div>
          <Link
            href={("/erp/transfers/new" as Route)}
            className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-semibold text-white"
          >
            New Transfer
          </Link>
        </div>

        <form className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-[1fr_220px_260px_auto]">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search transfer id, tenant or warehouse"
            className="h-10 rounded-md border border-line px-3"
          />
          <select name="status" defaultValue={status} className="h-10 rounded-md border border-line px-3">
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="in_transit">In transit</option>
            <option value="completed">Completed</option>
            <option value="canceled">Canceled</option>
          </select>
          <input
            type="text"
            name="tenantId"
            defaultValue={tenantId}
            placeholder="Tenant ID (optional)"
            className="h-10 rounded-md border border-line px-3"
          />
          <button type="submit" className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white">
            Apply
          </button>
        </form>

        <DataTable
          headers={[
            "Transfer",
            "From",
            "To",
            "Status",
            "Created At",
            "Completed At",
            "Line Count"
          ]}
        >
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-600">
                No transfer found for current filters.
              </td>
            </tr>
          ) : (
            rows.map((transfer) => (
              <tr key={transfer.transferId}>
                <td className="px-4 py-3">
                  <p className="font-medium text-brand">
                    <Link href={(`/erp/transfers/${transfer.transferId}` as Route)}>
                      {transfer.transferId}
                    </Link>
                  </p>
                  <p className="text-xs text-gray-500">{transfer.tenantName}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{transfer.fromWarehouseName}</p>
                  <p className="text-xs text-gray-500">{transfer.fromWarehouseId}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{transfer.toWarehouseName}</p>
                  <p className="text-xs text-gray-500">{transfer.toWarehouseId}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(transfer.status)}`}>
                    {transfer.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{transfer.createdAt}</td>
                <td className="px-4 py-3 text-gray-600">{transfer.completedAt ?? "-"}</td>
                <td className="px-4 py-3">{transfer.lineCount}</td>
              </tr>
            ))
          )}
        </DataTable>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">ERP · Transfers</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load transfers: {toUiError(error)}
        </div>
      </div>
    );
  }
}
