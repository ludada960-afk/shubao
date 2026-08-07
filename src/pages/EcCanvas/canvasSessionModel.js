import { layoutAssetLanes } from './canvasGeometry.js';
import { createUploadedImageNodes } from './canvasStudioModel.js';

function safeId(value, fallback) {
  const normalized = String(value || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function freshSessionId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `canvas-${uuid}` : `canvas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function visibleName(value, fallback) {
  const name = String(value || '').trim();
  return name && name !== 'undefined' && name !== 'null' ? name : fallback;
}

function clone(value, fallback) {
  try { return JSON.parse(JSON.stringify(value)); } catch { return fallback; }
}

function normalizedViewport(viewport = {}) {
  return {
    x: Number.isFinite(viewport.x) ? viewport.x : 80,
    y: Number.isFinite(viewport.y) ? viewport.y : 40,
    scale: Number.isFinite(viewport.scale) && viewport.scale > 0 ? viewport.scale : 1,
  };
}

export function createCanvasSnapshot({ nodes = [], connections = [], viewport = {} } = {}) {
  return {
    nodes: clone(Array.isArray(nodes) ? nodes : [], []),
    connections: clone(Array.isArray(connections) ? connections : [], []),
    viewport: normalizedViewport(viewport),
  };
}

export function restoreCanvasSnapshot(snapshot = {}) {
  return createCanvasSnapshot(snapshot);
}

export function createFreshCanvasSession({ work = {}, productAssets = [], outputs = [] } = {}) {
  const workId = safeId(work.id || work._saveKey || work.taskId, 'work');
  const normalizedProducts = productAssets.filter(asset => asset?.url).map((asset, index) => ({
    ...asset,
    assetId: safeId(asset.assetId || asset.id, `product-${index + 1}`),
    name: visibleName(asset.name || asset.label, `产品图 ${index + 1}`),
  }));
  const sourceNodes = createUploadedImageNodes({ assets: normalizedProducts, x: 32, y: 72 })
    .map((node, index) => ({
      ...node,
      id: `source-${workId}-${node.assetId || index + 1}`,
      isProductSource: true,
      provenance: 'source',
      sourceNodeIds: [],
    }));
  const sourceNode = sourceNodes[0] || {
    id: `source-${workId}-anchor`,
    kind: 'image',
    status: 'ready',
    name: visibleName(work.product_name || work.name, '产品母图'),
    displayLabel: visibleName(work.product_name || work.name, '产品母图'),
    x: 32,
    y: 72,
    w: 240,
    h: 240,
    url: '',
    showMeta: false,
    isProductSource: true,
    provenance: 'source',
    sourceNodeIds: [],
  };
  const hasSource = sourceNodes.length > 0;
  const sourceId = sourceNode.id;
  const outputSeeds = outputs.filter(asset => asset?.url).map((asset, index) => {
    const assetId = safeId(asset.assetId || asset.id || asset.key, `asset-${index + 1}`);
    return {
      ...asset,
      id: `output-${assetId}`,
      assetId,
      kind: 'output',
      provenance: 'generated',
      status: 'completed',
      name: visibleName(asset.name || asset.label || asset.role, `电商图 ${index + 1}`),
      displayLabel: visibleName(asset.name || asset.label || asset.role, `电商图 ${index + 1}`),
      group: asset.group || '其他',
      role: asset.role || asset.name || '电商图',
      ratio: asset.ratio || '1:1',
      sourceNodeIds: hasSource ? [sourceId] : [],
      editable: true,
    };
  });
  const outputNodes = layoutAssetLanes({ sourceNode, assets: outputSeeds });
  const connections = hasSource ? outputNodes.map(node => ({
    id: `edge-${sourceId}-${node.id}`,
    fromNodeId: sourceId,
    fromPort: 'output',
    toNodeId: node.id,
    toPort: 'input',
    relation: 'source-output',
    from: sourceId,
    to: node.id,
    type: 'source-output',
    label: '',
  })) : [];
  return {
    id: freshSessionId(),
    workId,
    createdAt: Date.now(),
    nodes: [...sourceNodes, ...outputNodes],
    connections,
  };
}
