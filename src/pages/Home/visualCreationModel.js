import { isPersistentEcommerceImageUrl } from '../../utils/workRecords.js';
import { generationUnits, DEFAULT_IMAGE_MODEL } from '../../services/imageModelCatalog.js';
import { IMAGE_RATIOS } from '../../services/imageSizeCatalog.js';

/* ═══ 批 J-⑪：画面尺寸**给满六档**（用户批注 #7-4）═════════════════════════════════════════
   用户原话：「他们会有**很多很多个尺寸的规格**可以给人选的，为什么你没有呢？**你只有这四个吗？**」
   改前：每个技能只声明 3~4 档，画面规格面板就只列那几个 —— 用户看到的是"四个"。
   现在：把该技能**最合适的那几档放前面**，后面**补全到 IMAGE_RATIOS 全部六档**。
   ⚠️ 2026-09-29 批 DC 续-8：第一档**不再**是它的默认值（默认值已改成「自适应」，
      这份顺序降级成"自适应解析不出结果时"的回落档）。
   ⚠️ 敢补全的依据不是"想给更多"，是**服务端六档全都真的照做**：
      test/image-size-catalog-parity 第 ② 条逐个 resolution × ratio 跑过 resolveGenerationSize，
      确认没有任何一档会被静默回落（不在表里的比例会被悄悄改成 1:1，那种档位绝不放进 UI）。 */
function ratioOrder(preferred) {
  const head = preferred.filter(ratio => IMAGE_RATIOS.includes(ratio));
  return Object.freeze([...head, ...IMAGE_RATIOS.filter(ratio => !head.includes(ratio))]);
}
import { productionCaseById } from './productionCaseCatalog.js';

function visualShowcases(caseId, first, second) {
  const item = productionCaseById(caseId);
  const chapters = item.chapters || [];
  return Object.freeze([
    Object.freeze({ ...first, ...(chapters[0] || {}), assets: chapters[0]?.assets || item.assets }),
    Object.freeze({ ...second, ...(chapters[1] || {}), assets: chapters[1]?.assets || item.assets }),
  ]);
}

export const VISUAL_CREATION_SKILLS = Object.freeze([
  Object.freeze({
    id: 'free',
    title: '自由创作',
    /* 9-13 三轮批注：删掉素材区提示句（「主体或参考图都可以 · 风格参考只影响构图与色调」），
       上限说明按小红书的位置与措辞放入 @引用行；四个子页面不再有独立 materialHint */
    promptHint: '描述主体、场景、构图与限制条件',
    /* 9-13 二轮批注：自由创作页四个子页面要各自独立的占位引导与示例（不再共用同一份） */
    promptExamples: Object.freeze([
      '例：午后咖啡馆的透明玻璃杯，逆光，杯身加一行手写体标题，暖棕色调',
      '例：春日街角的樱花树与单车，清新浅色调，主体放画面右侧',
    ]),
    shortDescription: '从一句想法或参考图开始',
    preserves: '你的主体、关系与明确约束',
    outcome: '由描述自由定义画面风格与构图',
    bestFor: '概念图、插画、场景与开放需求',
    preview: '/images/visual-recipes/free.png',
    control: Object.freeze({
      label: '画面语言',
      options: Object.freeze(['智能匹配', '写实摄影', '风格插画']),
      optionMeta: Object.freeze([
        Object.freeze({ value: '智能匹配', image: '/images/visual-recipes/cases/free-tide-lab.png', description: '由主体、场景与参考素材自动平衡' }),
        Object.freeze({ value: '写实摄影', image: '/images/visual-recipes/cases/free-output.png', description: '控制真实光线、材质与空间关系' }),
        Object.freeze({ value: '风格插画', image: '/images/visual-recipes/cases/free-paper-city.png', description: '强化笔触、色彩与想象力表达' }),
      ]),
    }),
    panels: Object.freeze([
      Object.freeze({ id: 'composition', label: '构图关系', options: Object.freeze(['自动规划', '主体延展', '连续叙事']) }),
      Object.freeze({ id: 'continuity', label: '画面连续性', options: Object.freeze(['保留主体关系', '允许自由变化']) }),
    ]),
    ratios: ratioOrder(['1:1', '3:4', '4:3', '9:16']),
    showcases: visualShowcases('free',
      {
        title: '从灵感到完整场景',
        description: '保留主体关系，把简单素材扩展成有空间感的完整画面。',
      },
      {
        title: '让构图继续生长',
        description: '围绕主体补全光线、环境与叙事细节，结果可进入画布继续编辑。',
      }),
  }),
  Object.freeze({
    id: 'poster',
    title: '海报设计',
    promptHint: '描述主体位置、文字层级与整体氛围',
    /* 9-13 二轮批注：海报设计 —— 主体位置 + 文字层级 */
    promptExamples: Object.freeze([
      '例：周末市集促销海报，主标题横贯顶部，产品放正中焦点，底部留白给时间地点',
      '例：新书发布海报，书名做超大衬线标题，作者与发售信息排成两行小字区',
    ]),
    shortDescription: '先建立焦点，再组织信息层级',
    preserves: '核心主体、品牌信息与标题优先级',
    outcome: '完整构图、清晰层级与可读排版区',
    bestFor: '活动、上新、节日与线下海报',
    preview: '/images/visual-recipes/poster.png',
    control: Object.freeze({
      label: '信息重点',
      options: Object.freeze(['主标题优先', '产品优先', '活动信息优先']),
      optionMeta: Object.freeze([
        Object.freeze({ value: '主标题优先', image: '/images/visual-recipes/cases/poster-theatre.png', description: '先建立唯一阅读焦点，再组织辅助信息' }),
        Object.freeze({ value: '产品优先', image: '/images/visual-recipes/cases/poster-farmers-market.png', description: '让主体或商品占据最清晰的视觉位置' }),
        Object.freeze({ value: '活动信息优先', image: '/images/visual-recipes/cases/poster-night-ride.png', description: '把时间、地点与行动信息放到传播焦点' }),
      ]),
    }),
    panels: Object.freeze([
      Object.freeze({ id: 'headline', label: '标题层级', options: Object.freeze(['主标题优先', '标题 + 卖点', '标题 + 行动信息']) }),
      Object.freeze({ id: 'layout', label: '版式结构', options: Object.freeze(['编辑网格', '主视觉聚焦', '信息分栏']) }),
    ]),
    ratios: ratioOrder(['3:4', '4:3', '1:1']),
    showcases: visualShowcases('poster',
      {
        title: '先聚焦，再排信息',
        description: '把主体转成视觉焦点，并为标题、卖点和行动信息留出清晰层级。',
      },
      {
        title: '一张图建立传播节奏',
        description: '用对比、留白和阅读顺序把视觉与文案组织成可发布海报。',
      }),
  }),
  Object.freeze({
    id: 'social-cover',
    title: '社媒封面',
    promptHint: '描述封面想传达的重点与情绪',
    /* 9-13 二轮批注：社媒封面 —— 标题安全区 + 平台尺寸 */
    promptExamples: Object.freeze([
      '例：美食探店封面，标题「人均 50 吃到扶墙出」放左上安全区，主图占中下 2/3',
      '例：穿搭教程封面，标题「小个子显高 5cm」居中置顶，人物全身照放右侧竖构图',
    ]),
    shortDescription: '让主题在移动端一眼可读',
    preserves: '主体辨识度与标题信息优先级',
    outcome: '强视觉焦点、标题安全区与紧凑构图',
    bestFor: '小红书、公众号与短视频封面',
    preview: '/images/visual-recipes/social-cover.png',
    control: Object.freeze({
      label: '发布平台',
      options: Object.freeze(['小红书', '公众号', 'B站', '抖音']),
      optionMeta: Object.freeze([
        Object.freeze({ value: '小红书', image: '/images/visual-recipes/cases/social-xhs-market.png', description: '竖版封面优先，强化标题与主体的缩略图识别' }),
        Object.freeze({ value: '公众号', image: '/images/visual-recipes/cases/social-wechat-workflow.png', description: '横向头图优先，保留文章主题与阅读入口' }),
        Object.freeze({ value: 'B站', image: '/images/visual-recipes/cases/social-bilibili-camera.png', description: '突出人物或内容看点，适配视频封面阅读' }),
        Object.freeze({ value: '抖音', image: '/images/visual-recipes/cases/social-douyin-stretch.png', description: '全屏竖版构图，先抓住动作与情绪焦点' }),
      ]),
    }),
    panels: Object.freeze([
      Object.freeze({ id: 'platform', label: '平台构图', options: Object.freeze(['移动端缩略图', '横向头图', '视频封面', '全屏竖版']) }),
      Object.freeze({ id: 'headline', label: '标题策略', options: Object.freeze(['痛点钩子', '结果先行', '清单结构', '教程步骤']) }),
    ]),
    ratios: ratioOrder(['3:4', '21:9', '16:9', '9:16']),
    showcases: visualShowcases('social-cover',
      {
        title: '移动端一眼读懂',
        description: '强化人物与标题焦点，并按平台阅读习惯安排安全区。',
      },
      {
        title: '把内容变成点击理由',
        description: '兼顾人物情绪、标题可读性和平台缩略图中的辨识度。',
      }),
  }),
  Object.freeze({
    id: 'brand-kv',
    title: '品牌主视觉',
    promptHint: '描述品牌调性、使用场景与要避免的元素',
    /* 9-13 二轮批注：品牌主视觉 —— 品牌调性 + 色彩系统 */
    promptExamples: Object.freeze([
      '例：环保家居品牌主视觉，原木与燕麦色做品牌色，产品置于自然光场景中心',
      '例：户外运动品牌 Campaign KV，锁定品牌绿与产品剪影，山野场景向两侧延展',
    ]),
    shortDescription: '把品牌调性扩展成统一画面语言',
    preserves: '品牌身份、产品特征与关键色',
    outcome: '可延展的场景、材质、光影与构图系统',
    bestFor: 'Campaign KV、发布会与主题传播',
    preview: '/images/visual-recipes/brand-kv.png',
    control: Object.freeze({
      label: '延展方向',
      options: Object.freeze(['产品聚焦', '场景延展', '材质叙事']),
      optionMeta: Object.freeze([
        Object.freeze({ value: '产品聚焦', image: '/images/visual-recipes/cases/brand-kv-output.png', description: '让产品成为画面中最清晰、最稳定的识别中心' }),
        Object.freeze({ value: '场景延展', image: '/images/visual-recipes/cases/brand-slow-hotel.png', description: '把品牌气质延展到完整空间与使用场景' }),
        Object.freeze({ value: '材质叙事', image: '/images/visual-recipes/cases/brand-seed-paper.png', description: '用材质、光影和细节建立可持续的品牌语言' }),
      ]),
    }),
    panels: Object.freeze([
      Object.freeze({ id: 'touchpoint', label: '品牌触点', options: Object.freeze(['主KV', '零售横幅', '社媒方图', '现场导视']) }),
      Object.freeze({ id: 'identity', label: '识别系统', options: Object.freeze(['锁定品牌色', '锁定产品结构', '锁定光影材质']) }),
    ]),
    ratios: ratioOrder(['16:9', '21:9', '1:1', '3:4']),
    showcases: visualShowcases('brand-kv',
      {
        title: '从产品到品牌世界',
        description: '保留产品识别点，把品牌色、材质和空间扩展成统一主视觉。',
      },
      {
        title: '建立可延展的视觉系统',
        description: '统一光影、色彩与图形语言，便于后续延展到不同传播尺寸。',
      }),
  }),
]);

/* ═══ 2026-09-25 批 BK：**6 档 → 13 档（与能生成的档位同源）**（用户原话，逐字）═════════════════
   「然后我们的图片生成这边为什么不能像他们一样做这么多的尺寸呢？他们明明可以放这么多尺寸呐，
     我们为什么不能放呢？是存在什么问题吗？」
   实测根因**不是引擎不行**：服务端 LEGAL_IMAGE_SIZES / 前端 imageSizeCatalog 早就补到 **13 档**
   （批 O-⑦ 补 2:3/3:2、批 P 补 4:5/5:4、批 X 补 9:21/2:1/1:2），但**首页这个选项源自批 J-⑪ 之后
   一次都没扩过** —— 用户主入口看到的仍是 6 档（其余 7 档只长在技能子页面的声明里）。
   ⇒ 现在直接从 `IMAGE_RATIOS`（= 能生成的唯一真源）派生：**能选的就是能生成的**（一个不多一个不少）。
      label 只是给人看的名字，按比例方向取中文。 */
/* ═══ 2026-09-29 批 DC 续-8：「自适应」这个**值**收成一处常量**（原来它只是数组里的一行字面量）══════
   为什么现在需要它：它同时是 ① 选项表的第一项、② 首页的**默认比例**、
   ③ `resolveVisualSkillRatio` 里"永远算受支持"的那个特例。三处写同一个中文字面量，
   改一处就会剩下两处不一致 —— 而这种不一致的后果是"**看着是自适应、跑的是别的比例**"
   （本仓铁律：不许"看着是 A、跑的是 B"）。 */
export const HOME_ADAPTIVE_RATIO = '自适应';

export const VISUAL_RATIO_OPTIONS = Object.freeze([
  /* ═══ 2026-09-29 批 CY-⑭：**最前面加一档「自适应」**（用户原话，逐字）══════════════════════════════
     「关于图片的尺寸……是不是应该在尺寸的**最前面**加入一个？**自适应**的一个选项，
       我看他们的竞品他们都是有这个选项的。」用户自己截的竞品证据：**图片生成有、视频生成没有**
       —— 所以视频侧不加（上游对不在白名单的比例是硬 400 拒绝，见 canvasAdaptiveRatio.js 顶部）。
     ⚠️ 它**不是**一个"比例"：它不进 IMAGE_RATIOS（那是能生成的唯一真源，13 档），
       也不进任何 LEGAL_IMAGE_SIZES —— 选了它之后由 resolveProtocolRatio 现算出一个具体比例再发。
       所以这一档是"**选项**，不是**尺寸**"，两者不能混进同一张表
       （test/image-size-catalog-parity.test.mjs 钉的就是"IMAGE_RATIOS 必须恰好 13 档"，那是尺寸表）。 */
  Object.freeze({ id: HOME_ADAPTIVE_RATIO, label: HOME_ADAPTIVE_RATIO, adaptive: true }),
  Object.freeze({ id: '1:1', label: '方形 1:1' }),
  Object.freeze({ id: '3:4', label: '竖版 3:4' }),
  Object.freeze({ id: '4:3', label: '横版 4:3' }),
  Object.freeze({ id: '9:16', label: '竖屏 9:16' }),
  Object.freeze({ id: '16:9', label: '宽屏 16:9' }),
  Object.freeze({ id: '21:9', label: '横幅 21:9' }),
  Object.freeze({ id: '2:3', label: '竖长图 2:3' }),
  Object.freeze({ id: '3:2', label: '横摄影 3:2' }),
  Object.freeze({ id: '4:5', label: '竖封面 4:5' }),
  Object.freeze({ id: '5:4', label: '横主图 5:4' }),
  Object.freeze({ id: '9:21', label: '超竖屏 9:21' }),
  Object.freeze({ id: '2:1', label: '超宽屏 2:1' }),
  Object.freeze({ id: '1:2', label: '超竖屏 1:2' }),
]);

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function visualSkillById(skillId) {
  return VISUAL_CREATION_SKILLS.find(skill => skill.id === skillId) || VISUAL_CREATION_SKILLS[0];
}

export function resolveVisualSkillRatio(skillId, requestedRatio) {
  const skill = visualSkillById(skillId);
  const supported = Array.isArray(skill.ratios) && skill.ratios.length ? skill.ratios : ['1:1'];
  /* ⚠️ 2026-09-29 批 DC 续-8：「自适应」**永远算受支持**。
     原来这里只按 `skill.ratios` 判，而那几份名单里**没有**「自适应」（它们列的是具体尺寸档）——
     于是批 CY-⑭ 把「自适应」放进选项之后，一旦它成为默认值，resolveVisualSkillRatio 会把它
     判成"这条技能不支持"，**悄悄回落成 ratios[0]**（首页就成了"选了自适应、跑的是别的比例"）。
     它是**选项不是尺寸**（不进 IMAGE_RATIOS，选中后由 resolveProtocolRatio 现算），
     所以不受"这条技能支持哪些尺寸"约束 —— 与上面 `options` 过滤器的 `option.adaptive` 放行是同一条理由。 */
  if (requestedRatio === HOME_ADAPTIVE_RATIO) return HOME_ADAPTIVE_RATIO;
  return supported.includes(requestedRatio) ? requestedRatio : supported[0];
}

/* 9-13 二轮批注：切子页面时底部参数（画幅）按该板块最合适的默认值重置
   ⚠️ 2026-09-29 批 DC 续-8：默认值**改成「自适应」**（用户 2026-09-29 逐字：
     「首页的生图模型配置啊，还有画布里面的生图配置啊这些地方。**自适应应该是它默认的一个选项呀。**
       除非像这个概念视觉方案这里……那这个 3:4 就可以成为它的默认选项。」）
     `ratios[0]` 那个"按板块挑一个最合适的"的旧逻辑保留成**回落档**（自适应解析不出结果时用），
     但它不再是默认值。 */
export function visualSkillDefaultRatio() {
  return HOME_ADAPTIVE_RATIO;
}

/* ⚠️ 2026-09-19 批 I-9：上限 4 → **16**（两处都要改：预估与建 run）。
   原因：「包含模块」那条链打通之后，A+ 内容勾满 16 个模块就是 16 张，
   而这里一直夹在 4 —— 于是第 5 张开始 updateVisualRunSlot 直接抛
   RangeError('visual run slot is out of range')，整条链路崩在中间。
   ⚠️ 4 是**自由创作那条流**的档位上限（它的 stepper 最多就是 4），不是服务端限制：
      出图是一个请求一张、由前端循环驱动，服务端没有"一次几张"的概念。
      所以抬这条不会放宽自由创作（它的 count 到不了 4 以上），只是让技能那条链能跑满。 */
export function visualGenerationEstimate({ imageModel = DEFAULT_IMAGE_MODEL, resolution = '2K', count = 1 } = {}) {
  const unitsPerImage = generationUnits(imageModel, resolution) || 0;
  const quantity = Math.max(1, Math.min(16, Number.parseInt(count, 10) || 1));
  return {
    points: Number(((unitsPerImage * quantity) / 1000).toFixed(3)),
    unitsPerImage,
    quantity,
  };
}

export function createVisualRun({ runId, count = 1, createdAt = Date.now() } = {}) {
  const id = cleanString(runId) || `visual-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  /* 同上：4 → 16。少改这一处就会在"第 5 张"上抛 slot out of range（实测踩过）。 */
  const slotCount = Math.max(1, Math.min(16, Number.parseInt(count, 10) || 1));
  return {
    id,
    createdAt,
    slots: Array.from({ length: slotCount }, (_, index) => ({
      id: `${id}:${index + 1}`,
      requestKey: `${id}:${index + 1}`,
      status: 'pending',
      url: '',
      taskId: '',
      error: '',
    })),
  };
}

export function updateVisualRunSlot(run, slotIndex, patch = {}) {
  if (!run || !Array.isArray(run.slots)) throw new TypeError('visual run is required');
  const index = Number(slotIndex);
  if (!Number.isSafeInteger(index) || index < 0 || index >= run.slots.length) {
    throw new RangeError('visual run slot is out of range');
  }
  return {
    ...run,
    slots: run.slots.map((slot, currentIndex) => currentIndex === index ? {
      ...slot,
      ...patch,
      id: slot.id,
      requestKey: slot.requestKey,
    } : slot),
  };
}

export function visualPendingIndexes(run) {
  return (run?.slots || []).flatMap((slot, index) => slot.status === 'pending' ? [index] : []);
}

export function visualRetryIndexes(run) {
  return (run?.slots || []).flatMap((slot, index) => slot.status === 'failed' ? [index] : []);
}

export function visualRunIsBusy(run) {
  return (run?.slots || []).some(slot => slot.status === 'uploading' || slot.status === 'generating');
}

export function buildVisualWorkRecord({
  run,
  prompt = '',
  skillId = 'free',
  model = DEFAULT_IMAGE_MODEL,
  ratio = '1:1',
  resolution = '2K',
  referenceAssets = [],
  skillControl = '',
  panelValues = {},
} = {}) {
  if (!run?.id || !Array.isArray(run.slots)) throw new TypeError('visual run is required');
  const completedSlots = run.slots.filter(slot => slot.status === 'completed' && isPersistentEcommerceImageUrl(slot.url));
  if (!completedSlots.length) throw new Error('没有可保存的稳定图片');
  const skill = visualSkillById(skillId);
  const images = completedSlots.map((slot, index) => ({
    id: slot.taskId || slot.id,
    key: `visual_${index + 1}`,
    assetId: slot.taskId || '',
    label: `${skill.title} ${index + 1}`,
    displayName: `${skill.title} ${index + 1}`,
    url: slot.url,
    role: 'visual_creation',
    group: '自由创作',
    ratio,
    resolution,
    requestKey: slot.requestKey,
    taskId: slot.taskId || '',
  }));
  const generationStatus = completedSlots.length === run.slots.length ? 'completed' : 'needs_review';
  return {
    id: run.id,
    taskId: run.id,
    _saveKey: run.id,
    _ecResult: true,
    workType: 'visual',
    product_name: skill.title,
    title: skill.title,
    category: '自由创作',
    platform: '自由创作',
    prompt: cleanString(prompt),
    visualSkillId: skill.id,
    imageModel: model,
    ratio,
    resolution,
    generationStatus,
    createdAt: run.createdAt,
    referenceAssets: Array.isArray(referenceAssets) ? referenceAssets : [],
    images,
    imageRecords: images,
    replay: {
      creationIntent: 'visual',
      skillId: skill.id,
      skillControl: cleanString(skillControl),
      panelValues: panelValues && typeof panelValues === 'object' ? { ...panelValues } : {},
      prompt: cleanString(prompt),
      originalPrompt: cleanString(prompt),
      imageModel: model,
      ratio,
      resolution,
      referenceAssets: Array.isArray(referenceAssets) ? referenceAssets : [],
      slots: images.map(image => ({ taskId: image.taskId, requestKey: image.requestKey, url: image.url })),
    },
  };
}

export function buildVisualCanvasResult(work, { importId } = {}) {
  const imageRecords = Array.isArray(work?.imageRecords) ? work.imageRecords : Array.isArray(work?.images) ? work.images : [];
  return {
    ...work,
    _ecResult: true,
    workType: 'visual',
    images: Object.fromEntries(imageRecords.map((image, index) => [image.key || `visual_${index + 1}`, image.url])),
    imageRecords,
    productAssets: [],
    referenceAssets: Array.isArray(work?.referenceAssets) ? work.referenceAssets : [],
    canvasImportId: importId || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  };
}
