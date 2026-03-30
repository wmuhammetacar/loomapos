import type { Route } from "next";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { getSuppliers, toUiError } from "@/lib/api";

interface PageProps {
  searchParams?: Promise<{
    q?: string;
    active?: string;
    tenantId?: string;
  }>;
}

const validActiveValues = ["all", "true", "false"] as const;

export default async function ErpSuppliersPage({ searchParams }: PageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const query = resolvedParams.q ?? "";
  const tenantId = resolvedParams.tenantId ?? "";

  const activeCandidate = resolvedParams.active ?? "all";
  const active = validActiveValues.includes(activeCandidate as (typeof validActiveValues)[number])
    ? (activeCandidate as (typeof validActiveValues)[number])
    : "all";

  try {
    const source = await getSuppliers({
      query,
      isActive: active,
      tenantId: tenantId.length > 0 ? tenantId : undefined
    });
    const rows = source.items;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">ERP · Suppliers</h2>
          <p className="text-sm text-gray-600">
            Real supplier visibility from canonical .NET backend purchasing contracts
          </p>
        </div>

        <form className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-[1fr_180px_240px_auto]">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search supplier, tax number, email or phone"
            className="h-10 rounded-md border border-line px-3"
          />
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
            "Supplier",
            "Tax Number",
            "Phone",
            "Email",
            "Active",
            "Created At"
          ]}
        >
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-600">
                No supplier found for current filters.
              </td>
            </tr>
          ) : (
            rows.map((supplier) => (
              <tr key={supplier.supplierId}>
                <td className="px-4 py-3">
                  <p className="font-medium text-brand">
                    <Link href={(`/erp/suppliers/${supplier.supplierId}` as Route)}>{supplier.name}</Link>
                  </p>
                  <p className="text-xs text-gray-500">{supplier.supplierId}</p>
                  <p className="mt-1 text-xs text-gray-500">{supplier.tenantName}</p>
                </td>
                <td className="px-4 py-3">{supplier.taxNumber ?? "-"}</td>
                <td className="px-4 py-3">{supplier.phone ?? "-"}</td>
                <td className="px-4 py-3">{supplier.email ?? "-"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      supplier.isActive ? "bg-success/10 text-success" : "bg-muted text-gray-700"
                    }`}
                  >
                    {supplier.isActive ? "active" : "inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{supplier.createdAt}</td>
              </tr>
            ))
          )}
        </DataTable>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">ERP · Suppliers</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load suppliers: {toUiError(error)}
        </div>
      </div>
    );
  }
}
