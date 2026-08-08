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
$previousSessionToken = $env:SHUBAO_CANARY_SESSION_TOKEN
try {
  $env:SHUBAO_CANARY_SESSION_TOKEN = $SessionToken
  & node $verifier --base-url $BaseUrl --fixture-path $FixturePath
  if ($LASTEXITCODE -ne 0) { throw "Ecommerce production verification failed" }
} finally {
  if ($null -eq $previousSessionToken) {
    Remove-Item Env:SHUBAO_CANARY_SESSION_TOKEN -ErrorAction SilentlyContinue
  } else {
    $env:SHUBAO_CANARY_SESSION_TOKEN = $previousSessionToken
  }
}
