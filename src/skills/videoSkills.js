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
    /* ═══ 精品推荐（7 条，对齐竞品那一档的槽位）═══════════════════════════════════
       用户 9-17：「视频的精品推荐现在只有 2 条，竞品是 7 条 —— 可以，改吧，不知道改什么就学他就好。」
       竞品精品推荐 7 条 = 视频创作 / 探店视频 / 爆款复刻 / 数字人 / 视频高清 / 视频字幕去除 / 内容替换。
       我们有的直接对上：视频创作→**智能成片**、探店视频→**探店漫游**、爆款复刻→**爆款复刻**、
       内容替换→**内容替换**；他们没有、我们用户点名的**首尾帧**保留；
       剩下两个槽位（数字人 / 视频高清 / 去字幕）上游能力不具备，用我们最能打的两条补：
       **商品动态展示**（商品类第一）与 **3C 旋转展示**（细节展示类第一）。
       首页视频那一排取前 6 条，所以声明顺序 = 首页顺序，别随手挪。 */
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
    id: 'video.remake', board: 'video', name: '爆款复刻', category: '精品推荐', complexity: 'standard',
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
    id: 'video.product_motion', board: 'video', name: '商品动态展示', category: '精品推荐', complexity: 'simple',
    summary: '商品旋转、光影扫过、材质微距，用在主图与详情首屏', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'hero-single', accent: 'warm' },
    brief: '商品动态展示：从静置开始，缓慢旋转展示结构与材质，光从侧后方扫过突出质感，微距掠过关键细节，最后回到正面全景。背景干净，主体全程锐利对焦，不出现文字与价格。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.content_swap', board: 'video', name: '内容替换', category: '精品推荐', complexity: 'standard',
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
    /* tier: assistant —— "镜头怎么走"是**一个控制项**，不是一种玩法/活儿。
       竞品没有单独的"运镜"技能：它写在提示词里，跟主体、场景一起描述。
       所以它降级为辅助能力（用户仍可直达，但首页与主档不占位）。 */
    tier: 'assistant', belongsTo: 'video.smart',
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
    /* tier: assistant —— 输入是**已有的成片**，属于成片之后的加工动作，
       不该占一个创作入口（用户不会"我想延长续写"作为出发点）。 */
    tier: 'assistant', belongsTo: 'video.smart',
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
    pipeline: 'videoReference', cover: { template: 'case-3up', accent: 'cool' },
    brief: '用上传的空间图做一段漫游：镜头从入口缓慢推进，沿动线依次掠过主要区域（客厅 → 餐厅 → 主卧），最后停在视觉中心。运动平稳、透视一致、光线自然，空间比例与材质保持真实，不出现家具变形或穿模。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.light_shift', board: 'video', name: '光线变化', category: '建筑家装', complexity: 'simple',
    summary: '机位不动，只让光线与阴影走一遍', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'case-3up', accent: 'warm' },
    brief: '机位固定不动，只让光线随时间变化：清晨冷调 → 正午明亮 → 黄昏暖调 → 夜晚灯光亮起。阴影方向与色温随之平滑过渡，画面结构、家具位置保持不变，过渡自然无跳变。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.day_night', board: 'video', name: '日夜气候切换', category: '建筑家装', complexity: 'standard',
    summary: '白天到雨夜，同一场景的四种天气', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'case-3up', accent: 'cool' },
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

  /* ── 调研落地的爆款玩法（2026-09-17）────────────────────────────────────────
     来源：docs/research/2026-09-17-video-skill-candidates.md（20 条候选，B站/抖音/小红书/GitHub 一手取证）。
     用户口径：「你得自己去调研，去各种插件库或者 GitHub 上面找这些相应的最好的方案，
     甚至去 B站、抖音、小红书、微信公众号找那些别人分享出来、确确实实有很高热度的 skill 放进去。」
     ⚠️ 每条都标了真实档位：ready = 现有路由可跑；needs_ref = 需要参考素材能力（声明支持、未实测出片）；
        blocked 的一条（数字人口播，147.4 万播放量级）**没有**写进来假装能用 —— 它要口型/音频驱动，
        属于上游能力缺口，等定了上游再上架。
     ⚠️ brief 写的是"这条玩法具体怎么拍"，不是"生成高质量视频"。 */
  {
    id: 'video.traffic_swap', board: 'video', name: '红绿灯换装', category: '热门玩法', complexity: 'simple',
    summary: '红灯亮起换一套衣服，卡着信号灯变装', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'case-3up', accent: 'accent' },
    brief: '红绿灯换装：人物站在路口，信号灯每变一次颜色就换一套完整穿搭（红→绿→黄三套），换装瞬间用轻微的运动模糊或遮挡带过，人物位置与镜头不动，服装材质与配色清晰可辨，节奏跟信号灯同步。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.car_weekly', board: 'video', name: '车内一周换装', category: '热门玩法', complexity: 'simple',
    summary: '坐进车里，一周七套穿搭依次换', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'case-3up', accent: 'soft' },
    brief: '车内一周换装：固定机位拍车内，同一个人依次换上七套不同穿搭（周一通勤 → 周五休闲 → 周末出游），每次切换用关门、转头或抬手遮挡过渡，坐姿与车内环境不变，服装细节清楚。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.outfit_transition', board: 'video', name: '服饰变装转场', category: '热门玩法', complexity: 'standard',
    summary: '卡点或色卡转场，一镜换多套', capability: ['image', 'video'], availability: 'needs_ref',
    pipeline: 'videoReference', cover: { template: 'case-3up', accent: 'accent' },
    brief: '服饰变装转场：跟着音乐卡点换装，每次转场用一个道具或色卡遮住镜头（挥手、甩发、举卡片），换完立刻接下一套；人物位置、机位与光线保持一致，服装质感与配色清晰，节奏干净利落。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.fog_reveal', board: 'video', name: '擦雾出产品', category: '热门玩法', complexity: 'simple',
    summary: '手指擦开雾气，商品从模糊里露出来', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'hero-single', accent: 'cool' },
    brief: '擦雾出产品：镜头贴着一层雾面（玻璃/镜面/冷藏柜门），一只手从画面一侧擦开雾气，商品从模糊逐渐变清晰，擦过的区域留下清晰的水痕；最后停在商品特写上，光线通透、细节锐利。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.one_image_showcase', board: 'video', name: '一图裂变展示', category: '热门玩法', complexity: 'standard',
    summary: '一张商品图，裂变成一整组展示镜头', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'case-3up', accent: 'warm' },
    brief: '一图裂变展示：从一张商品图开始，画面像卡片一样裂开成多格，每一格展示商品的一个面（正面、侧面、细节、场景、包装），最后所有格子合回完整商品；转场干净、比例一致，商品结构不变。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.product_explode', board: 'video', name: '产品爆炸展示', category: '电商专区', complexity: 'standard',
    summary: '商品在空中炸开，零件与成分悬浮', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'hero-single', accent: 'warm' },
    brief: '产品爆炸展示：商品在画面中央炸开成零件与成分，碎片向四周缓慢飞散并悬停，镜头缓慢环绕或推进，最后零件回位复原；物理感真实、节奏由慢到快再收住，商品标签全程可辨。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.snack_unbox', board: 'video', name: '零食开箱', category: '电商专区', complexity: 'simple',
    summary: '拆袋、倒出、入口，一条龙展示', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'case-3up', accent: 'warm' },
    brief: '零食开箱：镜头俯拍桌面，手撕开包装袋、把零食倒进盘子里、捏起一块展示质地，最后放进嘴里；动作连贯、声音与画面节奏配合，包装与零食颜色真实，不出现臆造的文字。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.tech_rotate', board: 'video', name: '3C 旋转展示', category: '精品推荐', complexity: 'simple',
    summary: '360 度转一圈，把接口与厚度讲清楚', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'hero-single', accent: 'cool' },
    brief: '3C 产品旋转展示：产品在纯色台面上缓慢旋转 360 度，途中停两次给特写（接口、按键、厚度侧面），光线干净、反射真实，屏幕与机身质感清晰，全程不出现品牌以外的文字。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.food_craving', board: 'video', name: '食品馋感特写', category: '电商专区', complexity: 'standard',
    summary: '拉丝、爆汁、冒热气，把馋感拍出来', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'hero-single', accent: 'warm' },
    brief: '食品馋感特写：微距镜头下食物被拉开（拉丝/爆汁/流心），热气缓缓升起，表面油光与颗粒清晰可见，镜头缓慢推进并在最诱人的一刻定格；色调暖、对比强，不出现文字与价格。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.tech_tvc', board: 'video', name: '3C 产品 TVC', category: '电商专区', complexity: 'heavy',
    summary: '一支完整的产品广告片：悬念、特写、收束', capability: ['image', 'text'], availability: 'ready',
    pipeline: 'videoSmart', cover: { template: 'case-3up', accent: 'cool' },
    brief: '3C 产品 TVC：开场用暗场与一束光制造悬念，中段给产品三组特写（材质、屏幕、结构），穿插一个使用场景，结尾回到产品全景并留出放标语的安全区；镜头语言克制、节奏有起伏，色调统一。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.home_goods_demo', board: 'video', name: '家居好物演示', category: '电商专区', complexity: 'standard',
    summary: '在家里用一遍，把省事讲清楚', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'case-3up', accent: 'soft' },
    brief: '家居好物演示：真实居家场景里把商品用一遍（拿出、使用、收纳），展示它解决的问题；镜头跟着手走，光线自然，画面干净、不出现杂乱背景，商品细节清楚。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.beauty_macro', board: 'video', name: '美妆质感特写', category: '人像摄影', complexity: 'standard',
    summary: '膏体、粉质、上脸，微距讲质感', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'hero-single', accent: 'soft' },
    brief: '美妆质感特写：微距镜头依次展示膏体挤出/粉质扫过/液体流动的质感，再切到上脸后的皮肤状态（服帖、光泽、不卡粉），光线柔和不油光；颜色真实，不出现夸大功效的文字。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.street_style', board: 'video', name: '服装街拍带货', category: '人像摄影', complexity: 'standard',
    summary: '街头走两步，把版型与搭配演出来', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'case-3up', accent: 'warm' },
    brief: '服装街拍带货：模特在街头自然走动、转身、整理衣领，镜头跟随并保持全身入画；展示版型、垂坠与搭配细节，光线是自然日光，背景有城市氛围但不抢主体，服装颜色真实。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.ai_styling', board: 'video', name: 'AI 模特换装', category: '人像摄影', complexity: 'standard',
    summary: '同一模特，把几套衣服依次穿上', capability: ['image'], availability: 'needs_ref',
    pipeline: 'videoReference', cover: { template: 'case-3up', accent: 'soft' },
    brief: 'AI 模特换装：保持同一位模特的脸、发型与身材不变，依次换上多套服装，每次换装用一个转身或抬手遮挡过渡；服装版型与面料质感真实，站姿与机位保持一致，不出现肢体变形。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.book_selling', board: 'video', name: '图书知识带货', category: '创意应用', complexity: 'standard',
    summary: '翻页、金句、场景，把一本书讲清楚', capability: ['image', 'text'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'case-3up', accent: 'warm' },
    brief: '图书知识带货：书在桌面被翻开，书页依次翻动并停在几个关键页，穿插书中场景的意象画面，最后回到封面；画面干净、光线柔和，书名字迹清楚，不出现臆造的推荐语与销量数字。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.food_asmr', board: 'video', name: '美食吃播 ASMR', category: '创意应用', complexity: 'standard',
    summary: '近距离的咀嚼与热气，声音画面一起上', capability: ['image'], availability: 'needs_ref',
    pipeline: 'videoSmart', cover: { template: 'hero-single', accent: 'warm' },
    brief: '美食吃播 ASMR：近距离镜头对着食物与餐具，收音感强（咀嚼、撕开、倒汤、气泡），热气与油光清晰，镜头缓慢推近并保持稳定；色调暖、氛围安静，不出现文字与价格。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.store_tour', board: 'video', name: '探店漫游', category: '精品推荐', complexity: 'standard',
    summary: '推门进去走一圈，把店与货架讲明白', capability: ['image'], availability: 'needs_ref',
    pipeline: 'videoSmart', cover: { template: 'case-3up', accent: 'accent' },
    brief: '探店漫游：镜头从店门口推进，沿动线走过货架与展示区，在重点商品前停留并给特写，最后停在店内最有氛围的一角；运动平稳、光线真实，空间结构一致，不出现虚构的品牌与价格。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },

  /* ── 官方用例里我们缺的 4 条（2026-09-17 补）──────────────────────────────────
     来源：EvoLinkAI/awesome-seedance-2.5-guide（403★）的官方 use-cases —— 每条都按官方那条
     用例的**结构**落地（不是我自己编的玩法）。出处登记在 src/skills/skillSources.js。 */
  {
    id: 'video.multi_angle_showcase', board: 'video', name: '多角度展示', category: '电商专区', complexity: 'standard',
    summary: '正侧背、材质与细节，一次讲完', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'case-3up', accent: 'cool' },
    brief: '对上传的商品做一次商业化摄像展示：正面、侧面与背面依次出现，表面材质与五金细节各给一次特写，镜头缓慢环绕并保持主体居中；光线干净、反射真实，商品结构与包装文字全程一致。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.product_placement', board: 'video', name: '产品植入', category: '电商专区', complexity: 'standard',
    summary: '把商品自然放进已有视频里', capability: ['video', 'image'], availability: 'needs_ref',
    pipeline: 'videoRemake', cover: { template: 'case-3up', accent: 'warm' },
    brief: '把上传的商品植入已有视频：保留原片的人物动作、镜头运动与节奏不变，在指定位置自然地放入商品（桌面、手中或背景货架），并给一次手部特写；商品结构与包装文字清晰，光影与原片一致，不出现悬浮或边缘发虚。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    /* tier: assistant —— 输入是已有视频，属于编辑动作（换发色 / 加背景物 / 去杂物），
       通常发生在"产品植入 / 内容替换"这类主技能之后。 */
    tier: 'assistant', belongsTo: 'video.product_placement',
    id: 'video.scene_edit', board: 'video', name: '画面修改', category: '创意应用', complexity: 'standard',
    summary: '只改指定元素，其它一律不动', capability: ['video'], availability: 'needs_ref',
    pipeline: 'videoRemake', cover: { template: 'before-after', accent: 'accent' },
    brief: '只修改画面里指定的那个元素（换发色 / 加一个背景物体 / 去掉杂物），其余一律不动：原片的人物、动作、镜头与构图保持不变，新增元素的光影、景深与色温要和原片一致，不出现边缘割裂或闪烁。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.storyboard_to_video', board: 'video', name: '分镜转视频', category: '热门玩法', complexity: 'heavy',
    summary: '把分镜脚本逐格拍成成片', capability: ['image', 'text'], availability: 'ready',
    pipeline: 'videoSmart', cover: { template: 'case-3up', accent: 'accent' },
    brief: '按上传的分镜脚本逐格生成视频：每个分镜的景别、动作与台词按脚本走，镜头之间用干净的切或短过渡衔接，整体节奏统一；角色、场景与商品在各分镜中保持一致，不出现人物变形或商品改样。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },

  /* ── 官方用例再补 3 条电商向（2026-09-17 第二轮）───────────────────────────────
     这三条来自官方 01 一致性章与 09 音乐卡点章，都是电商直接用得上的硬需求：
     包装文字一致性、多场景拼接、卡点混剪。出处见 skillSources.js。 */
  {
    id: 'video.text_consistency', board: 'video', name: '文字一致性广告', category: '电商专区', complexity: 'standard',
    summary: '包装与卖点文字全程不糊、不改样', capability: ['image', 'text'], availability: 'needs_ref',
    pipeline: 'videoReference', cover: { template: 'case-3up', accent: 'warm' },
    brief: '按分秒写清每个镜头的画面与口播：0-2 秒快速四格闪切，把商品的四个款式/配色依次定格，特写材质与包装上的品牌字样；3-6 秒给一次结构或五金特写；7-12 秒切换三到四个使用场景；最后几秒并排陈列全部款式收尾。全程包装文字、Logo 与配色必须逐帧一致、清晰不糊，不出现臆造的品牌与价格。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.scene_stitch', board: 'video', name: '多场景拼接', category: '热门玩法', complexity: 'standard',
    summary: '一张首帧带出上下左右多个场景', capability: ['image'], availability: 'needs_ref',
    pipeline: 'videoReference', cover: { template: 'case-3up', accent: 'accent' },
    brief: '以上传的主图为画面首帧，第一人称视角：镜头先看正前方，再依次转向左侧与右侧，把旁边几张参考图里的场景无缝拼接到同一个空间里；转场跟随视线，透视与光线保持一致，商品在各场景中位置与比例合理，不出现错位或重复。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
  {
    id: 'video.beat_mashup', board: 'video', name: '卡点混剪', category: '热门玩法', complexity: 'standard',
    summary: '多张图跟着音乐卡点依次出来', capability: ['image'], availability: 'ready',
    pipeline: 'videoSmart', cover: { template: 'case-3up', accent: 'soft' },
    brief: '把上传的多张图做成音乐卡点混剪：每一张在鼓点或重拍上切换，镜头运动方式每两拍变化一次（推近 / 横移 / 轻微旋转），过渡干净不拖影；整体色调统一，节奏与音乐贴合，不出现文字与水印。',
    fields: VIDEO_BASE_FIELDS,
    cases: [], history: true,
  },
];
export const VIDEO_SKILL_CATEGORIES = [...new Set(VIDEO_SKILLS.map(skill => skill.category))];

export function getVideoSkill(id) {
  const key = typeof id === 'string' ? id.trim() : '';
  return VIDEO_SKILLS.find(skill => skill.id === key) || null;
}
