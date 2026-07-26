import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ECOMMERCE_TASK_REFERENCE_TTL_MS,
  clearEcommerceTaskReference,
  loadEcommerceTaskReference,
  normalizeEcommerceAsset,
  saveEcommerceTaskReference,
  taskKey,
} from '../src/pages/Home/ec/ecommerceTaskProgressModel.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

test('normalizes every server asset state into a user-safe Chinese state', () => {
  const expected = {
    queued: '等待生成',
    draft: '等待生成',
    submitted: '正在生成',
    polling: '正在生成',
    downloading: '正在生成',
    quality_check: '质量检查',
    repairing: '正在修复',
    completed: '已完成',
    needs_review: '需要确认',
    failed: '失败',
    cancelled: '失败',
  };

  for (const [state, userState] of Object.entries(expected)) {
    assert.equal(normalizeEcommerceAsset({ assetId: `asset-${state}`, status: state }).userState, userState, state);
  }
  assert.equal(normalizeEcommerceAsset({ assetId: 'active', status: 'provider_waiting' }).userState, '正在生成');
  assert.equal(normalizeEcommerceAsset({ assetId: 'final', status: 'provider_finished', error: 'bad output' }).userState, '失败');
  assert.equal(normalizeEcommerceAsset({ assetId: 'unknown-final', status: 'provider_finished' }).userState, '失败');
});

test('normalizes an asset with Asset Plan role and never exposes a provider state as its label', () => {
  const asset = normalizeEcommerceAsset({
    assetId: 'detail-1',
    status: 'quality_check',
    stableUrl: '/api/generated-assets/detail-1.png',
    plan: { role: 'detail_slice_feature', label: '细节特写' },
  });

  assert.deepEqual(asset, {
    id: 'detail-1',
    role: 'detail_slice_feature',
    label: '细节特写',
    state: 'quality_check',
    userState: '质量检查',
    stableUrl: '/api/generated-assets/detail-1.png',
    error: '',
  });
  assert.doesNotMatch(asset.userState, /quality_check|provider/i);
});

test('task references are owner and draft isolated, versioned, and expire safely', () => {
  const storage = memoryStorage();
  const now = 1_700_000_000_000;
  const ownerEmail = 'Owner@Example.COM';
  const draftId = 'ec-draft-123';

  assert.equal(taskKey({ ownerEmail, draftId }), taskKey({ ownerEmail: 'owner@example.com', draftId }));
  assert.equal(saveEcommerceTaskReference({ ownerEmail, draftId, taskId: 'task-1', createdAt: now, storage }), true);
  assert.deepEqual(loadEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId, now, storage }), {
    taskId: 'task-1',
    createdAt: now,
  });
  assert.equal(loadEcommerceTaskReference({ ownerEmail: 'other@example.com', draftId, now, storage }), null);
  assert.equal(loadEcommerceTaskReference({ ownerEmail, draftId: 'ec-draft-other', now, storage }), null);

  storage.setItem(taskKey({ ownerEmail, draftId }), JSON.stringify({
    version: 1,
    ownerEmail: 'other@example.com',
    draftId,
    taskId: 'foreign-task',
    createdAt: now,
  }));
  assert.equal(loadEcommerceTaskReference({ ownerEmail, draftId, now, storage }), null);
  storage.setItem(taskKey({ ownerEmail, draftId }), JSON.stringify({
    version: 1,
    ownerEmail: 'other@example.com',
    draftId,
    taskId: 'foreign-task',
    createdAt: now,
  }));
  assert.equal(clearEcommerceTaskReference({ ownerEmail, draftId, taskId: 'foreign-task', storage }), false);

  assert.equal(saveEcommerceTaskReference({ ownerEmail, draftId, taskId: 'task-2', createdAt: now, storage }), true);
  assert.equal(loadEcommerceTaskReference({ ownerEmail, draftId, now: now + ECOMMERCE_TASK_REFERENCE_TTL_MS + 1, storage }), null);
  assert.equal(saveEcommerceTaskReference({ ownerEmail, draftId, taskId: 'task-3', createdAt: now, storage }), true);
  assert.equal(clearEcommerceTaskReference({ ownerEmail, draftId, taskId: 'wrong-task', storage }), false);
  assert.equal(clearEcommerceTaskReference({ ownerEmail, draftId, taskId: 'task-3', storage }), true);
  assert.equal(loadEcommerceTaskReference({ ownerEmail, draftId, now, storage }), null);
});

test('task reference helpers reject malformed owner, draft, task, and record data', () => {
  const storage = memoryStorage();
  assert.equal(taskKey({ ownerEmail: '', draftId: 'ec-draft-1' }), '');
  assert.equal(taskKey({ ownerEmail: 'owner@example.com', draftId: '' }), '');
  assert.equal(saveEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-1', taskId: '', storage }), false);
  storage.setItem(taskKey({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-1' }), '{not-json');
  assert.equal(loadEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-1', storage }), null);
});
