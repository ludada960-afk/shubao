param(
  [string]$HostName = "43.129.180.134",
  [string]$User = "ubuntu",
  [string]$KeyPath = "$env:USERPROFILE\.ssh\shubao_deploy_ed25519",
  [string]$RemoteDir = "/home/ubuntu/shubao",
  [string]$WebRoot = "/var/www/shubao/assets",
  [string]$RepoPath = (Join-Path $PSScriptRoot "..")
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path $RepoPath).Path
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$commit = (git -C $repo rev-parse --short HEAD).Trim()
$archive = Join-Path $env:TEMP "shubao-deploy-$commit-$stamp.tgz"
$target = "$User@$HostName"
$ssh = @("-i", $KeyPath, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new")

Write-Host "Building $commit..."
Push-Location $repo
try {
  npm run test
  npm run build
} finally {
  Pop-Location
}

if (Test-Path $archive) { Remove-Item -LiteralPath $archive -Force }
tar -czf $archive -C $repo `
  --exclude='server/works.db' `
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
  --exclude='server/node_modules' `
  --exclude='server/.env' `
  --exclude='dist/stitched' `
  dist server package.json package-lock.json ecosystem.config.cjs

$remoteStamp = "$stamp-$commit"
& ssh @ssh $target "set -e; mkdir -p $RemoteDir/deploy-backups/$remoteStamp; cp -a $RemoteDir/dist $RemoteDir/deploy-backups/$remoteStamp/dist; cp -a $RemoteDir/server $RemoteDir/deploy-backups/$remoteStamp/server; sudo mkdir -p $WebRoot; sudo cp -a $WebRoot $RemoteDir/deploy-backups/$remoteStamp/webroot"
if ($LASTEXITCODE -ne 0) { throw "Remote backup failed" }

& scp @ssh $archive "$target`:$RemoteDir/deploy.tgz"
if ($LASTEXITCODE -ne 0) { throw "Upload failed" }

& ssh @ssh $target "set -e; cd $RemoteDir; tar xzf deploy.tgz; rm -f deploy.tgz; sudo cp -a $RemoteDir/dist/. $WebRoot/; pm2 restart shubao --update-env; sleep 3; curl -fsS http://127.0.0.1:3001/health"
if ($LASTEXITCODE -ne 0) { throw "Remote restart or health check failed" }

Write-Host "Deployed $commit to https://shuimg.cn/"
Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue
