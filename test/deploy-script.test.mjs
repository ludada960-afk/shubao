import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const deploy = readFileSync(new URL('../scripts/deploy-production.ps1', import.meta.url), 'utf8');
const verify = readFileSync(new URL('../scripts/verify-production-billing.ps1', import.meta.url), 'utf8');
const nodeVerify = readFileSync(new URL('../scripts/verify-production-billing.mjs', import.meta.url), 'utf8');
const ecommerceVerify = readFileSync(new URL('../scripts/verify-production-ecommerce.ps1', import.meta.url), 'utf8');
const backupHelper = readFileSync(new URL('../scripts/backup-runtime-db.cjs', import.meta.url), 'utf8');
const runtimeConfigVerifier = readFileSync(new URL('../scripts/verify-runtime-config.cjs', import.meta.url), 'utf8');
const runtimeConfigUpdater = readFileSync(new URL('../scripts/configure-runtime-gateways.cjs', import.meta.url), 'utf8');
const productionEcosystem = readFileSync(new URL('../ecosystem.production.config.cjs', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../server/index.mjs', import.meta.url), 'utf8');
const ecommerceIdleProbe = readFileSync(new URL('../scripts/check-ecommerce-idle.cjs', import.meta.url), 'utf8');
const deploymentLockRunner = readFileSync(new URL('../scripts/deployment-lock-runner.sh', import.meta.url), 'utf8');
const extensionTaskManager = readFileSync(new URL('../server/extensionTaskManager.mjs', import.meta.url), 'utf8');
const canarySessionHelperUrl = new URL('../scripts/production-canary-session.ps1', import.meta.url);
const canarySessionHelper = existsSync(canarySessionHelperUrl) ? readFileSync(canarySessionHelperUrl, 'utf8') : '';

test('production deploy protects runtime state and has a reversible release gate', () => {
  assert.match(deploy, /SHUBAO_CANARY_SESSION_TOKEN is required for authenticated production deployment/);
  assert.match(canarySessionHelper, /-cmatch\s+['"]\^eyJ[^\r\n]+\\z['"]/);
  assert.match(deploy, /GetEnvironmentVariable\(['"]SHUBAO_CANARY_SESSION_TOKEN['"],\s*['"]User['"]\)/);
  assert.match(deploy, /function\s+Invoke-WithCanarySession/i);
  assert.match(deploy, /finally\s*\{\s*Remove-Item\s+Env:SHUBAO_CANARY_SESSION_TOKEN/i);
  assert.ok(deploy.indexOf('Remove-Item Env:SHUBAO_CANARY_SESSION_TOKEN') < deploy.indexOf('Write-Host "Building $commit..."'));
  assert.match(deploy, /git[^\n]*diff --check/i);
  assert.match(deploy, /function\s+Invoke-CheckedNative/i);
  assert.match(deploy, /Invoke-CheckedNative[^\n]*npm run test/i);
  assert.match(deploy, /Invoke-CheckedNative[^\n]*npm run build/i);
  assert.match(deploy, /Invoke-CheckedNative[^\n]*git diff --check/i);
  assert.match(deploy, /if\s*\(\$LASTEXITCODE\s*-ne\s*0\)\s*\{\s*throw/i);
  assert.match(deploy, /backup-runtime-db\.cjs/i);
  assert.match(deploy, /verify-runtime-config\.cjs/i);
  assert.match(deploy, /configure-runtime-gateways\.cjs/i);
  assert.match(deploy, /probe-production-gateways\.mjs/i);
  assert.match(deploy, /& node \$gatewayProbe --validate-only/i);
  assert.ok(
    deploy.indexOf('& node $gatewayProbe --validate-only') < deploy.indexOf('Write-Host "Building $commit..."'),
    'gateway credential format validation must run before the full build gate',
  );
  assert.match(deploy, /SHUBAO_IMAGE_API_KEY requires SHUBAO_VISION_API_KEY/i);
  assert.match(deploy, /--vision-only/i);
  assert.match(deploy, /--replace-vision-key/i);
  assert.match(deploy, /Authenticated production gateway probe failed/i);
  assert.match(deploy, /shubao-runtime-tools/i);
  assert.match(deploy, /remoteRuntimeHelperDir\/verify-runtime-config\.cjs/i);
  assert.match(deploy, /remoteRuntimeHelperDir\/configure-runtime-gateways\.cjs/i);
  assert.match(deploy, /SHUBAO_IMAGE_API_KEY/);
  assert.match(deploy, /SHUBAO_VISION_API_KEY/);
  assert.doesNotMatch(deploy, /SHUBAO_FAL_KEY|FAL_KEY/);
  assert.match(deploy, /Invoke-LockedRemote[^\n]*-InputText\s+\$runtimePayload/i);
  assert.doesNotMatch(deploy, /--replace-segmentation-key/i);
  assert.match(deploy, /root\.env/);
  assert.match(deploy, /server\.env/);
  assert.match(deploy, /server\/\.env/i);
  assert.match(deploy, /--peer/i);
  assert.match(deploy, /& scp @ssh @uploadSources/i);
  assert.doesNotMatch(deploy, /(?:^|[;&\s])sqlite3\s/m);
  assert.match(deploy, /--exclude='server\/works\.db'/);
  assert.match(deploy, /--exclude='server\/\.auth-session-secret'/);
  assert.match(deploy, /deploy-backups/);
  assert.match(deploy, /tail -n \+4/);
  assert.match(deploy, /old backup retention cleanup failed/i);
  assert.match(deploymentLockRunner, /flock -n/);
  assert.match(deploy, /ProcessStartInfo/);
  assert.match(deploy, /Assert-DeploymentLockHeld/);
  assert.match(deploy, /LOCK_ACQUIRED/);
  assert.doesNotMatch(deploy, /rm -rf -- '\$remoteLock'/);
  assert.match(deploy, /npm ci --omit=dev/);
  assert.match(deploy, /seq 1 60/);
  assert.match(deploy, /seq 1 120/);
  assert.match(deploy, /curl -fsS http:\/\/127\.0\.0\.1:3002\/health/);
  assert.match(deploy, /catch\s*\{/);
  assert.match(deploy, /rollback/i);
  assert.match(deploy, /\$releaseStarted\s*=\s*\$false/);
  assert.match(deploy, /if\s*\(\$releaseStarted\)/);
  const releaseWindow = deploy.slice(deploy.indexOf("tar xzf '$remoteReleaseArchive'"), deploy.indexOf('Wait-PublicProductionReady'));
  assert.doesNotMatch(releaseWindow, /pm2 restart shubao/);
  assert.match(deploy, /pm2 startOrReload ecosystem\.production\.config\.cjs --only shubao-production --update-env/);
  assert.equal((deploy.match(/pm2 save/g) || []).length, 2);
  assert.match(deploy, /verify-production-billing\.ps1/);
  assert.match(deploy, /verify-production-ecommerce\.ps1/);
  assert.match(verify, /verify-production-billing\.mjs/);
  assert.match(ecommerceVerify, /verify-production-ecommerce\.mjs/);
  assert.doesNotMatch(verify, /--session-token/);
  assert.doesNotMatch(ecommerceVerify, /--session-token/);
  assert.match(deploy, /pm2 pid shubao/);
  assert.doesNotMatch(deploy, /pm2 jlist/);
  assert.ok(
    deploy.indexOf('$initialVerificationPid = Get-RemotePm2ProcessId')
      < deploy.indexOf('Authenticated ecommerce production verification failed'),
    'the deploy must capture PM2 identity before the first real ecommerce task',
  );
  assert.match(deploy, /PM2 process restarted during initial ecommerce verification/i);
  assert.match(deploy, /Start-Sleep -Seconds \$CanarySeconds/);
  assert.match(deploy, /process restarted during canary/i);
});

test('PowerShell canary token validation is case-sensitive and rejects trailing input', { skip: process.platform !== 'win32' }, () => {
  const helperPath = fileURLToPath(canarySessionHelperUrl).replaceAll("'", "''");
  const evaluate = token => spawnSync('powershell', [
    '-NoProfile',
    '-Command',
    `. '${helperPath}'; if (Test-CanarySessionTokenFormat $env:TOKEN_UNDER_TEST) { exit 0 } else { exit 1 }`,
  ], { env: { ...process.env, TOKEN_UNDER_TEST: token } }).status === 0;

  assert.equal(evaluate('eyJlbWFpbCI6InRlc3QifQ.signature'), true);
  assert.equal(evaluate('EYJlbWFpbCI6InRlc3QifQ.signature'), false);
  assert.equal(evaluate('eyJlbWFpbCI6InRlc3QifQ.signature\n'), false);
});

test('deployment lock is process-backed and the foreground fences every production mutation', () => {
  assert.match(deploymentLockRunner, /command -v flock/);
  assert.match(deploy, /function\s+Invoke-LockedRemote/);
  assert.match(deploy, /StandardInput\.WriteLine/);
  assert.match(deploy, /ReadLineAsync/);
  assert.match(deploy, /AddSeconds\(\$TimeoutSeconds \+ 60\)/);
  assert.match(deploy, /RedirectStandardInput\s*=\s*\$true/);
  assert.match(deploy, /lockProcessInfo\.Arguments\s*=/);
  assert.doesNotMatch(deploy, /ArgumentList\.Add/);
  assert.match(deploy, /StandardInput\.Close\(\)/);
  assert.match(deploy, /HasExited/);
  assert.match(deploy, /\.Kill\(/);
  assert.doesNotMatch(deploy, /Start-Job/);
  assert.doesNotMatch(deploy, /mmin \+/);
  assert.doesNotMatch(deploy, /heartbeat/);
  assert.ok((deploy.match(/Assert-DeploymentLockHeld/g) || []).length >= 5);
  assert.ok((deploy.match(/Invoke-LockedRemote\s+-Command/g) || []).length >= 8);
  assert.match(deploy, /deployment-lock-runner\.sh/);
  assert.match(deploymentLockRunner, /flock\s+-n/);
  assert.match(deploymentLockRunner, /base64\s+-d/);
  assert.match(deploymentLockRunner, /input_payload=.*tr -d/);
  assert.match(deploymentLockRunner, /timeout\s+--kill-after=30s/);
  assert.doesNotMatch(deploymentLockRunner, /--foreground/);
  assert.match(deploymentLockRunner, /printf\s+"\\nLOCK_RESULT/);
  assert.match(deploymentLockRunner, /LOCK_RESULT/);
});

test('production uses one cluster worker with readiness and graceful background draining', () => {
  assert.match(deploy, /ecosystem\.production\.config\.cjs/);
  assert.doesNotMatch(deploy, /ecosystem\.production\.cjs(?:\s|['"])/);
  assert.match(productionEcosystem, /name:\s*['"]shubao-production['"]/);
  assert.match(productionEcosystem, /PORT:\s*['"]3002['"]/);
  assert.match(productionEcosystem, /DISABLE_DIRECT_HTTPS:\s*['"]1['"]/);
  assert.match(productionEcosystem, /exec_mode:\s*['"]cluster['"]/);
  assert.match(productionEcosystem, /instances:\s*1/);
  assert.match(productionEcosystem, /wait_ready:\s*true/);
  assert.match(productionEcosystem, /listen_timeout:\s*120_000/);
  assert.match(productionEcosystem, /kill_timeout:\s*1_200_000/);
  assert.match(serverSource, /process\.send\?\.\('ready'\)/);
  assert.match(serverSource, /orchestrator\.waitForIdle/);
  assert.match(serverSource, /imageGenerationPool\.waitForIdle/);
  assert.match(serverSource, /process\.env\.DISABLE_DIRECT_HTTPS\s*!==\s*['"]1['"]/);
  assert.match(serverSource, /if\s*\(directHttpsEnabled\s*&&\s*fs\.existsSync\(certPath\)\s*&&\s*fs\.existsSync\(keyPath\)\)/);
});

test('one-time migration probe closes its readonly database before returning status', () => {
  assert.match(ecommerceIdleProbe, /process\.exitCode\s*=/);
  assert.doesNotMatch(ecommerceIdleProbe, /process\.exit\(/);
  assert.match(ecommerceIdleProbe, /finally\s*\{\s*db\.close\(\)/);
  assert.match(ecommerceIdleProbe, /ecommerce_jobs/);
  assert.match(ecommerceIdleProbe, /canvas_generation_jobs/);
  assert.match(ecommerceIdleProbe, /content_generation_jobs/);
  assert.match(ecommerceIdleProbe, /tasks/);
  assert.match(ecommerceIdleProbe, /status = 'processing' OR \(status = 'pending' AND updated_at >= datetime\('now', '-15 minutes'\)\)/);
});

test('production static files switch through a versioned atomic symlink', () => {
  const nginx = readFileSync(new URL('../scripts/nginx/shuimg.cn.conf', import.meta.url), 'utf8');
  assert.match(nginx, /root \/var\/www\/shubao\/current;/);
  assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:3002/);
  assert.match(deploy, /\/var\/www\/shubao\/releases/);
  assert.match(deploy, /\$remoteStaticNext = "\$WebRoot\.next"/);
  assert.match(deploy, /ln -s \$remoteStaticRelease \$remoteStaticNext/);
  assert.match(deploy, /mv -Tf \$remoteStaticNext \$WebRoot/);
  assert.doesNotMatch(deploy, /sudo cp -a \$RemoteDir\/dist\/\. \$WebRoot\//);
});

test('one-time PM2 migration cuts traffic to a healthy blue-green worker before retiring the legacy process', () => {
  const clusterStart = deploy.indexOf('pm2 start ecosystem.production.config.cjs --only shubao-production --update-env');
  const staleMisclassifiedDelete = deploy.indexOf('pm2 delete ecosystem.production >/dev/null 2>&1 || true');
  const clusterHealth = deploy.indexOf('curl -fsS http://127.0.0.1:3002/health');
  const nginxReload = deploy.indexOf('sudo systemctl reload nginx');
  const canaryWait = deploy.indexOf('Start-Sleep -Seconds $CanarySeconds');
  const legacyDelete = deploy.indexOf('pm2 delete shubao >/dev/null 2>&1 || true');
  assert.ok(staleMisclassifiedDelete >= 0 && staleMisclassifiedDelete < clusterStart);
  assert.ok(clusterStart >= 0 && clusterStart < clusterHealth);
  assert.ok(clusterHealth < nginxReload);
  assert.ok(nginxReload < canaryWait);
  assert.ok(canaryWait < legacyDelete);
  assert.match(deploy, /ss -Htn state established/);
});

test('first-migration rollback restores and proves legacy health before switching traffic or retiring the cluster', () => {
  assert.match(deploy, /legacy-pid/);
  assert.match(deploy, /legacy-server\.sha256/);
  assert.match(deploy, /sha256sum -c \$remoteBackup\/legacy-server\.sha256/);
  const rollback = deploy.slice(deploy.indexOf('$rollbackCommand ='));
  const rollbackSteps = [
    'legacy_pid_before=',
    'legacy-pid',
    'legacy_pid_after=',
    'pm2 pid shubao',
    'if [ `"`$legacy_pid_after`" != `"`$legacy_pid_before`" ]',
    'pm2 restart shubao --update-env',
    'curl -fsS http://127.0.0.1:3001/health',
    'sudo cp $remoteBackup/nginx-config',
    'sudo systemctl reload nginx',
    'pm2 delete shubao-production',
  ];
  let previous = -1;
  for (const step of rollbackSteps) {
    const position = rollback.indexOf(step, previous + 1);
    assert.ok(position > previous, `rollback step is missing or out of order: ${step}`);
    previous = position;
  }
  assert.ok((deploy.match(/-TimeoutSeconds 2400/g) || []).length >= 2);
  for (const runtimeDirectory of ['generated-assets/', 'uploads/', 'temp_uploads/', 'cache_img/', 'cache_overlay/', 'extension_downloads/', 'extension_tasks/', 'backups/']) {
    assert.match(rollback, new RegExp(`--exclude=['"]${runtimeDirectory.replace('/', '\\/')}['"]`));
  }
});

test('extension task recovery recreates its runtime directory before every scheduled scan', () => {
  assert.match(extensionTaskManager, /function\s+ensureTasksDirectory\s*\(/);
  assert.match(extensionTaskManager, /function\s+recoverStaleTasks[\s\S]*?ensureTasksDirectory\(\)[\s\S]*?fs\.readdirSync\(TASKS_DIR\)/);
  assert.match(extensionTaskManager, /function\s+cleanExpiredTasks[\s\S]*?ensureTasksDirectory\(\)[\s\S]*?fs\.readdirSync\(TASKS_DIR\)/);
});

test('production deploy tolerates transient SSH handshake failures', () => {
  assert.match(deploy, /ConnectTimeout=15/);
  assert.match(deploy, /ConnectionAttempts=5/);
  assert.match(deploy, /ServerAliveInterval=15/);
  assert.match(deploy, /ServerAliveCountMax=3/);
});

test('production deploy retries the complete ecommerce canary without weakening its gate', () => {
  assert.match(deploy, /function\s+Invoke-EcommerceProductionVerification/i);
  assert.match(deploy, /\[int\]\$MaxAttempts\s*=\s*3/);
  assert.match(deploy, /for\s*\(\$attempt\s*=\s*1;\s*\$attempt\s*-le\s*\$MaxAttempts/i);
  assert.match(deploy, /Start-Sleep -Seconds \$RetryDelaySeconds/);
  assert.equal((deploy.match(/Invoke-EcommerceProductionVerification\s+-FailureMessage/g) || []).length, 2);
  assert.match(deploy, /throw \"\$FailureMessage after \$MaxAttempts attempts\"/);
});

test('production deploy uploads release helpers and archive in one SCP session', () => {
  assert.equal((deploy.match(/& scp @ssh/g) || []).length, 1);
  assert.match(deploy, /\$uploadSources\s*=\s*@\(/);
  assert.match(deploy, /\$runtimeConfigHelper/);
  assert.match(deploy, /\$runtimeConfigUpdater/);
  assert.match(deploy, /\$databaseBackupHelper/);
  assert.match(deploy, /\$archive/);
  assert.match(deploy, /& scp @ssh @uploadSources/);
});

test('production deploy installs and rolls back the versioned Nginx security contract', () => {
  const nginxConfigUrl = new URL('../scripts/nginx/shuimg.cn.conf', import.meta.url);
  assert.equal(existsSync(nginxConfigUrl), true);
  const nginx = readFileSync(nginxConfigUrl, 'utf8');
  assert.match(nginx, /add_header X-Content-Type-Options "nosniff" always/);
  assert.match(nginx, /add_header X-Frame-Options "SAMEORIGIN" always/);
  assert.match(nginx, /add_header Referrer-Policy "strict-origin-when-cross-origin" always/);
  assert.match(nginx, /add_header Permissions-Policy "camera=\(\), microphone=\(\), geolocation=\(\)" always/);
  assert.match(nginx, /proxy_hide_header X-Content-Type-Options/);
  assert.match(deploy, /nginx[\\/]shuimg\.cn\.conf/);
  assert.match(deploy, /dist server scripts\/nginx\/shuimg\.cn\.conf/);
  assert.match(deploy, /nginx-config/);
  assert.match(deploy, /sudo nginx -t/);
  assert.match(deploy, /sudo systemctl reload nginx/);
  assert.match(deploy, /restore.*nginx|nginx.*restore/i);
});

test('runtime gateway updater accepts secrets only through stdin and rolls files back atomically', () => {
  assert.match(runtimeConfigUpdater, /process\.stdin/);
  assert.match(runtimeConfigUpdater, /JSON\.parse/);
  assert.match(runtimeConfigUpdater, /0o600/);
  assert.match(runtimeConfigUpdater, /renameSync/);
  assert.match(runtimeConfigUpdater, /configureRuntimeFiles/);
  assert.doesNotMatch(runtimeConfigUpdater, /FAL_KEY|replaceSegmentationSecret|replace-segmentation-key/);
  assert.doesNotMatch(runtimeConfigUpdater, /console\.(?:log|error)\([^\n]*(?:IMAGE_API_KEY|MINI_API_KEY)/);
});

test('production runtime verifier fails closed without exposing secret values', () => {
  assert.match(runtimeConfigVerifier, /IMAGE_PRIMARY_BASE_URL/);
  assert.match(runtimeConfigVerifier, /https:\/\/task-api-1-cn\.65535\.space/);
  assert.match(runtimeConfigVerifier, /IMAGE_OVERFLOW_BASE_URL/);
  assert.match(runtimeConfigVerifier, /IMAGE_OVERFLOW_BASE_URL:\s*['"]['"]/);
  assert.match(runtimeConfigVerifier, /IMAGE_BASE_URL:\s*['"]['"]/);
  assert.match(runtimeConfigVerifier, /IMAGE_AUTH_STRATEGY[\s\S]*bearer/);
  assert.match(runtimeConfigVerifier, /IMAGE_PROVIDER_PROTOCOL[\s\S]*native-tasks/);
  assert.match(runtimeConfigVerifier, /IMAGE_TASK_SUBMIT_PATH[\s\S]*\/v1\/tasks/);
  assert.match(runtimeConfigVerifier, /MINI_BASE_URL/);
  assert.match(runtimeConfigVerifier, /https:\/\/api2\.65535\.space/);
  assert.match(runtimeConfigVerifier, /MINI_MODEL[\s\S]*gpt-5\.6-luna/);
  assert.match(runtimeConfigVerifier, /IMAGE_API_KEY/);
  assert.match(runtimeConfigVerifier, /MINI_API_KEY/);
  assert.doesNotMatch(runtimeConfigVerifier, /FAL_KEY/);
  assert.match(runtimeConfigVerifier, /0o077/);
  assert.doesNotMatch(runtimeConfigVerifier, /console\.(?:log|error)\([^\n]*(?:secret|value)/i);
});

test('runtime database backup helper resolves the deployed driver and closes the source', () => {
  assert.match(backupHelper, /require\.resolve\('better-sqlite3'/);
  assert.match(backupHelper, /db\.backup\(path\.resolve\(destination\)\)/);
  assert.match(backupHelper, /db\.close\(\)/);
});

test('production verifier checks public health, billing catalog, and owner entitlement', () => {
  assert.doesNotMatch(verify, /\$home\s*=/i);
  assert.match(nodeVerify, /https:\/\/shuimg\.cn/);
  assert.match(nodeVerify, /\/health/);
  assert.match(nodeVerify, /\/api\/billing\/catalog/);
  assert.match(nodeVerify, /unlimited/i);
  assert.match(verify, /SessionToken/);
  assert.match(nodeVerify, /enabled payment provider/i);
  assert.match(nodeVerify, /\/api\/billing\/quote/);
  assert.match(nodeVerify, /balance changed after quote/i);
  assert.match(nodeVerify, /imageQueue/);
});

test('production verifier uses the project Node TLS stack with bounded retries', () => {
  assert.match(verify, /& node \$verifier/);
  assert.match(nodeVerify, /maxAttempts\s*=\s*3/);
  assert.match(nodeVerify, /Production verification passed/);
});
