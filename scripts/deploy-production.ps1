param(
  [string]$HostName = "43.129.180.134",
  [string]$User = "ubuntu",
  [string]$KeyPath = "$env:USERPROFILE\.ssh\shubao_deploy_ed25519",
  [string]$RemoteDir = "/home/ubuntu/shubao",
  [string]$WebRoot = "/var/www/shubao/assets",
  [string]$RepoPath = (Join-Path $PSScriptRoot ".."),
  [ValidateRange(0, 3600)]
  [int]$CanarySeconds = 600
)

$ErrorActionPreference = "Stop"

function Invoke-CheckedNative {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command,
    [Parameter(Mandatory = $true)]
    [string]$FailureMessage
  )
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "$FailureMessage (exit code $LASTEXITCODE)" }
}

if ([string]::IsNullOrWhiteSpace($env:SHUBAO_CANARY_SESSION_TOKEN)) {
  throw "SHUBAO_CANARY_SESSION_TOKEN is required for authenticated production deployment"
}
$repo = (Resolve-Path $RepoPath).Path
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$commit = ((& git -C $repo rev-parse --short HEAD) -join "").Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($commit)) {
  throw "Could not resolve the release commit"
}
$archive = Join-Path $env:TEMP "shubao-deploy-$commit-$stamp.tgz"
$target = "$User@$HostName"
$ssh = @(
  "-i", $KeyPath,
  "-o", "BatchMode=yes",
  "-o", "StrictHostKeyChecking=accept-new",
  "-o", "ConnectTimeout=15",
  "-o", "ConnectionAttempts=5",
  "-o", "ServerAliveInterval=15",
  "-o", "ServerAliveCountMax=3"
)
$remoteLock = "/tmp/.shubao-deploy.lock"
$databaseBackupHelper = Join-Path $PSScriptRoot "backup-runtime-db.cjs"
$runtimeConfigHelper = Join-Path $PSScriptRoot "verify-runtime-config.cjs"
$runtimeConfigUpdater = Join-Path $PSScriptRoot "configure-runtime-gateways.cjs"
$gatewayProbe = Join-Path $PSScriptRoot "probe-production-gateways.mjs"
$remoteRuntimeHelperDir = "/tmp/shubao-runtime-tools-$stamp"
$remoteDatabaseBackupHelper = "$remoteRuntimeHelperDir/backup-runtime-db.cjs"
$remoteRuntimeConfigHelper = "$remoteRuntimeHelperDir/verify-runtime-config.cjs"
$remoteRuntimeConfigUpdater = "$remoteRuntimeHelperDir/configure-runtime-gateways.cjs"
$remoteReleaseArchive = "$remoteRuntimeHelperDir/$(Split-Path $archive -Leaf)"
$remoteRuntimeConfigBackup = "/tmp/shubao-runtime-config-backup-$stamp"
$lockAcquired = $false
$remoteBackup = ""
$releaseStarted = $false
$runtimeConfigTouched = $false
$runtimeConfigBackupCreated = $false
$deploymentSucceeded = $false

function Get-RemotePm2ProcessId {
  $remotePid = ((& ssh @ssh $target "pm2 pid shubao") -join "").Trim()
  if ($LASTEXITCODE -ne 0 -or $remotePid -notmatch '^\d+$' -or [int64]$remotePid -le 0) {
    throw "Could not read the shubao PM2 process id"
  }
  return [int64]$remotePid
}

$hasImageGatewayKey = -not [string]::IsNullOrWhiteSpace($env:SHUBAO_IMAGE_API_KEY)
$hasVisionGatewayKey = -not [string]::IsNullOrWhiteSpace($env:SHUBAO_VISION_API_KEY)
if ($hasImageGatewayKey -xor $hasVisionGatewayKey) {
  throw "SHUBAO_IMAGE_API_KEY and SHUBAO_VISION_API_KEY must be provided together"
}
if ($hasImageGatewayKey -and $hasVisionGatewayKey) {
  & node $gatewayProbe --validate-only
  if ($LASTEXITCODE -ne 0) { throw "Production gateway credential format validation failed" }
}

Write-Host "Building $commit..."
Push-Location $repo
try {
  Invoke-CheckedNative -FailureMessage "Test suite failed" -Command { npm run test }
  Invoke-CheckedNative -FailureMessage "Production build failed" -Command { npm run build }
  Invoke-CheckedNative -FailureMessage "Git whitespace validation failed" -Command { git diff --check }
} finally {
  Pop-Location
}

if ($hasImageGatewayKey -and $hasVisionGatewayKey) {
  & node $gatewayProbe
  if ($LASTEXITCODE -ne 0) { throw "Authenticated production gateway probe failed" }
}

if (Test-Path $archive) { Remove-Item -LiteralPath $archive -Force }
tar -czf $archive -C $repo `
  --exclude='server/works.db' `
  --exclude='server/works.db-shm' `
  --exclude='server/works.db-wal' `
  --exclude='server/works.json' `
  --exclude='server/users.json' `
  --exclude='server/bookmarklet_store.json' `
  --exclude='server/backups' `
  --exclude='server/cache_img' `
  --exclude='server/cache_overlay' `
  --exclude='server/extension_downloads' `
  --exclude='server/extension_tasks' `
  --exclude='server/uploads' `
  --exclude='server/generated-assets' `
  --exclude='server/temp_uploads' `
  --exclude='server/node_modules' `
  --exclude='server/.env' `
  --exclude='server/.auth-session-secret' `
  --exclude='dist/stitched' `
  dist server package.json package-lock.json ecosystem.config.cjs
if ($LASTEXITCODE -ne 0) { throw "Release archive creation failed" }

$lockCommand = "set -e; lock='$remoteLock'; if ! mkdir `$lock 2>/dev/null; then if find `$lock -maxdepth 0 -mmin +30 | grep -q .; then rm -rf -- `$lock; mkdir `$lock; else echo 'Another deployment is active:'; cat `$lock/owner 2>/dev/null || true; exit 73; fi; fi; printf '%s\n' '$User@$env:COMPUTERNAME $commit $stamp' > `$lock/owner; umask 077; mkdir -m 700 '$remoteRuntimeHelperDir'"
& ssh @ssh $target $lockCommand
if ($LASTEXITCODE -ne 0) { throw "Could not acquire remote deployment lock" }
$lockAcquired = $true

try {
  $uploadSources = @(
    $runtimeConfigHelper,
    $runtimeConfigUpdater,
    $databaseBackupHelper,
    $archive
  )
  & scp @ssh @uploadSources "$target`:$remoteRuntimeHelperDir/"
  if ($LASTEXITCODE -ne 0) { throw "Release payload upload failed" }
  & ssh @ssh $target "node $remoteRuntimeConfigHelper $RemoteDir/.env --peer $RemoteDir/server/.env"
  if ($LASTEXITCODE -ne 0) {
    if ([string]::IsNullOrWhiteSpace($env:SHUBAO_IMAGE_API_KEY) -or [string]::IsNullOrWhiteSpace($env:SHUBAO_VISION_API_KEY)) {
      throw "Production runtime gateway configuration is not ready; SHUBAO_IMAGE_API_KEY and SHUBAO_VISION_API_KEY are required"
    }
    & ssh @ssh $target "set -e; umask 077; test ! -e '$remoteRuntimeConfigBackup'; mkdir -m 700 '$remoteRuntimeConfigBackup'; cp '$RemoteDir/.env' '$remoteRuntimeConfigBackup/root.env'; cp '$RemoteDir/server/.env' '$remoteRuntimeConfigBackup/server.env'; chmod 600 '$remoteRuntimeConfigBackup/root.env' '$remoteRuntimeConfigBackup/server.env'"
    if ($LASTEXITCODE -ne 0) { throw "Runtime configuration backup failed" }
    $runtimeConfigBackupCreated = $true
    $runtimeConfigTouched = $true
    $runtimePayload = @{
      IMAGE_API_KEY = $env:SHUBAO_IMAGE_API_KEY
      MINI_API_KEY = $env:SHUBAO_VISION_API_KEY
    } | ConvertTo-Json -Compress
    $runtimePayload | & ssh @ssh $target "node $remoteRuntimeConfigUpdater $RemoteDir/.env --peer $RemoteDir/server/.env"
    Remove-Variable runtimePayload -ErrorAction SilentlyContinue
    if ($LASTEXITCODE -ne 0) { throw "Production runtime gateway configuration update failed" }
    & ssh @ssh $target "node $remoteRuntimeConfigHelper $RemoteDir/.env --peer $RemoteDir/server/.env"
    if ($LASTEXITCODE -ne 0) { throw "Production runtime gateway configuration verification failed after update" }
  }
  $remoteStamp = "$stamp-$commit"
  $remoteBackup = "$RemoteDir/deploy-backups/$remoteStamp"
  & ssh @ssh $target "set -e; mkdir -p $remoteBackup; cp -a $RemoteDir/dist $remoteBackup/dist; cp -a $RemoteDir/server $remoteBackup/server; if [ -f $RemoteDir/server/works.db ]; then node $remoteDatabaseBackupHelper $RemoteDir $RemoteDir/server/works.db $remoteBackup/works.db; fi; sudo mkdir -p $WebRoot; sudo cp -a $WebRoot $remoteBackup/webroot"
  if ($LASTEXITCODE -ne 0) { throw "Remote backup failed" }
  $releaseStarted = $true
  & ssh @ssh $target "set -e; cd $RemoteDir; tar xzf '$remoteReleaseArchive'; npm ci --omit=dev; sudo cp -a $RemoteDir/dist/. $WebRoot/; pm2 restart shubao --update-env --max-memory-restart 1G; for attempt in `$(seq 1 30); do if curl -fsS http://127.0.0.1:3001/health; then exit 0; fi; sleep 2; done; exit 1"
  if ($LASTEXITCODE -ne 0) { throw "Remote restart or health check failed" }

  & (Join-Path $PSScriptRoot "verify-production-billing.ps1") -BaseUrl "https://shuimg.cn"
  if ($LASTEXITCODE -ne 0) { throw "Public production verification failed" }
  $initialVerificationPid = Get-RemotePm2ProcessId
  & (Join-Path $PSScriptRoot "verify-production-ecommerce.ps1") -BaseUrl "https://shuimg.cn"
  if ($LASTEXITCODE -ne 0) { throw "Authenticated ecommerce production verification failed" }
  $initialVerificationEndPid = Get-RemotePm2ProcessId
  if ($initialVerificationEndPid -ne $initialVerificationPid) {
    throw "PM2 process restarted during initial ecommerce verification: $initialVerificationPid -> $initialVerificationEndPid"
  }

  $canaryPid = $initialVerificationEndPid
  Write-Host "Canary started for $CanarySeconds seconds (PM2 pid: $canaryPid)"
  Start-Sleep -Seconds $CanarySeconds
  & (Join-Path $PSScriptRoot "verify-production-billing.ps1") -BaseUrl "https://shuimg.cn"
  if ($LASTEXITCODE -ne 0) { throw "Public production canary failed" }
  & (Join-Path $PSScriptRoot "verify-production-ecommerce.ps1") -BaseUrl "https://shuimg.cn"
  if ($LASTEXITCODE -ne 0) { throw "Authenticated ecommerce production canary failed" }
  $canaryEndPid = Get-RemotePm2ProcessId
  if ($canaryEndPid -ne $canaryPid) {
    throw "PM2 process restarted during canary: $canaryPid -> $canaryEndPid"
  }

  $backupRetentionCommand = "set -e; find $RemoteDir/deploy-backups -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | tail -n +4 | cut -d' ' -f2- | xargs -r sudo rm -rf --"
  & ssh @ssh $target $backupRetentionCommand
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Deployment succeeded but old backup retention cleanup failed"
  }

  $deploymentSucceeded = $true
  Write-Host "Deployed $commit to https://shuimg.cn/"
} catch {
  if ($releaseStarted) {
    Write-Warning "Deployment failed; starting rollback from $remoteBackup"
    $runtimeRestore = if ($runtimeConfigBackupCreated) { "cp '$remoteRuntimeConfigBackup/root.env' '$RemoteDir/.env'; cp '$remoteRuntimeConfigBackup/server.env' '$RemoteDir/server/.env'; chmod 600 '$RemoteDir/.env' '$RemoteDir/server/.env';" } else { "" }
    & ssh @ssh $target "set -e; cd $RemoteDir; rsync -a --delete --exclude='works.db*' --exclude='generated-assets/' --exclude='uploads/' $remoteBackup/server/ server/; rm -rf dist; cp -a $remoteBackup/dist dist; sudo rm -rf $WebRoot/*; sudo cp -a $remoteBackup/webroot/. $WebRoot/; $runtimeRestore pm2 reload shubao --update-env"
    if ($LASTEXITCODE -eq 0 -and $runtimeConfigBackupCreated) { $runtimeConfigTouched = $false }
  } elseif ($runtimeConfigTouched -and $runtimeConfigBackupCreated) {
    Write-Warning "Deployment failed before release; restoring the previous runtime gateway configuration"
    & ssh @ssh $target "set -e; cp '$remoteRuntimeConfigBackup/root.env' '$RemoteDir/.env'; cp '$remoteRuntimeConfigBackup/server.env' '$RemoteDir/server/.env'; chmod 600 '$RemoteDir/.env' '$RemoteDir/server/.env'"
    if ($LASTEXITCODE -eq 0) { $runtimeConfigTouched = $false }
  }
  throw
} finally {
  if ($lockAcquired) {
    $runtimeBackupCleanup = if ($runtimeConfigBackupCreated -and ($deploymentSucceeded -or -not $runtimeConfigTouched)) { "rm -rf -- '$remoteRuntimeConfigBackup';" } else { "" }
    & ssh @ssh $target "rm -f -- '$remoteDatabaseBackupHelper'; rm -rf -- '$remoteRuntimeHelperDir'; $runtimeBackupCleanup rm -rf -- '$remoteLock'"
    if ($runtimeConfigTouched -and $runtimeConfigBackupCreated -and -not $deploymentSucceeded) {
      Write-Warning "Runtime rollback could not be confirmed; recovery copy retained at $remoteRuntimeConfigBackup"
    }
    Write-Host "Release remote deployment lock"
  }
  Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue
}
