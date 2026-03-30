import type { Route } from "next";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { getPurchaseOrders, toUiError } from "@/lib/api";
import type { PurchaseOrderStatus } from "@/types";

interface PageProps {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    tenantId?: string;
  }>;
}

const validStatuses: Array<PurchaseOrderStatus | "all"> = [
  "all",
  "draft",
  "ordered",
  "received",
  "canceled"
];

function statusBadge(status: PurchaseOrderStatus): string {
  if (status === "received") {
    return "bg-success/10 text-success";
  }
  if (status === "ordered") {
    return "bg-info/10 text-info";
  }
  if (status === "canceled") {
    return "bg-danger/10 text-danger";
  }
  return "bg-warning/10 text-warning";
}

export default async function ErpPurchaseOrdersPage({ searchParams }: PageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const query = resolvedParams.q ?? "";
  const tenantId = resolvedParams.tenantId ?? "";

  const statusCandidate = resolvedParams.status ?? "all";
  const status = validStatuses.includes(statusCandidate as PurchaseOrderStatus | "all")
    ? (statusCandidate as PurchaseOrderStatus | "all")
    : "all";

  try {
    const source = await getPurchaseOrders({
      query,
      status,
      tenantId: tenantId.length > 0 ? tenantId : undefined
    });
    const rows = source.items;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">ERP · Purchase Orders</h2>
            <p className="text-sm text-gray-600">Real purchase order visibility from canonical .NET backend</p>
          </div>
          <Link
            href={("/erp/purchase-orders/new" as Route)}
            className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-semibold text-white"
          >
            New Purchase Order
          </Link>
        </div>

        <form className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-[1fr_220px_260px_auto]">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search order id, supplier or warehouse"
            className="h-10 rounded-md border border-line px-3"
          />
          <select name="status" defaultValue={status} className="h-10 rounded-md border border-line px-3">
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="ordered">Ordered</option>
            <option value="received">Received</option>
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
            "Purchase Order",
            "Supplier",
            "Warehouse",
            "Status",
            "Created At",
            "Received At",
            "Line Count"
          ]}
        >
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-600">
                No purchase order found for current filters.
              </td>
            </tr>
          ) : (
            rows.map((purchaseOrder) => (
              <tr key={purchaseOrder.purchaseOrderId}>
                <td className="px-4 py-3">
                  <p className="font-medium text-brand">
                    <Link href={(`/erp/purchase-orders/${purchaseOrder.purchaseOrderId}` as Route)}>
                      {purchaseOrder.purchaseOrderId}
                    </Link>
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{purchaseOrder.tenantName}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{purchaseOrder.supplierName}</p>
                  <p className="text-xs text-gray-500">{purchaseOrder.supplierId}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{purchaseOrder.warehouseName}</p>
                  <p className="text-xs text-gray-500">{purchaseOrder.warehouseId}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(
                      purchaseOrder.status
                    )}`}
                  >
                    {purchaseOrder.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{purchaseOrder.createdAt}</td>
                <td className="px-4 py-3 text-gray-600">{purchaseOrder.receivedAt ?? "-"}</td>
                <td className="px-4 py-3">{purchaseOrder.lineCount}</td>
              </tr>
            ))
          )}
        </DataTable>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">ERP · Purchase Orders</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load purchase orders: {toUiError(error)}
        </div>
      </div>
    );
  }
}
