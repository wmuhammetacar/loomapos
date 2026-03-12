param(
    [ValidateSet("staging", "production")]
    [string]$Environment = "production",
    [switch]$AllowPlaceholderSecrets
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$runtimeEnv = Join-Path $root "infra\environments\.env.runtime"

& (Join-Path $PSScriptRoot "render-runtime-env.ps1") -Environment $Environment -OutputPath "infra/environments/.env.runtime" -AllowPlaceholderSecrets:$AllowPlaceholderSecrets
try {
    Push-Location $root
    docker compose `
        -f "infra/docker-compose.yml" `
        -f "infra/deploy/docker-compose.apps.yml" `
        -f "infra/deploy/docker-compose.$Environment.yml" `
        config | Out-Null

    docker compose `
        -f "infra/docker-compose.yml" `
        -f "infra/deploy/docker-compose.apps.yml" `
        -f "infra/deploy/docker-compose.$Environment.yml" `
        up -d --build
}
finally {
    Pop-Location
    Remove-Item $runtimeEnv -Force -ErrorAction SilentlyContinue
}
