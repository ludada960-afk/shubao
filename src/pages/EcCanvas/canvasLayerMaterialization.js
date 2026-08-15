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

function layerGeometry(layer, sourceNode) {
  const bounds = layer?.bounds;
  const hasBounds = bounds && ['x', 'y', 'width', 'height']
    .every(key => Number.isFinite(Number(bounds[key])));
  if (!hasBounds) {
    return {
      x: finite(sourceNode.x),
      y: finite(sourceNode.y),
      w: finite(sourceNode.w, 240),
      h: finite(sourceNode.h, 240),
    };
  }
  return {
    x: finite(sourceNode.x) + finite(sourceNode.w, 240) * Number(bounds.x),
    y: finite(sourceNode.y) + finite(sourceNode.h, 240) * Number(bounds.y),
    w: finite(sourceNode.w, 240) * Number(bounds.width),
    h: finite(sourceNode.h, 240) * Number(bounds.height),
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
  return {
    ...common,
    kind: 'text',
    text: layer.text,
    placeholder: '输入文字',
    textStyle: {
      block: 'body',
      color: layer.color || '#20242a',
      background: 'transparent',
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
    ratio: imageSize(layer).ratio,
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
  const hasProductGroup = validLayers.some(layer => layer.semanticType === 'product-group');
  const childLayers = hasProductGroup
    ? validLayers.filter(layer => layer.semanticType !== 'product-instance')
    : validLayers;
  const groupId = `layer_group_${stableRunId}`;
  const groupWidth = finite(sourceNode.w, 240);
  const groupHeight = finite(sourceNode.h, 240);
  const groupNode = {
    id: groupId,
    kind: 'layer-group',
    name: '智能分层',
    displayLabel: '智能分层',
    status: 'ready',
    actionId: 'layer-edit',
    group: '智能分层',
    x: Number.isFinite(Number(anchor?.x)) ? Number(anchor.x) : finite(sourceNode.x),
    y: Number.isFinite(Number(anchor?.y)) ? Number(anchor.y) : finite(sourceNode.y),
    w: groupWidth,
    h: groupHeight,
    sourceNodeIds: [],
    provenanceSourceNodeId: sourceId,
    layerExpanded: false,
    layerChildIds: [],
    layerCount: 0,
    showMeta: false,
  };

  const childNodes = childLayers.map((layer) => {
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
      sourceNodeIds: [],
      provenanceSourceNodeId: sourceId,
      actionId: 'layer-edit',
      group: '智能分层',
      role: layer.semanticType,
      parentLayerGroupId: groupId,
      layerGroupId: groupId,
      ...layerGeometry(layer, groupNode),
      hidden: true,
      locked: false,
      showMeta: false,
    };
    return layer.kind === 'text' ? textNode(layer, common) : imageNode(layer, common);
  });
  groupNode.layerChildIds = childNodes.map(node => node.id);
  groupNode.layerCount = childNodes.length;
  const connections = childNodes.map((node, index) => ({
    id: `edge_${stableRunId}_${index + 1}`,
    fromNodeId: groupId,
    fromPort: 'output',
    toNodeId: node.id,
    toPort: 'input',
    relation: 'derived',
    actionId: 'layer-edit',
    from: groupId,
    to: node.id,
    type: 'derived',
  }));
  return {
    replacedSourceNodeId: sourceId,
    groupNode: {
      ...groupNode,
      layerChildIds: childNodes.map(node => node.id),
      layerCount: childNodes.length,
    },
    nodes: childNodes,
    connections,
    layers: validLayers,
  };
}
