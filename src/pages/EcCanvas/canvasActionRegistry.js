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
    /* 有下拉的按钮：点了不开面板，而是展开一列「方式」（见 SUBTITLE_ERASE_MODES） */
    hasModes: options.hasModes === true,
    billing,
    priceLabel: priceFeature ? formatCanvasActionPrice(priceFeature) : '免费',
  });
}

/* ═══ 智能去字幕的两种擦除方式（2026-10-03 用户交互稿）════════════════════════════
   工具栏上是「智能去字幕 ▾」，下拉两项：
     · **智能擦除** —— 自动识别画面里的字幕并擦掉
       （服务端 `spec.auto`，走火山 MediaKit，0.05 积分/秒）
     · **框选擦除** —— 自己框区域
       （服务端 `spec.regions`，本机 ffmpeg delogo，0.04 积分/秒、成��� 0）

   ⚠️ 这**不是新造能力**：`server/localVideoPlan` 早就把两种规格分开了
     （`spec.auto` 不参与"区域非空"判定，`spec.regions` 必须有区域），
     `server/videoCatalog` 也早就有 `desubtitle_volc` 与 `desubtitle_local`
     两个产品。这一批做的是把前端那个**只有一种**的入口补齐。

   ⚠️ **可售状态不许前端自己判**：`capabilities().subtitleAuto.available/reason`
     由服务端给（凭据没配、或还没跑通一次真片子时就不可选）。
     前端只读不算 —— 页面里自己写一份就是"目录之外还有第二份真相"
     （server 批 AZ 的原话：目录一改，页面不会跟着改，而且没人会发现）。 */
export const SUBTITLE_ERASE_MODES = Object.freeze([
  Object.freeze({
    id: 'auto',
    label: '智能擦除',
    productId: 'desubtitle_volc',
    priceFeature: 'video-desubtitle-auto',
    needsRegions: false,
    hint: '自动识别画面里的字幕并擦除',
  }),
  Object.freeze({
    id: 'box',
    label: '框选擦除',
    productId: 'desubtitle_local',
    priceFeature: 'video-desubtitle',
    needsRegions: true,
    /* 上限 5：与交互稿一致（"3/5"）。再多则超出本机 delogo 一次能表达的合理范围。 */
    maxRegions: 5,
    hint: '自己框选要擦除的区域 —— 不止字幕，画面里任何字都行',
  }),
]);

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
  /* ⚠️ 2026-10-02：计价项接好之后（批 之二十）才挂上来。第一版挂过又被撤 —— 那时
     priceFeature 写的是不存在的 'video-subtitle' ⇒ 查表落空、**静默回落成「免费」**，
     而后端 delogo 是按秒真扣的（canvas-billing 门禁原话："UI 显示免费但后端实收"）。
     现在键是真实存在的 'video-desubtitle'（perSecond + unitsPerSecond 0.04，
     单价由门禁从服务端 catalog 逐值核对）。
     ⚠️ 按钮上显示的是**单价**；总价随这条视频的时长变化，由服务端 quote 给出。 */
  action('smart-subtitle-erase', '智能去字幕', ['video-toolbar'], 'video-desubtitle', false, {
    type: 'local', handler: 'smart-subtitle-erase',
  }, {
    description: '擦除画面里的字幕：可自动识别，也可自己框选',
    group: '视频处理',
    canRun: isReadyVideoNode,
    hasModes: true,
  }),
  action('preview-media', '预览', ['video-toolbar'], null, false, {
    type: 'local', handler: 'preview-media',
  }, {
    description: '放大预览这条视频',
    group: '视频处理',
    canRun: isReadyVideoNode,
  }),
  action('export-video', '导出视频', ['video-toolbar'], null, false, {
    type: 'local', handler: 'export-video',
  }, {
    /* 2026-10-03 用户批注：「下载视频点击之后依然是保存画布，
       这个功能难道不该叫导出吗」—— 除了行为要真导出，文案也一并对齐：
       它走的是"取回素材 → 存到本地"这条**导出**链路，不是浏览器下载。
       图片侧同一档叫「导出图片」，两侧统一。 */
    description: '把这条视频导出到本地',
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

/* ═══ 工具栏信息架构（2026-10-03 用户批注：「哪些元素放什么排序要有规划啊」）═════════════

   原状：动作表里其实**已经写了** `group`（优先操作 / 电商处理 / 创作与修改 / 应用节点 /
   视频处理），但渲染时**从头到尾没按它排过** —— 工具栏就是 `CANVAS_ACTIONS` 的数组顺序。
   于是视频那条工具栏第一颗是「加入资产库」：
   它是**收纳**类动作（点一下把素材收进长期资产库、还会让按钮变成高亮态），
   却是四个动作里最低频的，却占了最前的位置。

   ⇒ 下面是**唯一的排序真相**。分档的依据不是"哪个功能更大"，是**用户点它的时机**：

     ① 就地编辑  —— 我已经选中它了，我要改的就是它本身，不产生任何新东西
                   （替换 / 裁剪 / 标注 / 移动缩放 / 编辑文字）
     ② 智能处理  —— 对它跑一次 AI，出来一版新素材
                   （智能去字幕 / 智能分层 / 去除背景 / 反推提示词 / 宫格切分）
     ③ 产出      —— 把它拿出去或看一眼（下载 / 导出 / 预览）
     ④ 收纳      —— 把它放进长期资产（加入资产库）
     ⑤ 危险      —— 破坏性（删除）

     频次从高到低、破坏性从低到高 —— 与 Figma / Excalidraw 的工具栏一致。

     档内保持 `CANVAS_ACTIONS` 的声明顺序（同档不再二次排序），
     稳定排序，不让同档之间的既有次序乱掉。 */
export const CANVAS_TOOLBAR_TIERS = Object.freeze(['edit', 'ai', 'output', 'asset', 'danger']);

/** 动作 id → 档位。**没列在这里的动作一律排在最后**（而不是留在数组原位），
    这样将来新增一个动作若忘了定档，会被顶到末尾 —— 不会悄悄插到中间打乱规划。 */
const CANVAS_ACTION_TIER = Object.freeze({
  /* ① 就地编辑 */
  'replace-media': 'edit',
  crop: 'edit',
  annotation: 'edit',
  'move-scale': 'edit',
  'edit-text': 'edit',
  /* ② 智能处理 */
  'smart-subtitle-erase': 'ai',
  'layer-edit': 'ai',
  'remove-background': 'ai',
  'reverse-prompt': 'ai',
  'grid-split': 'ai',
  'adjust-requirements': 'ai',
  regenerate: 'ai',
  'product-remix': 'ai',
  outpaint: 'ai',
  inpaint: 'ai',
  translate: 'ai',
  upscale: 'ai',
  'add-reference': 'ai',
  'application-1click-suite': 'ai',
  'application-1click-video': 'ai',
  'application-tts': 'ai',
  'application-caption': 'ai',
  /* ③ 产出 / 查看 */
  'export-video': 'output',
  download: 'output',
  'preview-media': 'output',
  'export-object': 'output',
  /* ④ 收纳 */
  'save-to-assets': 'asset',
  /* ⑤ 危险 */
  delete: 'danger',
});

function sortByCanvasToolbarIa(actions) {
  const rank = id => {
    const tier = CANVAS_ACTION_TIER[id];
    const index = CANVAS_TOOLBAR_TIERS.indexOf(tier);
    return index < 0 ? CANVAS_TOOLBAR_TIERS.length : index;
  };
  /* stable：同档维持声明顺序 */
  return actions
    .map((action, index) => ({ action, index }))
    .sort((a, b) => (rank(a.action.id) - rank(b.action.id)) || (a.index - b.index))
    .map(entry => entry.action);
}

/* selection 工具栏: 素材存在期间结构稳定且全部可用 (用户 9-05 反馈:
   "功能栏的功能就是留给图片用的, 平时应该开放给用户" — 不再置灰)。 */
export function stableActionsForSurface({ surface, node } = {}) {
  /* 视频节点 ⇒ 只给视频专属动作（外加"加入资产库"这种两边都成立的通用项） */
  if (isVideoNode(node) && !VIDEO_SELECTION_SURFACES.has(surface)) {
    return sortByCanvasToolbarIa(CANVAS_ACTIONS
      .filter(item => item.surfaces.includes('video-toolbar') || item.id === 'save-to-assets')
      .filter(item => item.canRun(node))
      .map(item => ({ ...item, disabled: false, disabledHint: '' })));
  }
  const hasPreview = canRunLocally(node);
  return sortByCanvasToolbarIa(CANVAS_ACTIONS
    .filter(item => item.surfaces.includes(surface))
    .filter(item => hasPreview || item.canRun(node))
    .map(item => ({ ...item, disabled: false, disabledHint: '' })));
}

export function canvasActionHandler(actionOrId) {
  const selected = typeof actionOrId === 'string' ? getCanvasAction(actionOrId) : actionOrId;
  return selected?.execute?.handler || '';
}
