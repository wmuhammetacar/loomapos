# Phase 10 Production Readiness Layer

## 1) Architecture summary

- Production model separates `local`, `shared-development`, `staging`, `production`, and `dr-validation`.
- Services are treated as immutable deployable artifacts: API, web-admin, workers, analytics/integration jobs, desktop release metadata, mobile version policy.
- Internal admin now includes production ops visibility for deployments, backups, incidents, runbooks, SLOs, capacity, dependency health, and rate-limit posture.
- Operational truth stays in Desktop/Mobile and backend systems of record; Phase 10 adds deployment, recovery, and safety layers around them.

## 2) Environment and deployment model

- `local`: developer productivity, disposable data, sandbox providers.
- `shared-development`: shared integration testing, masked or seeded data only.
- `staging`: pre-production verification, smoke tests, migration validation, sandbox external providers.
- `production`: live traffic, audited access, live providers, restricted secrets.
- `dr-validation`: restore and failover rehearsal environment.

Deployment topology:
- Containerized API and web workloads.
- Separate scaling path for workers and async processors.
- Managed or isolated DB/cache/object storage expected in production.
- CDN and release metadata for Desktop/Mobile distribution.

## 3) IaC / CI-CD / release strategy

- GitHub Actions foundations now cover CI, deploy, backup, restore validation, and release metadata publication.
- GitHub Actions foundations now also include AWS OIDC Terraform plan/apply workflows with remote backend rendering.
- AWS Terraform plan/apply workflows now run strict preflight input checks (`validate-aws-foundation-inputs.ps1`) before terraform steps.
- AWS Terraform workflows now also validate live caller identity and remote backend reachability (`validate-aws-access.ps1`) immediately after OIDC credential setup.
- Secret reference contracts are now validated per environment (`validate-secret-reference-contract.ps1`) to prevent staging/production secret path drift.
- Terraform workflows now generate plan JSON/summary artifacts and apply is guarded by configurable change thresholds plus optional destroy-block (`terraform-plan-guard.ps1`).
- Environment-specific compose overlays exist for staging and production.
- Terraform folder structure is introduced as provider-agnostic IaC foundation.
- Terraform module now stores an explicit ops policy bundle (secret refs, retention, rate limits, SLO targets) instead of a no-op shell.
- Release metadata lives in `infra/releases` with compatibility matrix and client version policy.
- Prometheus alert rules and Terraform environment/module scaffolds were added for observability and reproducible infrastructure direction.
- Runtime environment rendering is secret-reference aware and supports strict deploy-time secret resolution.

## 4) Migration / backup / restore / DR strategy

- Migration safety uses additive-first approach, CI validation, and rollback-by-mitigation policy.
- Backup strategy includes region, retention, and restore validation concepts.
- Restore is treated as a periodic tested procedure, not a theoretical control.
- Runbooks cover failed deployment rollback, migration incident, queue backlog, certificate rotation, backup restore validation, and desktop update rollback.
- Additional runbooks cover provider outage response and feature-flag emergency disable.
- AWS OIDC and Secrets bootstrap runbook added for cloud and secret-manager operational readiness.
- Infra apply safeguards now include explicit production confirmation phrase (`apply-production`) on workflow dispatch.

## 5) Observability / alerting / SLO strategy

- Existing OTEL, Prometheus, Grafana, Loki, and Tempo stack remains the base.
- Phase 10 adds structured ops entities for alerts, incidents, SLOs, dependency status, capacity snapshots, and ops audit.
- Admin ops dashboard surfaces release state, incidents, backups, and fairness/rate-limit posture.

## 6) Desktop / Mobile release and compatibility strategy

- Desktop update manifests are channel-based and versioned.
- Mobile version policy is served separately from store binaries.
- Mobile app now includes Android+iOS platform scaffold and Android release-signing validation guard (`validateReleaseSigning`) with explicit debug-sign override gate (`LOOMAPOS_ALLOW_DEBUG_SIGNING`).
- Mobile release pipeline now includes secret-gated signing/bootstrap scripts (`validate-mobile-release-secrets.ps1`, `bootstrap-mobile-signing.ps1`) and a dedicated workflow (`.github/workflows/mobile-release.yml`) for signed Android artifacts and iOS metadata validation.
- Compatibility matrix defines minimum supported Desktop and Mobile versions against backend release windows.
- Rollback and forced-upgrade policy are represented as release metadata foundations.

## 7) Security / secret / rate-limit strategy

- Secrets remain environment-specific and externalized; secret references are modeled explicitly.
- Deploy scripts now render `.env.runtime` from environment configs plus secret references, and can enforce secret value presence.
- Public/internal abuse controls rely on rate-limit policies, audit, and abuse flags.
- Admin ops data is internal-only and still guarded by internal-role headers in current scaffold.
- Next hardening step is persistent internal auth and approval workflow persistence.

## 8) Scaling / performance / multi-tenant isolation strategy

- Tenant-keyed caches, fair-use rate limits, and queue fairness are explicit policy surfaces.
- Background integration, analytics, and sync workloads must scale independently from API/web paths.
- Noisy-neighbor protection is modeled through rate-limit policies, abuse flags, and capacity snapshots.

## 9) Incident / runbook / ops strategy

- Incident severity, owner, category, linked runbook, and timeline are first-class records.
- Runbooks are versioned markdown assets and intended to be linked from alerts and admin surfaces.
- Backup restore validation, release rollback, and migration recovery are documented as repeatable procedures.

## 10) Implementation checklist

- [x] Environment strategy documented.
- [x] Staging and production deploy overlays added.
- [x] CI / deploy / backup / restore-validation workflows expanded.
- [x] Release metadata and compatibility manifests added.
- [x] Migration safety and restore scripts scaffolded.
- [x] Internal admin ops views added.
- [x] Ops data model foundation added.
- [x] Runbook set added.

## 11) Scaffold code / config / pipeline foundations

- Backend ops models: `apps/api/src/LoomaPos.Domain/Ops/ProductionOpsEntities.cs`
- Backend ops endpoints: `apps/api/src/LoomaPos.Api/Endpoints/ProductionOpsEndpoints.cs`
- Backend ops read model: `apps/api/src/LoomaPos.Api/Ops/ProductionOpsReadModelService.cs`
- Web ops UI: `apps/web-admin/components/admin/ops-panels.tsx`
- Web ops data service: `apps/web-admin/lib/ops-service.ts`
- Pipelines: `.github/workflows/ci.yml`, `.github/workflows/deploy-vps.yml`, `.github/workflows/db-backup.yml`, `.github/workflows/release-train.yml`, `.github/workflows/restore-validation.yml`
- Deploy/runtime scripts: `scripts/ops/render-runtime-env.ps1`, `scripts/ops/deploy-stack.ps1`, `scripts/ops/validate-deploy-foundation.ps1`, `infra/scripts/deploy-stack.sh`
- Release/config foundations: `infra/releases`, `infra/environments`, `infra/deploy/docker-compose.staging.yml`, `infra/deploy/docker-compose.production.yml`, `infra/observability/prometheus/alerts/loomapos-alerts.yml`, `infra/iac/terraform`
- Runbooks: `docs/runbooks/*.md`
