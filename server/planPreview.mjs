/* ═══ 三步方案预览（批 K-C / K-D）══════════════════════════════════════════════════════
   用户第 16 轮原话（docs/design/62-batch-K-annotations.md §3）：
     「图片生成这边是没有这个代为撰写的，这个分析方案的步骤是在那个**预览**的那个地方……
      这个预览实际上就跟这个代为撰写是一样的东西……它实际上就是**一个设计方案**。」
     「他们这两套东西**本质上都是一个设计方案**，只是在它里面**有不同的入口**。」
   ⇒ 所以本模块**只有一份实现**，两个入口（图片侧「预览」/ 视频侧「代为撰写」）共用。

   抄的是知渔（laoyu.quantv.com）「代为撰写」的三步（取证：docs/design/61-quantv-dawei-chuanxie.md）：
     ① 素材理解（结果是**可编辑**的，用户能纠偏）
     ② 方向与偏好（他们三个维度的档位结构：业务场景 / 内容类型 / 拍摄方式）
     ③ 方案预览（可改、确认后应用）
   他们的三步是三次模型调用（弹窗明细：分析我的素材 0.10/张 + 参考视频拆解 0.50/次 +
   按配置生成脚本 0.10/条，合计 ≈0.60）；**我们按用户这一轮拍的口径收一个数：0.5 积分/次**，
   不按张、不按步叠加（docs/design/62 §二）。

   ⚠️ 降级（degraded）不收费：模型不可用/超时 → 本地兜底方案，与 /api/video/plans 同一口径
     （「为无效请求扣费」是本项目的铁律①，兜底不算交付，所以不扣）。 */

export const PLAN_PREVIEW_SURFACES = Object.freeze(['image', 'video']);

/* ═══ 2026-09-26 批 BW：**这条 skill 自己的解析方案**接进流水线 ═══════════════════════════════
   用户口径（逐字）：「我要的是，**每个工作台 skill 有自己个性化的解析方案**啊，
   **不可能概念 skill 还解析什么卖点和产品特点吧**？」「不止是概念视觉，我们现在**所有的图片生成和
   视频生成的代为撰写**是不是都应该这么做呢，**个性化做匹配方案**啊。」
   ⇒ 上面那两串通用档位（`IMAGE_DIRECTIONS`/`VIDEO_DIRECTIONS`）**降级为兜底**：
     只有拿不到 skill 声明的入口（首页那种没有 skillId 的）才用。

   ⚠️ **方案表由前端下发，服务端不 import `src/`** —— 这条是**上线验出来的**，不是洁癖：
      部署包只装 `dist server shared scripts`（见 `scripts/deploy-production.ps1` 的打包清单），
      **不含 `src/`**。我第一版在服务端 `import '../src/skills/parseSpecs.js'`，
      本地测试全绿、precommit 全绿，因为本地有 `src/`；一上生产，服务端在 **import 期**就找不到模块，
      进程起不来 → 健康检查 60 次全部 connection refused → 部署脚本自动回滚（生产未受影响）。
      ⇒ 声明源仍然只有一份（`src/skills/parseSpecs.js`，被打进 dist 的前端用它渲染），
        服务端只**接收并消毒**前端算好的那份"要解析什么"，不再依赖 `src/`。
        防回退：门禁 `test/server-shipping-boundary-0926.test.mjs` 扫 `server/**` 里的 `../src/` 引用。 */
function sanitizeSpecItems(value) {
  const seen = new Set();
  const out = [];
  for (const entry of Array.isArray(value) ? value : []) {
    const key = clean(entry?.key, 60);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label: clean(entry?.label, 40) || key, hint: clean(entry?.hint, 200) });
    if (out.length >= 24) break;
  }
  return out;
}

/* 方向组同样只做消毒：档位由前端按声明算好（可以继承工作台自己那一格），这里只保证形状与长度可控。
   一条都没有 ⇒ 返回 null，调用方退回表面级通用档。 */
function sanitizeDirections(value) {
  const groups = [];
  for (const group of Array.isArray(value) ? value : []) {
    const key = clean(group?.key, 40);
    if (!key) continue;
    const options = [];
    for (const option of Array.isArray(group?.options) ? group.options : []) {
      const optionValue = clean(option?.value, 300);
      if (!optionValue) continue;
      options.push({
        value: optionValue,
        label: clean(option?.label, 40) || optionValue,
        prompt: clean(option?.prompt, 300),
        pinned: option?.pinned === true,
      });
      if (options.length >= 24) break;
    }
    if (!options.length) continue;
    groups.push({ key, label: clean(group?.label, 40) || key, options });
    if (groups.length >= 8) break;
  }
  return groups.length ? groups : null;
}

/* 方向与偏好：三个维度，结构照知渔，选项按各自表面（视频侧直接用他们线上 config 的真实档位）。 */
const VIDEO_DIRECTIONS = [
  {
    key: 'business',
    label: '业务场景',
    options: [
      { value: 'ecommerce', label: '电商带货', prompt: '侧重商品卖点、使用场景、性价比与下单引导。' },
      { value: 'local_store', label: '同城到店', prompt: '侧重门店位置、同城专属福利、到店体验、门店氛围、限时权益、同城引流到店。' },
      { value: 'home_service', label: '上门服务', prompt: '侧重服务优势、上门便捷性、用户痛点解决、服务保障、专业度、预约咨询引导。' },
      { value: 'education', label: '教育培训', prompt: '侧重课程价值、学习成果、师资与口碑、试听与咨询引导。' },
    ],
  },
  {
    key: 'content',
    label: '内容类型',
    options: [
      { value: 'selling', label: '带货', prompt: '直接讲商品与权益，节奏快，结尾给明确的行动指令。' },
      { value: 'seeding', label: '种草', prompt: '以真实体验切入，先讲痛点再给解决方案，语气自然。' },
      { value: 'hook', label: '卖点钩子', prompt: '开场一秒抛最强卖点钩子，中段给证据，结尾回扣卖点。' },
      { value: 'story', label: '剧情演绎', prompt: '用一个小剧情承载卖点，人物有动机、有转折，不喊口号。' },
      { value: 'daily', label: '生活记录', prompt: '第一视角记录日常使用场景，不广告腔、不摆拍感。' },
    ],
  },
  {
    key: 'shot',
    label: '拍摄方式',
    options: [
      { value: 'tabletop', label: '桌拍开箱', prompt: '采用桌拍、开箱、细节特写等镜头，突出商品外观、材质和使用步骤。' },
      { value: 'talking', label: '真人口播', prompt: '真人口播为主，机位稳定，口型与字幕对齐，背景干净。' },
      { value: 'onershot', label: '一镜到底', prompt: '一个连续长镜头完成，靠运镜与走位推进节奏。' },
      { value: 'motion', label: '运动跟拍', prompt: '手持或稳定器跟拍，运动感强，转场干脆。' },
      { value: 'tvc', label: '品牌TVC', prompt: '广告片质感，光影讲究，镜头语言克制、高级。' },
    ],
  },
];

/* 图片侧：**同一套三维结构**（用户原话「照他们三个维度的档位结构」），选项换成画面语汇。 */
const IMAGE_DIRECTIONS = [
  VIDEO_DIRECTIONS[0],
  {
    key: 'content',
    label: '画面用途',
    options: [
      { value: 'main', label: '主图', prompt: '干净利落的主图：主体居中、背景不抢戏，适合列表页第一眼。' },
      { value: 'scene', label: '场景种图', prompt: '把商品放进真实使用场景，讲清「谁在什么情况下用它」。' },
      { value: 'detail', label: '卖点详情', prompt: '一张图讲一个卖点，配细节特写与必要的中文标注。' },
      { value: 'brand', label: '品牌形象', prompt: '品牌调性优先：统一的光线、色调与构图语言。' },
    ],
  },
  {
    key: 'shot',
    label: '拍摄方式',
    options: [
      { value: 'studio', label: '白底棚拍', prompt: '纯白底棚拍，柔和主光 + 均匀补光，无杂乱阴影。' },
      { value: 'tabletop', label: '桌拍开箱', prompt: '桌面场景实拍，带一点生活道具，保留材质质感。' },
      { value: 'lifestyle', label: '场景实拍', prompt: '真实生活场景，自然光，人物或手部入镜增加可信度。' },
      { value: 'model', label: '真人出镜', prompt: '真人在画面中使用商品，姿态自然，不直视镜头摆拍。' },
      { value: 'premium', label: '品牌质感', prompt: '高级质感：低饱和、硬光或逆光轮廓，构图留白。' },
    ],
  },
];

export const PLAN_PREVIEW_DIRECTIONS = deepFreeze({
  image: IMAGE_DIRECTIONS,
  video: VIDEO_DIRECTIONS,
});

export function planPreviewDirections(surface) {
  return PLAN_PREVIEW_DIRECTIONS[normalizeSurface(surface)];
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function normalizeSurface(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return PLAN_PREVIEW_SURFACES.includes(raw) ? raw : 'image';
}

function clean(value, max = 400) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function list(value, max = 6) {
  return Array.isArray(value) ? value.slice(0, max) : [];
}

function parseJsonObject(text) {
  const raw = typeof text === 'string' ? text.trim() : '';
  if (!raw) return {};
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return {};
  try { return JSON.parse(body.slice(start, end + 1)); } catch { return {}; }
}

/* 素材清单：只收名字与「AI 对它的理解」，**不把用户的原图回传给前端**。 */
function normalizeMaterials(value, fallbackMaterials) {
  const source = Array.isArray(value) && value.length ? value : null;
  if (!source) return fallbackMaterials;
  return source.slice(0, 6).map((item, index) => {
    const fallback = fallbackMaterials[index] || {};
    return {
      id: clean(item?.id, 80) || fallback.id || 'material-' + (index + 1),
      name: clean(item?.name, 120) || fallback.name || '素材 ' + (index + 1),
      understanding: clean(item?.understanding ?? item?.analysis, 600) || fallback.understanding || '',
    };
  });
}

function normalizeSteps(value) {
  return list(value, 8).map((item, index) => ({
    index: index + 1,
    title: clean(item?.title ?? item, 80) || '第 ' + (index + 1) + ' 步',
    detail: clean(item?.detail ?? item?.description, 400),
  }));
}

/* ═══ 内容判定（批 BA，docs/design/75 §三.1）：**搭在已有调用上的顺带判定** ═══════════════════════
   用户口径：「**为什么还要重新花钱呢**，用户上传素材和提示词不是本来就要识别一次吗，
   为什么我们还要再识别一次呢？没有低成本的过滤方案吗」⇒ 这一层不新开调用，只多要一个字段。
   ⚠️ 三态而不是两态：模型**没答**这个字段时是 `null`（"这次没判"），不是 `false`（"判了没问题"）——
      两态会让"模型没答"看起来像"审核通过"，那是拿用户的钱去赌一个我们没做过的检查。 */
export function normalizeSafety(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: null, categories: [] };
  if (typeof value.ok !== 'boolean') return { ok: null, categories: [] };
  const categories = list(value.categories, 5).map(item => clean(item, 40)).filter(Boolean);
  return { ok: value.ok, categories };
}

/* 判定为不合规时给用户看的那句话（与第一阶段 400 文案同一口径：说清"下一步做什么"） */
export function safetyBlockedReason(safety) {
  const categories = (safety?.categories || []).join('、');
  return categories
    ? `这段需求或素材未通过内容规范检查（${categories}），请更换后重试`
    : '这段需求或素材未通过内容规范检查，请更换后重试';
}

export function normalizePlanPreview(value, fallback = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const planSource = source.plan && typeof source.plan === 'object' ? source.plan : source;
  const fallbackMaterials = Array.isArray(fallback.materials) ? fallback.materials : [];
  const materials = normalizeMaterials(source.materials, fallbackMaterials);
  const degraded = source.degraded === true || fallback.degraded === true;
  return {
    surface: normalizeSurface(fallback.surface),
    degraded,
    reason: degraded ? clean(source.reason || fallback.reason, 300) : '',
    safety: normalizeSafety(source.safety ?? fallback.safety),
    materials,
    /* 解析条目：**声明源给 label/hint，模型只给 value** ——
       模型没有资格发明"要解析什么"，它只回答声明里列出的那几项（见 buildPlanPreviewRequest）。 */
    items: normalizePlanItems(source.items ?? planSource.items, fallback.items),
    plan: {
      title: clean(planSource.title, 120) || (fallback.surface === 'video' ? '视频拍摄方案' : '图片生成方案'),
      summary: clean(planSource.summary, 800),
      /* 交付给工作台的那段正文：视频侧=脚本，图片侧=提示词。 */
      promptText: clean(planSource.promptText ?? planSource.script ?? planSource.prompt, 4000),
      steps: normalizeSteps(planSource.steps),
      notes: list(planSource.notes, 6).map(item => clean(item, 200)).filter(Boolean),
    },
  };
}

/* 解析条目归一化：模型的 `[{key,value}]`（也容忍 `{key: value}` 对象）与声明源的 label/hint 合并。
   ⚠️ 只留**声明里有的 key**（+ 用户自己加的行）：模型自己冒出来的键一律丢掉 ——
      否则"这条 skill 不该解析卖点"这件事会被模型的自由发挥绕过。 */
function normalizePlanItems(value, specItems) {
  const spec = Array.isArray(specItems) ? specItems : [];
  const byKey = new Map(spec.map(item => [String(item?.key || ''), item]));
  const values = new Map();
  if (Array.isArray(value)) {
    for (const entry of value) {
      const key = clean(entry?.key, 60);
      if (key && !values.has(key)) values.set(key, clean(entry?.value ?? entry?.text ?? entry?.content, 600));
    }
  } else if (value && typeof value === 'object') {
    for (const [key, text] of Object.entries(value)) {
      const safeKey = clean(key, 60);
      if (safeKey && !values.has(safeKey)) values.set(safeKey, clean(text, 600));
    }
  }
  return spec.map(item => ({
    key: String(item?.key || ''),
    label: clean(item?.label, 40) || String(item?.key || ''),
    hint: clean(item?.hint, 200),
    value: values.get(String(item?.key || '')) || '',
  })).filter(item => item.key);
}

/* 用户在上一步改过的解析条目（改完再点「重新生成方案」时会被当成**已确认的结论**下发）。
   ⚠️ 三种 key 都收：声明里的、以及用户自己加的（`custom-`）——
      用户打的字也是需求的一部分，不能因为"声明里没有这个 key"就丢掉。
      （被过滤掉的只有**模型自己编的**键 —— 那一条在 normalizePlanItems 里守。） */
function confirmedItems(value, specItems) {
  const spec = new Set((Array.isArray(specItems) ? specItems : []).map(item => String(item?.key || '')));
  return (Array.isArray(value) ? value : []).slice(0, 24).map(item => ({
    key: clean(item?.key, 60),
    label: clean(item?.label, 40),
    value: clean(item?.value, 600),
  })).filter(item => item.key && item.value && (spec.has(item.key) || item.key.startsWith('custom-')));
}

function directionPrompt(dimensions, direction) {
  const dims = Array.isArray(dimensions) ? dimensions : [];
  const picked = direction && typeof direction === 'object' ? direction : {};
  const lines = [];
  for (const dim of dims) {
    const chosen = (dim.options || []).find(option => option.value === picked[dim.key]);
    if (chosen) lines.push('- ' + dim.label + '：' + chosen.label + '。' + (chosen.prompt || ''));
  }
  return lines.join('\n');
}

/* 这一步真正要干的活：技能声明里要解析什么，就只问什么（也**只**让它回答这些）。 */
function itemsInstruction(specItems, isVideo) {
  const items = Array.isArray(specItems) ? specItems : [];
  const keys = items.map(item => String(item?.key || '')).filter(Boolean);
  const lines = [
    '第三步：按下面这份「本条技能要解析的东西」逐项给出结论。key 必须逐字使用，value 写成一句可直接使用的' + (isVideo ? '拍摄要点' : '画面描述') + '；',
    '看不懂、素材里没有的项就留空字符串；**不要**解析这份清单之外的任何东西（比如卖点、适用人群、价格、尺寸参数）。',
  ];
  for (const item of items) lines.push('  - ' + item.key + '（' + item.label + '）：' + (item.hint || ''));
  lines.push('最终 JSON 里的字段名固定是 `items`，形如 ' + JSON.stringify(keys.slice(0, 2).map(key => ({ key, value: '…' }))) + '。');
  return lines.join('\n');
}

export function buildPlanPreviewRequest(input = {}) {
  const surface = normalizeSurface(input.surface);
  const isVideo = surface === 'video';
  const materials = list(input.materials, 6).map((item, index) => ({
    id: clean(item?.id, 80) || 'material-' + (index + 1),
    name: clean(item?.name, 120) || '素材 ' + (index + 1),
    url: clean(item?.url, 2000),
  }));
  /* 解析项与方向组由**前端按这条 skill 的声明**算好后下发（见本文件顶部那段：服务端不 import `src/`）。
     前端没给（首页入口、老客户端）⇒ 退回表面级通用档，行为与从前一致。 */
  const specItems = sanitizeSpecItems(input.specItems);
  const dimensions = sanitizeDirections(input.directions) || planPreviewDirections(surface);
  const confirmed = confirmedItems(input.items, specItems);
  const direction = directionPrompt(dimensions, input.direction);
  const skillName = clean(input.skillName, 120);
  const prompt = clean(input.prompt, 2000);
  const deliverable = isVideo
    ? '一条可以直接拿去生成的视频脚本（分镜 + 口播/字幕 + 运镜与节奏）'
    : '一段可以直接拿去生成的图片提示词（主体 + 场景 + 光线 + 构图 + 风格）';
  const systemPrompt = [
    '你是电商内容策划。用户会给你他的需求描述、参考素材和已经选好的方向偏好。',
    '请分两步思考，然后用一个 JSON 对象回答，不要输出任何多余文字：',
    '第一步：逐张读懂参考素材，给出每张素材的「理解」（它在这次创作里承担什么作用、有什么可用的信息）。',
    '第二步：综合需求、素材理解与方向偏好，产出' + deliverable + '。',
    specItems.length ? itemsInstruction(specItems, isVideo) : null,
    '',
    'JSON 结构（字段名必须逐字一致）：',
    '{',
    /* ═══ safety：搭在这**已经要发生的那一次调用**上的内容判定（批 BA，docs/design/75 §三.1）══════
       用户口径：「**为什么还要重新花钱呢**，用户上传素材和提示词不是本来就要识别一次吗…
       没有低成本的过滤方案吗」——所以不新开一次审核调用，而是在这一份 JSON 里多要一个字段。
       边界如实写死在这里：**只判显式违规**（与本地词表同一份类别口径），拿不准就 ok:true；
       这一层是"顺带判定"，不是"全面检测"（真正的召回仍靠本地闸门 + 上游拒绝翻译）。 */
    '  "safety": { "ok": true, "categories": [] },',
    '  "materials": [{ "id": "素材 id", "name": "素材名", "understanding": "对这张素材的理解（60-160 字，具体、可核对，不要空话）" }],',
    specItems.length ? '  "items": [{ "key": "上面清单里的 key", "value": "这一项的结论" }],' : null,
    '  "plan": {',
    '    "title": "方案标题（不超过 20 字）",',
    '    "summary": "方案概述（80-200 字，说清这支内容要达成什么）",',
    '    "promptText": "' + (isVideo ? '完整视频脚本正文' : '完整图片提示词正文') + '（这是最终交付物，要能直接使用）",',
    '    "steps": [{ "title": "分步标题", "detail": "这一步具体做什么" }],',
    '    "notes": ["需要用户注意的点，最多 4 条"]',
    '  }',
    '}',
    '',
    '硬性要求：不要编造素材里不存在的信息；看不清就如实说看不清；不要出现价格、水印、无关文字的建议。',
    'safety 字段的判定口径（**只判显式**，拿不准一律 ok:true）：需求或素材**明确要求**下列内容时为 false，'
      + '并把类别名放进 categories：色情低俗 / 违禁品与违法交易 / 暴恐与极端 / 政治敏感 / 未成年人性化。'
      + '正常商业表达（内衣、泳装、美妆、医美、模特身材）**不算**违规 —— 误判会让正常用户被挡在门外。',
  ].filter(line => line !== null).join('\n');
  /* `specKey`/`specSource` 由前端下发（它的解析方案是哪一套、来自族级还是单条覆盖）——
     服务端只做长度消毒，不再自己去查声明源（理由见文件顶部那段）。 */
  const specKey = clean(input.specKey, 60);
  const specSource = clean(input.specSource, 20);
  const userPrompt = [
    '【创作表面】' + (isVideo ? '视频生成' : '图片生成'),
    specKey
      ? '【当前技能】' + skillName + '（' + specKey + '：' + (specSource === 'override' ? '这条技能自己的解析方案' : '同族通用方案') + '）'
      : (skillName ? '【当前技能】' + skillName : ''),
    '【用户需求】' + (prompt || '（用户没有额外描述，按素材与方向偏好来）'),
    direction ? '【已选方向偏好】\n' + direction : '【已选方向偏好】（用户未选，按需求自行判断）',
    /* 用户在预览里改过的解析结论 = 已确认的事实，优先级高于模型的重新推断（与提示词的优先级口径一致）。 */
    confirmed.length
      ? '【用户已确认的解析】（**以此为准**，与你的推断冲突时按这里来）\n'
        + confirmed.map(item => '- ' + (item.label || item.key) + '：' + item.value).join('\n')
      : '',
    materials.length
      ? '【参考素材】共 ' + materials.length + ' 张，id 与名称如下，请逐张给出理解：\n'
        + materials.map((item, index) => (index + 1) + '. id=' + item.id + ' name=' + item.name).join('\n')
      : '【参考素材】无（纯文生）',
  ].filter(Boolean).join('\n');
  return { surface, systemPrompt, userPrompt, materials, skillKey: specKey, items: specItems, directions: dimensions };
}

/* 本地兜底：模型不可用时**如实**说明「这次没有真正分析素材」，绝不假装分析过。 */
export function buildLocalPlanPreview(input = {}, reason = '') {
  const surface = normalizeSurface(input.surface);
  const specItems = sanitizeSpecItems(input.specItems);
  const materials = list(input.materials, 6).map((item, index) => ({
    id: clean(item?.id, 80) || 'material-' + (index + 1),
    name: clean(item?.name, 120) || '素材 ' + (index + 1),
    understanding: '这次没有连上分析模型，还没有真正读过这张素材。你可以直接点「重新生成方案」再试一次（失败不扣积分）。',
  }));
  return normalizePlanPreview({
    degraded: true,
    reason: clean(reason, 300) || '分析模型暂不可用',
    materials,
    /* 解析项的**行**照常给出（label/hint 来自声明），只是**值留空** ——
       界面因此不会在失败时把"这条技能要解析什么"整块藏掉（那会让人以为这条技能根本没有解析方案）。 */
    items: specItems.map(item => ({ key: item.key, value: '' })),
    plan: {
      title: surface === 'video' ? '视频拍摄方案（待生成）' : '图片生成方案（待生成）',
      summary: '分析模型暂时不可用，这次没有生成真正的方案，也没有扣你的积分。稍后重试即可。',
      promptText: '',
      steps: [],
      notes: ['失败不扣积分；可以直接重试。'],
    },
  }, {
    surface,
    materials,
    items: specItems,
    degraded: true,
    reason: clean(reason, 300) || '分析模型暂不可用',
  });
}

export function createPlanPreviewService({ completeText } = {}) {
  if (typeof completeText !== 'function') throw new TypeError('completeText is required');
  return {
    async compose(input = {}) {
      const request = buildPlanPreviewRequest(input);
      let content = '';
      try {
        content = await completeText({
          systemPrompt: request.systemPrompt,
          userPrompt: request.userPrompt,
          images: list(input.images, 6),
          maxTokens: 2600,
          temperature: 0.2,
        });
      } catch (error) {
        return buildLocalPlanPreview(input, error?.message || String(error));
      }
      const parsed = parseJsonObject(content);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Object.keys(parsed).length) {
        return buildLocalPlanPreview(input, '分析结果无法解析');
      }
      const preview = normalizePlanPreview(parsed, { surface: request.surface, materials: request.materials, items: request.items });
      /* ═══ 判定为不合规 ⇒ **这次不出方案**（批 BA，doc 75 §三.1「有这种内容肯定是要直接拒的」）═════
         三条都重要：
           ① 走**降级**那条路（`degraded: true`）—— 路由对降级结果是**不扣费**的
              （`billing: { charged: false, reason: 'DEGRADED_LOCAL_PLAN' }`），所以"直接拒"不会让用户
              白花这 0.5 积分；
           ② `promptText` 清空 —— 用户手里那份"可以直接拿去生成的提示词"就是违规内容本身，
              留着它等于把违禁品递过去（界面那一边还会把"跳过方案直接生成"整颗拿掉，见 PlanPreviewDialog）；
           ③ 原因写清类别，让用户知道改哪里（不说"失败请重试"，那句话会让他原样再点一次）。 */
      if (preview.safety.ok === false) {
        return {
          ...preview,
          degraded: true,
          blocked: true,
          reason: safetyBlockedReason(preview.safety),
          plan: { ...preview.plan, promptText: '' },
        };
      }
      return preview;
    },
  };
}
