param(
    [ValidateSet("staging", "production")]
    [string]$Environment = "staging",
    [switch]$RequireApplyGuard
)

$ErrorActionPreference = "Stop"

function Get-RequiredEnv([string]$Name) {
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Missing required environment variable: $Name"
    }

    return $value.Trim()
}

function Assert-Match([string]$Value, [string]$Pattern, [string]$FieldName) {
    if ($Value -notmatch $Pattern) {
        throw "Invalid value for ${FieldName}: '$Value'"
    }
}

$awsRegion = Get-RequiredEnv "AWS_REGION"
$oidcRoleArn = Get-RequiredEnv "AWS_OIDC_ROLE_ARN"
$stateBucket = Get-RequiredEnv "TF_STATE_BUCKET"
$stateLockTable = Get-RequiredEnv "TF_STATE_LOCK_TABLE"

Assert-Match -Value $awsRegion -Pattern "^[a-z]{2}-[a-z]+-\d+$" -FieldName "AWS_REGION"
Assert-Match -Value $oidcRoleArn -Pattern "^arn:aws:iam::\d{12}:role\/[A-Za-z0-9+=,.@_-]+$" -FieldName "AWS_OIDC_ROLE_ARN"
Assert-Match -Value $stateBucket -Pattern "^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$" -FieldName "TF_STATE_BUCKET"
Assert-Match -Value $stateLockTable -Pattern "^[A-Za-z0-9_.-]{3,255}$" -FieldName "TF_STATE_LOCK_TABLE"

if ($Environment -eq "production" -and $RequireApplyGuard) {
    $confirmation = Get-RequiredEnv "APPLY_CONFIRMATION"
    if ($confirmation -ne "apply-production") {
        throw "Production apply guard failed. APPLY_CONFIRMATION must be exactly 'apply-production'."
    }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$tfEnvPath = Join-Path $root "infra\iac\terraform\environments\$Environment"
$backendExample = Join-Path $tfEnvPath "backend.hcl.example"
$mainTf = Join-Path $tfEnvPath "main.tf"

if (-not (Test-Path $backendExample)) {
    throw "Missing terraform backend example for environment '$Environment': $backendExample"
}

if (-not (Test-Path $mainTf)) {
    throw "Missing terraform main.tf for environment '$Environment': $mainTf"
}

$secretRefPath = Join-Path $root "infra\environments\secret-references.$Environment.example.json"
if (-not (Test-Path $secretRefPath)) {
    throw "Missing secret references example for environment '$Environment': $secretRefPath"
}

$secretJson = Get-Content -Path $secretRefPath -Raw | ConvertFrom-Json
$requiredSecretKeys = @(
    "ConnectionStrings__Postgres",
    "ConnectionStrings__Redis",
    "Auth__Authority",
    "Auth__Audience"
)

foreach ($key in $requiredSecretKeys) {
    $value = $secretJson.$key
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Missing required secret reference key '$key' in $secretRefPath"
    }
    if ($value -notmatch "^aws-sm://") {
        throw "Secret reference '$key' must use aws-sm:// scheme. Current value: $value"
    }
}

Write-Host "AWS foundation input validation passed for '$Environment'."
