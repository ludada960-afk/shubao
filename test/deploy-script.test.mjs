import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const deploy = readFileSync(new URL('../scripts/deploy-production.ps1', import.meta.url), 'utf8');
const verify = readFileSync(new URL('../scripts/verify-production-billing.ps1', import.meta.url), 'utf8');
const nodeVerify = readFileSync(new URL('../scripts/verify-production-billing.mjs', import.meta.url), 'utf8');
const backupHelper = readFileSync(new URL('../scripts/backup-runtime-db.cjs', import.meta.url), 'utf8');

test('production deploy protects runtime state and has a reversible release gate', () => {
  assert.match(deploy, /SHUBAO_CANARY_SESSION_TOKEN is required for authenticated production deployment/);
  assert.match(deploy, /git[^\n]*diff --check/i);
  assert.match(deploy, /backup-runtime-db\.cjs/i);
  assert.match(deploy, /scp[^\n]*remoteDatabaseBackupHelper/i);
  assert.doesNotMatch(deploy, /(?:^|[;&\s])sqlite3\s/m);
  assert.match(deploy, /--exclude='server\/works\.db'/);
  assert.match(deploy, /--exclude='server\/\.auth-session-secret'/);
  assert.match(deploy, /deploy-backups/);
  assert.match(deploy, /catch\s*\{/);
  assert.match(deploy, /rollback/i);
  assert.match(deploy, /\$releaseStarted\s*=\s*\$false/);
  assert.match(deploy, /if\s*\(\$releaseStarted\)/);
  assert.equal((deploy.match(/pm2 restart shubao/g) || []).length, 1);
  assert.match(deploy, /verify-production-billing\.ps1/);
  assert.match(verify, /verify-production-billing\.mjs/);
  assert.match(deploy, /pm2 pid shubao/);
  assert.doesNotMatch(deploy, /pm2 jlist/);
  assert.match(deploy, /Start-Sleep -Seconds \$CanarySeconds/);
  assert.match(deploy, /process restarted during canary/i);
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
