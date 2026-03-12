param(
    [ValidateSet("staging", "production")]
    [string]$Environment = "production",
    [string]$OutputPath = "infra/environments/.env.runtime",
    [switch]$AllowPlaceholderSecrets
)

$ErrorActionPreference = "Stop"

function Read-KeyValueFile([string]$Path) {
    $map = [ordered]@{}
    foreach ($line in Get-Content -Path $Path) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) {
            continue
        }

        $parts = $trimmed -split "=", 2
        if ($parts.Count -ne 2) {
            continue
        }

        $map[$parts[0].Trim()] = $parts[1].Trim()
    }

    return $map
}

function Read-JsonMap([string]$Path) {
    $raw = Get-Content -Path $Path -Raw
    $parsed = ConvertFrom-Json -InputObject $raw
    $map = [ordered]@{}

    foreach ($property in $parsed.PSObject.Properties) {
        $map[$property.Name] = [string]$property.Value
    }

    return $map
}

function Normalize-SecretKey([string]$Key) {
    return ($Key -replace "[^A-Za-z0-9_]", "_").ToUpperInvariant()
}

function Resolve-AwsSecretReference([string]$Reference) {
    if (-not $Reference.StartsWith("aws-sm://", [System.StringComparison]::OrdinalIgnoreCase)) {
        return $null
    }

    $raw = $Reference.Substring("aws-sm://".Length)
    if ([string]::IsNullOrWhiteSpace($raw)) {
        throw "Invalid aws-sm secret reference: $Reference"
    }

    $secretId = $raw
    $jsonKey = $null
    if ($raw.Contains("?")) {
        $parts = $raw -split "\?", 2
        $secretId = $parts[0]
        $query = $parts[1]
        foreach ($segment in ($query -split "&")) {
            $kv = $segment -split "=", 2
            if ($kv.Count -eq 2 -and $kv[0] -eq "key") {
                $jsonKey = [uri]::UnescapeDataString($kv[1])
            }
        }
    }

    $awsCmd = Get-Command aws -ErrorAction SilentlyContinue
    if ($null -eq $awsCmd) {
        return $null
    }

    $secretString = (& aws secretsmanager get-secret-value --secret-id $secretId --query SecretString --output text 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($secretString)) {
        return $null
    }

    if ([string]::IsNullOrWhiteSpace($jsonKey)) {
        return $secretString.Trim()
    }

    try {
        $parsed = ConvertFrom-Json -InputObject $secretString
        foreach ($property in $parsed.PSObject.Properties) {
            if ($property.Name -eq $jsonKey) {
                return [string]$property.Value
            }
        }
    }
    catch {
        return $null
    }

    return $null
}

function Resolve-SecretFromReference([string]$Reference) {
    if ($Reference.StartsWith("env://", [System.StringComparison]::OrdinalIgnoreCase)) {
        $envKey = $Reference.Substring("env://".Length)
        if ([string]::IsNullOrWhiteSpace($envKey)) {
            return $null
        }

        $value = [Environment]::GetEnvironmentVariable($envKey)
        if ([string]::IsNullOrWhiteSpace($value)) {
            return $null
        }

        return $value.Trim()
    }

    return Resolve-AwsSecretReference $Reference
}

function Resolve-SecretValue([string]$Key) {
    $direct = [Environment]::GetEnvironmentVariable($Key)
    if (-not [string]::IsNullOrWhiteSpace($direct)) {
        return $direct.Trim()
    }

    $prefixed = [Environment]::GetEnvironmentVariable("LOOMAPOS_SECRET__$(Normalize-SecretKey $Key)")
    if (-not [string]::IsNullOrWhiteSpace($prefixed)) {
        return $prefixed.Trim()
    }

    return $null
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envFile = Join-Path $root "infra\environments\.env.$Environment"
$envExampleFile = Join-Path $root "infra\environments\.env.$Environment.example"
$secretRefFile = Join-Path $root "infra\environments\secret-references.$Environment.json"
$secretRefExampleFile = Join-Path $root "infra\environments\secret-references.$Environment.example.json"
$outputFile = Join-Path $root $OutputPath

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExampleFile) {
        $envFile = $envExampleFile
    }
    else {
        throw "Missing environment file: $envFile"
    }
}

if (-not (Test-Path $secretRefFile)) {
    if (Test-Path $secretRefExampleFile) {
        $secretRefFile = $secretRefExampleFile
    }
    else {
        throw "Missing secret reference file: $secretRefFile"
    }
}

$values = Read-KeyValueFile $envFile
$secretRefs = Read-JsonMap $secretRefFile

$requiredSecretKeys = @(
    "ConnectionStrings__Postgres",
    "ConnectionStrings__Redis",
    "Auth__Authority",
    "Auth__Audience"
)

foreach ($key in $requiredSecretKeys) {
    if (-not $secretRefs.Contains($key)) {
        throw "Missing secret reference for '$key' in $secretRefFile"
    }
}

$lines = New-Object System.Collections.Generic.List[string]
$placeholderSecretsUsed = $false
foreach ($entry in $values.GetEnumerator()) {
    $lines.Add("$($entry.Key)=$($entry.Value)")
}

foreach ($entry in $secretRefs.GetEnumerator()) {
    if ([string]::IsNullOrWhiteSpace($entry.Value)) {
        throw "Secret reference '$($entry.Key)' is empty."
    }

    $resolved = Resolve-SecretValue $entry.Key
    if (-not [string]::IsNullOrWhiteSpace($resolved)) {
        $lines.Add("$($entry.Key)=$resolved")
        continue
    }

    $resolvedFromReference = Resolve-SecretFromReference $entry.Value
    if (-not [string]::IsNullOrWhiteSpace($resolvedFromReference)) {
        $lines.Add("$($entry.Key)=$resolvedFromReference")
        continue
    }

    if ($AllowPlaceholderSecrets) {
        $lines.Add("$($entry.Key)=__SECRET_REF__$($entry.Value)")
        $placeholderSecretsUsed = $true
        continue
    }

    throw "Missing secret value for '$($entry.Key)'. Set env '$($entry.Key)' or 'LOOMAPOS_SECRET__$(Normalize-SecretKey $entry.Key)'."
}

$lines.Add("Ops__AllowPlaceholderSecrets=$($placeholderSecretsUsed.ToString().ToLowerInvariant())")

$directory = Split-Path -Path $outputFile -Parent
if (-not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory | Out-Null
}

Set-Content -Path $outputFile -Value $lines -Encoding ascii
Write-Host "Runtime env rendered to '$outputFile' for '$Environment'."
