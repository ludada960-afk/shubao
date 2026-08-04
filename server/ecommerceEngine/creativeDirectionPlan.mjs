const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DIRECTION_COUNT = 1;
const DEFAULT_REQUESTED_IMAGES = Object.freeze([
  { key: 'white_bg', label: '白底图', count: 1, ratio: '1:1' },
  { key: 'main_text', label: '商品主图', count: 3, ratio: '1:1' },
  { key: 'transparent', label: '透明素材', count: 1, ratio: '1:1' },
  { key: 'detail', label: '详情图', count: 5, ratio: '3:4' },
]);

const ROLE_ALIASES = Object.freeze({
  white_bg: 'white_background',
  white_background: 'white_background',
  main: 'main',
  main_text: 'main_text',
  main_3x4: 'main_3x4',
  transparent: 'transparent',
  transparent_material: 'transparent',
  sku: 'sku',
  detail: 'detail',
  detail_slices: 'detail',
});

const ARCHETYPES = Object.freeze([
  {
    id: 'instant-recognition',
    title: '先把商品卖点讲清楚',
    oneLiner: '先让买家看清是什么，再马上明白为什么值得买',
    objective: '提升首屏识别效率和核心卖点转化',
    audience: '快速比较商品、需要立即理解价值的高意向用户',
    visualTone: ['清晰', '克制', '高识别度'],
    palette: ['#F6F7F8', '#202124', '#2F6BFF'],
    lighting: '干净的商业棚拍光，轮廓清楚，材质真实',
    composition: '商品主体居中或三分构图，首屏信息层级明确并保留文案安全区',
    camera: '从最可信的商品主视角开始，再以安全的轻微角度变化补充识别',
    background: '简洁中性背景，使用低干扰结构强化商品轮廓',
    typography: '简短主标题配一条利益点，字号层级清晰',
    density: '低到中等信息密度',
    mood: '可靠、直接、专业',
    copyTone: '简洁、肯定、以用户收益为中心',
    heroFocus: '商品身份、核心结构与第一购买理由',
    anglePlan: '主视角建立识别，补充不改变结构的轻微侧视和局部证据',
    interactionPlan: '仅展示来源图片可证明的开合、握持或组合关系',
    scenarioPlan: '先以纯净商品视觉建立识别，再进入与核心用途直接相关的真实场景',
  },
  {
    id: 'lifestyle-benefit',
    title: '放进生活场景，更容易下单',
    oneLiner: '把商品放进买家熟悉的日常，让用途和好处一眼就懂',
    objective: '降低使用想象成本并强化场景购买动机',
    audience: '重视使用体验、希望快速判断商品是否适合自己的用户',
    visualTone: ['自然', '有温度', '生活化'],
    palette: ['#FFF7EA', '#3D342C', '#C97A40'],
    lighting: '自然窗光或柔和暖光，保留真实阴影和环境层次',
    composition: '商品与使用环境形成前中后景关系，并为利益文案留下自然空间',
    camera: '以接近人眼的场景视角为主，搭配使用尺度和动作关系',
    background: '与目标受众真实生活相关的环境，不使用无关装饰',
    typography: '场景利益标题搭配简短解释，文字与主体错位排布',
    density: '中等信息密度',
    mood: '亲和、松弛、可信',
    copyTone: '具体、自然、围绕实际使用结果',
    heroFocus: '商品如何进入日常以及核心功能带来的实际收益',
    anglePlan: '主视角保持商品识别，场景图通过远近和视线高度形成变化',
    interactionPlan: '使用手部、尺度参照或真实摆放关系表达用途，不虚构功能',
    scenarioPlan: '选择与商品品类和用户描述最相关的一至两个日常使用场景',
  },
  {
    id: 'craft-proof',
    title: '把材质和做工拍明白',
    oneLiner: '用看得见的细节证明商品品质，让买家买得更放心',
    objective: '提升用户对材质、做工和长期使用价值的信任',
    audience: '关注品质细节、结构可靠性和长期使用成本的理性用户',
    visualTone: ['精密', '可信', '质感'],
    palette: ['#F2F1EE', '#282A2D', '#8C7460'],
    lighting: '强调轮廓和材质变化的侧向商业光，避免过度镜面化',
    composition: '整体商品与局部证据交替，使用清晰的细节放大和信息对照',
    camera: '可信整体视角结合来源图片能够支持的材质微距与组件关系',
    background: '低饱和中性背景或轻量测试台语境，突出证据而非氛围',
    typography: '证据标题、短标签和必要参数分层呈现',
    density: '中等信息密度',
    mood: '严谨、稳定、高品质',
    copyTone: '证据化、克制，不使用无法证实的绝对承诺',
    heroFocus: '可见材质、工艺边缘、结构关系和真实商品细节',
    anglePlan: '整体识别图与细节镜头交替，未知内部结构不做拆解',
    interactionPlan: '只呈现已确认组件、可见开合或可证明的材质关系',
    scenarioPlan: '以品质检视和真实使用环境结合，避免空泛的实验室表演',
  },
  {
    id: 'editorial-distinction',
    title: '做出一套有记忆点的图',
    oneLiner: '统一颜色和画面气质，让商品在同类里更容易被记住',
    objective: '提升品牌辨识、视觉停留和同类商品中的差异感',
    audience: '重视设计感、品牌气质和社交分享价值的审美型用户',
    visualTone: ['设计感', '鲜明', '统一'],
    palette: ['#F7F3EC', '#1F2430', '#D95D45'],
    lighting: '具有明确方向性的编辑光线，同时保持商品颜色和材质真实',
    composition: '使用节奏化留白、比例对比和局部非对称建立系列感',
    camera: '主视角稳定，借助裁切、景别和安全角度变化形成编辑节奏',
    background: '从商品特征提炼几何、材质或色彩语言，不照搬参考图主体',
    typography: '有识别度但可读的版式系统，文案短而有节奏',
    density: '低到中等信息密度',
    mood: '现代、从容、有记忆点',
    copyTone: '有品牌态度但不牺牲商品信息清晰度',
    heroFocus: '商品独特轮廓、品牌气质和系列视觉识别',
    anglePlan: '用主视觉锚定商品身份，再通过裁切和景别变化形成套图节奏',
    interactionPlan: '把已确认功能转化为简洁视觉动作，不引入商品不存在的状态',
    scenarioPlan: '提炼一个与目标用户和品类匹配的编辑化场景作为全套视觉母题',
  },
]);

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

function cleanString(value, maxLength = 600) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const normalized = String(value).trim();
  if (!normalized || UNSAFE_KEYS.has(normalized.toLowerCase())) return '';
  return normalized.slice(0, maxLength);
}

function firstString(...values) {
  for (const value of values) {
    const normalized = cleanString(value);
    if (normalized) return normalized;
  }
  return '';
}

function uniqueStrings(value, { maxItems = 20, maxLength = 180 } = {}) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  const result = [];
  const seen = new Set();
  for (const item of values) {
    const normalized = cleanString(item, maxLength);
    const signature = normalized.toLowerCase();
    if (!normalized || seen.has(signature)) continue;
    seen.add(signature);
    result.push(normalized);
    if (result.length >= maxItems) break;
  }
  return result;
}

function normalizeColors(value) {
  return uniqueStrings(value, { maxItems: 6, maxLength: 12 })
    .map(color => color.toUpperCase())
    .filter(color => /^#[0-9A-F]{6}$/.test(color) || /^#[0-9A-F]{3}$/.test(color));
}

function canonicalRole(value) {
  const role = cleanString(value, 48).toLowerCase();
  return ROLE_ALIASES[role] || '';
}

function normalizeRequestedImages(value) {
  const source = Array.isArray(value) && value.length ? value : DEFAULT_REQUESTED_IMAGES;
  const result = [];
  const seen = new Set();
  for (const entry of source) {
    if (!isRecord(entry)) continue;
    const role = canonicalRole(ownValue(entry, 'key', 'role', 'id'));
    const countValue = Number(ownValue(entry, 'count'));
    const count = Number.isFinite(countValue) ? Math.max(0, Math.min(20, Math.trunc(countValue))) : 0;
    if (!role || count <= 0 || seen.has(role)) continue;
    seen.add(role);
    result.push({
      role,
      label: firstString(ownValue(entry, 'label', 'name'), defaultRoleLabel(role)),
      count,
      ratio: firstString(ownValue(entry, 'ratio'), defaultRoleRatio(role)),
    });
  }
  return result.length ? result : normalizeRequestedImages(DEFAULT_REQUESTED_IMAGES);
}

function defaultRoleLabel(role) {
  return {
    white_background: '白底图',
    main: '商品主图',
    main_text: '商品主图',
    main_3x4: '竖版主图',
    transparent: '透明素材',
    sku: 'SKU 图',
    detail: '详情图',
  }[role] || '商品图片';
}

function defaultRoleRatio(role) {
  return role === 'detail' || role === 'main_3x4' ? '3:4' : '1:1';
}

function shotTemplate(role, index, productName, context = {}) {
  const product = productName || '商品';
  const evidence = cleanString(context.visualObservations?.[0], 80);
  const evidenceTail = evidence ? `；重点放大${evidence}` : '';
  const templates = {
    white_background: [
      ['标准识别白底图', `完整准确地展示${product}的主体轮廓和真实颜色`, `正面白底拍清楚${product}的完整外形，用柔和棚拍光勾出轮廓和接触阴影，四周留出干净空间${evidenceTail}`, 'standard-isolation'],
      ['补充角度白底图', `从安全补充视角帮助用户理解${product}外形`, `换成轻微三分之四角度，让${product}的厚度、开合或边缘更容易看懂；光线保持一致，避免换角度后像是另一件商品`, 'alternate-isolation'],
    ],
    main: [
      ['商品识别主图', `在首屏建立${product}身份和最重要购买理由`, `把${product}放在画面中心，用正面偏低机位拍出轮廓和体量，旁边只留一句最容易懂的卖点，让买家第一眼认出商品`, 'identity-hero'],
      ['核心利益主图', `把${product}的核心功能转化为用户可理解的收益`, `用近景展示最关键的结构或使用动作，光影集中在卖点位置，画面只讲一个好处，不再重复上一张的构图`, 'benefit-hero'],
      ['使用场景主图', `展示${product}进入目标用户真实生活的方式`, `把${product}放进真实使用场景，用手部、餐桌或空间尺度说明它怎么用；背景有生活感但不抢商品，光线像自然拍摄`, 'scenario-hero'],
      ['品质证明主图', `用可见做工或材质细节建立${product}信任`, `用侧光擦过${product}的表面和边缘，安排一处清晰细节特写，让买家看见材质、做工或结构，而不是听一堆形容词`, 'proof-hero'],
      ['差异记忆主图', `强化${product}在同类商品中的视觉识别`, `提炼${product}最有辨识度的轮廓或颜色做一张更有节奏的构图，保持商品真实比例，用统一的色彩和留白收住整套风格`, 'distinctive-hero'],
    ],
    main_text: [],
    main_3x4: [],
    transparent: [
      ['透明商品素材', `提供可继续排版的${product}干净主体`, `去掉背景，只留下边缘干净的${product}主体；保留金属高光、透明件和自然阴影，方便后面放进不同场景`, 'transparent-cutout'],
      ['透明补充角度', `提供${product}的补充角度透明素材`, `换一个能看清厚度或结构的安全角度输出透明素材，商品大小和颜色跟上一张保持一致，方便做组合排版`, 'transparent-alternate'],
    ],
    sku: [
      ['SKU 规格识别图', `清楚区分${product}当前已确认规格`, `把已确认的颜色或规格并排摆清楚，统一机位和光线，让买家不用放大图片也能看出区别`, 'sku-identity'],
      ['SKU 对比补充图', `帮助用户比较${product}不同已确认选项`, `用整齐的对照构图展示不同选项，重点突出真实差异，不增加没有提供的颜色、数量或配件`, 'sku-comparison'],
    ],
    detail: [
      ['核心卖点详情图', `解释${product}最关键的购买理由`, `一张图只讲一个最重要的好处，用${product}的真实结构做证据，配一条短标题和一个清楚的视觉重点`, 'detail-core-benefit'],
      ['材质做工详情图', `展示${product}可见材质与做工细节`, `靠近拍${product}的表面、边缘或连接处，用侧光表现质感，整体图和局部特写放在同一页形成信任`, 'detail-material-proof'],
      ['结构与功能详情图', `说明${product}已确认结构如何服务使用`, `把已看见的组件关系画清楚，用局部放大或轻量引线说明它怎么帮助使用，不做看不见的内部拆解`, 'detail-structure'],
      ['真实使用详情图', `呈现${product}在目标场景中的使用方式`, `让一个真实动作带出${product}的使用方法，用自然窗光和生活尺度降低理解成本，商品始终是画面主角`, 'detail-usage'],
      ['尺寸适配详情图', `帮助用户判断${product}与空间或使用需求是否匹配`, `用手、桌面或常见物件建立${product}的大小关系；只有确认过的尺寸才写数字，避免让买家误判`, 'detail-scale'],
      ['清洁维护详情图', `说明${product}可确认的维护或收纳方式`, '只表达输入材料能够支持的步骤和可见状态', 'detail-care'],
      ['配件清单详情图', `核对${product}已确认的包装或配件组成`, '统一摆放已确认物件，不新增配件或数量', 'detail-package'],
      ['人群场景详情图', `连接${product}与目标受众的核心需求`, '使用符合目标用户的环境线索，不改变商品主体', 'detail-audience'],
      ['对比决策详情图', `突出${product}可验证的差异价值`, '只比较已确认事实，不贬低或复制竞品', 'detail-decision'],
      ['品牌收束详情图', `以统一视觉语言完成${product}套图收束`, '继承主视觉色彩、光线和版式，保留清晰行动空间', 'detail-closing'],
    ],
  };
  if (role === 'main_text' || role === 'main_3x4') return shotTemplate('main', index, productName);
  const roleTemplates = templates[role] || templates.main;
  const template = roleTemplates[index % roleTemplates.length];
  const round = Math.floor(index / roleTemplates.length);
  if (!round) return template;
  return [
    `${template[0]} ${index + 1}`,
    template[1],
    `${template[2]}，并采用与同组其他图片不同的景别或信息重点`,
    `${template[3]}-${index + 1}`,
  ];
}

function defaultDependencies(role) {
  if (role === 'white_background' || role === 'transparent' || role === 'sku') {
    return ['product_truth'];
  }
  if (role === 'detail') {
    return ['product_truth', 'campaign_bible', 'hero_visual_standard'];
  }
  return ['product_truth', 'campaign_bible'];
}

function normalizeShot(source, { role, index, archetype, productName, context }) {
  const shot = isRecord(source) ? source : {};
  const [label, purpose, visualExecution, variationKey] = shotTemplate(role, index, productName, context);
  return {
    index,
    label: firstString(ownValue(shot, 'label', 'title', 'name'), label),
    purpose: firstString(ownValue(shot, 'purpose', 'objective', 'communication_goal'), purpose),
    visual_execution: firstString(
      ownValue(shot, 'visual_execution', 'visualExecution', 'execution', 'description'),
      visualExecution,
    ),
    variation_key: firstString(
      ownValue(shot, 'variation_key', 'variationKey', 'variation'),
      variationKey,
    ).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || `shot-${index + 1}`,
    depends_on: uniqueStrings(
      ownValue(shot, 'depends_on', 'dependsOn'),
      { maxItems: 8, maxLength: 64 },
    ).length
      ? uniqueStrings(ownValue(shot, 'depends_on', 'dependsOn'), { maxItems: 8, maxLength: 64 })
      : defaultDependencies(role),
  };
}

function sourceDeliverableFor(direction, role) {
  const groups = ownValue(direction, 'deliverables', 'image_plan', 'imagePlan');
  if (!Array.isArray(groups)) return {};
  return groups.find(group => isRecord(group) && canonicalRole(ownValue(group, 'role', 'key', 'id')) === role) || {};
}

function normalizeDeliverables(direction, requestedImages, archetype, productName) {
  return requestedImages.map((requested) => {
    const source = sourceDeliverableFor(direction, requested.role);
    const sourceShots = Array.isArray(ownValue(source, 'shots', 'items')) ? ownValue(source, 'shots', 'items') : [];
    const shots = Array.from({ length: requested.count }, (_, index) => normalizeShot(sourceShots[index], {
      role: requested.role,
      index,
      archetype,
      productName,
      context: direction.__direction_context || {},
    }));
    const usedExecution = new Set();
    const uniqueShots = shots.map((shot, index) => {
      const signature = cleanString(shot.visual_execution, 600).toLowerCase();
      if (!usedExecution.has(signature)) {
        usedExecution.add(signature);
        return shot;
      }
      const fallback = shotTemplate(requested.role, index, productName, direction.__direction_context || {})[2];
      const fallbackSignature = cleanString(fallback, 600).toLowerCase();
      usedExecution.add(fallbackSignature);
      return { ...shot, visual_execution: fallback };
    });
    return {
      role: requested.role,
      label: requested.label,
      count: requested.count,
      ratio: requested.ratio,
      group_strategy: firstString(
        ownValue(source, 'group_strategy', 'groupStrategy', 'strategy'),
        `${requested.label}围绕“${archetype.objective}”展开，同组每张图使用不同职责和视觉变化。`,
      ),
      shots: uniqueShots,
    };
  });
}

function normalizeDirection(source, index, context) {
  const direction = isRecord(source) ? source : {};
  const archetype = ARCHETYPES[index % ARCHETYPES.length];
  const visualSource = isRecord(ownValue(direction, 'visual_system', 'visualSystem'))
    ? ownValue(direction, 'visual_system', 'visualSystem')
    : {};
  const strategySource = isRecord(ownValue(direction, 'product_strategy', 'productStrategy'))
    ? ownValue(direction, 'product_strategy', 'productStrategy')
    : {};
  const palette = normalizeColors(
    ownValue(visualSource, 'palette', 'colors')
      ?? ownValue(direction, 'preview_colors', 'previewColors', 'colors', 'palette'),
  );
  const title = firstString(ownValue(direction, 'title', 'name'), archetype.title);
  const executionGuide = firstString(
    ownValue(direction, 'execution_guide', 'executionGuide', 'editableBrief', 'editable_brief', 'description', 'brief'),
    `围绕“${archetype.objective}”建立统一主视觉。${archetype.heroFocus}；${archetype.scenarioPlan}。`,
  );

  return {
    schema_version: 1,
    id: firstString(ownValue(direction, 'id', 'direction_id', 'directionId'), archetype.id)
      .toLowerCase().replace(/\s+/g, '-'),
    title,
    one_liner: firstString(ownValue(direction, 'one_liner', 'oneLiner', 'tagline'), archetype.oneLiner),
    commercial_objective: firstString(
      ownValue(direction, 'commercial_objective', 'commercialObjective', 'objective'),
      archetype.objective,
    ),
    audience: firstString(ownValue(direction, 'audience', 'target_audience'), archetype.audience),
    visual_tone: uniqueStrings(
      ownValue(direction, 'visual_tone', 'visualTone', 'visual_keywords', 'visualKeywords', 'keywords'),
      { maxItems: 8, maxLength: 32 },
    ).length
      ? uniqueStrings(ownValue(direction, 'visual_tone', 'visualTone', 'visual_keywords', 'visualKeywords', 'keywords'), { maxItems: 8, maxLength: 32 })
      : [...archetype.visualTone],
    visual_system: {
      palette: palette.length ? [...palette] : [...archetype.palette],
      lighting: firstString(ownValue(visualSource, 'lighting'), ownValue(direction, 'lighting'), archetype.lighting),
      composition: firstString(ownValue(visualSource, 'composition'), ownValue(direction, 'composition'), archetype.composition),
      camera_language: firstString(
        ownValue(visualSource, 'camera_language', 'cameraLanguage'),
        ownValue(direction, 'camera_language', 'cameraLanguage'),
        archetype.camera,
      ),
      background_language: firstString(
        ownValue(visualSource, 'background_language', 'backgroundLanguage'),
        ownValue(direction, 'background_language', 'backgroundLanguage'),
        archetype.background,
      ),
      typography_intent: firstString(
        ownValue(visualSource, 'typography_intent', 'typographyIntent'),
        ownValue(direction, 'typography_intent', 'typographyIntent'),
        archetype.typography,
      ),
      information_density: firstString(
        ownValue(visualSource, 'information_density', 'informationDensity'),
        ownValue(direction, 'information_density', 'informationDensity'),
        archetype.density,
      ),
      mood: firstString(ownValue(visualSource, 'mood'), ownValue(direction, 'mood'), archetype.mood),
      copy_tone: firstString(
        ownValue(visualSource, 'copy_tone', 'copyTone'),
        ownValue(direction, 'copy_tone', 'copyTone'),
        archetype.copyTone,
      ),
    },
    product_strategy: {
      hero_focus: firstString(ownValue(strategySource, 'hero_focus', 'heroFocus'), archetype.heroFocus),
      angle_plan: firstString(ownValue(strategySource, 'angle_plan', 'anglePlan'), archetype.anglePlan),
      interaction_plan: firstString(ownValue(strategySource, 'interaction_plan', 'interactionPlan'), archetype.interactionPlan),
      scenario_plan: firstString(ownValue(strategySource, 'scenario_plan', 'scenarioPlan'), archetype.scenarioPlan),
      reference_adaptation: firstString(
        ownValue(strategySource, 'reference_adaptation', 'referenceAdaptation'),
        '只借鉴参考图的构图、光线、色彩和信息层级，不复制竞品主体、品牌标识或商品结构。',
      ),
    },
    // Keep the visual evidence available to the deterministic shot writer, but
    // never expose the internal analysis object as part of the user snapshot.
    deliverables: normalizeDeliverables({
      ...direction,
      __direction_context: {
        visualObservations: context.visualObservations,
        referenceStyle: context.referenceStyle,
      },
    }, context.requestedImages, archetype, context.productName),
    consistency_locks: uniqueStrings(
      ownValue(direction, 'consistency_locks', 'consistencyLocks'),
      { maxItems: 12, maxLength: 180 },
    ).length
      ? uniqueStrings(ownValue(direction, 'consistency_locks', 'consistencyLocks'), { maxItems: 12, maxLength: 180 })
      : [
        '商品外观、颜色、比例、结构和品牌标识保持一致',
        '整套图片继承同一主视觉色彩、光线和版式原则',
      ],
    prohibited_styles: uniqueStrings(
      ownValue(direction, 'prohibited_styles', 'prohibitedStyles'),
      { maxItems: 12, maxLength: 120 },
    ).length
      ? uniqueStrings(ownValue(direction, 'prohibited_styles', 'prohibitedStyles'), { maxItems: 12, maxLength: 120 })
      : ['无关装饰遮挡商品', '无法证实的功能或认证', '照搬参考图中的竞品商品或品牌'],
    risk_guards: uniqueStrings([
      '只使用用户输入和商品图能够确认的商品事实',
      '不复制参考图中的竞品主体、Logo、包装文字或独有设计',
      ...uniqueStrings(ownValue(direction, 'risk_guards', 'riskGuards'), { maxItems: 10, maxLength: 180 }),
    ], { maxItems: 12, maxLength: 180 }),
    execution_guide: executionGuide,
    preview_colors: palette.length ? [...palette] : [...archetype.palette],
    overall_spec: {
      locked: true,
      visual_style: uniqueStrings(
        ownValue(direction, 'visual_tone', 'visualTone', 'visual_keywords', 'visualKeywords', 'keywords'),
        { maxItems: 8, maxLength: 32 },
      ).length
        ? uniqueStrings(ownValue(direction, 'visual_tone', 'visualTone', 'visual_keywords', 'visualKeywords', 'keywords'), { maxItems: 8, maxLength: 32 }).join('、')
        : archetype.visualTone.join('、'),
      palette: palette.length ? [...palette] : [...archetype.palette],
      lighting: firstString(ownValue(visualSource, 'lighting'), ownValue(direction, 'lighting'), archetype.lighting),
      composition: firstString(ownValue(visualSource, 'composition'), ownValue(direction, 'composition'), archetype.composition),
      camera_language: firstString(ownValue(visualSource, 'camera_language', 'cameraLanguage'), ownValue(direction, 'camera_language', 'cameraLanguage'), archetype.camera),
      background_language: firstString(ownValue(visualSource, 'background_language', 'backgroundLanguage'), ownValue(direction, 'background_language', 'backgroundLanguage'), archetype.background),
      typography_intent: firstString(ownValue(visualSource, 'typography_intent', 'typographyIntent'), ownValue(direction, 'typography_intent', 'typographyIntent'), archetype.typography),
      copy_tone: firstString(ownValue(visualSource, 'copy_tone', 'copyTone'), ownValue(direction, 'copy_tone', 'copyTone'), archetype.copyTone),
      product_fidelity: '商品外观、颜色、比例、结构、品牌标识和已确认文字必须保持一致，不得虚构不可见结构或功能。',
    },
  };
}

function strategySignature(plan) {
  return [
    plan.commercial_objective,
    plan.visual_system.composition,
    plan.product_strategy.scenario_plan,
  ].map(value => value.toLowerCase()).join('\u0000');
}

function ensureUniquePlan(plan, index, seenIds, seenTitles, seenStrategies, context) {
  const archetype = ARCHETYPES[index];
  let candidate = plan;
  const titleKey = candidate.title.toLowerCase();
  const strategyKey = strategySignature(candidate);
  if (seenTitles.has(titleKey) || seenStrategies.has(strategyKey)) {
    candidate = normalizeDirection({}, index, context);
  }

  let id = candidate.id || archetype.id;
  if (UNSAFE_KEYS.has(id.toLowerCase())) id = archetype.id;
  let suffix = 2;
  const baseId = id;
  while (seenIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  candidate.id = id;
  seenIds.add(id);
  seenTitles.add(candidate.title.toLowerCase());
  seenStrategies.add(strategySignature(candidate));
  return candidate;
}

/**
 * Turns untrusted model output into one complete executable creative plan.
 * The requested suite is authoritative; model output may enrich duties but can
 * never change image roles, counts, ratios, or introduce unsupported media.
 */
export function normalizeCreativeDirectionPlans(rawDirections, options = {}) {
  const sources = Array.isArray(rawDirections) ? rawDirections : [];
  const context = {
    requestedImages: normalizeRequestedImages(ownValue(options, 'requestedImages', 'requested_images')),
    productName: firstString(ownValue(options, 'productName', 'product_name'), '当前商品'),
    category: firstString(ownValue(options, 'category'), '其他'),
    platform: firstString(ownValue(options, 'platform'), '电商平台'),
    userPrompt: firstString(ownValue(options, 'userPrompt', 'user_prompt')),
    visualObservations: Array.isArray(options.visualObservations) ? options.visualObservations : [],
    referenceStyle: Array.isArray(options.referenceStyle) ? options.referenceStyle : [],
  };
  return Array.from({ length: MAX_DIRECTION_COUNT }, (_, index) => normalizeDirection(sources[index], index, context));
}

export { DEFAULT_REQUESTED_IMAGES };
