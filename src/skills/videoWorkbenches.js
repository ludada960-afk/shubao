/* ═══ 视频侧「skill → 工作台规格」声明源（单一事实源）═══════════════════════════════
   用户第 18 轮原话（逐字）：
     「你为什么没办法进入 https://laoyu.quantv.com/store-visit-video 他们这些 skill 页面去抄他们的工作台呢，
       **每个工作台都是不一样的呀**，你现在完全没抄，用的依然是我们之前首页的视频生成版本糊弄我，
       我说的明明是抄他们**所有的各个视频生成的子页面**啊，**对应的一比一去抄**啊」
     「就是这**每个页面你都要点进去抄**呀」
   用户第 19 轮又补了一条口径（docs/design/66）：
     「视频生成和图片生成他们的这两边的 skill 子页面是**类似的逻辑**，都是要去抄他们的工作台和案例区的。
       所以你现在就**全部去统一你的标准去照抄**就对了……**文案和表达你可以稍微改一改**，
       但是其他的**内在的逻辑**呀，包括他们各自的这些东西，你**全部要抄到位**。」

   ⇒ 本文件就是视频侧的**声明源**：每条视频 skill 声明自己的工作台长什么样，
     页面（VideoStudio 嵌入形态）只**渲染声明源**，不许在页面里写死任何一块。
     图片侧对应的那一层是 src/skills/imageSkills.js 里的 fields / sections / paidActions。

   ⚠️ 取证：docs/design/64-quantv-video-skill-pages.md §8 —— 知渔 20 个视频 skill 子页面**逐字抄录**
      （含原文、计数上限、上传限制、占位文案、模型与视频设置、主 CTA 与预计积分）。
      每条 workbench 的 source 字段写着它抄的是知渔哪一页，可逐条复查。
   ⚠️ **不许放假按钮**：能力不具备的付费动作一律 wired:false + reason（如实写为什么不能点），
      绝不渲染成一颗点了没反应的按钮（本项目铁律）。
   ⚠️ 价格口径：能接通的付费动作一律**沿用站内已有 SKU**，不新增收费项：
      · 生成脚本 → 已有的「代为撰写」= ec_plan_preview（0.5 积分/次，用户已批准）；
      · AI分析 / 解析素材 → 已有的 video_plan_analysis（1 积分，分析并生成方案）。
      知渔页面上写的 0.1 / 0.50 是**他们的价格**，我们照抄的是**位置与逻辑**，价格写我们自己的真价。 */

/* ── 知渔原文里反复出现的两条上传限制（逐字，不改）────────────────────────────── */
const IMAGE_ACCEPT_HINT = '支持 JPG、JPEG、PNG，单张不超过 10MB';
const VIDEO_ACCEPT_HINT = '支持 MP4、MOV 等视频格式';
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm';

/* 知渔两套比例档位（**顺序不同**，照抄时别串；见 docs/design/64 §8.3）：
   · 电商带货三条 = 9:16 / 16:9 / 1:1 / 3:4 / 4:3
   · 建筑室内九条 = 1:1 / 3:4 / 4:3 / 9:16 / 16:9 */
const RATIO_EC = ['9:16', '16:9', '1:1', '3:4', '4:3'];
const RATIO_INTERIOR = ['1:1', '3:4', '4:3', '9:16', '16:9'];

const ratioChips = (order = RATIO_EC) => ({
  key: 'ratio', kind: 'chips', title: '比例', required: true, bind: 'ratio',
  options: order.map(value => ({ label: value, value })),
});

/* 知渔「时长（15S效果最好）」= 10 / 15 两颗（逐字） */
const durationChips = () => ({
  key: 'duration', kind: 'chips', title: '时长（15S效果最好）', required: true, bind: 'duration',
  options: [{ label: '10', value: 10 }, { label: '15', value: 15 }],
});

/* ── 块构造器 ───────────────────────────────────────────────────────────────── */
const uploadBlock = ({ key, title, note = '', max = 1, hint = '点击或拖拽上传图片', acceptHint = IMAGE_ACCEPT_HINT, accept = IMAGE_ACCEPT }) => ({
  key, kind: 'upload', title, note, max, hint, acceptHint, accept,
  /* 知渔的上传框里恒定两颗按钮（逐字：选择文件 / 从资产库选择） */
  actions: ['选择文件', '从资产库选择'],
});

const textBlock = ({ key = 'prompt', title, note = '', max = 5000, placeholder = '', mentionHint = '输入 @ 可引用 0 个素材', action = null, emptyTitle = '', emptyHint = '' }) => ({
  key, kind: 'text', title, note, max, placeholder, mentionHint, action, emptyTitle, emptyHint,
});

/* 付费动作：wired 为空 = 能力不具备，如实写 reason（不许放假按钮） */
const actionBlock = ({ key, title, note = '', actions = [] }) => ({ key, kind: 'panel', title, note, actions });

const noteBlock = ({ key, title, items = [] }) => ({ key, kind: 'note', title, items });
const tagsBlock = ({ key, title, items = [] }) => ({ key, kind: 'tags', title, items });

/* 知渔探店视频那一页的「生成脚本」按钮（逐字：生成脚本 · 0.1 积分）
   —— 我们接的是**已有的**代为撰写流水线（ec_plan_preview 0.5 积分/次，用户已批准）。 */
const SCRIPT_ACTION = { key: 'script', label: '生成脚本', wired: 'dawei', points: 0.5, note: '由 AI 把补充说明补成一份可直接出片的脚本' };
/* 知渔门店信息 / 素材分析那一档的 AI 分析 —— 我们接**已有的** video_plan_analysis（1 积分）。 */
const ANALYZE_ACTION = { key: 'analyze', label: 'AI分析', wired: 'analyze', points: 1, note: '识别素材内容，产出镜头与节奏方案' };

/* ═══ 八种工作台形态（每一种都对应知渔一个真实页面）═══════════════════════════════ */

/* ① 脚本型 —— 照抄知渔「视频创作」/ai-video：
      0/6 选择图片 + 脚本（0/10000，占位行与计数行各一颗「代为撰写」）+ 模型 + 视频设置 + 立即生成视频 */
const promptScriptWorkbench = ({ source = 'https://laoyu.quantv.com/ai-video', materialNote = '上传画面参考图片，最多 6 张' } = {}) => ({
  source,
  headline: '用一段脚本起步，镜头与节奏交给模型',
  blocks: [
    uploadBlock({ key: 'material', title: '素材', note: materialNote, max: 6, hint: '点击或拖拽上传图片', acceptHint: IMAGE_ACCEPT_HINT }),
    textBlock({
      key: 'prompt', title: '脚本', max: 10000,
      placeholder: '输入视频脚本，使用 @ 指定参考素材，或点击右下方「代为撰写」由 AI 帮你写',
      mentionHint: '输入 @ 可引用 0 个素材',
      action: SCRIPT_ACTION,
    }),
  ],
});

/* ② 单参考图 + 比例 —— 照抄知渔「建筑室内」九条（参考图（要求：X图）+ 比例五档） */
const singleRefWorkbench = ({ source, requirement, ratioOrder = RATIO_INTERIOR, headline = '' }) => ({
  source,
  headline,
  blocks: [
    uploadBlock({ key: 'reference', title: `参考图（要求：${requirement}）`, max: 1, hint: '点击或拖拽上传图片', acceptHint: IMAGE_ACCEPT_HINT }),
    ratioChips(ratioOrder),
  ],
});

/* ③ 参考图 + 时长 + 比例 —— 照抄知渔「电商带货」三条 */
const refDurationWorkbench = ({ source, headline = '' }) => ({
  source,
  headline,
  blocks: [
    uploadBlock({ key: 'reference', title: '参考图', max: 1, hint: '点击或拖拽上传图片', acceptHint: IMAGE_ACCEPT_HINT }),
    durationChips(),
    ratioChips(RATIO_EC),
  ],
});

/* ④ 多张指定图 —— 照抄知渔「模特服装展示」（穿搭图1/2/3 + 椅子图） */
const multiImageWorkbench = ({ source, headline = '', slots = [] }) => ({
  source,
  headline,
  blocks: slots.map(slot => uploadBlock({ key: slot.key, title: slot.title, note: slot.note || '', max: slot.max || 1, hint: slot.hint || '点击或拖拽上传图片', acceptHint: slot.acceptHint || IMAGE_ACCEPT_HINT })),
});

/* ⑤ 参考视频分析 —— 照抄知渔「爆款复刻」 */
const referenceVideoWorkbench = ({ source, headline = '', videoTitle = '参考视频', videoNote = '上传一个你想参考其结构与节奏的视频', imageTitle = '参考图片', imageNote = '仅支持上传图片', maxImages = 6 } = {}) => ({
  source,
  headline,
  blocks: [
    uploadBlock({ key: 'referenceVideo', title: videoTitle, note: videoNote, max: 1, hint: '点击上传参考视频', acceptHint: VIDEO_ACCEPT_HINT, accept: VIDEO_ACCEPT }),
    actionBlock({ key: 'videoAnalyze', title: '视频分析', actions: [ANALYZE_ACTION] }),
    noteBlock({
      key: 'videoRules', title: '参考视频要求',
      items: [
        { label: '15 秒以内', detail: '内容聚焦，分析更精准' },
        { label: '画面清晰', detail: '便于识别商品与字幕' },
        { label: '内容完整', detail: '包含开场、卖点和结尾' },
        { label: '风格可参考', detail: '方向和目标人群尽量相关' },
      ],
    }),
    tagsBlock({ key: 'videoKinds', title: '适合上传的视频', items: ['带货视频', '种草视频', '产品展示', '口播参考', '场景氛围'] }),
    uploadBlock({ key: 'referenceImages', title: imageTitle, note: imageNote, max: maxImages, hint: '点击或拖拽上传图片', acceptHint: IMAGE_ACCEPT_HINT }),
    textBlock({
      key: 'prompt', title: '补充说明', note: '可自行填写，也可以根据上方分析结果生成脚本', max: 5000,
      placeholder: '可选：输入补充说明，使用 @ 引用上面的参考视频或图片',
      action: SCRIPT_ACTION,
    }),
  ],
});

/* ⑥ 内容替换 —— 照抄知渔「内容替换」 */
const contentSwapWorkbench = ({ source = 'https://laoyu.quantv.com/content-replace', headline = '' } = {}) => ({
  source,
  headline,
  blocks: [
    uploadBlock({ key: 'referenceVideo', title: '参考视频（最长支持15秒）', max: 1, hint: '点击或拖拽视频上传', acceptHint: '支持 MP4、WEBM、MOV，50M以内', accept: VIDEO_ACCEPT }),
    uploadBlock({ key: 'sourceImage', title: '上传图片（模特或产品）', max: 1, hint: '点击或拖拽图片上传', acceptHint: '支持 PNG、JPG、JPEG，10M以内' }),
    uploadBlock({ key: 'background', title: '背景图（可上传，未上传则不替换背景）', note: '注：景别切换的不建议换背景', max: 1, hint: '点击或拖拽图片上传', acceptHint: '支持 PNG、JPG、JPEG，10M以内' }),
    { key: 'swapMode', kind: 'chips', title: '替换对象', bind: 'swapMode', options: [{ label: '换模特', value: 'model' }, { label: '换产品', value: 'product' }] },
  ],
});

/* ⑦ 探店型 —— 照抄知渔「探店视频」（三块专属输入 + 补充说明） */
const storeVisitWorkbench = ({ source = 'https://laoyu.quantv.com/store-visit-video', headline = '' } = {}) => ({
  source,
  headline,
  blocks: [
    uploadBlock({ key: 'storeMaterials', title: '探店素材', note: '上传门店环境、商品和服务过程图片', max: 6, hint: '点击或拖拽上传图片', acceptHint: IMAGE_ACCEPT_HINT }),
    actionBlock({ key: 'storeInfo', title: '门店信息', note: '先上传探店素材，再让 AI 识别门店环境与卖点', actions: [ANALYZE_ACTION] }),
    uploadBlock({ key: 'models', title: '模特选择', note: '上传模特图片，作为探店视频人物参考', max: 3, hint: '点击或拖拽上传模特图片', acceptHint: '支持 JPG、JPEG、PNG，最多 3 张' }),
    textBlock({
      key: 'prompt', title: '补充说明', max: 5000,
      placeholder: '输入视频风格、口播文案、口播语气、时长或者其他创作要求，使用 @ 引用探店素材或模特图',
      action: SCRIPT_ACTION,
      emptyTitle: '暂未生成脚本', emptyHint: '填写补充说明后，点击上方「生成脚本」',
    }),
  ],
});

/* ⑧ 首尾帧（知渔没有对应页，保留我们自己的两张卡；如实标注出处） */
const framesWorkbench = () => ({
  source: '',
  sourceNote: '知渔没有首尾帧页 —— 这一条保留我们自己的两张卡（沿用图片侧对称歪卡的样式）',
  headline: '用两张画面定义镜头起点与终点',
  blocks: [],
});

/* ═══ skill → 工作台规格（42 条，逐条声明；key = videoSkills.js 里的 id）═══════════ */
const P = promptScriptWorkbench;
const S = singleRefWorkbench;
const RD = refDurationWorkbench;
const MI = multiImageWorkbench;
const RV = referenceVideoWorkbench;

export const VIDEO_WORKBENCHES = {
  /* ── 精品推荐 ───────────────────────────────────────────────────────────── */
  'video.smart': P({ materialNote: '上传画面参考图片，最多 6 张' }),
  'video.frame': framesWorkbench(),
  'video.remake': RV({ source: 'https://laoyu.quantv.com/video-recreation', headline: '上传一个你想参考其结构与节奏的视频，系统提取结构与节奏后换成本次商品' }),
  'video.content_swap': contentSwapWorkbench({ headline: '上传人物视频和人物图片，一键换人' }),
  'video.product_motion': S({ source: 'https://laoyu.quantv.com/apps?id=cmra7k5zy09am9vzg3m52gaud', requirement: '商品图', headline: '通过单图的控制，实现平滑的运镜效果，适合展示商品细节' }),
  'video.tech_rotate': S({ source: 'https://laoyu.quantv.com/apps?id=cmra7k5zy09am9vzg3m52gaud', requirement: '产品图', headline: '通过单图的控制，实现平滑的旋转展示，适合展示结构与材质' }),
  'video.store_tour': storeVisitWorkbench({ headline: '上传门店环境、商品和服务过程图片，AI 生成探店视频内容' }),

  /* ── 热门玩法 ───────────────────────────────────────────────────────────── */
  'video.image_to_video': S({ source: 'https://laoyu.quantv.com/apps?id=cmra7k5zy09am9vzg3m52gaud', requirement: '商品图', headline: '通过单图的控制，让商品图动起来' }),
  'video.traffic_swap': RD({ source: 'https://laoyu.quantv.com/apps?id=cmr1w7wvz00z914i3f5h4hifu', headline: '参考图 + 时长 + 比例，一次出一支换装短片' }),
  'video.car_weekly': RD({ source: 'https://laoyu.quantv.com/apps?id=cmr1w7wvz00z914i3f5h4hifu', headline: '参考图 + 时长 + 比例，一周七套车内展示' }),
  'video.outfit_transition': RD({ source: 'https://laoyu.quantv.com/apps?id=cmr1w7wvz00z914i3f5h4hifu', headline: '参考图 + 时长 + 比例，做一支服饰变装转场' }),
  'video.fog_reveal': S({ source: 'https://laoyu.quantv.com/apps?id=cmra7k5zy09am9vzg3m52gaud', requirement: '商品图', headline: '通过单图的控制，实现擦雾出产品的效果' }),
  'video.one_image_showcase': S({ source: 'https://laoyu.quantv.com/apps?id=cmra7k5zy09am9vzg3m52gaud', requirement: '商品图', headline: '通过单图的控制，实现一图裂变展示' }),
  'video.storyboard_to_video': P({ materialNote: '上传分镜草图或画面参考，最多 6 张' }),
  'video.scene_stitch': P({ materialNote: '上传多个场景的图片，最多 6 张' }),
  'video.beat_mashup': RV({ source: 'https://laoyu.quantv.com/video-recreation', headline: '参考一条片子的节奏，把素材卡点混剪成一支成片', imageTitle: '参考图片', maxImages: 6 }),

  /* ── 建筑家装 ───────────────────────────────────────────────────────────── */
  'video.space_tour': S({ source: 'https://laoyu.quantv.com/apps?id=cmra7sgh009eg9vzgzwmnn68g', requirement: '空间图', headline: '通过单图的控制，实现平滑的运镜效果，适合展示空间细节' }),
  'video.light_shift': S({ source: 'https://laoyu.quantv.com/apps?id=cmr97klck001i9vzg58za4env', requirement: '人视图', headline: '通过单图的控制，实现平滑的变化效果，适合展示室内光线变化' }),
  'video.day_night': S({ source: 'https://laoyu.quantv.com/apps?id=cmr97klck001i9vzg58za4env', requirement: '人视图', headline: '通过单图的控制，实现平滑的变化效果，适合展示日夜气候切换' }),
  'video.furnishing_in': S({ source: 'https://laoyu.quantv.com/apps?id=cmr973iuh011n2xm0giaodt4m', requirement: '人视图', headline: '通过单图的控制，实现平滑的变化效果，适合展示室内软装增加' }),
  'video.floorplan_grow': S({ source: 'https://laoyu.quantv.com/apps?id=cmr9777qu013q2xm0qrvn3cdi', requirement: '平面图', headline: '通过单图的控制，实现平滑的平面转 3D 变化效果，适合展示室内户型' }),
  'video.building_grow': S({ source: 'https://laoyu.quantv.com/apps?id=cmr9777qu013q2xm0qrvn3cdi', requirement: '建筑图', headline: '通过单图的控制，实现平滑的生长变化效果，适合展示建筑外观' }),
  'video.plant_grow': S({ source: 'https://laoyu.quantv.com/apps?id=cmr9777qu013q2xm0qrvn3cdi', requirement: '绿植图', headline: '通过单图的控制，实现平滑的生长变化效果，适合展示植物生长' }),
  'video.interior_story': P({ materialNote: '上传空间图片，最多 6 张' }),

  /* ── 电商专区 ───────────────────────────────────────────────────────────── */
  'video.product_explode': RD({ source: 'https://laoyu.quantv.com/apps?id=cmr1w7wvz00z914i3f5h4hifu', headline: '参考图 + 时长 + 比例，做一支产品爆炸展示' }),
  'video.snack_unbox': RV({ source: 'https://laoyu.quantv.com/video-recreation', headline: '参考一条开箱片的节奏，换成本次商品', imageTitle: '商品图片', maxImages: 6 }),
  'video.food_craving': S({ source: 'https://laoyu.quantv.com/apps?id=cmra7k5zy09am9vzg3m52gaud', requirement: '食品图', headline: '通过单图的控制，实现平滑的运镜效果，适合展示食品馋感' }),
  'video.tech_tvc': P({ materialNote: '上传产品图片，最多 6 张' }),
  'video.home_goods_demo': RV({ source: 'https://laoyu.quantv.com/video-recreation', headline: '参考一条演示片的节奏，换成本次家居好物', imageTitle: '商品图片', maxImages: 6 }),
  'video.multi_angle_showcase': S({ source: 'https://laoyu.quantv.com/apps?id=cmra7k5zy09am9vzg3m52gaud', requirement: '商品图', headline: '通过单图的控制，实现多角度展示' }),
  'video.product_placement': RV({ source: 'https://laoyu.quantv.com/video-recreation', headline: '把商品植入到一条已有成片里，保留原片节奏', imageTitle: '商品图片', maxImages: 6 }),
  'video.text_consistency': RD({ source: 'https://laoyu.quantv.com/apps?id=cmr1w7wvz00z914i3f5h4hifu', headline: '参考图 + 时长 + 比例，做一支文字一致的广告片' }),

  /* ── 人像摄影 ───────────────────────────────────────────────────────────── */
  'video.model_runway': MI({
    source: 'https://laoyu.quantv.com/apps?id=cmr94utrm000b2xm0zvqfb49a',
    headline: '模特旋转椅子依次展示服装',
    slots: [
      { key: 'outfit1', title: '穿搭图1', max: 1 },
      { key: 'outfit2', title: '穿搭图2', max: 1 },
      { key: 'outfit3', title: '穿搭图3', max: 1 },
      { key: 'chair', title: '椅子图', max: 1 },
    ],
  }),
  'video.ai_styling': MI({
    source: 'https://laoyu.quantv.com/apps?id=cmr94utrm000b2xm0zvqfb49a',
    headline: '上传模特图与服装图，一键换装',
    slots: [
      { key: 'modelImage', title: '模特图', max: 1 },
      { key: 'outfit1', title: '服装图1', max: 1 },
      { key: 'outfit2', title: '服装图2', max: 1 },
    ],
  }),
  'video.street_style': MI({
    source: 'https://laoyu.quantv.com/apps?id=cmr94utrm000b2xm0zvqfb49a',
    headline: '模特依次展示服装，做一支街拍带货片',
    slots: [
      { key: 'modelImage', title: '模特图', max: 1 },
      { key: 'outfit1', title: '穿搭图1', max: 1 },
      { key: 'outfit2', title: '穿搭图2', max: 1 },
      { key: 'scene', title: '场景图', max: 1 },
    ],
  }),
  'video.beauty_macro': S({ source: 'https://laoyu.quantv.com/apps?id=cmra7k5zy09am9vzg3m52gaud', requirement: '美妆图', headline: '通过单图的控制，实现平滑的微距运镜，适合展示质感' }),

  /* ── 创意应用 ───────────────────────────────────────────────────────────── */
  'video.festival_spot': RD({ source: 'https://laoyu.quantv.com/apps?id=cmr1w7wvz00z914i3f5h4hifu', headline: '参考图 + 时长 + 比例，做一支节日营销短片' }),
  'video.book_selling': P({ materialNote: '上传图书或封面图，最多 6 张' }),
  'video.food_asmr': P({ materialNote: '上传食品图片，最多 6 张' }),
};

/* ═══ 知渔右栏页签（**取证记录**，不是我们要渲染的文案）═══════════════════════════════
   实测（docs/design/64 §8）：路由型 7 条是「作品示例 / 我的作品 / 教学示例」三条，
   广场型 13 条只有「作品示例 / 我的作品」两条。
   ⚠️ **我们不照搬这三个名字** —— 用户自己把这一栏叫「历史」，原话（2026-09-19）：
     「各个子skill自己的页面跑生成的话，一方面是会在工作台右边的**历史**里面展示自己这个 skill
       生成的历史记录，另一方面**同时也**会进入**我的作品**里面去。」
     —— 他把「历史」和「我的作品」当成两件事（前者是本页页签、后者是左侧导航那一项），
        把页签改名成「我的作品」会正好和左侧导航那一项撞车。
   所以这里只作为**取证**留档（门禁对着 docs/design/64 §8 校验），页面沿用我们自己的措辞
   （用户口径：「文案和表达你可以稍微改一改」）。 */
export const VIDEO_WORKBENCH_TABS = {
  route: ['作品示例', '我的作品', '教学示例'],
  market: ['作品示例', '我的作品'],
};

export function getVideoWorkbench(skillId) {
  const spec = VIDEO_WORKBENCHES[skillId];
  if (!spec) return null;
  return { ...spec };
}
