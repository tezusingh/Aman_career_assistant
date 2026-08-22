# ats-check.ps1 — pre-apply ATS keyword gate. Wrapper over pipeline/ats-check.mjs.
# Usage:  .\pipeline\ats-check.ps1 -Jd .\jds\some-job.txt
#         .\pipeline\ats-check.ps1 -JdText "We want a Senior Go engineer..." -Top 25
param(
  [string]$Jd,
  [string]$JdText,
  [string]$Cv,
  [int]$Top = 20
)
$root = Split-Path -Parent $PSScriptRoot
$a = @('pipeline\ats-check.mjs', '--top', "$Top")
if ($Jd)     { $a += @('--jd', $Jd) }
if ($JdText) { $a += @('--jd-text', $JdText) }
if ($Cv)     { $a += @('--cv', $Cv) }
Push-Location $root
node @a
Pop-Location
