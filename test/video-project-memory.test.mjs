import assert from 'node:assert/strict';
import test from 'node:test';

import {
  memoryFactSnapshot,
  normalizeProjectMemoryFact,
  normalizeProjectMemoryList,
} from '../server/videoProjectMemory.mjs';

test('normalizes bounded facts and strips runtime fields', () => {
  const fact = normalizeProjectMemoryFact({
    id: 'fact-1',
    key: 'heroMood',
    value: { tone: 'warm' },
    source: 'user',
    assetRefs: [{ assetId: 'asset-1', assetVersionId: 'version-1' }],
    status: 'active',
    revision: 2,
    createdAt: '2026-08-16T00:00:00Z',
    updatedAt: '2026-08-16T00:00:00Z',
    ownerEmail: 'secret@example.com',
    playbackUrl: 'https://signed.test/secret',
  });
  assert.deepEqual(memoryFactSnapshot(fact), {
    key: 'heroMood',
    value: { tone: 'warm' },
    source: 'user',
    assetRefs: [{ assetId: 'asset-1', assetVersionId: 'version-1' }],
    revision: 2,
  });
});

test('rejects oversized, invalid, and duplicate facts', () => {
  assert.throws(() => normalizeProjectMemoryFact({ key: 'x', value: 'a'.repeat(8193) }), /too large/);
  assert.throws(() => normalizeProjectMemoryFact({ key: 'x', value: {}, source: 'provider' }), /source/);
  assert.throws(() => normalizeProjectMemoryList([
    { key: 'x', value: 1 },
    { key: 'x', value: 2 },
  ]), /duplicate/);
});
