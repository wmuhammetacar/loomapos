import { DataTable } from "@/components/data-table";
import { getSubscriptions, toUiError } from "@/lib/api";
import type { TenantLifecycleState } from "@/types";

function lifecycleBadge(state: TenantLifecycleState) {
  if (state === "trial_active") {
    return "bg-brand/10 text-brand";
  }
  if (state === "trial_expiring") {
    return "bg-warning/10 text-warning";
  }
  if (state === "subscription_active") {
    return "bg-success/10 text-success";
  }
  if (state === "subscription_past_due") {
    return "bg-warning/10 text-warning";
  }
  return "bg-danger/10 text-danger";
}

function lifecycleLabel(state: TenantLifecycleState) {
  switch (state) {
    case "trial_active":
      return "Deneme aktif";
    case "trial_expiring":
      return "Deneme bitmek uzere";
    case "trial_expired":
      return "Deneme bitti / salt-okunur";
    case "subscription_past_due":
      return "Odeme gecikmis";
    case "subscription_canceled":
      return "Abonelik iptal";
    case "suspended_blocked":
      return "Askida / bloklu";
    default:
      return "Abonelik aktif";
  }
}

export default async function SubscriptionsPage() {
  try {
    const source = await getSubscriptions();

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Subscriptions</h2>
          <p className="text-sm text-gray-600">Billing state and renewal visibility</p>
        </div>

        {source.connection !== "connected" ? (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            {source.message ?? "Subscription data is partially connected."}
          </div>
        ) : null}

        <DataTable headers={["Tenant", "Plan", "Billing", "Renewal", "Status", "Lifecycle"]}>
          {source.items.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-600">
                No subscription rows returned.
              </td>
            </tr>
          ) : (
            source.items.map((subscription) => (
              <tr key={subscription.id}>
                <td className="px-4 py-3 font-medium">{subscription.tenantName}</td>
                <td className="px-4 py-3 uppercase">{subscription.plan}</td>
                <td className="px-4 py-3">{subscription.billingCycle}</td>
                <td className="px-4 py-3 text-gray-600">{subscription.renewalDate ?? "-"}</td>
                <td className="px-4 py-3">{subscription.status}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${lifecycleBadge(
                      subscription.lifecycleState
                    )}`}
                  >
                    {lifecycleLabel(subscription.lifecycleState)}
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
        <h2 className="text-2xl font-semibold">Subscriptions</h2>
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Failed to load subscriptions: {toUiError(error)}
        </div>
      </div>
    );
  }
}
