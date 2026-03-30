import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { getSupplierDetail, toUiError } from "@/lib/api";

interface PageProps {
  params: Promise<{ id: string }>;
}

function purchaseOrderStatusBadge(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "received") {
    return "bg-success/10 text-success";
  }
  if (normalized === "ordered") {
    return "bg-info/10 text-info";
  }
  if (normalized === "canceled") {
    return "bg-danger/10 text-danger";
  }
  return "bg-warning/10 text-warning";
}

export default async function ErpSupplierDetailPage({ params }: PageProps) {
  const resolvedParams = await params;

  try {
    const supplier = await getSupplierDetail(resolvedParams.id);
    if (supplier === null) {
      notFound();
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">ERP · Supplier Detail</h2>
          <p className="text-sm text-gray-600">
            Supplier metadata and related purchase orders from canonical .NET backend
          </p>
        </div>

        <section className="grid gap-4 rounded-lg border border-line bg-surface p-4 md:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Supplier</p>
            <p className="mt-1 font-semibold">{supplier.name}</p>
            <p className="mt-1 font-mono text-xs text-gray-500">{supplier.supplierId}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Tenant</p>
            <p className="mt-1 font-semibold">{supplier.tenantName}</p>
            <p className="mt-1 font-mono text-xs text-gray-500">{supplier.tenantId}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Contact</p>
            <p className="mt-1 text-sm">Phone: {supplier.phone ?? "-"}</p>
            <p className="mt-1 text-sm">Email: {supplier.email ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Metadata</p>
            <p className="mt-1 text-sm">Tax number: {supplier.taxNumber ?? "-"}</p>
            <span
              className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                supplier.isActive ? "bg-success/10 text-success" : "bg-muted text-gray-700"
              }`}
            >
              {supplier.isActive ? "active" : "inactive"}
            </span>
            <p className="mt-2 text-xs text-gray-500">Created at {supplier.createdAt}</p>
          </div>
        </section>

        <DataTable
          headers={[
            "Purchase Order",
            "Warehouse",
            "Status",
            "Created At",
            "Received At",
            "Line Count"
          ]}
        >
          {supplier.relatedPurchaseOrders.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-600">
                No purchase order is linked to this supplier yet.
              </td>
            </tr>
          ) : (
            supplier.relatedPurchaseOrders.map((purchaseOrder) => (
              <tr key={purchaseOrder.purchaseOrderId}>
                <td className="px-4 py-3">
                  <Link
                    href={(`/erp/purchase-orders/${purchaseOrder.purchaseOrderId}` as Route)}
                    className="font-medium text-brand"
                  >
                    {purchaseOrder.purchaseOrderId}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{purchaseOrder.warehouseName}</p>
                  <p className="text-xs text-gray-500">{purchaseOrder.warehouseId}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${purchaseOrderStatusBadge(
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
        <h2 className="text-2xl font-semibold">ERP · Supplier Detail</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load supplier detail: {toUiError(error)}
        </div>
      </div>
    );
  }
}
