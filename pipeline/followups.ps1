# followups.ps1 — who to chase today. Wrapper over pipeline/followups.mjs.
# Usage:  .\pipeline\followups.ps1
#         .\pipeline\followups.ps1 -Applied 7 -Responded 2
param(
  [int]$Applied,
  [int]$Responded,
  [int]$Interview,
  [int]$Evaluated
)
$root = Split-Path -Parent $PSScriptRoot
$a = @('pipeline\followups.mjs')
if ($PSBoundParameters.ContainsKey('Applied'))   { $a += @('--applied', "$Applied") }
if ($PSBoundParameters.ContainsKey('Responded')) { $a += @('--responded', "$Responded") }
if ($PSBoundParameters.ContainsKey('Interview')) { $a += @('--interview', "$Interview") }
if ($PSBoundParameters.ContainsKey('Evaluated')) { $a += @('--evaluated', "$Evaluated") }
Push-Location $root
node @a
Pop-Location
