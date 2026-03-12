param(
  [switch]$SkipMobile
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$logsDir = Join-Path $repoRoot ".runlogs"
$pidFile = Join-Path $logsDir "dev-all.pids.json"

New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

function Test-HttpEndpoint {
  param(
    [Parameter(Mandatory = $true)][string]$Url
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
  } catch {
    return $false
  }
}

function Wait-Endpoint {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSec = 45
  )

  $start = Get-Date
  while (((Get-Date) - $start).TotalSeconds -lt $TimeoutSec) {
    if (Test-HttpEndpoint -Url $Url) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }

  return $false
}

function Start-LoggedCmd {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$WorkDir,
    [Parameter(Mandatory = $true)][string]$CmdLine
  )

  $stdoutLog = Join-Path $logsDir "$Name.out.log"
  $stderrLog = Join-Path $logsDir "$Name.err.log"

  if (Test-Path $stdoutLog) { Remove-Item $stdoutLog -Force }
  if (Test-Path $stderrLog) { Remove-Item $stderrLog -Force }

  $process = Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList "/c", $CmdLine `
    -WorkingDirectory $WorkDir `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog

  return [pscustomobject]@{
    name = $Name
    pid = $process.Id
    stdout = $stdoutLog
    stderr = $stderrLog
  }
}

$started = @()

$apiDir = Join-Path $repoRoot "apps\api"
$apiHealth = "http://127.0.0.1:5000/health"

if (Test-HttpEndpoint -Url $apiHealth) {
  Write-Host "[api] already running at $apiHealth"
} else {
  $apiCommand = 'set "ASPNETCORE_ENVIRONMENT=Development" && set "Auth__DisableAuth=true" && set "Hangfire__Enabled=false" && dotnet run --project src\LoomaPos.Api\LoomaPos.Api.csproj --urls http://127.0.0.1:5000'
  $apiProc = Start-LoggedCmd -Name "api" -WorkDir $apiDir -CmdLine $apiCommand
  $started += $apiProc

  if (Wait-Endpoint -Url $apiHealth -TimeoutSec 45) {
    Write-Host "[api] started at $apiHealth (pid=$($apiProc.pid))"
  } else {
    Write-Warning "[api] did not become healthy in time. Check $($apiProc.stderr)"
  }
}

$webDir = Join-Path $repoRoot "apps\web-admin"
$webLogin = "http://127.0.0.1:3100/login"

if (Test-HttpEndpoint -Url $webLogin) {
  Write-Host "[web] already running at $webLogin"
} else {
  $webCommand = 'set "NEXT_PUBLIC_AUTH_MODE=mock" && set "NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:5000" && npm run dev -- --hostname 127.0.0.1 --port 3100'
  $webProc = Start-LoggedCmd -Name "web-admin" -WorkDir $webDir -CmdLine $webCommand
  $started += $webProc

  if (Wait-Endpoint -Url $webLogin -TimeoutSec 60) {
    Write-Host "[web] started at http://127.0.0.1:3100 (pid=$($webProc.pid))"
  } else {
    Write-Warning "[web] did not become ready in time. Check $($webProc.stderr)"
  }
}

$desktopDir = Join-Path $repoRoot "apps\desktop-pos"
$electronProc = Get-Process -Name "electron" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($null -ne $electronProc) {
  Write-Host "[desktop] already running (electron pid=$($electronProc.Id))"
} else {
  if (-not (Test-Path (Join-Path $desktopDir "dist\main\index.js"))) {
    Write-Host "[desktop] build artifacts missing, running npm run build..."
    Push-Location $desktopDir
    try {
      cmd /c "npm run build"
    } finally {
      Pop-Location
    }
  }

  $desktopCommand = 'set "ELECTRON_RUN_AS_NODE=" && npm run start'
  $desktopProc = Start-LoggedCmd -Name "desktop-pos" -WorkDir $desktopDir -CmdLine $desktopCommand
  $started += $desktopProc

  Start-Sleep -Seconds 4
  $electronReady = Get-Process -Name "electron" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -ne $electronReady) {
    Write-Host "[desktop] started (electron pid=$($electronReady.Id))"
  } else {
    Write-Warning "[desktop] not detected. Check $($desktopProc.stderr)"
  }
}

if (-not $SkipMobile) {
  $flutterRunner = $null
  $flutterCommand = Get-Command flutter -ErrorAction SilentlyContinue
  $flutterFromPuroPath = Join-Path $env:USERPROFILE ".puro\envs\stable\flutter\bin\flutter.bat"
  $mobileServeScript = Join-Path $repoRoot "scripts\serve-static.cjs"

  if (Test-Path $flutterFromPuroPath) {
    $flutterRunner = $flutterFromPuroPath
  } elseif ($null -ne $flutterCommand) {
    $flutterRunner = "flutter"
  }

  if ($null -eq $flutterRunner) {
    Write-Warning "[mobile] Flutter is not installed or not on PATH. Mobile app was skipped."
  } else {
    $mobileDir = Join-Path $repoRoot "apps\mobile"
    $mobileUrl = "http://127.0.0.1:4200"

    if (Test-HttpEndpoint -Url $mobileUrl) {
      Write-Host "[mobile] already running at $mobileUrl"
    } else {
      $mobileBuildIndex = Join-Path $mobileDir "build\web\index.html"
      if (Test-Path $mobileBuildIndex) {
        $mobileCommand = "node `"$mobileServeScript`" `"$mobileDir\build\web`" 4200 127.0.0.1"
      } else {
        $mobileCommand = "`"$flutterRunner`" pub get && `"$flutterRunner`" build web --release && node `"$mobileServeScript`" `"$mobileDir\build\web`" 4200 127.0.0.1"
      }
      $mobileProc = Start-LoggedCmd -Name "mobile" -WorkDir $mobileDir -CmdLine $mobileCommand
      $started += $mobileProc

      if (Wait-Endpoint -Url $mobileUrl -TimeoutSec 240) {
        Write-Host "[mobile] started at $mobileUrl (pid=$($mobileProc.pid))"
      } else {
        Write-Warning "[mobile] did not become ready in time. Check $($mobileProc.stderr)"
      }
    }
  }
} else {
  Write-Host "[mobile] skipped by option."
}

[pscustomobject]@{
  generatedAt = (Get-Date).ToString("o")
  started = $started
} | ConvertTo-Json -Depth 4 | Set-Content -Path $pidFile -Encoding UTF8

Write-Host ""
Write-Host "Live endpoints:"
Write-Host "  API: http://127.0.0.1:5000/swagger"
Write-Host "  Web: http://127.0.0.1:3100"
Write-Host "Logs:"
Write-Host "  $logsDir"
Write-Host "Stop command:"
Write-Host "  npm run dev:all:stop"
