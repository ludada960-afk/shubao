import test from 'node:test';
import assert from 'node:assert/strict';

import { generateCompleteImageSet } from '../server/contentImageGeneration.mjs';

const tasks = ['cover', 'p1', 'p2'].map(id => ({ id }));

test('content image generation recovers missing images before completing', async () => {
  const attempts = new Map();
  const progress = [];
  const result = await generateCompleteImageSet({
    tasks,
    primaryAttempts: 2,
    recoveryAttempts: 2,
    primaryConcurrency: 3,
    recoveryConcurrency: 1,
    delay: async () => {},
    execute: async task => {
      const count = (attempts.get(task.id) || 0) + 1;
      attempts.set(task.id, count);
      if (task.id === 'p1' && count < 3) throw new Error('temporary upstream failure');
      return `/api/generated-assets/${task.id.padEnd(64, 'a')}.png`;
    },
    onComplete: entry => progress.push(entry.id),
  });

  assert.deepEqual(result.map(entry => entry.id), ['cover', 'p1', 'p2']);
  assert.deepEqual(progress.sort(), ['cover', 'p1', 'p2']);
  assert.equal(attempts.get('p1'), 3);
});

test('content image generation rejects incomplete sets after bounded recovery', async () => {
  await assert.rejects(
    generateCompleteImageSet({
      tasks,
      primaryAttempts: 2,
      recoveryAttempts: 3,
      delay: async () => {},
      execute: async task => {
        if (task.id === 'p2') {
          throw Object.assign(new Error('provider unavailable'), { code: 'IMAGE_PROVIDER_UNAVAILABLE' });
        }
        return `/api/generated-assets/${task.id.padEnd(64, 'b')}.png`;
      },
    }),
    error => {
      assert.equal(error.code, 'CONTENT_IMAGE_SET_INCOMPLETE');
      assert.equal(error.retryable, true);
      assert.deepEqual(error.failedIds, ['p2']);
      assert.equal(error.cause.code, 'IMAGE_PROVIDER_UNAVAILABLE');
      return true;
    },
  );
});

test('content image generation rejects duplicate task identifiers', async () => {
  await assert.rejects(
    generateCompleteImageSet({
      tasks: [{ id: 'cover' }, { id: 'cover' }],
      execute: async () => 'unused',
    }),
    /unique non-empty id/,
  );
});
