# Feature Flag Emergency Disable

1. Confirm customer impact and affected tenant or cohort.
2. Identify whether the flag is plan-wide, tenant-specific, or release-bridging.
3. Disable the smallest possible scope first.
4. Record actor, reason, and expected rollback condition in ops audit.
5. Re-check stale config cache invalidation after the flag change.
