import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearDraftSnapshot,
  clearLegacyEcommerceDraftState,
  draftSnapshotKey,
  loadDraftSnapshot,
  saveDraftSnapshot,
} from '../src/pages/Home/ec/ecommerceDraftStore.js';

test('ecommerce workbench snapshots are owner and surface scoped', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const identity = { ownerEmail: 'Owner@Example.com', surface: 'home' };
  assert.match(draftSnapshotKey(identity), /owner%40example\.com:home$/);
  assert.equal(saveDraftSnapshot(identity, { description: '陶瓷杯', platform: '淘宝' }, storage), true);
  assert.equal(loadDraftSnapshot(identity, storage).description, '陶瓷杯');
  assert.equal(loadDraftSnapshot({ ownerEmail: 'other@example.com', surface: 'home' }, storage), null);
});

test('lifecycle migration clears old form, draft, task and indexed image state once per migration version', async () => {
  const values = new Map([
    ['sb-ec-workbench:v1:owner:home', 'snapshot'],
    ['sb-ecommerce-draft:v1:owner:home', 'draft'],
    ['sb-ecommerce-task:v1:owner:draft', 'task'],
    ['sb-creation-lifecycle:v2:migrated', '1'],
    ['unrelated-preference', 'keep'],
  ]);
  const storage = {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  let deletedDatabase = '';
  const indexedDB = {
    deleteDatabase(name) {
      deletedDatabase = name;
      const request = {};
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };

  assert.equal(await clearLegacyEcommerceDraftState({ storage, indexedDB }), true);
  assert.equal(values.has('sb-ec-workbench:v1:owner:home'), false);
  assert.equal(values.has('sb-ecommerce-draft:v1:owner:home'), false);
  assert.equal(values.has('sb-ecommerce-task:v1:owner:draft'), false);
  assert.equal(values.get('unrelated-preference'), 'keep');
  assert.equal(deletedDatabase, 'shubao-creation-drafts');

  deletedDatabase = '';
  assert.equal(await clearLegacyEcommerceDraftState({ storage, indexedDB }), false);
  assert.equal(deletedDatabase, '');
});

test('clearing a completed ecommerce cycle removes the owner-scoped snapshot', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const identity = { ownerEmail: 'owner@example.com', surface: 'home' };
  saveDraftSnapshot(identity, { description: '已完成商品' }, storage);
  assert.equal(clearDraftSnapshot(identity, storage), true);
  assert.equal(loadDraftSnapshot(identity, storage), null);
});
