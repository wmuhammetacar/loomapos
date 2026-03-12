param(
    [ValidateSet("staging", "production")]
    [string]$Environment = "staging"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$file = Join-Path $root "infra\environments\secret-references.$Environment.example.json"
if (-not (Test-Path $file)) {
    throw "Secret reference file not found: $file"
}

$json = Get-Content -Path $file -Raw | ConvertFrom-Json
$properties = $json.PSObject.Properties
if ($properties.Count -eq 0) {
    throw "Secret reference file is empty: $file"
}

$expectedPrefix = "aws-sm://loomapos/$Environment/runtime"
$invalid = New-Object System.Collections.Generic.List[string]

foreach ($property in $properties) {
    $key = $property.Name
    $value = [string]$property.Value

    if ([string]::IsNullOrWhiteSpace($value)) {
        $invalid.Add("$key => (empty)")
        continue
    }

    if (-not $value.StartsWith("aws-sm://", [System.StringComparison]::OrdinalIgnoreCase)) {
        $invalid.Add("$key => $value (must use aws-sm://)")
        continue
    }

    if (-not $value.StartsWith($expectedPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        $invalid.Add("$key => $value (must start with $expectedPrefix)")
    }
}

if ($invalid.Count -gt 0) {
    $details = $invalid -join [Environment]::NewLine
    throw "Secret reference contract validation failed for '$Environment':`n$details"
}

Write-Host "Secret reference contract validation passed for '$Environment'."
