import test from 'node:test';
import assert from 'node:assert/strict';
import { draftSnapshotKey, loadDraftSnapshot, saveDraftSnapshot } from '../src/pages/Home/ec/ecommerceDraftStore.js';

test('ecommerce workbench snapshots are owner and surface scoped', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const identity = { ownerEmail: 'Owner@Example.com', surface: 'home' };
  assert.match(draftSnapshotKey(identity), /owner%40example\.com:home$/);
  assert.equal(saveDraftSnapshot(identity, { description: '陶瓷杯', platform: '淘宝' }, storage), true);
  assert.equal(loadDraftSnapshot(identity, storage).description, '陶瓷杯');
  assert.equal(loadDraftSnapshot({ ownerEmail: 'other@example.com', surface: 'home' }, storage), null);
});
