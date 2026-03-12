param(
    [ValidateSet("staging", "production")]
    [string]$Environment = "staging"
)

$ErrorActionPreference = "Stop"

$requiredFiles = @(
    "infra/docker-compose.yml",
    "infra/deploy/docker-compose.apps.yml",
    "infra/deploy/docker-compose.$Environment.yml",
    "infra/environments/.env.$Environment.example",
    "infra/environments/secret-references.$Environment.example.json",
    "infra/iac/terraform/environments/$Environment/main.tf",
    "infra/iac/terraform/environments/$Environment/backend.hcl.example",
    "infra/iac/terraform/modules/loomapos-stack/main.tf",
    "infra/iac/terraform/modules/loomapos-stack/variables.tf",
    "scripts/ops/render-runtime-env.ps1",
    "scripts/ops/validate-secret-reference-contract.ps1",
    "scripts/ops/terraform-plan-guard.ps1",
    "scripts/ops/deploy-stack.ps1",
    "scripts/ops/render-terraform-backend.ps1",
    ".github/workflows/infra-aws-plan.yml",
    ".github/workflows/infra-aws-apply.yml"
)

foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        throw "Missing deploy foundation file: $file"
    }
}

Write-Host "Deploy foundation validated for '$Environment'."
