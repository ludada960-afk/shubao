import test from 'node:test';
import assert from 'node:assert/strict';

import { accountEntitlementDisplay } from '../src/components/billing/accountEntitlementModel.js';

test('formats the signed-in authoritative AI credit balance', () => {
  assert.deepEqual(accountEntitlementDisplay({
    logged: true,
    ecPoints: 12,
    unlimited: false,
    refreshStatus: 'ready',
  }), {
    value: '12 AI 积分',
    label: '账户额度',
    state: 'ready',
  });
});

test('keeps unlimited access distinct from a numeric balance', () => {
  assert.deepEqual(accountEntitlementDisplay({
    logged: true,
    ecPoints: 0,
    unlimited: true,
    refreshStatus: 'ready',
  }), {
    value: '无限额度',
    label: 'AI 积分',
    state: 'unlimited',
  });
});

test('requests login instead of inventing a signed-out balance', () => {
  assert.deepEqual(accountEntitlementDisplay({
    logged: false,
    ecPoints: 999,
    unlimited: false,
    refreshStatus: 'ready',
  }), {
    value: '登录后查看额度',
    label: '账户额度',
    state: 'signed-out',
  });
});

test('preserves the confirmed balance while a refresh is pending', () => {
  assert.deepEqual(accountEntitlementDisplay({
    logged: true,
    ecPoints: 12,
    unlimited: false,
    refreshStatus: 'refreshing',
  }), {
    value: '12 AI 积分',
    label: '账户额度',
    state: 'refreshing',
  });
});
