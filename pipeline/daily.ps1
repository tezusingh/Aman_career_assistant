# daily.ps1 — one command for the whole candidate-side flow.
# Runs: import scored jobs -> outreach worksheets -> follow-ups -> funnel.
# Usage:  .\pipeline\daily.ps1
#         .\pipeline\daily.ps1 -MinScore 65
#         .\pipeline\daily.ps1 -NoImport
param(
  [int]$MinScore = 70,
  [switch]$NoImport
)
$root = Split-Path -Parent $PSScriptRoot
$a = @('pipeline\daily.mjs', '--min-score', "$MinScore")
if ($NoImport) { $a += '--no-import' }
Push-Location $root
node @a
Pop-Location
