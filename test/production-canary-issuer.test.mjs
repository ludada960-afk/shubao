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
  const billing = deploy.indexOf('verify-production-billing.ps1');
  /* 9-13：刷新点从 1 个变成 2 个 —— 主刷新 + 视频金丝雀 401 时的自愈重试。
     所以按「调用点」收集，而不是 lastIndexOf（那会被追加的重试调用带偏）。 */
  /* 9-13：鉴权校验统一走 Invoke-AuthenticatedVerification（失败会重新签发会话再试一次），
     所以「刷新」出现在两处：包装器内部 + 重启后的主刷新。断言按语义来：
     ① 包装器存在且内部会重新签发；② 主刷新在重启之后、鉴权计费校验之前。 */
  assert.match(deploy, /function Invoke-AuthenticatedVerification/, '鉴权校验必须统一走可自愈的包装器');
  const helperBody = deploy.slice(deploy.indexOf('function Invoke-AuthenticatedVerification'), deploy.indexOf('function Wait-PublicProductionReady'));
  assert.match(helperBody, /Refresh-CanarySessionAfterRestart/, '包装器失败后要重新签发金丝雀会话');
  assert.match(helperBody, /-le 2/, '最多重试一次（共两次）');
  const refreshCalls = [...deploy.matchAll(/(?:^|\n)\s*Refresh-CanarySessionAfterRestart\s*(?:\r?\n|$)/g)].map(match => match.index);
  const afterRestart = refreshCalls.filter(index => index > restart);
  assert.ok(afterRestart.length >= 1, '重启后必须刷新金丝雀会话');
  assert.ok(afterRestart[0] < billing, 'canary refresh must happen before authenticated billing verification');
  assert.match(deploy, /chmod 600[^\n]*remoteCanarySessionFile/);
  assert.match(deploy, /function\s+Invoke-BoundedSshCapture/i);
  assert.match(deploy, /Invoke-BoundedSshCapture[^\n]*-TimeoutSeconds\s+30/i);
  assert.match(deploy, /WaitForExit\([^\n]*TimeoutSeconds\s*\*\s*1000/i);
  assert.doesNotMatch(deploy, /Write-(?:Host|Output)[^\n]*canarySessionToken/i);
});
