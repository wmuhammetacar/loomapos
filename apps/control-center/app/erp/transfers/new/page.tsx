import type { Route } from "next";
import { redirect } from "next/navigation";
import { createWarehouseTransferDraft, addWarehouseTransferLine, getWarehouseDetail, getWarehouses, toUiError } from "@/lib/api";

interface PageProps {
  searchParams?: Promise<{
    fromWarehouseId?: string;
    toWarehouseId?: string;
    error?: string;
  }>;
}

function buildNewTransferUrl(input: {
  fromWarehouseId?: string;
  toWarehouseId?: string;
  error?: string;
}): Route {
  const query = new URLSearchParams();
  if (input.fromWarehouseId) {
    query.set("fromWarehouseId", input.fromWarehouseId);
  }
  if (input.toWarehouseId) {
    query.set("toWarehouseId", input.toWarehouseId);
  }
  if (input.error) {
    query.set("error", input.error);
  }

  const suffix = query.toString();
  return (suffix.length > 0 ? `/erp/transfers/new?${suffix}` : "/erp/transfers/new") as Route;
}

async function createTransferAction(formData: FormData) {
  "use server";

  const fromWarehouseId = String(formData.get("fromWarehouseId") ?? "").trim();
  const toWarehouseId = String(formData.get("toWarehouseId") ?? "").trim();

  if (fromWarehouseId.length === 0 || toWarehouseId.length === 0) {
    redirect(
      buildNewTransferUrl({
        fromWarehouseId,
        toWarehouseId,
        error: "From warehouse and to warehouse are required."
      })
    );
  }

  if (fromWarehouseId === toWarehouseId) {
    redirect(
      buildNewTransferUrl({
        fromWarehouseId,
        toWarehouseId,
        error: "From warehouse and to warehouse must be different."
      })
    );
  }

  const candidateLines = [
    {
      productId: String(formData.get("lineProductId1") ?? "").trim(),
      quantity: Number(formData.get("lineQuantity1"))
    },
    {
      productId: String(formData.get("lineProductId2") ?? "").trim(),
      quantity: Number(formData.get("lineQuantity2"))
    },
    {
      productId: String(formData.get("lineProductId3") ?? "").trim(),
      quantity: Number(formData.get("lineQuantity3"))
    }
  ];

  const lines = candidateLines.filter(
    (line) => line.productId.length > 0 && Number.isFinite(line.quantity) && line.quantity > 0
  );

  if (lines.length === 0) {
    redirect(
      buildNewTransferUrl({
        fromWarehouseId,
        toWarehouseId,
        error: "At least one product line with quantity > 0 is required."
      })
    );
  }

  try {
    const created = await createWarehouseTransferDraft({
      fromWarehouseId,
      toWarehouseId
    });

    for (const line of lines) {
      await addWarehouseTransferLine({
        transferId: created.transferId,
        productId: line.productId,
        quantity: line.quantity
      });
    }

    redirect((`/erp/transfers/${created.transferId}?created=1` as Route));
  } catch (error) {
    redirect(
      buildNewTransferUrl({
        fromWarehouseId,
        toWarehouseId,
        error: toUiError(error)
      })
    );
  }
}

export default async function NewTransferPage({ searchParams }: PageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const fromWarehouseId = resolvedParams.fromWarehouseId ?? "";
  const toWarehouseId = resolvedParams.toWarehouseId ?? "";
  const errorMessage = resolvedParams.error ?? "";

  try {
    const warehousesSource = await getWarehouses({ isActive: "true" });
    const warehouses = warehousesSource.items;

    if (warehouses.length === 0) {
      return (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">ERP · New Transfer</h2>
          <div className="rounded-lg border border-line bg-surface p-4 text-sm text-gray-700">
            No active warehouse found. Create/activate warehouses before creating transfers.
          </div>
        </div>
      );
    }

    const sourceWarehouse =
      fromWarehouseId.length > 0 ? await getWarehouseDetail(fromWarehouseId) : null;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">ERP · New Transfer</h2>
          <p className="text-sm text-gray-600">
            Create a draft transfer and add one or more lines in a single operator flow.
          </p>
        </div>

        {errorMessage.length > 0 ? (
          <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            {errorMessage}
          </div>
        ) : null}

        <section className="space-y-3 rounded-lg border border-line bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 1 · Warehouses</p>
          <form method="GET" className="grid gap-3 md:grid-cols-2">
            <select
              name="fromWarehouseId"
              defaultValue={fromWarehouseId}
              className="h-10 rounded-md border border-line px-3"
              required
            >
              <option value="">Select from warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.warehouseId} value={warehouse.warehouseId}>
                  {warehouse.name} · {warehouse.tenantName}
                </option>
              ))}
            </select>
            <select
              name="toWarehouseId"
              defaultValue={toWarehouseId}
              className="h-10 rounded-md border border-line px-3"
              required
            >
              <option value="">Select to warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.warehouseId} value={warehouse.warehouseId}>
                  {warehouse.name} · {warehouse.tenantName}
                </option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white md:col-span-2">
              Load Source Stock
            </button>
          </form>
        </section>

        <section className="space-y-3 rounded-lg border border-line bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 2 · Lines</p>
          <p className="text-sm text-gray-600">
            Choose one or more product lines from source warehouse stock and set quantities.
          </p>

          <form action={createTransferAction} className="space-y-4">
            <input type="hidden" name="fromWarehouseId" value={fromWarehouseId} />
            <input type="hidden" name="toWarehouseId" value={toWarehouseId} />

            {sourceWarehouse && sourceWarehouse.stockRows.length > 0 ? (
              <div className="space-y-3">
                {[1, 2, 3].map((index) => (
                  <div key={index} className="grid gap-3 md:grid-cols-[1fr_200px]">
                    <select
                      name={`lineProductId${index}`}
                      className="h-10 rounded-md border border-line px-3"
                    >
                      <option value="">Line {index} · select product</option>
                      {sourceWarehouse.stockRows.map((stockRow) => (
                        <option key={`${index}-${stockRow.productId}`} value={stockRow.productId}>
                          {stockRow.productName} · qty {stockRow.quantity}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      name={`lineQuantity${index}`}
                      min="0"
                      step="0.0001"
                      placeholder="Quantity"
                      className="h-10 rounded-md border border-line px-3"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                Select a source warehouse with stock to choose products.
              </div>
            )}

            <div className="rounded-md border border-line bg-muted/40 p-3 text-sm text-gray-700">
              Step 3 · Review and create: this action creates a draft transfer and appends valid lines.
            </div>

            <button
              type="submit"
              disabled={fromWarehouseId.length === 0 || toWarehouseId.length === 0}
              className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create Transfer
            </button>
          </form>
        </section>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">ERP · New Transfer</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to prepare transfer creation screen: {toUiError(error)}
        </div>
      </div>
    );
  }
}
