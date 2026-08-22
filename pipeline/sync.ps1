# sync.ps1 — pull scored jobs from JobOps into career-ops for deep evaluation + outreach.
# Usage:  .\pipeline\sync.ps1                 (min score 70, statuses discovered,ready)
#         .\pipeline\sync.ps1 -MinScore 60
#         .\pipeline\sync.ps1 -DryRun

param(
  [int]$MinScore = 70,
  [string]$Status = 'discovered,ready',
  [switch]$DryRun
)

$root = Split-Path -Parent $PSScriptRoot
$args = @('pipeline\import-jobs.mjs', '--min-score', "$MinScore", '--status', $Status)
if ($DryRun) { $args += '--dry-run' }

Push-Location $root
node @args
Pop-Location
