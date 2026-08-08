const HIGH_RISK_PURPOSE = /explod|disassembl|internal|拆解|爆炸|内部结构/i;
const OPEN_STATE_FACT = /open|opened|removable|detachable|remove|lid|cover|打开|开启|可拆|拆卸|盖/i;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = cleanString(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function confirmedFactEntries(productTruth) {
  const facts = isRecord(productTruth?.confirmedFacts) ? productTruth.confirmedFacts : {};
  return Object.entries(facts).flatMap(([name, fact]) => {
    const value = cleanString(isRecord(fact) ? fact.value : fact);
    const source = cleanString(isRecord(fact) ? fact.source : '');
    return value && ['user', 'ocr'].includes(source) ? [{ name, value, source }] : [];
  });
}

function normalizedAzimuth(value) {
  let result = value;
  while (result > 75) result -= 140;
  while (result < -75) result += 140;
  return result;
}

function cameraFor(type, itemIndex) {
  const base = {
    identity: { elevation: 8, azimuth: 12, distance: 'medium', lensIntent: 'natural product hero' },
    feature: { elevation: 12, azimuth: -28, distance: 'medium-close', lensIntent: 'feature-led commercial view' },
    usage_scale: { elevation: 5, azimuth: 34, distance: 'environmental', lensIntent: 'credible use and scale' },
    alternate_angle: { elevation: 18, azimuth: 48, distance: 'medium', lensIntent: 'structural alternate view' },
    open_state: { elevation: 22, azimuth: -42, distance: 'medium-close', lensIntent: 'visible interaction state' },
    material_macro: { elevation: 16, azimuth: 24, distance: 'macro', lensIntent: 'surface and craftsmanship evidence' },
    component_relationship: { elevation: 24, azimuth: -36, distance: 'medium-close', lensIntent: 'visible component relationship' },
    exploded_view: { elevation: 20, azimuth: 30, distance: 'medium', lensIntent: 'confirmed component assembly' },
    packaging: { elevation: 7, azimuth: -12, distance: 'medium', lensIntent: 'packaging identity and protection' },
  }[type] || { elevation: 10, azimuth: 0, distance: 'medium', lensIntent: 'faithful product view' };
  const offset = ((Math.max(0, itemIndex) * 29) % 61) - 30;
  return { ...base, azimuth: normalizedAzimuth(base.azimuth + offset) };
}

function targetViewFor(type, camera) {
  const family = {
    identity: 'canonical identity view',
    feature: 'feature-led three-quarter view',
    usage_scale: 'eye-level contextual view',
    alternate_angle: 'opposite exterior three-quarter view',
    open_state: 'interaction-state view',
    material_macro: 'material detail view',
    component_relationship: 'component relationship view',
    exploded_view: 'confirmed assembly view',
    packaging: 'packaging identity view',
  }[type] || 'faithful product view';
  return `${family}; elevation ${camera.elevation} degrees, azimuth ${camera.azimuth} degrees, ${camera.distance}`;
}

function requiresFairComparison(item) {
  const role = cleanString(item?.role).toLowerCase();
  const purpose = cleanString(item?.purpose).toLowerCase();
  return /(?:^|_)scale(?:_|$)|comparison/.test(role)
    || /comparison|compare|尺寸|大小|对比/.test(purpose);
}

function fairComparisonContract() {
  return {
    enabled: true,
    orientation: 'upright front-facing neutral view',
    projection: 'same orthographic-like projection',
    baseline: 'same ground plane and eye-level camera',
    scalePolicy: 'Use confirmed dimensions when available; otherwise show an explicitly relative comparison without numerical size claims or perspective distortion.',
    forbiddenMismatch: 'Never compare a three-quarter product view against front-facing objects, mix camera elevations, or enlarge one object through perspective.',
  };
}

function intentFor(item, roleIndex) {
  const role = cleanString(item?.role).toLowerCase();
  const subrole = role.replace(/^detail_slice_/, '');
  const purpose = cleanString(item?.purpose);
  if (HIGH_RISK_PURPOSE.test(purpose)) return 'exploded_view';
  if (role === 'white_background' || role === 'transparent' || role === 'sku') return 'identity';
  if (['main', 'main_text', 'main_3x4'].includes(role)) {
    return ['identity', 'feature', 'usage_scale', 'alternate_angle', 'material_macro'][roleIndex % 5];
  }
  if (/structure|component/.test(subrole)) return 'component_relationship';
  if (/material|texture|craft/.test(subrole)) return 'material_macro';
  if (/usage|scene|serving|fit|scale|compatib/.test(subrole)) return 'usage_scale';
  if (/package/.test(subrole)) return 'packaging';
  if (/parameter|size|shade/.test(subrole)) return 'alternate_angle';
  return 'feature';
}

function labelFor(item, type, roleIndex) {
  const role = cleanString(item?.role).toLowerCase();
  if (role === 'white_background') return '白底首图';
  if (role === 'transparent') return '透明商品素材';
  if (role === 'sku') return 'SKU 规格图';
  if (['main', 'main_text', 'main_3x4'].includes(role)) {
    return ['商品识别主图', '核心卖点主图', '使用场景主图', '结构角度主图', '材质质感主图'][roleIndex % 5];
  }
  const labels = {
    material_macro: '材质细节图',
    usage_scale: '使用场景图',
    packaging: '包装展示图',
    component_relationship: '结构关系图',
    alternate_angle: '规格角度图',
    feature: '核心卖点详情图',
    exploded_view: '结构拆解图',
    open_state: '开启状态图',
  };
  return labels[type] || '商品详情图';
}

function cropFor(type) {
  if (type === 'material_macro') return 'tight evidence crop';
  if (type === 'usage_scale') return 'environmental medium-wide crop';
  if (type === 'component_relationship' || type === 'open_state' || type === 'exploded_view') return 'complete component-safe crop';
  if (type === 'feature') return 'medium feature crop';
  return 'complete product crop';
}

function interactionFor(type) {
  if (type === 'usage_scale') return 'credible in-use context';
  if (type === 'open_state') return 'confirmed open state';
  if (type === 'component_relationship') return 'confirmed visible component relationship';
  if (type === 'exploded_view') return 'exploded';
  return 'stationary';
}

function sceneFamilyFor(type, role) {
  if (role === 'white_background') return 'white_background_catalog';
  if (role === 'transparent') return 'transparent_design_asset';
  if (role === 'sku') return 'sku_variant_catalog';
  return {
    identity: 'studio_identity',
    feature: 'feature_demonstration',
    usage_scale: 'lifestyle_context',
    alternate_angle: 'exterior_angle_study',
    open_state: 'confirmed_interaction_state',
    material_macro: 'material_evidence',
    component_relationship: 'component_evidence',
    exploded_view: 'confirmed_structure_evidence',
    packaging: 'packaging_context',
  }[type] || 'evidence_safe_product_scene';
}

export function directShot(item = {}, context = {}) {
  const productTruth = isRecord(context.productTruth) ? context.productTruth : {};
  const itemIndex = Number.isSafeInteger(context.itemIndex) ? context.itemIndex : 0;
  const roleIndex = Number.isSafeInteger(context.roleIndex) ? context.roleIndex : itemIndex;
  const components = uniqueStrings(productTruth.components);
  const facts = confirmedFactEntries(productTruth);
  const sourceViews = uniqueStrings(productTruth.sourceAssetIds);
  const hasOpenEvidence = facts.some(({ name, value }) => OPEN_STATE_FACT.test(`${name} ${value}`));
  const hasComponentEvidence = components.length >= 2 && sourceViews.length >= 2;
  const requestedType = intentFor(item, roleIndex);
  const requiresConfirmedInternals = requestedType === 'exploded_view';
  const requiresComponentEvidence = ['component_relationship', 'open_state'].includes(requestedType);
  const evidenceSatisfied = requiresConfirmedInternals
    ? hasComponentEvidence && hasOpenEvidence
    : requiresComponentEvidence ? hasComponentEvidence || hasOpenEvidence : true;
  const type = evidenceSatisfied
    ? requestedType
    : requestedType === 'component_relationship' && hasOpenEvidence
      ? 'open_state'
      : 'alternate_angle';
  const evidenceTier = requiresConfirmedInternals
    ? 'confirmed_only'
    : requiresComponentEvidence ? 'conditional' : 'safe';
  const fallbackIntent = evidenceSatisfied ? null : {
    type,
    reason: 'Visible or confirmed evidence is insufficient for the requested internal or component state.',
  };
  const visibleIdentity = uniqueStrings([
    ...components,
    ...uniqueStrings(productTruth.primaryColors),
    ...uniqueStrings(productTruth.materials),
  ]).slice(0, 8);
  const truthMutations = uniqueStrings(productTruth.forbiddenMutations);
  const role = cleanString(item?.role).toLowerCase();
  const comparisonContract = requiresFairComparison(item) ? fairComparisonContract() : null;
  const plannedCamera = cameraFor(type, itemIndex);
  const camera = comparisonContract
    ? { ...plannedCamera, elevation: 0, azimuth: 0, distance: 'medium', lensIntent: 'fair scale comparison' }
    : plannedCamera;
  const catalogIsolation = ['white_background', 'transparent', 'sku'].includes(role);
  const targetView = targetViewFor(type, camera);
  const viewSynthesis = catalogIsolation ? null : {
    sourceViewCount: sourceViews.length,
    mode: sourceViews.length > 1 ? 'multi_view_grounded' : 'single_view_conservative',
    targetView,
    inferencePolicy: sourceViews.length > 1
      ? 'Use all authoritative product views to realize the assigned target viewpoint without changing identity.'
      : 'Synthesize only a conservative camera change around the complete visible exterior; keep ambiguous hidden details unfeatured and unchanged.',
    suiteRule: 'Treat the uploaded view as identity evidence, not as a camera angle that every suite image must repeat.',
  };

  return {
    type,
    requestedType,
    label: labelFor(item, type, roleIndex),
    camera,
    productOrientation: catalogIsolation
      ? 'preserve the authoritative product orientation and geometry'
      : `Reorient the complete product to the target camera and target viewpoint (${targetView}) while preserving exact geometry, proportions, part count, labels, colors, and product identity.`,
    ...(viewSynthesis ? { viewSynthesis } : {}),
    ...(comparisonContract ? { comparisonContract } : {}),
    interactionState: interactionFor(type),
    sceneFamily: sceneFamilyFor(type, role),
    crop: cropFor(type),
    scaleInFrame: type === 'usage_scale' ? '45-65%' : type === 'material_macro' ? '70-90%' : '65-82%',
    requiredVisibleFeatures: visibleIdentity,
    evidenceTier,
    allowedInferences: [
      'camera position, crop, lighting, and evidence-safe scene context',
      'audience-appropriate human presence only when the product category supports use',
    ],
    forbiddenMutations: uniqueStrings([
      ...truthMutations,
      'Do not change product silhouette, part count, colors, labels, controls, openings, or proportions.',
      'Do not invent internal structures, hidden components, accessories, functions, or engineering relationships.',
    ]),
    fallbackIntent,
  };
}
