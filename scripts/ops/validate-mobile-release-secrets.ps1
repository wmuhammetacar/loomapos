param(
  [switch]$RequireAndroid,
  [switch]$RequireIos
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-Env([string]$Name) {
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required environment variable: $Name"
  }
}

if (-not $RequireAndroid -and -not $RequireIos) {
  throw "At least one target must be required. Use -RequireAndroid and/or -RequireIos."
}

if ($RequireAndroid) {
  Assert-Env "ANDROID_KEYSTORE_BASE64"
  Assert-Env "ANDROID_KEY_ALIAS"
  Assert-Env "ANDROID_KEY_PASSWORD"
  Assert-Env "ANDROID_STORE_PASSWORD"
}

if ($RequireIos) {
  Assert-Env "IOS_APP_STORE_CONNECT_ISSUER_ID"
  Assert-Env "IOS_APP_STORE_CONNECT_KEY_ID"
  Assert-Env "IOS_APP_STORE_CONNECT_PRIVATE_KEY_BASE64"
}

Write-Host "Mobile release secret validation passed."
