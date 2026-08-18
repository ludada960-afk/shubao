import test from 'node:test';
import assert from 'node:assert/strict';

import { parseVideoRange } from '../server/videoGeneration.mjs';

test('parses an explicit byte range without changing its bounds', () => {
  assert.deepEqual(parseVideoRange('bytes=2-5', 10), { start: 2, end: 5 });
});

test('parses an open-ended byte range through the end of the asset', () => {
  assert.deepEqual(parseVideoRange('bytes=6-', 10), { start: 6, end: 9 });
});

test('parses a suffix byte range from the end of the asset', () => {
  assert.deepEqual(parseVideoRange('bytes=-3', 10), { start: 7, end: 9 });
});

test('clamps a suffix byte range larger than the asset to the full asset', () => {
  assert.deepEqual(parseVideoRange('bytes=-99', 10), { start: 0, end: 9 });
});

test('distinguishes a missing range from an invalid or unsatisfiable range', () => {
  assert.equal(parseVideoRange('', 10), null);
  assert.equal(parseVideoRange('bytes=', 10), false);
  assert.equal(parseVideoRange('bytes=10-10', 10), false);
  assert.equal(parseVideoRange('bytes=4-2', 10), false);
});
