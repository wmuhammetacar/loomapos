# Certificate Rotation

1. Verify current certificate expiry alerts and impacted endpoints.
2. Rotate secrets in secret manager before updating edge/load balancer config.
3. Deploy certificate change first to staging, then production.
4. Run smoke checks for webhook endpoints, public API, and portal login flows.
5. Confirm expiry horizon in admin security dashboard.
