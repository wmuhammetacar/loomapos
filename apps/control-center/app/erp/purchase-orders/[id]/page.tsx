import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { DataTable } from "@/components/data-table";
import {
  addPurchaseOrderLine,
  getPurchaseOrderDetail,
  getWarehouseDetail,
  receivePurchaseOrder,
  toUiError
} from "@/lib/api";
import type { PurchaseOrderStatus } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    success?: string;
    error?: string;
    created?: string;
  }>;
}

function buildPurchaseOrderDetailUrl(
  purchaseOrderId: string,
  input: { success?: string; error?: string; created?: string }
): Route {
  const query = new URLSearchParams();
  if (input.success) {
    query.set("success", input.success);
  }
  if (input.error) {
    query.set("error", input.error);
  }
  if (input.created) {
    query.set("created", input.created);
  }

  const suffix = query.toString();
  return (
    suffix.length > 0
      ? `/erp/purchase-orders/${purchaseOrderId}?${suffix}`
      : `/erp/purchase-orders/${purchaseOrderId}`
  ) as Route;
}

async function addLineAction(formData: FormData) {
  "use server";

  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();
  const quantity = Number(formData.get("quantity"));
  const unitCost = Number(formData.get("unitCost"));

  if (
    purchaseOrderId.length === 0 ||
    productId.length === 0 ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(unitCost) ||
    unitCost < 0
  ) {
    redirect(
      buildPurchaseOrderDetailUrl(purchaseOrderId, {
        error: "Product id, quantity > 0 and unit cost >= 0 are required."
      })
    );
  }

  try {
    await addPurchaseOrderLine({
      purchaseOrderId,
      productId,
      quantity,
      unitCost
    });
    redirect(
      buildPurchaseOrderDetailUrl(purchaseOrderId, {
        success: "Purchase order line added."
      })
    );
  } catch (error) {
    redirect(
      buildPurchaseOrderDetailUrl(purchaseOrderId, {
        error: toUiError(error)
      })
    );
  }
}

async function receivePurchaseOrderAction(formData: FormData) {
  "use server";

  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "").trim();
  if (purchaseOrderId.length === 0) {
    redirect(("/erp/purchase-orders" as Route));
  }

  try {
    await receivePurchaseOrder({ purchaseOrderId });
    redirect(
      buildPurchaseOrderDetailUrl(purchaseOrderId, {
        success: "Purchase order received."
      })
    );
  } catch (error) {
    redirect(
      buildPurchaseOrderDetailUrl(purchaseOrderId, {
        error: toUiError(error)
      })
    );
  }
}

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

export default async function ErpPurchaseOrderDetailPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const successMessage = resolvedSearchParams.success ?? "";
  const errorMessage = resolvedSearchParams.error ?? "";
  const created = resolvedSearchParams.created ?? "";

  try {
    const purchaseOrder = await getPurchaseOrderDetail(resolvedParams.id);
    if (purchaseOrder === null) {
      notFound();
    }

    const warehouse = await getWarehouseDetail(purchaseOrder.warehouseId);
    const canMutate = purchaseOrder.status === "draft" || purchaseOrder.status === "ordered";

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">ERP · Purchase Order Detail</h2>
          <p className="text-sm text-gray-600">Operational purchase order detail and receive controls</p>
        </div>

        {created.length > 0 ? (
          <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
            Purchase order draft created successfully.
          </div>
        ) : null}

        {successMessage.length > 0 ? (
          <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
            {successMessage}
          </div>
        ) : null}

        {errorMessage.length > 0 ? (
          <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-4 rounded-lg border border-line bg-surface p-4 md:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Purchase order</p>
            <p className="mt-1 font-mono text-xs">{purchaseOrder.purchaseOrderId}</p>
            <p className="mt-1 text-xs text-gray-500">{purchaseOrder.tenantName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Supplier</p>
            <p className="mt-1 font-semibold">{purchaseOrder.supplierName}</p>
            <p className="mt-1 text-xs text-gray-500">{purchaseOrder.supplierId}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Warehouse</p>
            <p className="mt-1 font-semibold">{purchaseOrder.warehouseName}</p>
            <p className="mt-1 text-xs text-gray-500">{purchaseOrder.warehouseId}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Status</p>
            <span
              className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(
                purchaseOrder.status
              )}`}
            >
              {purchaseOrder.status}
            </span>
            <p className="mt-2 text-xs text-gray-500">Created: {purchaseOrder.createdAt}</p>
            <p className="mt-1 text-xs text-gray-500">Received: {purchaseOrder.receivedAt ?? "-"}</p>
          </div>
        </section>

        <DataTable headers={["Product", "SKU", "Barcode", "Quantity", "Unit Cost"]}>
          {purchaseOrder.lines.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-600">
                No line exists yet for this purchase order.
              </td>
            </tr>
          ) : (
            purchaseOrder.lines.map((line) => (
              <tr key={line.lineId}>
                <td className="px-4 py-3">
                  <p className="font-medium">{line.productName}</p>
                  <p className="text-xs text-gray-500">{line.productId}</p>
                </td>
                <td className="px-4 py-3">{line.sku ?? "-"}</td>
                <td className="px-4 py-3">{line.barcode ?? "-"}</td>
                <td className="px-4 py-3 font-semibold">{line.quantity}</td>
                <td className="px-4 py-3">{line.unitCost}</td>
              </tr>
            ))
          )}
        </DataTable>

        {canMutate ? (
          <section className="grid gap-4 md:grid-cols-2">
            <form action={addLineAction} className="space-y-3 rounded-lg border border-line bg-surface p-4">
              <p className="text-sm font-semibold">Add line</p>
              <input type="hidden" name="purchaseOrderId" value={purchaseOrder.purchaseOrderId} />
              <input
                type="text"
                name="productId"
                list="purchase-order-product-ids"
                className="h-10 w-full rounded-md border border-line px-3"
                placeholder="Product id"
                required
              />
              <input
                type="number"
                name="quantity"
                min="0.0001"
                step="0.0001"
                className="h-10 w-full rounded-md border border-line px-3"
                placeholder="Quantity"
                required
              />
              <input
                type="number"
                name="unitCost"
                min="0"
                step="0.0001"
                className="h-10 w-full rounded-md border border-line px-3"
                placeholder="Unit cost"
                required
              />

              {warehouse && warehouse.stockRows.length > 0 ? (
                <datalist id="purchase-order-product-ids">
                  {warehouse.stockRows.map((stockRow) => (
                    <option key={stockRow.productId} value={stockRow.productId}>
                      {stockRow.productName}
                    </option>
                  ))}
                </datalist>
              ) : null}

              <button type="submit" className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white">
                Add Line
              </button>
            </form>

            <form action={receivePurchaseOrderAction} className="space-y-3 rounded-lg border border-line bg-surface p-4">
              <p className="text-sm font-semibold">Receive purchase order</p>
              <input type="hidden" name="purchaseOrderId" value={purchaseOrder.purchaseOrderId} />
              <p className="text-sm text-gray-600">
                Receive action is executed on backend atomically; stock is increased only if full validation passes.
              </p>
              <button
                type="submit"
                disabled={purchaseOrder.lines.length === 0}
                className="h-10 rounded-md bg-success px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Receive Order
              </button>
            </form>
          </section>
        ) : (
          <div className="rounded-lg border border-line bg-surface p-4 text-sm text-gray-700">
            This purchase order is read-only because status is <strong>{purchaseOrder.status}</strong>.
          </div>
        )}
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">ERP · Purchase Order Detail</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load purchase order detail: {toUiError(error)}
        </div>
      </div>
    );
  }
}
