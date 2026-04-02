param(
    [string]$Environment = "production",
    [switch]$SkipLiveRestore,
    [string]$BackupFile,
    [string]$TargetDb = "loomapos_recovery_drill"
)

$requiredFiles = @(
    "docs/runbooks/backup-restore-validation.md",
    "infra/scripts/backup-postgres.sh",
    "infra/scripts/restore-postgres.sh",
    "infra/scripts/restore-drill-postgres.sh"
)

foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        throw "Restore validation artifact missing: $file"
    }
}

if ($SkipLiveRestore) {
    Write-Host "Restore validation artifacts present for '$Environment'. Live restore drill skipped by policy."
    exit 0
}

if (-not (Get-Command bash -ErrorAction SilentlyContinue)) {
    throw "bash is required to run restore drill: infra/scripts/restore-drill-postgres.sh"
}

if ($BackupFile) {
    $env:BACKUP_FILE = $BackupFile
}

$env:TARGET_DB = $TargetDb

Write-Host "Running restore drill for '$Environment' (TARGET_DB=$TargetDb)..."
& bash "infra/scripts/restore-drill-postgres.sh"
if ($LASTEXITCODE -ne 0) {
    throw "Restore drill failed with exit code $LASTEXITCODE"
}

Write-Host "Restore drill completed successfully for '$Environment'."
