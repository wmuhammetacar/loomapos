param(
    [ValidateSet("staging", "production")]
    [string]$Environment = "staging",
    [switch]$RequireStateBackend
)

$ErrorActionPreference = "Stop"

function Get-RequiredEnv([string]$Name) {
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Missing required environment variable: $Name"
    }

    return $value.Trim()
}

function Invoke-Aws([string[]]$Args) {
    $output = & aws @Args 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "AWS CLI command failed: aws $($Args -join ' ')`n$output"
    }
    return $output
}

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    throw "AWS CLI is required but not found."
}

$region = Get-RequiredEnv "AWS_REGION"

$identityJson = Invoke-Aws @("sts", "get-caller-identity", "--region", $region, "--output", "json")
$identity = $identityJson | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace([string]$identity.Account)) {
    throw "AWS identity lookup returned an empty account."
}

Write-Host "AWS identity verified for account $($identity.Account) in region $region."

if ($RequireStateBackend) {
    $bucket = Get-RequiredEnv "TF_STATE_BUCKET"
    $lockTable = Get-RequiredEnv "TF_STATE_LOCK_TABLE"

    Invoke-Aws @("s3api", "head-bucket", "--bucket", $bucket, "--region", $region) | Out-Null
    Write-Host "State bucket reachable: $bucket"

    Invoke-Aws @("dynamodb", "describe-table", "--table-name", $lockTable, "--region", $region, "--output", "json") | Out-Null
    Write-Host "State lock table reachable: $lockTable"
}

Write-Host "AWS access validation passed for '$Environment'."
