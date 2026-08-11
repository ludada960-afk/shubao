param(
  [string]$HostName = "43.129.180.134",
  [string]$User = "ubuntu",
  [string]$KeyPath = "$env:USERPROFILE\.ssh\shubao_deploy_ed25519",
  [string]$RemoteDir = "/home/ubuntu/shubao",
  [string]$WebRoot = "/var/www/shubao/current",
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

$canarySessionHelper = Join-Path $PSScriptRoot 'production-canary-session.ps1'
if (-not (Test-Path -LiteralPath $canarySessionHelper -PathType Leaf)) {
  throw "Production canary session helper is missing"
}
. $canarySessionHelper

$canarySessionToken = $env:SHUBAO_CANARY_SESSION_TOKEN
if (-not (Test-CanarySessionTokenFormat $canarySessionToken)) {
  $canarySessionToken = [Environment]::GetEnvironmentVariable('SHUBAO_CANARY_SESSION_TOKEN', 'User')
}
if (-not (Test-CanarySessionTokenFormat $canarySessionToken)) {
  throw "SHUBAO_CANARY_SESSION_TOKEN is required for authenticated production deployment"
}
Remove-Item Env:SHUBAO_CANARY_SESSION_TOKEN -ErrorAction SilentlyContinue

function Invoke-WithCanarySession {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )
  try {
    $env:SHUBAO_CANARY_SESSION_TOKEN = $script:canarySessionToken
    & $Command
  } finally {
    Remove-Item Env:SHUBAO_CANARY_SESSION_TOKEN -ErrorAction SilentlyContinue
  }
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
$remoteLock = "/tmp/.shubao-deploy-v2.lock"
$lockOwnerToken = "$(($commit, $stamp, $PID, [guid]::NewGuid().ToString('N')) -join '-')"
$deploymentLockRunner = Join-Path $PSScriptRoot "deployment-lock-runner.sh"
$databaseBackupHelper = Join-Path $PSScriptRoot "backup-runtime-db.cjs"
$runtimeConfigHelper = Join-Path $PSScriptRoot "verify-runtime-config.cjs"
$runtimeConfigUpdater = Join-Path $PSScriptRoot "configure-runtime-gateways.cjs"
$gatewayProbe = Join-Path $PSScriptRoot "probe-production-gateways.mjs"
$nanoGatewayProbe = Join-Path $PSScriptRoot "probe-nano-banana-gateway.mjs"
$galleryVerifier = Join-Path $PSScriptRoot "verify-production-gallery.mjs"
$videoVerifier = Join-Path $PSScriptRoot "verify-production-video.mjs"
$galleryDirectoryName = -join [char[]](34223, 21253, 20986, 21697)
$galleryAssetsDir = Join-Path $repo $galleryDirectoryName
$nginxConfig = Join-Path $PSScriptRoot "nginx\shuimg.cn.conf"
$remoteNginxConfig = "/etc/nginx/sites-available/shuimg.cn"
$remoteRuntimeHelperDir = "/tmp/shubao-runtime-tools-$lockOwnerToken"
$remoteDeploymentLockRunner = "$remoteRuntimeHelperDir/deployment-lock-runner.sh"
$remoteDatabaseBackupHelper = "$remoteRuntimeHelperDir/backup-runtime-db.cjs"
$remoteRuntimeConfigHelper = "$remoteRuntimeHelperDir/verify-runtime-config.cjs"
$remoteRuntimeConfigUpdater = "$remoteRuntimeHelperDir/configure-runtime-gateways.cjs"
$remoteReleaseArchive = "$remoteRuntimeHelperDir/$(Split-Path $archive -Leaf)"
$remoteRuntimeConfigBackup = "/tmp/shubao-runtime-config-backup-$stamp"
$legacyWebRoot = "/var/www/shubao/assets"
$staticReleasesRoot = "/var/www/shubao/releases"
$remotePm2ClusterMarker = "$RemoteDir/.runtime/pm2-cluster-v1"
$lockAcquired = $false
$lockProcess = $null
$lockErrorTask = $null
$lockedCommandSequence = 0
$remoteHelperCreated = $false
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
if (-not (Test-Path -LiteralPath $deploymentLockRunner -PathType Leaf)) {
  throw "Deployment lock runner is missing"
}
$deploymentSucceeded = $false

function Test-DeploymentLockHeld {
  if (-not $script:lockAcquired -or $null -eq $script:lockProcess) {
    return $false
  }
  try {
    return -not $script:lockProcess.HasExited
  } catch {
    return $false
  }
}

function Assert-DeploymentLockHeld {
  if (-not (Test-DeploymentLockHeld)) {
    throw "Production deployment lock session was lost"
  }
}

function Invoke-LockedRemote {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,
    [string]$InputText = "",
    [ValidateRange(1, 3600)]
    [int]$TimeoutSeconds = 1200,
    [Parameter(Mandatory = $true)]
    [string]$FailureMessage
  )

  Assert-DeploymentLockHeld
  $script:lockedCommandSequence += 1
  $requestId = "$script:lockOwnerToken-$script:lockedCommandSequence"
  $commandPayload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Command))
  $inputPayload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($InputText))
  try {
    $script:lockProcess.StandardInput.WriteLine("$requestId`:$TimeoutSeconds`:$commandPayload`:$inputPayload")
    $script:lockProcess.StandardInput.Flush()
  } catch {
    throw "Production deployment lock command channel was lost"
  }

  $resultPrefix = "LOCK_RESULT:$requestId`:"
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds + 60)
  while ((Get-Date) -lt $deadline) {
    $remaining = $deadline - (Get-Date)
    $lineTask = $script:lockProcess.StandardOutput.ReadLineAsync()
    if (-not $lineTask.Wait($remaining)) {
      throw "$FailureMessage (remote command response timed out)"
    }
    $line = $lineTask.Result
    if ($null -eq $line) {
      throw "Production deployment lock command channel was lost"
    }
    if ($line.StartsWith($resultPrefix, [StringComparison]::Ordinal)) {
      $statusText = $line.Substring($resultPrefix.Length)
      $status = 0
      if (-not [int]::TryParse($statusText, [ref]$status) -or $status -ne 0) {
        throw "$FailureMessage (exit code $statusText)"
      }
      return
    }
    Write-Host $line
  }
  throw "$FailureMessage (remote command timed out)"
}

function Get-RemotePm2ProcessId {
  $remotePid = ((& ssh @ssh $target "pm2 pid shubao-production") -join "").Trim()
  if ($LASTEXITCODE -ne 0 -or $remotePid -notmatch '^\d+$' -or [int64]$remotePid -le 0) {
    throw "Could not read the shubao-production PM2 process id"
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
$nanoGatewayKey = $env:SHUBAO_NANO_BANANA_API_KEY
if ([string]::IsNullOrWhiteSpace($nanoGatewayKey)) {
  $nanoGatewayKey = [Environment]::GetEnvironmentVariable('SHUBAO_NANO_BANANA_API_KEY', 'User')
}
$hasNanoGatewayKey = -not [string]::IsNullOrWhiteSpace($nanoGatewayKey)
if ($hasNanoGatewayKey) { $env:SHUBAO_NANO_BANANA_API_KEY = $nanoGatewayKey }
$videoGatewayKey = $env:SHUBAO_VIDEO_API_KEY
if ([string]::IsNullOrWhiteSpace($videoGatewayKey)) {
  $videoGatewayKey = [Environment]::GetEnvironmentVariable('SHUBAO_VIDEO_API_KEY', 'User')
}
$hasVideoGatewayKey = -not [string]::IsNullOrWhiteSpace($videoGatewayKey)
$minimaxVideoGatewayKey = $env:SHUBAO_MINIMAX_VIDEO_API_KEY
if ([string]::IsNullOrWhiteSpace($minimaxVideoGatewayKey)) {
  $minimaxVideoGatewayKey = [Environment]::GetEnvironmentVariable('SHUBAO_MINIMAX_VIDEO_API_KEY', 'User')
}
$hasMinimaxVideoGatewayKey = -not [string]::IsNullOrWhiteSpace($minimaxVideoGatewayKey)
if ($hasImageGatewayKey -and -not $hasVisionGatewayKey) {
  throw "SHUBAO_IMAGE_API_KEY requires SHUBAO_VISION_API_KEY"
}
if ($hasImageGatewayKey -and $hasVisionGatewayKey) {
  & node $gatewayProbe --validate-only
  if ($LASTEXITCODE -ne 0) { throw "Production gateway credential format validation failed" }
}
if ($hasNanoGatewayKey) {
  & node $nanoGatewayProbe --validate-only
  if ($LASTEXITCODE -ne 0) { throw "Nano Banana credential format validation failed" }
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
if ($hasNanoGatewayKey) {
  & node $nanoGatewayProbe
  if ($LASTEXITCODE -ne 0) { throw "Authenticated Nano Banana gateway probe failed" }
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
  --exclude='server/video-assets' `
  --exclude='server/node_modules' `
  --exclude='server/.env' `
  --exclude='server/.auth-session-secret' `
  --exclude='dist/stitched' `
  dist server shared scripts/nginx/shuimg.cn.conf scripts/check-ecommerce-idle.cjs package.json package-lock.json ecosystem.config.cjs ecosystem.production.config.cjs $galleryDirectoryName
if ($LASTEXITCODE -ne 0) { throw "Release archive creation failed" }
tar -tzf $archive shared/ecommerceAbilityRecipes.mjs | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Release archive runtime module verification failed" }

try {
  & ssh @ssh $target "set -e; umask 077; test ! -e '$remoteRuntimeHelperDir'; mkdir -m 700 '$remoteRuntimeHelperDir'"
  if ($LASTEXITCODE -ne 0) { throw "Could not create remote runtime helper directory" }
  $remoteHelperCreated = $true
  $uploadSources = @(
    $deploymentLockRunner,
    $runtimeConfigHelper,
    $runtimeConfigUpdater,
    $databaseBackupHelper,
    $archive
  )
  & scp @ssh @uploadSources "$target`:$remoteRuntimeHelperDir/"
  if ($LASTEXITCODE -ne 0) { throw "Release payload upload failed" }

  $remoteLockCommand = "sh '$remoteDeploymentLockRunner' '$remoteLock' '$lockOwnerToken'"
  $lockProcessInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $lockProcessInfo.FileName = "ssh"
  $lockProcessInfo.UseShellExecute = $false
  $lockProcessInfo.CreateNoWindow = $true
  $lockProcessInfo.RedirectStandardInput = $true
  $lockProcessInfo.RedirectStandardOutput = $true
  $lockProcessInfo.RedirectStandardError = $true
  $lockProcessInfo.Arguments = ((@($ssh) + @($target, $remoteLockCommand)) | ForEach-Object {
    $argumentValue = [string]$_
    if ($argumentValue.Contains('"')) {
      throw "Remote lock process argument contains an unsupported quote"
    }
    '"' + $argumentValue + '"'
  }) -join ' '
  $lockProcess = [System.Diagnostics.Process]::new()
  $lockProcess.StartInfo = $lockProcessInfo
  if (-not $lockProcess.Start()) {
    throw "Could not start remote deployment lock session"
  }
  $lockErrorTask = $lockProcess.StandardError.ReadToEndAsync()
  $lockMarker = "LOCK_ACQUIRED:$lockOwnerToken"
  $lockMarkerTask = $lockProcess.StandardOutput.ReadLineAsync()
  if (-not $lockMarkerTask.Wait([TimeSpan]::FromSeconds(30))) {
    throw "Timed out while acquiring remote deployment lock"
  }
  if ($lockMarkerTask.Result -ne $lockMarker -or $lockProcess.HasExited) {
    throw "Could not acquire remote deployment lock"
  }
  $lockAcquired = $true

  Assert-DeploymentLockHeld
  if ($hasImageGatewayKey -or $hasVisionGatewayKey -or $hasNanoGatewayKey -or $hasVideoGatewayKey -or $hasMinimaxVideoGatewayKey) {
    Invoke-LockedRemote -Command "set -e; umask 077; test ! -e '$remoteRuntimeConfigBackup'; mkdir -m 700 '$remoteRuntimeConfigBackup'; cp '$RemoteDir/.env' '$remoteRuntimeConfigBackup/root.env'; cp '$RemoteDir/server/.env' '$remoteRuntimeConfigBackup/server.env'; chmod 600 '$remoteRuntimeConfigBackup/root.env' '$remoteRuntimeConfigBackup/server.env'" -TimeoutSeconds 120 -FailureMessage "Runtime configuration backup failed"
    $runtimeConfigBackupCreated = $true
    $runtimeConfigTouched = $true
    $runtimeSecrets = @{}
    if ($hasImageGatewayKey) { $runtimeSecrets.IMAGE_API_KEY = $env:SHUBAO_IMAGE_API_KEY }
    if ($hasVisionGatewayKey) { $runtimeSecrets.MINI_API_KEY = $env:SHUBAO_VISION_API_KEY }
    if ($hasNanoGatewayKey) { $runtimeSecrets.NANO_BANANA_API_KEY = $nanoGatewayKey }
    if ($hasVideoGatewayKey) { $runtimeSecrets.VIDEO_API_KEY = $videoGatewayKey }
    if ($hasMinimaxVideoGatewayKey) { $runtimeSecrets.MINIMAX_VIDEO_API_KEY = $minimaxVideoGatewayKey }
    $runtimePayload = $runtimeSecrets | ConvertTo-Json -Compress
    $runtimeUpdateCommand = "node $remoteRuntimeConfigUpdater $RemoteDir/.env --peer $RemoteDir/server/.env --replace-secrets"
    Invoke-LockedRemote -Command $runtimeUpdateCommand -InputText $runtimePayload -TimeoutSeconds 120 -FailureMessage "Production runtime gateway configuration update failed"
    Remove-Variable runtimePayload -ErrorAction SilentlyContinue
    Remove-Variable runtimeUpdateCommand -ErrorAction SilentlyContinue
    Remove-Variable runtimeSecrets -ErrorAction SilentlyContinue
    Invoke-LockedRemote -Command "node $remoteRuntimeConfigHelper $RemoteDir/.env --peer $RemoteDir/server/.env" -TimeoutSeconds 120 -FailureMessage "Production runtime gateway configuration verification failed after update"
  } else {
    Invoke-LockedRemote -Command "node $remoteRuntimeConfigHelper $RemoteDir/.env --peer $RemoteDir/server/.env" -TimeoutSeconds 120 -FailureMessage "Production runtime gateway configuration verification failed"
  }
  $remoteStamp = "$stamp-$commit"
  $remoteBackup = "$RemoteDir/deploy-backups/$remoteStamp"
  $remoteStaticRelease = "$staticReleasesRoot/$remoteStamp"
  $remoteStaticNext = "$WebRoot.next"
  Assert-DeploymentLockHeld
  Invoke-LockedRemote -Command "set -e; mkdir -p $remoteBackup; cp -a $RemoteDir/dist $remoteBackup/dist; mkdir -p $remoteBackup/server; rsync -a --delete --exclude='works.db' --exclude='works.db-shm' --exclude='works.db-wal' --exclude='generated-assets/' --exclude='uploads/' --exclude='temp_uploads/' --exclude='cache_img/' --exclude='cache_overlay/' --exclude='extension_downloads/' --exclude='extension_tasks/' --exclude='backups/' $RemoteDir/server/ $remoteBackup/server/; if [ -f $RemoteDir/server/works.db ]; then node $remoteDatabaseBackupHelper $RemoteDir $RemoteDir/server/works.db $remoteBackup/works.db; fi; if [ -L $WebRoot ] || [ -d $WebRoot ]; then sudo cp -aL $WebRoot $remoteBackup/webroot; else sudo cp -aL $legacyWebRoot $remoteBackup/webroot; fi; if [ -f $RemoteDir/ecosystem.production.config.cjs ]; then cp $RemoteDir/ecosystem.production.config.cjs $remoteBackup/ecosystem.production.config.cjs; fi; if pm2 describe shubao >/dev/null 2>&1; then legacy_pid=`$(pm2 pid shubao); case `"`$legacy_pid`" in ''|*[!0-9]*) exit 1 ;; esac; printf '%s\n' `"`$legacy_pid`" > $remoteBackup/legacy-pid; sha256sum $RemoteDir/server/index.mjs > $remoteBackup/legacy-server.sha256; fi; if [ -f $remotePm2ClusterMarker ]; then touch $remoteBackup/pm2-cluster-enabled; fi; sudo cp '$remoteNginxConfig' $remoteBackup/nginx-config" -TimeoutSeconds 600 -FailureMessage "Remote backup failed"
  $releaseStarted = $true
  Assert-DeploymentLockHeld
  Invoke-LockedRemote -Command "set -e; cd $RemoteDir; if [ -d '$RemoteDir/$galleryDirectoryName' ]; then mv '$RemoteDir/$galleryDirectoryName' '$remoteBackup/$galleryDirectoryName'; fi; tar xzf '$remoteReleaseArchive'; npm ci --omit=dev; mkdir -p $RemoteDir/.runtime server/extension_tasks server/extension_downloads server/uploads server/temp_uploads server/generated-assets server/video-assets/input server/video-assets/output server/cache_img server/cache_overlay server/backups; pm2 delete ecosystem.production >/dev/null 2>&1 || true; if [ -f $remotePm2ClusterMarker ]; then pm2 startOrReload ecosystem.production.config.cjs --only shubao-production --update-env; else pm2 delete shubao-production >/dev/null 2>&1 || true; pm2 start ecosystem.production.config.cjs --only shubao-production --update-env; touch $remotePm2ClusterMarker; fi; for attempt in `$(seq 1 60); do if curl -fsS http://127.0.0.1:3002/health; then break; fi; if [ `"`$attempt`" -eq 60 ]; then exit 1; fi; sleep 2; done; sudo mkdir -p $staticReleasesRoot $remoteStaticRelease; sudo cp -a $RemoteDir/dist/. $remoteStaticRelease/; sudo rm -f $remoteStaticNext; sudo ln -s $remoteStaticRelease $remoteStaticNext; sudo mv -Tf $remoteStaticNext $WebRoot; sudo cp '$RemoteDir/scripts/nginx/shuimg.cn.conf' '$remoteNginxConfig'; sudo nginx -t; sudo systemctl reload nginx" -TimeoutSeconds 2400 -FailureMessage "Remote restart or health check failed"

  Wait-PublicProductionReady -TimeoutSeconds $PublicWarmupSeconds
  & node $galleryVerifier --base-url "https://shuimg.cn"
  if ($LASTEXITCODE -ne 0) { throw "Public gallery verification failed" }
  & node $videoVerifier --base-url "https://shuimg.cn"
  if ($LASTEXITCODE -ne 0) { throw "Public video contract verification failed" }
  Invoke-WithCanarySession -Command { & (Join-Path $PSScriptRoot "verify-production-billing.ps1") -BaseUrl "https://shuimg.cn" }
  if ($LASTEXITCODE -ne 0) { throw "Public production verification failed" }
  Assert-DeploymentLockHeld
  $initialVerificationPid = Get-RemotePm2ProcessId
  Invoke-WithCanarySession -Command { Invoke-EcommerceProductionVerification -FailureMessage "Authenticated ecommerce production verification failed" }
  $initialVerificationEndPid = Get-RemotePm2ProcessId
  if ($initialVerificationEndPid -ne $initialVerificationPid) {
    throw "PM2 process restarted during initial ecommerce verification: $initialVerificationPid -> $initialVerificationEndPid"
  }

  $canaryPid = $initialVerificationEndPid
  Write-Host "Canary started for $CanarySeconds seconds (PM2 pid: $canaryPid)"
  Start-Sleep -Seconds $CanarySeconds
  Assert-DeploymentLockHeld
  Invoke-WithCanarySession -Command { & (Join-Path $PSScriptRoot "verify-production-billing.ps1") -BaseUrl "https://shuimg.cn" }
  if ($LASTEXITCODE -ne 0) { throw "Public production canary failed" }
  Invoke-WithCanarySession -Command { Invoke-EcommerceProductionVerification -FailureMessage "Authenticated ecommerce production canary failed" }
  & node $videoVerifier --base-url "https://shuimg.cn"
  if ($LASTEXITCODE -ne 0) { throw "Public video contract canary failed" }
  $canaryEndPid = Get-RemotePm2ProcessId
  if ($canaryEndPid -ne $canaryPid) {
    throw "PM2 process restarted during canary: $canaryPid -> $canaryEndPid"
  }
  Assert-DeploymentLockHeld
  $legacyRetireCommand = "set -e; cd $RemoteDir; if pm2 describe shubao >/dev/null 2>&1; then command -v ss >/dev/null; for attempt in `$(seq 1 120); do if node scripts/check-ecommerce-idle.cjs server/works.db && ! ss -Htn state established '( sport = :3001 )' | grep -q .; then pm2 delete shubao >/dev/null 2>&1 || true; exit 0; fi; sleep 15; done; echo 'Legacy PM2 process remains isolated on port 3001 and will be retired by a later deployment.' >&2; fi"
  Invoke-LockedRemote -Command $legacyRetireCommand -TimeoutSeconds 1900 -FailureMessage "Legacy PM2 drain check failed"
  Invoke-LockedRemote -Command "pm2 save" -TimeoutSeconds 120 -FailureMessage "PM2 startup snapshot update failed"

  Assert-DeploymentLockHeld
  $backupRetentionCommand = "set -e; find $RemoteDir/deploy-backups -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | tail -n +4 | cut -d' ' -f2- | xargs -r sudo rm -rf --"
  try {
    Invoke-LockedRemote -Command $backupRetentionCommand -TimeoutSeconds 300 -FailureMessage "Old backup retention cleanup failed"
  } catch {
    Write-Warning "Deployment succeeded but old backup retention cleanup failed"
  }
  $staticRetentionCommand = "set -e; find $staticReleasesRoot -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | tail -n +4 | cut -d' ' -f2- | xargs -r sudo rm -rf --"
  try {
    Invoke-LockedRemote -Command $staticRetentionCommand -TimeoutSeconds 300 -FailureMessage "Old static release cleanup failed"
  } catch {
    Write-Warning "Deployment succeeded but old static release cleanup failed"
  }

  $deploymentSucceeded = $true
  Write-Host "Deployed $commit to https://shuimg.cn/"
} catch {
  $deploymentFailure = $_
  if (-not (Test-DeploymentLockHeld)) {
    Write-Warning "Deployment lock was lost; refusing an unfenced production rollback"
  } elseif ($releaseStarted) {
    Write-Warning "Deployment failed; starting application and Nginx restore from $remoteBackup"
    $runtimeRestore = if ($runtimeConfigBackupCreated) { "cp '$remoteRuntimeConfigBackup/root.env' '$RemoteDir/.env'; cp '$remoteRuntimeConfigBackup/server.env' '$RemoteDir/server/.env'; chmod 600 '$RemoteDir/.env' '$RemoteDir/server/.env';" } else { "" }
    $rollbackCommand = "set -e; cd $RemoteDir; rsync -a --delete --exclude='works.db*' --exclude='generated-assets/' --exclude='uploads/' --exclude='temp_uploads/' --exclude='cache_img/' --exclude='cache_overlay/' --exclude='extension_downloads/' --exclude='extension_tasks/' --exclude='backups/' $remoteBackup/server/ server/; mkdir -p server/extension_tasks server/extension_downloads server/uploads server/temp_uploads server/generated-assets server/cache_img server/cache_overlay server/backups; if [ -f $remoteBackup/legacy-server.sha256 ]; then sha256sum -c $remoteBackup/legacy-server.sha256; fi; rm -rf dist; cp -a $remoteBackup/dist dist; if [ -d '$remoteBackup/$galleryDirectoryName' ]; then rm -rf -- '$RemoteDir/$galleryDirectoryName'; mv '$remoteBackup/$galleryDirectoryName' '$RemoteDir/$galleryDirectoryName'; fi; rollback_static='$staticReleasesRoot/rollback-$remoteStamp'; sudo rm -rf `"`$rollback_static`"; sudo mkdir -p `"`$rollback_static`"; sudo cp -a $remoteBackup/webroot/. `"`$rollback_static`"/; $runtimeRestore if [ -f $remoteBackup/pm2-cluster-enabled ]; then cp $remoteBackup/ecosystem.production.config.cjs $RemoteDir/ecosystem.production.config.cjs; pm2 startOrReload ecosystem.production.config.cjs --only shubao-production --update-env; for attempt in `$(seq 1 60); do if curl -fsS http://127.0.0.1:3002/health; then break; fi; if [ `"`$attempt`" -eq 60 ]; then exit 1; fi; sleep 2; done; sudo rm -f $remoteStaticNext; sudo ln -s `"`$rollback_static`" $remoteStaticNext; sudo mv -Tf $remoteStaticNext $WebRoot; sudo cp $remoteBackup/nginx-config '$remoteNginxConfig'; sudo nginx -t; sudo systemctl reload nginx; else rm -f $remotePm2ClusterMarker; legacy_pid_before=`$(cat $remoteBackup/legacy-pid 2>/dev/null || true); if ! pm2 describe shubao >/dev/null 2>&1; then NODE_ENV=production PORT=3001 pm2 start server/index.mjs --name shubao --max-memory-restart 1G; else legacy_pid_after=`$(pm2 pid shubao); if [ `"`$legacy_pid_after`" != `"`$legacy_pid_before`" ]; then pm2 restart shubao --update-env; fi; fi; for attempt in `$(seq 1 60); do if curl -fsS http://127.0.0.1:3001/health; then break; fi; if [ `"`$attempt`" -eq 60 ]; then exit 1; fi; sleep 2; done; sudo rm -f $remoteStaticNext; sudo ln -s `"`$rollback_static`" $remoteStaticNext; sudo mv -Tf $remoteStaticNext $WebRoot; sudo cp $remoteBackup/nginx-config '$remoteNginxConfig'; sudo nginx -t; sudo systemctl reload nginx; pm2 delete shubao-production >/dev/null 2>&1 || true; fi; pm2 save"
    try {
      Invoke-LockedRemote -Command $rollbackCommand -TimeoutSeconds 2400 -FailureMessage "Production rollback failed"
      if ($runtimeConfigBackupCreated) { $runtimeConfigTouched = $false }
    } catch {
      Write-Warning "Production rollback could not be completed: $($_.Exception.Message)"
    }
  } elseif ($runtimeConfigTouched -and $runtimeConfigBackupCreated) {
    Write-Warning "Deployment failed before release; restoring the previous runtime gateway configuration"
    try {
      Invoke-LockedRemote -Command "set -e; cp '$remoteRuntimeConfigBackup/root.env' '$RemoteDir/.env'; cp '$remoteRuntimeConfigBackup/server.env' '$RemoteDir/server/.env'; chmod 600 '$RemoteDir/.env' '$RemoteDir/server/.env'" -TimeoutSeconds 120 -FailureMessage "Runtime gateway rollback failed"
      $runtimeConfigTouched = $false
    } catch {
      Write-Warning "Runtime gateway rollback could not be completed: $($_.Exception.Message)"
    }
  }
  throw $deploymentFailure
} finally {
  if (Test-DeploymentLockHeld) {
    $runtimeBackupCleanup = if ($runtimeConfigBackupCreated -and ($deploymentSucceeded -or -not $runtimeConfigTouched)) { "rm -rf -- '$remoteRuntimeConfigBackup';" } else { "" }
    try {
      Invoke-LockedRemote -Command "$runtimeBackupCleanup rm -rf -- '$remoteRuntimeHelperDir'" -TimeoutSeconds 120 -FailureMessage "Remote deployment helper cleanup failed"
    } catch {
      Write-Warning "Remote deployment helper cleanup failed"
    }
  } elseif ($remoteHelperCreated -and -not $lockAcquired) {
    & ssh @ssh $target "rm -rf -- '$remoteRuntimeHelperDir'"
    if ($LASTEXITCODE -ne 0) { Write-Warning "Unused remote deployment helper cleanup failed" }
  }
  if ($runtimeConfigTouched -and $runtimeConfigBackupCreated -and -not $deploymentSucceeded) {
    Write-Warning "Runtime rollback could not be confirmed; recovery copy retained at $remoteRuntimeConfigBackup"
  }
  if ($lockProcess) {
    try {
      if (-not $lockProcess.HasExited) {
        $lockProcess.StandardInput.Close()
        if (-not $lockProcess.WaitForExit(5000)) {
          $lockProcess.Kill()
          $null = $lockProcess.WaitForExit(5000)
        }
      }
    } catch {
      Write-Warning "Could not terminate the local deployment lock process cleanly"
    } finally {
      $lockProcess.Dispose()
    }
  }
  if ($lockAcquired) {
    Write-Host "Released remote deployment lock"
  }
  Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue
}
