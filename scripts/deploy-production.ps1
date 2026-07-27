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
$repo = (Resolve-Path $RepoPath).Path
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$commit = (git -C $repo rev-parse --short HEAD).Trim()
$archive = Join-Path $env:TEMP "shubao-deploy-$commit-$stamp.tgz"
$target = "$User@$HostName"
$ssh = @("-i", $KeyPath, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new")
$remoteLock = "/tmp/.shubao-deploy.lock"
$databaseBackupHelper = Join-Path $PSScriptRoot "backup-runtime-db.cjs"
$remoteDatabaseBackupHelper = "/tmp/shubao-backup-db-$stamp.cjs"
$lockAcquired = $false
$remoteBackup = ""
$releaseStarted = $false

function Get-RemotePm2RestartCount {
  $json = (& ssh @ssh $target "pm2 jlist") -join "`n"
  if ($LASTEXITCODE -ne 0) { throw "Could not read PM2 process state" }
  $process = @($json | ConvertFrom-Json | Where-Object { $_.name -eq "shubao" })
  if ($process.Count -ne 1) { throw "Expected exactly one shubao PM2 process" }
  return [int]$process[0].pm2_env.restart_time
}

Write-Host "Building $commit..."
Push-Location $repo
try {
  npm run test
  npm run build
  git diff --check
} finally {
  Pop-Location
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
  --exclude='dist/stitched' `
  dist server package.json package-lock.json ecosystem.config.cjs

$lockCommand = "set -e; lock='$remoteLock'; if ! mkdir `$lock 2>/dev/null; then if find `$lock -maxdepth 0 -mmin +30 | grep -q .; then rm -rf -- `$lock; mkdir `$lock; else echo 'Another deployment is active:'; cat `$lock/owner 2>/dev/null || true; exit 73; fi; fi; printf '%s\n' '$User@$env:COMPUTERNAME $commit $stamp' > `$lock/owner"
& ssh @ssh $target $lockCommand
if ($LASTEXITCODE -ne 0) { throw "Could not acquire remote deployment lock" }
$lockAcquired = $true

try {
  & scp @ssh $databaseBackupHelper "$target`:$remoteDatabaseBackupHelper"
  if ($LASTEXITCODE -ne 0) { throw "Database backup helper upload failed" }

  $remoteStamp = "$stamp-$commit"
  $remoteBackup = "$RemoteDir/deploy-backups/$remoteStamp"
  & ssh @ssh $target "set -e; mkdir -p $remoteBackup; cp -a $RemoteDir/dist $remoteBackup/dist; cp -a $RemoteDir/server $remoteBackup/server; if [ -f $RemoteDir/server/works.db ]; then node $remoteDatabaseBackupHelper $RemoteDir $RemoteDir/server/works.db $remoteBackup/works.db; fi; sudo mkdir -p $WebRoot; sudo cp -a $WebRoot $remoteBackup/webroot"
  if ($LASTEXITCODE -ne 0) { throw "Remote backup failed" }

  & scp @ssh $archive "$target`:$RemoteDir/deploy.tgz"
  if ($LASTEXITCODE -ne 0) { throw "Upload failed" }

  $releaseStarted = $true
  & ssh @ssh $target "set -e; cd $RemoteDir; tar xzf deploy.tgz; rm -f deploy.tgz; sudo cp -a $RemoteDir/dist/. $WebRoot/; pm2 restart shubao --update-env; sleep 3; curl -fsS http://127.0.0.1:3001/health"
  if ($LASTEXITCODE -ne 0) { throw "Remote restart or health check failed" }

  & (Join-Path $PSScriptRoot "verify-production-billing.ps1") -BaseUrl "https://shuimg.cn"
  if ($LASTEXITCODE -ne 0) { throw "Public production verification failed" }

  $restartCount = Get-RemotePm2RestartCount
  Write-Host "Canary started for $CanarySeconds seconds (PM2 restart count: $restartCount)"
  Start-Sleep -Seconds $CanarySeconds
  & (Join-Path $PSScriptRoot "verify-production-billing.ps1") -BaseUrl "https://shuimg.cn"
  if ($LASTEXITCODE -ne 0) { throw "Public production canary failed" }
  $canaryRestartCount = Get-RemotePm2RestartCount
  if ($canaryRestartCount -ne $restartCount) {
    throw "PM2 restart count increased during canary: $restartCount -> $canaryRestartCount"
  }

  Write-Host "Deployed $commit to https://shuimg.cn/"
} catch {
  if ($releaseStarted) {
    Write-Warning "Deployment failed; starting rollback from $remoteBackup"
    & ssh @ssh $target "set -e; cd $RemoteDir; rsync -a --delete --exclude='works.db*' --exclude='generated-assets/' --exclude='uploads/' $remoteBackup/server/ server/; rm -rf dist; cp -a $remoteBackup/dist dist; sudo rm -rf $WebRoot/*; sudo cp -a $remoteBackup/webroot/. $WebRoot/; pm2 reload shubao --update-env"
  }
  throw
} finally {
  if ($lockAcquired) {
    & ssh @ssh $target "rm -f -- '$remoteDatabaseBackupHelper'; rm -rf -- '$remoteLock'"
    Write-Host "Release remote deployment lock"
  }
  Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue
}
