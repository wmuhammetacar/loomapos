import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import {
  getAccountingExportItemDetail,
  markAccountingExportItemAsExported,
  markAccountingExportItemAsFailed,
  toUiError
} from "@/lib/api";
import type { AccountingExportStatus } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
}

function buildDetailUrl(id: string, input: { success?: string; error?: string }): Route {
  const query = new URLSearchParams();
  if (input.success) {
    query.set("success", input.success);
  }
  if (input.error) {
    query.set("error", input.error);
  }

  const suffix = query.toString();
  return (suffix.length > 0 ? `/erp/accounting-exports/${id}?${suffix}` : `/erp/accounting-exports/${id}`) as Route;
}

async function markExportedAction(formData: FormData) {
  "use server";

  const id = String(formData.get("id") ?? "").trim();
  if (id.length === 0) {
    redirect(("/erp/accounting-exports" as Route));
  }

  try {
    await markAccountingExportItemAsExported({ id });
    redirect(buildDetailUrl(id, { success: "Export item marked as exported." }));
  } catch (error) {
    redirect(buildDetailUrl(id, { error: toUiError(error) }));
  }
}

async function markRetryReadyAction(formData: FormData) {
  "use server";

  const id = String(formData.get("id") ?? "").trim();
  if (id.length === 0) {
    redirect(("/erp/accounting-exports" as Route));
  }

  try {
    await markAccountingExportItemAsFailed({ id, retryReady: true });
    redirect(buildDetailUrl(id, { success: "Export item moved to retry-ready pending state." }));
  } catch (error) {
    redirect(buildDetailUrl(id, { error: toUiError(error) }));
  }
}

async function markFailedAction(formData: FormData) {
  "use server";

  const id = String(formData.get("id") ?? "").trim();
  const failureReason = String(formData.get("failureReason") ?? "").trim();

  if (id.length === 0 || failureReason.length === 0) {
    redirect(buildDetailUrl(id, { error: "Failure reason is required." }));
  }

  try {
    await markAccountingExportItemAsFailed({
      id,
      failureReason,
      retryReady: false
    });
    redirect(buildDetailUrl(id, { success: "Export item marked as failed." }));
  } catch (error) {
    redirect(buildDetailUrl(id, { error: toUiError(error) }));
  }
}

function statusBadge(status: AccountingExportStatus): string {
  if (status === "exported") {
    return "bg-success/10 text-success";
  }
  if (status === "failed") {
    return "bg-danger/10 text-danger";
  }
  return "bg-warning/10 text-warning";
}

function prettyPayload(payloadJson: string): string {
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return payloadJson;
  }
}

export default async function ErpAccountingExportDetailPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const successMessage = resolvedSearchParams.success ?? "";
  const errorMessage = resolvedSearchParams.error ?? "";

  try {
    const row = await getAccountingExportItemDetail(resolvedParams.id);
    if (row === null) {
      notFound();
    }

    const payload = prettyPayload(row.payloadJson);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">ERP · Accounting Export Detail</h2>
          <p className="text-sm text-gray-600">Operational export-item inspection and status actions</p>
        </div>

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
            <p className="text-xs uppercase tracking-wide text-gray-500">Export Item</p>
            <p className="mt-1 font-mono text-xs">{row.id}</p>
            <p className="mt-1 text-xs text-gray-500">Tenant: {row.tenantId ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Source</p>
            <p className="mt-1 font-semibold">{row.sourceType}</p>
            <p className="mt-1 text-xs text-gray-500">Source ID: {row.sourceId}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Event Code</p>
            <p className="mt-1 font-semibold">{row.eventCode}</p>
            <p className="mt-1 text-xs text-gray-500">Created: {row.createdAt}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Status</p>
            <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(row.status)}`}>
              {row.status}
            </span>
            <p className="mt-2 text-xs text-gray-500">Exported At: {row.exportedAt ?? "-"}</p>
            <p className="mt-1 text-xs text-gray-500">Failure: {row.failureReason ?? "-"}</p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {row.status !== "exported" ? (
            <form action={markExportedAction} className="space-y-3 rounded-lg border border-line bg-surface p-4">
              <p className="text-sm font-semibold">Mark exported</p>
              <input type="hidden" name="id" value={row.id} />
              <p className="text-sm text-gray-600">Use after accounting side confirms this item was exported.</p>
              <button type="submit" className="h-10 rounded-md bg-success px-4 text-sm font-semibold text-white">
                Mark Exported
              </button>
            </form>
          ) : (
            <div className="space-y-2 rounded-lg border border-line bg-surface p-4 text-sm text-gray-700">
              <p className="font-semibold">Mark exported</p>
              <p>Already exported. No further action needed.</p>
            </div>
          )}

          {row.status === "failed" ? (
            <form action={markRetryReadyAction} className="space-y-3 rounded-lg border border-line bg-surface p-4">
              <p className="text-sm font-semibold">Mark retry-ready</p>
              <input type="hidden" name="id" value={row.id} />
              <p className="text-sm text-gray-600">Move failed item back to pending state for retry.</p>
              <button type="submit" className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white">
                Move To Pending
              </button>
            </form>
          ) : (
            <div className="space-y-2 rounded-lg border border-line bg-surface p-4 text-sm text-gray-700">
              <p className="font-semibold">Mark retry-ready</p>
              <p>Available only when item status is failed.</p>
            </div>
          )}

          {row.status !== "failed" ? (
            <form action={markFailedAction} className="space-y-3 rounded-lg border border-line bg-surface p-4">
              <p className="text-sm font-semibold">Mark failed</p>
              <input type="hidden" name="id" value={row.id} />
              <textarea
                name="failureReason"
                required
                rows={3}
                className="w-full rounded-md border border-line px-3 py-2"
                placeholder="Failure reason"
              />
              <button type="submit" className="h-10 rounded-md bg-danger px-4 text-sm font-semibold text-white">
                Mark Failed
              </button>
            </form>
          ) : (
            <div className="space-y-2 rounded-lg border border-line bg-surface p-4 text-sm text-gray-700">
              <p className="font-semibold">Mark failed</p>
              <p>Item is already in failed state.</p>
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-lg border border-line bg-surface p-4">
          <p className="text-sm font-semibold">Payload JSON</p>
          <pre className="max-h-[560px] overflow-auto rounded-md bg-muted p-3 text-xs leading-5 text-gray-800">
            {payload}
          </pre>
        </section>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">ERP · Accounting Export Detail</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load accounting export detail: {toUiError(error)}
        </div>
      </div>
    );
  }
}
