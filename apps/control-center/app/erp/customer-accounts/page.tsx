import type { Route } from "next";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { getCustomerAccounts, toUiError } from "@/lib/api";
import type { CustomerAccountBalanceState } from "@/types";

interface PageProps {
  searchParams?: Promise<{
    q?: string;
    balance?: string;
    tenantId?: string;
  }>;
}

const validBalances: Array<CustomerAccountBalanceState | "all"> = [
  "all",
  "positive",
  "zero",
  "credit"
];

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

export default async function ErpCustomerAccountsPage({ searchParams }: PageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const query = resolvedParams.q ?? "";
  const tenantId = resolvedParams.tenantId ?? "";

  const balanceCandidate = resolvedParams.balance ?? "all";
  const balance = validBalances.includes(balanceCandidate as CustomerAccountBalanceState | "all")
    ? (balanceCandidate as CustomerAccountBalanceState | "all")
    : "all";

  try {
    const source = await getCustomerAccounts({
      query,
      balance,
      tenantId: tenantId.length > 0 ? tenantId : undefined
    });
    const rows = source.items;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">ERP · Customer Accounts</h2>
          <p className="text-sm text-gray-600">
            Current-account summary view from canonical .NET backend (append-only ledger foundation)
          </p>
        </div>

        <form className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-[1fr_200px_240px_auto]">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search customer, tenant, contact id, email or phone"
            className="h-10 rounded-md border border-line px-3"
          />
          <select name="balance" defaultValue={balance} className="h-10 rounded-md border border-line px-3">
            <option value="all">All balances</option>
            <option value="positive">Positive</option>
            <option value="zero">Zero</option>
            <option value="credit">Credit</option>
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
            "Customer",
            "Balance",
            "Currency",
            "Updated At",
            "Status"
          ]}
        >
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-600">
                No customer account found for current filters.
              </td>
            </tr>
          ) : (
            rows.map((account) => (
              <tr key={account.contactId}>
                <td className="px-4 py-3">
                  <p className="font-medium text-brand">
                    <Link href={(`/erp/customer-accounts/${account.contactId}` as Route)}>
                      {account.customerName}
                    </Link>
                  </p>
                  <p className="text-xs text-gray-500">{account.contactId}</p>
                  <p className="mt-1 text-xs text-gray-500">{account.tenantName}</p>
                </td>
                <td className="px-4 py-3 font-semibold">{account.balance}</td>
                <td className="px-4 py-3">{account.currency}</td>
                <td className="px-4 py-3 text-gray-600">{account.updatedAt}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${balanceBadgeClass(
                      account.balanceState
                    )}`}
                  >
                    {balanceLabel(account.balanceState)}
                  </span>
                </td>
              </tr>
            ))
          )}
        </DataTable>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">ERP · Customer Accounts</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load customer accounts: {toUiError(error)}
        </div>
      </div>
    );
  }
}
