import test from 'node:test';
import assert from 'node:assert/strict';

import { createPaymentChannelRegistry } from '../server/billing/paymentChannels.mjs';

test('channel registry keeps balance active and online channels unavailable by default', () => {
  const registry = createPaymentChannelRegistry({ env: {} });

  assert.deepEqual(registry.ids(), ['balance', 'wechat_qr', 'alipay']);
  assert.equal(registry.isActive('balance'), true);
  assert.equal(registry.isActive('wechat_qr'), false);
  assert.equal(registry.isActive('alipay'), false);
  assert.deepEqual(registry.listChannels(), [
    {
      id: 'balance',
      label: '余额充值',
      kind: 'internal',
      status: 'active',
      enabled: true,
      description: '账户余额与积分套餐直接结算，当前可用',
    },
    {
      id: 'wechat_qr',
      label: '微信支付',
      kind: 'external',
      status: 'unavailable',
      enabled: false,
      availabilityNote: '即将开通',
      launchEnv: 'PAYMENT_CHANNEL_WECHAT_QR_ENABLED',
    },
    {
      id: 'alipay',
      label: '支付宝',
      kind: 'external',
      status: 'unavailable',
      enabled: false,
      availabilityNote: '即将开通',
      launchEnv: 'PAYMENT_CHANNEL_ALIPAY_ENABLED',
    },
  ]);
});

test('online channels flip active only through their explicit launch switches', () => {
  const registry = createPaymentChannelRegistry({
    env: { PAYMENT_CHANNEL_WECHAT_QR_ENABLED: '1' },
  });
  assert.equal(registry.isActive('wechat_qr'), true);
  assert.equal(registry.isActive('alipay'), false);

  // 开关位取值必须精确为 "1"；其他值（true/yes/0/空）都不放量。
  const strict = createPaymentChannelRegistry({
    env: { PAYMENT_CHANNEL_ALIPAY_ENABLED: 'true' },
  });
  assert.equal(strict.isActive('alipay'), false);
});

test('registry lookups reject unknown channels and invalid ids', () => {
  const registry = createPaymentChannelRegistry({ env: {} });
  assert.equal(registry.get('stripe'), null);
  assert.equal(registry.isActive('nope'), false);
  assert.equal(registry.get(''), null);
  assert.throws(() => createPaymentChannelRegistry({
    env: {},
    channels: [{ id: '../bad', label: 'x', kind: 'external', defaultStatus: 'unavailable' }],
  }), /invalid/i);
});