param(
    [ValidateSet("staging", "production")]
    [string]$Environment = "staging",
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = "infra/iac/terraform/environments/$Environment/backend.hcl"
}

function Get-RequiredEnv([string]$Name) {
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Missing required environment variable: $Name"
    }

    return $value.Trim()
}

$bucket = Get-RequiredEnv "TF_STATE_BUCKET"
$region = Get-RequiredEnv "AWS_REGION"
$lockTable = Get-RequiredEnv "TF_STATE_LOCK_TABLE"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$outputFile = Join-Path $root $OutputPath
$stateKey = "$Environment/terraform.tfstate"

$lines = @(
    "bucket         = `"$bucket`"",
    "key            = `"$stateKey`"",
    "region         = `"$region`"",
    "dynamodb_table = `"$lockTable`"",
    "encrypt        = true"
)

$directory = Split-Path -Path $outputFile -Parent
if (-not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory | Out-Null
}

Set-Content -Path $outputFile -Value $lines -Encoding ascii
Write-Host "Terraform backend config rendered to '$outputFile'."
