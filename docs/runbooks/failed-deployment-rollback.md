# Failed Deployment Rollback

1. Confirm blast radius from admin ops dashboard and alert stream.
2. Freeze non-essential admin interventions.
3. Compare deployment record, migration run, and latest smoke-check result.
4. If schema is backward compatible, roll services back to previous release channel manifest.
5. If schema is not backward compatible, disable affected feature flags and run mitigation path from migration runbook.
6. Publish incident notice and update release marker.
7. Capture rollback result in incident timeline and ops audit log.
