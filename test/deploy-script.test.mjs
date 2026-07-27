import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const deploy = readFileSync(new URL('../scripts/deploy-production.ps1', import.meta.url), 'utf8');
const verify = readFileSync(new URL('../scripts/verify-production-billing.ps1', import.meta.url), 'utf8');

test('production deploy protects runtime state and has a reversible release gate', () => {
  assert.match(deploy, /git[^\n]*diff --check/i);
  assert.match(deploy, /better-sqlite3[^\n]*\.backup/i);
  assert.doesNotMatch(deploy, /(?:^|[;&\s])sqlite3\s/m);
  assert.match(deploy, /--exclude='server\/works\.db'/);
  assert.match(deploy, /deploy-backups/);
  assert.match(deploy, /catch\s*\{/);
  assert.match(deploy, /rollback/i);
  assert.match(deploy, /\$releaseStarted\s*=\s*\$false/);
  assert.match(deploy, /if\s*\(\$releaseStarted\)/);
  assert.equal((deploy.match(/pm2 restart shubao/g) || []).length, 1);
  assert.match(deploy, /verify-production-billing\.ps1/);
  assert.match(deploy, /pm2 jlist/);
  assert.match(deploy, /Start-Sleep -Seconds \$CanarySeconds/);
  assert.match(deploy, /restart count increased/i);
});

test('production verifier checks public health, billing catalog, and owner entitlement', () => {
  assert.match(verify, /https:\/\/shuimg\.cn/);
  assert.match(verify, /\/health/);
  assert.match(verify, /\/api\/billing\/catalog/);
  assert.match(verify, /unlimited/i);
  assert.match(verify, /SessionToken/);
  assert.match(verify, /enabled payment provider/i);
  assert.match(verify, /\/api\/billing\/quote/);
  assert.match(verify, /balance changed after quote/i);
  assert.match(verify, /imageQueue/);
});
