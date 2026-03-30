import type { Route } from "next";
import { redirect } from "next/navigation";
import {
  addPurchaseOrderLine,
  createPurchaseOrderDraft,
  getSuppliers,
  getWarehouseDetail,
  getWarehouses,
  toUiError
} from "@/lib/api";

interface PageProps {
  searchParams?: Promise<{
    supplierId?: string;
    warehouseId?: string;
    error?: string;
  }>;
}

function buildNewPurchaseOrderUrl(input: {
  supplierId?: string;
  warehouseId?: string;
  error?: string;
}): Route {
  const query = new URLSearchParams();
  if (input.supplierId) {
    query.set("supplierId", input.supplierId);
  }
  if (input.warehouseId) {
    query.set("warehouseId", input.warehouseId);
  }
  if (input.error) {
    query.set("error", input.error);
  }

  const suffix = query.toString();
  return (suffix.length > 0 ? `/erp/purchase-orders/new?${suffix}` : "/erp/purchase-orders/new") as Route;
}

async function createPurchaseOrderAction(formData: FormData) {
  "use server";

  const supplierId = String(formData.get("supplierId") ?? "").trim();
  const warehouseId = String(formData.get("warehouseId") ?? "").trim();

  if (supplierId.length === 0 || warehouseId.length === 0) {
    redirect(
      buildNewPurchaseOrderUrl({
        supplierId,
        warehouseId,
        error: "Supplier and warehouse are required."
      })
    );
  }

  const candidateLines = [
    {
      productId: String(formData.get("lineProductId1") ?? "").trim(),
      quantity: Number(formData.get("lineQuantity1")),
      unitCost: Number(formData.get("lineUnitCost1"))
    },
    {
      productId: String(formData.get("lineProductId2") ?? "").trim(),
      quantity: Number(formData.get("lineQuantity2")),
      unitCost: Number(formData.get("lineUnitCost2"))
    },
    {
      productId: String(formData.get("lineProductId3") ?? "").trim(),
      quantity: Number(formData.get("lineQuantity3")),
      unitCost: Number(formData.get("lineUnitCost3"))
    }
  ];

  const lines = candidateLines.filter(
    (line) =>
      line.productId.length > 0 &&
      Number.isFinite(line.quantity) &&
      line.quantity > 0 &&
      Number.isFinite(line.unitCost) &&
      line.unitCost >= 0
  );

  if (lines.length === 0) {
    redirect(
      buildNewPurchaseOrderUrl({
        supplierId,
        warehouseId,
        error: "At least one line with quantity > 0 and unit cost >= 0 is required."
      })
    );
  }

  try {
    const created = await createPurchaseOrderDraft({
      supplierId,
      warehouseId
    });

    for (const line of lines) {
      await addPurchaseOrderLine({
        purchaseOrderId: created.purchaseOrderId,
        productId: line.productId,
        quantity: line.quantity,
        unitCost: line.unitCost
      });
    }

    redirect((`/erp/purchase-orders/${created.purchaseOrderId}?created=1` as Route));
  } catch (error) {
    redirect(
      buildNewPurchaseOrderUrl({
        supplierId,
        warehouseId,
        error: toUiError(error)
      })
    );
  }
}

export default async function NewPurchaseOrderPage({ searchParams }: PageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const supplierId = resolvedParams.supplierId ?? "";
  const warehouseId = resolvedParams.warehouseId ?? "";
  const errorMessage = resolvedParams.error ?? "";

  try {
    const [suppliersSource, warehousesSource] = await Promise.all([
      getSuppliers({ isActive: "true" }),
      getWarehouses({ isActive: "true" })
    ]);

    const suppliers = suppliersSource.items;
    const warehouses = warehousesSource.items;

    if (suppliers.length === 0 || warehouses.length === 0) {
      return (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">ERP · New Purchase Order</h2>
          <div className="rounded-lg border border-line bg-surface p-4 text-sm text-gray-700">
            {suppliers.length === 0
              ? "No active supplier found. Add/activate suppliers before creating purchase orders."
              : "No active warehouse found. Create/activate warehouses before creating purchase orders."}
          </div>
        </div>
      );
    }

    const selectedWarehouse = warehouseId.length > 0 ? await getWarehouseDetail(warehouseId) : null;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">ERP · New Purchase Order</h2>
          <p className="text-sm text-gray-600">
            Create draft purchase order, append one or more lines, then move to receive on detail screen.
          </p>
        </div>

        {errorMessage.length > 0 ? (
          <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            {errorMessage}
          </div>
        ) : null}

        <section className="space-y-3 rounded-lg border border-line bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 1 · Supplier and warehouse</p>
          <form method="GET" className="grid gap-3 md:grid-cols-2">
            <select
              name="supplierId"
              defaultValue={supplierId}
              className="h-10 rounded-md border border-line px-3"
              required
            >
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.supplierId} value={supplier.supplierId}>
                  {supplier.name} · {supplier.tenantName}
                </option>
              ))}
            </select>
            <select
              name="warehouseId"
              defaultValue={warehouseId}
              className="h-10 rounded-md border border-line px-3"
              required
            >
              <option value="">Select warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.warehouseId} value={warehouse.warehouseId}>
                  {warehouse.name} · {warehouse.tenantName}
                </option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white md:col-span-2">
              Load Product Suggestions
            </button>
          </form>
        </section>

        <section className="space-y-3 rounded-lg border border-line bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 2 · Add lines</p>
          <p className="text-sm text-gray-600">
            Product id is required, quantity must be &gt; 0, and unit cost must be &gt;= 0.
          </p>

          <form action={createPurchaseOrderAction} className="space-y-4">
            <input type="hidden" name="supplierId" value={supplierId} />
            <input type="hidden" name="warehouseId" value={warehouseId} />

            {[1, 2, 3].map((index) => (
              <div key={index} className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
                <input
                  type="text"
                  name={`lineProductId${index}`}
                  list="warehouse-product-ids"
                  placeholder={`Line ${index} · product id`}
                  className="h-10 rounded-md border border-line px-3"
                />
                <input
                  type="number"
                  name={`lineQuantity${index}`}
                  min="0"
                  step="0.0001"
                  placeholder="Quantity"
                  className="h-10 rounded-md border border-line px-3"
                />
                <input
                  type="number"
                  name={`lineUnitCost${index}`}
                  min="0"
                  step="0.0001"
                  placeholder="Unit cost"
                  className="h-10 rounded-md border border-line px-3"
                />
              </div>
            ))}

            {selectedWarehouse && selectedWarehouse.stockRows.length > 0 ? (
              <datalist id="warehouse-product-ids">
                {selectedWarehouse.stockRows.map((stockRow) => (
                  <option key={stockRow.productId} value={stockRow.productId}>
                    {stockRow.productName} · qty {stockRow.quantity}
                  </option>
                ))}
              </datalist>
            ) : (
              <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                No product suggestion loaded for selected warehouse. You can still enter product ids manually.
              </div>
            )}

            <div className="rounded-md border border-line bg-muted/40 p-3 text-sm text-gray-700">
              Step 3 · Review and create: this action creates a draft purchase order and appends all valid lines.
            </div>

            <button
              type="submit"
              disabled={supplierId.length === 0 || warehouseId.length === 0}
              className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create Purchase Order
            </button>
          </form>
        </section>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">ERP · New Purchase Order</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to prepare purchase order creation screen: {toUiError(error)}
        </div>
      </div>
    );
  }
}
