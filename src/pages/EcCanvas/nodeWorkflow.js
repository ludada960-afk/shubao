import { formatCanvasActionPrice, getCanvasActionBilling } from './canvasBillingModel.js';

const ACTION_SIZES = {
  'smart-remix': { w: 380, h: 560 },
  'layer-workbench': { w: 380, h: 420 },
  inpaint: { w: 320, h: 260 },
  'remove-bg': { w: 320, h: 220 },
  extend: { w: 320, h: 220 },
  translate: { w: 320, h: 240 },
  upscale: { w: 320, h: 220 },
};

const NODE_ACTIONS = [
  { id: 'smart-remix', label: '智能二创', description: '解析原图描述，补充图片与文字后继续创作', nodeKind: 'smart-remix', group: '创作与修改' },
  { id: 'layer-edit', label: '图层编辑', description: '拆分商品、人物、背景和文字并逐层调整', nodeKind: 'layer-workbench', group: '创作与修改' },
  { id: 'inpaint', label: '局部改图', description: '框选区域，只修改需要调整的部分', nodeKind: 'inpaint', group: '创作与修改' },
  { id: 'remove-bg', label: '商品抠图', description: '提取透明背景的商品素材', nodeKind: 'remove-bg', group: '电商处理' },
  { id: 'extend', label: '智能扩图', description: '扩展画面并适配新的投放比例', nodeKind: 'extend', group: '电商处理' },
  { id: 'translate', label: '图文翻译', description: '替换画面语言并尽量保持排版', nodeKind: 'translate', group: '电商处理' },
  { id: 'upscale', label: '高清修复', description: '提升清晰度、纹理和商品细节', nodeKind: 'upscale', group: '电商处理' },
];

export const CANVAS_NODE_ACTIONS = NODE_ACTIONS.map(action => ({
  ...action,
  billing: getCanvasActionBilling(action.id),
  priceLabel: formatCanvasActionPrice(action.id),
}));

const ACTION_BY_ID = new Map(CANVAS_NODE_ACTIONS.map(action => [action.id, action]));
const DIRECT_ACTIONS_REPLACED_BY_NODES = new Set([
  'remove-bg',
  'reverse-prompt',
  'retouch',
  'extend',
  'translate',
  'upscale',
  'layers',
]);

function makeId(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}_${uuid}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getActionById(actionId) {
  return ACTION_BY_ID.get(actionId) || null;
}

export function isDerivedAction(actionId) {
  return ACTION_BY_ID.has(actionId);
}

export function canDeriveFromNode(input = {}) {
  const node = normalizeCanvasNode(input);
  return node.kind === 'image' && ['ready', 'success'].includes(node.status);
}

export function getConnectionLabel(input = {}) {
  if (input.relation === 'derived' || input.type === 'derived') {
    return getActionById(input.actionId)?.label || '派生处理';
  }
  if (input.relation === 'reference' || input.type === 'reference') return '引用素材';
  return input.label || '素材关系';
}

export function shouldShowQuickCanvasAction(actionId) {
  return actionId !== 'download' && !DIRECT_ACTIONS_REPLACED_BY_NODES.has(actionId);
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
  const size = ACTION_SIZES[action.nodeKind] || ACTION_SIZES['remove-bg'];
  return normalizeCanvasNode({
    id: id || makeId('node'),
    kind: action.nodeKind,
    status: 'draft',
    actionId: action.id,
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
