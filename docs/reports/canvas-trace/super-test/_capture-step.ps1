param(
  [Parameter(Mandatory=$true)][string]$Step,
  [Parameter(Mandatory=$true)][string]$Site,
  [Parameter(Mandatory=$true)][string]$Action,
  [string]$Notes = "",
  [string]$EvalJs = ""
)

$time = Get-Date -Format "HH:mm:ss"
$base = "F:/da/shubao/.worktrees/codex-ecommerce-stability"
$shotPath = "$base/docs/reports/canvas-shots/super-test/$Site/$Step.png"
$tracePath = "$base/docs/reports/canvas-trace/super-test/$Site/$Step.json"

Write-Host "[$time] step=$Step site=$Site action=$Action"

# 1) snapshot
$snapshot = browse snapshot 2>&1 | Out-String
$shotOk = $false
try { browse screenshot -p $shotPath 2>&1 | Out-Null; $shotOk = $true } catch {}

# 2) eval dom state
$domJs = "JSON.stringify({url: location.href, title: document.title, scrollY: window.scrollY, scrollX: window.scrollX, vw: window.innerWidth, vh: window.innerHeight, readyState: document.readyState, activeElement: document.activeElement ? (document.activeElement.tagName) : null, bodyClass: document.body.className, refCount: document.querySelectorAll('[data-ref]').length})"
$domEval = browse eval $domJs 2>&1 | Out-String

# 3) eval custom
$extraEval = ""
if ($EvalJs -ne "") {
  $extraEval = browse eval $EvalJs 2>&1 | Out-String
}

# 4) network
$net = browse network 2>&1 | Out-String
$netShort = ($net.Substring(0, [Math]::Min(4000, $net.Length)))

# assemble
$result = [pscustomobject]@{
  step      = $Step
  site      = $Site
  action    = $Action
  notes     = $Notes
  time      = $time
  shotPath  = $shotPath
  shotOk    = $shotOk
  domEval   = $domEval
  extraEval = $extraEval
  snapshot  = $snapshot.Substring(0, [Math]::Min(8000, $snapshot.Length))
  net       = $netShort
}
$result | ConvertTo-Json -Depth 6 -Compress | Out-File -FilePath $tracePath -Encoding UTF8
Write-Host "  saved: $tracePath"
