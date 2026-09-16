/* ═══ 图片板块的 Skill 声明（单一事实源）═══════════════════════════════════════
   依据 docs/design/43-media-architecture.md §5 与 docs/design/44-p1c-image-hub-brief.md；
   能力盘点参照竞品实测（2026-09-16 抓了他们的目录接口，104 个应用 / 8 个分组）。

   ⚠️ 参照的是**结构与做法**（分组怎么分、一个 skill 该有哪些字段、页面上怎么摆），
      **不是他们的文案与长相**：命名、字段名、选项、措辞一律用我们自己的词表，
      视觉一律走 --sb-* token。用户要的是"同一个东西做得更好"，不是"看起来一样"。

   为什么要有这个文件：现在"一个板块 = 一个手写页面"，41 个面板文件里同一批配置各写了一遍
   （实测 model 41 处、resolution 42 处、count 77 处、ratio 61 处）。
   从今往后：**新增 Skill = 加一条声明**，页面与控件由 Hub / WorkbenchShell / FieldRenderer 统一渲染。
   ⚠️ 不声明「模型」字段：模型由路由层按 capability 过滤后注入（43 §5.3），
      写死模型名就会重演 9-16「8 条调不通的假模型」。
   ⚠️ availability 如实标注：'ready' = 现有链路已验证；'needs_ref' = 依赖参考图/图生图能力
      （链路已声明支持、尚未实测出片）。不许把没验证的写成能用。 */

export const SKILL_COMPLEXITIES = ['simple', 'standard', 'heavy'];
export const FIELD_KINDS = ['select', 'segmented', 'stepper', 'textarea', 'text', 'slot'];
export const IMAGE_PIPELINES = [
  'visualCreation',   // 自由创作/海报/封面的既有链路（含参考图）
  'ecommerceSuite',   // 电商套图（现有 EcMode + EcommerceWorkbench 面板整体嵌入）
  'builtinSkill',     // 现有内置任务技能（白底图 / 试穿 / 场景图 / 材质 / 多角度）
  'xhsNote',          // 小红书种草图文（现有 XhsContentMode）
];

/* 共用档位：同一批选项只有一份定义（页面里不许再写第二份） */
const RATIO = [
  { value: '1:1', label: '1:1 方图' },
  { value: '3:4', label: '3:4 竖版' },
  { value: '4:3', label: '4:3 横版' },
  { value: '9:16', label: '9:16 竖屏' },
  { value: '16:9', label: '16:9 横屏' },
];
const CLARITY = [
  { value: '1k', label: '1K' },
  { value: '2k', label: '2K' },
  { value: '4k', label: '4K' },
];

export const IMAGE_SKILLS = [
  /* ── 精品推荐：推荐位，封面只用图、不烤字（实测口径）──────────────────────── */
  {
    id: 'image.free', board: 'image', name: '自由创作', category: '精品推荐', complexity: 'simple',
    cover: { template: 'hero-single', accent: 'neutral' },
    summary: '一句话起步，画面方向自己定', pipeline: 'visualCreation', availability: 'ready',
    fields: [
      { key: 'prompt', label: '描述', kind: 'textarea', rows: 4, required: true, placeholder: '例如：清晨的窗边，一杯冒热气的咖啡' },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 6 },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.poster', board: 'image', name: '海报设计', category: '精品推荐', complexity: 'simple',
    cover: { template: 'poster-style', accent: 'warm' },
    summary: '先立主视觉，再排信息层级', pipeline: 'visualCreation', availability: 'ready',
    fields: [
      { key: 'topic', label: '主题', kind: 'text', required: true, placeholder: '例如：夏夜爵士音乐节' },
      { key: 'prompt', label: '描述', kind: 'textarea', rows: 3 },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
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
    fields: [
      { key: 'topic', label: '主题', kind: 'text', required: true },
      { key: 'prompt', label: '描述', kind: 'textarea', rows: 3 },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 6 },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.product_suite', board: 'image', name: '电商商品套图', category: '精品推荐', complexity: 'heavy',
    cover: { template: 'case-3up', accent: 'warm' },
    summary: '主图、场景图、卖点图成套交付', pipeline: 'ecommerceSuite', availability: 'ready',
    fields: [
      { key: 'assets', label: '素材', kind: 'slot', required: true, slotLabel: '上传商品图' },
      { key: 'structure', label: '结构', kind: 'slot', required: true, slotLabel: '配置套图结构' },
      { key: 'skus', label: '规格', kind: 'slot', slotLabel: '编辑规格与张数' },
      { key: 'productParams', label: '商品信息', kind: 'textarea', rows: 5 },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 9 },
    ],
    cases: [
      { id: 'scene', title: '场景卖点主图', cover: '/gallery/ecommerce/stainless-steel-sauce-container/01.webp' },
      { id: 'usage', title: '真实使用详情图', cover: '/gallery/ecommerce/stainless-steel-sauce-container/02.webp' },
      { id: 'size', title: '尺寸对比详情图', cover: '/gallery/ecommerce/stainless-steel-sauce-container/03.webp' },
    ], history: true,
  },

  /* ── 电商专区：我们的强项，全部落到已验证的内置技能 ─────────────────────── */
  {
    id: 'image.white_bg', board: 'image', name: '白底商品图', category: '电商专区', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'cool' },
    summary: '干净白底，多角度呈现细节', pipeline: 'builtinSkill', availability: 'ready',
    fields: [
      { key: 'assets', label: '素材', kind: 'slot', required: true, slotLabel: '上传商品图' },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
      { key: 'clarity', label: '清晰度', kind: 'segmented', options: CLARITY, required: true },
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
    fields: [
      { key: 'assets', label: '素材', kind: 'slot', required: true, slotLabel: '上传商品图' },
      { key: 'scene', label: '场景', kind: 'text', placeholder: '例如：周末早晨的厨房台面' },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
      { key: 'clarity', label: '清晰度', kind: 'segmented', options: CLARITY, required: true },
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 6 },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.material', board: 'image', name: '材质细节', category: '电商专区', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'cool' },
    summary: '放大材质与工艺，给出结构证据', pipeline: 'builtinSkill', availability: 'ready',
    fields: [
      { key: 'assets', label: '素材', kind: 'slot', required: true, slotLabel: '上传商品图' },
      { key: 'focus', label: '重点', kind: 'text', placeholder: '例如：拉丝金属的纹理' },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
      { key: 'clarity', label: '清晰度', kind: 'segmented', options: CLARITY, required: true },
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 6 },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.multi_angle', board: 'image', name: '多角度套图', category: '电商专区', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'cool' },
    summary: '同一商品，多角度保持一致', pipeline: 'builtinSkill', availability: 'ready',
    fields: [
      { key: 'assets', label: '素材', kind: 'slot', required: true, slotLabel: '上传商品图' },
      { key: 'angle', label: '角度', kind: 'segmented', required: true, options: [
        { value: 'front', label: '正面' }, { value: 'side', label: '侧面' },
        { value: 'back', label: '背面' }, { value: 'top', label: '俯视' },
      ] },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
      { key: 'clarity', label: '清晰度', kind: 'segmented', options: CLARITY, required: true },
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 6 },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.try_on', board: 'image', name: '模特试穿', category: '电商专区', complexity: 'standard',
    cover: { template: 'before-after', accent: 'soft' },
    summary: '把商品穿到模特身上，姿势场景可选', pipeline: 'builtinSkill', availability: 'ready',
    fields: [
      { key: 'assets', label: '素材', kind: 'slot', required: true, slotLabel: '上传商品图' },
      { key: 'model', label: '模特', kind: 'slot', slotLabel: '选模特图' },
      { key: 'scene', label: '场景', kind: 'text', placeholder: '例如：城市清晨的街道' },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
      { key: 'clarity', label: '清晰度', kind: 'segmented', options: CLARITY, required: true },
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
    fields: [
      { key: 'assets', label: '素材', kind: 'slot', required: true, slotLabel: '上传商品图' },
      { key: 'character', label: '角色', kind: 'slot', slotLabel: '上传人物图' },
      { key: 'backdrop', label: '场景', kind: 'slot', slotLabel: '上传场景图' },
      { key: 'prompt', label: '要求', kind: 'textarea', rows: 3 },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
      { key: 'clarity', label: '清晰度', kind: 'segmented', options: CLARITY, required: true },
    ],
    cases: [], history: true,
  },

  /* ── 创意应用 ────────────────────────────────────────────────────────── */
  {
    id: 'image.brand_kv', board: 'image', name: '品牌主视觉', category: '创意应用', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'accent' },
    summary: '把品牌调性扩成一套画面语言', pipeline: 'visualCreation', availability: 'ready',
    fields: [
      { key: 'topic', label: '主题', kind: 'text', required: true },
      { key: 'brand', label: '品牌', kind: 'text', placeholder: '品牌名或关键词' },
      { key: 'prompt', label: '描述', kind: 'textarea', rows: 3 },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.cn_poster', board: 'image', name: '中文海报', category: '创意应用', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'warm' },
    summary: '中文标题与画面一起排', pipeline: 'visualCreation', availability: 'ready',
    fields: [
      { key: 'topic', label: '主题', kind: 'text', required: true },
      { key: 'prompt', label: '描述', kind: 'textarea', rows: 3 },
      { key: 'use', label: '用途', kind: 'segmented', options: [
        { value: 'promo', label: '促销' }, { value: 'event', label: '活动' },
        { value: 'show', label: '展览' }, { value: 'launch', label: '发布' },
      ] },
      { key: 'font', label: '字体', kind: 'segmented', options: [
        { value: 'sans', label: '黑体' }, { value: 'serif', label: '宋体' },
        { value: 'brush', label: '书法' }, { value: 'round', label: '圆体' },
      ] },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.copy', board: 'image', name: '图文复刻', category: '创意应用', complexity: 'standard',
    cover: { template: 'before-after', accent: 'cool' },
    summary: '保住构图与节奏，换成自己的内容', pipeline: 'visualCreation', availability: 'needs_ref',
    fields: [
      { key: 'source', label: '原图', kind: 'slot', required: true, slotLabel: '上传要复刻的图' },
      { key: 'reference', label: '参考', kind: 'slot', slotLabel: '上传自己的素材' },
      { key: 'prompt', label: '要求', kind: 'textarea', rows: 3 },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.similar', board: 'image', name: '相似图生成', category: '创意应用', complexity: 'simple',
    cover: { template: 'hero-single', accent: 'neutral' },
    summary: '沿着一张参考图再生成几张', pipeline: 'visualCreation', availability: 'needs_ref',
    fields: [
      { key: 'reference', label: '参考图', kind: 'slot', required: true, slotLabel: '上传参考图' },
      { key: 'strength', label: '强度', kind: 'segmented', options: [
        { value: 'low', label: '低' }, { value: 'mid', label: '中' }, { value: 'high', label: '高' },
      ] },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
    ],
    cases: [], history: true,
  },

  {
    id: 'image.xhs_note', board: 'image', name: '小红书图文', category: '创意应用', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'soft' },
    summary: '一组配图加标题正文，真实感优先', pipeline: 'xhsNote', availability: 'ready',
    fields: [
      { key: 'assets', label: '素材', kind: 'slot', required: true, slotLabel: '上传素材图' },
      { key: 'prompt', label: '描述', kind: 'textarea', rows: 3, placeholder: '例如：厦门 3 天 2 夜，第一次去怎么玩' },
      { key: 'style', label: '文风', kind: 'segmented', options: [
        { value: 'real', label: '真实分享' }, { value: 'guide', label: '攻略清单' },
        { value: 'review', label: '好物测评' }, { value: 'story', label: '生活记录' },
      ] },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 9 },
    ],
    cases: [], history: true,
  },

  /* ── 人像摄影 ────────────────────────────────────────────────────────── */
  {
    id: 'image.portrait', board: 'image', name: '人像精修', category: '人像摄影', complexity: 'standard',
    cover: { template: 'before-after', accent: 'soft' },
    summary: '皮肤、光线与质感一起收拾干净', pipeline: 'visualCreation', availability: 'needs_ref',
    fields: [
      { key: 'assets', label: '素材', kind: 'slot', required: true, slotLabel: '上传人像图' },
      { key: 'prompt', label: '要求', kind: 'textarea', rows: 3 },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
      { key: 'clarity', label: '清晰度', kind: 'segmented', options: CLARITY, required: true },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.hairstyle', board: 'image', name: '换发型', category: '人像摄影', complexity: 'standard',
    cover: { template: 'before-after', accent: 'soft' },
    summary: '保留五官，换一个发型', pipeline: 'visualCreation', availability: 'needs_ref',
    fields: [
      { key: 'assets', label: '素材', kind: 'slot', required: true, slotLabel: '上传人像图' },
      { key: 'style', label: '发型', kind: 'text', placeholder: '例如：齐肩短发、微卷' },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
      { key: 'clarity', label: '清晰度', kind: 'segmented', options: CLARITY, required: true },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.pose', board: 'image', name: '姿势生成', category: '人像摄影', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'soft' },
    summary: '同一个人，换几种姿势', pipeline: 'visualCreation', availability: 'needs_ref',
    fields: [
      { key: 'assets', label: '素材', kind: 'slot', required: true, slotLabel: '上传人物图' },
      { key: 'pose', label: '姿势', kind: 'text', placeholder: '例如：侧身回眸、手插口袋' },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 6 },
    ],
    cases: [], history: true,
  },

  /* ── 图片编辑：统一形态「一张图 + 一句要求」────────────────────────────── */
  {
    id: 'image.remove_bg', board: 'image', name: '去除背景', category: '图片编辑', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'cool' },
    summary: '去掉背景，出透明底或纯色底', pipeline: 'builtinSkill', availability: 'ready',
    fields: [
      { key: 'assets', label: '素材', kind: 'slot', required: true, slotLabel: '上传图片' },
      { key: 'mode', label: '底色', kind: 'segmented', required: true, options: [
        { value: 'transparent', label: '透明' }, { value: 'white', label: '白色' }, { value: 'custom', label: '自定' },
      ] },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.swap_bg', board: 'image', name: '换背景', category: '图片编辑', complexity: 'standard',
    cover: { template: 'before-after', accent: 'cool' },
    summary: '人物或商品留着，背景换掉', pipeline: 'visualCreation', availability: 'needs_ref',
    fields: [
      { key: 'assets', label: '素材', kind: 'slot', required: true, slotLabel: '上传原图' },
      { key: 'backdrop', label: '背景', kind: 'slot', slotLabel: '上传背景图' },
      { key: 'prompt', label: '要求', kind: 'textarea', rows: 3 },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.retouch', board: 'image', name: '图片精修', category: '图片编辑', complexity: 'standard',
    cover: { template: 'before-after', accent: 'neutral' },
    summary: '一张图加一句要求，改到能用', pipeline: 'visualCreation', availability: 'needs_ref',
    fields: [
      { key: 'assets', label: '素材', kind: 'slot', required: true, slotLabel: '上传图片' },
      { key: 'prompt', label: '要求', kind: 'textarea', rows: 3, placeholder: '例如：把背景杂物清掉，光线调亮一点' },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
      { key: 'clarity', label: '清晰度', kind: 'segmented', options: CLARITY, required: true },
    ],
    cases: [], history: true,
  },
  {
    id: 'image.style_swap', board: 'image', name: '材质替换', category: '图片编辑', complexity: 'standard',
    cover: { template: 'before-after', accent: 'warm' },
    summary: '主体不动，换材质或风格', pipeline: 'visualCreation', availability: 'needs_ref',
    fields: [
      { key: 'assets', label: '素材', kind: 'slot', required: true, slotLabel: '上传图片' },
      { key: 'material', label: '材质', kind: 'text', placeholder: '例如：磨砂陶瓷、原木' },
      { key: 'ratio', label: '比例', kind: 'segmented', options: RATIO, required: true },
      { key: 'clarity', label: '清晰度', kind: 'segmented', options: CLARITY, required: true },
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
