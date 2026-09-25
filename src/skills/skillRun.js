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

import { generationUnits, imageModelResolutions, normalizeImageModel } from '../services/imageModelCatalog.js';
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
/* 批 O-⑦：加 2:3 / 3:2 —— 与服务端 modelCatalog.LEGAL_IMAGE_SIZES 的键**逐值一致**
   （必须同时加：界面能给的恰好是引擎认得的，多一档就是"选了被静默回落成 1:1"） */
/* 批 P：加 4:5 / 5:4（知渔「批量出图电商图」的 10 档比例里有这两档）—— 与引擎尺寸表同批。 */
const LEGAL_RATIOS = new Set(['1:1', '3:4', '4:3', '9:16', '16:9', '21:9', '2:3', '3:2', '4:5', '5:4', '9:21', '2:1', '1:2']);
const LEGAL_RESOLUTIONS = new Set(['1K', '2K', '4K']);

/* ═══ 2026-09-19 批 R：比例里的「自适应」——**唯一实现** ═════════════════════════════════════
   用户第 21 轮原话：「比例里的「自适应」我不知道是不是指原来各个 skill 自己的尺寸比例方案，
   各个 skill 他们自己有最适配的方案吗，有的话就可以作为自适应去做吧？」
   去知渔自己的文案里查了（不能靠猜）：他们「出图比例」那一格的 help 原文是
     「选择生成图片的宽高比例，「自适应」将根据模特图自动匹配最接近的比例」
   （证据：docs/design/data/quantv-image-workbenches.json 的 help 字段）
   ⇒ 不是"每个技能配一个固定比例"，而是**拿上传的那张主图的实际宽高，就近取我们支持的一档**。
   声明侧只写字面量 ADAPTIVE_RATIO（照知渔原文），取值在这里做：
   量宽高在控件层完成（上传就绪时读一次 naturalWidth/Height，写进条目的 width/height），
   本文件只做纯计算 —— 不碰 DOM，门禁可以直接断言。 */
export const ADAPTIVE_RATIO = '自适应';
/* 没有主图宽高时回落到 1:1（与 ratioField 的默认档口径一致：界面显示什么，就跑什么） */
export const FALLBACK_RATIO = '1:1';

/** 就近取一档合法比例：按**对数距离**比（2:3 与 3:2 到 1:1 的距离相同，
 *  线性比会把"扁"和"长"算得不对称）。相同距离取声明顺序靠前的那个。 */
export function nearestLegalRatio(width, height) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (!(w > 0) || !(h > 0)) return '';
  const target = Math.log(w / h);
  let best = '';
  let bestDistance = Infinity;
  for (const ratio of LEGAL_RATIOS) {
    const [a, b] = ratio.split(':').map(Number);
    if (!(a > 0) || !(b > 0)) continue;
    const distance = Math.abs(Math.log(a / b) - target);
    if (distance < bestDistance - 1e-9) { bestDistance = distance; best = ratio; }
  }
  return best;
}

/* 比例字段的默认档（声明里的 default，取不到就是 1:1）。 */
function defaultSkillRatio(skill) {
  const field = ((skill && skill.fields) || []).find(item => item.key === 'ratio');
  const declared = text(field && field.default);
  return LEGAL_RATIOS.has(declared) ? declared : FALLBACK_RATIO;
}

function text(value) {
  /* 多选字段的值是**数组**（知渔「选择视角（多选）」那一格，2026-09-19 批 P）——
     拼进提示词时按「、」连起来；其余类型行为一个字没变。 */
  if (Array.isArray(value)) return value.map(item => (typeof item === 'string' ? item.trim() : '')).filter(Boolean).join('、');
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
      /* 多选（multiple）：值是数组。默认给第一档选中 —— 与单选同一口径（"界面显示什么就跑什么"），
         用户再按需加选；不预选的话必填校验会直接把 CTA 卡住，那不是他们的样子。 */
      if (field.multiple) {
        seed[field.key] = Array.isArray(field.default) ? field.default.slice() : [field.options?.[0]?.value ?? ''].filter(Boolean);
        continue;
      }
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

/* ═══ 2026-09-25 批 BL：**用户提示词优先于 skill 内置文案**（用户拍板，不是我的判断）══════════
   用户原话：「我觉得不行，你还是要**优先用户的提示词先**，内置的 skill 用户**根本看不到**，
             所以还是要提示词优先。」
   ── 为什么要加这一句（批 BK 查清的事实）──────────────────────────────────────
   `buildSkillBrief` 是**纯字符串替换**：模板里那些固定句子与用户填的内容被拼成**同一段文字**，
   两者之间**没有裁决者**。所以当模板自带的话与用户的要求相反时
   （实测例子：`image.brand_kv` 的模板写着"品牌标识与产品细节必须原样保留"，
     而用户要求"画面内不出现任何品牌标识"），模型会同时收到两句矛盾的话、自己权衡 ——
   而**用户看不见模板**（全仓没有提示词预览），所以他是"盲撞"，被搅了也不知道。
   ── 修法与边界 ────────────────────────────────────────────────────────────
   · 修法：拼好之后**显式声明优先级**，把用户填写的内容标成最高。
     **不改模板、也不删任何句子** —— 模板是这条技能的手艺（商品保真 / 不要水印 / 文字准确
     这些是它的价值），不能因为调整优先级就把它削掉；而"悄悄改写用户看不见的文本"比不改更坏。
   · 依据：站内已有同一原则的明文 —— `src/pages/EcCanvas/canvasPromptAuthority.js` 第 3 层
     「**提示词优先于 skill；skill 只在 prompt 为空时预填**」。
   · ⚠️ 边界：本函数只处理"画什么"（内容意图）这一层。
     **用户自己在配置里的意图仍然更硬** —— 避免出现的元素 / 品牌主色 / 尺寸清晰度 / 平台合规
     属"硬约束层"，画布线的规矩是它"永远最高优先，且冲突时绝不静默"。二者不矛盾：
     那本来就是用户更早、更明确的意图。 */
export const USER_PRIORITY_CLAUSE =
  '【优先级】以上是这条技能的默认做法；用户填写的内容优先级更高 —— 两者冲突时，一律以用户填写的内容为准。';

/* ── ② 文案组装：把用户填的字段填进该 skill 自己的 brief 模板 ──
   brief 写在声明里（{{key}} 占位），所以新增 skill 仍然只需要加声明。 */
export function buildSkillBrief(skill, values = {}) {
  const template = text(skill && skill.brief);
  const filled = template.replace(/\{\{(\w+)\}\}/g, (_match, key) => text(values[key]));
  /* 未填的可选项会留下空档，压掉多余空白与空标点，避免把「主题：」这种半截话喂给模型 */
  const cleaned = filled
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*[，。；：]\s*(?=[，。；：])/g, '')
    .replace(/\s+([，。；：])/g, '$1')
    .replace(/^[\s，。；：]+|[\s，。；：]+$/g, '')
    .trim();
  /* 只有**用户真的往模板里填了内容**才加这句：
       ① 全空时加它是纯噪声（还白花 token）；
       ② 判据要按**模板里真实用到的占位符**取，不能看"有没有任意非空值" ——
          否则用户只选了比例/清晰度（那些不进提示词）也会被加上一句没有对象的优先级声明。 */
  if (!cleaned) return cleaned;
  const usedKeys = [...template.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]);
  if (!usedKeys.some(key => text(values[key]))) return cleaned;
  /* ⚠️ 拼接符不能用空格（批 BP 修）：模板末尾若是「细节补充」这类**没带标点的半截话**，
     空格会把优先级声明粘成「细节补充 【优先级】…」，读起来像同一句话的一部分。
     句末已有句号时不重复加，没有就补一个 —— 并且要在**清理之后**补，否则会被上面的
     标点压缩逻辑吃掉。 */
  return cleaned + (/[。！？…]$/.test(cleaned) ? '' : '。') + USER_PRIORITY_CLAUSE;
}

/* ── ③ 图片：第一个上传位当主图（image_url），其余当参考图（reference_images）──
   ⚠️ 2026-09-19 批 H：这里原来写 9，而服务端是 **8** ——
      server/index.mjs 的 /api/generate 明确「referenceImages.length > 8」直接 400。
      实测后果：用户传满 9 张参考图时，请求被服务端拒绝、生成失败，而前端的截断逻辑
      却以为自己已经处理好了。两边对齐到 8（服务端是唯一权威）。 */
export const MAX_REFERENCE_IMAGES = 8;

/* 条目的实际宽高：上传就绪时由控件量一次写进条目（FieldRenderer 的 measureBox）——
   批 R 的「自适应」比例要用它。没量到就返回 null（回落 1:1，不猜一个尺寸出来）。 */
function imageBox(item) {
  const width = Number(item && item.width) || 0;
  const height = Number(item && item.height) || 0;
  return width > 0 && height > 0 ? { width, height } : null;
}

/* 逐张跑：声明 skill.runsFollow = '<上传位 key>' 的技能，**一次运行只服务那一张参考图**
   （第 i 次运行只带第 i 张）。图片复刻就是这么回事 —— 见 skillRunsFollow 的注释。 */
export function skillRunsFollow(skill) {
  const key = text(skill && skill.runsFollow);
  if (!key) return '';
  return ((skill && skill.fields) || []).some(field => field.key === key && field.kind === 'upload') ? key : '';
}

export function skillImages(skill, values = {}, { slotIndex = 0 } = {}) {
  const slots = ((skill && skill.fields) || []).filter(field => field.kind === 'upload');
  const primary = slots[0] ? readyUploads(values[slots[0].key]) : [];
  /* fail-closed：主图没就绪就一张图都不给。
     半截素材只会生成出"看着像成功了、其实不是我要的"结果 —— 那是最难查的一类 bug。 */
  if (slots.length && slots[0].required && !primary.length) return { imageUrl: '', referenceImages: [], references: [], primaryBox: null };
  const imageUrl = primary.length ? text(primary[0].url) : '';
  const referenceImages = [];
  const references = [];
  /* 主图位里**除第一张以外**的也要当参考图发出去（2026-09-21 修）——
     知渔那一格的原文是「商品图会作为一组打包参考，最多 4 张」，我们却只发了第一张：
     用户传满 4 张时，计数写着 4/4、实际只用了 1 张，另外 3 张**静默丢掉**（最难查的那类 bug）。 */
  for (const item of primary.slice(1)) {
    if (referenceImages.length >= MAX_REFERENCE_IMAGES) break;
    referenceImages.push(text(item.url));
    references.push({
      url: text(item.url),
      assetId: text(item.assetId),
      displayName: text(item.name),
      role: slots[0].role || 'product',
      order: referenceImages.length - 1,
    });
  }
  const runsFollow = skillRunsFollow(skill);
  for (const field of slots.slice(1)) {
    let items = readyUploads(values[field.key]);
    /* 逐张跑的技能：这一次运行只带**第 slotIndex 张**（第 0 次带第 0 张…） */
    if (runsFollow === field.key && items.length) items = [items[slotIndex % items.length]];
    for (const item of items) {
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
  return { imageUrl, referenceImages, references: references.slice(0, MAX_REFERENCE_IMAGES), primaryBox: imageBox(primary[0]) };
}

/* ── ④ 生成参数：比例 / 清晰度 / 数量 / 模型 / 服务端视觉方向 ──
   ⚠️ 批 R：**模型**从声明里来（field.key = 'imageModel'，选项引用
      services/imageModelCatalog.js 那一份目录，见 imageSkills 的 modelField）。
      从前这里写死 DEFAULT_IMAGE_MODEL —— 界面给不给模型是界面的事，
      但"用户选的模型必须真的进入请求、并且真的参与计费"是这一层的责任：
      skillPointsEstimate 读的就是同一个 settings，改模型 → 报价跟着变，不会各说各话。 */
export function skillGenerationSettings(skill, values = {}) {
  /* 比例：显式档位按原值；'自适应' 按**主图实际宽高**就近取一档
     （知渔的 help 原文口径，见文件上方 nearestLegalRatio）；量不到主图就回落声明里的默认档。 */
  const askedRatio = text(values.ratio);
  const box = askedRatio === ADAPTIVE_RATIO ? (skillImages(skill, values).primaryBox || null) : null;
  const adaptiveRatio = box ? nearestLegalRatio(box.width, box.height) : '';
  const ratio = askedRatio === ADAPTIVE_RATIO
    ? (adaptiveRatio || defaultSkillRatio(skill))
    : (LEGAL_RATIOS.has(askedRatio) ? askedRatio : defaultSkillRatio(skill));
  const askedResolution = (text(values.clarity) || DEFAULT_RESOLUTION).toUpperCase();
  /* ⚠️ 2026-09-19 批 I-9：上限从 **9 → 16**。
     原因是「包含模块」那条链：A+ 内容有 16 个模块，勾满就是 16 张，
     而这里一直夹在 9 —— 结果是"用户勾了 16 个，只出 9 张、也只收 9 张的钱"，
     一个**静默的错**（不报错、不提示，用户只会觉得少给了）。
     16 是当前声明源里模块数的上限（imageSkills 的 A+ 那 16 条），
     其它技能靠 countField(n) 自己声明上限（都 ≤ 9），所以抬这条不会放宽它们。 */
  /* ═══ 2026-09-21（用户第 22 轮）：逐张跑的技能，张数 = **上传了几张就出几张** ═══════════════
     用户原话（逐字）：「他这里的案例指的是上面 3 张原图分别对应下面 3 张的复刻结果啊，
       用户上传一张肯定就复刻一张，上传两张就复刻两张，上传 3 张就复刻 3 张不是吗？」
     知渔自己的示例区原文也是这么写的：「上传风格参考图与商品图包，AI **按参考图数量**批量输出
       风格高度一致的商品主图」（2026-09-21 CDP 实采，见 docs/design/data/quantv-image-builtin-pages.json）。
     ⇒ 声明 skill.runsFollow = '参考图那一格' 的技能：count = 那一格已就绪的张数（没有就 1 张）。
        ⚠️ 我们上一批按"固定 6 张"理解是**错的**（6 只是他们示例区 3 原图 + 3 复刻图的配对示意）。 */
  const runsFollow = skillRunsFollow(skill);
  const followed = runsFollow ? readyUploads(values[runsFollow]).length : 0;
  const count = runsFollow
    ? Math.max(1, followed)
    : Math.max(1, Math.min(16, Number.parseInt(values.count, 10) || 1));
  const visual = SERVER_VISUAL_SKILL_IDS.includes(skill && skill.visual) ? skill.visual : 'free';
  /* 模型：不认识的取值回落到有出图记录的 image2（normalizeImageModel 自带兜底） */
  const imageModel = normalizeImageModel(values.imageModel, DEFAULT_IMAGE_MODEL);
  /* 清晰度不能超出这个模型的档位（例：Midjourney 上游只有 1K/2K）。
     允许的档位来自**模型目录**（imageModelCatalog.imageModelResolutions），不另立一份。 */
  const allowedResolutions = imageModelResolutions(imageModel).filter(item => LEGAL_RESOLUTIONS.has(item));
  const resolution = allowedResolutions.includes(askedResolution)
    ? askedResolution
    : (allowedResolutions.includes(DEFAULT_RESOLUTION) ? DEFAULT_RESOLUTION : allowedResolutions[0]);
  return {
    ratio: LEGAL_RATIOS.has(ratio) ? ratio : FALLBACK_RATIO,
    resolution: resolution || DEFAULT_RESOLUTION,
    count,
    imageModel,
    visualSkillId: visual,
  };
}

/* ═══ 批 R：字段之间的联动夹取（声明源写 field.optionsFrom）════════════════════════════════
   真事：模型选了 Midjourney（上游只有 1K/2K）而清晰度停在 4K —— 界面显示 4K、
   请求按 2K 跑、也按 2K 计费。那正是"看着是 A、跑的是 B"。
   所以换模型的同一刻，把依赖它的字段夹回合法档（唯一判据 = 声明里的 optionsFrom.map）。 */
export function reconcileFieldValues(fields, values = {}) {
  const next = { ...values };
  for (const field of Array.isArray(fields) ? fields : []) {
    const rule = field && field.optionsFrom;
    if (!rule || !rule.key || !rule.map) continue;
    const allowed = rule.map[String(next[rule.key] ?? '')];
    if (!Array.isArray(allowed) || !allowed.length) continue;
    const current = text(next[field.key]);
    /* 夹取给**该模型能给的最高的那一档**（allowed 按低→高声明）：
       用户原来选的是更高的档，被夹时不该被悄悄降到最低 —— 那是"少给了还不说"。 */
    if (current && !allowed.some(value => String(value) === current)) next[field.key] = allowed[allowed.length - 1];
  }
  return next;
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
  /* slotIndex 一路传到 skillImages：逐张跑的技能靠它决定"这一次带哪一张参考图" */
  const images = skillImages(skill, values, { slotIndex });
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
