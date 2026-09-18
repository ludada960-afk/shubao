/* ═══ 图片板块的 Skill 声明（单一事实源）═══════════════════════════════════════
   依据 docs/design/43-media-architecture.md §5 与 docs/design/44-p1c-image-hub-brief.md；
   能力盘参照竞品目录接口（2026-09-16 实访，104 个应用 / 8 个分组）——**参照结构，不抄表达**。

   ⚠️ 不声明「模型」字段：模型由路由层按 capability 注入（43 §5.3），
      在图片侧台账补齐前，运行层只认 image2（见 src/skills/skillRun.js）。
   ⚠️ availability 如实标注：'ready' = 现有链路已验证；'needs_ref' = 依赖参考图/图生图
      （链路已声明支持、尚未实测出片）。不许把没验证的写成能用。
   ⚠️ brief 是这个 skill 的**提示词模板**：{{字段key}} 会被工作台填进去。
      新增 skill 仍然只需要加一条声明，不写页面、不写控件。 */

export const SKILL_COMPLEXITIES = ['simple', 'standard', 'heavy'];
/* counts：一组「类型 × 张数」的步进器（2026-09-19 用户批注 #13）。
   竞品套图工作台选中「自定义配置」后展开的那组配置就是这个档位 ——
   它不是"另一个 stepper"，因为它一次渲染多行、并且自带一行合计。 */
export const FIELD_KINDS = ['select', 'segmented', 'stepper', 'textarea', 'text', 'slot', 'upload', 'counts'];
export const IMAGE_PIPELINES = [
  'visualCreation',   // 自由创作/海报/封面的既有链路（含参考图，单图同步）
  'ecommerceSuite',   // 电商套图（多分钟、多资产、带方案确认的既有流水线）
  'builtinSkill',     // 现有内置任务技能的画法（白底 / 试穿 / 场景 / 材质 / 多角度）
  'xhsNote',          // 小红书种草图文（既有 SSE 链路）
];

/* 共用档位：同一批选项只有一份定义（页面里不许再写第二份）。
   注意：只有 ratio / clarity 的 value 是机器可读的（要直接下发给引擎），
   其余选项的 value 就是中文本身 —— 它们只被填进提示词，不参与协议。 */
const RATIO = [
  { value: '1:1', label: '1:1 方图' },
  { value: '3:4', label: '3:4 竖版' },
  { value: '4:3', label: '4:3 横版' },
  { value: '9:16', label: '9:16 竖屏' },
  { value: '16:9', label: '16:9 横屏' },
];
const CLARITY = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
];

/* 这两个字段在 20 多条技能里重复出现，**只能有一份定义**（含默认值）。
   默认值必须与 skillRun.js 的回落值一致：界面显示什么，就跑什么。 */
const ratioField = (options = RATIO) => ({ key: 'ratio', label: '比例', kind: 'segmented', group: '生成设置', options, required: true, default: options[0].value });
/* ⚠️ 竞品图片复刻页的比例是 **16 档**（自适应 / 1:1 / 3:2 / 2:3 / 16:9 / 9:16 / 5:4 / 4:5 / 4:3 / 3:4 /
   21:9 / 9:21 / 1:3 / 3:1 / 2:1 / 1:2）。我们**不能**照抄这 16 档 ——
   服务端对比例有白名单（skillRun.LEGAL_RATIOS 六个值），非法值会被**静默回落成 1:1**，
   多写一档就是给用户挖坑（RTK 批次三十六已定性）。
   所以这里只放白名单里的档位，并在字段 hint 里如实写明"引擎支持这几种"。 */

/* ═══ 2026-09-18 批 F：跨境字段的**全部选项照竞品实测原文**══════════════════════════
   依据：CDP 实测（一次一标签、抓完即关），逐条原文见 docs/design/50-quantv-subpage-field-spec.md。
   用户原话：「你要真的去抓他们的字段名、全部选项、上传位数、按钮价格、编号交付清单，
   然后照着做，不要凭想象。」
   所以这三张表是**量出来的**，不是我想出来的：
     · 目标市场 9 档（套图版）/ 13 档（A+、详情图版，多出巴西·阿根廷·智利·墨西哥）
     · 目标平台 5 档（套图版淘宝在最前；详情图版京东在拼多多前 —— 顺序也照他们）
     · 语言 13 档 + 「无文字」（A+ 的原文里那一档就叫「无文字」；
       套图叫「无文字」，详情图没有这一档）
   ⚠️ 它们**只进提示词**，不改变引擎协议 —— 市场影响文案与合规习惯，语言决定画面里的文字。
      所以加档位是安全的（不会像比例那样被服务端静默回落）。 */
const MARKET_BASE = [
  { value: '中国', label: '中国' }, { value: '美国', label: '美国' }, { value: '欧洲', label: '欧洲' },
  { value: '东南亚', label: '东南亚' }, { value: '日本', label: '日本' }, { value: '韩国', label: '韩国' },
];
const MARKET_WIDE = [
  { value: '中国', label: '中国' }, { value: '欧洲', label: '欧洲' }, { value: '东南亚', label: '东南亚' },
  { value: '美国', label: '美国' }, { value: '日本', label: '日本' }, { value: '韩国', label: '韩国' },
  { value: '南非', label: '南非' }, { value: '新加坡', label: '新加坡' }, { value: '巴西', label: '巴西' },
  { value: '阿根廷', label: '阿根廷' }, { value: '智利', label: '智利' }, { value: '墨西哥', label: '墨西哥' },
  { value: '俄罗斯', label: '俄罗斯' },
];
/* 套图的目标市场是 9 档（含南非/新加坡/俄罗斯），A+ 与详情图是 13 档 —— 两版都照原文收着 */
const MARKET_SUITE = [
  { value: '中国', label: '中国' }, { value: '美国', label: '美国' }, { value: '欧洲', label: '欧洲' },
  { value: '东南亚', label: '东南亚' }, { value: '日本', label: '日本' }, { value: '韩国', label: '韩国' },
  { value: '南非', label: '南非' }, { value: '新加坡', label: '新加坡' }, { value: '俄罗斯', label: '俄罗斯' },
];
const LANGUAGE_FULL = [
  { value: 'English', label: 'English' }, { value: '简体中文', label: '简体中文' }, { value: '日本語', label: '日本語' },
  { value: '俄语', label: '俄语' }, { value: '韩语', label: '韩语' }, { value: '法语', label: '法语' },
  { value: '德语', label: '德语' }, { value: '泰语', label: '泰语' }, { value: '巴西语', label: '巴西语' },
  { value: '西班牙语', label: '西班牙语' }, { value: '越南语', label: '越南语' }, { value: '马来西亚语', label: '马来西亚语' },
  { value: '繁体中文', label: '繁体中文（必须使用2K及以上）' },
];
const PLATFORM_SUITE = [
  { value: '淘宝', label: '淘宝' }, { value: '抖音', label: '抖音' }, { value: '小红书', label: '小红书' },
  { value: '拼多多', label: '拼多多' }, { value: '京东', label: '京东' },
];
const PLATFORM_WIDE = [
  { value: '淘宝', label: '淘宝' }, { value: '抖音', label: '抖音' }, { value: '小红书', label: '小红书' },
  { value: '京东', label: '京东' }, { value: '拼多多', label: '拼多多' },
];
/* 市场/语言用下拉（竞品是 select —— 9~13 档用 segmented 会撑成两三行药丸，
   那是"我们自己的长相"，不是他们的）。 */
const marketField = (options = MARKET_BASE) => ({ key: 'market', label: '目标市场', kind: 'select', group: '基础信息', options, default: options[0].value });
const languageField = (label = '文案语言', options = LANGUAGE_FULL) => ({ key: 'language', label, kind: 'select', group: '基础信息', options, default: options[0].value });
const platformField = (options = PLATFORM_SUITE) => ({ key: 'platform', label: '目标平台', kind: 'select', group: '基础信息', options, default: options[0].value });
const clarityField = () => ({ key: 'clarity', label: '分辨率', kind: 'segmented', group: '生成设置', options: CLARITY, required: true, default: '2K' });
const countField = (max = 6) => ({ key: 'count', label: '生成数量', kind: 'stepper', group: '生成设置', min: 1, max });
/* 上传位的组名照竞品：他们的上传区就在「基础信息 → 上传图片」这一块里 */
/* 上传位：竞品在它下面还跟一串同组的字段（产品卖点 / 设计风格…），
   所以 uploadField 允许带一个 after（同组、紧跟其后的字段），顺序与竞品一致。 */
function uploadField({ after = [], ...extra } = {}) {
  const base = { key: 'assets', label: '素材', kind: 'upload', group: '上传图片', required: true, role: 'product', slotLabel: '上传商品图', ...extra };
  return after.length ? [base, ...after] : base;
}
/* 设计风格：竞品是三选一分段（AI推荐 / 参考排版 / 自定义要求），
   选中之后下面才是「AI推荐风格分析 · 0.10 积分」那颗付费按钮。
   ⚠️ 分析与出图是**两个付费动作**（他们 0.10 / 0.10，我们 0.2 / 按张）——
      这里只声明"有这一档"，按钮与计价落在工作台（价款必须写在按钮上）。 */
function styleFields(group) {
  return [
    { key: 'style', label: '设计风格', kind: 'segmented', group,
      options: [
        { value: 'AI推荐', label: 'AI推荐' },
        { value: '参考排版', label: '参考排版' },
        { value: '自定义要求', label: '自定义要求' },
      ], default: 'AI推荐' },
    /* ═══ 2026-09-19 批 I-8（用户批注 #2-1 / #3-1）：**切换必须真的换出东西** ═══════════════
       用户原话：「他们这里是有切换按钮的，你为什么切换按钮点了是没有反应的呢？」
       「你看，你应该每个skill工作台都去深度点击，看看他们各个按钮下面是什么反馈啊，
         **他这里切换过来是有上传区和设计要求这些元素的呀**。」
       根因：这颗「自定义风格要求」原来**一直挂在字段表里** —— 于是点「AI推荐」它也在这儿、
       点「自定义要求」它还是原样，用户看到的就是"这个切换点了没反应"。
       现在它只在选中「自定义要求」时才出现（visibleWhen 的判据写在声明源里，
       与 imageSkills 里「自定义配置」那条同源，不散在页面里）。 */
    { key: 'styleNote', label: '自定义风格要求', longLabelReason: '照竞品原文（他们那颗三选一里就叫「自定义要求」，我们补全成"自定义风格要求"以免和别处的"要求"混）', kind: 'textarea', rows: 2, group,
      visibleWhen: { key: 'style', equals: '自定义要求' },
      placeholder: '选「自定义要求」时写在这里，例如：奶油白背景、柔光棚拍、右上角留白放标题' },
  ];
}

export const IMAGE_SKILLS = [
  /* ── 精品推荐：推荐位，封面只用图、不烤字（实测口径）──────────────────────── */
  {
    id: 'image.free', board: 'image', name: '自由创作', category: '创意应用', complexity: 'simple',
    cover: { template: 'hero-single', accent: 'neutral' },
    summary: '一句话起步，画面方向自己定', pipeline: 'visualCreation', availability: 'ready',
    visual: 'free',
    brief: '自由创作：{{prompt}}。画面要有一个明确的视觉焦点，空间关系可信，光线有来处，配色克制统一；不要出现水印、logo、二维码或价格文字。',
    fields: [
      { key: 'prompt', label: '描述', kind: 'textarea', rows: 4, required: true, placeholder: '例如：清晨的窗边，一杯冒热气的咖啡' },
      ratioField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 6 },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.poster', board: 'image', name: '海报设计', category: '创意应用', complexity: 'simple',
    cover: { template: 'poster-style', accent: 'warm' },
    summary: '先立主视觉，再排信息层级', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '设计一张海报。主题：{{topic}}。画面：{{prompt}}。要求：单一视觉焦点、清晰的信息层级与阅读顺序，并留出安全的标题区；画面内的文字必须逐字准确，不得臆造文案、日期、价格或 logo。',
    fields: [
      { key: 'topic', label: '主题', kind: 'text', required: true, placeholder: '例如：夏夜爵士音乐节' },
      { key: 'prompt', label: '描述', kind: 'textarea', rows: 3 },
      ratioField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 6 },
    ],
    cases: [
      { id: 'tide', title: '潮汐标本 · 海岸线上的时间档案', cover: '/images/visual-recipes/cases/poster-tide-exhibition.png' },
    ], history: true,
  },
  {
    id: 'image.social_cover', board: 'image', name: '社媒封面', category: '创意应用', complexity: 'simple',
    cover: { template: 'poster-style', accent: 'accent' },
    summary: '缩略图里也看得清主题', pipeline: 'visualCreation', availability: 'ready',
    visual: 'social-cover',
    brief: '做一张社媒封面。主题：{{topic}}。画面：{{prompt}}。要求：缩到手机缩略图仍能一眼看懂主题，构图紧凑、焦点明确、留出安全的标题区；不要堆砌元素，不要出现二维码或水印。',
    fields: [
      { key: 'topic', label: '主题', kind: 'text', required: true },
      { key: 'prompt', label: '描述', kind: 'textarea', rows: 3 },
      ratioField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 6 },
    ],
    cases: [], history: true,
  },
  {
    featuredRank: 1,
    id: 'image.product_suite', board: 'image', name: '商品套图', category: '精品推荐', complexity: 'heavy',
    /* 一键解析（照竞品做法：付费前置动作）。我们用现成的 /api/ecommerce/auto-recognize
       （视觉识别 + LLM 结构化），计费 SKU 是既有的 ec_ai_assistant = 200 units = **0.2 积分**，
       与竞品的 0.20 积分一致。fills 指向它回填哪个字段。 */
    parse: { fills: 'productParams', label: '一键解析商品信息' },
    cover: { template: 'case-3up', accent: 'warm' },
    summary: '主图、场景图、卖点图成套交付', pipeline: 'ecommerceSuite', availability: 'ready',
    visual: 'free',
    brief: '围绕商品生成一套电商图。商品信息：{{productParams}}。目标市场：{{market}}；画面内文案语言：{{language}}。要求：先确保商品本身的结构、颜色、材质与文字被完整保留，再谈场景与氛围；符合{{platform}}的图片规范与目标市场的审美习惯。',
    /* 字段顺序 = 竞品实测顺序：上传图片 → 目标市场 → 目标平台 → 文案语言 →
       产品卖点与设计风格。分组名也照他们的区块名。 */
    fields: [
      uploadField({ maxImages: 6 }),
      marketField(MARKET_SUITE),
      platformField(PLATFORM_SUITE),
      languageField('文案语言', LANGUAGE_FULL.concat([{ value: '无文字', label: '无文字' }])),
      /* ⚠️ 商品参数的真实 key 是 productParams（buildSuiteRun 从它的**第一行**取商品名），
         只有界面 label 改成竞品那份措辞 —— 改 key 会让套图拿不到商品名。 */
      { key: 'productParams', label: '产品卖点', kind: 'textarea', rows: 5, group: '产品卖点与设计风格', maxLength: 2000,
        placeholder: '产品名：\n核心卖点：\n适用人群：\n期望场景：\n尺寸参数：' },
      ...styleFields('产品卖点与设计风格'),
      /* 结构/规格是套图专有的重配置：默认按平台智能匹配，自定义面板在套图工作台里 ——
         这里如实说明，不做一个点了没反应的按钮 */
      /* ═══ 套图结构配置（2026-09-19 用户批注 #12 / #13 逐条照竞品）══════════════════════
         批注 #12：「你看它下面是什么东西？下面明明是智能匹配和自定义配置呀，你搞的是什么呀」
         批注 #13：「而且自定义配置选中之后，里面还有其他的配置可以做呀，这些你都没深度的调研吗」
         竞品实测：两张**大卡**（不是下拉、不是说明行）——
           · 智能匹配：AI智能分析商品图，匹配合适的 Listing 套图
           · 自定义配置：可自由调整各类型图片数量，至少选择 7 张
         选中「自定义配置」→ 下面展开按类型的张数步进器（他们：白底图 1 / 场景图 3 / 卖点图 3 /
         其他 0，末尾一行「当前共 7 张，至少 7 张」）。
         ⚠️ 与竞品的一处**有意差异**：他们的类型叫「白底图 / 场景图 / 卖点图 / 其他」，
            我们的类型由方案真源 IMAGE_TYPES 决定（白底首图 / 商品主图 / 透明 PNG / 详情图）——
            张数与报价都按这四个类型算，抄他们的名字会让面板与服务端方案对不上（钱的事）。 */
      { key: 'structure', label: '套图结构', kind: 'segmented', group: '套图结构配置', default: '智能匹配',
        options: [
          { value: '智能匹配', label: '智能匹配' },
          { value: '自定义配置', label: '自定义配置' },
        ],
        hint: '智能匹配：AI 按商品图与平台自动匹配合适的套图结构；自定义配置：自己定各类型出几张' },
      /* ⚠️ 2026-09-19 批 G：这一组此前**只是显示**（没有消费者、没有默认值、没有校验），
          用户看到的是一排 0 且改了不影响出图 —— 典型的「装出来的功能」。本轮三处一起补：
            ① 每行给 default（白底 1 / 主图 3 / 透明 1 / 详情 2 = **7 张**，与竞品「至少 7 张」同档）；
            ② minTotal 提到 7，合计不足时 validateSkillInput 会拦住 CTA 并说明差多少；
            ③ skillRun.buildSuiteRun 把它当套图的图集来源（张数/报价/服务端方案三者同源）。 */
      { key: 'structureCounts', label: '各类型张数', kind: 'counts', group: '套图结构配置',
        visibleWhen: { key: 'structure', equals: '自定义配置' },
        required: true,
        minTotal: 7,
        rows: [
          { key: 'white_bg', label: '白底首图', hint: '纯白底产品居中，电商必选', max: 3, default: 1 },
          { key: 'main_text', label: '商品主图', hint: '核心卖点展示，可含促销文字', max: 5, default: 3 },
          { key: 'transparent', label: '透明 PNG', hint: '去底素材，方便二次设计', max: 3, default: 1 },
          { key: 'detail', label: '详情图', hint: '长图讲清卖点与参数', max: 6, default: 2 },
        ] },
      { key: 'skus', label: '规格', kind: 'slot', group: '套图结构配置', slotLabel: '编辑规格与张数', hint: '自定义 SKU 变体在套图工作台里配' },
    ],
    cases: [
      { id: 'scene', title: '场景卖点主图', cover: '/gallery/ecommerce/stainless-steel-sauce-container/01.webp' },
      { id: 'usage', title: '真实使用详情图', cover: '/gallery/ecommerce/stainless-steel-sauce-container/02.webp' },
      { id: 'size', title: '尺寸对比详情图', cover: '/gallery/ecommerce/stainless-steel-sauce-container/03.webp' },
    ], history: true,
  },

  {
    featuredRank: 2,
    id: 'image.aplus', board: 'image', name: 'A+内容', category: '精品推荐', complexity: 'standard',
    parse: { fills: 'product', label: '一键解析商品信息' },
    cover: { template: 'case-3up', accent: 'accent' },
    summary: '图文并排的模块图，把卖点讲清楚', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'poster',
    brief: '做一套 A+ 内容模块图。商品与卖点：{{productParams}}。设计风格：{{style}}。目标市场：{{market}}；目标平台：{{platform}}；画面内文案语言：{{language}}。要求：横向构图，图文并排（左图右文或上图下文），信息层级清楚、留出安全的文字区；画面内的文字必须逐字准确，不得臆造文案、参数、认证标识或 logo；商品本身的结构、颜色、材质与包装文字必须完整保留。',
    /* 字段顺序与措辞照竞品 A+ 页实测：上传图片 → 目标市场 → 目标平台 → 输出语言 →
       产品卖点与设计风格（核心卖点 + 爆款风格）。 */
    fields: [
      uploadField({ maxImages: 6 }),
      marketField(MARKET_WIDE),
      platformField(PLATFORM_WIDE),
      languageField('输出语言', LANGUAGE_FULL),
      { key: 'productParams', label: '核心卖点', kind: 'textarea', rows: 5, group: '产品卖点与设计风格', required: true,
        placeholder: '产品名：\n核心卖点：\n适用人群：\n期望场景：\n尺寸参数：' },
      { key: 'style', label: '爆款风格', kind: 'segmented', group: '产品卖点与设计风格', default: 'AI推荐',
        options: [
          { value: 'AI推荐', label: 'AI推荐' },
          { value: '参考/自定义风格', label: '参考/自定义风格' },
        ] },
      /* 批 I-8：切到「参考/自定义风格」要有东西换出来（用户批注 #2-1 指着竞品那句
         「他这里切换过来是有上传区和设计要求这些元素的呀」）。
         竞品那边换出来的是「风格/排版参考图（0/5）」上传区 + 「设计要求」输入框；
         我们这一条技能本来就有上传位与自定义要求这两个字段，只是**原来没有跟切换联动**，
         所以点上去像死按钮。这里把「自定义风格要求」挂到这一档上。 */
      { key: 'styleNote', label: '自定义风格要求', longLabelReason: '照竞品原文（他们那颗两选一里叫「参考/自定义风格」，写要求的那一栏叫「自定义要求」），沿用 styleFields 那份同名措辞，两边不各写一套。', kind: 'textarea', rows: 2, group: '产品卖点与设计风格',
        visibleWhen: { key: 'style', equals: '参考/自定义风格' },
        placeholder: '参考哪一套排版/风格，或直接写要求：奶油白背景、柔光棚拍、右上角留白放标题' },
      /* ═══ 2026-09-19 批 I-10：这里**删掉了整块「生成设置」（比例 + 数量）**══════════════════
         用户批注 #3-2 原话：「而且这个**生成设置又是什么鬼**啊，**人家没有这个呀**，
           选中多少个模块就是多少张，并且对应他自己的模块主题不是吗，
           为什么要自己写多少张的数量呢？**比例的话我不懂，这个你要深度对比竞品和自己的skill去决定吧**。」
         我按用户的要求去对比了 —— **证据在我们自己的拆解文档里**（docs/design/50 第 214 行，
         CDP 实访竞品的 A+ 页）：竞品 A+ 的字段只有
           「目标市场 13 档 · 输出语言 14 档 · 包含模块 已选 0/16 · 爆款风格两档」
         —— **没有比例，也没有生成数量**。
         （同文档第 144 行的「生成设置 · 比例 16 档」是**另一个**页面（图片复刻）的，
           不是 A+ 的。所以"竞品有没有比例"这件事要按页面分开看，不能一刀切。）
         为什么 A+ 可以不要比例：这一套是 **16 个模块各自成图**，比例由模块自己的主题决定
         （首屏主视觉 / 卖点图 / 场景图 各有各的构图），给一个"全套统一比例"的旋钮本来就是假的。
         数量上一批已经删了（勾几个模块出几张）。
         ⚠️ 内部仍按 skillGenerationSettings 的默认值 1:1 下发 —— 服务端白名单之外的值会被
            **静默回落**，所以宁可留一个已知合法的默认，也不能让请求带空值。
         ⚠️ **只改 A+**：其它技能的比例档位不动（竞品别的页面确实有比例，见 50 号文档 144/183 行）。 */
    ],
    /* ═══ 「包含模块」：竞品 A+ 页那 16 条，**逐条原文**照抄（名称 + 它自己那句说明）═══
       实测来源见 docs/design/50-quantv-subpage-field-spec.md（CDP 实访，一次一标签）。
       他们那边是**可勾选**的（已选 0/16，勾几个出几个、价钱跟着变）；
       我们的张数与报价由方案算死（服务端建 hold 前会校验报价），照抄成可勾选会让
       报价与产出对不上 —— 这是钱的问题，所以做成**只读**清单（RTK 批次三十六已定性，
       门禁 test/workbench-quantv-parity-0918 第 ④ 条守着"不许照抄可勾选模块"）。
       清单内容与顺序照他们的 16 条，一条不少。 */
    modules: [
      { name: '首屏主视觉', hint: '传递核心价值' },
      { name: '核心卖点图', hint: '突出差异化优势' },
      { name: '使用场景图', hint: '呈现真实使用场景' },
      { name: '多角度图', hint: '多角度呈现外观' },
      { name: '场景氛围图', hint: '展示使用场景' },
      { name: '商品细节图', hint: '放大材质与工艺' },
      { name: '品牌故事图', hint: '传达品牌理念' },
      { name: '尺寸/容量/尺码图', hint: '展示规格信息' },
      { name: '效果对比图', hint: '使用前后效果对比' },
      { name: '详细规格/参数表', hint: '展示详细商品数据' },
      { name: '工艺制作图', hint: '展示工艺制作过程' },
      { name: '配件/赠品图', hint: '明确收货的所有物品' },
      { name: '系列展示图', hint: '多色或多SKU展示' },
      { name: '商品成分图', hint: '展示配方/材质/成分' },
      { name: '售后保障图', hint: '说明质保退换政策' },
      { name: '使用建议图', hint: '商品使用的注意事项' },
    ],
    /* 示例区的编号清单照竞品 A+ 页实测：01 功能总览图 02 技术细节图 03 生活方式图
       04 品牌主视觉 05 场景展示图 06 品牌故事图 */
    deliverables: [
      { name: '功能总览图', hint: '把产品的几项核心功能一次讲完' },
      { name: '技术细节图', hint: '放大结构、材质与做工' },
      { name: '生活方式图', hint: '放进真实使用场景' },
      { name: '品牌主视觉', hint: '统一的品牌调性与留白' },
      { name: '场景展示图', hint: '把商品放进它真正被使用的环境' },
      { name: '品牌故事图', hint: '讲清这个品牌为什么做这件产品' },
    ],
    cases: [], history: true,
  },
  {
    featuredRank: 3,
    id: 'image.detail_page', board: 'image', name: '详情图', category: '精品推荐', complexity: 'standard',
    parse: { fills: 'product', label: '一键解析商品信息' },
    cover: { template: 'poster-style', accent: 'warm' },
    summary: '首屏、卖点、成分、参数，逐屏出图', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'poster',
    brief: '做一套电商详情页的模块图。商品与卖点：{{productParams}}。风格取向：{{style}}。目标市场：{{market}}；目标平台：{{platform}}；画面内文案语言：{{language}}。要求：竖版长图构图，信息层级清楚（标题 → 主图 → 说明），阅读顺序自然；画面内文字逐字准确、不臆造；商品的结构、颜色、材质与包装文字必须完整保留。',
    /* 字段顺序与措辞照竞品详情图页实测：上传图片 → 目标市场 → 目标平台 → 输出语言 →
       产品卖点与设计风格（核心卖点 + 爆款风格）。 */
    fields: [
      uploadField({ maxImages: 6 }),
      marketField(MARKET_WIDE),
      platformField(PLATFORM_WIDE),
      languageField('输出语言', LANGUAGE_FULL),
      { key: 'productParams', label: '核心卖点', kind: 'textarea', rows: 5, group: '产品卖点与设计风格', required: true,
        placeholder: '建议包含以下信息生成更精准：\n1.产品名称\n2.核心卖点\n3.适用人群\n4.期望场景\n5.尺寸参数' },
      { key: 'style', label: '爆款风格', kind: 'segmented', group: '产品卖点与设计风格', default: '爆款风格',
        options: [
          { value: '爆款风格', label: '爆款风格' },
          { value: '参考/自定义风格', label: '参考/自定义风格' },
        ] },
      ratioField(),
      countField(6),
    ],
    /* 竞品详情图页的示例清单是「01 高效率销售转化详情页 02 场景氛围与情感共鸣详情页
       03 医学专研与极简信任详情页 04 产品规格参数图」——我们按单屏模块如实列。 */
    deliverables: [
      { name: '高效率销售转化详情页', hint: '首屏把卖点与购买理由说清' },
      { name: '场景氛围与情感共鸣详情页', hint: '把商品放进生活场景' },
      { name: '成分 / 材质说明详情页', hint: '讲清配方、材质与工艺' },
      { name: '产品规格参数图', hint: '尺寸、容量、型号一览' },
    ],
    cases: [], history: true,
  },

  /* ── 库里的爆款配方（第二批，2026-09-17）──────────────────────────────────
     全部来自 EvoLinkAI/awesome-gpt-image-2-API-and-Prompts（17,199★）的电商 / 广告创意用例，
     每条 brief 都是**照那条用例的原文结构**写的中文版（出处登记在 skillSources.js，
     原文提示词与自带素材在 docs/design/skill-recipe-library.json）。 */
  {
    id: 'image.live_ui', board: 'image', name: '直播带货主图', category: '电商专区', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'accent' },
    summary: '一张图做出直播间的界面感', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'poster',
    brief: '做一张直播带货主图（界面感）：画面主体是主播举着{{product}}对着镜头介绍，笑容自然、眼神看镜头；左右两侧是品牌色块与{{brand}}字样，底部压一条促销信息条，右上角留出人气/点赞的数字位。整体像直播截屏但更精致，画面内文字逐字准确、不得臆造价格与销量数字。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 3, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'brand', label: '品牌名', kind: 'text', required: true, placeholder: '出现在画面两侧的字' },
      ratioField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 4 },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.callout_diagram', board: 'image', name: '卖点标注图解', category: '电商专区', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'warm' },
    summary: '一根根引线把成分与卖点标出来', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '做一张卖点标注图解：{{product}}居中竖放，四周用细引线连到要强调的部位，每条引线配一行短标注——{{points}}。要求：标注排版整齐、指向准确、字号统一，背景干净；画面内文字逐字准确，不得臆造数据与认证标识。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'points', label: '标注点', kind: 'textarea', rows: 3, required: true, placeholder: '每行一条，例如：\n0 蔗糖\n真实果肉\n冷压工艺' },
      ratioField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.giant_product', board: 'image', name: '巨型产品广告', category: '电商专区', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'accent' },
    summary: '把人放进巨型商品的尺度里', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '极简商业广告：把{{product}}放大成巨型装置，人物以自然姿态倚靠或站在它旁边形成尺度反差；单色渐变背景，背景压一行巨大的品牌字{{brand}}，镜面地板带柔和反射，棚拍光干净通透。商品细节与包装文字必须清晰可辨。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 2, role: 'product', slotLabel: '上传商品图（可含人物参考）' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'brand', label: '品牌字', kind: 'text', required: true, placeholder: '背景那行大字' },
      ratioField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 4 },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.liquid_logo', board: 'image', name: '液态 Logo 海报', category: '创意应用', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'cool' },
    summary: '品牌 logo 变成一滩会流动的液体', pipeline: 'visualCreation', availability: 'ready',
    visual: 'brand-kv',
    brief: '做一张品牌主视觉：{{brand}}的 logo 变成一滩有体积的液态物质——**轮廓必须仍然是品牌 logo 本身**（不是圆形、不是随便一团），表面有水珠与飞溅细节；周围是动态水花，背景压一行巨大的{{brand}}字，整体像高定时尚大片。画面里的字样必须逐字准确。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传品牌 logo 或主视觉参考' },
      { key: 'brand', label: '品牌名', kind: 'text', required: true },
      ratioField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.landscape_logo', board: 'image', name: '地景 Logo 幻象', category: '创意应用', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'cool' },
    summary: '品牌形状藏进山川地貌里', pipeline: 'visualCreation', availability: 'ready',
    visual: 'brand-kv',
    brief: '做一张"潜意识广告"风景照：把{{brand}}的标志形状**藏进自然地貌本身**——由山脊、沙丘、海岸或雪原的走势自然构成，看起来像地形巧合，不是后期贴上去的图案；光线是自然环境光，画面里不出现任何文字与 logo 贴图。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传品牌标志参考（可选）' },
      { key: 'brand', label: '品牌名', kind: 'text', required: true },
      ratioField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.sticker_collage', board: 'image', name: '贴纸现实拼贴', category: '创意应用', complexity: 'simple',
    cover: { template: 'before-after', accent: 'soft' },
    summary: '在原图上贴满手绘贴纸与便签', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '保持照片的主体、构图与背景**完全不动**，把它改造成"贴纸现实"拼贴：在画面上叠一层像实体贴纸、纸片剪贴与胶带便签的元素，位置略带错位与重叠，像手工剪贴簿；再混入手绘涂鸦（图标、箭头、下划线）。贴纸边缘要有真实投影。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传要改造的照片' },
      { key: 'notes', label: '便签内容', kind: 'textarea', rows: 2, placeholder: '例如：NEW / 限时 / 主推款' },
      ratioField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.showroom_still', board: 'image', name: '展厅静物主视觉', category: '创意应用', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'neutral' },
    summary: '限定发售那种高级静物台面', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'brand-kv',
    brief: '做一张"展厅静物"主视觉，用来宣布限定发售：把{{product}}放在几何台面上，周围配少量呼应品牌的实物道具（{{props}}），背景是干净的展台墙面与柔和的顶光；配色以品牌色为主，构图克制、留白充足，像高端杂志的静物大片。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 2, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'props', label: '道具', kind: 'text', placeholder: '例如：金属托盘、亚克力方块、干花' },
      ratioField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.tropical_poster', board: 'image', name: '热带饮品海报', category: '电商专区', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'warm' },
    summary: '夏天汽水那种亮到发光的海报', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '做一张热带风饮品海报：{{product}}居中偏右、略微左倾，瓶身挂满冰凉水珠，内部液体透出光感；背景是明亮的热带色块与水果切片（{{fruits}}），底部压一行{{slogan}}。整体明亮、饱和度高、夏日氛围强，包装上的文字必须清晰准确。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'fruits', label: '水果元素', kind: 'text', placeholder: '例如：橙子、青柠、薄荷叶' },
      { key: 'slogan', label: '标语', kind: 'text', placeholder: '可选，逐字准确' },
      ratioField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.mono_pastel_ad', board: 'image', name: '单色糖果系广告', category: '电商专区', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'soft' },
    summary: '整张一个色，巨型品牌字压阵', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '做一张单色系商业海报：整张图只用一个色系（{{tone}}），背景是巨大的{{brand}}无衬线粗体字几乎顶满画面高度，{{product}}放在字前作为视觉焦点，地面是高反光镜面、有柔和倒影；右上角留一小块品牌标位。画面内文字逐字准确、不得臆造。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'brand', label: '品牌字', kind: 'text', required: true },
      { key: 'tone', label: '色系', kind: 'segmented', default: '冷调单色', options: [
        { value: '冷调单色', label: '冷调' }, { value: '暖调单色', label: '暖调' },
        { value: '粉调单色', label: '粉调' }, { value: '中性灰', label: '中性' },
      ] },
      ratioField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.grain_ad_board', board: 'image', name: '中式广告板', category: '电商专区', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'warm' },
    summary: '中文排版的电商广告板（一屏讲完）', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'poster',
    brief: '做一张中文电商广告板：{{product}}作为主视觉居右，左侧排中文标题{{title}}与三到四条短卖点（{{points}}），底部一条规格信息带（净含量 / 规格 / 卖点图标）；配色厚重（{{tone}}），中文用粗衬线或黑体、层级分明。所有中文必须逐字准确、笔画完整，不得臆造成分与认证。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 2, role: 'product', slotLabel: '上传商品图 / 包装图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'title', label: '中文主标题', kind: 'text', required: true, placeholder: '例如：核桃芝麻黑豆粉' },
      { key: 'points', label: '卖点', kind: 'textarea', rows: 3, placeholder: '每行一条短卖点' },
      { key: 'tone', label: '色调', kind: 'segmented', default: '黑金', options: [
        { value: '黑金', label: '黑金' }, { value: '米白', label: '米白' }, { value: '中国红', label: '中国红' },
      ] },
      ratioField(),
    ],
    cases: [], history: true,
  },

  /* ── 电商专区 ─────────────────────────────────────────────────────────── */
  {
    id: 'image.white_bg', board: 'image', name: '白底商品图', category: '电商专区', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'cool' },
    summary: '干净白底，多角度呈现细节', pipeline: 'builtinSkill', availability: 'ready',
    visual: 'free',
    brief: '生成干净的白底商品图：商品完整居中、边缘锐利、比例真实，柔和的棚拍光影带出材质与体积感，保留商品自身的颜色、结构与文字；不要添加道具、场景或任何文字。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 6, role: 'product', slotLabel: '上传商品图' },
      ratioField(),
      clarityField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 9 },
    ],
    cases: [
      { id: 'white', title: '标准识别白底图', cover: '/gallery/ecommerce/baby-bottle-product-suite/01.webp' },
    ], history: true,
  },
  {
    id: 'image.scene', board: 'image', name: '场景种草图', category: '电商专区', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'warm' },
    summary: '把商品放进真实使用场景', pipeline: 'builtinSkill', availability: 'ready',
    visual: 'free',
    brief: '把商品放进真实使用场景：{{scene}}。商品要保持可辨认的结构、颜色与材质，场景的光线、透视与投影要和商品对得上，像一张真实拍出来的生活照；不要出现文字或水印。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 6, role: 'product', slotLabel: '上传商品图' },
      { key: 'scene', label: '场景', kind: 'text', placeholder: '例如：周末早晨的厨房台面' },
      ratioField(),
      clarityField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 6 },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.material', board: 'image', name: '材质细节', category: '电商专区', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'cool' },
    summary: '放大材质与工艺，给出结构证据', pipeline: 'builtinSkill', availability: 'ready',
    visual: 'free',
    brief: '拍一张材质与工艺的细节特写，重点：{{focus}}。用微距级的景深与侧光把纹理、接缝与做工交代清楚，画面干净有质感；不要虚构商品上不存在的结构或接口。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 6, role: 'product', slotLabel: '上传商品图' },
      { key: 'focus', label: '重点', kind: 'text', placeholder: '例如：拉丝金属的纹理' },
      ratioField(),
      clarityField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 6 },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.multi_angle', board: 'image', name: '多角度套图', category: '电商专区', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'cool' },
    summary: '同一商品，多角度保持一致', pipeline: 'builtinSkill', availability: 'ready',
    visual: 'free',
    brief: '生成商品的多角度成套图，视角：{{angle}}。同一件商品在同一组光线与背景下的连拍感，比例、颜色与细节在各角度之间保持一致；不要改变商品结构。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 6, role: 'product', slotLabel: '上传商品图' },
      { key: 'angle', label: '角度', kind: 'segmented', required: true, options: [
        { value: '正面', label: '正面' }, { value: '侧面', label: '侧面' },
        { value: '背面', label: '背面' }, { value: '俯视', label: '俯视' },
      ] },
      ratioField(),
      clarityField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 6 },
    ],
    cases: [], history: true,
  },
  {
    featuredRank: 6,
    /* 命名对齐竞品（用户 9-18 批注 16）：「他们叫 AI 换装，我们也可以跟他们一样去叫 AI 换装」。 */
    id: 'image.try_on', board: 'image', name: 'AI换装', category: '精品推荐', complexity: 'standard',
    cover: { template: 'before-after', accent: 'soft' },
    summary: '把商品穿到模特身上，姿势场景可选', pipeline: 'builtinSkill', availability: 'ready',
    visual: 'free',
    brief: '把衣服穿到模特身上（{{mode}}）。补充要求：{{scene}}。保留模特的五官、身材比例与肤色；衣服要贴合身体、褶皱与垂坠自然，面料质感、图案与版型必须与衣服图一致，光线统一；不要改变衣服的颜色与图案。',
    /* ═══ 字段逐条照竞品实测（?tool=ai-outfit）══════════════════════════════════════
       模特选择（上传模特图 0/1）→ 服装选择（套装 / 多件）→ 上传衣服图 0/1 →
       Pose 参考（可选）→ 背景参考（可选）→ 模型 / 分辨率 / 比例 / 生成张数 1-4。
       上传文案原文：「点击或拖拽上传图片 · 支持 JPG、JPEG、PNG、WEBP，单张不超过 10 MB」
       ＋可选位写「可选素材，不上传也可生成」。
       ⚠️ 模特图必须排在**第一个 upload 位**：skillImages 取第一个位当主图（image_url），
          这条链路的语义是"把衣服穿到这个模特身上"，模特才是底图。
          竞品也是这么排的（模特在上、衣服在下）。 */
    fields: [
      { key: 'model', label: '上传模特图', kind: 'upload', group: '模特选择', maxImages: 1, role: 'person', required: true,
        slotLabel: '点击或拖拽上传图片', hint: '模特底图：衣服会穿到这张图上的人身上' },
      { key: 'mode', label: '服装选择', kind: 'segmented', group: '服装选择', default: '套装',
        options: [{ value: '套装', label: '套装' }, { value: '多件', label: '多件' }] },
      { key: 'assets', label: '上传衣服图', kind: 'upload', group: '服装选择', maxImages: 1, role: 'product', required: true,
        slotLabel: '点击或拖拽上传图片', hint: '要穿上去的衣服：真实面料、图案与版型要保住' },
      { key: 'pose', label: '上传姿势参考图', longLabelReason: '照竞品原文逐字（他们 ?tool=ai-outfit 的上传位标题就叫这个）', kind: 'upload', group: 'Pose 参考（可选）', maxImages: 1, role: 'reference',
        slotLabel: '点击或拖拽上传图片', hint: '可选素材，不上传也可生成' },
      { key: 'backdrop', label: '上传背景参考图', longLabelReason: '照竞品原文逐字（他们 ?tool=ai-outfit 的上传位标题就叫这个）', kind: 'upload', group: '背景参考（可选）', maxImages: 1, role: 'scene',
        slotLabel: '点击或拖拽上传图片', hint: '可选素材，不上传也可生成' },
      { key: 'scene', label: '补充要求', kind: 'textarea', rows: 3, group: '生成设置',
        placeholder: '例如：城市清晨的街道，自然光，模特站着回头看镜头' },
      ratioField(),
      clarityField(),
      { key: 'count', label: '生成张数', kind: 'stepper', group: '生成设置', min: 1, max: 4 },
    ],
    cases: [
      { id: 'source', title: '商品与模特原图', cover: '/images/home/ability-tryon-example-input.png' },
      { id: 'result', title: 'AI 试穿成品', cover: '/images/home/ability-tryon-example-output.png' },
    ], history: true,
  },
  {
    /* tier: assistant —— "批量"是**执行方式**（一次出多张），素材结构本身就是套图的变体；
       用户不会为了"批量"单独进一个页面，他是在套图/多角度里选一次出几张。 */
    tier: 'assistant', belongsTo: 'image.product_suite',
    /* 融合形态：**控件**。批量不是一种玩法，是"这一次出几张" —— 它长在各主技能的「数量」控件上
       （21 条主技能已声明），张数与报价同源（skillGenerationSettings.count + skillPointsEstimate）。 */
    fuses: {
      slot: 'field', into: ['*'], label: '数量',
      note: '批量＝各技能里的「数量」控件：一次出 N 张，报价按 N 倍算，扣费在点生成时发生',
    },
    id: 'image.batch', board: 'image', name: '批量商品图', category: '电商专区', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'warm' },
    summary: '商品＋角色＋场景三份素材批量出图', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '用商品图、人物图与场景图合成电商成品图。补充要求：{{prompt}}。三份素材的主体特征都要保留：商品不变形、人物五官不漂移、场景光线与主体一致；不要出现文字。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 2, role: 'product', slotLabel: '上传商品图' },
      { key: 'character', label: '角色', kind: 'upload', maxImages: 2, role: 'person', slotLabel: '上传人物图' },
      { key: 'backdrop', label: '场景', kind: 'upload', maxImages: 2, role: 'scene', slotLabel: '上传场景图' },
      { key: 'prompt', label: '要求', kind: 'textarea', rows: 3 },
      ratioField(),
      clarityField(),
    ],
    cases: [], history: true,
  },

  /* ── 爆款配方（2026-09-17 调研落地）─────────────────────────────────────
     来源：docs/research/2026-09-17-image-skill-candidates.md（22 条候选，全部带一手来源与热度证据）。
     这里只收「ready」档（纯提示词 + 1 张商品图即可跑）：GitHub 上被反复收录、B站/小红书有高热教程。
     ⚠️ 竞品把这些放在「电商专区」而不是精品推荐 —— 精品推荐留给日常交付的活（套图/A+/详情/白底），
        爆款配方是"偶尔来一发"的创意玩法，放在专区里逛得到、又不挤占首页那一排。 */
  {
    id: 'image.explode', board: 'image', name: '爆炸分解广告图', category: '电商专区', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'warm' },
    summary: '商品在半空炸开，碎片与成分定格', pipeline: 'visualCreation', availability: 'ready',
    visual: 'free',
    brief: '商品广告：{{product}}在空中炸开分解。要求：主体碎裂成多个碎片向四周飞散，悬浮的残骸与颗粒定格在半空，{{layers}}逐层可见，电影慢动作瞬间，逼真物理，细微粉尘与液滴散落，戏剧性景深，高速摄影风格，中心主体锐利对焦，体积光，照片级真实；必须保留商品本身的形状、颜色、材质与包装文字，碎片不得遮住标签。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true, placeholder: '例如：冷萃咖啡液' },
      { key: 'layers', label: '构成层', kind: 'textarea', rows: 3, required: true, placeholder: '例如：瓶身 / 液体 / 咖啡豆 / 冰块' },
      ratioField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 4 },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.ice_ad', board: 'image', name: '极地冰封海报', category: '电商专区', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'cool' },
    summary: '商品封进巨型冰块，超现实大场面', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '超现实广告海报：{{product}}被完整封存在一块巨大的透明冰块中央，置于广袤极地冰原，{{tone}}色调，低角度仰拍突出体量感，体积光穿过冰体产生折射与内辉光，冰面裂纹细节，远处暴风雪氛围，电影级广告摄影，超现实商业大片；商品标签与轮廓必须保持清晰可辨，画面内文字逐字准确、不得臆造。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'tone', label: '色调', kind: 'segmented', required: true, default: '冷蓝', options: [
        { value: '冷蓝', label: '冷蓝' }, { value: '银白', label: '银白' },
        { value: '深蓝夜色', label: '深蓝夜色' }, { value: '暖调黄昏', label: '暖调黄昏' },
      ] },
      ratioField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 4 },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.float_kv', board: 'image', name: '悬浮主视觉', category: '电商专区', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'neutral' },
    summary: '产品悬浮 + 单向光，高级静物广告', pipeline: 'visualCreation', availability: 'ready',
    visual: 'brand-kv',
    brief: '高端产品摄影：{{product}}悬浮于画面中央，{{light}}，背景{{background}}，强烈明暗对比与几何光影切割，大面积暗部保留，产品是唯一视觉焦点，柔和反射，真实摄影质感，品牌主视觉，无杂乱元素；商品结构与包装文字必须完整保留。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'light', label: '光影', kind: 'segmented', required: true, default: '单向侧光', options: [
        { value: '单向侧光', label: '单向侧光' }, { value: '顶光', label: '顶光' },
        { value: '逆光轮廓', label: '逆光轮廓' }, { value: '柔光棚拍', label: '柔光棚拍' },
      ] },
      { key: 'background', label: '背景', kind: 'text', placeholder: '例如：深灰渐变，右侧留白' },
      ratioField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.tvc_grid', board: 'image', name: '九宫格 TVC 分镜', category: '电商专区', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'accent' },
    summary: '一张图出 3×3 广告分镜板', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '做一张九宫格广告分镜板（3×3）：同一个商品在九个镜头里依次出现——{{scenes}}。要求：每格是一帧独立画面，景别与机位有变化，整体色调统一，格与格之间有叙事顺序；商品在每一格里都保持结构、颜色与包装文字一致，画面内文字逐字准确。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'scenes', label: '九个镜头', kind: 'textarea', rows: 4, required: true, placeholder: '例如：全景入场 / 特写质地 / 手持使用 / 成分微距 …' },
      ratioField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.sku_series', board: 'image', name: 'SKU 多色系列图', category: '电商专区', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'soft' },
    summary: '同款不同配色，整齐排开', pipeline: 'visualCreation', availability: 'ready',
    visual: 'free',
    brief: '做一张 SKU 多色系列图：同一款{{product}}的不同配色有序排列——{{colors}}。要求：排列整齐、间距一致，光影与质感完全一致，**只允许颜色不同**，结构与包装文字必须一致，背景干净；画面内不出现臆造的文字与价格。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'colors', label: '配色清单', kind: 'textarea', rows: 3, required: true, placeholder: '例如：雾霾蓝 / 奶油白 / 焦糖棕 / 松石绿' },
      { key: 'layout', label: '排列', kind: 'segmented', required: true, default: '一字排开', options: [
        { value: '一字排开', label: '一字排开' }, { value: '两行网格', label: '两行网格' }, { value: '环形', label: '环形' },
      ] },
      ratioField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.gift_scene', board: 'image', name: '礼盒场景图', category: '电商专区', complexity: 'simple',
    cover: { template: 'hero-single', accent: 'warm' },
    summary: '商品进礼盒/桌面场景，同风格可复制', pipeline: 'visualCreation', availability: 'ready',
    visual: 'free',
    brief: '把{{product}}放进{{scene}}里拍一张场景图。要求：商品是画面主角、位置自然、留白得当，环境光柔和有来处，材质与色彩克制统一，风格可以复制到同系列的其他商品上；商品结构与包装文字完整保留，不出现臆造的品牌与价格。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'scene', label: '场景', kind: 'textarea', rows: 3, required: true, placeholder: '例如：米色礼盒内衬丝带，旁边一支干花' },
      ratioField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.teardown', board: 'image', name: '拆解工艺图', category: '电商专区', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'cool' },
    summary: '把商品拆成零件，讲清工艺', pipeline: 'visualCreation', availability: 'ready',
    visual: 'free',
    brief: '做一张工艺拆解图：把{{product}}拆成{{parts}}并列展示。要求：零件比例真实、排列有序、质感统一，像产品说明书里的爆炸图，背景干净；画面内文字逐字准确，不得臆造参数与认证标识。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'parts', label: '部件', kind: 'textarea', rows: 3, required: true, placeholder: '例如：鞋面 / 中底 / 大底 / 鞋带扣' },
      ratioField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.diorama', board: 'image', name: '微缩场景广告', category: '电商专区', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'accent' },
    summary: '商品住进微缩立体世界', pipeline: 'visualCreation', availability: 'ready',
    visual: 'free',
    brief: '把{{product}}放进一个微缩立体场景（diorama）里：{{world}}。要求：微缩比例可信、材质分明（黏土/纸艺/树脂质感）、顶光或侧逆光塑形、浅景深，像手工模型摄影；商品本身的结构、颜色与包装文字必须保持真实可辨。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      { key: 'world', label: '微缩世界', kind: 'textarea', rows: 3, required: true, placeholder: '例如：一间迷你咖啡馆，吧台、吊灯、木箱' },
      ratioField(),
    ],
    cases: [], history: true,
  },

  /* ── 创意应用 ─────────────────────────────────────────────────────────── */
  {
    id: 'image.brand_kv', board: 'image', name: '品牌主视觉', category: '创意应用', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'accent' },
    summary: '把品牌调性扩成一套画面语言', pipeline: 'visualCreation', availability: 'ready',
    visual: 'brand-kv',
    brief: '做一张品牌主视觉。主题：{{topic}}。品牌：{{brand}}。画面：{{prompt}}。要求：不是一张孤立的图，而是一套能延展到其他版式的画面语言——构图、材质、光线、色板与图形节奏要统一；品牌标识与产品细节必须原样保留。',
    fields: [
      { key: 'topic', label: '主题', kind: 'text', required: true },
      { key: 'brand', label: '品牌', kind: 'text', placeholder: '品牌名或关键词' },
      { key: 'prompt', label: '描述', kind: 'textarea', rows: 3 },
      ratioField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.cn_poster', board: 'image', name: '中文海报', category: '创意应用', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'warm' },
    summary: '中文标题与画面一起排', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '设计一张中文海报。主题：{{topic}}。画面：{{prompt}}。用途：{{use}}。字体气质：{{font}}。要求：中文标题逐字准确、层级清楚，不出现错字或臆造文案，画面给标题留出安全区。',
    fields: [
      { key: 'topic', label: '主题', kind: 'text', required: true },
      { key: 'prompt', label: '描述', kind: 'textarea', rows: 3 },
      { key: 'use', label: '用途', kind: 'segmented', options: [
        { value: '促销', label: '促销' }, { value: '活动', label: '活动' },
        { value: '展览', label: '展览' }, { value: '发布', label: '发布' },
      ] },
      { key: 'font', label: '字体', kind: 'segmented', options: [
        { value: '黑体', label: '黑体' }, { value: '宋体', label: '宋体' },
        { value: '书法体', label: '书法' }, { value: '圆体', label: '圆体' },
      ] },
      ratioField(),
    ],
    cases: [], history: true,
  },
  {
    /* 竞品「图片复刻」页的示例清单是「01 原图 02 原图 03 原图 04 复刻图 05 复刻图 06 复刻图」——
       成对展示"原图 → 复刻图"，我们也按这个口径交付（before/after 版式）。 */
    deliverables: [
      /* 竞品的示例编号清单是**成对**的：01 原图 02 原图 03 原图 04 复刻图 05 复刻图 06 复刻图。
         我们按同样的读法列：三张原图 → 三张复刻图（"你给 3 张，我照 3 张还你"）。 */
      { name: '原图', hint: '你上传的参考图，作为复刻基准（按参考图数量成组）' },
      { name: '原图', hint: '第二张参考图（同上）' },
      { name: '原图', hint: '第三张参考图（同上）' },
      { name: '复刻图', hint: '换掉商品与卖点，构图、版式与节奏保持不变' },
      { name: '复刻图', hint: '第二张成品（与上面对应）' },
      { name: '复刻图', hint: '第三张成品（与上面对应）' },
    ],
    /* 复刻程度照竞品做成二选一（他们：参考排版 / 高度复刻，各带一句说明）。
       ⚠️ 这里如实说清：两种口径的差别**体现在提示词的严格程度**上（图生图链路是同一条），
          不是在引擎里切了不同模型 —— 写清楚才不会让用户以为换了引擎。 */
    featuredRank: 4,
    id: 'image.copy', board: 'image', name: '图片复刻', category: '精品推荐', complexity: 'standard',
    cover: { template: 'before-after', accent: 'cool' },
    summary: '保住构图与节奏，换成自己的内容', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '按参考图复刻一张新图，复刻程度：{{degree}}；统一复刻要求：{{rules}}。' +
      '（参考排版 = 只借排版与背景结构、人物关系，配色按商品本身来；高度复刻 = 连构图、版式、配色与细节一起复刻，只把商品与卖点换掉。）' +
      '内容必须是{{product}}本身，不要照搬参考图里的品牌与文字。' +
      '目标市场：{{market}}；目标平台：{{platform}}；画面内文案语言：{{language}}。',
    /* 字段顺序与措辞照竞品图片复刻页实测：
       商品信息 0/4（核心卖点*）→ 上传商品图 0/4（成组打包）→ 上传参考图 0/20 →
       复刻设置（复刻程度 + 统一复刻要求）→ 目标市场/目标平台/文案语言 → 生成设置。 */
    fields: [
      /* ⚠️ 上传商品图必须 required：它是这条链路的主图（skillImages 取第一个 upload 位当 image_url），
         不 required 的话「只填了卖点就能点生成」—— 那会跑成**文生图**，
         而这条技能叫"复刻"，用户要的是拿着他的商品图去图生图。竞品也是先要求上传商品图。 */
      { key: 'reference', label: '上传商品图', kind: 'upload', maxImages: 4, group: '商品信息', role: 'product', required: true,
        slotLabel: '点击或拖拽上传图片', hint: '商品图会作为一组打包参考，最多 4 张' },
      { key: 'product', label: '核心卖点', kind: 'textarea', rows: 5, group: '商品信息', required: true,
        placeholder: '建议包含以下信息生成更精准：\n1.产品名称\n2.核心卖点\n3.适用人群\n4.期望场景\n5.产品尺寸' },
      { key: 'source', label: '上传参考图', kind: 'upload', maxImages: 20, group: '参考图', role: 'reference',
        slotLabel: '点击或拖拽上传图片', hint: '风格参考，最多 20 张' },
      /* 复刻程度照竞品二选一（各带一句说明）；差别体现在提示词的严格程度（同一条图生图链路，不是换引擎） */
      { key: 'degree', label: '复刻程度', kind: 'segmented', group: '复刻设置', required: true, default: '参考排版', options: [
        { value: '参考排版', label: '参考排版' },
        { value: '高度复刻', label: '高度复刻' },
      ], hint: '参考排版：参考排版、背景结构与人物关系，配色按商品本身设计。高度复刻：复刻参考图构图、版式、配色与细节，替换商品和卖点。' },
      { key: 'rules', label: '统一复刻要求（选填）', longLabelReason: '照竞品原文逐字（他们 ?tool=image-clone 的字段名就是「统一复刻要求（选填）」）', kind: 'textarea', rows: 3, group: '复刻设置',
        placeholder: '例如：文案统一用英文、模特姿势保持不变、参考图不要替换商品色。' },
      marketField(MARKET_BASE),
      platformField(PLATFORM_SUITE),
      languageField('文案语言', LANGUAGE_FULL.filter(item => item.value !== '繁体中文')),
      ratioField(),
      countField(4),
    ],
    cases: [], history: true,
  },
  {
    /* tier: assistant —— 它不是"一个活儿"，而是"沿着一张参考图再多出几张"这种**运行方式**。
       竞品也没有单独的"相似图"入口：这是生成时的一个参数，不是用户会专门进来的页面。
       所以它不进首页精选与主档，只在「辅助能力」里可查（也可以直接开链接用）。 */
    tier: 'assistant', belongsTo: 'image.copy',
    /* 融合形态：**结果区动作**。任何一条出图技能出来后，都能"拿这张图再来一张相似的"。
       into 写 '*' 是有意的：相似图与内容无关，只与刚才那张图有关。 */
    fuses: {
      slot: 'result', into: ['*'], label: '再来一张相似的',
      note: '沿着刚才那张结果的画风再出一张变体（保留构图语言，不逐像素复制）',
    },
    id: 'image.similar', board: 'image', name: '相似图生成', category: '创意应用', complexity: 'simple',
    cover: { template: 'hero-single', accent: 'neutral' },
    summary: '沿着一张参考图再生成几张', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '沿用参考图的风格再生成一张，参考强度：{{strength}}。保留参考图的画面语言（构图习惯、光线、色调、质感），但不要逐像素复制；不要出现水印或 logo。',
    fields: [
      { key: 'reference', label: '参考图', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传参考图' },
      { key: 'strength', label: '强度', kind: 'segmented', options: [
        { value: '低', label: '低' }, { value: '中', label: '中' }, { value: '高', label: '高' },
      ] },
      ratioField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.xhs_note', board: 'image', name: '小红书图文', category: '创意应用', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'soft' },
    summary: '一组配图加标题正文，真实感优先', pipeline: 'xhsNote', availability: 'ready',
    visual: 'social-cover',
    brief: '围绕这个主题做一组小红书配图。主题：{{prompt}}。文风：{{style}}。要求：真实感优先，像手机随手拍出来的生活记录，不要做成广告海报；不出现水印与二维码。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 6, role: 'reference', slotLabel: '上传素材图' },
      { key: 'prompt', label: '描述', kind: 'textarea', rows: 3, placeholder: '例如：厦门 3 天 2 夜，第一次去怎么玩' },
      { key: 'style', label: '文风', kind: 'segmented', options: [
        { value: '真实分享', label: '真实分享' }, { value: '攻略清单', label: '攻略清单' },
        { value: '好物测评', label: '好物测评' }, { value: '生活记录', label: '生活记录' },
      ] },
      ratioField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 9 },
    ],
    cases: [], history: true,
  },

  /* ── 建筑家装（用户 9-17 明确要求做）──────────────────────────────────────
     竞品图片页 10 条都在这一档（平面转效果图 / 装修风格转换 / 毛坯家装设计 / 日夜气候切换 /
     一键软硬装替换 / 效果图质感提升 / 室内 3D 渲染 / 生成彩色平面图 / 建筑九宫格分镜 / AI 洗图）。
     我们照这个方向补齐：全部是**图生图**（给一张户型图 / 毛坯照 / 效果图，改出另一个版本），
     所以 availability 基本都是 'needs_ref'（依赖参考图），只有九宫格分镜可以纯文生图。
     ⚠️ 建筑与家装的**结构真实性**是这类技能的命门：墙体、门窗、层数、房间数量不许被模型自由发挥，
        所以每条 brief 里都写死了"结构不变"的约束。 */
  {
    id: 'image.floorplan_render', board: 'image', name: '平面转效果图', category: '建筑家装', complexity: 'standard',
    cover: { template: 'before-after', accent: 'cool' },
    summary: '一张户型图，长出一套三维效果图', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '把这张户型图转成三维室内效果图：{{room}}。要求：房间数量、开间进深、门窗位置与户型图**完全一致**，家具按常规布局摆放且尺度合理，顶面、地面与墙面的材质统一，光线从窗户自然进入；不要新增或删减房间，不要改动承重结构，画面里不出现文字与尺寸标注。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传户型图 / 平面图' },
      { key: 'room', label: '空间与风格', kind: 'textarea', rows: 3, required: true, placeholder: '例如：三室两厅，现代简约，原木+白墙' },
      ratioField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 4 },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.interior_style', board: 'image', name: '装修风格转换', category: '建筑家装', complexity: 'standard',
    cover: { template: 'before-after', accent: 'warm' },
    summary: '同一个空间，换成另一种装修风格', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '把这张室内照片的装修风格改成「{{style}}」。要求：空间结构、门窗位置、房间尺寸与机位**完全不变**，只更换硬装材质、家具款式、软装与配色；光线方向与原图一致，材质质感真实（木纹、石材、织物可辨），不出现变形、穿模与多余文字。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传空间照片' },
      { key: 'style', label: '目标风格', kind: 'segmented', required: true, default: '现代简约', options: [
        { value: '现代简约', label: '现代简约' }, { value: '奶油风', label: '奶油风' },
        { value: '侘寂风', label: '侘寂风' }, { value: '中古风', label: '中古风' },
        { value: '工业风', label: '工业风' }, { value: '新中式', label: '新中式' },
      ] },
      ratioField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 4 },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.rough_interior', board: 'image', name: '毛坯房设计', category: '建筑家装', complexity: 'standard',
    cover: { template: 'before-after', accent: 'soft' },
    summary: '毛坯现场照，直接出精装方案', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '把这张毛坯房照片做成精装完成后的样子：{{plan}}。要求：墙体、梁柱、门窗与管道位置**完全保留**，只在其上增加吊顶、地面、墙面饰面与家具；机位与透视不变，光线从原有窗户进入，材质真实、色温统一，不出现结构改动与文字标注。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 2, role: 'reference', slotLabel: '上传毛坯现场照' },
      { key: 'plan', label: '设计要点', kind: 'textarea', rows: 3, required: true, placeholder: '例如：无主灯、岩板电视墙、原木地板、浅灰墙面' },
      ratioField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 4 },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.day_night_still', board: 'image', name: '日夜气候切换', category: '建筑家装', complexity: 'simple',
    cover: { template: 'case-3up', accent: 'cool' },
    summary: '同一张图，出白天 / 黄昏 / 夜晚三版', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '把这张建筑 / 空间图改成「{{moment}}」的样子。要求：建筑结构、机位、构图与材质**完全不变**，只改变光线方向、色温、天空与阴影；室内灯光在夜景中要自然亮起并有真实反射，地面湿度与反光符合天气设定，不出现结构变化与文字。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传建筑 / 空间图' },
      { key: 'moment', label: '时间与天气', kind: 'segmented', required: true, default: '黄昏', options: [
        { value: '清晨', label: '清晨' }, { value: '正午', label: '正午' },
        { value: '黄昏', label: '黄昏' }, { value: '夜晚', label: '夜晚' }, { value: '雨夜', label: '雨夜' },
      ] },
      ratioField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 4 },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.furniture_swap', board: 'image', name: '软硬装替换', category: '建筑家装', complexity: 'standard',
    cover: { template: 'before-after', accent: 'accent' },
    summary: '结构不动，只换家具与饰面', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '保持这张空间图的结构与机位**完全不变**，把家具与饰面替换成：{{target}}。要求：只替换可移动家具、灯具、软装与墙地面饰面，墙体、门窗、梁柱与尺寸不动；新家具的比例与透视要和空间吻合，材质光影统一，不出现漂浮、穿模与文字。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传空间图' },
      { key: 'target', label: '替换成', kind: 'textarea', rows: 3, required: true, placeholder: '例如：布艺沙发换皮质沙发，地毯换木地板，主灯换轨道灯' },
      ratioField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 4 },
    ],
    cases: [], history: true,
  },
  {
    /* tier: assistant —— 它的输入是**已经有的一张效果图**，产出是同一张图更高级的版本，
       属于出图后的收尾修饰（改反射/补阴影/去塑料感），不是独立创作入口。 */
    tier: 'assistant', belongsTo: 'image.interior_3d',
    /* 融合形态：**结果区动作**，只长在"产出效果图"的那几条建筑家装主技能上 ——
       别的品类的主技能没有"商业出图质感"这件事，硬挂上去只会让用户困惑。 */
    fuses: {
      slot: 'result', label: '提升质感',
      into: ['image.interior_3d', 'image.floorplan_render', 'image.interior_style', 'image.rough_interior', 'image.day_night_still'],
      note: '把刚出的这张效果图提到商业出图水准（改反射、补阴影、去塑料感），结构与机位不动',
    },
    id: 'image.render_quality', board: 'image', name: '效果图质感提升', category: '建筑家装', complexity: 'simple',
    cover: { template: 'before-after', accent: 'neutral' },
    summary: '把普通效果图提到商业出图水准', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '提升这张效果图的画面质感，不改变任何结构、家具与机位。要求：修正材质反射与粗糙度，让木纹、石材、金属、织物各自可辨；补足环境光遮蔽与柔和阴影，降低塑料感与噪点，提亮暗部但不死黑，整体色温统一、画面干净通透，达到商业出图水准。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传效果图' },
      { key: 'focus', label: '重点', kind: 'text', placeholder: '例如：主灯的金属反射、木地板的纹理' },
      ratioField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 4 },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.interior_3d', board: 'image', name: '室内 3D 渲染', category: '建筑家装', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'accent' },
    summary: '模型截图 / 白模，渲染成真实照片', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '把这张室内模型图 / 白模渲染成照片级实景：{{style}}。要求：结构、家具位置与机位**完全不变**，只为材质赋予真实的反射与粗糙度，加上自然光与人工光的混合照明、接触阴影与景深；材质层次分明、色温统一，不出现结构变化、文字与水印。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传模型图 / 白模' },
      { key: 'style', label: '风格', kind: 'segmented', required: true, default: '现代简约', options: [
        { value: '现代简约', label: '现代简约' }, { value: '奶油风', label: '奶油风' },
        { value: '侘寂风', label: '侘寂风' }, { value: '中古风', label: '中古风' },
      ] },
      ratioField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 4 },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.arch_grid', board: 'image', name: '建筑九宫格分镜', category: '建筑家装', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'cool' },
    summary: '一张九宫格讲完一栋建筑', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '做一张建筑九宫格分镜板（3×3）：{{scenes}}。要求：九格是同一栋建筑的九个视角或时段，透视与结构一致，格与格之间有叙事顺序（远景 → 中景 → 细节 → 室内 → 夜景），色调统一，不出现文字、标注与水印。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传建筑图（可选）' },
      { key: 'scenes', label: '九个镜头', kind: 'textarea', rows: 4, required: true, placeholder: '例如：远景全景 / 入口 / 幕墙细节 / 中庭 / 室内大厅 …' },
      ratioField(),
    ],
    cases: [], history: true,
  },

  /* ── 人像摄影 ─────────────────────────────────────────────────────────── */
  {
    id: 'image.portrait', board: 'image', name: '人像精修', category: '人像摄影', complexity: 'standard',
    cover: { template: 'before-after', accent: 'soft' },
    summary: '皮肤、光线与质感一起收拾干净', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '精修这张人像。要求：{{prompt}}。保留人物原本的五官特征与身份识别度，皮肤处理自然、保留质感与毛孔，光线过渡干净；不要过度磨皮，不要改变脸型。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'person', slotLabel: '上传人像图' },
      { key: 'prompt', label: '要求', kind: 'textarea', rows: 3 },
      ratioField(),
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.hairstyle', board: 'image', name: '换发型', category: '人像摄影', complexity: 'standard',
    cover: { template: 'before-after', accent: 'soft' },
    summary: '保留五官，换一个发型', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '保留人物五官与脸型，把发型换成：{{style}}。发丝走向、发量感与光线要自然可信，肤色与背景保持一致；不要改变人物的身份特征。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'person', slotLabel: '上传人像图' },
      { key: 'style', label: '发型', kind: 'text', placeholder: '例如：齐肩短发、微卷' },
      ratioField(),
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.pose', board: 'image', name: '姿势生成', category: '人像摄影', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'soft' },
    summary: '同一个人，换几种姿势', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '让同一个人换几种姿势：{{pose}}。保持五官、发型、体型与服装一致，只改变姿态与镜头角度，光线与背景保持同一套；不要出现多余的肢体。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'person', slotLabel: '上传人物图' },
      { key: 'pose', label: '姿势', kind: 'text', placeholder: '例如：侧身回眸、手插口袋' },
      ratioField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 6 },
    ],
    cases: [], history: true,
  },

  /* ── 图片编辑：统一形态「一张图 + 一句要求」────────────────────────────── */
  {
    featuredRank: 5,
    id: 'image.remove_bg', board: 'image', name: '去除背景', category: '精品推荐', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'cool' },
    summary: '去掉背景，出透明底或纯色底', pipeline: 'builtinSkill', availability: 'ready',
    /* 批 I-11：一键类技能的主按钮用**自己的动作名**，不用通用的「生成图片」——
       竞品这一页的主 CTA 原文就是「去除背景 / 消耗 0.40 积分」（见 docs/design/50 第 165 行）。
       按钮上写"要做的那件事"，比写"生成"更准确：这一条不是"生成一张新图"，
       是"把已有这张图的背景去掉"。 */
    ctaLabel: '去除背景',
    visual: 'free',
    brief: '去掉背景，只保留主体。底色：{{mode}}。主体边缘要干净，发丝与透明材质要处理好，不要残留原背景，也不要改变主体本身的颜色与结构。',
    /* 一键类：工作台极简（竞品 ?tool=remove-background 实测就是极简形态）：
       标题「最多上传 5 张图片」+ 0/5 计数 + 一个「+」上传位 → 一颗
       「去除背景 / 消耗 0.40 积分」→ 示例是「原图 ↔ 去背景后」两图对照。
       ⚠️ 我们的底色选项（透明/白色/纯色）是**多的那一档**：竞品只出透明底，
          我们保留是因为服务端这条链路本来就支持纯色底 —— 多给的是能力，不是坑
          （每一项都真的进了提示词，见 brief 的 {{mode}}）。 */
    fields: [
      uploadField({ maxImages: 5, slotLabel: '点击或拖拽上传图片', hint: '最多上传 5 张图片，一次批量去背景' }),
      { key: 'mode', label: '底色', kind: 'segmented', group: '输出设置', required: true, options: [
        { value: '透明', label: '透明' }, { value: '白色', label: '白色' }, { value: '纯色', label: '纯色' },
      ], hint: '透明底可直接叠在任何背景上；纯色底适合主图规范' },
      ratioField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.swap_bg', board: 'image', name: '换背景', category: '图片编辑', complexity: 'standard',
    cover: { template: 'before-after', accent: 'cool' },
    summary: '人物或商品留着，背景换掉', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '保留主体，把背景换成我给的这张（或按下面的要求）：{{prompt}}。主体的光线要与新背景对得上，投影方向一致，边缘融合自然；不要改变主体的形态与颜色。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传原图' },
      { key: 'backdrop', label: '背景', kind: 'upload', maxImages: 1, role: 'scene', slotLabel: '上传背景图' },
      { key: 'prompt', label: '要求', kind: 'textarea', rows: 3 },
      ratioField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.retouch', board: 'image', name: '图片精修', category: '图片编辑', complexity: 'standard',
    cover: { template: 'before-after', accent: 'neutral' },
    summary: '一张图加一句要求，改到能用', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '按这个要求修图：{{prompt}}。只做要求的改动，画面其他部分保持原样；不要改变主体的结构、文字与颜色关系，不要添加原本不存在的东西。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传图片' },
      { key: 'prompt', label: '要求', kind: 'textarea', rows: 3, placeholder: '例如：把背景杂物清掉，光线调亮一点' },
      ratioField(),
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.style_swap', board: 'image', name: '材质替换', category: '图片编辑', complexity: 'standard',
    cover: { template: 'before-after', accent: 'warm' },
    summary: '主体不动，换材质或风格', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '主体不动，把材质或风格换成：{{material}}。新材质的反光、纹理与质感要真实可信，并与环境光一致；保持主体的形状、比例与结构不变。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传图片' },
      { key: 'material', label: '材质', kind: 'text', placeholder: '例如：磨砂陶瓷、原木' },
      ratioField(),
      clarityField(),
    ],
    cases: [], history: true,
  },
];

export const IMAGE_SKILL_CATEGORIES = [...new Set(IMAGE_SKILLS.map(skill => skill.category))];

export function getImageSkill(id) {
  const key = typeof id === 'string' ? id.trim() : '';
  /* __proto__ / constructor 这类键必须返回 null（声明表不是对象原型链） */
  if (!key || !key.startsWith('image.')) return null;
  return IMAGE_SKILLS.find(skill => skill.id === key) || null;
}
