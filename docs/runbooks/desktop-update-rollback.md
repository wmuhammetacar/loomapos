# Desktop Update Rollback

1. Mark problematic version as `watch` or `blocked` in release metadata.
2. Update stable manifest to previous known-good version.
3. Publish notice for affected tenants and support.
4. Keep minimum supported version aligned so stores are not bricked while offline.
5. Track affected device cohort and rollback completion in incident record.
