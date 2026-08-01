import { normalizeCreativeDirectionPlans } from './creativeDirectionPlan.mjs';

const MAX_IMAGES_PER_ROLE = 8;
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(record, key) {
  return isRecord(record) && Object.hasOwn(record, key) && !UNSAFE_KEYS.has(key.toLowerCase());
}

function ownValue(record, ...keys) {
  for (const key of keys) {
    if (hasOwn(record, key)) return record[key];
  }
  return undefined;
}

function cleanString(value, maxLength = 1200) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const normalized = String(value).trim();
  if (!normalized || UNSAFE_KEYS.has(normalized.toLowerCase())) return '';
  return normalized.slice(0, maxLength);
}

function cleanStringArray(value, maxItems = 20) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  const result = [];
  const seen = new Set();
  for (const item of values) {
    const normalized = cleanString(item, 240);
    const signature = normalized.toLowerCase();
    if (!normalized || seen.has(signature)) continue;
    seen.add(signature);
    result.push(normalized);
    if (result.length >= maxItems) break;
  }
  return result;
}

function parseModelJson(value) {
  const text = cleanString(value, 100_000).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  const json = text.slice(start, end + 1);
  try {
    return JSON.parse(json);
  } catch {
    try {
      return JSON.parse(json.replace(/,\s*([}\]])/g, '$1'));
    } catch {
      return null;
    }
  }
}

function sanitizeAnalysis(value, status = 'complete') {
  const analysis = isRecord(value) ? value : {};
  return {
    status,
    product_observations: cleanStringArray(ownValue(analysis, 'product_observations', 'productObservations')),
    product_uncertainties: cleanStringArray(ownValue(analysis, 'product_uncertainties', 'productUncertainties')),
    reference_style: cleanStringArray(ownValue(analysis, 'reference_style', 'referenceStyle')),
    commercial_opportunities: cleanStringArray(ownValue(analysis, 'commercial_opportunities', 'commercialOpportunities')),
  };
}

function normalizeImageUrls(value) {
  const values = Array.isArray(value) ? value : [];
  const seen = new Set();
  return values.flatMap((entry) => {
    const url = cleanString(typeof entry === 'string' ? entry : ownValue(entry, 'url', 'src', 'image_url'), 20_000);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [url];
  }).slice(0, MAX_IMAGES_PER_ROLE);
}

async function resolveRoleImages(urls, readImageAsDataUrl, signal) {
  const results = [];
  for (const url of urls) {
    if (signal?.aborted) throw signal.reason || Object.assign(new Error('设计方向分析已取消'), { name: 'AbortError' });
    try {
      const dataUrl = await readImageAsDataUrl(url, { signal });
      if (dataUrl) results.push(dataUrl);
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') throw signal?.reason || error;
    }
  }
  return results;
}

function requestedSuiteSummary(value) {
  const groups = Array.isArray(value) ? value : [];
  return groups.map((group) => {
    const key = cleanString(ownValue(group, 'key', 'role', 'id'), 48);
    const label = cleanString(ownValue(group, 'label', 'name'), 48) || key;
    const count = Math.max(0, Math.min(20, Math.trunc(Number(ownValue(group, 'count')) || 0)));
    const ratio = cleanString(ownValue(group, 'ratio'), 20);
    return count > 0 && key ? `${key}（${label}）×${count}，比例 ${ratio || '智能'}` : '';
  }).filter(Boolean).join('；') || '使用系统智能套图配置';
}

function buildSystemPrompt() {
  return `你是一名兼具电商策略、视觉设计、商品摄影和转化经验的创意总监。你要在一次分析中完成商品观察、参考风格提取，并输出恰好四套针对当前商品的可执行设计方案。

图片角色规则：
1. “商品事实图”决定商品身份、颜色、比例、结构、可见组件和可验证状态。
2. “视觉参考图”只用于提取构图、光线、色彩、场景和信息层级，不能把参考图里的竞品、Logo、包装或结构替换到当前商品。
3. 看不清或无法确认的尺寸、成分、认证、性能和内部结构必须写入 product_uncertainties，不能当作事实。

四套方向必须分别从商业策略上形成显著差异，而不只是换色。每套都要具体说明卖给谁、解决什么购买问题、怎样呈现商品，以及当前套图配置里的每一张图要做什么。不得修改图片类型、数量和比例，不得增加视频、工作流或未请求的交付物。

每张图必须有独立职责、画面执行方式和变化点；详情图一屏只讲一个主题，不能要求一次生成整张长详情页。所有方案都要保留商品真实性，并明确一致性锁、禁止风格和风险约束。

只返回 JSON，不要 Markdown，不要解释。结构如下：
{
  "analysis": {
    "product_observations": ["只写可见或用户确认的信息"],
    "product_uncertainties": ["无法确认的信息"],
    "reference_style": ["可借鉴的视觉特征"],
    "commercial_opportunities": ["可表达的购买机会"]
  },
  "directions": [{
    "schema_version": 1,
    "id": "stable-id",
    "title": "4-10字方案名",
    "one_liner": "一句话说明整套方案如何卖货",
    "commercial_objective": "明确商业目标",
    "audience": "明确目标受众",
    "visual_tone": ["关键词1", "关键词2", "关键词3"],
    "visual_system": {
      "palette": ["#RRGGBB", "#RRGGBB", "#RRGGBB"],
      "lighting": "光线策略",
      "composition": "整套构图系统",
      "camera_language": "镜头语言",
      "background_language": "背景语言",
      "typography_intent": "文字和版式意图",
      "information_density": "信息密度",
      "mood": "氛围",
      "copy_tone": "文案语气"
    },
    "product_strategy": {
      "hero_focus": "主视觉聚焦什么",
      "angle_plan": "如何安全变化角度",
      "interaction_plan": "如何展示可确认的使用或组件状态",
      "scenario_plan": "选择什么真实场景",
      "reference_adaptation": "如何借鉴参考图但不复制竞品"
    },
    "deliverables": [{
      "role": "必须使用用户配置里的 role",
      "group_strategy": "该组图片的整体策略",
      "shots": [{
        "index": 0,
        "label": "准确中文标题",
        "purpose": "这张图解决的购买问题",
        "visual_execution": "具体画面、构图、光线、场景和文字安排",
        "variation_key": "与同组其他图片不同的变化点",
        "depends_on": ["product_truth", "campaign_bible"]
      }]
    }],
    "consistency_locks": ["整套必须保持的规则"],
    "prohibited_styles": ["不允许的表达"],
    "risk_guards": ["事实和参考图边界"],
    "execution_guide": "用户可编辑的整套执行说明",
    "preview_colors": ["#RRGGBB", "#RRGGBB", "#RRGGBB"]
  }]
}`;
}

function buildUserPrompt(input, productCount, referenceCount) {
  const productStart = productCount > 0 ? 1 : 0;
  const productEnd = productCount;
  const referenceStart = referenceCount > 0 ? productCount + 1 : 0;
  const referenceEnd = productCount + referenceCount;
  const productParams = isRecord(ownValue(input, 'product_params', 'productParams'))
    ? ownValue(input, 'product_params', 'productParams')
    : {};
  const copywriting = isRecord(ownValue(input, 'copywriting')) ? ownValue(input, 'copywriting') : {};
  const skus = Array.isArray(ownValue(input, 'skus')) ? ownValue(input, 'skus') : [];

  return [
    productCount > 0 ? `图片 ${productStart}-${productEnd}：商品事实图，只用于识别当前商品。` : '没有商品事实图，只能依据用户明确文字，不得猜测商品外观。',
    referenceCount > 0 ? `图片 ${referenceStart}-${referenceEnd}：视觉参考图，只借鉴视觉语言。` : '没有视觉参考图，请根据品类和用户需求建立原创视觉方向。',
    `商品名称：${cleanString(ownValue(input, 'product_name', 'productName')) || '未指定'}`,
    `品类：${cleanString(ownValue(input, 'category')) || '其他'}`,
    `目标平台：${cleanString(ownValue(input, 'platform')) || '智能推荐'}`,
    `用户需求：${cleanString(ownValue(input, 'description', 'user_prompt', 'userPrompt')) || '生成一套专业电商视觉'}`,
    `材质：${cleanString(ownValue(productParams, 'material')) || '未确认'}`,
    `工艺：${cleanString(ownValue(productParams, 'craft')) || '未确认'}`,
    `尺寸：${cleanString(ownValue(productParams, 'size')) || '未确认'}`,
    `用户卖点：${cleanString(ownValue(copywriting, 'sellingPoints', 'selling_points')) || '未填写'}`,
    `用户策划补充：${cleanString(ownValue(copywriting, 'plan')) || '未填写'}`,
    `SKU：${skus.map(sku => isRecord(sku) ? [ownValue(sku, 'color'), ownValue(sku, 'size'), ownValue(sku, 'capacity')].map(cleanString).filter(Boolean).join('/') : '').filter(Boolean).join('、') || '未配置'}`,
    `权威套图配置：${requestedSuiteSummary(ownValue(input, 'requested_images', 'requestedImages'))}`,
    '请按上述配置输出恰好四套完整方案。每个 deliverable 的 shots 数量必须等于该组配置数量。',
  ].join('\n');
}

export function createDesignDirectionService({ readImageAsDataUrl, completeText } = {}) {
  if (typeof readImageAsDataUrl !== 'function') throw new TypeError('readImageAsDataUrl is required');
  if (typeof completeText !== 'function') throw new TypeError('completeText is required');

  return {
    async generate(input = {}, { signal } = {}) {
      const productName = cleanString(ownValue(input, 'product_name', 'productName'));
      const description = cleanString(ownValue(input, 'description', 'user_prompt', 'userPrompt'));
      const productUrls = normalizeImageUrls(ownValue(input, 'real_shots', 'realShots'));
      const referenceUrls = normalizeImageUrls(ownValue(input, 'ref_shots', 'refShots'));
      if (!productName && !description && productUrls.length === 0) {
        throw Object.assign(new Error('请至少填写产品名称或上传产品图'), { status: 400 });
      }

      const [productImages, referenceImages] = await Promise.all([
        resolveRoleImages(productUrls, readImageAsDataUrl, signal),
        resolveRoleImages(referenceUrls, readImageAsDataUrl, signal),
      ]);
      const images = [...productImages, ...referenceImages];
      const response = await completeText({
        systemPrompt: buildSystemPrompt(),
        userPrompt: buildUserPrompt(input, productImages.length, referenceImages.length),
        images,
        signal,
        maxTokens: 8000,
        temperature: 0.25,
      });
      const parsed = parseModelJson(response);
      const requestedImages = ownValue(input, 'requested_images', 'requestedImages');
      const directions = normalizeCreativeDirectionPlans(parsed?.directions, {
        requestedImages,
        productName,
        category: cleanString(ownValue(input, 'category')),
        platform: cleanString(ownValue(input, 'platform')),
        userPrompt: description,
      });

      return {
        directions,
        analysis: sanitizeAnalysis(parsed?.analysis, parsed ? 'complete' : 'fallback'),
      };
    },
  };
}
