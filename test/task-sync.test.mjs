import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTransientTaskSyncError,
  taskSyncMessage,
  withTransientTaskSyncRetry,
} from '../src/services/taskSync.js';

test('task synchronization distinguishes a transient network failure from a job failure', () => {
  const network = new TypeError('Failed to fetch');
  assert.equal(isTransientTaskSyncError(network), true);
  assert.equal(taskSyncMessage(network), '任务进度同步暂时中断，生成仍在后台继续');
  assert.equal(isTransientTaskSyncError({ status: 401, message: 'unauthorized' }), false);
  assert.equal(taskSyncMessage({ status: 401 }), '登录状态已失效，请重新登录');
  assert.equal(taskSyncMessage({ status: 400, message: '任务参数无效' }), '任务列表暂时无法刷新，请稍后重试');
});

test('task synchronization retries only transient failures and stops at a bounded limit', async () => {
  let attempts = 0;
  const result = await withTransientTaskSyncRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw new TypeError('Failed to fetch');
    return 'ok';
  }, { retries: 2, baseDelayMs: 0 });
  assert.equal(result, 'ok');
  assert.equal(attempts, 3);

  attempts = 0;
  await assert.rejects(() => withTransientTaskSyncRetry(async () => {
    attempts += 1;
    throw new Error('invalid task state');
  }, { retries: 2, baseDelayMs: 0 }), /invalid task state/);
  assert.equal(attempts, 1);
});
