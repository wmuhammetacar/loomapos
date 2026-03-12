# Environment Strategy

- `local`: single-developer environment, sandbox providers, disposable data.
- `shared-development`: shared integration testing, masked seed data, sandbox providers only.
- `staging`: production-like topology, pre-release validation, no live customer traffic.
- `production`: live traffic, strict secret separation, audited access, live providers only.
- `dr-validation`: restore rehearsal and disaster-recovery checks, no customer writes.

Rules:
- Every environment uses separate secrets and provider mode.
- Production deploys require migration validation, smoke checks, and rollback notes.
- Staging receives every release candidate before production.
- DR validation is restore-first and never reused for feature testing.

Deploy notes:
- Keep committed files as `*.example` only. Real files should be created as `.env.staging` and `.env.production` on the target host.
- Keep secret references in `secret-references.<env>.json`; these map runtime keys to vault paths or external secret identifiers.
- `scripts/ops/render-runtime-env.ps1` merges `.env.<env>` with `secret-references.<env>.json` and emits `.env.runtime`.
- Secret values are read from process env keys:
- direct key, for example `ConnectionStrings__Postgres`
- or prefixed key, for example `LOOMAPOS_SECRET__CONNECTIONSTRINGS__POSTGRES`
- `infra/scripts/deploy-stack.sh` uses the render step, validates the merged config, then starts the stack.
- `scripts/ops/deploy-stack.ps1` provides the same flow for Windows-based operator environments.
- `.env.runtime` is ephemeral and should not be committed.
