# Database Migration Incident

1. Stop automatic rollout to remaining environments.
2. Inspect migration run status, verification summary, and post-migration smoke output.
3. Determine whether mitigation is additive rollback, feature-flag disable, or emergency hotfix.
4. Protect tenant writes if data corruption risk exists.
5. Run scoped data verification queries and compare against backup restore point.
6. If needed, trigger restore rehearsal before any destructive recovery.
7. Log all decisions in incident timeline and postmortem notes.
