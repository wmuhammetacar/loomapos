import type { Route } from "next";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { getWarehouses, toUiError } from "@/lib/api";

interface PageProps {
  searchParams?: Promise<{
    q?: string;
    type?: string;
    active?: string;
    tenantId?: string;
  }>;
}

const validTypes = ["all", "main", "branch", "virtual"] as const;
const validActiveValues = ["all", "true", "false"] as const;

export default async function ErpWarehousesPage({ searchParams }: PageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const query = resolvedParams.q ?? "";
  const tenantId = resolvedParams.tenantId ?? "";

  const typeCandidate = resolvedParams.type ?? "all";
  const type = validTypes.includes(typeCandidate as (typeof validTypes)[number])
    ? (typeCandidate as (typeof validTypes)[number])
    : "all";

  const activeCandidate = resolvedParams.active ?? "all";
  const active = validActiveValues.includes(activeCandidate as (typeof validActiveValues)[number])
    ? (activeCandidate as (typeof validActiveValues)[number])
    : "all";

  try {
    const source = await getWarehouses({
      query,
      type,
      isActive: active,
      tenantId: tenantId.length > 0 ? tenantId : undefined
    });
    const rows = source.items;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">ERP · Warehouses</h2>
          <p className="text-sm text-gray-600">
            Real warehouse list and stock aggregates from canonical .NET backend
          </p>
        </div>

        <form className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-[1fr_160px_180px_240px_auto]">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search warehouse or tenant"
            className="h-10 rounded-md border border-line px-3"
          />
          <select name="type" defaultValue={type} className="h-10 rounded-md border border-line px-3">
            <option value="all">All types</option>
            <option value="main">Main</option>
            <option value="branch">Branch</option>
            <option value="virtual">Virtual</option>
          </select>
          <select name="active" defaultValue={active} className="h-10 rounded-md border border-line px-3">
            <option value="all">All activity</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
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
            "Warehouse",
            "Type",
            "Tenant",
            "Active",
            "Product Count",
            "Total Stock Qty",
            "Created"
          ]}
        >
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-600">
                No warehouse found for current filters.
              </td>
            </tr>
          ) : (
            rows.map((warehouse) => (
              <tr key={warehouse.warehouseId}>
                <td className="px-4 py-3 font-medium text-brand">
                  <Link href={(`/erp/warehouses/${warehouse.warehouseId}` as Route)}>{warehouse.name}</Link>
                  <p className="mt-1 font-mono text-xs text-gray-500">{warehouse.warehouseId}</p>
                </td>
                <td className="px-4 py-3 uppercase">{warehouse.type}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{warehouse.tenantName}</p>
                  <p className="text-xs text-gray-500">{warehouse.tenantId}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      warehouse.isActive ? "bg-success/10 text-success" : "bg-muted text-gray-700"
                    }`}
                  >
                    {warehouse.isActive ? "active" : "inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">{warehouse.productCount}</td>
                <td className="px-4 py-3">{warehouse.totalStockQuantity}</td>
                <td className="px-4 py-3 text-gray-600">{warehouse.createdAt}</td>
              </tr>
            ))
          )}
        </DataTable>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">ERP · Warehouses</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load warehouses: {toUiError(error)}
        </div>
      </div>
    );
  }
}
