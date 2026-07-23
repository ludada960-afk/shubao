import test from 'node:test';
import assert from 'node:assert/strict';

import { isAllowedBetaEmail, normalizeEmail, requireBetaEmail } from '../server/accessPolicy.mjs';

test('normalizes and allows the closed-beta owner email', () => {
  assert.equal(normalizeEmail(' 867550189@QQ.COM '), '867550189@qq.com');
  assert.equal(isAllowedBetaEmail(' 867550189@QQ.COM '), true);
});

test('rejects other closed-beta emails and missing privileged identity', () => {
  assert.equal(isAllowedBetaEmail('other@example.com'), false);
  assert.deepEqual(requireBetaEmail(''), { ok: false, status: 401, error: '请先登录后再使用内测功能' });
  assert.deepEqual(requireBetaEmail('other@example.com'), { ok: false, status: 403, error: '薯包AI 正在内测，仅受邀账号可以登录' });
});
