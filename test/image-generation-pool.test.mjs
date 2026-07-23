import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageGenerationPool } from '../server/imageGenerationPool.mjs';

test('limits all image generation work through one shared concurrency pool', async () => {
  const pool = createImageGenerationPool({ concurrency: 2, maxQueue: 4 });
  let active = 0;
  let peak = 0;
  const completed = [];

  await Promise.all([0, 1, 2, 3].map(id => pool.run(async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 8));
    completed.push(id);
    active -= 1;
    return id;
  })));

  assert.equal(peak, 2);
  assert.deepEqual(completed.sort(), [0, 1, 2, 3]);
  assert.equal(pool.stats().queued, 0);
  assert.equal(pool.stats().active, 0);
});

test('rejects excess queued image work instead of exhausting process memory', async () => {
  const pool = createImageGenerationPool({ concurrency: 1, maxQueue: 1 });
  let release;
  const blocking = pool.run(() => new Promise(resolve => { release = resolve; }));
  const queued = pool.run(async () => 'queued');
  await assert.rejects(pool.run(async () => 'overflow'), /busy/i);
  release('first');
  await Promise.all([blocking, queued]);
});
