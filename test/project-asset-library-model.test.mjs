import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterProjectAssetLibrary,
  normalizeProjectAssetLibrary,
  projectAssetRetentionStatus,
} from '../src/pages/Works/projectAssetLibraryModel.js';

const now = new Date('2026-08-20T00:00:00.000Z');

test('normalizes, deduplicates, and prioritizes current project assets without changing ownership fields', () => {
  const assets = normalizeProjectAssetLibrary([
    { projectAssetId: 'other', projectId: 'project-2', contentHash: 'hash-2', mediaKind: 'image', createdAt: '2026-08-20T00:00:00.000Z' },
    { projectAssetId: 'current', project: { id: 'project-1', title: '当前项目' }, contentHash: 'hash-1', media_kind: 'video', createdAt: '2026-08-19T00:00:00.000Z', retentionPinned: true },
    { projectAssetId: 'other', projectId: 'project-2', contentHash: 'hash-2', mediaKind: 'image', createdAt: '2026-08-18T00:00:00.000Z' },
    { projectAssetId: 'unsupported', projectId: 'project-1', contentHash: 'hash-3', mediaKind: 'document' },
  ], { currentProjectId: 'project-1' });

  assert.deepEqual(normalizedIds(assets), ['current', 'other']);
  assert.equal(assets[0].projectTitle, '当前项目');
  assert.equal(assets[0].mediaKind, 'video');
});

test('reports actionable retention states for pinned, managed, and expiring assets', () => {
  assert.equal(projectAssetRetentionStatus({ retentionPinned: true }, now).id, 'pinned');
  assert.deepEqual(projectAssetRetentionStatus({ expiresAt: '2026-08-21T00:00:00.000Z' }, now), {
    id: 'managed', label: '保留至 2026-08-21', detail: '可随时长期保留', tone: 'managed',
  });
  assert.equal(projectAssetRetentionStatus({ retentionState: 'marked', expiresAt: '2026-08-19T00:00:00.000Z' }, now).id, 'attention');
});

test('filters asset library by metadata, project, and retention state', () => {
  const assets = [
    { projectAssetId: 'image-1', projectId: 'project-1', contentHash: 'a', mediaKind: 'image', metadata: { displayName: '白色水杯' }, retentionPinned: true },
    { projectAssetId: 'audio-1', projectId: 'project-2', contentHash: 'b', mediaKind: 'audio', role: '配乐', retentionState: 'active' },
  ];
  assert.deepEqual(normalizedIds(filterProjectAssetLibrary(assets, { query: '水杯' })), ['image-1']);
  assert.deepEqual(normalizedIds(filterProjectAssetLibrary(assets, { query: 'project-2', retentionFilter: 'managed' })), ['audio-1']);
  assert.deepEqual(normalizedIds(filterProjectAssetLibrary(assets, { retentionFilter: 'pinned' })), ['image-1']);
});

function normalizedIds(value) {
  return value.map(asset => asset.projectAssetId);
}
