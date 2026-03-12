param(
  [switch]$RequirePlatforms
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$mobileRoot = Join-Path $root "apps\mobile"
$required = @(
  "pubspec.yaml",
  "android\app\build.gradle.kts",
  "android\key.properties.example",
  "ios\Runner\Info.plist"
)

foreach ($item in $required) {
  $path = Join-Path $mobileRoot $item
  if (-not (Test-Path $path)) {
    throw "Mobile release foundation missing: $item"
  }
}

$gradle = Get-Content (Join-Path $mobileRoot "android\app\build.gradle.kts") -Raw
if ($gradle -notmatch "validateReleaseSigning") {
  throw "android/app/build.gradle.kts icinde validateReleaseSigning task'i bulunamadi."
}

if ($gradle -notmatch "LOOMAPOS_ALLOW_DEBUG_SIGNING") {
  throw "android/app/build.gradle.kts icinde LOOMAPOS_ALLOW_DEBUG_SIGNING guard'i bulunamadi."
}

if ($RequirePlatforms) {
  $platforms = @("android", "ios")
  foreach ($platform in $platforms) {
    if (-not (Test-Path (Join-Path $mobileRoot $platform))) {
      throw "Platform klasoru eksik: $platform"
    }
  }
}

Write-Host "Mobile release foundation validation passed."
