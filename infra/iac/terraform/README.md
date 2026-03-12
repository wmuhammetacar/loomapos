# Terraform Foundation

This repository keeps a provider-agnostic Terraform layout for future managed deployment.

Current module:
- `modules/loomapos-stack`: environment policy bundle with release channel, secret references, retention, rate-limit and SLO targets.

Planned managed modules:
- `network`
- `database`
- `cache`
- `object-storage`
- `observability`
- `app-services`
- `secrets`

Expected environments:
- `shared-development`
- `staging`
- `production`
- `dr-validation`

Usage pattern:
1. Configure remote state per environment.
2. Inject provider credentials from secret manager only.
3. Apply additive infrastructure changes before app rollout.
4. Publish deployment metadata back to `/internal/admin/ops`.

Backend config:
- Use `scripts/ops/render-terraform-backend.ps1` to generate environment backend config from:
- `TF_STATE_BUCKET`
- `TF_STATE_LOCK_TABLE`
- `AWS_REGION`

Policy inputs:
- `secret_reference_map` keeps vault/object references, never plaintext secrets.
- `retention_policy` defines log/webhook/backup retention baselines.
- `rate_limit_policy` defines API and sync fairness limits.
- `slo_targets` captures environment SLO expectations as IaC data.
