param(
    [string]$Environment = "production",
    [switch]$ValidateOnly
)

$manifestFiles = @(
    "infra/releases/desktop/stable-update-manifest.json",
    "infra/releases/desktop/beta-update-manifest.json",
    "infra/releases/mobile/version-policy.json",
    "infra/releases/compatibility-matrix.json"
)

foreach ($file in $manifestFiles) {
    if (-not (Test-Path $file)) {
        throw "Release metadata missing: $file"
    }
}

if ($ValidateOnly) {
    Write-Host "Release metadata validated for '$Environment'."
    exit 0
}

Write-Host "Release metadata prepared for '$Environment'."
