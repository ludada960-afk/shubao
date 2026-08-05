const PLAN_FIELDS = Object.freeze([
  { key: 'visualDirection', label: '视觉方向', source: 'visual' },
  { key: 'productStrategy', label: '商品策略', source: 'strategy' },
  { key: 'audience', label: '目标人群', source: 'direction' },
  { key: 'composition', label: '构图与光线', source: 'visual' },
  { key: 'copyRules', label: '文案规则', source: 'visual' },
  { key: 'qualityRisks', label: '一致性与风险', source: 'direction' },
]);

export { PLAN_FIELDS as CANVAS_SUITE_PLAN_FIELDS };

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
      return {
        id: `${role}-${index + 1}`,
        group: groupLabel,
        title: firstText(shot.label, shot.title, shot.name, `${groupLabel} ${index + 1}`),
        purpose: firstText(shot.purpose, shot.objective, group.strategy, '承担一张清晰、可执行的商品沟通画面'),
        responsibility: firstText(shot.visual_execution, shot.visualExecution, shot.execution, shot.description, group.strategy, '突出商品主体与核心卖点'),
        dimension: ratio,
      };
    });
  });
}

function normalizedShotRows(direction) {
  if (!Array.isArray(direction.shots)) return shotRows(direction);
  return direction.shots.map((shot, index) => {
    const value = record(shot);
    return {
      id: firstText(value.id, `shot-${index + 1}`),
      group: firstText(value.group, '图片计划'),
      title: firstText(value.title, `图片 ${index + 1}`),
      purpose: firstText(value.purpose, '承担一张清晰、可执行的商品沟通画面'),
      responsibility: firstText(value.responsibility, value.visual_execution, '突出商品主体与核心卖点'),
      dimension: firstText(value.dimension, '1:1'),
    };
  });
}

export function buildCanvasSuitePlan(input = {}, prompt = '') {
  const direction = record(input);
  const visual = record(direction.visual_system || direction.visualSystem);
  const strategy = record(direction.product_strategy || direction.productStrategy);
  const overall = record(direction.overall_spec || direction.overallSpec);
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
    direction.visual_tone,
    direction.visualTone,
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
    '保持商品外观、颜色、结构和品牌信息一致，避免参考图商品替换',
  );
  const brief = firstText(
    direction.brief,
    direction.execution_guide,
    direction.executionGuide,
    direction.description,
    direction.one_liner,
    prompt,
    '围绕商品识别、卖点表达和真实使用场景，形成统一的整套视觉',
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
    shots: normalizedShotRows(direction),
  };
}

export function updateCanvasSuitePlanField(plan = {}, key, value) {
  if (!PLAN_FIELDS.some(field => field.key === key)) return { ...plan };
  return { ...plan, [key]: text(value).slice(0, 1200) };
}

export function updateCanvasSuitePlanShot(plan = {}, shotId, value) {
  const id = String(shotId || '');
  if (!id) return { ...plan };
  return {
    ...plan,
    shots: (Array.isArray(plan.shots) ? plan.shots : []).map(shot => shot.id === id
      ? { ...shot, responsibility: text(value).slice(0, 600) }
      : shot),
  };
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
          return edited ? { ...shot, visual_execution: edited.responsibility } : shot;
        }),
      };
    })
    : source.deliverables;
  return {
    ...source,
    title: plan.title || source.title,
    one_liner: plan.brief || source.one_liner,
    execution_guide: plan.brief || source.execution_guide,
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
