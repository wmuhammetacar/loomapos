import type { CheckoutStatus } from "@prisma/client";

export type CheckoutCompletionDecision = "claim" | "already_paid" | "in_progress" | "reclaim_stale" | "not_completable";

export function resolveCheckoutCompletionDecision(params: {
  status: CheckoutStatus;
  processingStartedAt: Date | null;
  now: Date;
  staleAfterMs: number;
}): CheckoutCompletionDecision {
  if (params.status === "paid") {
    return "already_paid";
  }

  if (params.status === "pending" || params.status === "failed") {
    return "claim";
  }

  if (params.status === "processing") {
    if (!params.processingStartedAt) {
      return "reclaim_stale";
    }

    const isStale = params.now.getTime() - params.processingStartedAt.getTime() > params.staleAfterMs;
    return isStale ? "reclaim_stale" : "in_progress";
  }

  return "not_completable";
}

