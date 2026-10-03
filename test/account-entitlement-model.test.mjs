import test from 'node:test';
import assert from 'node:assert/strict';

import { accountEntitlementDisplay } from '../src/components/billing/accountEntitlementModel.js';

test('formats the signed-in authoritative AI credit balance', () => {
  /* 2026-10-03 用户批注：「206.4 上面不是有个 AI 积分吗，这个保留，
     然后 206.4 **右边**的 AI 积分几个字去掉，避免重复」。
     ⇒ `value` 原来带的那段单位，就是重复的那一次（按钮上方已经有一行小字）。
        改由组件负责呈现单位，这里只给**数字**。 */
  assert.deepEqual(accountEntitlementDisplay({
    logged: true,
    ecPoints: 12,
    unlimited: false,
    refreshStatus: 'ready',
  }), {
    value: '12',
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
    value: '12',
    label: '账户额度',
    state: 'refreshing',
  });
});
