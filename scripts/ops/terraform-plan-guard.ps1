param(
    [Parameter(Mandatory = $true)]
    [string]$PlanJsonPath,
    [string]$SummaryOutputPath = "",
    [int]$MaxTotalChanges = 0,
    [switch]$AllowDestroy
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $PlanJsonPath)) {
    throw "Plan json file not found: $PlanJsonPath"
}

$raw = Get-Content -Path $PlanJsonPath -Raw
$plan = ConvertFrom-Json -InputObject $raw
$changes = @($plan.resource_changes)

$createCount = 0
$updateCount = 0
$deleteCount = 0
$replaceCount = 0

foreach ($change in $changes) {
    $actions = @($change.change.actions)
    if ($actions.Count -eq 0) {
        continue
    }

    $hasCreate = $actions -contains "create"
    $hasDelete = $actions -contains "delete"
    $hasUpdate = $actions -contains "update"

    if ($hasCreate -and $hasDelete) {
        $replaceCount += 1
        continue
    }
    if ($hasCreate) {
        $createCount += 1
        continue
    }
    if ($hasDelete) {
        $deleteCount += 1
        continue
    }
    if ($hasUpdate) {
        $updateCount += 1
        continue
    }
}

$destroyImpact = $deleteCount + $replaceCount
$totalChanges = $createCount + $updateCount + $deleteCount + $replaceCount

if ($MaxTotalChanges -gt 0 -and $totalChanges -gt $MaxTotalChanges) {
    throw "Plan change count $totalChanges exceeds MaxTotalChanges=$MaxTotalChanges"
}

if (-not $AllowDestroy -and $destroyImpact -gt 0) {
    throw "Plan includes destroy impact (delete + replace): $destroyImpact. Set AllowDestroy to bypass."
}

$summary = @"
# Terraform Plan Summary

- Total changes: $totalChanges
- Create: $createCount
- Update: $updateCount
- Delete: $deleteCount
- Replace: $replaceCount
- Destroy impact (delete + replace): $destroyImpact
"@

if ([string]::IsNullOrWhiteSpace($SummaryOutputPath)) {
    Write-Output $summary
}
else {
    $summaryDirectory = Split-Path -Path $SummaryOutputPath -Parent
    if (-not [string]::IsNullOrWhiteSpace($summaryDirectory) -and -not (Test-Path $summaryDirectory)) {
        New-Item -ItemType Directory -Path $summaryDirectory | Out-Null
    }
    Set-Content -Path $SummaryOutputPath -Value $summary -Encoding utf8
    Write-Host "Terraform plan summary written to '$SummaryOutputPath'."
}
