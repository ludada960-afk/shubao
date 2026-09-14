/* ═══════════════════════════════════════════════════════════════════════
   画布 · 电商生图信息源的权威性排序（唯一规则）
   ═══════════════════════════════════════════════════════════════════════

   2026-09-17 用户提出根本性问题：画布上现在有四个信息源 ——
   内置 skill、下面板配置、提示词、设计方案 —— 它们互相冲突时，谁说了算？

   统筹定下的规则（本文件是唯一实现，注释与测试同步钉住）：

   ── 第 1 层 · 硬约束（配置面板）＝ 永远最高优先，提示词不能覆盖 ──────────
      避免出现的元素(negative) / 品牌主色调 / 尺寸·清晰度 / 平台合规。
      冲突处理：**硬约束胜出，但绝不静默** ——
      生成前方案里必须显式写出「已按你的约束忽略提示词中的 X」。
      （对应用户一贯要求：不静默改变他的意图。）

   ── 第 2 层 · 产出结构（套图方案 + SKU 变体）＝ 决定出什么/几张/什么比例 ──
      提示词不能改张数 / 类型 / 比例。判定用 isStructuralIntent()：
      命中「出几张 / 什么类型 / 什么比例」这类陈述即视为越权，记一条提示。

   ── 第 3 层 · 内容意图（提示词 + skill）＝ 决定画面内容/卖点/场景/风格 ────
      提示词优先于 skill；skill 只在 prompt 为空时预填
      （保持既有 applyCanvasSkill 行为，本模块不改它）。
      面板新增的「其它补充」(productParams.extraNotes) 与
      「变体说明」(skus[].note) 同属第 3 层 → 接进 prompt 编译（作为补充说明段）。
      它们与第 1 层冲突时以硬约束为准，并给出上面的显式提示。

   ── 第 4 层 · 设计方案（带方案流程）＝ 用户确认后成为唯一事实源 ──────────
      确认方案时把方案参数（比例/张数/文案/风格/方向）**回写到节点配置**，
      之后生成只依据方案；但硬约束层继续生效。
      目的：不允许「配置 A + 方案 B」两个真相并存。

   设计原则：本模块只做**纯函数**推断与提示收集，不碰 React、不碰网络；
   调用方拿到 notices 后自行展示（提示语按用户要求：短、说结果不说机制）。
   ═══════════════════════════════════════════════════════════════════════ */

/** 信息源层级（数值越小越权威）。导出供调用方与测试引用，避免散落魔法字符串。 */
export const PROMPT_LAYER = Object.freeze({
  HARD_CONSTRAINT: 1,   // 配置面板：避免出现的元素 / 品牌色 / 尺寸清晰度 / 平台合规
  OUTPUT_STRUCTURE: 2,  // 套图方案 + SKU 变体：出什么、几张、什么比例
  CONTENT_INTENT: 3,    // 提示词 + skill + 其它补充 + 变体说明
  DESIGN_PLAN: 4,       // 设计方案（确认后成为唯一事实源）
});

/* ── 第 1 层：硬约束字段 ─────────────────────────────────────────────── */
/** 配置面板里属于硬约束的键（提示词无权覆盖）。 */
export const HARD_CONSTRAINT_KEYS = Object.freeze([
  'negative',        // 避免出现的元素
  'brandColor',      // 品牌主色调
  'brandColorLocked',// 品牌主色锁定开关
  'resolution',      // 清晰度
  'ratio',           // 比例
  'size',            // 尺寸
  'platform',        // 平台合规（各平台对白底/文字/尺寸有硬性规定）
]);

/**
 * 提示词里是否出现了「想改结构」的意图（张数 / 类型 / 比例）。
 * 命中即视为越权 —— 结构由第 2 层决定，提示词无权改。
 * @param {string} prompt
 * @returns {{structural: boolean, reason: string}}
 */
export function isStructuralIntent(prompt = '') {
  const text = String(prompt || '');
  if (!text.trim()) return { structural: false, reason: '' };
  /* 张数：N 张 / N 张图 / 出 N 张 / 一共 N 张 */
  const count = text.match(/(?:出|生成|一共|总共|给我)?\s*(\d+)\s*(?:张|幅|个图|张图)/);
  if (count) return { structural: true, reason: `张数（${count[0].trim()}）` };
  /* 比例：3:4 / 9:16 / 16:9 / 1:1 这类 */
  const ratio = text.match(/(?:^|[^\d])(\d{1,2})\s*[:：]\s*(\d{1,2})(?!\d)/);
  if (ratio) return { structural: true, reason: `比例（${ratio[1]}:${ratio[2]}）` };
  /* 类型：白底图/主图/详情图/SKU 图 这些是产出结构，不是画面内容 */
  const kinds = ['白底图', '主图', '详情图', '详情页', 'SKU图', 'SKU 图', '规格图', '长图'];
  const hit = kinds.find(kind => text.includes(kind));
  if (hit) return { structural: true, reason: `图类型（${hit}）` };
  return { structural: false, reason: '' };
}

/**
 * 提示词里是否出现了与硬约束冲突的意图。
 * 目前可判定的是「明确要求出现某元素」与「negative 里已禁止的元素」相撞：
 * 提示词说"要 X"、硬约束说"不要 X" —— 这类必须显式告知用户。
 * @param {{prompt?: string, negative?: string}} input
 * @returns {{conflicts: string[], reason: string}}
 */
export function detectHardConstraintConflicts({ prompt = '', negative = '' } = {}) {
  const promptText = String(prompt || '');
  const negativeText = String(negative || '');
  if (!promptText.trim() || !negativeText.trim()) return { conflicts: [], reason: '' };
  /* negative 支持中文顿号/逗号/空格分隔 */
  const banned = negativeText.split(/[，,、;；\s]+/).map(item => item.trim()).filter(item => item.length >= 2);
  const conflicts = banned.filter(item => promptText.includes(item));
  return {
    conflicts,
    reason: conflicts.length ? conflicts.join('、') : '',
  };
}

/**
 * 把第 3 层的补充信息（其它补充 + 各变体说明）编译成 prompt 的补充说明段。
 * 用户要求：与第 1 层冲突时以硬约束为准，并由调用方给出显式提示。
 * @param {{extraNotes?: string, skus?: Array<{note?: string, label?: string}>}} input
 * @returns {{segments: string[], text: string, sources: string[]}}
 */
export function compileSupplementSegments({ extraNotes = '', skus = [] } = {}) {
  const segments = [];
  const sources = [];
  const notes = String(extraNotes || '').trim();
  if (notes) {
    segments.push(`补充说明：${notes}`);
    sources.push('extraNotes');
  }
  const variantNotes = (Array.isArray(skus) ? skus : [])
    .map((sku, index) => {
      const note = String(sku?.note || '').trim();
      if (!note) return null;
      const label = String(sku?.label || '').trim()
        || [sku?.color, sku?.size, sku?.capacity, sku?.dimLabel].map(v => String(v || '').trim()).filter(Boolean).join('/')
        || `变体${index + 1}`;
      return `变体说明（${label}）：${note}`;
    })
    .filter(Boolean);
  if (variantNotes.length) {
    segments.push(...variantNotes);
    sources.push('skuNotes');
  }
  return { segments, text: segments.join('\n'), sources };
}

/**
 * 权威性总判定：把四个信息源收敛成一份「生成时到底听谁的」的结论。
 * 不改变任何既有行为，只做**推断 + 提示收集**，调用方据此展示。
 *
 * @param {object} input
 * @param {string} input.prompt           用户提示词（第 3 层）
 * @param {string} input.skill            技能 slug（第 3 层，仅 prompt 为空时才生效）
 * @param {object} input.configuration    配置面板（第 1 + 2 + 3 层）
 * @param {object} input.plan             已确认的设计方案（第 4 层，可为空）
 * @returns {{
 *   structuralOverridden: boolean,
 *   structuralReason: string,
 *   hardConstraintConflicts: string[],
 *   hardConstraintReason: string,
 *   supplement: {segments: string[], text: string, sources: string[]},
 *   notices: string[],
 *   layers: object,
 * }}
 */
export function resolvePromptAuthority({ prompt = '', skill = '', configuration = {}, plan = null } = {}) {
  const config = configuration && typeof configuration === 'object' ? configuration : {};
  const genSettings = config.genSettings || {};
  const negative = String(config.negative ?? genSettings.negative ?? '').trim();

  /* 第 2 层：提示词想改结构 → 结构层胜出，记提示 */
  const structural = isStructuralIntent(prompt);

  /* 第 1 层：提示词与硬约束相撞 → 硬约束胜出，记提示 */
  const conflict = detectHardConstraintConflicts({ prompt, negative });

  /* 第 3 层：补充信息编译成补充说明段 */
  const supplement = compileSupplementSegments({
    extraNotes: config.productParams?.extraNotes,
    skus: config.skus,
  });

  /* 第 4 层：方案确认后是唯一事实源；硬约束仍生效 */
  const planConfirmed = Boolean(plan && (plan.confirmed || plan.applied));

  const notices = [];
  if (structural.structural) {
    /* 说结果不说机制：直接讲"按套图方案出"，而不是"结构层优先"这种内部说法。
       注意别再套一层括号 —— reason 自己已经带括号（如「张数（出 6 张）」），
       实测会出现「（张数（出 6 张）以方案为准）」这种难读的嵌套。 */
    notices.push(`已按套图方案出图，提示词里的${structural.reason}不生效`);
  }
  if (conflict.conflicts.length) {
    notices.push(`已按你的约束忽略提示词中的「${conflict.reason}」`);
  }

  return {
    structuralOverridden: structural.structural,
    structuralReason: structural.reason,
    hardConstraintConflicts: conflict.conflicts,
    hardConstraintReason: conflict.reason,
    supplement,
    notices,
    layers: {
      hardConstraint: { keys: HARD_CONSTRAINT_KEYS, negative, hasBrandColor: Boolean(config.brandColor) },
      outputStructure: { sizing: config.sizing || null, skus: Array.isArray(config.skus) ? config.skus.length : 0 },
      contentIntent: { promptLength: String(prompt || '').trim().length, skill: String(skill || ''), supplementSources: supplement.sources },
      designPlan: planConfirmed ? 'confirmed' : 'pending',
    },
  };
}

/**
 * 第 2 层所需：把已确认的设计方案参数回写到节点配置。
 * 用户规则：「确认方案时把方案参数回写到节点配置，之后生成只依据方案」，
 * 目的 = 不允许「配置 A + 方案 B」两个真相并存。
 * 硬约束层（negative / 品牌色 / 平台）**不参与回写** —— 它们继续独立生效。
 *
 * @param {{configuration?: object, plan?: object}} input
 * @returns {object} 回写后的 configuration（新对象，不修改入参）
 */
export function applyPlanToConfiguration({ configuration = {}, plan = {} } = {}) {
  const config = configuration && typeof configuration === 'object' ? { ...configuration } : {};
  const source = plan && typeof plan === 'object' ? plan : {};
  const next = { ...config };

  /* 比例：方案给了就覆盖（结构层内部以方案为唯一事实源） */
  if (source.ratio) next.ratio = source.ratio;
  /* 张数：方案给了就覆盖 */
  if (Number.isFinite(Number(source.count)) && Number(source.count) > 0) next.count = Number(source.count);
  /* 文案：并进 copywriting（第 3 层内容意图） */
  if (source.copywriting && typeof source.copywriting === 'object') {
    next.copywriting = { ...(config.copywriting || {}), ...source.copywriting };
  }
  /* 风格 / 方向：并入配置，供生成链路读取 */
  if (source.style) next.styleSkill = source.style;
  if (source.direction) next.direction = source.direction;
  /* genSettings：方案的清晰度/模型并入，但**不覆盖硬约束键** */
  if (source.genSettings && typeof source.genSettings === 'object') {
    const merged = { ...(config.genSettings || {}) };
    for (const [key, value] of Object.entries(source.genSettings)) {
      if (HARD_CONSTRAINT_KEYS.includes(key)) continue;   // 硬约束层继续独立生效
      merged[key] = value;
    }
    next.genSettings = merged;
  }
  return next;
}
