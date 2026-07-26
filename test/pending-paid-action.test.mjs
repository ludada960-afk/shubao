import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearPendingPaidAction,
  createPendingPaidAction,
  loadPendingPaidAction,
  savePendingPaidAction,
} from '../src/utils/pendingPaidAction.js';

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
    has(key) { return values.has(key); },
  };
}

test('persists only serializable action references and excludes image payloads', () => {
  const storage = createStorage();
  const action = createPendingPaidAction({
    ownerEmail: ' Creator@Example.com ',
    source: 'ecommerce',
    route: '/ecommerce',
    draftId: 'draft-42',
    quoteId: 'quote-7',
    action: {
      type: 'ecommerce_generate',
      assetIds: ['asset-1'],
      imageFile: new Blob(['raw-image']),
      previewUrl: 'blob:https://shuimg.cn/temporary-preview',
      encodedImage: `data:image/png;base64,${'a'.repeat(256)}`,
      rawBase64: 'a'.repeat(256),
      callback: () => {},
    },
  }, { now: () => 1000 });

  assert.deepEqual(action, {
    version: 1,
    ownerEmail: 'creator@example.com',
    source: 'ecommerce',
    route: '/ecommerce',
    draftId: 'draft-42',
    action: { type: 'ecommerce_generate', assetIds: ['asset-1'] },
    quoteId: 'quote-7',
    createdAt: 1000,
  });

  savePendingPaidAction(action, { storage });
  assert.deepEqual(loadPendingPaidAction('CREATOR@example.com', { storage, now: () => 1001 }), action);
});

test('fails closed and clears records that are expired, malformed, version-mismatched, or owned by another user', () => {
  const storage = createStorage();
  const storageKey = 'shubao.pendingPaidAction.v1';
  const action = createPendingPaidAction({
    ownerEmail: 'owner@example.com', source: 'plog', route: '/plog', draftId: 'draft-1', action: { type: 'generate' },
  }, { now: () => 1 });

  savePendingPaidAction(action, { storage });
  assert.equal(loadPendingPaidAction('owner@example.com', { storage, now: () => 86_400_002 }), null);
  assert.equal(storage.has(storageKey), false);

  storage.setItem(storageKey, '{broken-json');
  assert.equal(loadPendingPaidAction('owner@example.com', { storage, now: () => 2 }), null);
  assert.equal(storage.has(storageKey), false);

  storage.setItem(storageKey, JSON.stringify({ ...action, version: 2 }));
  assert.equal(loadPendingPaidAction('owner@example.com', { storage, now: () => 2 }), null);
  assert.equal(storage.has(storageKey), false);

  savePendingPaidAction(action, { storage });
  assert.equal(loadPendingPaidAction('other@example.com', { storage, now: () => 2 }), null);
  assert.equal(storage.has(storageKey), false);

  clearPendingPaidAction({ storage });
  assert.equal(storage.has(storageKey), false);
});
