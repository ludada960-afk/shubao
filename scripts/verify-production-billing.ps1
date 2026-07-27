param(
  [string]$BaseUrl = "https://shuimg.cn",
  [string]$SessionToken = $env:SHUBAO_CANARY_SESSION_TOKEN
)

$ErrorActionPreference = "Stop"

function Get-Json([string]$Path, [hashtable]$Headers = @{}) {
  return Invoke-RestMethod -Method Get -Uri "$BaseUrl$Path" -Headers $Headers -TimeoutSec 20
}

function Post-Json([string]$Path, [object]$Body, [hashtable]$Headers = @{}) {
  return Invoke-RestMethod -Method Post -Uri "$BaseUrl$Path" -Headers $Headers `
    -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 8 -Compress) -TimeoutSec 20
}

$homeResponse = Invoke-WebRequest -UseBasicParsing -Uri $BaseUrl -TimeoutSec 20
if ($homeResponse.StatusCode -ne 200) { throw "Homepage returned $($homeResponse.StatusCode)" }

$health = Get-Json "/health"
if ($health.ok -ne $true -and $health.status -notin @("ok", "healthy")) { throw "Health endpoint is not ready" }
if ($null -eq $health.imageQueue) { throw "Health endpoint has no imageQueue state" }

$catalog = Get-Json "/api/billing/catalog"
if (-not $catalog.products) { throw "Billing catalog has no products" }
$enabledProviders = @($catalog.providers | Where-Object { $_.enabled -eq $true })
if ($enabledProviders.Count -gt 0) { throw "Production catalog exposes an enabled payment provider" }

if ($SessionToken) {
  $headers = @{ Authorization = "Bearer $SessionToken" }
  $balanceBefore = Get-Json "/api/billing/balance" $headers
  if ($balanceBefore.unlimited -ne $true) { throw "Canary owner is not unlimited" }
  $quoteResponse = Post-Json "/api/billing/quote" @{ sku = "ec_reverse_prompt"; quantity = 1 } $headers
  $quote = $quoteResponse.quote
  if (-not $quote.quoteId -or $quote.totalUnits -ne 200) { throw "Billing quote response is invalid" }
  $balanceAfter = Get-Json "/api/billing/balance" $headers
  if (($balanceBefore | ConvertTo-Json -Depth 8 -Compress) -ne ($balanceAfter | ConvertTo-Json -Depth 8 -Compress)) {
    throw "Balance changed after quote-only request"
  }
} else {
  Write-Warning "SessionToken not supplied; owner unlimited check skipped"
}

Write-Host "Production verification passed for $BaseUrl"
