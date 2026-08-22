# outreach.ps1 — generate per-job outreach worksheets. Wrapper over pipeline/outreach.mjs.
# Usage:  .\pipeline\outreach.ps1            (all pending jobs)
#         .\pipeline\outreach.ps1 -Limit 10
param(
  [int]$Limit = 0,
  [string]$Out
)
$root = Split-Path -Parent $PSScriptRoot
$a = @('pipeline\outreach.mjs')
if ($Limit -gt 0) { $a += @('--limit', "$Limit") }
if ($Out)         { $a += @('--out', $Out) }
Push-Location $root
node @a
Pop-Location
