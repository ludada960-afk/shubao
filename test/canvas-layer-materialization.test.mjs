import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canvasImageResultGeometry,
  materializeCanvasLayers,
} from '../src/pages/EcCanvas/canvasLayerMaterialization.js';

const source = Object.freeze({
  id: 'source-1',
  kind: 'image',
  x: 100,
  y: 80,
  w: 240,
  h: 320,
  name: '三色保鲜盒',
});

test('smart layering materializes grouped product, instances, background and text as draggable child nodes', () => {
  const result = materializeCanvasLayers({
    sourceNode: source,
    runId: 'run-1',
    layers: [
      { id: 'product-group', kind: 'image', semanticType: 'product-group', name: '三只保鲜盒', url: '/group.png', pixelWidth: 900, pixelHeight: 620, bounds: { x: 0.1, y: 0.12, width: 0.8, height: 0.52 }, editable: true },
      { id: 'box-a', kind: 'image', semanticType: 'product-instance', name: '白色保鲜盒', url: '/a.png', pixelWidth: 320, pixelHeight: 260, editable: true },
      { id: 'box-b', kind: 'image', semanticType: 'product-instance', name: '蓝色保鲜盒', url: '/b.png', pixelWidth: 330, pixelHeight: 270, editable: true },
      { id: 'box-c', kind: 'image', semanticType: 'product-instance', name: '橙色保鲜盒', url: '/c.png', pixelWidth: 340, pixelHeight: 280, editable: true },
      { id: 'background', kind: 'image', semanticType: 'background', name: '背景净版', url: '/background.png', pixelWidth: 900, pixelHeight: 1200, editable: true },
      { id: 'copy', kind: 'text', semanticType: 'text', name: '三色盖子可选择', text: '三色盖子可选择', color: '#ffffff', background: '#e8a92a', bounds: { x: 0.18, y: 0.82, width: 0.64, height: 0.08 }, editable: true },
    ],
  });

  assert.equal(result.nodes.length, 6);
  assert.equal(result.connections.length, 6);
  assert.equal(new Set(result.nodes.map(node => node.id)).size, 6);
  assert.deepEqual(result.nodes.map(node => node.semanticType), [
    'product-group', 'product-instance', 'product-instance', 'product-instance', 'background', 'text',
  ]);
  assert.equal(result.nodes[0].semanticType, 'product-group');
  assert.equal(result.nodes[0].kind, 'layer-group');
  assert.equal(result.nodes[0].layerExpanded, false);
  assert.equal(result.nodes[0].layerChildIds.length, 5);
  assert.equal(result.nodes[0].showMeta, false);
  assert.ok(result.nodes.slice(1).every(node => node.hidden === true));
  assert.ok(result.nodes.slice(1).every(node => node.parentLayerGroupId === result.nodes[0].id));
  assert.ok(result.connections.some(edge => edge.fromNodeId === source.id && edge.toNodeId === result.nodes[0].id));
  assert.ok(result.connections.every(edge => edge.fromNodeId === source.id));
  assert.ok(result.connections.every(edge => edge.toNodeId !== result.nodes[0].id || edge.fromNodeId === source.id));
  assert.ok(!result.connections.some(edge => edge.fromNodeId === result.nodes[0].id));
  assert.ok(result.connections.every(edge => result.nodes.some(node => node.id === edge.toNodeId)));
  assert.ok(result.nodes.every(node => node.editable !== false));
  const text = result.nodes.find(node => node.kind === 'text');
  assert.equal(text.text, '三色盖子可选择');
  assert.equal(text.w, 160);
  assert.equal(text.h, 54);
  assert.equal(text.textStyle.color, '#ffffff');
  assert.equal(text.textStyle.background, '#e8a92a');
});

test('smart layering drops exact duplicate pixel layers without collapsing distinct instances', () => {
  const result = materializeCanvasLayers({
    sourceNode: source,
    runId: 'dedupe-run',
    layers: [
      { id: 'group', kind: 'image', semanticType: 'product-group', url: '/group.png', pixelWidth: 900, pixelHeight: 620, editable: true },
      { id: 'product-1', kind: 'image', semanticType: 'product-instance', url: '/product.png', pixelWidth: 300, pixelHeight: 300, bounds: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 }, editable: true },
      { id: 'product-1-copy', kind: 'image', semanticType: 'product-instance', url: '/product.png', pixelWidth: 300, pixelHeight: 300, bounds: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 }, editable: true },
      { id: 'product-2', kind: 'image', semanticType: 'product-instance', url: '/product.png', pixelWidth: 300, pixelHeight: 300, bounds: { x: 0.6, y: 0.1, width: 0.2, height: 0.2 }, editable: true },
    ],
  });
  assert.equal(result.nodes.filter(node => node.semanticType === 'product-instance').length, 2);
});

test('smart layering produces stable non-overlapping placements from an explicit anchor', () => {
  const result = materializeCanvasLayers({
    sourceNode: source,
    runId: 'stable-run',
    anchor: { x: 500, y: 200 },
    layers: Array.from({ length: 5 }, (_, index) => ({
      id: `asset-${index + 1}`,
      kind: 'image',
      semanticType: 'product-instance',
      name: `商品 ${index + 1}`,
      url: `/${index + 1}.png`,
      pixelWidth: 300,
      pixelHeight: 300,
      editable: true,
    })),
  });

  assert.deepEqual(result.nodes[0].x, 500);
  assert.deepEqual(result.nodes[0].y, 200);
  const positions = result.nodes.map(node => `${node.x}:${node.y}`);
  assert.equal(new Set(positions).size, result.nodes.length);
  assert.equal(result.nodes[0].kind, 'layer-group');
  assert.deepEqual(
    materializeCanvasLayers({ sourceNode: source, runId: 'stable-run', anchor: { x: 500, y: 200 }, layers: result.layers }).nodes.map(node => node.id),
    result.nodes.map(node => node.id),
  );
});

test('smart layering rejects semantic labels without real pixel or text content', () => {
  assert.throws(
    () => materializeCanvasLayers({
      sourceNode: source,
      layers: [{ id: 'fake', kind: 'image', name: '商品主体', description: 'semantic only', editable: true }],
    }),
    error => error.code === 'CANVAS_LAYER_RESULT_EMPTY',
  );
});

test('transparent results use their returned pixel bounds instead of the source frame ratio', () => {
  assert.deepEqual(
    canvasImageResultGeometry({ pixelWidth: 600, pixelHeight: 300 }, { w: 240, h: 320, ratio: '3:4' }),
    { w: 240, h: 120, ratio: '600:300', size: '600×300' },
  );
  assert.deepEqual(
    canvasImageResultGeometry({}, { w: 240, h: 320, ratio: '3:4', size: '1200×1600' }),
    { w: 240, h: 320, ratio: '3:4', size: '1200×1600' },
  );
});
