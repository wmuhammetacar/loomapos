# Phase 4 CI/CD - Production Deployment Setup

## Required GitHub Secrets

- `VPS_HOST`: production server IP or DNS (example: `91.98.165.133`)
- `VPS_USER`: SSH user (example: `root`)
- `VPS_SSH_KEY`: private key content for deployment user (never `.pub`)
- `REPO_DIR`: repository path on server (example: `/root/loomapos`)

## Required Server Preconditions

- Repository exists at `REPO_DIR` and tracks `origin/main`
- Docker + Docker Compose plugin installed and working
- Nginx reverse proxy is active for:
  - `loomapos.com`
  - `api.loomapos.com`
  - `ops.loomapos.com`
- `/root/deploy.sh` is symlinked to repo script on each deploy by workflow

## Deployment Flow

1. Push to `main`
2. GitHub Actions job `phase4-production-cicd` runs CI:
   - install deps
   - build web/ops/desktop/api
   - run tests
   - build docker images (`api`, `web`, `ops`)
3. If CI passes, deploy job connects via SSH
4. Server pulls latest `main`
5. `/root/deploy.sh` runs:
   - rolling `docker compose up -d --build`
   - fallback full recreate (`docker compose down` + `up -d --build`)
   - health check (`https://api.loomapos.com/health/live`)
   - rollback to previous commit if health fails

## Security Notes

- Use SSH key authentication only.
- Disable SSH password login on production host.
- Keep all internal ports localhost-bound in compose files.
- Store secrets only in GitHub Secrets.
