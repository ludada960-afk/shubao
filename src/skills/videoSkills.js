/* ═══ 视频板块的 Skill 声明（单一事实源）═══════════════════════════════════════
   依据 docs/design/43-media-architecture.md §3.3 / §5 与 docs/design/44。
   用户批注（图 #9）：「视频生成的三个入口只保留智能成片和首尾帧，爆款复刻可以通过 skill 的形式
   去复刻……你要去找现在最前沿的一些视频生成相关的 skill 出来，让它们成为我们的视频 skill 库」
   「你不要真正的去跑这些案例出来，成本非常的高……你先把 UI 和 skill 内置进去，
    案例你先找一些替代的视频过来占位，后期我自己去点击生成再替换掉」。
   用户 9-17 又补了一条口径：「建筑家装要做 —— 他们有多少案例不用管，你要把建筑家装的 skill
   找到位，并且子页面和工作台做到位。」（他们视频页 32 条里有 19 条是建筑室内，我们照这个方向补。）

   ⚠️ 本文件是**声明**：不含模型名（模型由路由层按 capability 过滤，见 9-16 路由可达性台账），
      只声明"这个 skill 需要什么素材、要哪些字段、走哪条既有引擎"。
   ⚠️ availability 如实标注，不许把跑不通的写成能用：
      · 'ready'     现有可调用路由（seedance_fast / seedance_standard）即可满足；
      · 'needs_ref' 需要参考素材能力（现有路由已声明支持，但未实测出片）；
      · 'blocked'   需要的能力当前不可用（例如 1080P 或余额不足档位）——**上架前必须先转 ready**。
   ⚠️ brief 是这条 skill 的**配方提示词**：进子页面时会被预填进创作台的输入框
      （用户口径：skill = 一个具体玩法，进去就该看到"这条玩法该怎么拍"，
       而不是一个空白输入框 + 一个名字）。所以每条 brief 都要写成**可直接出片的拍摄说明**，
      不许写成"生成高质量视频"这种空话。 */

export const VIDEO_CAPABILITIES = ['text', 'image', 'video', 'audio', 'frames'];
export const VIDEO_PIPELINES = [
  'videoSmart',   // 现有智能成片链路
  'videoFrame',   // 现有首尾帧链路
  'videoRemake',  // 现有爆款复刻链路
  'videoReference', // 现有全能参考（图片/视频/音频）链路
];
export const VIDEO_AVAILABILITY = ['ready', 'needs_ref', 'blocked'];

/* 视频技能的工作台就是**嵌进子页面的创作台本身**（视频生成 3 档：智能成片 / 首尾帧 / 爆款重构），
   所以这里的 fields 只声明"这条玩法要用到哪些输入"，真正可点的控件在创作台里
   （模型 / 清晰度 / 时长 / 素材上传 / 提示词）。这一点与图片技能不同：
   图片技能的工作台是我们自己渲染的字段面板，视频技能的工作台是既有的创作台。 */
const VIDEO_BASE_FIELDS = [
  { key: 'model', label: '模型', kind: 'select', required: true },
  { key: 'resolution', label: '清晰度', kind: 'segmented', required: true },
  { key: 'duration', label: '时长', kind: 'segmented', required: true },
];

export const VIDEO_SKILLS = [
  {
    id: 'video.smart', board: 'video', name: '智能成片', category: '精品推荐', complexity: 'standard',
    summary: '一句话起步，镜头与节奏交给模型', capability: ['image', 'video', 'audio'], availability: 'ready',
    pipeline: 'videoSmart', cover: { template: 'case-3up', accent: 'accent' },
    brief: '用上传的素材做一支短视频：开场 1 秒先给一个明确的主体特写抓住注意力，中段展示使用场景与材质细节，结尾回到商品全景并留出放文案的安全区。镜头运动平稳、光线自然，主体始终清晰，不出现水印、价格与无关文字。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.frame', board: 'video', name: '首尾帧', category: '精品推荐', complexity: 'standard',
    summary: '两张图锁定镜头起点与终点，中间交给模型', capability: ['frames'], availability: 'ready',
    pipeline: 'videoFrame', cover: { template: 'case-3up', accent: 'cool' },
    brief: '以第一张图作为镜头起点、第二张图作为终点：中间的运动与转场要自然连贯，主体保持同一形状与配色，背景平滑过渡，镜头缓慢推进或平移，不出现跳变、形变与闪烁。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.remake', board: 'video', name: '爆款复刻', category: '热门玩法', complexity: 'standard',
    summary: '保留参考片的节奏与镜头结构，换上你的内容', capability: ['video', 'image'], availability: 'needs_ref',
    pipeline: 'videoRemake', cover: { template: 'case-3up', accent: 'warm' },
    brief: '参考上传视频的节奏与镜头结构，把内容替换成我的商品：保留原来的分镜顺序、景别变化与卡点，画面主体换成我的商品并保持结构、颜色与包装文字一致，光线与原片接近，不出现形变。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.image_to_video', board: 'video', name: '图生视频', category: '热门玩法', complexity: 'simple',
    summary: '一张商品图动起来，适合主图视频与详情动效', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'hero-single', accent: 'warm' },
    brief: '让这张商品图动起来：主体轻微旋转约 15 度展示侧面，环境光缓慢扫过表面形成高光流动，背景保持稳定，镜头微推，画面干净、不出现多余元素与文字。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.product_motion', board: 'video', name: '商品动态展示', category: '电商专区', complexity: 'simple',
    summary: '商品旋转、光影扫过、材质微距，用在主图与详情首屏', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'hero-single', accent: 'warm' },
    brief: '商品动态展示：从静置开始，缓慢旋转展示结构与材质，光从侧后方扫过突出质感，微距掠过关键细节，最后回到正面全景。背景干净，主体全程锐利对焦，不出现文字与价格。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.content_swap', board: 'video', name: '内容替换', category: '热门玩法', complexity: 'standard',
    summary: '上传人物视频和人物图片，一键换人（知渔同款玩法）', capability: ['video', 'image'], availability: 'needs_ref',
    pipeline: 'videoRemake', cover: { template: 'case-3up', accent: 'soft' },
    brief: '保留上传视频里人物的动作与镜头运动，把人物替换成我上传的图片中的人：五官、发型、肤色与服装与图片保持一致，动作连贯自然，边缘干净，不出现脸部抖动或糊边。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.model_runway', board: 'video', name: '模特动态', category: '人像摄影', complexity: 'simple',
    summary: '让模特照片走起来：转身、迈步、衣摆飘动', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'hero-single', accent: 'soft' },
    brief: '让模特照片走起来：转身、迈步、衣摆自然飘动，镜头跟随并保持人物在画面中央，光线稳定，布料垂坠感真实，五官与服装细节保持清晰，不出现肢体变形。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.camera_move', board: 'video', name: '运镜控制', category: '热门玩法', complexity: 'standard',
    summary: '推、拉、摇、移、环绕，指定镜头怎么走', capability: ['image', 'text'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'case-3up', accent: 'accent' },
    brief: '镜头运动明确：从全景缓慢推近到主体特写，再平移展示侧面，最后拉远回到全景。运动速度均匀、全程对焦稳定，不出现画面抖动与主体漂移。',
    fields: [
      ...VIDEO_BASE_FIELDS,
      { key: 'camera', label: '运镜', kind: 'segmented', required: true },
    ],
    cases: [], history: true,
  },
  {
    id: 'video.extend', board: 'video', name: '延长续写', category: '创意应用', complexity: 'standard',
    summary: '接着上一段往下拍，保持主体与光线连续', capability: ['video'], availability: 'blocked',
    pipeline: 'videoRemake', cover: { template: 'case-3up', accent: 'cool' },
    brief: '在已有成片的最后一帧继续往下拍：动作与光线要接得上，镜头运动与上一段保持一致，主体形状与配色不变，不出现跳帧、闪烁或变形。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.festival_spot', board: 'video', name: '节日营销短片', category: '创意应用', complexity: 'simple',
    summary: '节点氛围 + 商品，适合大促与节日投放', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'poster-style', accent: 'accent' },
    brief: '做一支节日营销短片：开场用节日氛围元素（灯串、暖光、装饰）铺氛围，中段展示商品与节日场景的结合，结尾回到商品并留出放文案的安全区。色调统一、节奏轻快，不出现臆造的品牌与价格。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },

  /* ── 建筑家装（用户 9-17 明确要求做；竞品视频页 19 条都在这一档）───────────────
     我们的引擎能做的是**图生视频 / 参考素材**这条路：给一张空间图或户型图，
     用提示词把"怎么动"说清楚。所以这里按"动法"分成三类：
       · 空间展示类（漫游 / 光线 / 日夜 / 软装进场）—— 图生视频即可，ready；
       · 生长类（户型生长 / 建筑生长 / 植物生长）—— 需要参考图锁住结构，needs_ref；
       · 叙事类（空间叙事短片）—— 智能成片，ready。 */
  {
    id: 'video.space_tour', board: 'video', name: '空间漫游', category: '建筑家装', complexity: 'standard',
    summary: '镜头沿动线走一遍，把空间讲明白', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'hero-single', accent: 'cool' },
    brief: '用上传的空间图做一段漫游：镜头从入口缓慢推进，沿动线依次掠过主要区域（客厅 → 餐厅 → 主卧），最后停在视觉中心。运动平稳、透视一致、光线自然，空间比例与材质保持真实，不出现家具变形或穿模。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.light_shift', board: 'video', name: '光线变化', category: '建筑家装', complexity: 'simple',
    summary: '机位不动，只让光线与阴影走一遍', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'hero-single', accent: 'warm' },
    brief: '机位固定不动，只让光线随时间变化：清晨冷调 → 正午明亮 → 黄昏暖调 → 夜晚灯光亮起。阴影方向与色温随之平滑过渡，画面结构、家具位置保持不变，过渡自然无跳变。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.day_night', board: 'video', name: '日夜气候切换', category: '建筑家装', complexity: 'standard',
    summary: '白天到雨夜，同一场景的四种天气', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'hero-single', accent: 'cool' },
    brief: '同一个场景在日夜与天气之间切换：白天 → 黄昏 → 夜晚 → 雨夜，云层、反光与地面湿度随之变化，镜头缓慢平移，建筑与空间结构全程保持不变，过渡平滑。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.furnishing_in', board: 'video', name: '软装进场', category: '建筑家装', complexity: 'standard',
    summary: '家具与软装依次落位，空房变样板间', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'case-3up', accent: 'soft' },
    brief: '家具与软装依次进场：沙发、茶几、灯具、地毯按顺序落位，动作轻快自然，镜头缓慢后退展示整体效果。空间结构与比例不变，材质与配色统一，不出现家具漂浮或穿墙。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.floorplan_grow', board: 'video', name: '户型生长', category: '建筑家装', complexity: 'standard',
    summary: '从户型图长出一整套三维空间', capability: ['image'], availability: 'needs_ref',
    pipeline: 'videoReference', cover: { template: 'case-3up', accent: 'accent' },
    brief: '从上传的户型图开始生长出三维空间：墙体、地面、家具依次出现并归位，镜头缓慢俯冲进入室内，最后停在主空间全景。生长顺序清楚、比例可信，房间数量与位置与户型图一致。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.building_grow', board: 'video', name: '建筑生长', category: '建筑家装', complexity: 'standard',
    summary: '建筑从地基逐层长起来', capability: ['image'], availability: 'needs_ref',
    pipeline: 'videoReference', cover: { template: 'hero-single', accent: 'cool' },
    brief: '建筑从地基开始逐层生长：结构、幕墙、灯光依次出现，镜头缓慢环绕上升，最后定格在完整外观。节奏均匀、透视一致，建筑轮廓与层数保持不变，不出现结构错位。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.plant_grow', board: 'video', name: '植物生长', category: '建筑家装', complexity: 'simple',
    summary: '抽芽、展叶、开花，时间加速的连续动作', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'hero-single', accent: 'soft' },
    brief: '植物从幼苗开始生长：抽芽、展叶、开花，时间加速但动作连续不跳跃，镜头缓慢推进，背景与光线保持稳定，叶片形状与色彩自然。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.interior_story', board: 'video', name: '空间叙事短片', category: '建筑家装', complexity: 'heavy',
    summary: '一支短片讲这个空间的一天', capability: ['image', 'text'], availability: 'ready',
    pipeline: 'videoSmart', cover: { template: 'case-3up', accent: 'warm' },
    brief: '用一支短片讲这个空间的一天：人物进入、坐下、使用与离开，穿插空间细节与光线变化，镜头语言克制、节奏舒缓，像一支空间宣传片；结尾停在最能代表这个空间的一帧，不出现文字与水印。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
];
export const VIDEO_SKILL_CATEGORIES = [...new Set(VIDEO_SKILLS.map(skill => skill.category))];

export function getVideoSkill(id) {
  const key = typeof id === 'string' ? id.trim() : '';
  return VIDEO_SKILLS.find(skill => skill.id === key) || null;
}
