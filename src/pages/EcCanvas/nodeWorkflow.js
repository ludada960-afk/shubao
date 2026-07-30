import { getCanvasAction, canCreateWorkflowFromNode } from './canvasActionRegistry.js';
import { getNodePortCenter } from './canvasGeometry.js';

const ACTION_SIZES = {
  'smart-remix': { w: 380, h: 560 },
  'layer-workbench': { w: 380, h: 420 },
  inpaint: { w: 320, h: 260 },
  'remove-bg': { w: 320, h: 220 },
  extend: { w: 320, h: 220 },
  translate: { w: 320, h: 240 },
  upscale: { w: 320, h: 220 },
};

function makeId(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}_${uuid}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getActionById(actionId) {
  return getCanvasAction(actionId);
}

export function isDerivedAction(actionId) {
  return Boolean(getCanvasAction(actionId)?.execute?.nodeKind);
}

export function canDeriveFromNode(input = {}) {
  return canCreateWorkflowFromNode(normalizeCanvasNode(input));
}

export function getConnectionLabel(input = {}) {
  if (input.relation === 'derived' || input.type === 'derived') {
    return getActionById(input.actionId)?.label || '派生处理';
  }
  if (input.relation === 'reference' || input.type === 'reference') return '引用素材';
  return input.label || '素材关系';
}

export function shouldShowQuickCanvasAction(actionId) {
  return false;
}

export function validateWorkflowActionInputs(actionId, inputs = {}) {
  const action = getCanvasAction(actionId);
  const requirements = action?.execute?.requires || {};
  const missing = Object.entries(requirements)
    .filter(([, required]) => required)
    .map(([key]) => key)
    .filter(key => {
      const value = inputs?.[key];
      return typeof value === 'string' ? !value.trim() : value == null;
    });
  return { ok: missing.length === 0, missing };
}

export function clampCanvasPickerPosition({ world = {}, viewport = {}, bounds = {}, preferredWidth = 360, preferredHeight = 460 } = {}) {
  const scale = Number.isFinite(viewport.scale) && viewport.scale > 0 ? viewport.scale : 1;
  const viewportX = Number.isFinite(viewport.x) ? viewport.x : 0;
  const viewportY = Number.isFinite(viewport.y) ? viewport.y : 0;
  const boundsWidth = Number.isFinite(bounds.width) && bounds.width > 0 ? bounds.width : preferredWidth * scale;
  const boundsHeight = Number.isFinite(bounds.height) && bounds.height > 0 ? bounds.height : preferredHeight * scale;
  const gutter = 10 / scale;
  const width = Math.min(preferredWidth, Math.max(180, boundsWidth / scale - gutter * 2));
  const height = Math.min(preferredHeight, Math.max(240, boundsHeight / scale - gutter * 2));
  const minX = (0 - viewportX) / scale + gutter;
  const minY = (0 - viewportY) / scale + gutter;
  const maxX = Math.max(minX, (boundsWidth - viewportX) / scale - width - gutter);
  const maxY = Math.max(minY, (boundsHeight - viewportY) / scale - height - gutter);
  return {
    x: Math.min(maxX, Math.max(minX, Number.isFinite(world.x) ? world.x : minX)),
    y: Math.min(maxY, Math.max(minY, Number.isFinite(world.y) ? world.y : minY)),
    width,
    maxHeight: height,
  };
}

export function getCanvasPortCenter(node = {}, port = 'output') {
  const normalized = normalizeCanvasNode(node);
  return getNodePortCenter(normalized, port);
}

export function getCanvasDomPortCenter({ portRect = {}, canvasRect = {}, viewport = {} } = {}) {
  const scale = Number.isFinite(viewport.scale) && viewport.scale > 0 ? viewport.scale : 1;
  const viewportX = Number.isFinite(viewport.x) ? viewport.x : 0;
  const viewportY = Number.isFinite(viewport.y) ? viewport.y : 0;
  const screenX = (Number(portRect.left) || 0) + (Number(portRect.width) || 0) / 2 - (Number(canvasRect.left) || 0);
  const screenY = (Number(portRect.top) || 0) + (Number(portRect.height) || 0) / 2 - (Number(canvasRect.top) || 0);
  return {
    x: (screenX - viewportX) / scale,
    y: (screenY - viewportY) / scale,
  };
}

export function normalizeCanvasNode(input = {}) {
  const node = { ...input };
  const kind = input.kind || (input.nodeKind ? input.nodeKind : 'image');
  const isImage = kind === 'image';
  return {
    ...node,
    kind,
    status: input.status || (isImage ? 'ready' : 'draft'),
    sourceNodeIds: Array.isArray(input.sourceNodeIds) ? [...input.sourceNodeIds] : [],
    actionId: input.actionId || null,
    inputs: input.inputs && typeof input.inputs === 'object' ? { ...input.inputs } : {},
    output: input.output ?? null,
    editable: input.editable !== false,
    x: Number.isFinite(input.x) ? input.x : 0,
    y: Number.isFinite(input.y) ? input.y : 0,
    w: Number.isFinite(input.w) ? input.w : (isImage ? 200 : 320),
    h: Number.isFinite(input.h) ? input.h : (isImage ? 200 : 220),
  };
}

export function normalizeCanvasConnection(input = {}) {
  const fromNodeId = input.fromNodeId || input.from || '';
  const toNodeId = input.toNodeId || input.to || '';
  const relation = input.relation || input.type || 'reference';
  const fromPort = input.fromPort || 'output';
  const toPort = input.toPort || 'input';
  const id = input.id || `edge_${fromNodeId}_${toNodeId}_${relation}`;
  return {
    ...input,
    id,
    fromNodeId,
    fromPort,
    toNodeId,
    toPort,
    relation,
    from: input.from || fromNodeId,
    to: input.to || toNodeId,
    type: input.type || relation,
  };
}

export function createDerivedNode({ sourceNodeIds = [], actionId, x = 0, y = 0, inputs = {}, id } = {}) {
  const action = getActionById(actionId);
  if (!action) throw new Error(`Unknown canvas action: ${actionId}`);
  const size = ACTION_SIZES[action.execute.nodeKind] || ACTION_SIZES['remove-bg'];
  return normalizeCanvasNode({
    id: id || makeId('node'),
    kind: action.execute.nodeKind,
    status: 'draft',
    actionId: action.execute?.nodeActionId || action.id,
    sourceNodeIds: [...sourceNodeIds],
    inputs: { ...inputs },
    output: null,
    x,
    y,
    w: size.w,
    h: size.h,
    title: action.label,
    description: action.description,
  });
}

export function createChildConnection(fromNodeId, toNodeId, actionId = 'derived') {
  return normalizeCanvasConnection({
    id: makeId('edge'),
    fromNodeId,
    fromPort: 'output',
    toNodeId,
    toPort: 'input',
    relation: 'derived',
    actionId,
  });
}
