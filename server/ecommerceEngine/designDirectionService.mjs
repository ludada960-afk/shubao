import { normalizeCreativeDirectionPlans } from './creativeDirectionPlan.mjs';
import { createCreativeAttemptId, selectCreativeRoute } from './creativeRoutePolicy.mjs';
import {
  COMMERCE_CONTENT_TYPES,
  commerceLanguage,
  commercePlatform,
  normalizeCommerceContext,
} from './internationalCommerceRegistry.mjs';

const MAX_IMAGES_PER_ROLE = 4;
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

function analysisHasContent(analysis) {
  return ['product_observations', 'product_uncertainties', 'reference_style', 'commercial_opportunities']
    .some(key => Array.isArray(analysis?.[key]) && analysis[key].length > 0);
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

async function resolveRoleImages(urls, readImageAsDataUrl, signal, detail) {
  const results = [];
  for (const url of urls) {
    if (signal?.aborted) throw signal.reason || Object.assign(new Error('设计方向分析已取消'), { name: 'AbortError' });
    try {
      const dataUrl = await readImageAsDataUrl(url, { signal });
      if (dataUrl) results.push({ url: dataUrl, detail });
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
    const ratio = cleanString(ownValue(group, 'targetRatio', 'target_ratio', 'ratio'), 20);
    return count > 0 && key ? `${key}（${label}）×${count}，比例 ${ratio || '智能'}` : '';
  }).filter(Boolean).join('；') || '使用系统智能套图配置';
}

function commerceContextFor(input) {
  const supplied = ownValue(input, 'commerce_context', 'commerceContext');
  const context = isRecord(supplied) ? supplied : {};
  return normalizeCommerceContext({
    ...context,
    platform: ownValue(context, 'platform') || ownValue(input, 'platform'),
    contentType: ownValue(context, 'contentType', 'content_type') || ownValue(input, 'content_type', 'contentType'),
    targetLanguage: ownValue(context, 'targetLanguage', 'target_language') || ownValue(input, 'target_language', 'targetLanguage'),
  });
}

function productFacts(input) {
  const commerceContext = commerceContextFor(input);
  const platform = commercePlatform(commerceContext.platform);
  const contentType = COMMERCE_CONTENT_TYPES.find(option => option.id === commerceContext.contentType) || COMMERCE_CONTENT_TYPES[0];
  const language = commerceLanguage(commerceContext.targetLanguage);
  const productParams = isRecord(ownValue(input, 'product_params', 'productParams'))
    ? ownValue(input, 'product_params', 'productParams')
    : {};
  const copywriting = isRecord(ownValue(input, 'copywriting')) ? ownValue(input, 'copywriting') : {};
  const skus = Array.isArray(ownValue(input, 'skus')) ? ownValue(input, 'skus') : [];
  return [
    `商品名称：${cleanString(ownValue(input, 'product_name', 'productName')) || '未指定'}`,
    `品类：${cleanString(ownValue(input, 'category')) || '其他'}`,
    `目标平台：${platform.label}`,
    `内容类型：${contentType.label}`,
    `目标语言：${language.label}`,
    commerceContext.targetLanguage === 'visual'
      ? '文字策略：纯视觉，不生成标题、卖点、参数文字或装饰性伪文字。'
      : `文字策略：所有面向消费者的文案必须使用 ${language.label}，不得混入其他语言或伪文字。`,
    `用户需求：${cleanString(ownValue(input, 'description', 'user_prompt', 'userPrompt')) || '生成一套专业电商视觉'}`,
    `材质：${cleanString(ownValue(productParams, 'material')) || '未确认'}`,
    `工艺：${cleanString(ownValue(productParams, 'craft')) || '未确认'}`,
    `尺寸：${cleanString(ownValue(productParams, 'size')) || '未确认'}`,
    `用户卖点：${cleanString(ownValue(copywriting, 'sellingPoints', 'selling_points')) || '未填写'}`,
    `用户策划补充：${cleanString(ownValue(copywriting, 'plan')) || '未填写'}`,
    `SKU：${skus.map(sku => (isRecord(sku)
      ? [ownValue(sku, 'color'), ownValue(sku, 'size'), ownValue(sku, 'capacity')]
        .map(value => cleanString(value)).filter(Boolean).join('/')
      : '')).filter(Boolean).join('、') || '未配置'}`,
  ].join('\n');
}

function buildVisionSystemPrompt() {
  return `你是电商商品事实与视觉参考分析师。只完成图片观察，不生成设计方案，不规划逐张交付物。

商品事实图用于确认当前商品的颜色、结构、比例、可见组件和可见状态；视觉参考图只提取构图、光线、色彩、场景和信息层级，不能把竞品、Logo、包装或结构当成当前商品事实。无法确认的尺寸、成分、认证、性能和内部结构必须列为不确定项。

只返回 JSON，不要 Markdown：
{
  "product_observations": ["可见或用户明确确认的事实，最多8条"],
  "product_uncertainties": ["不能从图片确认的内容，最多6条"],
  "reference_style": ["可迁移的视觉语言，最多8条"],
  "commercial_opportunities": ["基于可见事实可表达的购买机会，最多6条"]
}`;
}

function buildVisionUserPrompt(input, productCount, referenceCount) {
  const productEnd = productCount;
  const referenceStart = productCount + 1;
  const referenceEnd = productCount + referenceCount;
  return [
    productCount > 0
      ? `图片 1-${productEnd}：商品事实图，只用于识别当前商品。`
      : '没有商品事实图，只能依据用户明确文字，不得猜测商品外观。',
    referenceCount > 0
      ? `图片 ${referenceStart}-${referenceEnd}：视觉参考图，只借鉴视觉语言。`
      : '没有视觉参考图，请不要虚构参考风格。',
    productFacts(input),
  ].join('\n');
}

function buildPlannerSystemPrompt() {
  return `你是兼具电商策略、视觉设计、商品摄影和转化经验的创意总监。根据已整理的商品事实、视觉参考和用户需求，输出恰好一套最适合当前商品和平台的完整设计方向。这里只规划统一视觉规范；系统会依据权威套图配置补全每张图的职责和可编辑执行计划。

方案必须保留商品真实性，不得捏造性能、认证、材质或不可见结构。不要提供多个近似选项；直接做出最优判断，并严格执行输入中已经选定的“本次创意路线”。创意路线只改变商业叙事、场景、构图、镜头和信息策略，不能改变商品事实。

只返回 JSON，不要 Markdown：
{
  "directions": [{
    "id": "stable-id",
    "title": "4-10字方案名",
    "one_liner": "一句话说明如何卖货",
    "commercial_objective": "商业目标",
    "audience": "目标受众",
    "visual_tone": ["关键词1", "关键词2", "关键词3"],
    "visual_system": {
      "palette": ["#RRGGBB", "#RRGGBB", "#RRGGBB"],
      "lighting": "光线策略",
      "composition": "构图系统",
      "camera_language": "镜头语言",
      "background_language": "背景语言",
      "typography_intent": "版式意图",
      "information_density": "信息密度",
      "mood": "氛围",
      "copy_tone": "文案语气"
    },
    "product_strategy": {
      "hero_focus": "主视觉重点",
      "angle_plan": "安全变化角度的方法",
      "interaction_plan": "可确认的使用或组件状态",
      "scenario_plan": "真实场景",
      "reference_adaptation": "借鉴参考但不复制竞品的方法"
    },
    "consistency_locks": ["整套必须保持的规则"],
    "prohibited_styles": ["不允许的表达"],
    "risk_guards": ["事实与参考图边界"],
    "execution_guide": "可编辑的整套执行说明",
    "preview_colors": ["#RRGGBB", "#RRGGBB", "#RRGGBB"]
  }]
}`;
}

function buildPlannerUserPrompt(input, analysis, creativeRoute) {
  const analysisSummary = analysis.status === 'complete'
    ? JSON.stringify({
      product_observations: analysis.product_observations,
      product_uncertainties: analysis.product_uncertainties,
      reference_style: analysis.reference_style,
      commercial_opportunities: analysis.commercial_opportunities,
    })
    : '视觉分析暂不可用。仅依据以下用户明确文字规划，不得猜测商品外观或性能。';
  return [
    productFacts(input),
    `视觉分析：${analysisSummary}`,
    `本次创意路线：${JSON.stringify({
      attempt_id: creativeRoute.attemptId,
      route: creativeRoute.route,
      rationale: creativeRoute.rationale,
      difference_from_recent: creativeRoute.difference,
    })}`,
    `权威套图配置：${requestedSuiteSummary(ownValue(input, 'requested_images', 'requestedImages'))}`,
    '请输出恰好一套最优方向。方案名、商业目标、场景、构图、镜头和证明方法必须体现本次创意路线，并明确结合商品观察、参考图特征和用户需求。不要输出 deliverables 或逐张图片清单。',
  ].join('\n');
}

function recentCreativeRoutes(input) {
  const value = ownValue(input, 'recent_creative_routes', 'recentCreativeRoutes');
  return Array.isArray(value) ? value.filter(item => isRecord(item)).slice(0, 6) : [];
}

function bindCreativeRoute(direction, selection) {
  const route = selection.route;
  const deliverables = Array.isArray(direction.deliverables)
    ? direction.deliverables.map(group => ({
      ...group,
      shots: Array.isArray(group.shots) ? group.shots.map(shot => ({
        ...shot,
        visual_execution: [shot.visual_execution, `本次路线执行：${route.proofStrategy}；${route.composition}；${route.cameraLanguage}。`]
          .filter(Boolean).join(' '),
        route_fingerprint: selection.fingerprint,
      })) : [],
    }))
    : [];
  return {
    ...direction,
    creative_attempt_id: selection.attemptId,
    creative_route: route,
    route_fingerprint: selection.fingerprint,
    route_rationale: selection.rationale,
    route_difference: selection.difference,
    one_liner: route.sellingThesis || direction.one_liner,
    visual_system: {
      ...(isRecord(direction.visual_system) ? direction.visual_system : {}),
      composition: route.composition,
      camera_language: route.cameraLanguage,
      lighting: route.lightingIntent,
      information_density: route.informationHierarchy,
    },
    product_strategy: {
      ...(isRecord(direction.product_strategy) ? direction.product_strategy : {}),
      scenario_plan: route.sceneFamily,
      hero_focus: route.sellingThesis,
      reference_adaptation: `${route.proofStrategy}；只迁移参考图的视觉语言，不复制竞品主体。`,
    },
    execution_guide: `${selection.rationale}${selection.difference ? ` 与上一方案的主要变化：${selection.difference}。` : ''} ${direction.execution_guide || ''}`.trim(),
    deliverables,
  };
}

function isCancelled(error, signal) {
  return Boolean(signal?.aborted || error?.name === 'AbortError' || error?.code === 'VISUAL_ANALYSIS_ABORTED');
}

function plannerHasOneUsableDirection(value) {
  return Array.isArray(value)
    && value.length === 1
    && value.every(direction => direction
      && typeof direction === 'object'
      && !Array.isArray(direction)
      && cleanString(ownValue(direction, 'title'))
      && cleanString(ownValue(direction, 'one_liner'))
      && cleanString(ownValue(direction, 'commercial_objective'))
      && cleanString(ownValue(direction, 'audience')));
}

function fallbackDirectionsAreComplete(value) {
  return Array.isArray(value)
    && value.length === 1
    && value.every(direction => direction
      && cleanString(direction.title)
      && cleanString(direction.one_liner)
      && Array.isArray(direction.deliverables)
      && direction.deliverables.length > 0
      && direction.deliverables.every(group => Array.isArray(group.shots) && group.shots.length === group.count));
}

export function createDesignDirectionService({ readImageAsDataUrl, completeText } = {}) {
  if (typeof readImageAsDataUrl !== 'function') throw new TypeError('readImageAsDataUrl is required');
  if (typeof completeText !== 'function') throw new TypeError('completeText is required');

  return {
    async generate(input = {}, { signal } = {}) {
      const commerceContext = commerceContextFor(input);
      const productName = cleanString(ownValue(input, 'product_name', 'productName'));
      const description = cleanString(ownValue(input, 'description', 'user_prompt', 'userPrompt'));
      const productUrls = normalizeImageUrls(ownValue(input, 'real_shots', 'realShots'));
      const referenceUrls = normalizeImageUrls(ownValue(input, 'ref_shots', 'refShots'));
      if (!productName && !description && productUrls.length === 0) {
        throw Object.assign(new Error('请至少填写产品名称或上传产品图'), { status: 400 });
      }

      const [productImages, referenceImages] = await Promise.all([
        resolveRoleImages(productUrls, readImageAsDataUrl, signal, 'auto'),
        resolveRoleImages(referenceUrls, readImageAsDataUrl, signal, 'auto'),
      ]);
      const images = [...productImages, ...referenceImages];
      let analysis = sanitizeAnalysis(null, 'fallback');
      let visualComplete = images.length === 0;
      let visualFailureReason = images.length > 0 ? 'VISUAL_ANALYSIS_UNAVAILABLE' : '';
      if (images.length > 0) {
        try {
          const response = await completeText({
            systemPrompt: buildVisionSystemPrompt(),
            userPrompt: buildVisionUserPrompt(input, productImages.length, referenceImages.length),
            images,
            signal,
            maxTokens: 900,
            temperature: 0.1,
          }, { stage: 'vision' });
          const parsed = parseModelJson(response);
          const candidate = sanitizeAnalysis(parsed, 'complete');
          if (parsed && analysisHasContent(candidate)) {
            analysis = candidate;
            visualComplete = true;
            visualFailureReason = '';
          } else {
            visualFailureReason = 'VISUAL_ANALYSIS_INVALID_RESPONSE';
          }
        } catch (error) {
          if (isCancelled(error, signal)) throw error;
          visualFailureReason = error?.code === 'VISUAL_ANALYSIS_TIMEOUT'
            ? 'VISUAL_ANALYSIS_TIMEOUT'
            : error?.code === 'VISUAL_ANALYSIS_UNAVAILABLE'
              ? 'VISUAL_ANALYSIS_UNAVAILABLE'
              : 'VISUAL_ANALYSIS_FAILED';
        }
      }

      let parsedPlan = null;
      let plannerFailureReason = '';
      const creativeAttemptId = cleanString(
        ownValue(input, 'creative_attempt_id', 'creativeAttemptId'),
        160,
      ) || createCreativeAttemptId();
      const creativeRoute = selectCreativeRoute({
        evidence: {
          productName,
          category: cleanString(ownValue(input, 'category')),
          platform: commerceContext.platform,
          userPrompt: description,
          productObservations: analysis.product_observations,
          referenceStyle: analysis.reference_style,
        },
        attemptId: creativeAttemptId,
        recentRoutes: recentCreativeRoutes(input),
      });
      try {
        const response = await completeText({
          systemPrompt: buildPlannerSystemPrompt(),
          userPrompt: buildPlannerUserPrompt(input, analysis, creativeRoute),
          images: [],
          signal,
          // The planner only returns a direction skeleton; deliverables are
          // deterministically expanded below. Keeping this compact avoids
          // spending the entire request deadline on verbose JSON.
          maxTokens: 1800,
          temperature: 0.48,
        }, { stage: 'planner' });
        parsedPlan = parseModelJson(response);
        if (!parsedPlan) plannerFailureReason = 'PLANNER_INVALID_RESPONSE';
      } catch (error) {
        if (isCancelled(error, signal)) throw error;
        plannerFailureReason = error?.code === 'VISUAL_ANALYSIS_TIMEOUT'
          ? 'PLANNER_TIMEOUT'
          : 'PLANNER_FAILED';
      }

      const requestedImages = ownValue(input, 'requested_images', 'requestedImages');
      const directions = normalizeCreativeDirectionPlans(parsedPlan?.directions, {
        requestedImages,
        productName,
        category: cleanString(ownValue(input, 'category')),
        platform: commerceContext.platform,
        userPrompt: description,
        visualObservations: analysis.product_observations,
        productUncertainties: analysis.product_uncertainties,
        referenceStyle: analysis.reference_style,
        sourceViewCount: productImages.length,
      }).map(direction => ({
        ...bindCreativeRoute(direction, creativeRoute),
        commerce_context: { ...commerceContext },
      }));
      const plannerComplete = plannerHasOneUsableDirection(parsedPlan?.directions);
      // A completed visual pass plus the local complete plan is a usable
      // product result even when the optional text planner times out. Do not
      // expose a paid-looking failure for a request that already has a safe,
      // complete set of directions; invalid model JSON remains degraded.
      const plannerFallback = !plannerComplete
        && plannerFailureReason === 'PLANNER_TIMEOUT'
        && visualComplete
        && fallbackDirectionsAreComplete(directions);
      const effectivePlannerComplete = plannerComplete || plannerFallback;

      return {
        directions,
        analysis,
        creativeRoute,
        commerceContext,
        planner_fallback: plannerFallback,
        degraded: (images.length > 0 && !visualComplete) || !effectivePlannerComplete,
        degradedReasons: [
          ...(visualComplete || images.length === 0 ? [] : [visualFailureReason]),
          ...(effectivePlannerComplete ? [] : [plannerFailureReason || 'PLANNER_INVALID_RESPONSE']),
        ],
      };
    },
  };
}
