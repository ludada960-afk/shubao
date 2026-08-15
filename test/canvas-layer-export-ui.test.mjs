import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('legacy Canvas workbench still offers verified PSD preparation for saved sessions', async () => {
  const canvas = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const card = await readFile(new URL('../src/pages/EcCanvas/components/workflowNodes/modular/LayerWorkbenchNodeCard.jsx', import.meta.url), 'utf8');
  const legacyCard = await readFile(new URL('../src/pages/EcCanvas/components/workflowNodes/index.jsx', import.meta.url), 'utf8');

  assert.match(canvas, /createCanvasPixelLayers,\s*exportCanvasPsd/);
  assert.match(canvas, /layerCapabilities:\s*data\.capabilities\s*\|\|\s*\{\}/);
  assert.match(canvas, /capabilities:\s*node\.inputs\?\.capabilities\s*\|\|\s*\{\}/);
  assert.match(canvas, /onCreatePixelLayers:\s*node\.inputs\?\.compositionDocument\s*\?\s*\(\)\s*=>\s*handleWorkflowPixelLayers\(node\)/);
  assert.match(canvas, /onExportPsd:\s*\(\)\s*=>\s*handleWorkflowPsdExport\(node\)/);
  assert.match(canvas, /const compositionDocument = node\.inputs\?\.compositionDocument;/);
  assert.doesNotMatch(canvas, /const document = node\.inputs\?\.compositionDocument;/);
  assert.doesNotMatch(canvas, /onExportPsd:\s*\(\)\s*=>\s*showToast\('像素分层能力完成后才可导出 PSD'/);
  assert.match(card, /onCreatePixelLayers/);
  assert.match(card, /生成像素分层/);
  assert.match(card, /layerCapabilities\.pixelLayers\s*&&\s*selectedLayer/);
  assert.doesNotMatch(card, /可调色/);
  assert.doesNotMatch(legacyCard, /可调色/);
  assert.match(legacyCard, /hasPixelLayers\s*=\s*capabilities\.pixelLayers\s*===\s*true/);
  assert.match(legacyCard, /hasPixelLayers\s*&&\s*selectedLayer/);
  assert.match(legacyCard, /生成像素分层/);
});

test('new smart-layer actions materialize real child nodes instead of opening a selection workbench', async () => {
  const canvas = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const createStart = canvas.indexOf('const handleCreateDerivedNode');
  const createEnd = canvas.indexOf('const updateWorkflowNode', createStart);
  assert.notEqual(createStart, -1);
  assert.notEqual(createEnd, -1);
  const createHandler = canvas.slice(createStart, createEnd);

  assert.match(createHandler, /nodeActionId\s*===\s*['"]layer-edit['"][\s\S]*?handleSmartLayerMaterialization/);
  assert.ok(
    createHandler.indexOf("nodeActionId === 'layer-edit'") < createHandler.indexOf('createDerivedNode({'),
    'smart layering must bypass the legacy workbench node',
  );
  assert.match(canvas, /materializeCanvasLayers\(\{/);
  assert.match(canvas, /replaceCanvasNodeWithLayerResult\(\{[\s\S]*?sourceNodeId:\s*result\.replacedSourceNodeId[\s\S]*?groupNode[\s\S]*?childNodes:\s*result\.nodes/);
  assert.match(canvas, /replaceCanvasNodeWithLayerResult\(\{[\s\S]*?resultConnections:\s*result\.connections/);
});

test('text composition retains a real source image layer for pixel-layer export', async () => {
  const canvas = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');

  assert.match(canvas, /kind:\s*'image',\s*assetId:\s*backgroundAssetId/);
  assert.match(canvas, /current\.layers\.filter\(item\s*=>\s*item\.kind\s*===\s*'image'\)/);
});
