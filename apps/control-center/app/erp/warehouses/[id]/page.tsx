import { notFound } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { getWarehouseDetail, toUiError } from "@/lib/api";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ q?: string }>;
}

export default async function ErpWarehouseDetailPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = resolvedSearchParams.q ?? "";

  try {
    const warehouse = await getWarehouseDetail(resolvedParams.id, { query });
    if (warehouse === null) {
      notFound();
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">ERP · Warehouse Detail</h2>
          <p className="text-sm text-gray-600">Warehouse stock visibility from canonical .NET backend</p>
        </div>

        <section className="grid gap-4 rounded-lg border border-line bg-surface p-4 md:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Warehouse</p>
            <p className="mt-1 font-semibold">{warehouse.name}</p>
            <p className="mt-1 font-mono text-xs text-gray-500">{warehouse.warehouseId}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Tenant</p>
            <p className="mt-1 font-semibold">{warehouse.tenantName}</p>
            <p className="mt-1 font-mono text-xs text-gray-500">{warehouse.tenantId}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Type / Active</p>
            <p className="mt-1 font-semibold uppercase">{warehouse.type}</p>
            <span
              className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                warehouse.isActive ? "bg-success/10 text-success" : "bg-muted text-gray-700"
              }`}
            >
              {warehouse.isActive ? "active" : "inactive"}
            </span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Stock Summary</p>
            <p className="mt-1 font-semibold">
              {warehouse.productCount} products · {warehouse.totalStockQuantity} qty
            </p>
            <p className="mt-1 text-xs text-gray-500">Created at {warehouse.createdAt}</p>
          </div>
        </section>

        <form className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-[1fr_auto]">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search product, sku or barcode"
            className="h-10 rounded-md border border-line px-3"
          />
          <button type="submit" className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white">
            Apply
          </button>
        </form>

        <DataTable headers={["Product", "SKU", "Barcode", "Quantity", "Updated At"]}>
          {warehouse.stockRows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-600">
                No stock row found for this warehouse.
              </td>
            </tr>
          ) : (
            warehouse.stockRows.map((stockRow) => (
              <tr key={stockRow.productId}>
                <td className="px-4 py-3">
                  <p className="font-medium">{stockRow.productName}</p>
                  <p className="text-xs text-gray-500">{stockRow.productId}</p>
                </td>
                <td className="px-4 py-3">{stockRow.sku ?? "-"}</td>
                <td className="px-4 py-3">{stockRow.barcode ?? "-"}</td>
                <td className="px-4 py-3 font-semibold">{stockRow.quantity}</td>
                <td className="px-4 py-3 text-gray-600">{stockRow.updatedAt}</td>
              </tr>
            ))
          )}
        </DataTable>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">ERP · Warehouse Detail</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load warehouse detail: {toUiError(error)}
        </div>
      </div>
    );
  }
}
