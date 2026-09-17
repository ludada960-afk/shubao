/* ═══ Skill 运行模型：把「工作台上的字段」翻译成「引擎认识的参数」══════════════════
   这一层是工作台能不能真的出图的关键，也是唯一允许做这个翻译的地方
   （页面里不许再拼请求、不许再判断字段）。

   服务端契约（2026-09-17 调研，见 RTK 批次二十三）：
     · 单图链路 = POST /api/canvas/regenerate（经 services/api.js 的 regenerateCanvasImage）
       - prompt 必填；image_url 有值即图生图、无值即文生图（同一个路由）
       - reference_images ≤ 9；reference_metadata ≤ 9
       - ratio ∈ 1:1 | 3:4 | 4:3 | 9:16 | 16:9 | 21:9（非法值静默回落 1:1）
       - resolution ∈ 1K | 2K | 4K（非法值静默降级 2K）
       - creation_intent='visual' + skill_id ∈ free | poster | social-cover | brand-kv
         （服务端白名单只有这四个；非法值静默回落 free —— 所以我们**只映射到这四个**）
       - 计费：先报价再带 billing_quote_id（在 regenerateCanvasImage 内部完成）
       - 断线自愈：网络异常或 409/502/503/504/524 会自动转 status 轮询，不重复扣费
     · 模型：**只传 image2**。它是唯一有真实出图记录的档位（RTK 多次验收任务号）；
       9-13 新增的五档在目录里可选但零真实出图记录，写进来就会重演 9-16「假模型」事故。
       模型该由路由层按 capability 注入（43 §5.3），在台账补齐之前这里只认 image2。

   ⚠️ 本文件是纯函数：不碰 DOM、不发请求，便于门禁直接断言。 */

import { generationUnits } from '../services/imageModelCatalog.js';
/* 套图方案（张数 / 各图比例 / 报价请求）**只有这一份实现**：面板、画布、首页都用它。
   我们要就地跑套图，就必须用同一份 —— 自己另算一套张数会和服务端的方案对不上，
   而服务端在建 hold 之前会校验报价（数量对不上直接报错），对不上就是白跑一趟。 */
import { resolveEcommercePlan } from '../pages/Home/ec/ecommercePlanModel.js';

/* 服务端唯一认得的四个视觉方向（server/visualCreationSkills.mjs:1） */
export const SERVER_VISUAL_SKILL_IDS = Object.freeze(['free', 'poster', 'social-cover', 'brand-kv']);

/* 唯一有真实出图记录的图片模型。换掉它之前，先拿出新的出图证据。 */
export const DEFAULT_IMAGE_MODEL = 'image2';
export const DEFAULT_RESOLUTION = '2K';

/* 字段 key → 服务端 ratio 的合法值（服务端不认的写法在这里就拦住，不让它静默回落） */
const LEGAL_RATIOS = new Set(['1:1', '3:4', '4:3', '9:16', '16:9', '21:9']);
const LEGAL_RESOLUTIONS = new Set(['1K', '2K', '4K']);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/* 上传字段的值形状由 FieldRenderer 定义：只有 ready 且带 url 的条目才算数 */
export function readyUploads(value) {
  return (Array.isArray(value) ? value : []).filter(item => item && item.status === 'ready' && text(item.url));
}

/* ── ⓪ 初始值：声明里的默认值在这里落地 ──
   ⚠️ 唯一事实源。工作台的显示值、必填校验、下发参数全部基于它 ——
      三处各算一次的结果就是「按钮写着 2K、跑的是 1K」这类最难查的 bug。 */
export function initialSkillValues(skill) {
  const seed = {};
  for (const field of (skill && skill.fields) || []) {
    if (field.kind === 'stepper') { seed[field.key] = Number(field.min || 1); continue; }
    if (field.kind === 'segmented' || field.kind === 'select') {
      seed[field.key] = field.default ?? (field.options?.[0]?.value ?? '');
      continue;
    }
    /* ═══ counts（按类型配张数，套图「自定义配置」那一组）═══════════════════════════
       ⚠️ 2026-09-19 批 G：这里原来没有 counts 分支 —— 于是它被当成字符串初始化成 ''，
          步进器从 0 起步、合计 0 张，用户点开「自定义配置」看到的是一排 0。 */
    if (field.kind === 'counts') {
      seed[field.key] = Object.fromEntries(
        (Array.isArray(field.rows) ? field.rows : []).map(row => [row.key, Math.max(0, Number(row.default) || 0)]),
      );
      continue;
    }
    seed[field.key] = field.kind === 'upload' ? [] : '';
  }
  return seed;
}

/* 字段当前**可不可见**（visibleWhen 的唯一定义处）。
   校验、取值、渲染三处都问这一份，避免「界面上没显示但被算进必填」或反过来。 */
export function skillFieldVisible(field, values = {}) {
  const rule = field && field.visibleWhen;
  if (!rule || !rule.key) return true;
  return values[rule.key] === rule.equals;
}

/* counts 的合计（声明里的 minTotal 是**下限**，与界面末尾那行「当前共 N 张」同源） */
export function skillCountsTotal(field, values = {}) {
  const value = values[field && field.key];
  const rows = Array.isArray(field && field.rows) ? field.rows : [];
  return rows.reduce((sum, row) => sum + Math.max(0, Number(value && value[row.key]) || 0), 0);
}

/* ── ① 必填校验：给工作台做「就近错误」，不是提交后才报错 ──
   校验对象是**生效值**（默认值 + 用户填的），否则带默认值的字段会被误判成没填。 */
export function validateSkillInput(skill, values = {}) {
  const effective = { ...initialSkillValues(skill), ...(values || {}) };
  values = effective;
  const missing = [];
  for (const field of (skill && skill.fields) || []) {
    /* 隐藏的字段不参与校验：套图的「各类型张数」只在选了「自定义配置」时才存在，
       拿它去拦「智能匹配」那条路是错的（用户根本没看见这一项）。 */
    if (!skillFieldVisible(field, values)) continue;
    if (!field.required) continue;
    if (field.kind === 'upload') {
      if (!readyUploads(values[field.key]).length) missing.push(field.label);
      continue;
    }
    if (field.kind === 'stepper') continue;   /* stepper 永远有值 */
    /* ⚠️ 2026-09-19 批 G：counts 的"填了没有"不是看字符串，而是看**合计张数** ——
       它决定这次出几张、报多少价，合计为 0 等于"零张订单"，必须拦住。 */
    if (field.kind === 'counts') {
      const min = Math.max(1, Number(field.minTotal) || 1);
      if (skillCountsTotal(field, values) < min) missing.push(field.label + '（至少 ' + min + ' 张）');
      continue;
    }
    if (!text(values[field.key])) missing.push(field.label);
  }
  return { ok: missing.length === 0, missing };
}

/* ── ② 文案组装：把用户填的字段填进该 skill 自己的 brief 模板 ──
   brief 写在声明里（{{key}} 占位），所以新增 skill 仍然只需要加声明。 */
export function buildSkillBrief(skill, values = {}) {
  const template = text(skill && skill.brief);
  const filled = template.replace(/\{\{(\w+)\}\}/g, (_match, key) => text(values[key]));
  /* 未填的可选项会留下空档，压掉多余空白与空标点，避免把「主题：」这种半截话喂给模型 */
  return filled
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*[，。；：]\s*(?=[，。；：])/g, '')
    .replace(/\s+([，。；：])/g, '$1')
    .replace(/^[\s，。；：]+|[\s，。；：]+$/g, '')
    .trim();
}

/* ── ③ 图片：第一个上传位当主图（image_url），其余当参考图（reference_images）──
   服务端上限 9 张参考图；超出直接截断（服务端也会截，但我们在前端就截，免得用户以为多传了有用）。 */
export const MAX_REFERENCE_IMAGES = 9;

export function skillImages(skill, values = {}) {
  const slots = ((skill && skill.fields) || []).filter(field => field.kind === 'upload');
  const primary = slots[0] ? readyUploads(values[slots[0].key]) : [];
  /* fail-closed：主图没就绪就一张图都不给。
     半截素材只会生成出"看着像成功了、其实不是我要的"结果 —— 那是最难查的一类 bug。 */
  if (slots.length && slots[0].required && !primary.length) return { imageUrl: '', referenceImages: [], references: [] };
  const imageUrl = primary.length ? text(primary[0].url) : '';
  const referenceImages = [];
  const references = [];
  for (const field of slots.slice(1)) {
    for (const item of readyUploads(values[field.key])) {
      if (referenceImages.length >= MAX_REFERENCE_IMAGES) break;
      referenceImages.push(text(item.url));
      references.push({
        url: text(item.url),
        assetId: text(item.assetId),
        displayName: text(item.name),
        role: field.role || 'reference',
        order: referenceImages.length - 1,
      });
    }
  }
  /* 主图同时也是最有分量的参考图：把它放进 reference_metadata 让服务端知道来龙去脉 */
  if (imageUrl) {
    references.unshift({ url: imageUrl, assetId: text(primary[0].assetId), displayName: text(primary[0].name), role: slots[0].role || 'product', order: 0 });
  }
  return { imageUrl, referenceImages, references: references.slice(0, MAX_REFERENCE_IMAGES) };
}

/* ── ④ 生成参数：比例 / 清晰度 / 数量 / 模型 / 服务端视觉方向 ── */
export function skillGenerationSettings(skill, values = {}) {
  const ratio = text(values.ratio);
  const resolution = (text(values.clarity) || DEFAULT_RESOLUTION).toUpperCase();
  const count = Math.max(1, Math.min(9, Number.parseInt(values.count, 10) || 1));
  const visual = SERVER_VISUAL_SKILL_IDS.includes(skill && skill.visual) ? skill.visual : 'free';
  return {
    ratio: LEGAL_RATIOS.has(ratio) ? ratio : '1:1',
    resolution: LEGAL_RESOLUTIONS.has(resolution) ? resolution : DEFAULT_RESOLUTION,
    count,
    imageModel: DEFAULT_IMAGE_MODEL,
    visualSkillId: visual,
  };
}

/* ── ⑤ 积分预估：单位与后端 catalog 同源（1 积分 = 1000 units），只用于按钮上展示 ── */
export function skillPointsEstimate(skill, values = {}) {
  const { imageModel, resolution, count } = skillGenerationSettings(skill, values);
  const unitsPerImage = generationUnits(imageModel, resolution) || 0;
  return Number(((unitsPerImage * count) / 1000).toFixed(2));
}

/* ── ⑥ 组装成 regenerateCanvasImage 的入参（页面只调这一个函数）── */
export function buildSkillRequest(skill, values = {}, { runId = '', slotIndex = 0 } = {}) {
  const brief = buildSkillBrief(skill, values);
  const images = skillImages(skill, values);
  const settings = skillGenerationSettings(skill, values);
  return {
    prompt: brief,
    imageUrl: images.imageUrl,
    referenceImages: images.referenceImages,
    references: images.references,
    ratio: settings.ratio,
    resolution: settings.resolution,
    imageModel: settings.imageModel,
    creationIntent: 'visual',
    skillId: settings.visualSkillId,
    requestKey: runId ? runId + ':' + (slotIndex + 1) : '',
  };
}

/* ── ⑦ 运行方式（决定 CTA 点了以后发生什么）────────────────────────────────
   用户 9-17 口径：「生成结果直接在工作台里面展示，不必像之前一样生成完就一定要跳进去画布
   里面……如果是在子页面的工作台生成的，就会在各自的子页面历史记录里面。」
   所以**能就地跑完的都必须就地跑完**，一条都不许把人踢出这一页。
     · 'inline'  单图链路（visualCreation / builtinSkill）—— 就地出图
     · 'suite'   电商套图 —— 就地跑既有套图引擎（多张、多分钟），结果留在工作台与历史
     · 'embed'   小红书图文 / 视频 —— 把它们**自己的既有工作台整块搬进子页面**
                 （见 skillEmbedOf；不是重写一遍，是把已经跑通的组件嵌进来）
     · 'handoff' 目前**没有技能该走这一态**，保留它是为了「确实没有组件可嵌」的将来留出口：
                 真出现这种情况时，宁可老实说"去某某工作台继续"，也不要在这里做个半成品。
   ⚠️ 判据只有一条：**这一页能不能把这条链路跑完并交出结果**。
      跑得完 = inline/suite/embed（结果与历史都留在本页）；跑不完才允许 handoff。 */
export function skillRunKind(skill) {
  const pipeline = skill && skill.pipeline;
  if (pipeline === 'ecommerceSuite') return 'suite';
  if (skillEmbedOf(skill)) return 'embed';
  return 'inline';
}

/* 可整块嵌入子页面的既有工作台：
     · xhsNote          → 小红书图文工作台（pages/Home/XhsContentMode，首页同一份组件）
     · videoSmart 等视频 → 视频工作台（pages/VideoStudio，首页同一份组件，embedded 形态）
   返回组件键（'xhs' | 'video'），页面据此决定嵌哪一块；返回 '' 表示没有可嵌的组件。 */
export function skillEmbedOf(skill) {
  const pipeline = skill && skill.pipeline;
  if (pipeline === 'xhsNote') return 'xhs';
  if (typeof pipeline === 'string' && pipeline.startsWith('video')) return 'video';
  return '';
}

export function isHandoffSkill(skill) {
  return skillRunKind(skill) === 'handoff';
}

/* 视频技能的 pipeline → 视频工作台的创作方式（composer 的 mode 页签）。
   ⚠️ 页签只有三档（videoStudioModel.VIDEO_CREATION_MODES = smart / frame / remake），
      「全能参考」不是一个页签 —— resolveVideoApiMode 是**按素材算**的：
      smart 档一旦带了图片/视频/音频，API 模式自己就变成 reference。
      所以 videoReference 系的技能要落在 smart 档（素材一上传就走参考链路），
      映射成 'reference' 反而会选中一个不存在的页签。
   认不出来 → 空串，交给工作台用它自己的默认值（不硬塞一个错的模式）。 */
export const VIDEO_MODE_BY_PIPELINE = Object.freeze({
  videoSmart: 'smart',
  videoFrame: 'frame',
  videoRemake: 'remake',
  videoReference: 'smart',
});
export function skillVideoMode(skill) {
  return VIDEO_MODE_BY_PIPELINE[(skill && skill.pipeline) || ''] || '';
}

/* ── ⑧ 套图（suite）的就地运行参数 ──────────────────────────────────────────
   套图与单图是**两套引擎、两套计价**：
     · 单图：一次请求一张，按张计价（ec_image_2k = 1 积分/张）
     · 套图：一次任务一套 N 张，先按「方案张数」报价，服务端建 hold 之前会校验报价，
             数量对不上就干净报错、**不扣费**（fail-safe）
   所以这里必须用与面板同一份 resolveEcommercePlan 算出张数与报价请求。 */
export const SUITE_PLATFORMS = Object.freeze(['淘宝', '抖音', '小红书', '拼多多', '京东']);
export const SUITE_DEFAULT_PLATFORM = '淘宝';

/* 套图要的是"已拥有的资产引用"（assetId + /api/generated-assets/ 地址），
   服务端据此直接把素材挂进方案，不会再让我们把图片重传一遍。 */
export function suiteOwnedInputs(values = {}) {
  return readyUploads(values.assets)
    .filter(item => text(item.assetId) && /^\/api\/generated-assets\//i.test(text(item.url)))
    .map(item => ({ assetId: text(item.assetId), url: text(item.url), role: 'product' }))
    .slice(0, 6);
}

export function buildSuiteRun(skill, values = {}) {
  const platform = SUITE_PLATFORMS.includes(text(values.platform)) ? text(values.platform) : SUITE_DEFAULT_PLATFORM;
  const productInputs = suiteOwnedInputs(values);
  /* 商品名是服务端必填项：取「商品信息」的第一行，没有就给一个中性占位（不编造品牌） */
  const productName = (text(values.productParams).split(/\r?\n/).map(line => line.trim()).filter(Boolean)[0] || '').slice(0, 40) || '商品';
  /* ═══ 2026-09-19 批 G（用户批注 #10）：「自定义配置选中之后，里面还有其他的配置可以做呀」═══
     那一组按类型配的张数（structureCounts）此前**只是显示** —— 没有任何地方消费它：
     用户把白底图从 1 调到 4，出图张数与报价一个字都不变。那正是"装出来的功能"。
     现在接上：选了「自定义配置」就把这组张数当成套图的图集来源（sizing.images），
     于是**张数、报价、服务端方案**三者同源（都走 resolveEcommercePlan 这一份计算）。
     ⚠️ 只在「自定义配置」时生效：选「智能匹配」时这张表根本不显示（visibleWhen），
        拿一个用户看不见的值去报价是错的。
     ⚠️ 合计为 0 时**不接管**（回落到平台预设）—— 零张订单没有任何意义，
        而且校验层（validateSkillInput）本来就会把它拦在 CTA 之前。 */
  const customCounts = values.structure === '自定义配置' && values.structureCounts && typeof values.structureCounts === 'object'
    ? Object.entries(values.structureCounts)
        .map(([key, count]) => ({ key, count: Math.max(0, Number(count) || 0) }))
        .filter(item => item.count > 0)
    : [];
  const sizing = {
    resolution: DEFAULT_RESOLUTION,
    imageModel: DEFAULT_IMAGE_MODEL,
    ...(customCounts.length ? { images: customCounts } : {}),
  };
  const plan = resolveEcommercePlan({ platform, sizing, resolution: DEFAULT_RESOLUTION, imageModel: DEFAULT_IMAGE_MODEL });
  const unitsPerImage = generationUnits(DEFAULT_IMAGE_MODEL, DEFAULT_RESOLUTION) || 0;
  return {
    platform,
    productName,
    productInputs,
    /* sizing.images 是服务端认的**唯一图集来源**（generateEcommerce 会把同值镜像到 image_selections）——
       必须把算出来的 plan.images 原样带过去，服务端才会算出同一套方案 */
    sizing: { ...sizing, images: plan.images },
    plan,
    points: Number(((plan.quantity * unitsPerImage) / 1000).toFixed(2)),
  };
}
