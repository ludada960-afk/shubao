function safeId(value, fallback) {
  const normalized = String(value || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function freshSessionId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `canvas-${uuid}` : `canvas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function outputHeight(ratio) {
  if (ratio === '3:4') return 288;
  if (ratio === '4:3') return 176;
  if (ratio === '9:16') return 390;
  return 220;
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
  const sourceId = `source-group-${workId}`;
  const normalizedProducts = productAssets.filter(asset => asset?.url).map((asset, index) => ({
    ...asset,
    assetId: safeId(asset.assetId || asset.id, `product-${index + 1}`),
    name: String(asset.name || asset.label || `产品图 ${index + 1}`),
  }));
  const sourceNode = {
    id: sourceId,
    kind: 'source_group',
    status: 'ready',
    name: String(work.product_name || work.name || '产品母图'),
    title: '产品母图',
    platform: work.platform || '淘宝',
    assets: normalizedProducts,
    x: 32,
    y: 72,
    w: 248,
    h: Math.max(190, 116 + Math.ceil(Math.max(1, normalizedProducts.length) / 2) * 86),
    editable: false,
  };
  const outputNodes = outputs.filter(asset => asset?.url).map((asset, index) => {
    const assetId = safeId(asset.assetId || asset.id || asset.key, `asset-${index + 1}`);
    return {
      ...asset,
      id: `output-${assetId}`,
      assetId,
      kind: 'output',
      status: 'completed',
      name: String(asset.name || asset.label || asset.role || `电商图 ${index + 1}`),
      displayLabel: String(asset.name || asset.label || asset.role || `电商图 ${index + 1}`),
      group: asset.group || '其他',
      role: asset.role || asset.name || '电商图',
      ratio: asset.ratio || '1:1',
      x: 388,
      y: 32 + index * 330,
      w: 220,
      h: outputHeight(asset.ratio),
      sourceNodeIds: [sourceId],
      editable: true,
    };
  });
  const connections = outputNodes.map((node, index) => ({
    id: `edge-${sourceId}-${node.id}`,
    fromNodeId: sourceId,
    fromPort: 'output',
    toNodeId: node.id,
    toPort: 'input',
    relation: 'source-output',
    from: sourceId,
    to: node.id,
    type: 'source-output',
    label: index === 0 ? '基于产品母图生成' : '',
  }));
  return {
    id: freshSessionId(),
    workId,
    createdAt: Date.now(),
    nodes: [sourceNode, ...outputNodes],
    connections,
  };
}
