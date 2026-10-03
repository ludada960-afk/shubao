# Mainland-China reachability probe for the Nano Banana upstream gateway.
#
# WHY THIS EXISTS
#   The vendor migrated their console to platform.change2pro.com and their docs
#   advertise gateway.change2pro.com as the new API base. Measured from a mainland
#   host on 2026-10-03, that host is NOT reachable. Every change2pro.com name
#   tested resolves to a dead or hijacked IP, while the forkc2p.com family works.
#   Picking a gateway by reading docs alone would have taken production down.
#
# WHAT IT DOES
#   Talks straight to IP:443 so neither DNS nor a local VPN/proxy can mask the
#   result -- that is the whole point, since a browser "it opens fine" test is
#   worthless on a machine with a system proxy enabled.
#
# USAGE
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-cn-gateway-reach.ps1
#   Run it on the machine that will actually make the calls (ideally production).
#
# NOTE: ASCII only on purpose. PowerShell 5.1 reads BOM-less files as ANSI and
# a single CJK character will corrupt the string literals.
#
# VERDICT RULES
#   TCP-FAIL          -> IP unreachable from here. Do not use this gateway.
#   TCP-OK + bad CN   -> DNS points at the wrong place (classic poisoning).
#   TCP-OK + good CN  -> reachable.

param([int]$TimeoutMs = 6000)

$targets = @(
  @{ name = 'gateway.change2pro.com (NEW official)'; host = 'gateway.change2pro.com'; ip = '128.242.240.91' },
  @{ name = 'api.change2pro.com (OLD, known bad)';    host = 'api.change2pro.com';    ip = '69.171.227.37' },
  @{ name = 'api.forkc2p.com (domestic endpoint)';     host = 'api.forkc2p.com';       ip = '206.82.6.10' },
  @{ name = 'shuimg.cn (own site, control)';           host = 'shuimg.cn';             ip = '114.132.157.250' }
)

function Test-Tcp443 {
  param([string]$Ip, [int]$TimeoutMs = 6000)
  $client = New-Object System.Net.Sockets.TcpClient
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $task = $client.ConnectAsync($Ip, 443)
    if (-not $task.Wait($TimeoutMs)) {
      return @{ ok = $false; ms = $sw.ElapsedMilliseconds; err = "TCP connect timeout ${TimeoutMs}ms" }
    }
    return @{ ok = $true; ms = $sw.ElapsedMilliseconds; err = '' }
  } catch {
    return @{ ok = $false; ms = $sw.ElapsedMilliseconds; err = $_.Exception.GetBaseException().Message }
  } finally { $client.Close() }
}

function Test-TlsCn {
  param([string]$HostName, [int]$TimeoutMs = 8000)
  try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $task = $tcp.ConnectAsync($HostName, 443)
    if (-not $task.Wait($TimeoutMs)) { $tcp.Close(); return 'TLS timeout' }
    $ssl = New-Object System.Net.Security.SslStream($tcp.GetStream(), $false, { $true })
    $ssl.AuthenticateAsClient($HostName)
    $cn = $ssl.RemoteCertificate.Subject
    $ssl.Close(); $tcp.Close()
    return $cn
  } catch { return ('TLS fail: ' + $_.Exception.GetBaseException().Message) }
}

Write-Output '=== 1) raw TCP 443 (DNS and proxy bypassed) ==='
$results = @{}
foreach ($t in $targets) {
  $r = Test-Tcp443 -Ip $t.ip -TimeoutMs $TimeoutMs
  $results[$t.host] = $r
  if ($r.ok) { $v = 'TCP-OK  ' } else { $v = 'TCP-FAIL' }
  Write-Output ('{0}  {1,-36} {2,-16} {3,6}ms  {4}' -f $v, $t.name, $t.ip, $r.ms, $r.err)
}

Write-Output ''
Write-Output '=== 2) TLS handshake + cert subject ==='
foreach ($t in $targets) {
  if ($results[$t.host].ok) {
    Write-Output ('{0,-36} {1}' -f $t.name, (Test-TlsCn -HostName $t.host))
  } else {
    Write-Output ('{0,-36} (TCP failed, skipped)' -f $t.name)
  }
}

Write-Output ''
Write-Output '=== 3) verdict ==='
$domestic = $results['api.forkc2p.com']
$official = $results['gateway.change2pro.com']
if ($domestic.ok -and -not $official.ok) {
  Write-Output 'KEEP api.forkc2p.com as NANO_BANANA_BASE_URL. The documented official host is unreachable here.'
} elseif ($official.ok -and $domestic.ok) {
  Write-Output 'Both reachable. Re-check with GET {base}/v1/usage (read-only) before switching.'
} elseif (-not $official.ok) {
  Write-Output ('gateway.change2pro.com NOT reachable: ' + $official.err)
  Write-Output '  -> Set NANO_BANANA_BASE_URL=https://api.forkc2p.com (env only, do not edit code default).'
} else {
  Write-Output 'UNEXPECTED: the domestic endpoint failed too. Investigate local network before trusting any verdict.'
}
