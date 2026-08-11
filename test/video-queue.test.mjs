import test from 'node:test';
import assert from 'node:assert/strict';

import { createOwnerFairVideoQueue } from '../server/videoQueue.mjs';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

test('owner-fair queue rotates owners while respecting route capacity', async t => {
  const started = [];
  const release = [];
  const queue = createOwnerFairVideoQueue({ capacities: { seedance: 2, h3: 1 } });
  t.after(() => queue.close());

  const task = (owner, id) => async () => {
    started.push(`${owner}:${id}`);
    await new Promise(resolve => release.push(resolve));
  };
  assert.equal(queue.enqueue({ routeId: 'seedance', ownerEmail: 'a@example.com', jobId: 'a1', task: task('a', '1') }), true);
  assert.equal(queue.enqueue({ routeId: 'seedance', ownerEmail: 'a@example.com', jobId: 'a2', task: task('a', '2') }), true);
  assert.equal(queue.enqueue({ routeId: 'seedance', ownerEmail: 'b@example.com', jobId: 'b1', task: task('b', '1') }), true);
  assert.equal(queue.enqueue({ routeId: 'seedance', ownerEmail: 'b@example.com', jobId: 'b1', task: task('b', 'duplicate') }), false);

  await pause(10);
  assert.deepEqual(started, ['a:1', 'b:1']);
  assert.equal(queue.stats('seedance').running, 2);

  release.shift()();
  await pause(10);
  assert.deepEqual(started, ['a:1', 'b:1', 'a:2']);
  assert.equal(queue.stats('seedance').running, 2);
  release.forEach(resolve => resolve());
});

test('H3 route has one slot and does not block Seedance route', async t => {
  const started = [];
  const release = [];
  const queue = createOwnerFairVideoQueue({ capacities: { seedance: 2, h3: 1 } });
  t.after(() => queue.close());
  const hold = id => async () => {
    started.push(id);
    await new Promise(resolve => release.push(resolve));
  };
  queue.enqueue({ routeId: 'h3', ownerEmail: 'a@example.com', jobId: 'h1', task: hold('h1') });
  queue.enqueue({ routeId: 'h3', ownerEmail: 'b@example.com', jobId: 'h2', task: hold('h2') });
  queue.enqueue({ routeId: 'seedance', ownerEmail: 'b@example.com', jobId: 's1', task: hold('s1') });
  await pause(10);
  assert.deepEqual(started.sort(), ['h1', 's1']);
  assert.equal(queue.stats('h3').queued, 1);
  release.forEach(resolve => resolve());
});
