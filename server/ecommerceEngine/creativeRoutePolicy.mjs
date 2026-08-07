import crypto from 'node:crypto';

const ROUTE_DIMENSIONS = Object.freeze([
  'sellingThesis',
  'sceneFamily',
  'composition',
  'cameraLanguage',
  'informationHierarchy',
  'proofStrategy',
  'paletteIntent',
  'lightingIntent',
]);

const ROUTE_LIBRARY = Object.freeze([
  Object.freeze({
    id: 'proof-first-studio',
    sellingThesis: '可信商品证据优先',
    sceneFamily: '克制棚拍与细节证据',
    composition: '主体居中加局部证据窗口',
    cameraLanguage: '平视主镜头配微距细节',
    informationHierarchy: '商品识别-结构证据-购买结论',
    proofStrategy: '用可见结构和规格对照完成说服',
    paletteIntent: '中性色基底加一个商品呼应色',
    lightingIntent: '中性柔光突出真实材质',
  }),
  Object.freeze({
    id: 'mobile-scenario-flow',
    sellingThesis: '使用收益与移动端代入',
    sceneFamily: '连续生活方式场景',
    composition: '竖向动线与上下景别切换',
    cameraLanguage: '环境中景配手部交互近景',
    informationHierarchy: '场景痛点-使用动作-收益证明',
    proofStrategy: '通过真实使用动作展示价值',
    paletteIntent: '自然环境色配清晰功能强调色',
    lightingIntent: '方向明确的自然窗光',
  }),
  Object.freeze({
    id: 'spec-comparison-grid',
    sellingThesis: '规格差异与决策效率',
    sceneFamily: '统一背景的规格对照',
    composition: '模块网格与等尺度对比',
    cameraLanguage: '一致机位配局部放大',
    informationHierarchy: '共同点-差异项-适用人群',
    proofStrategy: '并列呈现已确认尺寸材质和规格',
    paletteIntent: '低饱和基底配规格识别色',
    lightingIntent: '均匀无偏色的对照光',
  }),
  Object.freeze({
    id: 'hero-editorial-depth',
    sellingThesis: '视觉记忆与品质感',
    sceneFamily: '编辑式主视觉空间',
    composition: '大主体偏置配深度层次',
    cameraLanguage: '低机位英雄镜头配轮廓特写',
    informationHierarchy: '视觉记忆-材质质感-核心卖点',
    proofStrategy: '用真实轮廓和材质细节建立品质',
    paletteIntent: '品牌主色与互补点缀色',
    lightingIntent: '轮廓光配受控明暗层次',
  }),
  Object.freeze({
    id: 'problem-solution-story',
    sellingThesis: '问题解决与前后逻辑',
    sceneFamily: '痛点到解决方案的叙事场景',
    composition: '左右或上下因果对照',
    cameraLanguage: '情境全景配结果近景',
    informationHierarchy: '用户问题-商品介入-结果收益',
    proofStrategy: '只用可观察状态构建前后关系',
    paletteIntent: '问题区中性化与结果区清晰提亮',
    lightingIntent: '结果区域更通透但保持真实',
  }),
  Object.freeze({
    id: 'detail-craft-journey',
    sellingThesis: '材质工艺与细节可信度',
    sceneFamily: '微距细节探索',
    composition: '局部特写串联完整主体',
    cameraLanguage: '微距纹理配标准产品视角',
    informationHierarchy: '完整识别-细节发现-工艺结论',
    proofStrategy: '逐项放大可见材质结构和接口',
    paletteIntent: '贴近商品本色的低干扰环境',
    lightingIntent: '掠射光表现纹理与边缘',
  }),
]);

function clean(value, max = 240) {
  return String(value || '').trim().slice(0, max);
}

function normalizedEvidence(evidence = {}) {
  return [
    clean(evidence.productName),
    clean(evidence.category),
    clean(evidence.platform),
    clean(evidence.userPrompt, 1000),
    ...(Array.isArray(evidence.productObservations) ? evidence.productObservations.map(value => clean(value)) : []),
    ...(Array.isArray(evidence.referenceStyle) ? evidence.referenceStyle.map(value => clean(value)) : []),
  ].filter(Boolean).join('|');
}

function stableIndex(value, length) {
  const digest = crypto.createHash('sha256').update(value).digest();
  return digest.readUInt32BE(0) % Math.max(1, length);
}

function routeWithContext(base, evidence) {
  const productName = clean(evidence?.productName) || '当前商品';
  const prompt = clean(evidence?.userPrompt, 160) || '电商转化';
  return {
    ...base,
    title: `${productName}·${base.sellingThesis}`,
    rationale: `本次围绕${productName}的“${prompt}”选择${base.sceneFamily}，以${base.proofStrategy}，避免只更换装饰词。`,
  };
}

export function createCreativeAttemptId(randomUUID = crypto.randomUUID) {
  return `ec-route-${randomUUID()}`;
}

export function creativeRouteFingerprint(route = {}) {
  const payload = ROUTE_DIMENSIONS.map(key => clean(route?.[key]).toLowerCase()).join('|');
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 24);
}

export function creativeRouteSimilarity(left = {}, right = {}) {
  const matches = ROUTE_DIMENSIONS.reduce((count, key) => (
    clean(left?.[key]).toLowerCase() === clean(right?.[key]).toLowerCase() ? count + 1 : count
  ), 0);
  return matches / ROUTE_DIMENSIONS.length;
}

export function selectCreativeRoute({ evidence = {}, attemptId = '', recentRoutes = [] } = {}) {
  const identity = clean(attemptId) || createCreativeAttemptId();
  const start = stableIndex(`${identity}|${normalizedEvidence(evidence)}`, ROUTE_LIBRARY.length);
  const recent = (Array.isArray(recentRoutes) ? recentRoutes : []).filter(Boolean);
  let selected = ROUTE_LIBRARY[start];
  for (let offset = 0; offset < ROUTE_LIBRARY.length; offset += 1) {
    const candidate = ROUTE_LIBRARY[(start + offset) % ROUTE_LIBRARY.length];
    if (recent.every(route => creativeRouteSimilarity(candidate, route) < 0.75)) {
      selected = candidate;
      break;
    }
  }
  const route = routeWithContext(selected, evidence);
  const previous = recent[0];
  const difference = previous
    ? ROUTE_DIMENSIONS.filter(key => clean(previous?.[key]) !== clean(route[key]))
      .map(key => `${key}:${route[key]}`).join('；')
    : '';
  return {
    attemptId: identity,
    route,
    fingerprint: creativeRouteFingerprint(route),
    rationale: route.rationale,
    difference,
    evidence,
  };
}

export { ROUTE_DIMENSIONS };
