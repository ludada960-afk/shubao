param(
  [string]$HostName = "43.129.180.134",
  [string]$User = "ubuntu",
  [string]$KeyPath = "$env:USERPROFILE\.ssh\shubao_deploy_ed25519",
  [string]$RemoteDir = "/home/ubuntu/shubao",
  [string]$WebRoot = "/var/www/shubao/assets",
  [string]$RepoPath = (Join-Path $PSScriptRoot ".."),
  [ValidateRange(0, 3600)]
  [int]$CanarySeconds = 600,
  [ValidateRange(0, 600)]
  [int]$PublicWarmupSeconds = 180
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
$galleryVerifier = Join-Path $PSScriptRoot "verify-production-gallery.mjs"
$galleryDirectoryName = -join [char[]](34223, 21253, 20986, 21697)
$galleryAssetsDir = Join-Path $repo $galleryDirectoryName
$nginxConfig = Join-Path $PSScriptRoot "nginx\shuimg.cn.conf"
$remoteNginxConfig = "/etc/nginx/sites-available/shuimg.cn"
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

if (-not (Test-Path -LiteralPath $nginxConfig -PathType Leaf)) {
  throw "Versioned production Nginx configuration is missing"
}
if (-not (Test-Path -LiteralPath $galleryAssetsDir -PathType Container)) {
  throw "Versioned gallery assets are missing"
}
$deploymentSucceeded = $false

function Get-RemotePm2ProcessId {
  $remotePid = ((& ssh @ssh $target "pm2 pid shubao") -join "").Trim()
  if ($LASTEXITCODE -ne 0 -or $remotePid -notmatch '^\d+$' -or [int64]$remotePid -le 0) {
    throw "Could not read the shubao PM2 process id"
  }
  return [int64]$remotePid
}

function Wait-PublicProductionReady {
  param(
    [Parameter(Mandatory = $true)]
    [int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    & node -e "fetch('https://shuimg.cn/health', { signal: AbortSignal.timeout(10000) }).then(response => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"
    if ($LASTEXITCODE -eq 0) {
      Write-Host "Public production health is ready"
      return
    }
    if ((Get-Date) -lt $deadline) { Start-Sleep -Seconds 5 }
  } while ((Get-Date) -lt $deadline)

  throw "Public production health did not become ready within $TimeoutSeconds seconds"
}

function Invoke-EcommerceProductionVerification {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FailureMessage,
    [ValidateRange(1, 5)]
    [int]$MaxAttempts = 3,
    [ValidateRange(0, 300)]
    [int]$RetryDelaySeconds = 20
  )

  $verifier = Join-Path $PSScriptRoot "verify-production-ecommerce.ps1"
  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    try {
      & $verifier -BaseUrl "https://shuimg.cn"
      if ($LASTEXITCODE -ne 0) { throw "Verifier exited with code $LASTEXITCODE" }
      return
    } catch {
      if ($attempt -ge $MaxAttempts) {
        throw "$FailureMessage after $MaxAttempts attempts"
      }
      Write-Warning "$FailureMessage on attempt $attempt of $MaxAttempts; retrying in $RetryDelaySeconds seconds"
      Start-Sleep -Seconds $RetryDelaySeconds
    }
  }
}

$hasImageGatewayKey = -not [string]::IsNullOrWhiteSpace($env:SHUBAO_IMAGE_API_KEY)
$hasVisionGatewayKey = -not [string]::IsNullOrWhiteSpace($env:SHUBAO_VISION_API_KEY)
if ($hasImageGatewayKey -and -not $hasVisionGatewayKey) {
  throw "SHUBAO_IMAGE_API_KEY requires SHUBAO_VISION_API_KEY"
}
if ($hasImageGatewayKey -and $hasVisionGatewayKey) {
  & node $gatewayProbe --validate-only
  if ($LASTEXITCODE -ne 0) { throw "Production gateway credential format validation failed" }
}

Write-Host "Building $commit..."
Push-Location $repo
try {
  Invoke-CheckedNative -FailureMessage "Gallery source verification failed" -Command { & node $galleryVerifier --source-only }
  Invoke-CheckedNative -FailureMessage "Test suite failed" -Command { npm run test }
  Invoke-CheckedNative -FailureMessage "Production build failed" -Command { npm run build }
  Invoke-CheckedNative -FailureMessage "Git whitespace validation failed" -Command { git diff --check }
} finally {
  Pop-Location
}

if ($hasImageGatewayKey -and $hasVisionGatewayKey) {
  & node $gatewayProbe
  if ($LASTEXITCODE -ne 0) { throw "Authenticated production gateway probe failed" }
} elseif ($hasVisionGatewayKey) {
  & node $gatewayProbe --vision-only
  if ($LASTEXITCODE -ne 0) { throw "Authenticated production vision gateway probe failed" }
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
  dist server scripts/nginx/shuimg.cn.conf package.json package-lock.json ecosystem.config.cjs $galleryDirectoryName
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
  if ($hasVisionGatewayKey) {
    & ssh @ssh $target "set -e; umask 077; test ! -e '$remoteRuntimeConfigBackup'; mkdir -m 700 '$remoteRuntimeConfigBackup'; cp '$RemoteDir/.env' '$remoteRuntimeConfigBackup/root.env'; cp '$RemoteDir/server/.env' '$remoteRuntimeConfigBackup/server.env'; chmod 600 '$remoteRuntimeConfigBackup/root.env' '$remoteRuntimeConfigBackup/server.env'"
    if ($LASTEXITCODE -ne 0) { throw "Runtime configuration backup failed" }
    $runtimeConfigBackupCreated = $true
    $runtimeConfigTouched = $true
    if ($hasImageGatewayKey) {
      $runtimePayload = @{
        IMAGE_API_KEY = $env:SHUBAO_IMAGE_API_KEY
        MINI_API_KEY = $env:SHUBAO_VISION_API_KEY
      } | ConvertTo-Json -Compress
      $runtimePayload | & ssh @ssh $target "node $remoteRuntimeConfigUpdater $RemoteDir/.env --peer $RemoteDir/server/.env"
    } else {
      $runtimePayload = @{
        MINI_API_KEY = $env:SHUBAO_VISION_API_KEY
      } | ConvertTo-Json -Compress
      $runtimePayload | & ssh @ssh $target "node $remoteRuntimeConfigUpdater $RemoteDir/.env --peer $RemoteDir/server/.env --replace-vision-key"
    }
    Remove-Variable runtimePayload -ErrorAction SilentlyContinue
    if ($LASTEXITCODE -ne 0) { throw "Production runtime gateway configuration update failed" }
    & ssh @ssh $target "node $remoteRuntimeConfigHelper $RemoteDir/.env --peer $RemoteDir/server/.env"
    if ($LASTEXITCODE -ne 0) { throw "Production runtime gateway configuration verification failed after update" }
  } else {
    & ssh @ssh $target "node $remoteRuntimeConfigHelper $RemoteDir/.env --peer $RemoteDir/server/.env"
    if ($LASTEXITCODE -ne 0) { throw "Production runtime gateway configuration verification failed" }
  }
  $remoteStamp = "$stamp-$commit"
  $remoteBackup = "$RemoteDir/deploy-backups/$remoteStamp"
  & ssh @ssh $target "set -e; mkdir -p $remoteBackup; cp -a $RemoteDir/dist $remoteBackup/dist; mkdir -p $remoteBackup/server; rsync -a --delete --exclude='works.db' --exclude='works.db-shm' --exclude='works.db-wal' --exclude='generated-assets/' --exclude='uploads/' --exclude='temp_uploads/' --exclude='cache_img/' --exclude='cache_overlay/' --exclude='extension_downloads/' --exclude='extension_tasks/' --exclude='backups/' $RemoteDir/server/ $remoteBackup/server/; if [ -f $RemoteDir/server/works.db ]; then node $remoteDatabaseBackupHelper $RemoteDir $RemoteDir/server/works.db $remoteBackup/works.db; fi; sudo mkdir -p $WebRoot; sudo cp -a $WebRoot $remoteBackup/webroot; sudo cp '$remoteNginxConfig' $remoteBackup/nginx-config"
  if ($LASTEXITCODE -ne 0) { throw "Remote backup failed" }
  $releaseStarted = $true
  & ssh @ssh $target "set -e; cd $RemoteDir; if [ -d '$RemoteDir/$galleryDirectoryName' ]; then mv '$RemoteDir/$galleryDirectoryName' '$remoteBackup/$galleryDirectoryName'; fi; tar xzf '$remoteReleaseArchive'; npm ci --omit=dev; sudo cp '$RemoteDir/scripts/nginx/shuimg.cn.conf' '$remoteNginxConfig'; sudo nginx -t; sudo systemctl reload nginx; sudo cp -a $RemoteDir/dist/. $WebRoot/; pm2 restart shubao --update-env --max-memory-restart 1G; for attempt in `$(seq 1 30); do if curl -fsS http://127.0.0.1:3001/health; then exit 0; fi; sleep 2; done; exit 1"
  if ($LASTEXITCODE -ne 0) { throw "Remote restart or health check failed" }

  Wait-PublicProductionReady -TimeoutSeconds $PublicWarmupSeconds
  & node $galleryVerifier --base-url "https://shuimg.cn"
  if ($LASTEXITCODE -ne 0) { throw "Public gallery verification failed" }
  & (Join-Path $PSScriptRoot "verify-production-billing.ps1") -BaseUrl "https://shuimg.cn"
  if ($LASTEXITCODE -ne 0) { throw "Public production verification failed" }
  $initialVerificationPid = Get-RemotePm2ProcessId
  Invoke-EcommerceProductionVerification -FailureMessage "Authenticated ecommerce production verification failed"
  $initialVerificationEndPid = Get-RemotePm2ProcessId
  if ($initialVerificationEndPid -ne $initialVerificationPid) {
    throw "PM2 process restarted during initial ecommerce verification: $initialVerificationPid -> $initialVerificationEndPid"
  }

  $canaryPid = $initialVerificationEndPid
  Write-Host "Canary started for $CanarySeconds seconds (PM2 pid: $canaryPid)"
  Start-Sleep -Seconds $CanarySeconds
  & (Join-Path $PSScriptRoot "verify-production-billing.ps1") -BaseUrl "https://shuimg.cn"
  if ($LASTEXITCODE -ne 0) { throw "Public production canary failed" }
  Invoke-EcommerceProductionVerification -FailureMessage "Authenticated ecommerce production canary failed"
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
    Write-Warning "Deployment failed; starting application and Nginx restore from $remoteBackup"
    $runtimeRestore = if ($runtimeConfigBackupCreated) { "cp '$remoteRuntimeConfigBackup/root.env' '$RemoteDir/.env'; cp '$remoteRuntimeConfigBackup/server.env' '$RemoteDir/server/.env'; chmod 600 '$RemoteDir/.env' '$RemoteDir/server/.env';" } else { "" }
    & ssh @ssh $target "set -e; cd $RemoteDir; rsync -a --delete --exclude='works.db*' --exclude='generated-assets/' --exclude='uploads/' $remoteBackup/server/ server/; rm -rf dist; cp -a $remoteBackup/dist dist; if [ -d '$remoteBackup/$galleryDirectoryName' ]; then rm -rf -- '$RemoteDir/$galleryDirectoryName'; mv '$remoteBackup/$galleryDirectoryName' '$RemoteDir/$galleryDirectoryName'; fi; sudo rm -rf $WebRoot/*; sudo cp -a $remoteBackup/webroot/. $WebRoot/; sudo cp $remoteBackup/nginx-config '$remoteNginxConfig'; sudo nginx -t; sudo systemctl reload nginx; $runtimeRestore pm2 reload shubao --update-env"
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
