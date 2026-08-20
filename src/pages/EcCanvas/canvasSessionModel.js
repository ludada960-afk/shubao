import { layoutAssetLanes } from './canvasGeometry.js';
import { findCanvasBlankPlacement } from './canvasInlineEditorModel.js';
import { createUploadedImageNodes, createUploadedVideoNodes } from './canvasStudioModel.js';
import { attachCanvasProjectAssetRef, buildCanvasAssetRef, canvasProjectAssetRefKey } from './canvasAssetReferenceModel.js';
import { stripTransientWorkPlayback } from '../../utils/workRecords.js';

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

function durableCanvasValue(value) {
  if (Array.isArray(value)) return value.map(durableCanvasValue);
  if (!value || typeof value !== 'object') return value;
  const next = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, durableCanvasValue(child)]));
  const ref = next.assetRef || next.projectAssetRef;
  const stableUrl = typeof ref?.stableUrl === 'string' ? ref.stableUrl.trim() : '';
  if (stableUrl && (next.url || next.playbackUrl)) {
    next.url = stableUrl;
    delete next.playbackUrl;
  }
  return stripTransientWorkPlayback(next);
}

function normalizedViewport(viewport = {}) {
  return {
    x: Number.isFinite(viewport.x) ? viewport.x : 80,
    y: Number.isFinite(viewport.y) ? viewport.y : 40,
    scale: Number.isFinite(viewport.scale) && viewport.scale > 0 ? viewport.scale : 1,
  };
}

function canonicalMediaRef(value = {}) {
  const ref = buildCanvasAssetRef(value?.assetRef || value?.projectAssetRef || value);
  return ref && ['video', 'audio'].includes(ref.mediaKind) ? ref : null;
}

export function canvasMediaAssetRefs(nodes = []) {
  const refs = [];
  const seen = new Set();
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const ref = canonicalMediaRef(node);
    const key = canvasProjectAssetRefKey(ref || {});
    if (!ref || !key || seen.has(key)) continue;
    seen.add(key);
    refs.push(ref);
  }
  return refs;
}

export function restoreCanvasMediaPlayback(nodes = [], assets = []) {
  const playbackByKey = new Map();
  for (const asset of Array.isArray(assets) ? assets : []) {
    const ref = canonicalMediaRef(asset);
    const playbackUrl = typeof asset?.playbackUrl === 'string' ? asset.playbackUrl.trim() : '';
    const key = canvasProjectAssetRefKey(ref || {});
    if (ref && key && playbackUrl) playbackByKey.set(key, playbackUrl);
  }
  return (Array.isArray(nodes) ? nodes : []).map(node => {
    const ref = canonicalMediaRef(node);
    const playbackUrl = playbackByKey.get(canvasProjectAssetRefKey(ref || {}));
    if (playbackUrl) {
      const { mediaPlaybackStatus: _status, mediaPlaybackError: _error, ...rest } = node;
      return { ...rest, url: playbackUrl, playbackUrl };
    }
    if (!ref) return node;
    return {
      ...node,
      mediaPlaybackStatus: 'unavailable',
      mediaPlaybackError: '暂时无法恢复播放地址，请稍后重试或从项目素材库重新保留素材',
    };
  });
}

export function createCanvasSnapshot({ nodes = [], connections = [], viewport = {} } = {}) {
  return {
    nodes: durableCanvasValue(clone(Array.isArray(nodes) ? nodes : [], [])),
    connections: clone(Array.isArray(connections) ? connections : [], []),
    viewport: normalizedViewport(viewport),
  };
}

export function restoreCanvasSnapshot(snapshot = {}) {
  return {
    nodes: clone(Array.isArray(snapshot.nodes) ? snapshot.nodes : [], []),
    connections: clone(Array.isArray(snapshot.connections) ? snapshot.connections : [], []),
    viewport: normalizedViewport(snapshot.viewport),
  };
}

function audioNodeFromAsset(asset, ref, position, now) {
  return attachCanvasProjectAssetRef({
    id: `audio_project_${now}`,
    assetId: ref.assetId || ref.projectAssetId,
    kind: 'audio',
    provenance: 'source',
    status: 'ready',
    url: asset.playbackUrl || ref.stableUrl,
    name: visibleName(asset.name || asset.label || ref.role, '项目音频'),
    displayLabel: visibleName(asset.name || asset.label || ref.role, '项目音频'),
    group: '音频',
    role: ref.role || 'audio',
    duration: Number(asset.duration || asset.durationMs) || 0,
    sourceNodeIds: [],
    editable: true,
    showMeta: true,
    x: position.x,
    y: position.y,
    w: 320,
    h: 96,
    rotation: 0,
    locked: false,
    hidden: false,
    projectAssetSource: 'project-library',
  }, ref);
}

export function importProjectAssetToCanvas({ asset = {}, session = {}, source = 'project-library' } = {}) {
  const snapshot = restoreCanvasSnapshot(session);
  const ref = buildCanvasAssetRef(asset);
  if (!ref) return { added: false, reason: 'invalid-project-asset', session: snapshot };

  const key = canvasProjectAssetRefKey(ref);
  const existing = snapshot.nodes.find(node => canvasProjectAssetRefKey(node?.assetRef || node) === key);
  if (existing) return { added: false, reason: 'already-imported', nodeId: existing.id, session: snapshot };

  const isImage = ref.mediaKind === 'image';
  const isVideo = ref.mediaKind === 'video';
  const width = isImage ? 240 : 320;
  const height = isImage
    ? Math.round(width / (Number(ref.width) > 0 && Number(ref.height) > 0 ? Number(ref.width) / Number(ref.height) : 1))
    : (isVideo ? 180 : 96);
  const position = findCanvasBlankPlacement({
    width,
    height,
    viewport: snapshot.viewport,
    nodes: snapshot.nodes,
    preferred: { x: 80, y: 80 },
    sourceNode: snapshot.nodes.find(node => node?.kind === 'image' || node?.kind === 'video'),
  });
  const normalizedAsset = {
    ...asset,
    ...ref,
    url: asset.playbackUrl || ref.stableUrl,
    stableUrl: ref.stableUrl,
    name: asset.name || asset.label || ref.role,
  };
  const now = Date.now();
  const created = isImage
    ? createUploadedImageNodes({ assets: [normalizedAsset], x: position.x, y: position.y, now })[0]
    : isVideo
      ? createUploadedVideoNodes({ assets: [normalizedAsset], x: position.x, y: position.y, now })[0]
      : audioNodeFromAsset(normalizedAsset, ref, position, now);
  if (!created) return { added: false, reason: 'invalid-project-asset', session: snapshot };
  const node = {
    ...created,
    projectAssetSource: source,
    projectAssetRef: ref,
  };
  return {
    added: true,
    node,
    session: { ...snapshot, nodes: [...snapshot.nodes, node] },
  };
}

export function createFreshCanvasSession({ work = {}, productAssets = [], outputs = [], mediaAssets = [] } = {}) {
  const workId = safeId(work.id || work._saveKey || work.taskId, 'work');
  const normalizedProducts = productAssets.filter(asset => asset?.url || asset?.stableUrl).map((asset, index) => ({
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
  const hasSource = sourceNodes.length > 0;
  const sourceId = sourceNodes[0]?.id || '';
  const outputSeeds = outputs.filter(asset => asset?.url || asset?.stableUrl).map((asset, index) => {
    const assetId = safeId(asset.assetId || asset.id || asset.key, `asset-${index + 1}`);
    return attachCanvasProjectAssetRef({
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
    }, asset, { projectId: work.projectId });
  });
  const sourceNode = sourceNodes[0] || (outputSeeds.length ? {
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
  } : null);
  const outputNodes = sourceNode ? layoutAssetLanes({ sourceNode, assets: outputSeeds }) : [];
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
  const mediaSession = (Array.isArray(mediaAssets) ? mediaAssets : [])
    .filter(asset => {
      const ref = buildCanvasAssetRef(asset);
      return ['video', 'audio'].includes(ref?.mediaKind);
    })
    .reduce((current, asset) => importProjectAssetToCanvas({
      asset,
      session: current,
      source: 'work-media',
    }).session, {
      nodes: [...sourceNodes, ...outputNodes],
      connections,
      viewport: { x: 80, y: 40, scale: 1 },
    });
  return {
    id: freshSessionId(),
    workId,
    createdAt: Date.now(),
    nodes: mediaSession.nodes,
    connections: mediaSession.connections,
  };
}
