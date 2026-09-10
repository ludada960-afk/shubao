// server/templates/builtinTemplates.mjs
// P2 业务资产层 — 5 个内置工作流模板（图结构按 docs/plan/p2-workflow-templates-spec.md §2）。
//
// 诚实分期（spec §0）：
//   - T2 纯图链（双槽填齐即端到端可跑）；T1/T3 含 text 节点（P1 不执行 text：填空 = 无产物 -> unsupported，
//     填入文本后变 source 喂下游 image-composer 段，本期“填空即跑”）；T3 的 splice 属 P3 已接线的本地免费动作
//   - T4/T5 含 P3 音视频 kind（video-composer / tts / lip-sync / video / audio）：P1 buildRunPlan 会把它们
//     判为 unsupported —— 本期只做“目录 + 图结构 + 一键铺开”，前端渲染“待 P3”灰态，**不 mock 假跑、不发起扣费**。
//
// 节点形状与 src/pages/EcCanvas/canvasSessionModel.js createCanvasSnapshot 一致：
//   每节点 {id, kind, actionId?, x, y, w, h, group, role, sourceNodeIds:[]};
//   [槽] 槽位节点额外 {url:'', slot:true, isSlot:true}（前端高亮琥珀描边“把商品图拖进来”）。
// 连线统一 {fromNodeId, toNodeId, relation:'reference'}（spec §2：图 = 唯一真源，@ 编号=入边顺序）。
//
// 不变式：
//   ① 模板不单独收费（pricing 仅展示预估，卡片点开前显示“预计 X 积分”）；
//   ③ pricing.estimatedUnits 是展示预估，实际结算走 P1 执行器 + 计费 catalog（单一价格真源）。
// 坐标从左到右铺开，一键铺开后读图顺序即运行顺序。

function makeNode({ id, kind, actionId, x, y, w, h, group, role, name, slot = false, params = null }) {
  const node = {
    id,
    kind,
    x,
    y,
    w,
    h,
    group,
    role,
    sourceNodeIds: [],
  };
  if (actionId) node.actionId = actionId;
  if (slot) {
    node.url = '';
    node.slot = true;
    node.isSlot = true;
  } else if (kind === 'text') {
    node.text = '';
  }
  if (params) node.params = params;
  if (name) {
    node.name = name;
    node.displayLabel = name;
  }
  return node;
}

/* 用户 9-10 反馈: 模板里的素材节点必须"长得跟真实上传的素材一样", 不许自造槽位样式。
   这里直接产出与 createUploadedImageNodes / createUploadedVideoNodes 同款的节点形状,
   并预置真实占位素材（铺开后可用「替换」一键换成自己的图, 无需重新连线）。 */
const PLACEHOLDER_ASSETS = Object.freeze({
  product: { url: '/images/home/ecommerce-showcase/earbuds-product-source.png', ratio: '1:1', w: 240, h: 240 },
  model: { url: '/images/home/ecommerce-showcase/earbuds-detail-fit.png', ratio: '1:1', w: 240, h: 240 },
  garment: { url: '/images/home/ecommerce-showcase/earbuds-main-lifestyle.png', ratio: '1:1', w: 240, h: 240 },
  motion: { url: '/images/home/ecommerce-showcase/earbuds-suite-composite.png', ratio: '16:9', w: 320, h: 180 },
});

/* 图片素材节点: 与 createUploadedImageNodes 同款字段（真实上传物长这样）。 */
function materialImageNode({ id, x, y, name, asset }) {
  const a = PLACEHOLDER_ASSETS[asset] || PLACEHOLDER_ASSETS.product;
  return {
    id, kind: 'image', provenance: 'source', status: 'ready',
    url: a.url, name, displayLabel: name, group: '素材', role: '素材', ratio: a.ratio,
    sourceNodeIds: [], editable: true, showMeta: true,
    x, y, w: a.w, h: a.h, rotation: 0, flipX: false, flipY: false, locked: false, hidden: false,
    templatePlaceholder: true,
  };
}

/* 视频素材节点: 与 createUploadedVideoNodes 同款字段。 */
function materialVideoNode({ id, x, y, name, asset = 'motion' }) {
  const a = PLACEHOLDER_ASSETS[asset] || PLACEHOLDER_ASSETS.motion;
  return {
    id, kind: 'video', provenance: 'source', status: 'ready',
    url: a.url, name, displayLabel: name, group: '视频', role: '参考视频',
    aspectRatio: a.ratio, duration: 5, resolution: '720P',
    sourceNodeIds: [], editable: true, showMeta: true,
    x, y, w: a.w, h: a.h, rotation: 0, flipX: false, flipY: false, locked: false, hidden: false,
    templatePlaceholder: true,
  };
}

const edge = (fromNodeId, toNodeId) => ({ fromNodeId, toNodeId, relation: 'reference' });

export const BUILTIN_WORKFLOW_TEMPLATES = Object.freeze([
  /* T1 白底主图 —— 本期可跑通（est ~1.2）。 */
  Object.freeze({
    slug: 'white-bg-main',
    name: '白底主图',
    category: 'image',
    description: '拖入商品图 → 反推提示词 → 生成白底主图。电商主图最快链路，仅主图生成为付费动作。',
    authorEmail: 'system',
    isBuiltIn: true,
    isPublic: true,
    requiresAudioVideo: false,
    /* 诚实分期：text 节点（reverse-prompt）空着 = 无产物 -> P1 判 unsupported；填入文本后变 source，主图段才可跑。 */
    runnableThisPhase: false,
    gateNote: '需先填“反推提示词”文本（或 P1.1 反推自动产出）；空文本节点会被 P1 判 unsupported 并封锁下游主图，填后即可跑图像段',
    pricing: { estimatedUnits: 1.2, note: '预估 1.2 积分：反推 0.2 + 主图 1.0（展示预估，结算以目录为准）' },
    graph: Object.freeze({
      nodes: Object.freeze([
        materialImageNode({ id: 'slot-product', x: 40, y: 120, name: '商品图', asset: 'product' }),
        makeNode({ id: 'reverse-prompt', kind: 'text', actionId: 'reverse-prompt', x: 400, y: 120, w: 320, h: 140, group: '文本', role: 'text', name: '反推提示词' }),
        makeNode({ id: 'main-image', kind: 'image', actionId: 'image-composer', x: 840, y: 120, w: 320, h: 240, group: '图像', role: 'generate', name: '白底主图' }),
      ]),
      connections: Object.freeze([
        edge('slot-product', 'reverse-prompt'),
        edge('reverse-prompt', 'main-image'),
      ]),
    }),
  }),

  /* T2 模特试穿 —— 本期可跑通（est ~2，无模特图自动补 +1）。 */
  Object.freeze({
    slug: 'model-try-on',
    name: '模特试穿',
    category: 'image',
    description: '服装图 + 模特图 → 试穿合成；模特图并行喂 16:9 三视图。没有模特图可自动补位（+1 积分）。',
    authorEmail: 'system',
    isBuiltIn: true,
    isPublic: true,
    requiresAudioVideo: false,
    /* 唯一“本期端到端可跑”的纯图链：槽位填齐后 try-on + three-view（image-composer，P1 白名单）全部可执行。 */
    runnableThisPhase: true,
    gateNote: '纯图链（P1 已支持）：填齐服装图 + 模特图即可端到端运行，无文本/P3 门控',
    pricing: { estimatedUnits: 2, note: '预估 2 积分：试穿 1 + 三视图 1（无模特图补位 +1；结算以目录为准）' },
    graph: Object.freeze({
      nodes: Object.freeze([
        materialImageNode({ id: 'slot-garment', x: 40, y: 40, name: '服装图', asset: 'garment' }),
        materialImageNode({ id: 'slot-model', x: 40, y: 480, name: '模特图', asset: 'model' }),
        makeNode({ id: 'try-on', kind: 'image', actionId: 'image-composer', x: 440, y: 160, w: 320, h: 300, group: '图像', role: 'generate', name: '试穿合成' }),
        makeNode({ id: 'three-view', kind: 'image', actionId: 'image-composer', x: 920, y: 380, w: 320, h: 180, group: '图像', role: 'generate', name: '三视图 (16:9)' }),
      ]),
      connections: Object.freeze([
        edge('slot-garment', 'try-on'),
        edge('slot-model', 'try-on'),
        edge('slot-model', 'three-view'),
      ]),
    }),
  }),

  /* T3 场景详情(N) —— 本期可跑通（est ~1.2+N，N 由节点 params.count 调，默认 3；拼接本地免费）。 */
  Object.freeze({
    slug: 'scene-detail',
    name: '场景详情 ×N',
    category: 'image',
    description: '商品图 → 反推提示词 → 生成 N 张场景图（默认 3，可在“场景图”节点 params.count 调整）→ 本地免费拼接详情长图。',
    authorEmail: 'system',
    isBuiltIn: true,
    isPublic: true,
    requiresAudioVideo: false,
    /* P3 已接线: splice（本地 sharp 免费）进 P1 白名单 -> 填空 text 后场景段 + 详情拼接全链可跑（0 扣费拼接）；
       runnableThisPhase 保持 false = 模板级 UI 门控口径不动 (requiresAudioVideo 门控不变), 仅描述性 gateNote 更新。 */
    runnableThisPhase: false,
    gateNote: '需先填“反推提示词”文本再跑场景段；详情拼接（splice）P3 已接线：本地 sharp 竖排长图免费（0 扣费），视频拼接需 ffmpeg 环境（P3.1 门控）',
    pricing: { estimatedUnits: 4.2, note: '预估 1.2 + N 积分（N = 场景图张数，默认 3 → 4.2；详情拼接本地免费）' },
    graph: Object.freeze({
      nodes: Object.freeze([
        materialImageNode({ id: 'slot-product', x: 40, y: 180, name: '商品图', asset: 'product' }),
        makeNode({ id: 'reverse-prompt', kind: 'text', actionId: 'reverse-prompt', x: 400, y: 180, w: 320, h: 140, group: '文本', role: 'text', name: '反推提示词' }),
        makeNode({ id: 'scene', kind: 'image', actionId: 'image-composer', x: 800, y: 180, w: 320, h: 240, group: '图像', role: 'generate', name: '场景图 ×N', params: { count: 3 } }),
        makeNode({ id: 'detail-splice', kind: 'image', actionId: 'splice', x: 1240, y: 180, w: 320, h: 240, group: '图像', role: 'process', name: '详情图拼接' }),
      ]),
      connections: Object.freeze([
        edge('slot-product', 'reverse-prompt'),
        edge('reverse-prompt', 'scene'),
        edge('scene', 'detail-splice'),
      ]),
    }),
  }),

  /* T4 换装短视频（旗舰）—— P3 门控（video-composer 未进 P1 白名单，诚实不支持，不 mock）。 */
  Object.freeze({
    slug: 'outfit-video',
    name: '换装短视频（旗舰）',
    category: 'video',
    description: '模特图 + 服装图 → 试换装 → 成片短视频；动作参考视频 → 分镜脚本 → 成片。P3 门控：视频能力待上线，画布内呈“待 P3”灰态，不可发起扣费运行。',
    authorEmail: 'system',
    isBuiltIn: true,
    isPublic: true,
    requiresAudioVideo: true,
    /* P3 门控：video-composer / storyboard 不在 P1 白名单 -> 诚实 unsupported，不 mock、不发起扣费运行。 */
    runnableThisPhase: false,
    gateNote: 'P3 门控：video-composer / storyboard 为 P3 kind（P1 白名单外），视频能力即将上线，本期不可扣费运行',
    pricing: { estimatedUnits: 29, note: '预估 29 积分：试穿 1 + 分镜 1 + 成片视频 27（P3 音视频上线后结算）' },
    graph: Object.freeze({
      nodes: Object.freeze([
        materialImageNode({ id: 'slot-model', x: 40, y: 40, name: '模特图', asset: 'model' }),
        materialImageNode({ id: 'slot-garment', x: 40, y: 480, name: '服装图', asset: 'garment' }),
        materialVideoNode({ id: 'slot-motion', x: 40, y: 920, name: '视频素材', asset: 'motion' }),
        makeNode({ id: 'try-on', kind: 'image', actionId: 'image-composer', x: 440, y: 160, w: 320, h: 300, group: '图像', role: 'generate', name: '试换装' }),
        makeNode({ id: 'storyboard', kind: 'text', actionId: 'storyboard', x: 440, y: 720, w: 320, h: 140, group: '文本', role: 'text', name: '分镜脚本' }),
        makeNode({ id: 'final-video', kind: 'video', actionId: 'video-composer', x: 920, y: 400, w: 360, h: 240, group: '视频', role: 'generate', name: '成片短视频' }),
      ]),
      connections: Object.freeze([
        edge('slot-model', 'try-on'),
        edge('slot-garment', 'try-on'),
        edge('try-on', 'final-video'),
        edge('slot-motion', 'storyboard'),
        edge('storyboard', 'final-video'),
      ]),
    }),
  }),

  /* T5 口播带货 —— P3 门控（tts / lip-sync 未进 P1 白名单，诚实不支持，不 mock）。 */
  Object.freeze({
    slug: 'voiceover',
    name: '口播带货',
    category: 'video',
    description: '商品图 → 卖点口播文案 → TTS 配音；商品图 → 主播形象图；TTS + 主播图 → 对口型成片。P3 门控：音视频能力待上线。',
    authorEmail: 'system',
    isBuiltIn: true,
    isPublic: true,
    requiresAudioVideo: true,
    /* P3 门控：tts / lip-sync 不在 P1 白名单 -> 诚实 unsupported，不 mock、不发起扣费运行。 */
    runnableThisPhase: false,
    gateNote: 'P3 门控：tts / lip-sync 为 P3 kind（P1 白名单外），音视频能力即将上线，本期不可扣费运行',
    pricing: { estimatedUnits: 8.2, note: '预估 8.2 积分：文案 0.2 + 主播图 1 + TTS 1 + 对口型 6（P3 音视频上线后结算）' },
    graph: Object.freeze({
      nodes: Object.freeze([
        materialImageNode({ id: 'slot-product', x: 40, y: 220, name: '商品图', asset: 'product' }),
        makeNode({ id: 'selling-copy', kind: 'text', actionId: 'selling-copy', x: 400, y: 40, w: 320, h: 140, group: '文本', role: 'text', name: '卖点口播文案' }),
        makeNode({ id: 'host-image', kind: 'image', actionId: 'image-composer', x: 400, y: 460, w: 300, h: 300, group: '图像', role: 'generate', name: '主播形象图' }),
        makeNode({ id: 'tts', kind: 'audio', actionId: 'tts', x: 800, y: 40, w: 320, h: 96, group: '音频', role: 'generate', name: '口播配音' }),
        makeNode({ id: 'lip-sync', kind: 'video', actionId: 'lip-sync', x: 1200, y: 260, w: 360, h: 240, group: '视频', role: 'generate', name: '对口型成片' }),
      ]),
      connections: Object.freeze([
        edge('slot-product', 'selling-copy'),
        edge('selling-copy', 'tts'),
        edge('slot-product', 'host-image'),
        edge('host-image', 'lip-sync'),
        edge('tts', 'lip-sync'),
      ]),
    }),
  }),
]);
