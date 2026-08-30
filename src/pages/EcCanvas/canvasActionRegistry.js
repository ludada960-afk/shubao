import { formatCanvasActionPrice, getCanvasActionBilling } from './canvasBillingModel.js';

function isReadyImage(node = {}) {
  if (node.kind === 'output') return Boolean(node.url) && ['ready', 'success', 'completed'].includes(node.status);
  return ['image', 'layer-group'].includes(node.kind) && Boolean(node.url) && ['ready', 'success', 'completed'].includes(node.status);
}

/* Local tier: every handler that opens a purely client-side surface (crop
   frame, grid guides, move-scale stage, download, inline text drop) can run
   on the local preview the moment a node exists — an uploaded image keeps
   its data-URL preview while the durable copy persists in the background.
   Gating these on the persisted status is what left freshly uploaded
   selections with no object toolbar at all. Server-round-trip actions
   (OCR, layer analysis, background removal, reverse prompt) stay gated on
   the stable URL below. */
function canRunLocally(node = {}) {
  if (node.kind === 'output') return isReadyImage(node);
  return ['image', 'layer-group'].includes(node.kind) && Boolean(node.url);
}

function isReadyMedia(node = {}) {
  return isReadyImage(node) || (node.kind === 'video' && Boolean(node.url) && ['ready', 'success', 'completed'].includes(node.status));
}

export function canCreateWorkflowFromNode(node = {}) {
  if (node.kind === 'source_group') {
    return node.status === 'ready'
      && (node.sourceRole || 'product_original') === 'product_original'
      && Array.isArray(node.assets)
      && node.assets.some(asset => asset?.url);
  }
  return isReadyMedia(node);
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
  action('adjust-requirements', '调整生成要求', [], 'smart-remix', true, {
    type: 'composer', handler: 'adjust-requirements', route: '/api/canvas/regenerate', requires: { prompt: true },
  }, { description: '补充画面要求与参考图后再生成', group: '优先操作' }),
  action('regenerate', '重新生成', [], 'smart-remix', false, {
    type: 'route', handler: 'regenerate', route: '/api/canvas/regenerate',
  }, { description: '沿用当前商品与画幅生成新图', group: '优先操作' }),
  action('edit-text', '编辑文字', ['selection'], null, false, {
    type: 'inspector', handler: 'edit-text',
  }, { description: '识别并编辑画面中的文字' }),
  action('add-text', '添加文字', ['selection'], null, false, {
    type: 'local', handler: 'add-text',
  }, { description: '在画布上添加可直接编辑的文字', canRun: canRunLocally }),
  action('grid-split', '宫格切分', ['selection'], 'grid-split', false, {
    type: 'focused-editor', handler: 'grid-split',
  }, { canRun: canRunLocally }),
  action('layer-edit', '智能分层', ['selection'], 'layers', false, {
    type: 'node', handler: 'create:layer-edit', nodeActionId: 'layer-edit', nodeKind: 'layer-workbench', route: '/api/canvas/analyze-layers',
  }, { description: '分析画面区域并进入图层工作台', group: '电商处理', canRun: canCreateWorkflowFromNode }),
  action('remove-background', '去除背景', ['selection'], 'remove-bg', false, {
    type: 'node', handler: 'create:remove-bg', nodeActionId: 'remove-bg', nodeKind: 'remove-bg', route: '/api/canvas/transform',
  }, { description: '生成透明背景商品素材', group: '电商处理', canRun: canCreateWorkflowFromNode }),
  action('move-scale', '移动缩放', ['selection'], null, false, {
    type: 'focused-editor', handler: 'move-scale',
  }, { description: '框选商品并调整在画面中的位置与大小', canRun: canRunLocally }),
  action('reverse-prompt', '反推提示词', ['selection'], 'reverse-prompt', false, {
    type: 'node', handler: 'reverse-prompt', route: '/api/reverse-prompt',
  }, { description: '创建可继续编辑和派生的画面描述' }),
  action('annotation', '图片标注', ['selection'], 'annotation', false, {
    type: 'focused-editor', handler: 'annotation', route: '/api/canvas/transform',
  }),
  action('crop', '裁剪', ['selection'], 'crop', false, {
    type: 'focused-editor', handler: 'crop',
  }, { canRun: canRunLocally }),
  action('split-image', '分割图片', ['selection'], null, false, {
    type: 'focused-editor', handler: 'split-image',
  }, { canRun: canRunLocally }),
  action('download', '导出图片', ['selection'], null, false, {
    type: 'local', handler: 'download',
  }, { canRun: canRunLocally }),
  action('copy', '复制', ['context'], null, false, {
    type: 'local', handler: 'copy',
  }, { canRun: node => Boolean(node?.id) }),
  action('paste', '粘贴', ['context'], null, false, {
    type: 'local', handler: 'paste',
  }, { canRun: node => Boolean(node?.id) }),
  action('duplicate', '创建副本', ['context'], null, false, {
    type: 'local', handler: 'duplicate',
  }, { canRun: node => Boolean(node?.id) }),
  action('bring-forward', '上移一层', ['context'], null, false, {
    type: 'local', handler: 'bring-forward',
  }, { canRun: node => Boolean(node?.id) }),
  action('send-backward', '下移一层', ['context'], null, false, {
    type: 'local', handler: 'send-backward',
  }, { canRun: node => Boolean(node?.id) }),
  action('bring-front', '移动至顶层', ['context'], null, false, {
    type: 'local', handler: 'bring-front',
  }, { canRun: node => Boolean(node?.id) }),
  action('send-back', '移动至底层', ['context'], null, false, {
    type: 'local', handler: 'send-back',
  }, { canRun: node => Boolean(node?.id) }),
  action('toggle-visibility', '显示 / 隐藏', ['context'], null, false, {
    type: 'local', handler: 'toggle-visibility',
  }, { canRun: node => Boolean(node?.id) }),
  action('toggle-lock', '锁定 / 解锁', ['context'], null, false, {
    type: 'local', handler: 'toggle-lock',
  }, { canRun: node => Boolean(node?.id) }),
  action('flip-horizontal', '水平翻转', ['context'], null, false, {
    type: 'local', handler: 'flip-horizontal',
  }, { canRun: isReadyImage }),
  action('flip-vertical', '垂直翻转', ['context'], null, false, {
    type: 'local', handler: 'flip-vertical',
  }, { canRun: isReadyImage }),
  action('export-object', '导出', ['context'], null, false, {
    type: 'local', handler: 'download',
  }, { canRun: isReadyImage }),
  /* 删除只留在 context 菜单：选中态已有顶栏删除与键盘 Delete，selection
     工具条不再渲染孤立垃圾桶（用户反馈的冗余按钮）。 */
  action('delete', '删除', ['context'], null, false, {
    type: 'local', handler: 'delete',
  }, { canRun: node => Boolean(node?.id) }),
  action('product-remix', '商品图改造', ['image-editor'], 'smart-remix', true, {
    type: 'node', handler: 'create:smart-remix', nodeActionId: 'smart-remix', nodeKind: 'smart-remix', route: '/api/canvas/regenerate', requires: { prompt: true },
  }, { description: '按新的商品图要求生成图片', group: '创作与修改', canRun: canCreateWorkflowFromNode }),
  action('outpaint', '智能扩图', ['image-editor'], 'extend', true, {
    type: 'node', handler: 'create:extend', nodeActionId: 'extend', nodeKind: 'extend', route: '/api/canvas/transform', requires: { ratio: true, prompt: true },
  }, { description: '先选择目标比例并填写扩展要求', group: '创作与修改', canRun: canCreateWorkflowFromNode }),
  action('inpaint', '局部改图', ['image-editor'], 'inpaint', true, {
    type: 'node', handler: 'create:inpaint', nodeActionId: 'inpaint', nodeKind: 'inpaint', route: '/api/canvas/regenerate', requires: { prompt: true },
  }, { description: '只修改需要调整的区域', group: '创作与修改', canRun: canCreateWorkflowFromNode }),
  action('translate', '图片翻译', ['image-editor'], 'translate', true, {
    type: 'node', handler: 'create:translate', nodeActionId: 'translate', nodeKind: 'translate', route: '/api/canvas/transform', requires: { prompt: true },
  }, { description: '替换画面语言并保持商品主体', group: '电商处理', canRun: canCreateWorkflowFromNode }),
  action('upscale', '高清修复', ['image-editor'], 'upscale', false, {
    type: 'node', handler: 'create:upscale', nodeActionId: 'upscale', nodeKind: 'upscale', route: '/api/canvas/transform',
  }, { description: '提升清晰度与商品细节', group: '电商处理', canRun: canCreateWorkflowFromNode }),
  /* 4c183cd4 续命 2026-08-30 画布总统筹重审: 拿掉 AI 智能组 4 项, 改成"应用节点" 4 类
     用户原话 8-30: "你必须把这些重复的东西都给拿掉" / "你不能够残留那些做错的东西"
     原 AI 智能组 (one-click-suite/one-click-video/tts-voiceover/caption-motion) 跟:
       - 空状态 Row 3 智能区 (1-click 套图/1-click 视频/TTS 配音)
       - 顶部 [1-click 视频] overlay 按钮
       - 顶部 [多模态串联] overlay 按钮
     全部走 Quantv §10.2 节点串联方案: 5 类节点 (文本/图片/视频/音频/应用) + 2 资源入口
     改后: 智能操作不再是"独立节点", 改走"图片节点 → 应用节点 → 视频节点 → 音频节点" 端口串联 */
  action('application-1click-suite', '应用: 5 宫格套图', ['image-editor', 'selection'], 'smart-remix', true, {
    type: 'node', handler: 'create:application-1click-suite', nodeActionId: 'application-1click-suite', nodeKind: 'application', route: '/api/canvas/regenerate', requires: { prompt: true },
  }, { description: '应用节点 5 宫格套图 (Quantv 风格: 串联 1 输入 + 5 输出)', group: '应用节点', canRun: canCreateWorkflowFromNode }),
  action('application-1click-video', '应用: 1-click 视频', ['image-editor', 'selection'], null, true, {
    type: 'node', handler: 'create:application-1click-video', nodeActionId: 'application-1click-video', nodeKind: 'application', route: '/api/canvas/one-click-video',
  }, { description: '应用节点 1-click 视频 (Quantv 风格: 4 步 chain 串联 文本/图片/视频/音频)', group: '应用节点', canRun: canCreateWorkflowFromNode }),
  action('application-tts', '应用: TTS 配音', ['image-editor', 'selection'], null, true, {
    type: 'node', handler: 'create:application-tts', nodeActionId: 'application-tts', nodeKind: 'application', route: '/api/canvas/tts',
  }, { description: '应用节点 TTS 配音 (5 provider: 火山/阿里云/ElevenLabs/Azure/MiniMax)', group: '应用节点', canRun: canCreateWorkflowFromNode }),
  action('application-caption', '应用: 字幕动效', ['image-editor', 'selection'], null, true, {
    type: 'node', handler: 'create:application-caption', nodeActionId: 'application-caption', nodeKind: 'application', route: '/api/canvas/caption',
  }, { description: '应用节点字幕动效 (弹出/淡入/逐字动画, 烧入视频节点)', group: '应用节点', canRun: canCreateWorkflowFromNode }),
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
