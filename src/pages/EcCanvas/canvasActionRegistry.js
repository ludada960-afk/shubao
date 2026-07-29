import { formatCanvasActionPrice, getCanvasActionBilling } from './canvasBillingModel.js';

function isReadyImage(node = {}) {
  if (node.kind === 'output') return Boolean(node.url) && node.status === 'completed';
  return node.kind === 'image' && ['ready', 'success', 'completed'].includes(node.status);
}

export function canCreateWorkflowFromNode(node = {}) {
  if (node.kind === 'source_group') return node.status === 'ready' && Array.isArray(node.assets) && node.assets.some(asset => asset?.url);
  return isReadyImage(node);
}

function action(id, label, surfaces, priceFeature, requiresPrompt, execute, options = {}) {
  const billing = priceFeature ? getCanvasActionBilling(priceFeature) : getCanvasActionBilling('download');
  return Object.freeze({
    id,
    label,
    surfaces: Object.freeze([...surfaces]),
    priceFeature,
    requiresPrompt,
    execute: Object.freeze({ ...execute, requires: Object.freeze({ ...(execute.requires || {}) }) }),
    description: options.description || '',
    group: options.group || '常用操作',
    canRun: options.canRun || isReadyImage,
    billing,
    priceLabel: priceFeature ? formatCanvasActionPrice(priceFeature) : '免费',
  });
}

export const CANVAS_ACTIONS = Object.freeze([
  action('adjust-requirements', '调整生成要求', ['hover', 'context'], 'smart-remix', true, {
    type: 'composer', handler: 'adjust-requirements', route: '/api/canvas/regenerate', requires: { prompt: true },
  }, { description: '补充画面要求与参考图后再生成', group: '优先操作' }),
  action('regenerate', '重新生成', ['hover', 'context'], 'smart-remix', false, {
    type: 'route', handler: 'regenerate', route: '/api/canvas/regenerate',
  }, { description: '沿用当前商品与画幅生成新图', group: '优先操作' }),
  action('download', '下载', ['selection', 'context'], null, false, {
    type: 'local', handler: 'download',
  }),
  action('image-info', '图片信息', ['selection', 'context'], null, false, {
    type: 'dialog', handler: 'image-info',
  }, { description: '修改图片名称、用途和使用说明' }),
  action('add-reference', '加入引用', ['selection', 'context'], null, false, {
    type: 'composer', handler: 'add-reference',
  }, { description: '把当前图片加入下一次生成的参考素材' }),
  action('delete', '删除', ['selection', 'context'], null, false, {
    type: 'local', handler: 'delete',
  }, { canRun: node => Boolean(node?.id) }),
  action('product-remix', '商品图改造', ['context', 'port'], 'smart-remix', true, {
    type: 'node', handler: 'create:smart-remix', nodeActionId: 'smart-remix', nodeKind: 'smart-remix', route: '/api/canvas/regenerate', requires: { prompt: true },
  }, { description: '按新的商品图要求生成图片', group: '创作与修改', canRun: canCreateWorkflowFromNode }),
  action('outpaint', '智能扩图', ['context', 'port'], 'extend', true, {
    type: 'node', handler: 'create:extend', nodeActionId: 'extend', nodeKind: 'extend', route: '/api/canvas/transform', requires: { ratio: true, prompt: true },
  }, { description: '先选择目标比例并填写扩展要求', group: '创作与修改', canRun: canCreateWorkflowFromNode }),
  action('inpaint', '局部改图', ['context', 'port'], 'inpaint', true, {
    type: 'node', handler: 'create:inpaint', nodeActionId: 'inpaint', nodeKind: 'inpaint', route: '/api/canvas/regenerate', requires: { prompt: true },
  }, { description: '只修改需要调整的区域', group: '创作与修改', canRun: canCreateWorkflowFromNode }),
  action('remove-background', '商品抠图', ['context', 'port'], 'remove-bg', false, {
    type: 'node', handler: 'create:remove-bg', nodeActionId: 'remove-bg', nodeKind: 'remove-bg', route: '/api/canvas/transform',
  }, { description: '生成透明背景商品素材', group: '电商处理', canRun: canCreateWorkflowFromNode }),
  action('layer-edit', '图文分层', ['context', 'port'], 'layers', false, {
    type: 'node', handler: 'create:layer-edit', nodeActionId: 'layer-edit', nodeKind: 'layer-workbench', route: '/api/canvas/analyze-layers',
  }, { description: '分析画面区域并进入图层工作台', group: '电商处理', canRun: canCreateWorkflowFromNode }),
  action('translate', '图片翻译', ['context', 'port'], 'translate', true, {
    type: 'node', handler: 'create:translate', nodeActionId: 'translate', nodeKind: 'translate', route: '/api/canvas/transform', requires: { prompt: true },
  }, { description: '替换画面语言并保持商品主体', group: '电商处理', canRun: canCreateWorkflowFromNode }),
  action('upscale', '高清修复', ['context', 'port'], 'upscale', false, {
    type: 'node', handler: 'create:upscale', nodeActionId: 'upscale', nodeKind: 'upscale', route: '/api/canvas/transform',
  }, { description: '提升清晰度与商品细节', group: '电商处理', canRun: canCreateWorkflowFromNode }),
  action('crop', '裁切画幅', ['context'], 'crop', false, {
    type: 'dialog', handler: 'crop',
  }),
  action('grid-split', '宫格切图', ['context'], 'grid-split', false, {
    type: 'local', handler: 'grid-split',
  }),
  action('annotation', '卖点标注', ['context'], 'annotation', true, {
    type: 'dialog', handler: 'annotation', route: '/api/canvas/transform', requires: { prompt: true },
  }),
]);

const ACTION_BY_ID = new Map(CANVAS_ACTIONS.map(item => [item.id, item]));
const ACTION_BY_NODE_ID = new Map(CANVAS_ACTIONS.filter(item => item.execute.nodeActionId).map(item => [item.execute.nodeActionId, item]));

export function getCanvasAction(actionId) {
  return ACTION_BY_ID.get(String(actionId || '')) || ACTION_BY_NODE_ID.get(String(actionId || '')) || null;
}

export function actionsForSurface({ surface, node } = {}) {
  return CANVAS_ACTIONS.filter(item => item.surfaces.includes(surface) && item.canRun(node));
}

export function canvasActionHandler(actionOrId) {
  const selected = typeof actionOrId === 'string' ? getCanvasAction(actionOrId) : actionOrId;
  return selected?.execute?.handler || '';
}
