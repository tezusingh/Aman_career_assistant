# funnel.ps1 — show your search->interview funnel. Wrapper over pipeline/funnel.mjs.
# Usage:  .\pipeline\funnel.ps1
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
node 'pipeline\funnel.mjs'
Pop-Location
