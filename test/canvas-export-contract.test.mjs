import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  resolveAssetProvenance,
  selectDeliverableNodes,
} from '../src/pages/EcCanvas/canvasAssetProvenance.js';
import { deliveryStrategy, safeDeliveryName } from '../src/pages/EcCanvas/browserFileDelivery.js';

const canvasSource = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');

test('asset provenance distinguishes source, generated, derived, and composition nodes', () => {
  assert.equal(resolveAssetProvenance({ kind: 'image', isProductSource: true, url: '/source.png' }), 'source');
  assert.equal(resolveAssetProvenance({ kind: 'output', role: '透明PNG素材', url: '/alpha.png' }), 'generated');
  assert.equal(resolveAssetProvenance({ kind: 'image', sourceKey: 'detail_long', derivedFromIds: ['a', 'b'], url: '/long.png' }), 'derived');
  assert.equal(resolveAssetProvenance({ kind: 'text', text: '卖点' }), 'composition');
});

test('normal export includes deliverables and excludes user source assets', () => {
  const nodes = [
    { id: 'source', kind: 'image', isProductSource: true, status: 'ready', url: '/source.png' },
    { id: 'generated', kind: 'output', status: 'completed', url: '/generated.png' },
    { id: 'derived', kind: 'image', provenance: 'derived', status: 'ready', url: '/derived.png' },
    { id: 'text', kind: 'text', text: 'copy' },
  ];
  const all = selectDeliverableNodes(nodes, new Set());
  assert.deepEqual(all.deliverables.map(node => node.id), ['generated', 'derived']);
  assert.deepEqual(all.excludedSources.map(node => node.id), ['source']);

  const selected = selectDeliverableNodes(nodes, new Set(['source', 'generated']));
  assert.deepEqual(selected.deliverables.map(node => node.id), ['generated']);
  assert.deepEqual(selected.excludedSources.map(node => node.id), ['source']);
});

test('Canvas export no longer packages JSON or loops automatic anchor downloads', () => {
  assert.doesNotMatch(canvasSource, /素材清单\.json/);
  assert.doesNotMatch(canvasSource, /素材包清单/);
  assert.match(canvasSource, /selectDeliverableNodes/);
  assert.match(canvasSource, /至少需要 2 张已生成的详情图/);
  assert.match(canvasSource, /disabled=\{disabled\}/);
});

test('delivery strategy asks for a directory or filename and has one-download fallbacks', () => {
  assert.equal(deliveryStrategy({ mode: 'images', fileCount: 3, capabilities: { directoryPicker: true } }), 'directory');
  assert.equal(deliveryStrategy({ mode: 'long-detail', fileCount: 1, capabilities: { saveFilePicker: true } }), 'save-file');
  assert.equal(deliveryStrategy({ mode: 'images', fileCount: 3, capabilities: {} }), 'zip');
  assert.equal(deliveryStrategy({ mode: 'images', fileCount: 1, capabilities: {} }), 'single-download');
  assert.equal(safeDeliveryName('商品/主图:01', 'PNG'), '商品-主图-01.png');
});
