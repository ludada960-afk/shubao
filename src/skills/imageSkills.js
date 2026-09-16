/* ═══ 图片板块的 Skill 声明（单一事实源）═══════════════════════════════════════
   依据 docs/design/43-media-architecture.md §5 与 docs/design/44-p1c-image-hub-brief.md。
   为什么要有这个文件：现在"一个板块 = 一个手写页面"，所以 41 个面板文件里同一批配置
   （模型/清晰度/比例/数量）各写了一遍（实测 model 41 处、resolution 42 处、count 77 处、
   ratio 61 处），新增一个能力就要新增一个页面 —— 这条路径走不到 40+ 个 Skill。
   从今往后：**新增 Skill = 加一条声明**（外加封面与案例），页面与控件由 Hub 与
   WorkbenchShell / FieldRenderer 统一渲染（知渔实测也是这个机制：/image-creation?id=<skillId>
   一个页面渲染全部 Skill）。
   ⚠️ 本文件是**声明**，不含渲染与业务逻辑；pipeline 指向既有引擎，不重写。
   ⚠️ fields 的 kind 只能是 FieldRenderer 登记过的档位（select/segmented/stepper/textarea/text/slot），
      由 test/skill-declaration-contract-0916.test.mjs 断言。 */

export const SKILL_COMPLEXITIES = ['simple', 'standard', 'heavy'];
export const FIELD_KINDS = ['select', 'segmented', 'stepper', 'textarea', 'text', 'slot'];
export const IMAGE_PIPELINES = [
  'visualCreation',   // 自由创作/海报/封面的既有链路
  'ecommerceSuite',   // 电商套图（现有 EcMode + EcommerceWorkbench 面板整体嵌入）
  'builtinSkill',     // 现有内置技能（白底图 / 模特试穿）
  'xhsNote',          // 小红书种草图文（现有 XhsContentMode）
];

export const IMAGE_SKILLS = [
  {
    id: 'image.free',
    board: 'image',
    name: '自由创作',
    category: '精品推荐',
    complexity: 'simple',
    cover: { template: 'hero-single', accent: 'neutral' },
    summary: '一句话起步，画面方向自己定',
    pipeline: 'visualCreation',
    fields: [
      { key: 'model', label: '模型', kind: 'select', required: true },
      { key: 'ratio', label: '比例', kind: 'segmented', required: true },
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 9 },
    ],
    cases: [],
    history: true,
  },
  {
    id: 'image.poster',
    board: 'image',
    name: '海报设计',
    category: '创意应用',
    complexity: 'simple',
    cover: { template: 'poster-style', accent: 'warm' },
    summary: '文化、活动与商业海报，版式与文字层级一起给',
    pipeline: 'visualCreation',
    fields: [
      { key: 'model', label: '模型', kind: 'select', required: true },
      { key: 'ratio', label: '比例', kind: 'segmented', required: true },
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 6 },
    ],
    /* 案例即封面素材：下面这几张就是"点进去能看到的东西"，封面由它们排出来（不是另做一张）。 */
    cases: [
      { id: 'tide', title: '潮汐标本 · 海岸线上的时间档案', cover: '/images/visual-recipes/cases/poster-tide-exhibition.png' },
    ],
    history: true,
  },
  {
    id: 'image.social_cover',
    board: 'image',
    name: '社媒封面',
    category: '创意应用',
    complexity: 'simple',
    cover: { template: 'poster-style', accent: 'accent' },
    summary: '公众号、视频号与电商主图封面',
    pipeline: 'visualCreation',
    fields: [
      { key: 'model', label: '模型', kind: 'select', required: true },
      { key: 'ratio', label: '比例', kind: 'segmented', required: true },
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 9 },
    ],
    cases: [],
    history: true,
  },
  {
    id: 'image.product_suite',
    board: 'image',
    name: '电商商品套图',
    category: '电商专区',
    complexity: 'heavy',
    cover: { template: 'case-3up', accent: 'warm' },
    summary: '白底图 / 场景图 / 卖点图 / 细节图成套交付，符合平台规范',
    pipeline: 'ecommerceSuite',
    fields: [
      { key: 'model', label: '模型', kind: 'select', required: true },
      { key: 'ratio', label: '比例', kind: 'segmented', required: true },
      { key: 'structure', label: '套图结构', kind: 'slot', required: true, slotLabel: '配置套图结构' },
      { key: 'skus', label: '商品规格', kind: 'slot', slotLabel: '编辑规格与张数' },
      { key: 'productParams', label: '商品信息', kind: 'textarea', rows: 5 },
    ],
    /* 一组真实成品：场景卖点主图 / 真实使用详情图 / 尺寸对比详情图 —— 封面就是这三张。 */
    cases: [
      { id: 'scene', title: '场景卖点主图', cover: '/gallery/ecommerce/stainless-steel-sauce-container/01.webp' },
      { id: 'usage', title: '真实使用详情图', cover: '/gallery/ecommerce/stainless-steel-sauce-container/02.webp' },
      { id: 'size', title: '尺寸对比详情图', cover: '/gallery/ecommerce/stainless-steel-sauce-container/03.webp' },
    ],
    history: true,
  },
  {
    id: 'image.white_bg',
    board: 'image',
    name: '白底商品图',
    category: '电商专区',
    complexity: 'standard',
    cover: { template: 'hero-single', accent: 'cool' },
    summary: '白底主图，多角度呈现商品细节',
    pipeline: 'builtinSkill',
    fields: [
      { key: 'model', label: '模型', kind: 'select', required: true },
      { key: 'ratio', label: '比例', kind: 'segmented', required: true },
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 9 },
    ],
    cases: [
      { id: 'white', title: '标准识别白底图', cover: '/gallery/ecommerce/baby-bottle-product-suite/01.webp' },
    ],
    history: true,
  },
  {
    id: 'image.try_on',
    board: 'image',
    name: '模特上身 / 试穿',
    category: '人像摄影',
    complexity: 'standard',
    cover: { template: 'before-after', accent: 'soft' },
    summary: '把商品穿到模特身上，姿势与场景可选',
    pipeline: 'builtinSkill',
    fields: [
      { key: 'model', label: '模型', kind: 'select', required: true },
      { key: 'ratio', label: '比例', kind: 'segmented', required: true },
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 6 },
      { key: 'scene', label: '场景', kind: 'text', placeholder: '例如：城市清晨的街道' },
    ],
    /* 试穿类给「原图 → 成品」两张（43 §10.4：复刻/修图/试穿类一律做对比，比单张成品更说明问题）。 */
    cases: [
      { id: 'source', title: '商品与模特原图', cover: '/images/home/ability-tryon-example-input.png' },
      { id: 'result', title: 'AI 试穿成品', cover: '/images/home/ability-tryon-example-output.png' },
    ],
    history: true,
  },
  {
    id: 'image.xhs_note',
    board: 'image',
    name: '小红书种草图文',
    category: '电商专区',
    complexity: 'standard',
    cover: { template: 'case-3up', accent: 'soft' },
    summary: '一组配图 + 标题 + 正文，真实感优先',
    pipeline: 'xhsNote',
    fields: [
      { key: 'model', label: '模型', kind: 'select', required: true },
      { key: 'ratio', label: '比例', kind: 'segmented', required: true },
      { key: 'count', label: '数量', kind: 'stepper', min: 1, max: 9 },
      { key: 'style', label: '文风', kind: 'segmented' },
    ],
    cases: [],
    history: true,
  },
];

export const IMAGE_SKILL_CATEGORIES = [...new Set(IMAGE_SKILLS.map(skill => skill.category))];

export function getImageSkill(id) {
  const key = typeof id === 'string' ? id.trim() : '';
  return IMAGE_SKILLS.find(skill => skill.id === key) || null;
}
