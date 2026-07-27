param(
  [string]$BaseUrl = "https://shuimg.cn",
  [string]$SessionToken = $env:SHUBAO_CANARY_SESSION_TOKEN
)

$ErrorActionPreference = "Stop"
$verifier = Join-Path $PSScriptRoot "verify-production-billing.mjs"

& node $verifier --base-url $BaseUrl --session-token $SessionToken
if ($LASTEXITCODE -ne 0) { throw "Production verification failed" }
