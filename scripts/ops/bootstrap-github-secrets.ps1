param(
    [Parameter(Mandatory = $true)]
    [string]$Repo, # org/repo
    [Parameter(Mandatory = $true)]
    [string]$AwsOidcRoleArn,
    [Parameter(Mandatory = $true)]
    [string]$AwsRegion,
    [Parameter(Mandatory = $true)]
    [string]$TfStateBucket,
    [Parameter(Mandatory = $true)]
    [string]$TfStateLockTable
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI (gh) is required."
}

& gh secret set AWS_OIDC_ROLE_ARN --repo $Repo --body $AwsOidcRoleArn
if ($LASTEXITCODE -ne 0) { throw "Failed setting AWS_OIDC_ROLE_ARN" }

& gh secret set AWS_REGION --repo $Repo --body $AwsRegion
if ($LASTEXITCODE -ne 0) { throw "Failed setting AWS_REGION" }

& gh secret set TF_STATE_BUCKET --repo $Repo --body $TfStateBucket
if ($LASTEXITCODE -ne 0) { throw "Failed setting TF_STATE_BUCKET" }

& gh secret set TF_STATE_LOCK_TABLE --repo $Repo --body $TfStateLockTable
if ($LASTEXITCODE -ne 0) { throw "Failed setting TF_STATE_LOCK_TABLE" }

Write-Host "GitHub Action secrets updated for $Repo."
