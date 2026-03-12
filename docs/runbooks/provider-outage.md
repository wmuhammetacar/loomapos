# Provider Outage Response

1. Identify affected provider domain: payment, e-invoice, messaging, or webhook destination.
2. Mark dependency state as degraded and suppress non-essential retries if they amplify failure.
3. Confirm core POS operations remain local-first and unaffected.
4. Inform support and publish targeted notice if customer-facing delay is likely.
5. Resume queued jobs gradually after provider recovery and monitor duplicate/idempotency safeguards.
