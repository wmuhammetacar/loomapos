import type { PaymentStatus, WebhookEventStatus } from "@prisma/client";

export function canProcessWebhookEvent(status: WebhookEventStatus) {
  return status === "received" || status === "failed";
}

export function nextPaymentStatus(current: PaymentStatus, incoming: PaymentStatus): PaymentStatus {
  // Never regress a succeeded payment back to failed/refunded in webhook retries.
  if (current === "succeeded" && incoming !== "succeeded") {
    return current;
  }

  return incoming;
}

