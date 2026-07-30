import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const deploy = readFileSync(new URL('../scripts/deploy-production.ps1', import.meta.url), 'utf8');
const verify = readFileSync(new URL('../scripts/verify-production-billing.ps1', import.meta.url), 'utf8');
const nodeVerify = readFileSync(new URL('../scripts/verify-production-billing.mjs', import.meta.url), 'utf8');
const ecommerceVerify = readFileSync(new URL('../scripts/verify-production-ecommerce.ps1', import.meta.url), 'utf8');
const backupHelper = readFileSync(new URL('../scripts/backup-runtime-db.cjs', import.meta.url), 'utf8');
const runtimeConfigVerifier = readFileSync(new URL('../scripts/verify-runtime-config.cjs', import.meta.url), 'utf8');

test('production deploy protects runtime state and has a reversible release gate', () => {
  assert.match(deploy, /SHUBAO_CANARY_SESSION_TOKEN is required for authenticated production deployment/);
  assert.match(deploy, /git[^\n]*diff --check/i);
  assert.match(deploy, /backup-runtime-db\.cjs/i);
  assert.match(deploy, /verify-runtime-config\.cjs/i);
  assert.match(deploy, /server\/\.env/i);
  assert.match(deploy, /--peer/i);
  assert.match(deploy, /scp[^\n]*remoteDatabaseBackupHelper/i);
  assert.doesNotMatch(deploy, /(?:^|[;&\s])sqlite3\s/m);
  assert.match(deploy, /--exclude='server\/works\.db'/);
  assert.match(deploy, /--exclude='server\/\.auth-session-secret'/);
  assert.match(deploy, /deploy-backups/);
  assert.match(deploy, /tail -n \+4/);
  assert.match(deploy, /old backup retention cleanup failed/i);
  assert.match(deploy, /npm ci --omit=dev/);
  assert.match(deploy, /seq 1 30/);
  assert.match(deploy, /curl -fsS http:\/\/127\.0\.0\.1:3001\/health/);
  assert.match(deploy, /catch\s*\{/);
  assert.match(deploy, /rollback/i);
  assert.match(deploy, /\$releaseStarted\s*=\s*\$false/);
  assert.match(deploy, /if\s*\(\$releaseStarted\)/);
  assert.equal((deploy.match(/pm2 restart shubao/g) || []).length, 1);
  assert.match(deploy, /pm2 restart shubao --update-env --max-memory-restart 1G/);
  assert.match(deploy, /verify-production-billing\.ps1/);
  assert.match(deploy, /verify-production-ecommerce\.ps1/);
  assert.match(verify, /verify-production-billing\.mjs/);
  assert.match(ecommerceVerify, /verify-production-ecommerce\.mjs/);
  assert.match(deploy, /pm2 pid shubao/);
  assert.doesNotMatch(deploy, /pm2 jlist/);
  assert.match(deploy, /Start-Sleep -Seconds \$CanarySeconds/);
  assert.match(deploy, /process restarted during canary/i);
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
  assert.match(runtimeConfigVerifier, /https:\/\/puppyrouter\.com/);
  assert.match(runtimeConfigVerifier, /MINI_MODEL[\s\S]*gpt-5\.6-luna/);
  assert.match(runtimeConfigVerifier, /IMAGE_API_KEY/);
  assert.match(runtimeConfigVerifier, /MINI_API_KEY/);
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
