# stop-all.ps1 — stop the unified career pipeline (JobOps + career-ops web-ui).
# Usage:  from d:\Aman_career_assistant  ->  .\pipeline\stop-all.ps1

$root   = Split-Path -Parent $PSScriptRoot
$jobOps = Join-Path $root 'job-ops'
$pidFile = Join-Path $PSScriptRoot 'logs\web-ui.pid'

# --- career-ops web-ui ---
if (Test-Path $pidFile) {
  $procId = Get-Content $pidFile | Select-Object -First 1
  if ($procId) {
    try { Stop-Process -Id ([int]$procId) -Force -ErrorAction Stop; Write-Host "Stopped career-ops web-ui (PID $procId)." -ForegroundColor Green }
    catch { Write-Host "web-ui PID $procId not running." -ForegroundColor Yellow }
  }
  Remove-Item $pidFile -ErrorAction SilentlyContinue
} else {
  Write-Host "No web-ui PID file — is it running?" -ForegroundColor Yellow
}

# --- JobOps ---
try { docker version --format '{{.Server.Version}}' *> $null } catch {}
if ($LASTEXITCODE -eq 0) {
  Push-Location $jobOps
  docker compose down
  Pop-Location
  Write-Host "Stopped JobOps." -ForegroundColor Green
} else {
  Write-Host "Docker not running — JobOps already down." -ForegroundColor Yellow
}
