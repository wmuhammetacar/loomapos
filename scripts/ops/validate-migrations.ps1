param()

$requiredFiles = @(
    "docs/phase10-production-readiness-layer.md",
    "docs/runbooks/db-migration-incident.md"
)

foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        throw "Migration readiness file missing: $file"
    }
}

Write-Host "Migration safety foundation is present."
