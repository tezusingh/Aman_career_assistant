# start-all.ps1 — one-command launcher for the unified career pipeline.
#
#   1. JobOps           http://localhost:3005   (search 10+ boards, score, tailor, track)
#   2. career-ops web-ui http://localhost:4317   (deep evaluation, contacts, outreach drafts)
#
# Run the JobOps -> career-ops bridge any time with:  .\pipeline\sync.ps1
#
# Usage:  from d:\Aman_career_assistant  ->  .\pipeline\start-all.ps1

$ErrorActionPreference = 'Stop'
$root   = Split-Path -Parent $PSScriptRoot
$jobOps = Join-Path $root 'job-ops'
$webUi  = Join-Path $root 'career-ops\web-ui'
$logDir = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# --- 1. Docker engine + JobOps -------------------------------------------------
$dockerReady = $false
try { docker version --format '{{.Server.Version}}' *> $null; $dockerReady = ($LASTEXITCODE -eq 0) } catch { $dockerReady = $false }

if (-not $dockerReady) {
  Write-Host "Docker engine not running. Starting Docker Desktop..." -ForegroundColor Yellow
  $dd = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  if (Test-Path $dd) { Start-Process $dd }
  Write-Host "Waiting for Docker to come up (accept the first-run wizard if prompted)..." -ForegroundColor Yellow
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 5
    docker version --format '{{.Server.Version}}' *> $null
    if ($LASTEXITCODE -eq 0) { $dockerReady = $true; break }
  }
}

if ($dockerReady) {
  Write-Host "Docker is up. Starting JobOps (docker compose up -d)..." -ForegroundColor Green
  Push-Location $jobOps
  docker compose up -d
  Pop-Location
  Write-Host "JobOps:            http://localhost:3005" -ForegroundColor Cyan
} else {
  Write-Host "Docker still not ready — skipping JobOps. Start Docker Desktop, then re-run this script." -ForegroundColor Red
}

# --- 2. career-ops web-ui ------------------------------------------------------
Write-Host "Starting career-ops web-ui..." -ForegroundColor Green
$uiLog = Join-Path $logDir 'web-ui.log'
$uiProc = Start-Process node -ArgumentList 'server/index.mjs' -WorkingDirectory $webUi `
  -RedirectStandardOutput $uiLog -RedirectStandardError (Join-Path $logDir 'web-ui.err.log') `
  -PassThru -WindowStyle Hidden
$uiProc.Id | Out-File -FilePath (Join-Path $logDir 'web-ui.pid') -Encoding ascii
Write-Host "career-ops web-ui: http://localhost:4317   (PID $($uiProc.Id), logs in pipeline\logs)" -ForegroundColor Cyan

Write-Host "`nAll set. Stop everything with:  .\pipeline\stop-all.ps1" -ForegroundColor Green
