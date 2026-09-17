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
export const FIELD_KINDS = ['select', 'segmented', 'stepper', 'textarea', 'text', 'slot', 'upload'];
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
const ratioField = () => ({ key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true, default: '1:1' });

/* 跨境卖家刚需的两个档位（照竞品实测：他们的每一个电商技能都有这两个下拉）。
   ⚠️ 它们**只进提示词**，不改变引擎协议 —— 市场影响文案与合规习惯，语言决定画面里的文字。 */
const MARKET = [
  { value: '中国', label: '中国' }, { value: '美国', label: '美国' }, { value: '欧洲', label: '欧洲' },
  { value: '东南亚', label: '东南亚' }, { value: '日本', label: '日本' }, { value: '韩国', label: '韩国' },
];
const LANGUAGE = [
  { value: '简体中文', label: '简体中文' }, { value: 'English', label: 'English' },
  { value: '日本語', label: '日本語' }, { value: '한국어', label: '한국어' }, { value: '不出现文字', label: '不出现文字' },
];
const marketField = () => ({ key: 'market', label: '目标市场', kind: 'segmented', options: MARKET, default: '中国' });
const languageField = () => ({ key: 'language', label: '文案语言', kind: 'segmented', options: LANGUAGE, default: '简体中文' });
const clarityField = () => ({ key: 'clarity', label: '清晰度', kind: 'segmented', options: CLARITY, required: true, default: '2K' });

export const IMAGE_SKILLS = [
  /* ── 精品推荐：推荐位，封面只用图、不烤字（实测口径）──────────────────────── */
  {
    id: 'image.free', board: 'image', name: '自由创作', category: '精品推荐', complexity: 'simple',
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
    id: 'image.poster', board: 'image', name: '海报设计', category: '精品推荐', complexity: 'simple',
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
    id: 'image.social_cover', board: 'image', name: '社媒封面', category: '精品推荐', complexity: 'simple',
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
    id: 'image.product_suite', board: 'image', name: '电商商品套图', category: '精品推荐', complexity: 'heavy',
    cover: { template: 'case-3up', accent: 'warm' },
    summary: '主图、场景图、卖点图成套交付', pipeline: 'ecommerceSuite', availability: 'ready',
    visual: 'free',
    brief: '围绕商品生成一套电商图。商品信息：{{productParams}}。目标市场：{{market}}；画面内文案语言：{{language}}。要求：先确保商品本身的结构、颜色、材质与文字被完整保留，再谈场景与氛围；符合{{platform}}的图片规范与目标市场的审美习惯。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 6, role: 'product', slotLabel: '上传商品图' },
      /* 平台决定套图结构（出几张、各是什么比例）—— 它真的参与方案计算与报价，不是装饰 */
      { key: 'platform', label: '平台', kind: 'segmented', required: true, default: '淘宝', options: [
        { value: '淘宝', label: '淘宝' }, { value: '抖音', label: '抖音' }, { value: '小红书', label: '小红书' },
        { value: '拼多多', label: '拼多多' }, { value: '京东', label: '京东' },
      ] },
      { key: 'productParams', label: '商品信息', kind: 'textarea', rows: 4, placeholder: '第一行写商品名，后面可以写卖点与材质' },
      marketField(),
      languageField(),
      /* 结构/规格是套图专有的重配置：默认按平台智能匹配，自定义面板在套图工作台里 —— 
         这里如实说明，不做一个点了没反应的按钮 */
      { key: 'structure', label: '结构', kind: 'slot', slotLabel: '配置套图结构', hint: '默认按平台智能匹配；自定义结构在套图工作台里配' },
      { key: 'skus', label: '规格', kind: 'slot', slotLabel: '编辑规格与张数', hint: '自定义 SKU 变体在套图工作台里配' },
    ],
    cases: [
      { id: 'scene', title: '场景卖点主图', cover: '/gallery/ecommerce/stainless-steel-sauce-container/01.webp' },
      { id: 'usage', title: '真实使用详情图', cover: '/gallery/ecommerce/stainless-steel-sauce-container/02.webp' },
      { id: 'size', title: '尺寸对比详情图', cover: '/gallery/ecommerce/stainless-steel-sauce-container/03.webp' },
    ], history: true,
  },

  {
    id: 'image.aplus', board: 'image', name: 'A+ 内容图', category: '精品推荐', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'accent' },
    summary: '图文并排的模块图，把卖点讲清楚', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'poster',
    brief: '做一张 A+ 内容模块图。商品：{{product}}。这个模块要讲的事：{{module}}。目标市场：{{market}}；画面内文案语言：{{language}}。要求：横向构图，图文并排（左图右文或上图下文），信息层级清楚、留出安全的文字区；画面内的文字必须逐字准确，不得臆造文案、参数、认证标识或 logo；商品本身的结构、颜色、材质与包装文字必须完整保留。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 3, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true, placeholder: '例如：冷萃咖啡液 250ml' },
      { key: 'module', label: '模块主题', kind: 'textarea', rows: 3, required: true, placeholder: '例如：原料产地与烘焙曲线，配一张剖面图' },
      marketField(),
      languageField(),
      ratioField(),
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 6 },
    ],
    /* 交付清单照竞品那份（他们 A+ 页列出 16 个可勾选模块；我们做成只读的交付说明，
       因为我们的张数与报价由方案算死，可勾选会让钱对不上）。 */
    deliverables: [
      { name: '功能总览图', hint: '把产品的几项核心功能一次讲完' },
      { name: '技术细节图', hint: '放大结构、材质与做工' },
      { name: '生活方式图', hint: '放进真实使用场景' },
      { name: '品牌主视觉', hint: '统一的品牌调性与留白' },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.detail_page', board: 'image', name: '详情页模块', category: '精品推荐', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'warm' },
    summary: '首屏、卖点、成分、参数，逐屏出图', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'poster',
    brief: '做一张电商详情页的「{{module}}」模块图。商品：{{product}}。这一屏要讲的点：{{copy}}。目标市场：{{market}}；画面内文案语言：{{language}}。要求：竖版长图构图，信息层级清楚（标题 → 主图 → 说明），阅读顺序自然；画面内文字逐字准确、不臆造；商品的结构、颜色、材质与包装文字必须完整保留。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 3, role: 'product', slotLabel: '上传商品图' },
      { key: 'product', label: '商品名', kind: 'text', required: true, placeholder: '例如：氨基酸洁面慕斯' },
      { key: 'module', label: '这一屏', kind: 'segmented', required: true, default: '首屏主图', options: [
        { value: '首屏主图', label: '首屏主图' }, { value: '卖点图解', label: '卖点图解' },
        { value: '成分说明', label: '成分说明' }, { value: '规格参数', label: '规格参数' },
        { value: '使用场景', label: '使用场景' },
      ] },
      { key: 'copy', label: '要讲的点', kind: 'textarea', rows: 3, placeholder: '例如：氨基酸配方、洗完不紧绷、一次一泵' },
      marketField(),
      languageField(),
      ratioField(),
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
    id: 'image.try_on', board: 'image', name: '模特试穿', category: '电商专区', complexity: 'standard',
    cover: { template: 'before-after', accent: 'soft' },
    summary: '把商品穿到模特身上，姿势场景可选', pipeline: 'builtinSkill', availability: 'ready',
    visual: 'free',
    brief: '把商品穿到模特身上。场景：{{scene}}。保留模特的五官、身材比例与肤色，商品要贴合身体、褶皱与垂坠自然，光线统一；不要改变商品的颜色与图案。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 3, role: 'product', slotLabel: '上传商品图' },
      { key: 'model', label: '模特', kind: 'upload', maxImages: 1, role: 'person', slotLabel: '选模特图' },
      { key: 'scene', label: '场景', kind: 'text', placeholder: '例如：城市清晨的街道' },
      ratioField(),
      clarityField(),
    ],
    cases: [
      { id: 'source', title: '商品与模特原图', cover: '/images/home/ability-tryon-example-input.png' },
      { id: 'result', title: 'AI 试穿成品', cover: '/images/home/ability-tryon-example-output.png' },
    ], history: true,
  },
  {
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
      { name: '原图（输入的参考图）', hint: '你上传的那张，作为复刻基准' },
      { name: '复刻图（保持构图与版式）', hint: '换掉商品与卖点，构图节奏不变' },
    ],
    /* 复刻程度照竞品做成二选一（他们：参考排版 / 高度复刻，各带一句说明）。
       ⚠️ 这里如实说清：两种口径的差别**体现在提示词的严格程度**上（图生图链路是同一条），
          不是在引擎里切了不同模型 —— 写清楚才不会让用户以为换了引擎。 */
    id: 'image.copy', board: 'image', name: '图文复刻', category: '创意应用', complexity: 'standard',
    cover: { template: 'before-after', accent: 'cool' },
    summary: '保住构图与节奏，换成自己的内容', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '按参考图复刻一张新图，复刻程度：{{degree}}；统一要求：{{rules}}。补充要求：{{prompt}}。' +
      '（参考排版 = 只借排版与背景结构、人物关系，配色按商品本身来；高度复刻 = 连构图、版式、配色与细节一起复刻，只把商品与卖点换掉。）' +
      '内容必须是{{product}}本身，不要照搬参考图里的品牌与文字。',
    fields: [
      { key: 'source', label: '原图', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传要复刻的图' },
      { key: 'reference', label: '商品图', kind: 'upload', maxImages: 4, role: 'product', slotLabel: '上传自己的商品图（成组打包参考）' },
      { key: 'product', label: '商品名', kind: 'text', required: true },
      /* 复刻程度照竞品二选一；差别体现在提示词的严格程度（同一条图生图链路，不是换引擎） */
      { key: 'degree', label: '复刻程度', kind: 'segmented', required: true, default: '参考排版', options: [
        { value: '参考排版', label: '参考排版' },
        { value: '高度复刻', label: '高度复刻' },
      ] },
      { key: 'rules', label: '统一要求', kind: 'textarea', rows: 2, placeholder: '可选，例如：文案统一用英文、人物姿势保持不变、不要替换商品配色' },
      { key: 'prompt', label: '补充要求', kind: 'textarea', rows: 2 },
      ratioField(),
    ],
    cases: [], history: true,
  },
  {
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
    id: 'image.remove_bg', board: 'image', name: '去除背景', category: '图片编辑', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'cool' },
    summary: '去掉背景，出透明底或纯色底', pipeline: 'builtinSkill', availability: 'ready',
    visual: 'free',
    brief: '去掉背景，只保留主体。底色：{{mode}}。主体边缘要干净，发丝与透明材质要处理好，不要残留原背景，也不要改变主体本身的颜色与结构。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传图片' },
      { key: 'mode', label: '底色', kind: 'segmented', required: true, options: [
        { value: '透明', label: '透明' }, { value: '白色', label: '白色' }, { value: '纯色', label: '纯色' },
      ] },
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
