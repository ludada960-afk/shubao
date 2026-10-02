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

/* ═══ 2026-10-02 用户批注：视频节点的工具栏必须是**视频专属**的一套 ═══════════════════════
   > 「而且你上面的这些功能栏太少了。而且好像也不完全是为视频功能去定制的一些功能呀。
   >   **视频跟图片生成他们是不同的逻辑才对呀，你应该定制化的为他去开发一些功能。**」

   **病根不是"少注册了几个动作"，是筛选链路整个不认视频**：
     · `action()` 的默认 `canRun` 是 `isReadyImage`（**只认 image/output/layer-group**）
     · `stableActionsForSurface` 的兜底 `hasPreview = canRunLocally(node)` 也只认图片
   ⇒ 一条视频节点进来，`hasPreview=false`、每个动作再被 `canRun` 拦一遍
     ⇒ 拿到的那几颗，是"恰好 canRun 里写了 video"的（save-to-assets / replace-media），
        其余全是图片动作（编辑文字 / 宫格切分 / 智能分层 / 去除背景 / 图片标注）。

   ⇒ 这里补一个显式的**视频判定**，并让 selection 面在视频节点上返回视频专属动作组。
      刻意**不**把 `isReadyImage` 改成 `isReadyMedia` —— 那会把图片动作一股脑放给视频，
      正是用户说的"不完全是为视频定制的"。 */

/** 视频节点是否可跑本地/导出类动作（有稳定地址 + 不在失败态即可）。 */
export function isReadyVideoNode(node = {}) {
  return String(node?.kind || '') === 'video'
    && Boolean(node?.url)
    && !['error', 'upload-error', 'generating', 'draft'].includes(String(node?.status || ''));
}

/** 这个节点是不是视频（工具栏分流用）。 */
export function isVideoNode(node = {}) {
  return String(node?.kind || '') === 'video';
}

/* 用户 9-05 反馈: 图片工具栏"大部分功能不能点"是反人类的。
   上传节点落地时 url 就是服务器稳定地址且 status=ready, 有 url 即可发起
   全部图片能力; source_group 仍保留原有严格门槛。 */
export function canCreateWorkflowFromNode(node = {}) {
  if (node.kind === 'source_group') {
    return node.status === 'ready'
      && (node.sourceRole || 'product_original') === 'product_original'
      && Array.isArray(node.assets)
      && node.assets.some(asset => asset?.url);
  }
  /* url 门槛: 上传节点长期处于 uploading (后台持久化), 必须立即可派生;
     只有明确的进行中(generating)/失败(error)/草稿(draft) 才锁住;
     且仅限媒体类节点 ('process' 等中间产物不可派生) */
  if (['generating', 'error', 'draft'].includes(String(node?.status || ''))) return false;
  if (!['image', 'output', 'layer-group', 'video'].includes(String(node?.kind || ''))) return false;
  return Boolean(node?.url);
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
  /* 用户 9-10 要求: 选中素材必须能给「替换」(对标竞品) —— 换图/换视频后位置与连线保持不变。
     9-11 用户批注: 位置不对标流影AI —— 不放顶部工具条, 放节点本身(选中即现的角标胶囊)。
     surface 改 node-capsule: 工具条/右键菜单都不再渲染, 由节点组件的 onReplace 胶囊承载。 */
  action('replace-media', '替换', ['node-capsule'], null, false, {
    type: 'local', handler: 'replace-media',
  }, {
    description: '上传新素材替换当前图片或视频，位置与连线不变',
    group: '优先操作',
    /* 失败/上传失败节点不给替换。 */
    canRun: node => ['image', 'output', 'layer-group', 'video'].includes(String(node?.kind || ''))
      && !['error', 'upload-error'].includes(String(node?.status || '')),
  }),
  action('add-text', '添加文字', [], null, false, {
    type: 'local', handler: 'add-text',
  }, { description: '在画布上添加可直接编辑的文字', canRun: canRunLocally }),
  action('grid-split', '宫格切分', ['selection'], 'grid-split', false, {
    type: 'focused-editor', handler: 'grid-split',
  }, { canRun: canRunLocally }),
  action('layer-edit', '智能分层', ['selection'], 'layer-edit', false, {
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
  /* 9-12 用户批注：这个按钮（加入资产库）原来夹在「编辑文字」后面，且是纯图标容易被当成莫名的「添加」。
     按竞品做法挪到**裁剪/导出这一组**里，用语义明确的图标，点过后高亮表示已在资产库。 */
  action('save-to-assets', '加入资产库', ['selection'], null, false, {
    type: 'local', handler: 'save-to-assets',
  }, {
    description: '把这个素材明确加入资产库，跨项目复用（加入后按钮高亮）',
    canRun: node => ['image', 'output', 'video', 'audio'].includes(String(node?.kind || ''))
      && Boolean(node?.url)
      && !['error', 'upload-error', 'uploading', 'processing'].includes(String(node?.status || '')),
  }),
  action('crop', '裁剪', ['selection'], 'crop', false, {
    type: 'focused-editor', handler: 'crop',
  }, { canRun: canRunLocally }),
  action('split-image', '分割图片', ['context'], null, false, {
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
  action('application-1click-suite', '应用: 5 宫格套图', ['image-editor'], 'smart-remix', true, {
    type: 'node', handler: 'create:application-1click-suite', nodeActionId: 'application-1click-suite', nodeKind: 'application', route: '/api/canvas/regenerate', requires: { prompt: true },
  }, { description: '应用节点 5 宫格套图 (Quantv 风格: 串联 1 输入 + 5 输出)', group: '应用节点', canRun: canCreateWorkflowFromNode }),
  action('application-1click-video', '应用: 1-click 视频', ['image-editor'], null, true, {
    type: 'node', handler: 'create:application-1click-video', nodeActionId: 'application-1click-video', nodeKind: 'application', route: '/api/canvas/one-click-video',
  }, { description: '应用节点 1-click 视频 (Quantv 风格: 4 步 chain 串联 文本/图片/视频/音频)', group: '应用节点', canRun: canCreateWorkflowFromNode }),
  action('application-tts', '应用: TTS 配音', ['image-editor'], null, true, {
    type: 'node', handler: 'create:application-tts', nodeActionId: 'application-tts', nodeKind: 'application', route: '/api/canvas/tts',
  }, { description: '应用节点 TTS 配音 (5 provider: 火山/阿里云/ElevenLabs/Azure/MiniMax)', group: '应用节点', canRun: canCreateWorkflowFromNode }),
  action('application-caption', '应用: 字幕动效', ['image-editor'], null, true, {
    type: 'node', handler: 'create:application-caption', nodeActionId: 'application-caption', nodeKind: 'application', route: '/api/canvas/caption',
  }, { description: '应用节点字幕动效 (弹出/淡入/逐字动画, 烧入视频节点)', group: '应用节点', canRun: canCreateWorkflowFromNode }),

  /* ═══ 视频专属动作组 ═════════════════════════════════════════════════════════════
     用户 2026-10-02（照知渔视频工具栏：智能去字幕 / 聚焦 / 下载 / 添加 / 预览）：
       「你上面的这些功能栏太少了。而且好像也不完全是为视频功能去定制的一些功能呀。
         视频跟图片生成他们是不同的逻辑才对呀，你应该定制化的为他去开发一些功能。」

     下面这一组**只**在视频节点上出现（见 actionsForSurface 的分流），
     刻意不与图片动作混在一张表里 —— 混了就会重演"视频拿到一堆图片功能"。 */
  action('preview-media', '预览', ['video-toolbar'], null, false, {
    type: 'local', handler: 'preview-media',
  }, {
    description: '放大预览这条视频',
    group: '视频处理',
    canRun: isReadyVideoNode,
  }),
  action('export-video', '下载视频', ['video-toolbar'], null, false, {
    type: 'local', handler: 'export-video',
  }, {
    description: '把这条视频存到本地',
    group: '视频处理',
    canRun: isReadyVideoNode,
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

/* ⚠️ 2026-10-02：视频节点走**视频专属**那一组，不与图片动作混在一起。
   混在一起会重演用户抱怨的「不完全是为视频定制的」—— 编辑文字/宫格切分/图片标注
   对一条视频毫无意义。 */
const VIDEO_SELECTION_SURFACES = new Set(['video-toolbar']);

/* selection 工具栏: 素材存在期间结构稳定且全部可用 (用户 9-05 反馈:
   "功能栏的功能就是留给图片用的, 平时应该开放给用户" — 不再置灰)。 */
export function stableActionsForSurface({ surface, node } = {}) {
  /* 视频节点 ⇒ 只给视频专属动作（外加"加入资产库"这种两边都成立的通用项） */
  if (isVideoNode(node) && !VIDEO_SELECTION_SURFACES.has(surface)) {
    return CANVAS_ACTIONS
      .filter(item => item.surfaces.includes('video-toolbar') || item.id === 'save-to-assets')
      .filter(item => item.canRun(node))
      .map(item => ({ ...item, disabled: false, disabledHint: '' }));
  }
  const hasPreview = canRunLocally(node);
  return CANVAS_ACTIONS
    .filter(item => item.surfaces.includes(surface))
    .filter(item => hasPreview || item.canRun(node))
    .map(item => ({ ...item, disabled: false, disabledHint: '' }));
}

export function canvasActionHandler(actionOrId) {
  const selected = typeof actionOrId === 'string' ? getCanvasAction(actionOrId) : actionOrId;
  return selected?.execute?.handler || '';
}
