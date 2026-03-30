import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { DataTable } from "@/components/data-table";
import {
  addWarehouseTransferLine,
  completeWarehouseTransfer,
  getWarehouseDetail,
  getWarehouseTransferDetail,
  toUiError
} from "@/lib/api";
import type { WarehouseTransferStatus } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    success?: string;
    error?: string;
    created?: string;
  }>;
}

function buildTransferDetailUrl(
  transferId: string,
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
    suffix.length > 0 ? `/erp/transfers/${transferId}?${suffix}` : `/erp/transfers/${transferId}`
  ) as Route;
}

async function addLineAction(formData: FormData) {
  "use server";

  const transferId = String(formData.get("transferId") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();
  const quantity = Number(formData.get("quantity"));

  if (transferId.length === 0 || productId.length === 0 || !Number.isFinite(quantity) || quantity <= 0) {
    redirect(
      buildTransferDetailUrl(transferId, {
        error: "Product and quantity > 0 are required."
      })
    );
  }

  try {
    await addWarehouseTransferLine({
      transferId,
      productId,
      quantity
    });
    redirect(
      buildTransferDetailUrl(transferId, {
        success: "Transfer line added."
      })
    );
  } catch (error) {
    redirect(
      buildTransferDetailUrl(transferId, {
        error: toUiError(error)
      })
    );
  }
}

async function completeTransferAction(formData: FormData) {
  "use server";

  const transferId = String(formData.get("transferId") ?? "").trim();
  if (transferId.length === 0) {
    redirect(
      buildTransferDetailUrl("unknown", {
        error: "Transfer id is missing."
      })
    );
  }

  try {
    await completeWarehouseTransfer({ transferId });
    redirect(
      buildTransferDetailUrl(transferId, {
        success: "Transfer completed."
      })
    );
  } catch (error) {
    redirect(
      buildTransferDetailUrl(transferId, {
        error: toUiError(error)
      })
    );
  }
}

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

export default async function ErpTransferDetailPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const successMessage = resolvedSearchParams.success ?? "";
  const errorMessage = resolvedSearchParams.error ?? "";
  const created = resolvedSearchParams.created ?? "";

  try {
    const transfer = await getWarehouseTransferDetail(resolvedParams.id);
    if (transfer === null) {
      notFound();
    }

    const sourceWarehouse = await getWarehouseDetail(transfer.fromWarehouseId);
    const canMutate = transfer.status === "draft";

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">ERP · Transfer Detail</h2>
          <p className="text-sm text-gray-600">Operational transfer detail and completion controls</p>
        </div>

        {created.length > 0 ? (
          <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
            Transfer draft created successfully.
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
            <p className="text-xs uppercase tracking-wide text-gray-500">Transfer</p>
            <p className="mt-1 font-mono text-xs">{transfer.transferId}</p>
            <p className="mt-1 text-xs text-gray-500">{transfer.tenantName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">From</p>
            <p className="mt-1 font-semibold">{transfer.fromWarehouseName}</p>
            <p className="mt-1 text-xs text-gray-500">{transfer.fromWarehouseId}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">To</p>
            <p className="mt-1 font-semibold">{transfer.toWarehouseName}</p>
            <p className="mt-1 text-xs text-gray-500">{transfer.toWarehouseId}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Status</p>
            <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(transfer.status)}`}>
              {transfer.status}
            </span>
            <p className="mt-2 text-xs text-gray-500">Created: {transfer.createdAt}</p>
            <p className="mt-1 text-xs text-gray-500">Completed: {transfer.completedAt ?? "-"}</p>
          </div>
        </section>

        <DataTable headers={["Product", "SKU", "Barcode", "Quantity"]}>
          {transfer.lines.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-600">
                No line exists yet for this transfer.
              </td>
            </tr>
          ) : (
            transfer.lines.map((line) => (
              <tr key={line.lineId}>
                <td className="px-4 py-3">
                  <p className="font-medium">{line.productName}</p>
                  <p className="text-xs text-gray-500">{line.productId}</p>
                </td>
                <td className="px-4 py-3">{line.sku ?? "-"}</td>
                <td className="px-4 py-3">{line.barcode ?? "-"}</td>
                <td className="px-4 py-3 font-semibold">{line.quantity}</td>
              </tr>
            ))
          )}
        </DataTable>

        {canMutate ? (
          <section className="grid gap-4 md:grid-cols-2">
            <form action={addLineAction} className="space-y-3 rounded-lg border border-line bg-surface p-4">
              <p className="text-sm font-semibold">Add line</p>
              <input type="hidden" name="transferId" value={transfer.transferId} />
              <select name="productId" className="h-10 w-full rounded-md border border-line px-3" required>
                <option value="">Select product</option>
                {(sourceWarehouse?.stockRows ?? []).map((stockRow) => (
                  <option key={stockRow.productId} value={stockRow.productId}>
                    {stockRow.productName} · qty {stockRow.quantity}
                  </option>
                ))}
              </select>
              <input
                type="number"
                name="quantity"
                min="0.0001"
                step="0.0001"
                className="h-10 w-full rounded-md border border-line px-3"
                placeholder="Quantity"
                required
              />
              <button type="submit" className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white">
                Add Line
              </button>
            </form>

            <form action={completeTransferAction} className="space-y-3 rounded-lg border border-line bg-surface p-4">
              <p className="text-sm font-semibold">Complete transfer</p>
              <input type="hidden" name="transferId" value={transfer.transferId} />
              <p className="text-sm text-gray-600">
                Completion is atomic on backend. If stock is insufficient, operation is rejected safely.
              </p>
              <button type="submit" className="h-10 rounded-md bg-success px-4 text-sm font-semibold text-white">
                Complete Transfer
              </button>
            </form>
          </section>
        ) : (
          <div className="rounded-lg border border-line bg-surface p-4 text-sm text-gray-700">
            This transfer is read-only because status is <strong>{transfer.status}</strong>.
          </div>
        )}
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">ERP · Transfer Detail</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load transfer detail: {toUiError(error)}
        </div>
      </div>
    );
  }
}
