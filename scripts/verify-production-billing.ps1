param(
  [string]$BaseUrl = "https://shuimg.cn",
  [string]$SessionToken = $env:SHUBAO_CANARY_SESSION_TOKEN,
  [switch]$AllowEmptyBalance
)

$ErrorActionPreference = "Stop"
$verifier = Join-Path $PSScriptRoot "verify-production-billing.mjs"

$previousSessionToken = $env:SHUBAO_CANARY_SESSION_TOKEN
try {
  $env:SHUBAO_CANARY_SESSION_TOKEN = $SessionToken
  $arguments = @('--base-url', $BaseUrl)
  if ($AllowEmptyBalance) { $arguments += '--allow-empty-balance' }
  & node $verifier @arguments
  if ($LASTEXITCODE -ne 0) { throw "Production verification failed" }
} finally {
  if ($null -eq $previousSessionToken) {
    Remove-Item Env:SHUBAO_CANARY_SESSION_TOKEN -ErrorAction SilentlyContinue
  } else {
    $env:SHUBAO_CANARY_SESSION_TOKEN = $previousSessionToken
  }
}
