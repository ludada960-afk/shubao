import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Canvas workbench offers real pixel layering before verified PSD download', async () => {
  const canvas = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const card = await readFile(new URL('../src/pages/EcCanvas/components/workflowNodes/modular/LayerWorkbenchNodeCard.jsx', import.meta.url), 'utf8');

  assert.match(canvas, /createCanvasPixelLayers,\s*exportCanvasPsd/);
  assert.match(canvas, /capabilities:\s*data\.capabilities/);
  assert.match(canvas, /capabilities:\s*node\.inputs\?\.capabilities\s*\|\|\s*\{\}/);
  assert.match(canvas, /onCreatePixelLayers:\s*node\.inputs\?\.compositionDocument\s*\?\s*\(\)\s*=>\s*handleWorkflowPixelLayers\(node\)/);
  assert.match(canvas, /onExportPsd:\s*\(\)\s*=>\s*handleWorkflowPsdExport\(node\)/);
  assert.match(canvas, /const compositionDocument = node\.inputs\?\.compositionDocument;/);
  assert.doesNotMatch(canvas, /const document = node\.inputs\?\.compositionDocument;/);
  assert.doesNotMatch(canvas, /onExportPsd:\s*\(\)\s*=>\s*showToast\('像素分层能力完成后才可导出 PSD'/);
  assert.match(card, /onCreatePixelLayers/);
  assert.match(card, /生成像素分层/);
});

test('text composition retains a real source image layer for pixel-layer export', async () => {
  const canvas = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');

  assert.match(canvas, /kind:\s*'image',\s*assetId:\s*backgroundAssetId/);
  assert.match(canvas, /current\.layers\.filter\(item\s*=>\s*item\.kind\s*===\s*'image'\)/);
});
