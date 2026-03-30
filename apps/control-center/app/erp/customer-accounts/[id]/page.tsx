import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { DataTable } from "@/components/data-table";
import {
  getCustomerAccountDetail,
  recordCustomerAccountAdjustment,
  recordCustomerAccountCollection,
  recordCustomerAccountRefundCredit,
  toUiError
} from "@/lib/api";
import type { CustomerAccountBalanceState } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
}

function buildDetailUrl(contactId: string, input: { success?: string; error?: string }): Route {
  const query = new URLSearchParams();
  if (input.success) {
    query.set("success", input.success);
  }
  if (input.error) {
    query.set("error", input.error);
  }

  const suffix = query.toString();
  return (
    suffix.length > 0
      ? `/erp/customer-accounts/${contactId}?${suffix}`
      : `/erp/customer-accounts/${contactId}`
  ) as Route;
}

async function recordCollectionAction(formData: FormData) {
  "use server";

  const contactId = String(formData.get("contactId") ?? "").trim();
  const amount = Number(formData.get("collectionAmount"));
  const referenceType = String(formData.get("collectionReferenceType") ?? "").trim();
  const referenceId = String(formData.get("collectionReferenceId") ?? "").trim();
  const note = String(formData.get("collectionNote") ?? "").trim();

  if (contactId.length === 0 || !Number.isFinite(amount) || amount <= 0) {
    redirect(buildDetailUrl(contactId, { error: "Collection amount must be greater than zero." }));
  }

  try {
    await recordCustomerAccountCollection({
      contactId,
      amount,
      referenceType: referenceType.length > 0 ? referenceType : undefined,
      referenceId: referenceId.length > 0 ? referenceId : undefined,
      note: note.length > 0 ? note : undefined
    });

    redirect(buildDetailUrl(contactId, { success: "Collection recorded." }));
  } catch (error) {
    redirect(buildDetailUrl(contactId, { error: toUiError(error) }));
  }
}

async function recordAdjustmentAction(formData: FormData) {
  "use server";

  const contactId = String(formData.get("contactId") ?? "").trim();
  const amountDelta = Number(formData.get("adjustmentAmountDelta"));
  const referenceType = String(formData.get("adjustmentReferenceType") ?? "").trim();
  const referenceId = String(formData.get("adjustmentReferenceId") ?? "").trim();
  const note = String(formData.get("adjustmentNote") ?? "").trim();

  if (contactId.length === 0 || !Number.isFinite(amountDelta) || amountDelta === 0) {
    redirect(buildDetailUrl(contactId, { error: "Adjustment amount delta must not be zero." }));
  }

  try {
    await recordCustomerAccountAdjustment({
      contactId,
      amountDelta,
      referenceType: referenceType.length > 0 ? referenceType : undefined,
      referenceId: referenceId.length > 0 ? referenceId : undefined,
      note: note.length > 0 ? note : undefined
    });

    redirect(buildDetailUrl(contactId, { success: "Adjustment recorded." }));
  } catch (error) {
    redirect(buildDetailUrl(contactId, { error: toUiError(error) }));
  }
}

async function recordRefundCreditAction(formData: FormData) {
  "use server";

  const contactId = String(formData.get("contactId") ?? "").trim();
  const amount = Number(formData.get("refundAmount"));
  const referenceType = String(formData.get("refundReferenceType") ?? "").trim();
  const referenceId = String(formData.get("refundReferenceId") ?? "").trim();
  const note = String(formData.get("refundNote") ?? "").trim();

  if (contactId.length === 0 || !Number.isFinite(amount) || amount <= 0) {
    redirect(buildDetailUrl(contactId, { error: "Refund credit amount must be greater than zero." }));
  }

  try {
    await recordCustomerAccountRefundCredit({
      contactId,
      amount,
      referenceType: referenceType.length > 0 ? referenceType : undefined,
      referenceId: referenceId.length > 0 ? referenceId : undefined,
      note: note.length > 0 ? note : undefined
    });

    redirect(buildDetailUrl(contactId, { success: "Refund credit recorded." }));
  } catch (error) {
    redirect(buildDetailUrl(contactId, { error: toUiError(error) }));
  }
}

function balanceBadgeClass(state: CustomerAccountBalanceState): string {
  if (state === "positive") {
    return "bg-warning/10 text-warning";
  }
  if (state === "credit") {
    return "bg-info/10 text-info";
  }
  return "bg-success/10 text-success";
}

function balanceLabel(state: CustomerAccountBalanceState): string {
  if (state === "positive") {
    return "receivable";
  }
  if (state === "credit") {
    return "credit";
  }
  return "zero";
}

function entryTypeBadge(type: string): string {
  const normalized = type.trim().toLowerCase();
  if (normalized === "sale_charge") {
    return "bg-warning/10 text-warning";
  }
  if (normalized === "collection") {
    return "bg-success/10 text-success";
  }
  if (normalized === "refund_credit") {
    return "bg-info/10 text-info";
  }
  return "bg-muted text-gray-700";
}

export default async function ErpCustomerAccountDetailPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const successMessage = resolvedSearchParams.success ?? "";
  const errorMessage = resolvedSearchParams.error ?? "";

  try {
    const account = await getCustomerAccountDetail(resolvedParams.id);
    if (account === null) {
      notFound();
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">ERP · Customer Account Detail</h2>
          <p className="text-sm text-gray-600">Append-only current-account detail and operator actions</p>
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
            <p className="text-xs uppercase tracking-wide text-gray-500">Customer</p>
            <p className="mt-1 font-semibold">{account.customerName}</p>
            <p className="mt-1 font-mono text-xs text-gray-500">{account.contactId}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Tenant</p>
            <p className="mt-1 font-semibold">{account.tenantName}</p>
            <p className="mt-1 font-mono text-xs text-gray-500">{account.tenantId}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Balance</p>
            <p className="mt-1 text-xl font-semibold">
              {account.balance} {account.currency}
            </p>
            <span
              className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${balanceBadgeClass(
                account.balanceState
              )}`}
            >
              {balanceLabel(account.balanceState)}
            </span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Metadata</p>
            <p className="mt-1 text-sm">Account: {account.accountId}</p>
            <p className="mt-1 text-sm">Email: {account.email ?? "-"}</p>
            <p className="mt-1 text-sm">Phone: {account.phone ?? "-"}</p>
            <p className="mt-1 text-xs text-gray-500">Updated: {account.updatedAt}</p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <form action={recordCollectionAction} className="space-y-3 rounded-lg border border-line bg-surface p-4">
            <p className="text-sm font-semibold">Record collection</p>
            <input type="hidden" name="contactId" value={account.contactId} />
            <input
              type="number"
              name="collectionAmount"
              min="0.0001"
              step="0.0001"
              className="h-10 w-full rounded-md border border-line px-3"
              placeholder="Amount"
              required
            />
            <input
              type="text"
              name="collectionReferenceType"
              className="h-10 w-full rounded-md border border-line px-3"
              placeholder="Reference type (optional)"
            />
            <input
              type="text"
              name="collectionReferenceId"
              className="h-10 w-full rounded-md border border-line px-3"
              placeholder="Reference id (optional)"
            />
            <input
              type="text"
              name="collectionNote"
              className="h-10 w-full rounded-md border border-line px-3"
              placeholder="Note (optional)"
            />
            <button type="submit" className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white">
              Record Collection
            </button>
          </form>

          <form action={recordAdjustmentAction} className="space-y-3 rounded-lg border border-line bg-surface p-4">
            <p className="text-sm font-semibold">Record adjustment</p>
            <input type="hidden" name="contactId" value={account.contactId} />
            <input
              type="number"
              name="adjustmentAmountDelta"
              step="0.0001"
              className="h-10 w-full rounded-md border border-line px-3"
              placeholder="Amount delta (+/-)"
              required
            />
            <input
              type="text"
              name="adjustmentReferenceType"
              className="h-10 w-full rounded-md border border-line px-3"
              placeholder="Reference type (optional)"
            />
            <input
              type="text"
              name="adjustmentReferenceId"
              className="h-10 w-full rounded-md border border-line px-3"
              placeholder="Reference id (optional)"
            />
            <input
              type="text"
              name="adjustmentNote"
              className="h-10 w-full rounded-md border border-line px-3"
              placeholder="Note (optional)"
            />
            <button type="submit" className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white">
              Record Adjustment
            </button>
          </form>

          <form action={recordRefundCreditAction} className="space-y-3 rounded-lg border border-line bg-surface p-4">
            <p className="text-sm font-semibold">Record refund credit</p>
            <input type="hidden" name="contactId" value={account.contactId} />
            <input
              type="number"
              name="refundAmount"
              min="0.0001"
              step="0.0001"
              className="h-10 w-full rounded-md border border-line px-3"
              placeholder="Amount"
              required
            />
            <input
              type="text"
              name="refundReferenceType"
              className="h-10 w-full rounded-md border border-line px-3"
              placeholder="Reference type (optional)"
            />
            <input
              type="text"
              name="refundReferenceId"
              className="h-10 w-full rounded-md border border-line px-3"
              placeholder="Reference id (optional)"
            />
            <input
              type="text"
              name="refundNote"
              className="h-10 w-full rounded-md border border-line px-3"
              placeholder="Note (optional)"
            />
            <button type="submit" className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-white">
              Record Refund Credit
            </button>
          </form>
        </section>

        <DataTable headers={["Type", "Amount", "Ref Type", "Ref Id", "Created At", "Note"]}>
          {account.entries.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-600">
                No account entry exists for this customer yet.
              </td>
            </tr>
          ) : (
            account.entries.map((entry) => (
              <tr key={entry.entryId}>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${entryTypeBadge(entry.type)}`}>
                    {entry.type}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold">{entry.amount}</td>
                <td className="px-4 py-3">{entry.refType}</td>
                <td className="px-4 py-3">{entry.refId}</td>
                <td className="px-4 py-3 text-gray-600">{entry.createdAt}</td>
                <td className="px-4 py-3 text-gray-600">{entry.note ?? "-"}</td>
              </tr>
            ))
          )}
        </DataTable>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">ERP · Customer Account Detail</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load customer account detail: {toUiError(error)}
        </div>
      </div>
    );
  }
}
