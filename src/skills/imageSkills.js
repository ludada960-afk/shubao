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
    brief: '围绕商品生成一套电商图。商品信息：{{productParams}}。要求：先确保商品本身的结构、颜色、材质与文字被完整保留，再谈场景与氛围；符合目标平台的图片规范。',
    fields: [
      { key: 'assets', label: '素材', kind: 'upload', required: true, maxImages: 6, role: 'product', slotLabel: '上传商品图' },
      /* 平台决定套图结构（出几张、各是什么比例）—— 它真的参与方案计算与报价，不是装饰 */
      { key: 'platform', label: '平台', kind: 'segmented', required: true, default: '淘宝', options: [
        { value: '淘宝', label: '淘宝' }, { value: '抖音', label: '抖音' }, { value: '小红书', label: '小红书' },
        { value: '拼多多', label: '拼多多' }, { value: '京东', label: '京东' },
      ] },
      { key: 'productParams', label: '商品信息', kind: 'textarea', rows: 4, placeholder: '第一行写商品名，后面可以写卖点与材质' },
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
    id: 'image.copy', board: 'image', name: '图文复刻', category: '创意应用', complexity: 'standard',
    cover: { template: 'before-after', accent: 'cool' },
    summary: '保住构图与节奏，换成自己的内容', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '按参考图的构图与画面节奏复刻一张新图，把主体换成我的素材。补充要求：{{prompt}}。保留参考图的版式结构、光线方向与色调关系，但内容必须是我的商品或人物，不要照搬参考图里的品牌与文字。',
    fields: [
      { key: 'source', label: '原图', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传要复刻的图' },
      { key: 'reference', label: '参考', kind: 'upload', maxImages: 3, role: 'reference', slotLabel: '上传自己的素材' },
      { key: 'prompt', label: '要求', kind: 'textarea', rows: 3 },
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
