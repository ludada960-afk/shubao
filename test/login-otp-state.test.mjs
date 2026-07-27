import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createLoginOtpState,
  loginOtpReducer,
  remainingResendSeconds,
} from '../src/components/business/loginOtpState.js';

test('closing and reopening login clears one-time verification state', () => {
  const active = { ...createLoginOtpState(), email: 'owner@example.com', code: '123456', step: 'code', resendAt: 10_000 };
  assert.deepEqual(loginOtpReducer(active, { type: 'RESET' }), createLoginOtpState());
});

test('changing email clears the old code but keeps a recoverable verification path', () => {
  const active = { ...createLoginOtpState(), email: 'owner@example.com', code: '123456', step: 'code', resendAt: 70_000, hasActiveCode: true };
  const changed = loginOtpReducer(active, { type: 'EDIT_EMAIL' });
  assert.equal(changed.step, 'email');
  assert.equal(changed.code, '');
  assert.equal(changed.hasActiveCode, true);
  assert.equal(remainingResendSeconds(changed.resendAt, 20_001), 50);
  assert.equal(loginOtpReducer(changed, { type: 'RETURN_TO_CODE' }).step, 'code');
});

test('a new successful send always invalidates the previous code input', () => {
  const active = { ...createLoginOtpState(), code: '654321', step: 'code' };
  const sent = loginOtpReducer(active, { type: 'CODE_SENT', now: 1_000, cooldownMs: 60_000 });
  assert.equal(sent.code, '');
  assert.equal(sent.step, 'code');
  assert.equal(sent.resendAt, 61_000);
});
