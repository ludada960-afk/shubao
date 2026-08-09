/**
 * Dynamic Xiaohongshu/Plog creative planning.
 *
 * This module owns only the planning contract. Image generation, persistence,
 * billing and task recovery stay in the existing server workflow.
 */

export const XHS_CREATIVE_PLANNER_VERSION = 'v3-dynamic';

const CREATIVE_DIRECTIONS = [
  { id: 'field-notes', name: '现场记录', arc: '从一个具体瞬间切入，用连续证据还原过程', visual: '真实现场、局部细节、时间顺序与环境关系', voice: '像一个认真记录过的人，克制但有观察', avoid: '空泛鸡汤、模板化种草、无依据的第一人称体验' },
  { id: 'decision-guide', name: '决策指南', arc: '先提出选择难题，再用事实、取舍和结论帮助读者判断', visual: '清晰对比、关键证据、结论卡与适用边界', voice: '直接、有判断力，先讲结论再解释原因', avoid: '夸张承诺、虚构评分、把推测写成实测' },
  { id: 'before-after', name: '变化叙事', arc: '呈现起点、关键动作、变化证据和可复制做法', visual: '前后关系、过程节点、尺度参照与结果特写', voice: '有画面感，强调过程中的取舍和细节', avoid: '没有依据的前后对比、万能方案、过度戏剧化' },
  { id: 'personal-route', name: '个人路线', arc: '围绕用户目标规划一条可执行路线，穿插真实提醒', visual: '路线、清单、节点、场景化细节与留白', voice: '像朋友分享经过筛选的经验，具体而不喧闹', avoid: '流水账、重复使用热门口号、堆砌表情符号' },
  { id: 'myth-check', name: '认知校准', arc: '从常见误解出发，区分事实、经验和需要验证的部分', visual: '误区/事实分栏、重点标注、反例和总结', voice: '清楚、诚实，愿意说明不确定性', avoid: '伪专业结论、制造焦虑、虚构数据来源' },
  { id: 'mood-board', name: '情绪画板', arc: '用一条明确情绪线串起场景、物件和可感知的生活片段', visual: '氛围主视觉、材质特写、节奏变化和少量文字', voice: '自然、有审美，但每页仍然提供有效信息', avoid: '只有漂亮图片没有主题、固定滤镜、同质化构图' },
];

const FALLBACK_PAGE_ROLES = [
  ['context', '场景与问题'],
  ['key-point', '核心发现'],
  ['evidence', '关键证据'],
  ['process', '过程拆解'],
  ['detail', '细节观察'],
  ['comparison', '取舍与对比'],
  ['action', '可执行建议'],
  ['summary', '总结与互动'],
];

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value || 'xhs')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function deriveXhsCreativeDirection(runId = '') {
  const seed = hashString(runId || 'xhs-default');
  const direction = CREATIVE_DIRECTIONS[seed % CREATIVE_DIRECTIONS.length];
  return { ...direction, seed, version: XHS_CREATIVE_PLANNER_VERSION };
}

function cleanText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function parseXhsPlannerJson(raw) {
  const text = String(raw || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('动态策划JSON解析失败');
    return JSON.parse(text.slice(start, end + 1));
  }
}

export function buildDynamicXhsAnalysisRequest({ text, visionContext = '', direction }) {
  const d = direction || deriveXhsCreativeDirection('xhs-default');
  return {
    systemPrompt: `你是薯包AI的小红书内容总策划。你不按固定赛道模板写稿，而是先理解输入事实、参考图和读者任务，再选择最适合这一篇内容的叙事结构。\n本轮创意方向：${d.name}。叙事线：${d.arc}。文字语气：${d.voice}。必须避开：${d.avoid}。\n只输出合法JSON，不要Markdown代码围栏。不得编造输入中没有的价格、地点、品牌、功效、评分、经历或效果；缺失信息就写“未提供”或换成不依赖该事实的表达。每一页只解决一个阅读任务，页面之间要有明显的信息推进。`,
    userPrompt: `用户原始内容：\n${String(text || '').trim()}\n\n${visionContext ? `参考图观察：\n${visionContext}\n\n` : ''}请完成一次独立策划，输出：\n{\n  "topic": "内容主题",\n  "title": "20字以内标题",\n  "body_text": "可直接发布的小红书正文，分段清晰，事实准确，语气自然",\n  "hashtags": ["#标签"],\n  "tags": [],\n  "creative_brief": {"audience":"目标读者","promise":"读者能获得什么","evidence":["输入中可用事实"],"voice":"本篇语气","visual_system":"本篇视觉系统","variation_note":"本轮和常见模板的差异"},\n  "pages": [\n    {"page_id":1,"page_type":"content","role":"页面职责","title":"页标题","hook":"页钩子","story":"本页内容","info_blocks":[{"label":"事实标签","value":"事实值"}],"layout_hint":"构图和信息层级","visual_intent":"主体、视角、场景、光线、文字位置"}\n  ]\n}\n必须输出恰好8个内容页(page_id 1-8)，加上独立封面共9张。内容页角色要覆盖：语境、核心发现、证据、过程或方法、细节、取舍/对比、行动建议、总结互动；若原文不适合某一角色，改成最自然的等价阅读任务。不要套用固定行业页序。` ,
  };
}

export function normalizeDynamicXhsAnalysis(parsed, { direction, text } = {}) {
  if (!parsed || typeof parsed !== 'object') return null;
  const rawPages = Array.isArray(parsed.pages) ? parsed.pages : [];
  if (!cleanText(parsed.title) || !cleanText(parsed.body_text) || rawPages.length < 4) return null;
  const pageMap = new Map(rawPages.map(page => [Number(page?.page_id), page]));
  const pages = FALLBACK_PAGE_ROLES.map(([role, label], index) => {
    const page = pageMap.get(index + 1) || {};
    return {
      page_id: index + 1,
      page_type: 'content',
      role: cleanText(page.role, role),
      title: cleanText(page.title, label),
      hook: cleanText(page.hook, cleanText(page.title, label)),
      story: cleanText(page.story, '围绕本页主题整理输入中的已知信息。'),
      info_blocks: Array.isArray(page.info_blocks) ? page.info_blocks.slice(0, 5) : [],
      layout_hint: cleanText(page.layout_hint, '以一个清晰主视觉配合少量信息卡，保留安全边距。'),
      visual_intent: cleanText(page.visual_intent, '围绕本页事实选择最能说明问题的主体、视角和场景。'),
    };
  });
  const d = direction || deriveXhsCreativeDirection(text || 'xhs-default');
  return {
    ...parsed,
    category: cleanText(parsed.topic, cleanText(parsed.category, '生活内容')),
    title: cleanText(parsed.title),
    body_text: cleanText(parsed.body_text),
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.slice(0, 8) : [],
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [],
    pages,
    creative_direction: d.id,
    creative_seed: d.seed,
    creative_brief: {
      ...(parsed.creative_brief && typeof parsed.creative_brief === 'object' ? parsed.creative_brief : {}),
      variation_note: cleanText(parsed.creative_brief?.variation_note, d.name),
    },
  };
}

export function buildDynamicXhsVisualRequest({ analysis, direction }) {
  const d = direction || deriveXhsCreativeDirection('xhs-default');
  const pages = (analysis?.pages || []).map(page => ({
    page_id: page.page_id,
    role: page.role,
    title: page.title,
    hook: page.hook,
    story: page.story,
    info_blocks: page.info_blocks,
    layout_hint: page.layout_hint,
    visual_intent: page.visual_intent,
  }));
  const brief = analysis?.creative_brief || {};
  return {
    systemPrompt: `你是小红书视觉总监。根据一份已经完成的内容策划，为每一页设计独立但属于同一套的图片。不要调用固定赛道模板；用本轮方向“${d.name}”统一节奏，但让每页的主体、角度、构图和信息职责有变化。所有事实来自策划，禁止新增数据。图片需要包含少量、准确、可读的简体中文文字；不要把大段正文塞进图里。`,
    userPrompt: `标题：${analysis?.title || ''}\n主题：${analysis?.category || ''}\n视觉简报：${JSON.stringify(brief)}\n页面策划：${JSON.stringify(pages)}\n\n只输出合法JSON：\n{"visual_system":"色彩、字体气质、网格和图文节奏","cover_prompt":"封面GPT-Image-2提示词","image_prompts":[{"page_id":1,"prompt":"内容页1的完整提示词"}]}\n必须有8条image_prompts，page_id为1-8。每条都要说明：竖版3:4、页面主视觉、主体视角、构图层级、文字区域与确切文字、和上一页不同的画面职责、留出安全边距。`,
  };
}

export function normalizeDynamicXhsVisual(parsed, analysis, direction) {
  if (!parsed || typeof parsed !== 'object') return null;
  const source = Array.isArray(parsed.image_prompts) ? parsed.image_prompts : [];
  if (!cleanText(parsed.cover_prompt) || source.length < 4) return null;
  const byId = new Map(source.map(item => [Number(item?.page_id), item]));
  const imagePrompts = Array.from({ length: 8 }, (_, index) => {
    const pageId = index + 1;
    const page = analysis?.pages?.find(item => item.page_id === pageId) || {};
    const item = byId.get(pageId) || {};
    return {
      page_id: pageId,
      prompt: cleanText(item.prompt, `Xiaohongshu vertical 3:4 content page. Show ${page.title || 'the page topic'} with a clear main visual and concise Chinese labels based only on the supplied facts. Keep a coherent visual system and safe margins.`),
    };
  });
  const d = direction || deriveXhsCreativeDirection('xhs-default');
  return {
    visualSystem: cleanText(parsed.visual_system, `${d.name}：${d.visual}`),
    coverPrompt: cleanText(parsed.cover_prompt),
    imagePrompts,
    creative_direction: d.id,
  };
}

export function buildDynamicPlogRequest({ text, scene, direction, count = 9 }) {
  const d = direction || deriveXhsCreativeDirection('plog-default');
  return {
    systemPrompt: `你是生活方式内容导演。为一组Plog照片设计动态镜头，不使用固定赛道镜头库。围绕“${d.name}”组织节奏：${d.arc}。镜头必须忠于用户输入，不凭空加入人物、产品、地点或事件；每张照片只承担一个画面任务，且角度、景别或时间关系要有变化。`,
    userPrompt: `用户内容：${String(text || '').trim()}\n当前识别场景（仅供参考）：${scene || '未分类'}\n请输出合法JSON：{"caption":"一条自然的套图标题","copy_lines":["9条短句"],"lenses":[{"zh":"中文镜头名","en":"English image direction"}]}。必须恰好${count}条lenses和${count}条copy_lines；不要固定使用同一组表情符号或鸡汤句。`,
  };
}

export function normalizeDynamicPlogPlan(parsed, count = 9) {
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.lenses) || parsed.lenses.length < 4) return null;
  const lenses = Array.from({ length: count }, (_, index) => {
    const item = parsed.lenses[index] || {};
    return { zh: cleanText(item.zh, `生活片段 ${index + 1}`), en: cleanText(item.en, cleanText(item.zh, 'a natural everyday moment')) };
  });
  const copyLines = Array.from({ length: count }, (_, index) => cleanText(parsed.copy_lines?.[index], lenses[index].zh));
  return { caption: cleanText(parsed.caption, '生活碎片'), copyLines, lenses };
}
