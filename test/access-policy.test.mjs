import test from 'node:test';
import assert from 'node:assert/strict';

import { isAllowedBetaEmail, isUnlimitedBetaEmail, normalizeEmail, requireBetaEmail } from '../server/accessPolicy.mjs';

test('normalizes and allows the closed-beta owner email', () => {
  assert.equal(normalizeEmail(' 867550189@QQ.COM '), '867550189@qq.com');
  assert.equal(isAllowedBetaEmail(' 867550189@QQ.COM '), true);
});

test('allows the full beta tester account with unlimited usage without replacing the owner', () => {
  assert.equal(isAllowedBetaEmail(' 240485042@QQ.COM '), true);
  assert.equal(isUnlimitedBetaEmail(' 240485042@QQ.COM '), true);
  assert.equal(isAllowedBetaEmail('867550189@qq.com'), true);
  assert.equal(isUnlimitedBetaEmail('867550189@qq.com'), true);
});


test('rejects unlimited generation entitlement for unlisted accounts', () => {
  assert.equal(isUnlimitedBetaEmail(' 867550189@QQ.COM '), true);
  assert.equal(isUnlimitedBetaEmail('other@example.com'), false);
  assert.equal(isUnlimitedBetaEmail(''), false);
});

test('rejects other closed-beta emails and missing privileged identity', () => {
  assert.equal(isAllowedBetaEmail('other@example.com'), false);
  assert.deepEqual(requireBetaEmail(''), { ok: false, status: 401, error: '请先登录后再继续操作' });
  assert.deepEqual(requireBetaEmail('other@example.com'), { ok: false, status: 403, error: '当前账号暂时无法使用此功能' });
});

test('reads access and unlimited email configuration at call time', () => {
  const originalMode = process.env.SHUBAO_ACCESS_MODE;
  const originalClosed = process.env.SHUBAO_CLOSED_BETA_EMAILS;
  const originalUnlimited = process.env.SHUBAO_UNLIMITED_EMAILS;
  try {
    process.env.SHUBAO_ACCESS_MODE = 'closed';
    process.env.SHUBAO_CLOSED_BETA_EMAILS = 'closed@example.com';
    process.env.SHUBAO_UNLIMITED_EMAILS = 'unlimited@example.com';

    assert.equal(isAllowedBetaEmail('closed@example.com'), true);
    assert.equal(isAllowedBetaEmail('867550189@qq.com'), true);
    assert.equal(isUnlimitedBetaEmail('unlimited@example.com'), true);
    assert.equal(isUnlimitedBetaEmail('867550189@qq.com'), true);
  } finally {
    for (const [key, value] of [
      ['SHUBAO_ACCESS_MODE', originalMode],
      ['SHUBAO_CLOSED_BETA_EMAILS', originalClosed],
      ['SHUBAO_UNLIMITED_EMAILS', originalUnlimited],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
