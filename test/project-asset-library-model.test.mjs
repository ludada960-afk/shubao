import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canReuseProjectAsset,
  filterProjectAssetLibrary,
  normalizeProjectAssetLibrary,
  normalizeProjectAssetSelection,
  projectAssetRetentionStatus,
  projectAssetProductionStatus,
  projectAssetProductionOptions,
  PROJECT_ASSET_PRODUCTION_STATES,
  PROJECT_ASSET_PRODUCTION_FILTERS,
  projectAssetSelectionKey,
  toggleProjectAssetSelection,
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
  assert.equal(canReuseProjectAsset({ retentionState: 'marked', expiresAt: '2026-08-19T00:00:00.000Z' }, now), false);
  assert.equal(canReuseProjectAsset({ retentionState: 'active', expiresAt: '2026-08-21T00:00:00.000Z' }, now), true);
  assert.equal(canReuseProjectAsset({ retentionPinned: true }, now), true);
});

test('filters asset library by metadata, project, and retention state', () => {
  const assets = [
    { projectAssetId: 'image-1', projectId: 'project-1', contentHash: 'a', mediaKind: 'image', metadata: { displayName: '白色水杯', campaign: '春季上新' }, retentionPinned: true },
    { projectAssetId: 'audio-1', projectId: 'project-2', contentHash: 'b', mediaKind: 'audio', role: '配乐', retentionState: 'active' },
  ];
  assert.deepEqual(normalizedIds(filterProjectAssetLibrary(assets, { query: '水杯' })), ['image-1']);
  assert.deepEqual(normalizedIds(filterProjectAssetLibrary(assets, { query: '春季上新' })), ['image-1']);
  assert.deepEqual(normalizedIds(filterProjectAssetLibrary(assets, { query: 'image-1' })), ['image-1']);
  assert.deepEqual(normalizedIds(filterProjectAssetLibrary(assets, { query: 'project-2', retentionFilter: 'managed' })), ['audio-1']);
  assert.deepEqual(normalizedIds(filterProjectAssetLibrary(assets, { retentionFilter: 'pinned' })), ['image-1']);
});

test('filters and labels the production lifecycle independently from retention', () => {
  assert.deepEqual(PROJECT_ASSET_PRODUCTION_FILTERS.map(option => option.id), ['all', 'draft', 'candidate', 'delivered', 'archived']);
  assert.equal(projectAssetProductionStatus({ productionState: 'delivered' }).label, '已交付');
  assert.equal(projectAssetProductionStatus({ productionState: 'unknown' }).id, 'draft');
  const assets = [
    { projectAssetId: 'candidate', productionState: 'candidate' },
    { projectAssetId: 'delivered', productionState: 'delivered' },
  ];
  assert.deepEqual(filterProjectAssetLibrary(assets, { productionFilter: 'candidate' }).map(asset => asset.projectAssetId), ['candidate']);
  assert.equal(PROJECT_ASSET_PRODUCTION_STATES.length, 4);
  assert.deepEqual(projectAssetProductionOptions({ productionState: 'draft' }).map(option => option.id), ['draft', 'candidate', 'archived']);
  assert.deepEqual(projectAssetProductionOptions({ productionState: 'candidate' }).map(option => option.id), ['candidate', 'draft', 'archived']);
  assert.deepEqual(projectAssetProductionOptions({ productionState: 'delivered' }).map(option => option.id), ['delivered', 'archived']);
  assert.deepEqual(projectAssetProductionOptions({ productionState: 'archived' }).map(option => option.id), ['archived', 'draft']);
});

test('batch selection is keyed by canonical identity and excludes expired assets', () => {
  const reusable = { projectId: 'project-1', projectAssetId: 'asset-1', contentHash: 'hash-1', mediaKind: 'image' };
  const expired = { projectId: 'project-1', projectAssetId: 'asset-2', contentHash: 'hash-2', mediaKind: 'image', retentionState: 'marked' };
  const first = toggleProjectAssetSelection(new Set(), reusable, now);
  assert.deepEqual([...first], ['project-1:asset-1:hash-1']);
  assert.deepEqual([...toggleProjectAssetSelection(first, reusable, now)], []);
  assert.deepEqual([...toggleProjectAssetSelection(first, expired, now)], [...first]);
  assert.equal(projectAssetSelectionKey(reusable), 'project-1:asset-1:hash-1');
});

test('normalizes a selection after search/filter changes without retaining hidden or stale assets', () => {
  const visible = [{ projectId: 'project-1', projectAssetId: 'asset-1', contentHash: 'hash-1', mediaKind: 'image' }];
  const selected = new Set(['project-1:asset-1:hash-1', 'project-2:asset-2:hash-2']);
  assert.deepEqual([...normalizeProjectAssetSelection(selected, visible, now)], ['project-1:asset-1:hash-1']);
});

function normalizedIds(value) {
  return value.map(asset => asset.projectAssetId);
}
