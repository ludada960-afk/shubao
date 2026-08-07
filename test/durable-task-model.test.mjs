import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeDurableTask } from '../src/store/durableTaskModel.js';

test('durable task summary preserves completed failed and total image counts', () => {
  const serverJob = {
    id: 'job-a',
    title: '保温杯套图',
    status: 'generating',
    error: '第 2 张商品一致性未通过',
    updatedAt: '2026-07-29T10:00:00.000Z',
    assets: [
      { assetId: 'main-1', state: 'completed' },
      { assetId: 'main-2', state: 'needs_review', error: '商品一致性未通过' },
      { assetId: 'main-3', state: 'polling' },
    ],
  };

  assert.deepEqual(normalizeDurableTask(serverJob), {
    id: 'job-a',
    title: '保温杯套图',
    status: 'generating',
    done: 1,
    total: 3,
    failed: 1,
    error: '第 2 张商品一致性未通过',
    updatedAt: serverJob.updatedAt,
    actions: ['open'],
    assets: [
      { id: 'main-1', state: 'completed', label: '图片', error: '' },
      { id: 'main-2', state: 'needs_review', label: '图片', error: '商品一致性未通过' },
      { id: 'main-3', state: 'polling', label: '图片', error: '' },
    ],
  });
});

test('terminal durable tasks expose dismissal separately from failed-item retry', () => {
  const task = normalizeDurableTask({
    id: 'job-failed',
    status: 'needs_review',
    assets: [{ assetId: 'detail-2', state: 'needs_review' }],
  });

  assert.deepEqual(task.actions, ['open', 'retry_failed', 'dismiss']);
  assert.equal(task.failed, 1);
  assert.deepEqual(normalizeDurableTask({ id: 'job-done', status: 'completed' }).actions, ['open', 'dismiss']);
});
