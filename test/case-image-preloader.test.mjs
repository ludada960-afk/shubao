import assert from 'node:assert/strict';
import test from 'node:test';

import { createCaseImagePreloader } from '../src/gallery/caseImagePreloader.js';

const tick = () => new Promise(resolve => setImmediate(resolve));

test('case preloader prioritizes active and next, deduplicates, and stays within concurrency two', async () => {
  let active = 0;
  let peak = 0;
  const started = [];
  const releases = [];
  const loadImage = url => new Promise(resolve => {
    active += 1;
    peak = Math.max(peak, active);
    started.push(url);
    releases.push(() => {
      active -= 1;
      resolve(url);
    });
  });
  const loader = createCaseImagePreloader({ loadImage, concurrency: 2 });
  const pending = loader.preload(['/a.png', '/b.png', '/b.png', '/c.png', '/d.png'], 2);

  await tick();
  assert.deepEqual(started, ['/b.png', '/c.png']);
  assert.equal(peak, 2);

  while (started.length < 4 || active > 0) {
    const release = releases.shift();
    if (release) release();
    await tick();
  }
  await pending;

  assert.equal(peak, 2);
  assert.deepEqual(new Set(started), new Set(['/a.png', '/b.png', '/c.png', '/d.png']));
});

test('case preloader reuses completed and in-flight requests across calls', async () => {
  const calls = [];
  const loader = createCaseImagePreloader({
    loadImage: async url => {
      calls.push(url);
      await tick();
      return url;
    },
    concurrency: 2,
  });

  await Promise.all([
    loader.preload(['/one.png', '/two.png'], 0),
    loader.preload(['/two.png', '/one.png'], 0),
  ]);

  assert.deepEqual(calls.sort(), ['/one.png', '/two.png']);
});

test('cancel prevents unscheduled images from starting', async () => {
  const started = [];
  const releases = [];
  const loader = createCaseImagePreloader({
    loadImage: url => new Promise(resolve => {
      started.push(url);
      releases.push(resolve);
    }),
    concurrency: 1,
  });
  const pending = loader.preload(['/one.png', '/two.png', '/three.png'], 0);

  await tick();
  loader.cancel();
  releases.shift()?.('/one.png');
  await pending;

  assert.deepEqual(started, ['/one.png']);
});
