const PLAN_FIELDS = Object.freeze([
  { key: 'visualDirection', label: '视觉方向', source: 'visual' },
  { key: 'productStrategy', label: '商品策略', source: 'strategy' },
  { key: 'audience', label: '目标人群', source: 'direction' },
  { key: 'composition', label: '构图与光线', source: 'visual' },
  { key: 'copyRules', label: '文案规则', source: 'visual' },
  { key: 'qualityRisks', label: '一致性与风险', source: 'direction' },
]);

export { PLAN_FIELDS as CANVAS_SUITE_PLAN_FIELDS };

export const CANVAS_SUITE_SHOT_FIELDS = Object.freeze([
  { key: 'objective', label: '设计目标', aliases: ['purpose', 'objective', 'design_goal', 'designGoal'] },
  { key: 'visualStyle', label: '视觉风格', aliases: ['visual_style', 'visualStyle', 'style'] },
  { key: 'scene', label: '场景与氛围', aliases: ['scene', 'scenario', 'scene_plan', 'scenario_plan'] },
  { key: 'productFocus', label: '商品还原', aliases: ['product_focus', 'productFocus', 'product_fidelity', 'productFidelity'] },
  { key: 'composition', label: '构图与镜头', aliases: ['composition', 'layout', 'camera'] },
  { key: 'contentElements', label: '画面元素', aliases: ['content_elements', 'contentElements', 'content', 'elements'] },
  { key: 'copy', label: '文案与信息', aliases: ['copy', 'copywriting', 'text', 'copy_content'] },
  { key: 'negativeConstraints', label: '生成约束', aliases: ['negative_constraints', 'negativeConstraints', 'constraints', 'prohibited'] },
]);

function text(value, fallback = '') {
  if (Array.isArray(value)) return value.filter(Boolean).join('；').trim() || fallback;
  return String(value ?? '').trim() || fallback;
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function firstText(...values) {
  for (const value of values) {
    const next = text(value);
    if (next) return next;
  }
  return '';
}

function analysisFor(direction) {
  return record(direction.analysis || direction.visualAnalysis || direction.visual_analysis);
}

function evidenceFor(direction) {
  const analysis = analysisFor(direction);
  const observations = Array.isArray(direction.productObservations)
    ? direction.productObservations
    : Array.isArray(analysis.product_observations)
      ? analysis.product_observations
      : [];
  const uncertainties = Array.isArray(direction.productUncertainties)
    ? direction.productUncertainties
    : Array.isArray(analysis.product_uncertainties)
      ? analysis.product_uncertainties
      : [];
  const referenceStyle = Array.isArray(direction.referenceStyle)
    ? direction.referenceStyle
    : Array.isArray(analysis.reference_style)
      ? analysis.reference_style
      : [];
  return {
    observations: observations.filter(Boolean).slice(0, 6),
    uncertainties: uncertainties.filter(Boolean).slice(0, 5),
    referenceStyle: referenceStyle.filter(Boolean).slice(0, 6),
  };
}

function creativeProfileFor(direction) {
  const profile = record(direction.product_creative_profile || direction.productCreativeProfile);
  return {
    id: firstText(profile.id, 'category-responsive'),
    label: firstText(profile.label, '商品品类适配'),
    typographyIntent: firstText(profile.typography_intent, profile.typographyIntent, '清晰、可读且符合商品定位的中文排版'),
    copyTone: firstText(profile.copy_tone, profile.copyTone, '用具体、可验证的商品价值表达'),
    sceneRule: firstText(profile.scene_rule, profile.sceneRule, '场景只服务于商品用途和购买动机'),
    visualMotif: firstText(profile.visual_motif, profile.visualMotif, '商品事实优先的商业视觉'),
  };
}

function productLabel(direction) {
  const evidence = evidenceFor(direction);
  return firstText(
    direction.productName,
    direction.product_name,
    direction.category,
    evidence.observations[0],
    '当前商品',
  );
}

function factAnchor(direction) {
  const evidence = evidenceFor(direction);
  return evidence.observations.length
    ? `识别基准：${evidence.observations.join('、')}。`
    : '识别基准：仅使用上传商品图和用户明确填写的事实，不补猜不可见信息。';
}

function defaultShotDetails({ direction, group, title, purpose, responsibility }) {
  const product = productLabel(direction);
  const evidence = evidenceFor(direction);
  const creativeProfile = creativeProfileFor(direction);
  const style = evidence.referenceStyle.length
    ? `沿用参考图可迁移的${evidence.referenceStyle.join('、')}，但不复制参考图中的商品、品牌或包装。`
    : '保持统一的商业摄影质感，光线、色彩和留白服务于商品识别。';
  const uncertainty = evidence.uncertainties.length
    ? `未确认项：${evidence.uncertainties.join('、')}，画面不得把它们写成确定事实。`
    : '未确认的尺寸、性能、认证和内部结构不作为画面事实。';
  const role = `${group}${title ? `·${title}` : ''}`;
  return {
    objective: firstText(purpose, `围绕${product}的${role}建立明确的商品沟通重点。`),
    visualStyle: `${style} 视觉母题：${creativeProfile.visualMotif}。`,
    scene: firstText(responsibility, `以${product}为画面唯一主角，${creativeProfile.sceneRule}。`),
    productFocus: `${factAnchor(direction)}商品外观、颜色、比例、组件关系和已确认文字保持一致。`,
    composition: '先保证商品主体完整可辨，再用景别、视角和留白建立信息层级；避免主体贴边或被装饰遮挡。',
    contentElements: `只安排与${product}核心用途相关的道具、动作或尺度参照；每张图只承担一个清晰重点。`,
    copy: `字体与版式：${creativeProfile.typographyIntent}。文案语气：${creativeProfile.copyTone}。仅使用用户明确提供或从商品图可读出的信息；短标题对应当前画面重点，不堆叠多个卖点。`,
    negativeConstraints: `${uncertainty} ${evidence.referenceStyle.length ? '参考图只借鉴视觉语言，不替换当前商品主体。' : ''}`.trim(),
  };
}

function detailsFromShot(shot, defaults) {
  return Object.fromEntries(CANVAS_SUITE_SHOT_FIELDS.map(field => [
    field.key,
    firstText(...field.aliases.map(alias => shot[alias]), defaults[field.key]),
  ]));
}

function shotRows(direction) {
  const groups = Array.isArray(direction.deliverables)
    ? direction.deliverables
    : Array.isArray(direction.imagePlan)
      ? direction.imagePlan
      : Array.isArray(direction.image_plan)
        ? direction.image_plan
        : [];
  return groups.flatMap((value, groupIndex) => {
    const group = record(value);
    const role = text(group.role || group.key, `group-${groupIndex + 1}`);
    const groupLabel = firstText(group.label, group.name, '图片计划');
    const ratio = firstText(group.ratio, group.dimension, '1:1');
    const count = Math.max(1, Number(group.count) || (Array.isArray(group.shots) ? group.shots.length : 1));
    const shots = Array.isArray(group.shots) ? group.shots : [];
    return Array.from({ length: count }, (_, index) => {
      const shot = record(shots[index]);
      const title = firstText(shot.label, shot.title, shot.name, `${groupLabel} ${index + 1}`);
      const purpose = firstText(shot.purpose, shot.objective, shot.communication_goal, group.strategy, `围绕${productLabel(direction)}明确当前图片的展示重点`);
      const responsibility = firstText(shot.visual_execution, shot.visualExecution, shot.execution, shot.description, group.strategy, `以${productLabel(direction)}为主体完成${title}`);
      const defaults = defaultShotDetails({ direction, group: groupLabel, title, purpose, responsibility });
      return {
        id: `${role}-${index + 1}`,
        group: groupLabel,
        title,
      purpose,
      responsibility,
      dimension: ratio,
      differentiator: firstText(shot.variation_key, shot.variationKey, shot.purpose, title),
      ...detailsFromShot(shot, defaults),
      };
    });
  });
}

function normalizedShotRows(direction) {
  if (!Array.isArray(direction.shots)) return shotRows(direction);
  return direction.shots.map((shot, index) => {
    const value = record(shot);
    const group = firstText(value.group, '图片计划');
    const title = firstText(value.title, value.label, `图片 ${index + 1}`);
    const purpose = firstText(value.purpose, value.objective, '明确当前图片的展示重点');
    const responsibility = firstText(value.responsibility, value.visual_execution, '突出商品主体与当前图片的核心重点');
    const defaults = defaultShotDetails({ direction, group, title, purpose, responsibility });
    return {
      id: firstText(value.id, `shot-${index + 1}`),
      group,
      title,
      purpose,
      responsibility,
      dimension: firstText(value.dimension, value.ratio, '1:1'),
      differentiator: firstText(value.differentiator, value.variation_key, value.variationKey, purpose, title),
      ...detailsFromShot(value, defaults),
    };
  });
}

export function buildCanvasSuitePlan(input = {}, prompt = '') {
  const direction = record(input);
  const visual = record(direction.visual_system || direction.visualSystem);
  const strategy = record(direction.product_strategy || direction.productStrategy);
  const overall = record(direction.overall_spec || direction.overallSpec);
  const evidence = evidenceFor(direction);
  const creativeProfile = creativeProfileFor(direction);
  const consistency = Array.isArray(direction.consistency_locks || direction.consistencyLocks)
    ? (direction.consistency_locks || direction.consistencyLocks).join('；')
    : '';
  const riskGuards = Array.isArray(direction.risk_guards || direction.riskGuards)
    ? (direction.risk_guards || direction.riskGuards).join('；')
    : '';
  const visualDirection = firstText(
    direction.visualDirection,
    direction.visual_direction,
    visual.visual_style,
    visual.visualStyle,
    Array.isArray(direction.visual_tone) ? direction.visual_tone.join('、') : direction.visual_tone,
    direction.visual_tone,
    direction.one_liner,
    direction.title,
    '清晰、克制、突出商品本体的商业视觉',
  );
  const productStrategy = firstText(
    direction.productStrategy,
    strategy.summary,
    [strategy.hero_focus, strategy.scenario_plan, strategy.angle_plan].filter(Boolean),
    direction.commercial_objective,
  );
  const audience = firstText(direction.audience, direction.target_audience, '关注商品功能与使用价值的目标用户');
  const composition = firstText(
    direction.composition,
    visual.composition,
    [visual.lighting, visual.camera_language, visual.background_language].filter(Boolean),
    '主体优先，构图留白稳定，光线服务于材质和结构识别',
  );
  const copyRules = firstText(
    direction.copyRules,
    direction.copy_rules,
    visual.typography_intent,
    visual.copy_tone,
    direction.copy_tone,
    '短标题、单一卖点、信息层级清楚，不遮挡商品',
  );
  const qualityRisks = firstText(
    direction.qualityRisks,
    direction.quality_risks,
    overall.product_fidelity,
    consistency,
    riskGuards,
    evidence.uncertainties.length ? `未确认项：${evidence.uncertainties.join('、')}` : '',
    '保持商品外观、颜色、结构和品牌信息一致，避免参考图商品替换',
  );
  const brief = firstText(
    direction.brief,
    direction.execution_guide,
    direction.executionGuide,
    direction.description,
    direction.one_liner,
    prompt,
    `围绕${productLabel(direction)}的商品识别、核心卖点和真实使用场景，形成统一的整套视觉。${factAnchor(direction)}`,
  );
  return {
    id: firstText(direction.id, direction.direction_id, 'smart'),
    title: '整体设计方案',
    brief,
    visualDirection,
    productStrategy,
    audience,
    composition,
    copyRules,
    qualityRisks,
    productName: productLabel(direction),
    category: firstText(direction.category, direction.productCategory, '其他'),
    analysis: analysisFor(direction),
    evidence,
    creativeProfile,
    generationSpecification: {
      productEvidence: evidence.observations.length
        ? evidence.observations.join('；')
        : '仅使用上传商品图与用户明确填写的事实。',
      visualLanguage: firstText(visual.visual_style, visual.visualStyle, direction.visual_tone, direction.one_liner),
      typographyAndCopy: `${creativeProfile.typographyIntent}；${creativeProfile.copyTone}`,
      sceneLogic: firstText(strategy.scenario_plan, strategy.scenarioPlan, creativeProfile.sceneRule),
      fidelityLock: qualityRisks,
    },
    shots: normalizedShotRows(direction),
  };
}

export function updateCanvasSuitePlanField(plan = {}, key, value) {
  if (!PLAN_FIELDS.some(field => field.key === key)) return { ...plan };
  return { ...plan, [key]: text(value).slice(0, 1600) };
}

export function updateCanvasSuitePlanShot(plan = {}, shotId, value) {
  const id = String(shotId || '');
  if (!id) return { ...plan };
  const patch = typeof value === 'string' ? { responsibility: value, scene: value } : record(value);
  const allowed = new Set(['title', 'objective', 'visualStyle', 'scene', 'productFocus', 'composition', 'contentElements', 'copy', 'negativeConstraints', 'responsibility']);
  return {
    ...plan,
    shots: (Array.isArray(plan.shots) ? plan.shots : []).map(shot => shot.id === id
      ? {
          ...shot,
          ...Object.fromEntries(Object.entries(patch).filter(([key]) => allowed.has(key)).map(([key, next]) => [key, text(next).slice(0, 1600)])),
        }
      : shot),
  };
}

function compiledShotExecution(shot) {
  return [
    `设计目标：${shot.objective || shot.purpose}`,
    `视觉风格：${shot.visualStyle}`,
    `场景与氛围：${shot.scene || shot.responsibility}`,
    `商品还原：${shot.productFocus}`,
    `构图与镜头：${shot.composition}`,
    `画面元素：${shot.contentElements}`,
    `文案与信息：${shot.copy}`,
    `生成约束：${shot.negativeConstraints}`,
  ].filter((line) => !line.endsWith('：')).join('\n');
}

export function applyCanvasSuitePlanToDirection(plan = {}, direction = {}) {
  const source = record(direction);
  const shots = new Map((Array.isArray(plan.shots) ? plan.shots : []).map(shot => [shot.id, shot]));
  const deliverables = Array.isArray(source.deliverables)
    ? source.deliverables.map(group => {
      const role = text(group?.role || group?.key, 'group');
      return {
        ...group,
        shots: (Array.isArray(group.shots) ? group.shots : []).map((shot, index) => {
          const edited = shots.get(`${role}-${index + 1}`);
          return edited ? {
            ...shot,
            label: edited.title,
            purpose: edited.objective || edited.purpose,
            generationSpecification: {
              design_goal: edited.objective || edited.purpose,
              visual_style: edited.visualStyle,
              scene: edited.scene || edited.responsibility,
              product_focus: edited.productFocus,
              composition: edited.composition,
              content_elements: edited.contentElements,
              copy: edited.copy,
              negative_constraints: edited.negativeConstraints,
            },
            visual_execution: compiledShotExecution(edited),
            visualExecution: compiledShotExecution(edited),
          } : shot;
        }),
      };
    })
    : source.deliverables;
  return {
    ...source,
    title: plan.title || source.title,
    one_liner: plan.brief || source.one_liner,
    execution_guide: plan.brief || source.execution_guide,
    brief: plan.brief || source.brief,
    audience: plan.audience || source.audience,
    visual_system: {
      ...(record(source.visual_system)),
      visual_style: plan.visualDirection || source.visual_system?.visual_style,
      composition: plan.composition || source.visual_system?.composition,
      typography_intent: plan.copyRules || source.visual_system?.typography_intent,
    },
    product_strategy: {
      ...(record(source.product_strategy)),
      summary: plan.productStrategy || source.product_strategy?.summary,
    },
    risk_guards: plan.qualityRisks ? [plan.qualityRisks] : source.risk_guards,
    ...(deliverables ? { deliverables } : {}),
  };
}
