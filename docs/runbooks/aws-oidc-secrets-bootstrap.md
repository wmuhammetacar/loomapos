# AWS OIDC and Secrets Bootstrap

## Purpose

Prepare production-grade AWS access and secret resolution for LoomaPOS deploy workflows.

## Fastest path (automated)

Run once from the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ops\bootstrap-aws-foundation.ps1 `
  -AwsRegion eu-central-1 `
  -GitHubOrg YOUR_ORG `
  -GitHubRepo YOUR_REPO
```

Then set GitHub secrets automatically:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ops\bootstrap-github-secrets.ps1 `
  -Repo "YOUR_ORG/YOUR_REPO" `
  -AwsOidcRoleArn "ROLE_ARN_FROM_BOOTSTRAP_OUTPUT" `
  -AwsRegion "eu-central-1" `
  -TfStateBucket "loomapos-terraform-state" `
  -TfStateLockTable "loomapos-terraform-locks"
```

## Required AWS resources

1. IAM OIDC provider for GitHub Actions.
2. IAM role assumed by GitHub (`AWS_OIDC_ROLE_ARN`) with least-privilege permissions.
3. AWS Secrets Manager secrets:
- `loomapos/staging/runtime`
- `loomapos/production/runtime`

Each secret should store a JSON object with keys like:
- `ConnectionStrings__Postgres`
- `ConnectionStrings__Redis`
- `Auth__Authority`
- `Auth__Audience`
- `Payments__Stripe__ApiKey`
- `Messaging__Smtp__Password`

## GitHub repository secrets

- `AWS_OIDC_ROLE_ARN`
- `AWS_REGION`
- `TF_STATE_BUCKET`
- `TF_STATE_LOCK_TABLE`

## IAM policy baseline (minimum)

- `secretsmanager:GetSecretValue` for `loomapos/*/runtime`
- Terraform backend permissions (if remote state is used)
- Target infrastructure read/plan permissions

## Validation steps

1. Run preflight locally (optional but recommended):
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ops\validate-aws-foundation-inputs.ps1 -Environment staging
powershell -ExecutionPolicy Bypass -File .\scripts\ops\validate-secret-reference-contract.ps1 -Environment staging
```
2. Validate AWS identity and remote state access (optional local):
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ops\validate-aws-access.ps1 -Environment staging -RequireStateBackend
```
3. Trigger workflow `.github/workflows/infra-aws-plan.yml` for `staging`.
4. Confirm AWS access validation, backend render, Terraform `init`, and `plan` complete successfully.
5. Run deploy workflow and ensure `render-runtime-env.ps1` resolves AWS secret references without placeholders.
6. Verify API startup passes runtime secret guard.
7. Trigger `.github/workflows/infra-aws-apply.yml`:
   - For `staging`: regular dispatch.
   - For `production`: set `apply_confirmation=apply-production` (mandatory guard).
   - For `production`: workflow must run from `main` branch (`refs/heads/main`) or apply is blocked.
   - Review generated terraform plan summary in step summary/artifacts.
   - Use `max_total_changes` threshold to block unexpectedly large applies.
   - Keep `allow_destroy=false` unless a reviewed change window explicitly allows destructive operations.

## Rollback posture

- If secret resolution fails, deployment must stop before service startup.
- Do not bypass by enabling placeholder secrets in production.
