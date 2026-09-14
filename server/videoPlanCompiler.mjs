/* ═══════════════════════════════════════════════════════════════════════════
   视频方案 → 生成请求 编译（服务端权威）
   ═══════════════════════════════════════════════════════════════════════════

   2026-09-18 总统筹拍板：
     「视频方案是收了钱的，收了钱就必须真的影响产出 —— 现在这条链是断的，必须接上。」

   改动前的事实（实测）：
     · 前端 handleVideoComposerGenerate 把 videoPlan 存在 composer 上、用 planReviewed 拦生成，
       但 createVideoJob 的请求体里**根本没有 videoPlan**（只有 prompt / negativePrompt: '' / 规格）；
     · 服务端 /api/video/jobs 把 req.body 直接交给 createJob，**没有任何方案校验**；
     · 实测构造一个「无方案」请求 → **202 建单成功**（46,000 单位被 hold），闸门可绕过。
     → 用户花 1 积分买方案、且必须确认方案才能生成，但方案里的分镜/镜头/风险对成片零影响。

   本模块把方案**编译进**最终请求（prompt + negativePrompt），原则：
     1) **服务端权威**：编译在服务端做，客户端只负责把结构化方案传上来。
        客户端就算不传优化后的提示词，服务端也能从结构化字段重建 —— 绕过客户端无效。
     2) **沿用既有三层权威排序**（与 src/pages/EcCanvas/canvasPromptAuthority.js 的
        PROMPT_LAYER 同序，不新造一套）：
          硬约束(1) > 产出结构(2) > 内容文案(3)
        方案属于**产出结构**层（它决定出什么、镜头怎么走、节奏如何），
        所以它高于用户内容文案、低于硬约束（用户负向词/尺寸/合规）。
     3) 方案里的 risks 同时编译进 negativePrompt（风险约束 = 别出现什么），
        与硬约束层的 negative 合并，硬约束在前（更权威）。
   ═══════════════════════════════════════════════════════════════════════════ */

/** 与 canvasPromptAuthority 的 PROMPT_LAYER 同序（不新造一套） */
export const VIDEO_PROMPT_LAYER = Object.freeze({
  HARD_CONSTRAINT: 1,   // 用户负向词 / 品牌色 / 尺寸清晰度 / 平台合规
  OUTPUT_STRUCTURE: 2,  // 方案结构：分镜 / 镜头运动 / 节奏 / 主体动作
  CONTENT_INTENT: 3,    // 用户内容文案
});

const clean = (value, max = 200) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

function list(value, max) {
  return Array.isArray(value) ? value.slice(0, max) : [];
}

/** 方案是否「可用」：必须有可执行内容，否则视为没有方案 */
export function hasUsableVideoPlan(plan) {
  if (!plan || typeof plan !== 'object') return false;
  const beats = list(plan.beats, 6);
  const optimized = clean(plan.optimizedPrompt, 1200);
  return beats.length >= 3 || Boolean(optimized);
}

/**
 * 把方案编译成「产出结构层」的提示词片段。
 * 只描述**怎么拍**（镜头/节奏/主体动作/结构），不重复用户内容文案。
 * @returns {string}
 */
export function compileVideoPlanStructure(plan = {}) {
  const segments = [];
  const summary = clean(plan.summary, 240);
  const strategy = clean(plan.creativeStrategy, 240);
  if (summary) segments.push(`整体：${summary}`);
  if (strategy) segments.push(`创意策略：${strategy}`);

  const beats = list(plan.beats, 6);
  if (beats.length) {
    const lines = beats.map((beat, index) => {
      const at = clean(beat?.time, 24) || `第${index + 1}段`;
      const label = clean(beat?.label, 60);
      const detail = clean(beat?.detail, 160);
      return `${at} ${label}${detail ? `（${detail}）` : ''}`.trim();
    }).filter(Boolean);
    if (lines.length) segments.push(`分镜节奏：${lines.join('；')}`);
  }

  /* 素材「必须保留」的观察结论 = 方案对画面的硬性结构要求（保住商品特征） */
  const retain = list(plan.assets, 16)
    .flatMap(asset => list(asset?.retain, 5).map(item => clean(item, 120)))
    .filter(Boolean)
    .slice(0, 8);
  if (retain.length) segments.push(`必须保留：${retain.join('、')}`);

  return segments.join('\n');
}

/**
 * 编译最终请求。
 * @param {{prompt?:string, negativePrompt?:string, plan?:object}} input
 * @returns {{prompt:string, negativePrompt:string, planHash:string, planUsed:boolean, layers:object}}
 */
export function compileVideoRequest({ prompt = '', negativePrompt = '', plan = null } = {}) {
  const userPrompt = clean(prompt, 7000);
  const hardNegative = clean(negativePrompt, 1200);

  if (!hasUsableVideoPlan(plan)) {
    /* 没有可用方案 → 原样透传（本函数只负责「有方案时让方案生效」；
       没有方案时的拒绝由 createJob 的闸门负责，见 assertVideoPlanConfirmed） */
    return { prompt: userPrompt, negativePrompt: hardNegative, planHash: '', planUsed: false, layers: {} };
  }

  const structure = compileVideoPlanStructure(plan);
  const optimized = clean(plan.optimizedPrompt, 1200);

  /* 三层拼接顺序 = 权威从高到低（第 1 层 > 第 2 层 > 第 3 层）。
     最终 prompt 让「方案结构」在前、「用户文案」在后 ——
     模型读到的第一条信息就是付费买来的方案。 */
  const blocks = [];
  if (structure) blocks.push(`【拍摄方案·必须遵循】\n${structure}`);
  if (optimized) blocks.push(`【方案执行提示词】\n${optimized}`);
  if (userPrompt) blocks.push(`【用户内容要求】\n${userPrompt}`);

  /* 风险约束 → negativePrompt。硬约束（用户负向词）在前，方案风险在后。
     理由：negativePrompt 是逗号/顿号分隔的列表，顺序体现优先级。 */
  const risks = list(plan.risks, 8).map(item => clean(item, 180)).filter(Boolean);
  const negativeParts = [hardNegative, risks.join('、')].filter(Boolean);

  return {
    prompt: blocks.join('\n\n'),
    negativePrompt: negativeParts.join('、').slice(0, 1200),
    planHash: hashVideoPlan(plan),
    planUsed: true,
    layers: {
      [VIDEO_PROMPT_LAYER.HARD_CONSTRAINT]: hardNegative,
      [VIDEO_PROMPT_LAYER.OUTPUT_STRUCTURE]: structure || optimized,
      [VIDEO_PROMPT_LAYER.CONTENT_INTENT]: userPrompt,
    },
  };
}

/** 方案留痕：稳定指纹（内部字段，绝不出现在用户可见文案里） */
export function hashVideoPlan(plan = {}) {
  const payload = JSON.stringify({
    summary: clean(plan?.summary, 240),
    optimizedPrompt: clean(plan?.optimizedPrompt, 1200),
    beats: list(plan?.beats, 6).map(b => ({ t: clean(b?.time, 24), l: clean(b?.label, 60), d: clean(b?.detail, 160) })),
    risks: list(plan?.risks, 8).map(r => clean(r, 180)),
  });
  /* FNV-1a 32 位：无依赖、稳定、足够做留痕比对（不需要密码学强度） */
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `vplan-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * 服务端闸门：未确认方案不得出片。
 * @param {{plan?:object, planConfirmed?:boolean}} input
 * @throws {Error} 400 VIDEO_PLAN_REQUIRED（用户可读文案）
 */
export function assertVideoPlanConfirmed({ plan = null, planConfirmed = false } = {}) {
  if (!hasUsableVideoPlan(plan)) {
    throw Object.assign(new Error('请先生成并确认拍摄方案后再生成视频'), {
      status: 400,
      code: 'VIDEO_PLAN_REQUIRED',
    });
  }
  if (planConfirmed !== true) {
    throw Object.assign(new Error('请先确认拍摄方案后再生成视频'), {
      status: 400,
      code: 'VIDEO_PLAN_NOT_CONFIRMED',
    });
  }
}
