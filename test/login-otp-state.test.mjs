import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createLoginOtpState,
  beginLoginAttempt,
  loginOtpReducer,
  remainingResendSeconds,
} from '../src/components/business/loginOtpState.js';

const loginModalSource = readFileSync(new URL('../src/components/business/Modals.jsx', import.meta.url), 'utf8');
const sharedUiSource = readFileSync(new URL('../src/components/ui/index.jsx', import.meta.url), 'utf8');

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

test('starting a new login attempt never restores an old OTP', () => {
  const next = beginLoginAttempt({ email: 'a@example.com', code: '123456', step: 'code' });
  assert.equal(next.email, 'a@example.com');
  assert.equal(next.code, '');
  assert.equal(next.step, 'email');
});

test('opening the email step focuses the address field immediately', () => {
  const emailInput = loginModalSource.match(/<input\s+placeholder="邮箱地址"[\s\S]*?\/>/)?.[0] || '';
  assert.match(emailInput, /autoFocus/);
});

test('shared in-app modals expose an accessible modal dialog surface', () => {
  assert.match(sharedUiSource, /role="dialog"/);
  assert.match(sharedUiSource, /aria-modal="true"/);
});
