param(
  [switch]$KeepDesktop
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$logsDir = Join-Path $repoRoot ".runlogs"
$pidFile = Join-Path $logsDir "dev-all.pids.json"

function Stop-PidIfRunning {
  param(
    [Parameter(Mandatory = $true)][int]$ProcessId,
    [Parameter(Mandatory = $true)][string]$Label
  )

  if ($ProcessId -le 0) {
    return
  }

  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($null -ne $process) {
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped $Label (pid=$ProcessId)"
  }
}

function Should-SkipPidStop {
  param(
    [Parameter(Mandatory = $true)][int]$ProcessId
  )

  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($null -eq $process) {
    return $false
  }

  $protectedNames = @(
    "Docker Desktop",
    "com.docker.backend",
    "dockerd",
    "vmmemWSL"
  )

  return $protectedNames -contains $process.ProcessName
}

function Get-ListeningPidsByPort {
  param(
    [Parameter(Mandatory = $true)][int]$Port
  )

  $lines = netstat -ano -p tcp | Select-String "LISTENING" | Select-String ":$Port\s"
  $pids = @()

  foreach ($line in $lines) {
    if ($line.Line -match "\s+(\d+)\s*$") {
      $procId = [int]$Matches[1]
      if ($procId -gt 0) {
        $pids += $procId
      }
    }
  }

  return $pids | Sort-Object -Unique
}

if (Test-Path $pidFile) {
  $pidData = Get-Content -Path $pidFile -Raw | ConvertFrom-Json
  $entries = @()

  if ($pidData.started -is [System.Array]) {
    $entries = $pidData.started
  } elseif ($null -ne $pidData.started) {
    $entries = @($pidData.started)
  }

  foreach ($entry in $entries) {
    Stop-PidIfRunning -ProcessId ([int]$entry.pid) -Label $entry.name
  }

  Remove-Item $pidFile -Force
} else {
  Write-Host "No pid file found at $pidFile"
}

$ports = @(5000, 3100, 4200)
foreach ($port in $ports) {
  $portPids = Get-ListeningPidsByPort -Port $port
  foreach ($procId in $portPids) {
    if (Should-SkipPidStop -ProcessId $procId) {
      Write-Host "Skip protected process on port-$port (pid=$procId)"
      continue
    }

    Stop-PidIfRunning -ProcessId $procId -Label "port-$port"
  }
}

Get-Process -Name "dartvm", "flutter_tester", "flutter" -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-PidIfRunning -ProcessId $_.Id -Label $_.ProcessName }

if (-not $KeepDesktop) {
  Get-Process -Name "electron" -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-PidIfRunning -ProcessId $_.Id -Label "desktop-electron" }
}

Write-Host "dev:all processes stopped."
