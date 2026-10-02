import { normalizeCommerceContext } from '../Home/ec/internationalCommerceRegistry.js';
import { attachCanvasProjectAssetRef } from './canvasAssetReferenceModel.js';
import { formatCanvasShotName, resolveShotPrefix } from '../../constants/canvasNames.js';
/* ⚠️ 2026-09-29 批 DC 续-8：新建节点的默认比例 **'1:1' → ADAPTIVE_RATIO**（用户逐字：
   「还有**画布里面的生图配置**啊这些地方。**自适应应该是它默认的一个选项呀。**」）
   ⚠️ 注意 `CANVAS_RATIO_OPTIONS` 本身**不含**「自适应」—— 它是「**选项**不是尺寸」
     （同首页那套口径）：渲染时由 `withAdaptiveRatioOption` 把这一档注入到列表最前面。
     这里只改**默认值**，不动那份尺寸名单。 */
import { ADAPTIVE_RATIO } from './canvasAdaptiveRatio.js';
import { DEFAULT_IMAGE_MODEL } from '../../services/imageModelCatalog.js';

/* ═══════ 4c183cd4 续命 P-B 画布节点电影分镜命名 ═══════
   资深美工视角: 「素材 1」「图片 1」无法体现镜头/声轨/画面职责
   流影AI LibTV Agent 视角: Enclosure (取景) / Breakthrough (突破) / Framing (构图) / Voice (口播) 等
   1 个画布 session 内按 kind 维持独立计数器, 保证单调递增, 跟 videoCanvasModel 同源
   用户未重命名时直接显示分镜名, 重命名后保留用户输入, 计数器不再自增该节点 */
/* 9-11 用户批注: 生成器要有 skill 选项 (对标流影AI)。skill = P2 工作流模板 (技能市场层) 的五套内置技能,
   选择后把技能的结构化提示词预填进生成器 prompt (用户可见可改, 不是假能力):
   数据源 = server/templates/builtinTemplates.mjs 的 slug (white-bg-main/model-try-on/scene-detail/outfit-video/voiceover)。 */
/* 9-11 用户批注#5: 技能按能力域分域 — 生图节点只出「生图技能」, 视频节点只出「视频技能」,
   不再把换装短视频/口播带货塞进图片生成器。 */
export const CANVAS_SKILLS = Object.freeze([
  Object.freeze({ slug: 'white-bg-main', name: '白底主图', domain: 'image', skillPrompt: '纯净白底背景，商品居中完整入画，标准电商主图构图，光线均匀柔和，保留商品真实颜色与材质细节，不添加文字与水印' }),
  Object.freeze({ slug: 'model-try-on', name: '模特试穿', domain: 'image', skillPrompt: '真实模特自然试穿，展示服装版型与面料质感，姿态舒展不夸张，背景干净，保留商品原有颜色、图案与细节' }),
  Object.freeze({ slug: 'scene-detail', name: '场景详情', domain: 'image', skillPrompt: '真实生活场景摆拍，突出使用情境，多张细节特写，光线柔和有层次，商品为画面主体' }),
  Object.freeze({ slug: 'outfit-video', name: '换装短视频', domain: 'video', skillPrompt: '节奏明快的换装展示，动作自然连贯，镜头跟随主体，结尾全身定格展示' }),
  Object.freeze({ slug: 'voiceover', name: '口播带货', domain: 'video', skillPrompt: '口播带货画面，人物面向镜头自然讲述，表情生动，字幕区域留白，背景简洁不抢主体' }),
]);

/* 按能力域过滤技能: image=生图节点, video=视频生成器; domain 缺省 = 不过滤 (旧数据兼容) */
export function filterCanvasSkills(domain) {
  const wanted = String(domain || '');
  return CANVAS_SKILLS.filter(item => (wanted && item.domain === wanted) || (!wanted && !item.domain));
}

/* 纯函数: 应用技能 → { prompt, skill }。
 *
 *  2026-09-16 用户批注（图5-①）：「技能库里面我点击使用，他并没有把技能带入到输入框这边呀。
 *  你之前的一个版本里面是有做到的，是有实现的。现在怎么把他们全部拿掉了呀？」
 *  —— 他说得对：画布侧一直是「把技能正文写进提示词」，而首页电商与视频页退化成了
 *  只加一个不可见的 userSkills 字段 + 一个 chip，用户点完「使用」什么都看不见。
 *  本函数现在是**三处共用**的唯一实现（首页 / 视频 / 画布），规则统一为：
 *    · prompt 为空 → 直接填入技能正文；
 *    · prompt 非空 → **追加**到末尾（带空行分隔），不覆盖用户已经写的内容；
 *    · 正文已在 prompt 里 → 不重复追加（点了两次也不会出现两份）。
 *  skill 记 slug/名称供节点与 chip 展示。 */
export function applyCanvasSkill({ prompt = '', skill, skillBody = '' } = {}) {
  const found = CANVAS_SKILLS.find(item => item.slug === skill) || null;
  const current = String(prompt || '');
  const appendBody = body => {
    const text = String(body || '').trim();
    if (!text) return current;
    if (current.includes(text)) return current;
    return current.trim() ? `${current.replace(/\s+$/, '')}\n\n${text}` : text;
  };
  if (!found) {
    const body = String(skillBody || '').trim();
    if (body) return { prompt: appendBody(body), skill: String(skill || ''), skillLabel: String(skill || '') };
    return { prompt: current, skill: null };
  }
  // 内置技能：正文来自技能定义；用户已写内容同样只追加、不覆盖。
  return { prompt: appendBody(found.skillPrompt), skill: found.slug, skillLabel: found.name };
}

export function createCanvasShotNamer() {
  const counters = new Map();
  function next(kind, options = {}) {
    const prefix = resolveShotPrefix({ kind, ...options });
    const current = counters.get(prefix) || 0;
    const nextCounter = current + 1;
    counters.set(prefix, nextCounter);
    return formatCanvasShotName(prefix, nextCounter);
  }
  function preset(kind, counter, options = {}) {
    const prefix = resolveShotPrefix({ kind, ...options });
    const safeCounter = Math.max((counters.get(prefix) || 0) + 1, Number(counter) || 1);
    counters.set(prefix, Math.max(safeCounter, counters.get(prefix) || 0));
    return formatCanvasShotName(prefix, counter);
  }
  function snapshot() {
    return Object.fromEntries(counters.entries());
  }
  return { next, preset, snapshot, counters };
}

const MIN_NODE_WIDTH = 160;
const MIN_NODE_HEIGHT = 56;
const MAX_NODE_WIDTH = 960;
const MAX_NODE_HEIGHT = 1200;


export const CANVAS_RATIO_OPTIONS = Object.freeze(['1:1', '3:4', '4:3', '9:16', '16:9']);
export const CANVAS_RESOLUTION_OPTIONS = Object.freeze(['1K', '2K', '4K']);
export const CANVAS_COUNT_OPTIONS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
export const CANVAS_SUITE_COUNT_OPTIONS = Object.freeze([3, 6, 9, 12]);

export function toggleCanvasComposerSurface(current = '', next = '') {
  return current === next ? '' : String(next || '');
}

export function closeCanvasComposerSurface() {
  return '';
}

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function ratioValue(ratio, fallback = 1) {
  const match = String(ratio || '').match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) return fallback;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? width / height : fallback;
}

/** ═══ 批 CY-⑭（2026-09-29）新增：**素材真实比例** ═══════════════════════════════════════════════════
   用户原话（逐字）：「用户上传上来或者生成之后的素材，不管它是图片还是视频，你自己的这个框必须去适配
     它的内容呀……你看你现在这个情况。它上下是有白色部分的，而且我也不确定你这张图左右两边有没有被
     截断的内容。这就是因为你自己没有主动的去把这个框去适配它导致的呀。」
   ⇒ 框的宽高比必须等于**素材真实**的宽高比，不是"从 5 个预设里挑一个最像的"。

   `exactMediaRatio(w, h)`：把已知的像素尺寸约成最简 `W:H` 字符串（如 1200×800 → `'3:2'`）。
   · 认得出就返回**精确**比例；认不出（缺尺寸 / 非正数）返回 `''`，
     由调用方回落到 `closestRatio` 那一档 —— 也就是说：**只有真的量不到时才允许近似**。
   · 约分用 gcd，所以 `'3:2'` 而不是 `'1200:800'`：`ratioValue` 两者都能解析，
     但 ratio 字符串会显示在节点页脚（`[group, ratio, size].join(' · ')`），
     `'1200:800'` 在页脚上很难看。 */
export function exactMediaRatio(width, height) {
  const w = Math.round(finite(width, 0));
  const h = Math.round(finite(height, 0));
  if (!(w > 0 && h > 0)) return '';
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const divisor = gcd(w, h) || 1;
  const rw = w / divisor;
  const rh = h / divisor;
  /* 约分后还剩两位数以上（例如 1024:768 → 128:96）就不适合当标签了，退回近似档。 */
  if (rw > 64 || rh > 64) return '';
  return `${rw}:${rh}`;
}

/** 素材框应当采用的宽高比：**优先精确值**，量不到才近似。 */
export function mediaRatioFor({ ratio, width, height } = {}) {
  if (ratio && ratioValue(ratio, 0) > 0) return String(ratio);
  return exactMediaRatio(width, height) || closestRatio(width, height);
}

export function getCanvasNodePresentation({ selected = false, hovered = false, focusActive = false, related = false } = {}) {
  return {
    state: selected ? 'selected' : hovered ? 'hovered' : 'idle',
    dimmed: Boolean(focusActive && !selected && !related),
    handlesVisible: Boolean(selected || hovered),
  };
}

/* 9-15 用户硬性回退：四个生成框（图片/文案/视频/套图）下面的输入面板**全部被收窄变形**。
   用户原话：「这四个生成功能下面的输入框全部都变形了呀，都变得很窄了，这是错误的呀，
   之前明明好好的，我只是叫你加个统一的技能栏和统一的 @ 按钮，你为什么就把全部的输入栏给做坏了呀」
   → 面板回到**又宽又不空**的大编辑区：默认 640、节点更宽时跟节点同宽、最宽 720。
   内部不出现大片留白：底部参数行（模型/比例/清晰度/张数/技能/@）与生成按钮在同一视觉块内不换行变形。 */
export function getCanvasComposerPresentation({ node, selectedId = '', selectedCount = 1, width = 640, gap = 12 } = {}) {
  const visible = Boolean(node?.id && node.id === selectedId && Number(selectedCount) === 1);
  if (!visible) return { visible: false, position: null };
  const nodeWidth = Math.max(1, finite(node.w, width));
  /* 9-15 最终口径：面板宽 = clamp(640, 节点宽, 720)。
     默认 640；节点更宽时面板跟节点同宽（最多 720）；不再出现 420/520 那种窄面板。 */
  const MIN_COMPOSER_WIDTH = 640;
  const MAX_COMPOSER_WIDTH = 720;
  width = Math.round(Math.min(MAX_COMPOSER_WIDTH, Math.max(MIN_COMPOSER_WIDTH, nodeWidth)));
  const nodeHeight = Math.max(1, finite(node.h, 0));
  return {
    visible: true,
    position: {
      left: Math.round(finite(node.x) + (nodeWidth - width) / 2),
      top: Math.round(finite(node.y) + nodeHeight + gap),
      width: Math.round(width),
    },
  };
}

/* 9-15 用户决定（复核 9-13）：**生成前无加号、生成结果必须有加号**。
   四个生成框里只有「结果真的落入框内」的框才挂左右加号：
   image-composer / video-composer / layer-group / video 在持有 url 且状态非失败时，
   左右渲染输入锚点 + 输出加号；text-composer / suite-composer 的框永远是控制台
   （结果以独立节点出现），框本体不挂加号。 */
const GENERATION_BOX_RESULT_KINDS = new Set(['image-composer', 'video-composer', 'layer-group', 'video']);
const GENERATION_BOX_NO_RESULT_STATUS = new Set(['', 'error', 'upload-error', 'processing', 'generating', 'draft', 'empty']);

export function canvasGenerationBoxHasResult(node = {}) {
  if (!node || typeof node !== 'object') return false;
  if (!GENERATION_BOX_RESULT_KINDS.has(node.kind)) return false;
  if (GENERATION_BOX_NO_RESULT_STATUS.has(String(node.status || ''))) return false;
  return Boolean(node.url);
}

/* ═══ 生成结果自动排版 · 产品决定（2026-09-17 用户确认口径）═══════════════
   复用电商套图已确立的「以生成框为锚、紧贴框右侧排布 + 派生连线」约定
   （见 handleSuiteComposerGenerate 的 230 宽 / 右排 / 'suite-output' 连线），不另立一套规则。

   用户原话要点：「生成后按张数排版（横排/竖排由我们定）」——以下是**我们定下的**口径，
   实现已按此收敛，改这里等于改产品行为，请先确认：

     · 图片生成结果：**横向一排**（同一 y）；间距 = 节点宽 + 24px；**超过 4 张换行**；
     · 视频生成结果：**横向一排**（同图片，同一套参数）；
     · 文案生成结果：**纵向一列**（文案是长条，竖排更可读）；
     · 电商套图结果：**按类别各自成排** —— 白底图 / 主图 / 详情图 / SKU / 素材
       各占一排（横向、超过 4 张换行），沿用既有的 roleRows 行距 390
       （见 index.jsx handleSuiteComposerGenerate 的 roleRows + rowCounters）；
     · 所有结果生成后**默认全部多选**（见各生成 handler 末尾的 setMultiSelected）；
     · 结果节点**左右都有加号**（可继续派生 / 可继续接入）。

   第一张结果 = 生成框本身（沿用生成前框的位置），其余结果从框右侧开始排。 */
const CANVAS_RESULT_ROW_GAP = 24;      // 结果间距 = 节点宽 + 24px
const CANVAS_RESULT_PER_ROW = 4;       // 超过 4 张换行
const CANVAS_RESULT_LEAD = 56;         // 框右缘到第一张结果的起始间距（含左加号锚区）

export function layoutCanvasGeneratedResults({
  anchor = {},
  items = [],
  mode = 'row',
  gap = CANVAS_RESULT_ROW_GAP,
  perRow = CANVAS_RESULT_PER_ROW,
  lead = CANVAS_RESULT_LEAD,
} = {}) {
  const anchorX = Number.isFinite(Number(anchor.x)) ? Number(anchor.x) : 0;
  const anchorY = Number.isFinite(Number(anchor.y)) ? Number(anchor.y) : 0;
  const anchorW = Math.max(1, Number(anchor.w) || 240);
  const list = Array.isArray(items) ? items : [];
  return list.map((item, index) => {
    const width = Math.max(1, Number(item.w) || 230);
    const height = Math.max(1, Number(item.h) || width);
    const x0 = anchorX + anchorW + lead;
    if (mode === 'column') {
      return {
        ...item,
        x: Math.round(x0),
        y: Math.round(anchorY + index * (height + gap)),
      };
    }
    const rowIndex = Math.floor(index / perRow);
    const columnIndex = index % perRow;
    return {
      ...item,
      x: Math.round(x0 + columnIndex * (width + gap)),
      y: Math.round(anchorY + rowIndex * (height + gap)),
    };
  });
}

export function resizeCanvasNode(node = {}, { width } = {}) {
  const currentWidth = Math.max(1, finite(node.w, MIN_NODE_WIDTH));
  const currentHeight = Math.max(1, finite(node.h, currentWidth));
  const aspect = ratioValue(node.ratio, currentWidth / currentHeight);
  const nextWidth = Math.round(Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, finite(width, currentWidth))));
  return {
    ...node,
    w: nextWidth,
    h: Math.round(nextWidth / Math.max(0.01, aspect)),
  };
}

function gridSize(value, fallback = 3) {
  // 行列拆分后允许 1~8 独立档位（1 表示该轴不切分）。
  return Math.min(8, Math.max(1, Math.round(finite(value, fallback))));
}

export function getGridGuidePositions(grid = 3, positions) {
  const count = gridSize(grid) - 1;
  if (Array.isArray(positions) && positions.length === count && positions.every(value => Number.isFinite(Number(value)))) {
    return positions.map(value => Math.min(1, Math.max(0, Number(value))));
  }
  return Array.from({ length: count }, (_, index) => (index + 1) / (count + 1));
}

export function moveGridGuide(positions = [], index, value, minGap = 0.08) {
  if (!Array.isArray(positions) || index < 0 || index >= positions.length) return Array.isArray(positions) ? [...positions] : [];
  const next = positions.map(item => Math.min(1, Math.max(0, finite(item))));
  const gap = Math.min(0.25, Math.max(0.02, finite(minGap, 0.08)));
  const lower = index === 0 ? gap : next[index - 1] + gap;
  const upper = index === next.length - 1 ? 1 - gap : next[index + 1] - gap;
  next[index] = Math.min(upper, Math.max(lower, finite(value, next[index])));
  return next;
}

export function resizeCanvasNodeByHandle(node = {}, {
  handle = 'se',
  dx = 0,
  dy = 0,
  preserveAspect = false,
  minWidth = MIN_NODE_WIDTH,
  minHeight = MIN_NODE_HEIGHT,
} = {}) {
  const original = {
    x: finite(node.x),
    y: finite(node.y),
    w: Math.max(1, finite(node.w, MIN_NODE_WIDTH)),
    h: Math.max(1, finite(node.h, MIN_NODE_HEIGHT)),
  };
  const horizontal = String(handle).includes('e') || String(handle).includes('w');
  const vertical = String(handle).includes('n') || String(handle).includes('s');
  const minW = Math.max(48, finite(minWidth, MIN_NODE_WIDTH));
  const minH = Math.max(32, finite(minHeight, MIN_NODE_HEIGHT));
  let left = original.x;
  let right = original.x + original.w;
  let top = original.y;
  let bottom = original.y + original.h;
  const moveX = finite(dx);
  const moveY = finite(dy);

  if (!preserveAspect) {
    if (String(handle).includes('w')) left = Math.min(right - minW, left + moveX);
    if (String(handle).includes('e')) right = Math.max(left + minW, right + moveX);
    if (String(handle).includes('n')) top = Math.min(bottom - minH, top + moveY);
    if (String(handle).includes('s')) bottom = Math.max(top + minH, bottom + moveY);
    return {
      ...node,
      x: Math.round(left),
      y: Math.round(top),
      w: Math.round(Math.min(MAX_NODE_WIDTH, Math.max(minW, right - left))),
      h: Math.round(Math.min(MAX_NODE_HEIGHT, Math.max(minH, bottom - top))),
    };
  }

  const aspect = Math.max(0.05, ratioValue(node.ratio, original.w / original.h));
  let nextW = original.w;
  let nextH = original.h;
  const widthCandidate = String(handle).includes('w')
    ? original.w - moveX
    : String(handle).includes('e') ? original.w + moveX : original.w;
  const heightCandidate = String(handle).includes('n')
    ? original.h - moveY
    : String(handle).includes('s') ? original.h + moveY : original.h;
  if (horizontal && vertical) {
    const widthTravel = Math.abs(widthCandidate - original.w) / Math.max(1, original.w);
    const heightTravel = Math.abs(heightCandidate - original.h) / Math.max(1, original.h);
    if (widthTravel >= heightTravel) {
      nextW = widthCandidate;
      nextH = nextW / aspect;
    } else {
      nextH = heightCandidate;
      nextW = nextH * aspect;
    }
  } else if (horizontal) {
    nextW = widthCandidate;
    nextH = nextW / aspect;
  } else if (vertical) {
    nextH = heightCandidate;
    nextW = nextH * aspect;
  }
  nextW = Math.min(MAX_NODE_WIDTH, Math.max(minW, nextW));
  nextH = Math.min(MAX_NODE_HEIGHT, Math.max(minH, nextH));
  if (String(handle).includes('w')) left = right - nextW;
  else if (String(handle).includes('e')) right = left + nextW;
  else {
    left = original.x;
    right = left + nextW;
  }
  if (String(handle).includes('n')) top = bottom - nextH;
  else if (String(handle).includes('s')) bottom = top + nextH;
  else {
    top = original.y;
    bottom = top + nextH;
  }
  return {
    ...node,
    x: Math.round(left),
    y: Math.round(top),
    w: Math.round(right - left),
    h: Math.round(bottom - top),
  };
}

export function applyCanvasMoveScale(node = {}, { scale = 1, offsetX = 0, offsetY = 0, rotation = 0 } = {}) {
  const currentWidth = Math.max(1, finite(node.w, MIN_NODE_WIDTH));
  const next = resizeCanvasNode(node, { width: currentWidth * Math.min(2.5, Math.max(0.1, finite(scale, 1))) });
  const nextRotation = Math.min(180, Math.max(-180, finite(node.rotation) + finite(rotation)));
  return {
    ...next,
    x: finite(node.x) + finite(offsetX),
    y: finite(node.y) + finite(offsetY),
    ...(nextRotation || Object.hasOwn(node, 'rotation') ? { rotation: nextRotation } : {}),
  };
}

export function createCanvasTextNode({ x = 0, y = 0, sourceNodeId = '', now = Date.now() } = {}) {
  return {
    id: `text_${now}`,
    kind: 'text',
    x: finite(x),
    y: finite(y),
    w: 420,
    h: 84,
    text: '',
    placeholder: '输入文字',
    sourceNodeIds: sourceNodeId ? [sourceNodeId] : [],
    status: 'ready',
    textStyle: {
      block: 'body',
      color: '#20242a',
      fontSize: 48,
      fontStyle: 'normal',
      fontWeight: 700,
      list: 'none',
      textAlign: 'left',
    },
  };
}

export function createCanvasImageComposerNode({ x = 0, y = 0, sourceNodeId = '', now = Date.now() } = {}) {
  return {
    id: `image_composer_${now}`,
    kind: 'image-composer',
    status: 'ready',
    x: finite(x),
    y: finite(y),
    w: 280,
    h: 280,
    prompt: '',
    ratio: ADAPTIVE_RATIO,
    resolution: '2K',
    imageModel: DEFAULT_IMAGE_MODEL,
    count: 1,
    sourceNodeIds: sourceNodeId ? [sourceNodeId] : [],
  };
}

export function createCanvasTextComposerNode({ x = 0, y = 0, sourceNodeId = '', now = Date.now() } = {}) {
  return {
    id: `text_composer_${now}`,
    kind: 'text-composer',
    status: 'ready',
    x: finite(x),
    y: finite(y),
    w: 340,
    h: 170,
    text: '',
    placeholder: '双击开始编辑...',
    prompt: '',
    ratio: ADAPTIVE_RATIO,
    resolution: '2K',
    imageModel: DEFAULT_IMAGE_MODEL,
    count: 1,
    sourceNodeIds: sourceNodeId ? [sourceNodeId] : [],
    textStyle: {
      block: 'body',
      color: '#20242a',
      fontSize: 18,
      fontStyle: 'normal',
      fontWeight: 400,
      list: 'none',
      textAlign: 'left',
    },
  };
}

/* 2026-09-17 用户确认口径（产品决定）：
   「画布里**商品套图**才有设计方案流程……方案未确认时什么都不发生
    （不生成、不扣费、不替他决定），方案作为待确认资产自动落盘可续。」

   因此套图节点的方案确认状态是**显式字段**，不是靠"有没有方案"推断：
     planConfirmed: false  → 方案待确认（可编辑 / 可重新生成方案；**生成按钮禁用**）
     planConfirmed: true   → 方案已确认（唯一事实源，之后生成只依据方案）

   为什么不能沿用「有 suitePlan 就能生成」：那等于**存在即确认** ——
   用户只点了一次「生成设计方案」，还没看、没改、没点头，第二次点击就已经扣费出图，
   与「不替他决定 / 未确认什么都不发生」直接冲突。
   字段随节点进画布快照 → 走既有画布保存链路自动落盘，用户离开再回来方案还在。 */
export function createCanvasSuiteComposerNode({ x = 0, y = 0, sourceNodeId = '', platform = 'taobao', commerceContext, now = Date.now() } = {}) {
  const normalizedCommerceContext = normalizeCommerceContext({ platform, ...(commerceContext || {}) });
  return {
    id: `suite_composer_${now}`,
    kind: 'suite-composer',
    status: 'ready',
    x: finite(x),
    y: finite(y),
    w: 640,
    h: 420,
    prompt: '',
    platform,
    commerceContext: normalizedCommerceContext,
    /* 方案确认状态（见上方注释）：新建节点一律「待确认」 */
    planConfirmed: false,
    /* 被替换掉的历史方案（重新生成方案时保留旧方案，供对比，不删除） */
    previousSuitePlans: [],
    suiteType: '完整套图',
    ratio: ADAPTIVE_RATIO,
    resolution: '2K',
    imageModel: DEFAULT_IMAGE_MODEL,
    language: '中文',
    count: 6,
    skuMode: '默认SKU',
    styleSkill: 'smart',
    productInfoMode: 'auto',
    copywritingMode: 'smart',
    sourceNodeIds: sourceNodeId ? [sourceNodeId] : [],
    configuration: {
      platform: normalizedCommerceContext.platform,
      commerceContext: normalizedCommerceContext,
      sizing: { smart: true, images: [] },
      styleSkill: 'smart',
      customColors: null,
      productParams: { category: '', size: '', baseColor: '', accentColor: '', material: '', craft: '' },
      skus: [],
      copywriting: { plan: '', sellingPoints: '', qc: '', details: '', maintenance: '' },
      genSettings: { imageModel: DEFAULT_IMAGE_MODEL, resolution: '2K', negativePrompt: '' },
    },
  };
}

export function createCanvasVideoComposerNode({ x = 0, y = 0, sourceNodeId = '', now = Date.now() } = {}) {
  return {
    id: `video_composer_${now}`,
    kind: 'video-composer',
    status: 'ready',
    x: finite(x),
    y: finite(y),
    w: 360,
    h: 240,
    prompt: '',
    mode: 'smart',
    modelProductId: 'seedance_standard',
    resolution: '720p',
    aspectRatio: '9:16',
    duration: 8,
    generateAudio: true,
    planReviewed: false,
    sourceNodeIds: sourceNodeId ? [sourceNodeId] : [],
  };
}

function unit(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
}

export function normalizeCanvasSelection(selection) {
  if (!selection || typeof selection !== 'object') return { mode: 'whole' };
  const mode = selection.mode === 'subject' ? 'subject' : selection.mode === 'rectangle' ? 'rectangle' : 'whole';
  if (mode !== 'rectangle') return { mode };
  const rect = selection.rect || {};
  const x = unit(rect.x);
  const y = unit(rect.y);
  return {
    mode,
    rect: {
      x,
      y,
      w: Math.min(1 - x, Math.max(0, Number.isFinite(Number(rect.w)) ? Number(rect.w) : 0)),
      h: Math.min(1 - y, Math.max(0, Number.isFinite(Number(rect.h)) ? Number(rect.h) : 0)),
    },
  };
}

function closestRatio(width, height) {
  const value = Math.max(1, finite(width, 1)) / Math.max(1, finite(height, 1));
  const ratios = [
    ['1:1', 1],
    ['3:4', 3 / 4],
    ['4:3', 4 / 3],
    ['9:16', 9 / 16],
    ['16:9', 16 / 9],
  ];
  return ratios.reduce((best, current) => Math.abs(current[1] - value) < Math.abs(best[1] - value) ? current : best)[0];
}

/**
 * 生成节点里上传素材的落点排布（2026-09-12 用户批注）。
 * 规则：
 *  1. 固定落在生成器**左侧一列**（不再按数量往左横推）；
 *  2. 从**已有来源的下方**开始往下排；
 *  3. **任何情况下不得与已有节点或彼此重叠** —— 逐个向下找第一个不重叠的空位（矩形相交检测 + 安全间距）。
 * 返回与 entries 等长的 { x, y } 数组。
 */
export function resolveSourceStackPlacement({
  anchor = { x: 0, y: 0 },
  existingSourceNodes = [],
  existingNodes = [],
  entries = [],
  columnWidth = 240,
  gapX = 56,
  gapY = 28,
  margin = 16,
} = {}) {
  const x = Math.round(Number(anchor.x || 0) - columnWidth - gapX);
  const blockers = [...existingNodes, ...existingSourceNodes].filter(node => node && Number.isFinite(Number(node.x)) && Number.isFinite(Number(node.y)));
  const sourceBottom = existingSourceNodes.length
    ? Math.max(...existingSourceNodes.map(node => Number(node.y || 0) + Number(node.h || 0))) + gapY
    : Number(anchor.y || 0);
  const overlaps = (rect, node) => {
    const nx = Number(node.x || 0); const ny = Number(node.y || 0);
    const nw = Number(node.w || 240); const nh = Number(node.h || 240);
    return rect.x < nx + nw + margin && rect.x + rect.w + margin > nx
      && rect.y < ny + nh + margin && rect.y + rect.h + margin > ny;
  };
  const placed = [];
  let cursorY = sourceBottom;
  for (const entry of entries) {
    const w = Number(entry?.w || columnWidth);
    const h = Number(entry?.h || columnWidth);
    let y = cursorY;
    /* 向下找第一个与任何已有节点/已放节点都不相交的位置（设上限，避免极端情况下死循环） */
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const rect = { x, y, w, h };
      const hit = [...blockers, ...placed].find(node => overlaps(rect, node));
      if (!hit) break;
      y = Number(hit.y || 0) + Number(hit.h || h) + gapY;
    }
    placed.push({ x, y, w, h });
    cursorY = y + h + gapY;
  }
  return placed.map(item => ({ x: item.x, y: item.y }));
}
export function createUploadedImageNodes({ assets = [], x = 80, y = 100, now = Date.now(), namer = null } = {}) {
  const width = 240;
  const gap = 38;
  return assets.filter(asset => asset?.url || asset?.stableUrl).map((asset, index) => {
    /* 批 CY-⑭：以前这里是 `asset.ratio || closestRatio(asset.width, asset.height)` ——
       `closestRatio` 只有 5 个预设，于是**一张 3:2 的照片被贴上 `'4:3'` 的标签**，
       框按 4:3 画、图按 contain 塞进去 ⇒ 上下（或左右）出现白边。
       现在有真尺寸就用真比例（`mediaRatioFor`），只有真的量不到才落到那 5 档兜底。 */
    const ratio = mediaRatioFor({ ratio: asset.ratio, width: asset.width, height: asset.height });
    /* P-B 电影分镜命名: 优先用 namer.next('image') (Enclosure-001), 用户上传时资产自带 name 优先 */
    const fallbackName = namer ? namer.next('image') : `Enclosure-${String(index + 1).padStart(3, '0')}`;
    const nodeName = asset.name || fallbackName;
    return attachCanvasProjectAssetRef({
      id: `upload_${now}_${index}`,
      assetId: asset.assetId || `upload-asset-${now}-${index}`,
      kind: 'image',
      provenance: 'source',
      status: 'ready',
      url: asset.url || asset.stableUrl,
      name: nodeName,
      displayLabel: nodeName,
      group: '',
      role: '',
      ratio,
      size: asset.width && asset.height ? `${asset.width}×${asset.height}` : '',
      sourceNodeIds: [],
      editable: true,
      showMeta: false,
      x: finite(x) + index * (width + gap),
      y: finite(y),
      w: width,
      h: Math.round(width / ratioValue(ratio, 1)),
      rotation: 0,
      flipX: false,
      flipY: false,
      locked: false,
      hidden: false,
    }, asset);
  });
}

export function createUploadedVideoNodes({ assets = [], x = 80, y = 100, now = Date.now(), namer = null } = {}) {
  const width = 320;
  const gap = 42;
  return assets.filter(asset => asset?.url || asset?.stableUrl).map((asset, index) => {
    /* P-B 电影分镜命名: video -> Breakthrough-001 */
    const fallbackName = namer ? namer.next('video') : `Breakthrough-${String(index + 1).padStart(3, '0')}`;
    const nodeName = asset.name || fallbackName;
    /* 批 CY-⑭：视频同样要按**真实**宽高比画框。视频以前**根本没人量过** `videoWidth/videoHeight`
       （`aspectRatio` 拿不到就写死 16:9），所以一条 9:16 的片子会躺在 16:9 的框里左右加黑边。
       上传时就用能拿到的尺寸；拿不到的部分交给 `<video onLoadedMetadata>` 事后校正
       （见 index.jsx 的 handleMediaNaturalSize）。 */
    const aspectRatio = mediaRatioFor({ ratio: asset.aspectRatio, width: asset.width, height: asset.height });
    return attachCanvasProjectAssetRef({
      id: `video_upload_${now}_${index}`,
      assetId: asset.id || asset.assetId || `video-asset-${now}-${index}`,
      videoAssetId: asset.id || asset.videoAssetId || '',
      kind: 'video',
      provenance: 'source',
      status: 'ready',
      url: asset.url || asset.stableUrl,
      name: nodeName,
      displayLabel: nodeName,
      group: '视频',
      role: '参考视频',
      aspectRatio,
      duration: Number(asset.duration) || 0,
      resolution: asset.resolution || '',
      sourceNodeIds: [],
      editable: true,
      showMeta: true,
      x: finite(x) + index * (width + gap),
      y: finite(y),
      w: width,
      h: Math.round(width / ratioValue(aspectRatio, 16 / 9)),
      rotation: 0,
      locked: false,
      hidden: false,
    }, asset);
  });
}
