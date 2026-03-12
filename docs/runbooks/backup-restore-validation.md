# Backup Restore Validation

1. Identify latest successful backup artifact and retention window.
2. Restore into isolated validation environment only.
3. Verify schema version, migration head, sample tenant reads, and object storage references.
4. Record RTO and RPO achieved for the exercise.
5. Fail the validation if backups are unreadable, incomplete, or incompatible with current restore docs.
6. Publish findings to internal ops dashboard and alert if validation failed.
