const GRID_COLUMNS = 3;
const GRID_COLUMN_WIDTH = 278;
const GRID_ROW_HEIGHT = 300;

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function safeId(value, fallback) {
  const normalized = String(value || '').trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function imageSize(layer) {
  const width = Math.max(1, finite(layer.pixelWidth, finite(layer.bounds?.width, 1) * 1000));
  const height = Math.max(1, finite(layer.pixelHeight, finite(layer.bounds?.height, 1) * 1000));
  const aspect = Math.max(0.35, Math.min(2.8, width / height));
  const nodeWidth = layer.semanticType === 'background' ? 240 : 220;
  return {
    w: nodeWidth,
    h: Math.max(120, Math.min(320, Math.round(nodeWidth / aspect))),
    ratio: `${Math.round(width)}:${Math.round(height)}`,
  };
}

export function canvasImageResultGeometry(result = {}, sourceNode = {}) {
  const pixelWidth = finite(result.pixelWidth);
  const pixelHeight = finite(result.pixelHeight);
  if (pixelWidth <= 0 || pixelHeight <= 0) {
    return {
      w: finite(sourceNode.w, 220),
      h: finite(sourceNode.h, 220),
      ratio: sourceNode.ratio || '1:1',
      size: sourceNode.size || '',
    };
  }
  const width = finite(sourceNode.w, 220);
  return {
    w: width,
    h: Math.max(1, Math.round(width * pixelHeight / pixelWidth)),
    ratio: `${Math.round(pixelWidth)}:${Math.round(pixelHeight)}`,
    size: `${Math.round(pixelWidth)}×${Math.round(pixelHeight)}`,
  };
}

function normalizeMaterialLayer(layer, index) {
  const kind = layer?.kind === 'text' || layer?.semanticType === 'text' ? 'text' : 'image';
  const text = String(layer?.text || '').trim();
  const url = String(layer?.url || layer?.preview_url || '').trim();
  if (layer?.editable === false || (kind === 'image' ? !url : !text)) return null;
  return {
    ...layer,
    id: safeId(layer?.id, `layer-${index + 1}`),
    kind,
    text,
    url,
    name: String(layer?.name || text || `图层 ${index + 1}`).trim(),
    semanticType: String(layer?.semanticType || (kind === 'text' ? 'text' : 'image')).trim(),
  };
}

function layerFingerprint(layer = {}) {
  const bounds = layer.bounds && typeof layer.bounds === 'object'
    ? ['x', 'y', 'width', 'height'].map(key => Number.isFinite(Number(layer.bounds[key])) ? Number(layer.bounds[key]).toFixed(5) : '').join(',')
    : '';
  return [
    layer.kind,
    layer.semanticType,
    layer.url || layer.text,
    bounds,
    layer.pixelWidth || '',
    layer.pixelHeight || '',
  ].join('|');
}

function textNode(layer, common) {
  const textWidth = Math.min(320, Math.max(160, Math.round(String(layer.text || '').length * 13 + 32)));
  return {
    ...common,
    kind: 'text',
    w: textWidth,
    h: 54,
    text: layer.text,
    placeholder: '输入文字',
    textStyle: {
      block: 'body',
      color: layer.color || '#20242a',
      background: layer.background || 'transparent',
      fontSize: 18,
      fontStyle: 'normal',
      fontWeight: 400,
      list: 'none',
      textAlign: 'left',
    },
  };
}

function imageNode(layer, common) {
  return {
    ...common,
    ...imageSize(layer),
    kind: 'image',
    url: layer.url,
    assetId: layer.assetId || '',
    loaded: false,
    showMeta: false,
  };
}

export function materializeCanvasLayers({ sourceNode, layers = [], anchor, runId } = {}) {
  const sourceId = String(sourceNode?.id || '').trim();
  if (!sourceId) throw new TypeError('sourceNode.id is required');
  const seenLayers = new Set();
  const validLayers = (Array.isArray(layers) ? layers : [])
    .map(normalizeMaterialLayer)
    .filter(Boolean)
    .filter(layer => {
      const fingerprint = layerFingerprint(layer);
      if (seenLayers.has(fingerprint)) return false;
      seenLayers.add(fingerprint);
      return true;
    });
  if (!validLayers.length) {
    throw Object.assign(new Error('智能分层没有返回可编辑像素或文字内容'), {
      code: 'CANVAS_LAYER_RESULT_EMPTY',
    });
  }
  const stableRunId = safeId(runId, `run-${Date.now()}`);
  const originX = finite(anchor?.x, finite(sourceNode.x) + finite(sourceNode.w, 240) + 72);
  const originY = finite(anchor?.y, finite(sourceNode.y));
  const semanticGroupIndex = validLayers.findIndex(layer => layer.semanticType === 'product-group');
  const groupLayerIndex = semanticGroupIndex >= 0
    ? semanticGroupIndex
    : validLayers.findIndex(layer => layer.kind === 'image');
  const groupLayer = groupLayerIndex >= 0
    ? validLayers[groupLayerIndex]
    : validLayers.find(layer => layer.kind === 'image') || validLayers[0];
  const childLayers = validLayers.filter((_, index) => index !== groupLayerIndex);
  const groupId = `layer_group_${stableRunId}`;
  const groupCommon = {
    id: groupId,
    name: '',
    displayLabel: '',
    semanticType: 'product-group',
    layerBounds: groupLayer.bounds || null,
    confidence: Number.isFinite(Number(groupLayer.confidence)) ? Number(groupLayer.confidence) : null,
    editable: true,
    status: 'ready',
    sourceNodeIds: [sourceId],
    actionId: 'layer-edit',
    group: '智能分层',
    role: 'product-group',
    x: originX,
    y: originY,
    hidden: false,
    locked: false,
    layerExpanded: false,
    layerChildIds: [],
    showMeta: false,
  };
  const groupNode = groupLayer.kind === 'text'
    ? textNode(groupLayer, { ...groupCommon, kind: 'text' })
    : imageNode(groupLayer, groupCommon);
  groupNode.id = groupId;
  groupNode.kind = 'layer-group';
  groupNode.url = groupLayer.url || sourceNode.url || '';
  groupNode.w = Math.max(220, finite(sourceNode.w, 240));
  groupNode.h = Math.max(120, finite(sourceNode.h, 240));
  groupNode.ratio = groupLayer.ratio || sourceNode.ratio || '1:1';
  groupNode.layerCount = childLayers.length;

  const childNodes = childLayers.map((layer, index) => {
    const col = index % GRID_COLUMNS;
    const row = Math.floor(index / GRID_COLUMNS);
    const id = `layer_${stableRunId}_${layer.id}`;
    const common = {
      id,
      name: '',
      displayLabel: '',
      semanticType: layer.semanticType,
      layerBounds: layer.bounds || null,
      confidence: Number.isFinite(Number(layer.confidence)) ? Number(layer.confidence) : null,
      editable: true,
      status: 'ready',
      sourceNodeIds: [sourceId],
      actionId: 'layer-edit',
      group: '智能分层',
      role: layer.semanticType,
      parentLayerGroupId: groupId,
      layerGroupId: groupId,
      x: originX + groupNode.w + 48 + col * GRID_COLUMN_WIDTH,
      y: originY + row * GRID_ROW_HEIGHT,
      hidden: true,
      locked: false,
      showMeta: false,
    };
    return layer.kind === 'text' ? textNode(layer, common) : imageNode(layer, common);
  });
  groupNode.layerChildIds = childNodes.map(node => node.id);
  const nodes = [groupNode, ...childNodes];
  const connections = [groupNode, ...childNodes].map((node, index) => ({
    id: `edge_${stableRunId}_${index + 1}`,
    fromNodeId: sourceId,
    fromPort: 'output',
    toNodeId: node.id,
    toPort: 'input',
    relation: 'derived',
    actionId: 'layer-edit',
    from: sourceId,
    to: node.id,
    type: 'derived',
  }));
  return { nodes, connections, layers: validLayers };
}
