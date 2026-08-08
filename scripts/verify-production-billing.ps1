param(
  [string]$BaseUrl = "https://shuimg.cn",
  [string]$SessionToken = $env:SHUBAO_CANARY_SESSION_TOKEN
)

$ErrorActionPreference = "Stop"
$verifier = Join-Path $PSScriptRoot "verify-production-billing.mjs"

$previousSessionToken = $env:SHUBAO_CANARY_SESSION_TOKEN
try {
  $env:SHUBAO_CANARY_SESSION_TOKEN = $SessionToken
  & node $verifier --base-url $BaseUrl
  if ($LASTEXITCODE -ne 0) { throw "Production verification failed" }
} finally {
  if ($null -eq $previousSessionToken) {
    Remove-Item Env:SHUBAO_CANARY_SESSION_TOKEN -ErrorAction SilentlyContinue
  } else {
    $env:SHUBAO_CANARY_SESSION_TOKEN = $previousSessionToken
  }
}
