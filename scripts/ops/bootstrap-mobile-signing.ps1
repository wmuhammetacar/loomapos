param(
  [string]$MobileRoot = "apps/mobile"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Require-Env([string]$Name) {
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required environment variable: $Name"
  }
  return $value
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$mobilePath = Join-Path $root $MobileRoot
if (-not (Test-Path $mobilePath)) {
  throw "Mobile root not found: $mobilePath"
}

$keystoreBase64 = Require-Env "ANDROID_KEYSTORE_BASE64"
$keyAlias = Require-Env "ANDROID_KEY_ALIAS"
$keyPassword = Require-Env "ANDROID_KEY_PASSWORD"
$storePassword = Require-Env "ANDROID_STORE_PASSWORD"

$androidRoot = Join-Path $mobilePath "android"
$keystoreDir = Join-Path $androidRoot "keystore"
$keystorePath = Join-Path $keystoreDir "loomapos-release.jks"
$keyPropertiesPath = Join-Path $androidRoot "key.properties"

New-Item -ItemType Directory -Force -Path $keystoreDir | Out-Null

[byte[]]$bytes = [Convert]::FromBase64String($keystoreBase64)
[IO.File]::WriteAllBytes($keystorePath, $bytes)

$storeFileValue = "keystore/loomapos-release.jks"
$content = @(
  "storePassword=$storePassword"
  "keyPassword=$keyPassword"
  "keyAlias=$keyAlias"
  "storeFile=$storeFileValue"
) -join [Environment]::NewLine

Set-Content -Path $keyPropertiesPath -Value $content -Encoding ascii
Write-Host "Android signing files materialized at $androidRoot"
