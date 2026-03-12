# Queue Backlog Growth

1. Check queue depth, worker throughput, dead-letter trend, and tenant skew.
2. Determine whether backlog is global, tenant-specific, or integration-specific.
3. Apply fair-use throttles before scaling workers if one tenant is flooding the system.
4. Scale workers only after dependency health and DB headroom are verified.
5. If backlog affects billing, sync, or webhooks, link the correct provider-outage or integration runbook.
