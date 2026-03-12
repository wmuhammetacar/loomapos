param(
    [string]$Environment = "staging"
)

$requiredFiles = @(
    "infra/releases/compatibility-matrix.json",
    "infra/releases/mobile/version-policy.json",
    "infra/releases/desktop/stable-update-manifest.json",
    "docs/runbooks/failed-deployment-rollback.md",
    "docs/runbooks/backup-restore-validation.md"
)

foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        throw "Missing required ops artifact: $file"
    }
}

Write-Host "Smoke check foundation passed for environment '$Environment'."
