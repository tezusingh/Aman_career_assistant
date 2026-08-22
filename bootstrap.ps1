# bootstrap.ps1 — one-time setup on a fresh machine (Windows / PowerShell).
# Run from the repo root:  .\bootstrap.ps1
#
# It will:
#   1. Create local .env files from templates (if missing) — you paste keys after.
#   2. Install Node dependencies for career-ops and its web-ui.
#   3. Tell you what to do next (keys + Docker + launch).
# JobOps runs via Docker on the target machine; this script does not need Docker.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

function Copy-EnvIfMissing($template, $dest) {
  if (Test-Path $dest) {
    Write-Host "  kept existing $dest" -ForegroundColor DarkGray
  } else {
    Copy-Item $template $dest
    Write-Host "  created $dest (paste your keys)" -ForegroundColor Green
  }
}

Write-Host "== 1/3  Local env files ==" -ForegroundColor Cyan
Copy-EnvIfMissing (Join-Path $root 'setup\env\career-ops.env.template') (Join-Path $root 'career-ops\.env')
Copy-EnvIfMissing (Join-Path $root 'setup\env\job-ops.env.template')    (Join-Path $root 'job-ops\.env')

Write-Host "== 2/3  Installing Node dependencies ==" -ForegroundColor Cyan
Push-Location (Join-Path $root 'career-ops');        npm install; Pop-Location
Push-Location (Join-Path $root 'career-ops\web-ui'); npm install; Pop-Location

Write-Host "== 3/3  Next steps ==" -ForegroundColor Cyan
Write-Host @"

  1. Paste your API keys into:
       career-ops\.env      (ANTHROPIC_API_KEY and/or OPENAI_API_KEY)
       job-ops\.env         (same keys)
  2. Put your real resume into  career-ops\cv.md  and edit  career-ops\config\profile.yml
  3. (JobOps) On a machine WITH Docker + virtualization:
       cd job-ops ; docker compose up -d      ->  http://localhost:3005
  4. Launch everything:
       .\pipeline\start-all.ps1
  5. Pull JobOps' scored jobs into career-ops any time:
       .\pipeline\sync.ps1 -MinScore 70

"@ -ForegroundColor Gray
Write-Host "Bootstrap complete." -ForegroundColor Green
