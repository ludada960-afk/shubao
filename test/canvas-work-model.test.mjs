import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildCanvasImportResult, normalizeCanvasWorkPanel } from '../src/pages/EcCanvas/canvasWorkModel.js';

test('Canvas work panel keeps only the signed owner local works and preserves server metadata', () => {
  const localWorks = [
    {
      id: 'mine-local',
      _saveKey: 'mine-local',
      _phone: ' Owner@Example.com ',
      _ecResult: true,
      product_name: '本地保温杯',
      productAssets: [{ assetId: 'local-product', url: '/api/generated-assets/' + 'a'.repeat(64) + '.png' }],
      images: [{ key: 'local-main', url: '/api/generated-assets/' + 'b'.repeat(64) + '.png' }],
    },
    {
      id: 'other-local',
      _saveKey: 'other-local',
      _phone: 'other@example.com',
      _ecResult: true,
      product_name: '其他账号作品',
      images: [{ key: 'other-main', url: '/api/generated-assets/' + 'c'.repeat(64) + '.png' }],
    },
    {
      id: 'legacy-unowned',
      _saveKey: 'legacy-unowned',
      _ecResult: true,
      product_name: '无归属旧缓存',
      images: [{ key: 'legacy-main', url: '/api/generated-assets/' + 'd'.repeat(64) + '.png' }],
    },
  ];
  const serverWorks = [
    {
      id: 'server-work',
      _saveKey: 'server-work',
      _phone: 'owner@example.com',
      _ecResult: true,
      product_name: '云端保温杯',
      projectId: 'project-1',
      sourceVersionId: 'source-version-1',
      resultVersionId: 'result-version-1',
      canvasSessionId: 'canvas-session-1',
      canvasSessionRevision: 4,
      productAssets: [{ assetId: 'server-product', url: '/api/generated-assets/' + 'e'.repeat(64) + '.png' }],
      images: [{ key: 'server-main', url: '/api/generated-assets/' + 'f'.repeat(64) + '.png' }],
    },
  ];

  const panel = normalizeCanvasWorkPanel({ localWorks, serverWorks, ownerEmail: 'owner@example.com' });

  assert.deepEqual(panel.map(work => work._saveKey), ['server-work', 'mine-local']);
  assert.equal(panel[0].projectId, 'project-1');
  assert.equal(panel[0].resultVersionId, 'result-version-1');
  assert.equal(panel[0].canvasSessionId, 'canvas-session-1');
  assert.equal(panel[0].canvasSessionRevision, 4);
  assert.equal(panel[0].productAssets[0].assetId, 'server-product');
});

test('Canvas open-work result preserves project, product and session metadata', () => {
  const result = buildCanvasImportResult({
    name: '云端保温杯',
    platform: '天猫',
    _saveKey: 'server-work',
    projectId: 'project-1',
    sourceVersionId: 'source-version-1',
    resultVersionId: 'result-version-1',
    canvasSessionId: 'canvas-session-1',
    canvasSessionRevision: 4,
    productAssets: [{ assetId: 'server-product', url: '/api/generated-assets/' + 'e'.repeat(64) + '.png' }],
    images: [{ key: 'server-main', url: '/api/generated-assets/' + 'f'.repeat(64) + '.png' }],
  }, { importId: 'import-1' });

  assert.equal(result.product_name, '云端保温杯');
  assert.equal(result.projectId, 'project-1');
  assert.equal(result.resultVersionId, 'result-version-1');
  assert.equal(result.canvasSessionId, 'canvas-session-1');
  assert.equal(result.canvasSessionRevision, 4);
  assert.deepEqual(result.productAssets, [{ assetId: 'server-product', url: '/api/generated-assets/' + 'e'.repeat(64) + '.png', key: 'image_1', label: 'image_1' }]);
  assert.deepEqual(result.images, { 'server-main': '/api/generated-assets/' + 'f'.repeat(64) + '.png' });
});

test('canvas-backed scripts have a declared package dependency', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.match(packageJson.dependencies?.canvas || '', /^\^?3\./);
});
