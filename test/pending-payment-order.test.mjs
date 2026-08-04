import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearPendingPaymentOrder,
  createPendingPaymentOrder,
  isTerminalPaymentOrderStatus,
  loadPendingPaymentOrder,
  savePendingPaymentOrder,
} from '../src/utils/pendingPaymentOrder.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

function order(overrides = {}) {
  return createPendingPaymentOrder({
    ownerEmail: 'buyer@example.com',
    orderId: 'order-123',
    productSku: 'ec_points_100',
    provider: 'wechat',
    idempotencyKey: 'idem-123',
    status: 'pending',
    checkout: { mode: 'redirect', url: 'https://pay.example.test/order-123' },
    ...overrides,
  }, { now: () => 1_000 });
}

test('persists only the resumable payment order contract', () => {
  const storage = memoryStorage();
  const record = order();
  assert.ok(record);
  assert.deepEqual(savePendingPaymentOrder(record, { storage }), record);
  assert.deepEqual(loadPendingPaymentOrder('BUYER@example.com', { storage, now: () => 1_500 }), record);
  assert.equal(JSON.parse(storage.getItem('shubao.pendingPaymentOrder.v1')).checkout.url, 'https://pay.example.test/order-123');
});

test('rejects unsafe checkout data and does not persist a malformed order', () => {
  const storage = memoryStorage();
  const record = order({ checkout: { url: 'javascript:alert(1)', secret: 'should-not-persist' } });
  assert.ok(record);
  assert.equal(record.checkout, undefined);
  const saved = savePendingPaymentOrder({
    ownerEmail: 'buyer@example.com',
    orderId: 'order-123',
    productSku: 'ec_points_100',
    provider: 'wechat',
    idempotencyKey: 'idem-123',
    status: 'pending',
    checkout: { url: 'https://pay.example.test/order-123', secret: 'should-not-persist' },
  }, { storage });
  assert.ok(saved);
  assert.deepEqual(JSON.parse(storage.getItem('shubao.pendingPaymentOrder.v1')).checkout, {
    url: 'https://pay.example.test/order-123',
  });
});

test('scopes recovery to the owner and clears expired orders', () => {
  const storage = memoryStorage();
  savePendingPaymentOrder(order(), { storage });
  assert.equal(loadPendingPaymentOrder('other@example.com', { storage, now: () => 1_500 }), null);
  assert.equal(loadPendingPaymentOrder('buyer@example.com', { storage, now: () => 1_000 + 8 * 24 * 60 * 60 * 1000 }), null);
  assert.equal(storage.getItem('shubao.pendingPaymentOrder.v1'), null);
});

test('clears completed orders and recognizes terminal statuses', () => {
  const storage = memoryStorage();
  savePendingPaymentOrder(order(), { storage });
  clearPendingPaymentOrder({ storage });
  assert.equal(loadPendingPaymentOrder('buyer@example.com', { storage, now: () => 1_500 }), null);
  assert.equal(isTerminalPaymentOrderStatus('credited'), true);
  assert.equal(isTerminalPaymentOrderStatus('pending'), false);
});
