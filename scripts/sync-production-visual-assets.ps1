param(
  [string[]]$CaseId = @(),
  [string]$AuditDir = (Join-Path $PSScriptRoot '..\.tmp\production-visual-cases'),
  [string]$DestinationDir = (Join-Path $PSScriptRoot '..\public\images\visual-recipes\cases'),
  [string]$HostName = '43.129.180.134',
  [string]$User = 'ubuntu',
  [string]$KeyPath = "$env:USERPROFILE\.ssh\shubao_deploy_ed25519",
  [string]$RemoteAssetDir = '/home/ubuntu/shubao/server/generated-assets'
)

$ErrorActionPreference = 'Stop'

$CaseId = @($CaseId | ForEach-Object { [string]$_ -split ',' } | Where-Object { $_ })

if (-not (Test-Path -LiteralPath $AuditDir -PathType Container)) {
  throw "Audit directory does not exist: $AuditDir"
}

New-Item -ItemType Directory -Path $DestinationDir -Force | Out-Null

$audits = if ($CaseId.Count) {
  $CaseId | ForEach-Object {
    $path = Join-Path $AuditDir "$_.json"
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing audit file: $path" }
    Get-Item -LiteralPath $path
  }
} else {
  Get-ChildItem -LiteralPath $AuditDir -Filter '*.json' -File
}

$scpOptions = @(
  '-i', $KeyPath,
  '-o', 'BatchMode=yes',
  '-o', 'StrictHostKeyChecking=accept-new',
  '-o', 'ConnectTimeout=15'
)

foreach ($auditFile in $audits) {
  $audit = Get-Content -LiteralPath $auditFile.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
  $caseName = [string]$audit.case.id
  $stableUrl = [string]$audit.stableUrl
  if (-not $caseName -or $stableUrl -notmatch '/([a-f0-9]{64})\.png$') {
    throw "Audit does not contain a stable hashed PNG: $($auditFile.FullName)"
  }

  $expectedHash = $Matches[1]
  $destination = Join-Path $DestinationDir "$caseName.png"
  $temporary = "$destination.download"
  Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue

  & scp @scpOptions "${User}@${HostName}:$RemoteAssetDir/$expectedHash.png" $temporary
  if ($LASTEXITCODE -ne 0) { throw "Failed to download production asset for $caseName" }

  $actualHash = (Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -ne $expectedHash) {
    Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue
    throw "Hash mismatch for ${caseName}: expected $expectedHash, received $actualHash"
  }

  Move-Item -LiteralPath $temporary -Destination $destination -Force
  [pscustomobject]@{
    CaseId = $caseName
    Sha256 = $actualHash
    Bytes = (Get-Item -LiteralPath $destination).Length
    Destination = $destination
  }
}
