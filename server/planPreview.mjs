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
    materials,
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

function directionPrompt(surface, direction) {
  const dims = planPreviewDirections(surface);
  const picked = direction && typeof direction === 'object' ? direction : {};
  const lines = [];
  for (const dim of dims) {
    const chosen = dim.options.find(option => option.value === picked[dim.key]);
    if (chosen) lines.push('- ' + dim.label + '：' + chosen.label + '。' + chosen.prompt);
  }
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
  const direction = directionPrompt(surface, input.direction);
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
    '',
    'JSON 结构（字段名必须逐字一致）：',
    '{',
    '  "materials": [{ "id": "素材 id", "name": "素材名", "understanding": "对这张素材的理解（60-160 字，具体、可核对，不要空话）" }],',
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
  ].join('\n');
  const userPrompt = [
    '【创作表面】' + (isVideo ? '视频生成' : '图片生成'),
    skillName ? '【当前技能】' + skillName : '',
    '【用户需求】' + (prompt || '（用户没有额外描述，按素材与方向偏好来）'),
    direction ? '【已选方向偏好】\n' + direction : '【已选方向偏好】（用户未选，按需求自行判断）',
    materials.length
      ? '【参考素材】共 ' + materials.length + ' 张，id 与名称如下，请逐张给出理解：\n'
        + materials.map((item, index) => (index + 1) + '. id=' + item.id + ' name=' + item.name).join('\n')
      : '【参考素材】无（纯文生）',
  ].filter(Boolean).join('\n');
  return { surface, systemPrompt, userPrompt, materials };
}

/* 本地兜底：模型不可用时**如实**说明「这次没有真正分析素材」，绝不假装分析过。 */
export function buildLocalPlanPreview(input = {}, reason = '') {
  const surface = normalizeSurface(input.surface);
  const materials = list(input.materials, 6).map((item, index) => ({
    id: clean(item?.id, 80) || 'material-' + (index + 1),
    name: clean(item?.name, 120) || '素材 ' + (index + 1),
    understanding: '这次没有连上分析模型，还没有真正读过这张素材。你可以直接点「重新生成方案」再试一次（失败不扣积分）。',
  }));
  return normalizePlanPreview({
    degraded: true,
    reason: clean(reason, 300) || '分析模型暂不可用',
    materials,
    plan: {
      title: surface === 'video' ? '视频拍摄方案（待生成）' : '图片生成方案（待生成）',
      summary: '分析模型暂时不可用，这次没有生成真正的方案，也没有扣你的积分。稍后重试即可。',
      promptText: '',
      steps: [],
      notes: ['失败不扣积分；可以直接重试。'],
    },
  }, { surface, materials, degraded: true, reason: clean(reason, 300) || '分析模型暂不可用' });
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
      return normalizePlanPreview(parsed, { surface: request.surface, materials: request.materials });
    },
  };
}
