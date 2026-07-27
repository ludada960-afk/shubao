import test from 'node:test';
import assert from 'node:assert/strict';

import { isAllowedBetaEmail, isUnlimitedBetaEmail, normalizeEmail, requireBetaEmail } from '../server/accessPolicy.mjs';

test('normalizes and allows the closed-beta owner email', () => {
  assert.equal(normalizeEmail(' 867550189@QQ.COM '), '867550189@qq.com');
  assert.equal(isAllowedBetaEmail(' 867550189@QQ.COM '), true);
});


test('grants unlimited generation entitlement only to the owner account', () => {
  assert.equal(isUnlimitedBetaEmail(' 867550189@QQ.COM '), true);
  assert.equal(isUnlimitedBetaEmail('other@example.com'), false);
  assert.equal(isUnlimitedBetaEmail(''), false);
});

test('rejects other closed-beta emails and missing privileged identity', () => {
  assert.equal(isAllowedBetaEmail('other@example.com'), false);
  assert.deepEqual(requireBetaEmail(''), { ok: false, status: 401, error: '请先登录后再继续操作' });
  assert.deepEqual(requireBetaEmail('other@example.com'), { ok: false, status: 403, error: '当前账号暂时无法使用此功能' });
});
