param(
  [string]$BaseUrl = "https://shuimg.cn",
  [string]$SessionToken = $env:SHUBAO_CANARY_SESSION_TOKEN,
  [string]$FixturePath = (Join-Path $PSScriptRoot "..\test_image.png")
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($SessionToken)) {
  throw "SHUBAO_CANARY_SESSION_TOKEN is required for authenticated ecommerce production verification"
}
if (-not (Test-Path -LiteralPath $FixturePath -PathType Leaf)) {
  throw "Ecommerce canary fixture is missing: $FixturePath"
}

$verifier = Join-Path $PSScriptRoot "verify-production-ecommerce.mjs"
& node $verifier --base-url $BaseUrl --session-token $SessionToken --fixture-path $FixturePath
if ($LASTEXITCODE -ne 0) { throw "Ecommerce production verification failed" }
