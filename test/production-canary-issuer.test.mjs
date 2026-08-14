import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createSessionTokenService } from '../server/billing/contentBilling.mjs';
import { issueProductionCanarySession } from '../scripts/issue-production-canary-session.mjs';

test('production canary issuer signs with the restarted process secret', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'shubao-canary-'));
  try {
    const fallbackPath = path.join(directory, '.auth-session-secret');
    writeFileSync(fallbackPath, `${'fallback-secret-'.repeat(4)}\n`, { mode: 0o600 });
    const processSecret = 'restarted-process-secret-'.repeat(3);

    const issued = issueProductionCanarySession({
      ownerEmail: '867550189@qq.com',
      processEnvironment: { AUTH_SESSION_SECRET: processSecret },
      fallbackPath,
      now: () => Date.UTC(2026, 7, 15, 0, 0, 0),
    });

    const verifier = createSessionTokenService({
      secret: processSecret,
      now: () => Date.UTC(2026, 7, 15, 0, 0, 1),
    });
    assert.equal(verifier.verify(issued.token).email, '867550189@qq.com');
    assert.equal(readFileSync(fallbackPath, 'utf8').trim(), 'fallback-secret-'.repeat(4));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('production canary issuer falls back to the persisted application secret', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'shubao-canary-'));
  try {
    const fallbackPath = path.join(directory, '.auth-session-secret');
    const fallbackSecret = 'persisted-application-secret-'.repeat(3);
    writeFileSync(fallbackPath, `${fallbackSecret}\n`, { mode: 0o600 });

    const issued = issueProductionCanarySession({
      ownerEmail: '867550189@qq.com',
      processEnvironment: {},
      fallbackPath,
    });

    const verifier = createSessionTokenService({ secret: fallbackSecret });
    assert.equal(verifier.verify(issued.token).email, '867550189@qq.com');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('deploy refreshes the canary token after restart without logging it', () => {
  const deploy = readFileSync(new URL('../scripts/deploy-production.ps1', import.meta.url), 'utf8');
  const restart = deploy.indexOf('Remote restart or health check failed');
  const refresh = deploy.lastIndexOf('Refresh-CanarySessionAfterRestart');
  const billing = deploy.indexOf('verify-production-billing.ps1');

  assert.ok(restart >= 0 && restart < refresh, 'canary refresh must happen after the restarted app is healthy');
  assert.ok(refresh < billing, 'canary refresh must happen before authenticated billing verification');
  assert.match(deploy, /chmod 600[^\n]*remoteCanarySessionFile/);
  assert.doesNotMatch(deploy, /Write-(?:Host|Output)[^\n]*canarySessionToken/i);
});
