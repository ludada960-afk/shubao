/* ═══ 视频侧「skill → 工作台规格」声明源（单一事实源）═══════════════════════════════
   用户第 18 轮原话（逐字）：
     「你为什么没办法进入 https://laoyu.quantv.com/store-visit-video 他们这些 skill 页面去抄他们的工作台呢，
       **每个工作台都是不一样的呀**，你现在完全没抄，用的依然是我们之前首页的视频生成版本糊弄我，
       我说的明明是抄他们**所有的各个视频生成的子页面**啊，**对应的一比一去抄**啊」
     「就是这**每个页面你都要点进去抄**呀」
   用户第 19 轮补的口径（docs/design/66）：
     「视频生成和图片生成他们的这两边的 skill 子页面是**类似的逻辑**，都是要去抄他们的工作台和案例区的。
       所以你现在就**全部去统一你的标准去照抄**就对了……**文案和表达你可以稍微改一改**，
       但是其他的**内在的逻辑**呀，包括他们各自的这些东西，你**全部要抄到位**。」
   用户第 20 轮（本题）：
     「你要确认，视频生成和图片生成的各个子页面对应知渔的各个子页面，分别去对应他们的工作台做专属设计」
     「工作台**该滑动的地方要滑动，要选项的地方要选项，该切换的地方要切换，抄到位**」

   ⚠️ 本批（批 P）把这一层**从"每条都硬指一个知渔 URL"改成如实二分**：
     · 知渔确实有对应页的 → 逐字段照那一页抄（source 写那一页的 URL）；
     · 知渔**没有**对应页的（我们自有的玩法）→ source: null + sourceNote 写清"为什么没有"，
       **不许再借一个相近页面的 URL 充数**（上一版就是这么干的：8 条自有玩法都指向「灯具展示」，
       用户一看就知道是糊弄）。对照表在 src/skills/quantvVideoParity.js，门禁逐条钉住。
   ⚠️ 取证：docs/design/data/quantv-video-workbenches.json（25 个 app 的 inputConfigs）
     与 docs/design/data/quantv-video-pages.json（31 个子页面 DOM 实采）—— 两份都是脚本抓的，不是抄的。
   ⚠️ **不许放假按钮/假选项**：chips 只能绑 ratio / duration / swapMode 这三个**真的会进生成请求**的值
      （见 pages/VideoStudio/index.jsx 的 onValueChange）；能力不具备的付费动作一律 wired:false + reason。
   ⚠️ 价格口径：能接通的付费动作一律**沿用站内已有 SKU**（代为撰写 = ec_plan_preview 0.5 积分/次，
     用户已批准；AI分析 = video_plan_analysis 1 积分）。知渔写的 0.1 / 0.50 是**他们的价格**，
     我们照抄位置与逻辑，价格写我们自己的真价。 */

/* ── 知渔原文里反复出现的上传限制（逐字，不改）────────────────────────────── */
const IMAGE_ACCEPT_HINT = '支持 JPG、JPEG、PNG，单张不超过 10MB';
const VIDEO_ACCEPT_HINT = '支持 MP4、MOV 等视频格式';
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm';

/* 知渔两套比例档位（**顺序不同**，照抄时别串；实测见 docs/design/data/quantv-video-pages.json）：
   · 电商带货那三条 = 9:16 / 16:9 / 1:1 / 3:4 / 4:3
   · 建筑室内那一族 = 1:1 / 3:4 / 4:3 / 9:16 / 16:9（「建筑图转视频」多一档 21:9，共 6 档）
   我们的视频白名单（server/videoGeneration.mjs 的 RATIOS）正好覆盖这两种 = 21:9/16:9/4:3/1:1/3:4/9:16。 */
const RATIO_EC = ['9:16', '16:9', '1:1', '3:4', '4:3'];
const RATIO_INTERIOR = ['1:1', '3:4', '4:3', '9:16', '16:9'];
const RATIO_INTERIOR_WIDE = ['1:1', '3:4', '4:3', '9:16', '16:9', '21:9'];

const ratioChips = (order = RATIO_INTERIOR) => ({
  key: 'ratio', kind: 'chips', title: '比例', required: true, bind: 'ratio',
  options: order.map(value => ({ label: value, value })),
});

/* 知渔「时长（15S效果最好）」= 10 / 15 两颗（逐字，电商带货那三条短剧页就是这两颗） */
const durationChips = () => ({
  key: 'duration', kind: 'chips', title: '时长（15S效果最好）', required: true, bind: 'duration',
  options: [{ label: '10', value: 10 }, { label: '15', value: 15 }],
});
/* 知渔「时长」= 5 / 10 / 15 三颗（建筑室内那一族：建筑分镜电影制作 / 寒冬降临） */
const durationChips315 = () => ({
  key: 'duration', kind: 'chips', title: '时长', required: true, bind: 'duration',
  options: [{ label: '5', value: 5 }, { label: '10', value: 10 }, { label: '15', value: 15 }],
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

/* 知渔「生成脚本」那颗按钮（他们写 0.1 积分）—— 我们接**已有的**代为撰写（ec_plan_preview 0.5 积分/次）。 */
const SCRIPT_ACTION = { key: 'script', label: '生成脚本', wired: 'dawei', points: 0.5, note: '由 AI 把补充说明补成一份可直接出片的脚本' };
/* 知渔「AI分析 / 解析素材」那一档 —— 我们接**已有的** video_plan_analysis（1 积分）。 */
const ANALYZE_ACTION = { key: 'analyze', label: 'AI分析', wired: 'analyze', points: 1, note: '识别素材内容，产出镜头与节奏方案' };

/* ═══ 一、知渔有对应页的：逐页照抄（13 条）════════════════════════════════════════ */

/* ① 视频创作 /ai-video：
   返回视频创作 | 视频创作 | 新建 | 0 / 6 选择图片 | 脚本（占位「输入视频脚本，使用 @ 指定参考素材，或」
   + [代为撰写] + 0 / 10000 + 代为撰写按钮）| 模型 全能参考视频2.0 - mini | 视频设置 16:9 · 15秒 · 720p
   | 立即生成视频 / 预计 12.00 积分 | 作品示例 / 我的作品 / 教学示例 + 4 个分类（同城到店…）。
   ⚠️ 「模型 / 视频设置」那两行**不在这里重复渲染** —— 它们由嵌入的创作台承担（同一份状态，同一个控件），
      再画一遍就是两个地方改同一件事，必出"按钮写着 A、跑的是 B"的 bug。 */
const pageAiVideo = (extra = {}) => ({
  source: 'https://laoyu.quantv.com/ai-video',
  ...extra,
  blocks: [
    uploadBlock({ key: 'material', title: '素材', note: extra.materialNote || '上传画面参考图片，最多 6 张', max: 6, hint: '点击或拖拽上传图片' }),
    textBlock({
      key: 'prompt', title: '脚本', max: 10000,
      placeholder: '输入视频脚本，使用 @ 指定参考素材，或点击右下方「代为撰写」由 AI 帮你写',
      mentionHint: '输入 @ 可引用 0 个素材',
      action: SCRIPT_ACTION,
    }),
  ],
});

/* ② 爆款复刻 /video-recreation 逐字：参考视频（上传一个你想参考其结构与节奏的视频）
   + AI分析 · 0.50 积分 + 「上传后将为你分析」+ 参考视频要求(4 条) + 适合上传的视频(5 个)
   + 素材分析 · 参考图片 0 / 6（仅支持上传图片）+ 解析素材 · 0.10 积分/张
   + 补充说明（生成脚本 · 0.10 积分，可自行填写，也可以根据上方分析结果生成脚本）+ 模型 + 视频设置。 */
const pageRemake = (extra = {}) => ({
  source: 'https://laoyu.quantv.com/video-recreation',
  ...extra,
  blocks: [
    uploadBlock({ key: 'referenceVideo', title: '参考视频', note: '上传一个你想参考其结构与节奏的视频', max: 1, hint: '点击上传参考视频', acceptHint: VIDEO_ACCEPT_HINT, accept: VIDEO_ACCEPT }),
    actionBlock({ key: 'videoAnalyze', title: '视频分析', note: '上传后将为你分析：系统会从参考视频中提取结构、节奏和创意亮点，生成更贴合当前商品的新脚本', actions: [ANALYZE_ACTION] }),
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
    uploadBlock({ key: 'referenceImages', title: extra.imageTitle || '参考图片', note: extra.imageNote || '仅支持上传图片', max: extra.maxImages || 6, hint: '点击或拖拽上传图片' }),
    actionBlock({ key: 'imageAnalyze', title: '素材分析', note: '等待素材分析：请先上传商品图片，再点「解析素材」', actions: [{ ...ANALYZE_ACTION, key: 'analyze', label: '解析素材' }] }),
    textBlock({
      key: 'prompt', title: '补充说明', note: '可自行填写，也可以根据上方分析结果生成脚本', max: 5000,
      placeholder: '可选：输入补充说明，使用 @ 引用上面的参考视频或图片',
      action: SCRIPT_ACTION,
    }),
  ],
});

/* ③ 探店视频 /store-visit-video 逐字：探店素材 0/6（上传门店环境、商品和服务过程图片）
   + 门店信息（放大 + AI分析 · 0.1 积分/张）+ 模特选择 0/3（上传模特图片，作为探店视频人物参考）
   + 补充说明（生成脚本 · 0.1 积分）+ 空态「暂未生成脚本」。 */
const pageStoreVisit = (extra = {}) => ({
  source: 'https://laoyu.quantv.com/store-visit-video',
  ...extra,
  blocks: [
    uploadBlock({ key: 'storeMaterials', title: '探店素材', note: '上传门店环境、商品和服务过程图片', max: 6, hint: '点击或拖拽上传图片' }),
    /* ═══ 批 T（2026-09-21）：门店信息**补上可编辑输入框**（用户：「你分析出来了就去解决啊」）═════
       知渔那一页实测（.tmp/qy-fields.txt）：在「门店信息」标题下面有一个 **458×149 的输入框**，
       占位是四段式「一、门店基础视觉信息 / 二、空间环境细节 / 三、可复用探店镜头提示词素材库 /
       四、信息校验备注」—— AI 分析的结果就落在那里，而且**用户可以改**。
       我们原来这一格只有一个「AI分析」按钮，没有落点（分析结果只能去方案弹层里看）——
       与知渔的字段形态对不上。现在改成"标题 + 付费动作 + 可编辑输入框"，
       用 text 块的 action 能力（它本来就同时支持这两样），把那一页的占位文案逐字抄过来。 */
    textBlock({
      key: 'storeInfo', title: '门店信息', max: 2000,
      placeholder: '一、门店基础视觉信息\n二、空间环境细节\n三、可复用探店镜头提示词素材库\n四、信息校验备注',
      mentionHint: '可先让 AI 分析探店素材，把结论落在这里再改；这一格会作为门店背景一起下发',
      action: { ...ANALYZE_ACTION, note: '识别门店环境与卖点，结论写进这一格' },
    }),
    uploadBlock({ key: 'models', title: '模特选择', note: '上传模特图片，作为探店视频人物参考', max: 3, hint: '点击或拖拽上传模特图片', acceptHint: '支持 JPG、JPEG、PNG，最多 3 张' }),
    textBlock({
      key: 'prompt', title: '补充说明', max: 5000,
      placeholder: '输入视频风格、口播文案、口播语气、时长或者其他创作要求，使用 @ 引用探店素材或模特图',
      action: SCRIPT_ACTION,
      emptyTitle: '暂未生成脚本', emptyHint: '填写补充说明后，点击上方「生成脚本」',
    }),
  ],
});

/* ④ 内容替换 /content-replace 逐字：参考视频（最长支持15秒）+ 上传图片（模特或产品）
   + 背景图（可上传，未上传则不替换背景（注：景别切换的不建议换背景））+ 换模特 / 换产品
   + 视频设置 16:9 · 720p · 4秒。
   ⚠️ 他们的「换模特 / 换产品」是**两颗切换药丸**（bind 到 swapMode，真的会进请求）。 */
const pageContentSwap = (extra = {}) => ({
  source: 'https://laoyu.quantv.com/content-replace',
  ...extra,
  blocks: [
    uploadBlock({ key: 'referenceVideo', title: '参考视频（最长支持15秒）', max: 1, hint: '点击或拖拽视频上传', acceptHint: '支持 MP4、WEBM、MOV，50M以内', accept: VIDEO_ACCEPT }),
    uploadBlock({ key: 'sourceImage', title: '上传图片（模特或产品）', max: 1, hint: '点击或拖拽图片上传', acceptHint: '支持 PNG、JPG、JPEG，10M以内' }),
    uploadBlock({ key: 'background', title: '背景图（可上传，未上传则不替换背景（注：景别切换的不建议换背景））', max: 1, hint: '点击或拖拽图片上传', acceptHint: '支持 PNG、JPG、JPEG，10M以内' }),
    /* ⚠️ 批 S：知渔那一页这两颗药丸**上方没有字段标题**（CDP 实测：全文里
       「从资产库选择 → 换模特 → 换产品」之间没有任何文字；两颗药丸 y=1154）。
       我们原来多写了一个「替换对象」标题 = 他们页面上没有的东西。按"一模一样"的要求去掉，
       标题仍留在声明里（读屏与机检要用），只是不画出来。 */
    { key: 'swapMode', kind: 'chips', title: '替换对象', hideLabel: true, bind: 'swapMode', options: [{ label: '换模特', value: 'model' }, { label: '换产品', value: 'product' }] },
  ],
});

/* ⑤ 模特服装展示 /apps?id=cmr94utrm000b2xm0zvqfb49a 逐字：穿搭图1 / 穿搭图2 / 穿搭图3 / 椅子图（四格上传，无比例）。 */
const pageModelShowcase = (extra = {}) => ({
  source: 'https://laoyu.quantv.com/apps?id=cmr94utrm000b2xm0zvqfb49a',
  ...extra,
  blocks: extra.slots.map(slot => uploadBlock({ key: slot.key, title: slot.title, max: slot.max || 1, hint: '点击或拖拽上传图片' })),
});

/* ⑥ 单图控制族（建筑室内那 12 页同形态）：参考图（要求：X）+ 比例五档。 */
const pageSingleRef = ({ source, requirement, headline = '', ratioOrder = RATIO_INTERIOR }) => ({
  source,
  headline,
  blocks: [
    uploadBlock({ key: 'reference', title: '参考图（要求：' + requirement + '）', max: 1, hint: '点击或拖拽上传图片' }),
    ratioChips(ratioOrder),
  ],
});

/* ⑦ 首尾图族（室内装修 / 家装布置 / 建筑生长 / 植物生长）：首图要求：X + 尾图要求：Y + 比例。 */
const pageFirstLast = ({ source, headline = '', first, last, ratioOrder = RATIO_INTERIOR }) => ({
  source,
  headline,
  blocks: [
    uploadBlock({ key: 'first', title: first, max: 1, hint: '点击或拖拽上传图片' }),
    uploadBlock({ key: 'last', title: last, max: 1, hint: '点击或拖拽上传图片' }),
    ratioChips(ratioOrder),
  ],
});

/* ⑧ 参考图 + 比例 + 时长（建筑分镜电影制作 / 寒冬降临）。 */
const pageRefRatioDuration = ({ source, headline = '', requirement, durationOptions = [5, 10, 15] }) => ({
  source,
  headline,
  blocks: [
    uploadBlock({ key: 'reference', title: '参考图（要求：' + requirement + '）', max: 1, hint: '点击或拖拽上传图片' }),
    ratioChips(RATIO_INTERIOR),
    { key: 'duration', kind: 'chips', title: '时长', required: true, bind: 'duration', options: durationOptions.map(v => ({ label: String(v), value: v })) },
  ],
});

/* ⑨ 建筑图转视频 /apps?id=cmr1w8lt2010q14i3bfmj1xvn：参考图 + 比例**六档**（比同族多一档 21:9）。 */
const pageArchImageToVideo = ({ source, headline = '' }) => ({
  source,
  headline,
  blocks: [
    uploadBlock({ key: 'reference', title: '参考图', max: 1, hint: '点击或拖拽上传图片' }),
    ratioChips(RATIO_INTERIOR_WIDE),
  ],
});

/* ═══ 二、知渔没有对应页的：我们自有的玩法（29 条）═════════════════════════════════
   ⚠️ 这些**不再借 URL**（source: null），但工作台仍然是"这一条专属"的：
     每一块都写这条玩法真正要吃的东西，chips 只绑 ratio / duration / swapMode 三个真值。 */
const ownWorkbench = ({ headline = '', sourceNote, blocks }) => ({ source: null, sourceNote, headline, blocks });

export const VIDEO_WORKBENCHES = {
  /* ── 精品推荐 ───────────────────────────────────────────────────────────── */
  'video.smart': pageAiVideo({ headline: '用一段脚本起步，镜头与节奏交给模型', materialNote: '上传画面参考图片，最多 6 张' }),
  /* ⚠️ 首尾帧**故意不声明块**（blocks 为空 ⇒ 不切 workbenchMode）：它自己的工作台就是创作台里
     那两张卡（首帧 / 尾帧）+ 模式页签，那是用户点名保留的三个入口之一
     （「视频生成的三个入口只保留智能成片和首尾帧」）。
     我第一版给这条也写了通用块，结果**把创作台自己的首尾帧素材区与模式页签顶掉了** ——
     e2e 当场报红（「素材区跟着这条链路走（首帧 + 尾帧两格）」）。
     知渔没有首尾帧页（31 个子页面里没有），所以如实写 source: null + 说明，不借 URL、也不抢控件。 */
  'video.frame': {
    source: null,
    sourceNote: '知渔没有首尾帧页（他们 31 个子页面里没有这一档）—— 这一条的工作台就是创作台自己的「首帧 / 尾帧」两张卡，不再叠一层通用块',
    headline: '用两张画面定义镜头起点与终点',
    blocks: [],
  },
  'video.remake': pageRemake({ headline: '上传一个你想参考其结构与节奏的视频，系统提取结构与节奏后换成本次商品' }),
  'video.content_swap': pageContentSwap({ headline: '上传人物视频和人物图片，一键换人' }),
  'video.product_motion': ownWorkbench({
    sourceNote: '知渔的"单图控制"页是按对象拆的（淋浴/台盆/灯具/餐桌展示），没有"通用商品动态展示"这一页 —— 这条是我们自有的玩法',
    headline: '商品旋转、光影扫过、材质微距，用在主图与详情首屏',
    blocks: [
      uploadBlock({ key: 'reference', title: '商品图', note: '一张干净的商品图效果最好', max: 1, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_EC),
      textBlock({ key: 'prompt', title: '补充说明', max: 2000, placeholder: '可选：指定运动方式（旋转 / 光影扫过 / 微距掠过）与结尾画面' }),
    ],
  }),
  'video.store_tour': pageStoreVisit({ headline: '上传门店环境、商品和服务过程图片，AI 生成探店视频内容' }),

  /* ── 热门玩法 ───────────────────────────────────────────────────────────── */
  'video.image_to_video': pageArchImageToVideo({
    source: 'https://laoyu.quantv.com/apps?id=cmr1w8lt2010q14i3bfmj1xvn',
    headline: '一张图动起来：镜头微推，环境光缓慢扫过',
  }),
  'video.traffic_swap': ownWorkbench({
    sourceNote: '知渔的"换装"玩法只出现在短剧风格三页（豪门婆媳 / 后宫宫斗 / 豪门恩怨），那是**剧情带货**不是红绿灯换装 —— 语义不同，不硬套',
    headline: '红灯亮起换一套衣服，卡着信号灯变装',
    blocks: [
      uploadBlock({ key: 'reference', title: '人物图', note: '同一机位、同一姿势的正面照', max: 1, hint: '点击或拖拽上传图片' }),
      uploadBlock({ key: 'outfits', title: '服装图', note: '按出场顺序上传，最多 6 套', max: 6, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_EC),
      durationChips(),
      textBlock({ key: 'prompt', title: '补充说明', max: 2000, placeholder: '可选：写清换装节奏与卡点（例如"每次红灯亮起换一套"）' }),
    ],
  }),
  'video.car_weekly': ownWorkbench({
    sourceNote: '知渔没有"车内换装"页；他们的换装玩法是剧情短剧三页 —— 语义不同，不硬套',
    headline: '坐进车里，一周七套穿搭依次换',
    blocks: [
      uploadBlock({ key: 'reference', title: '车内场景图', note: '同一机位的内景照，换装时背景不能动', max: 1, hint: '点击或拖拽上传图片' }),
      uploadBlock({ key: 'outfits', title: '一周穿搭图', note: '按周一到周日顺序上传，最多 7 套', max: 7, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_EC),
      durationChips(),
    ],
  }),
  'video.outfit_transition': ownWorkbench({
    sourceNote: '知渔没有"变装转场"页（他们的换装是剧情短剧三页）—— 这条是我们自有的卡点玩法',
    headline: '卡点或色卡转场，一镜换多套',
    blocks: [
      uploadBlock({ key: 'reference', title: '人物图', max: 1, hint: '点击或拖拽上传图片' }),
      uploadBlock({ key: 'outfits', title: '服装图', note: '按转场顺序上传', max: 8, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_EC),
      durationChips(),
      textBlock({ key: 'prompt', title: '补充说明', max: 2000, placeholder: '可选：写清转场方式（甩镜 / 色卡 / 遮罩）与卡点' }),
    ],
  }),
  'video.fog_reveal': ownWorkbench({
    sourceNote: '知渔的"单图控制"页里没有"擦雾出产品"这一档（他们是空间与器皿的运镜展示）—— 自有的玩法',
    headline: '手指擦开雾气，商品从模糊里露出来',
    blocks: [
      uploadBlock({ key: 'reference', title: '商品图', note: '主体清晰、背景干净', max: 1, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_EC),
      textBlock({ key: 'prompt', title: '补充说明', max: 2000, placeholder: '可选：擦雾的手势方向、露出的先后顺序' }),
    ],
  }),
  'video.one_image_showcase': ownWorkbench({
    sourceNote: '知渔没有"一图裂变"页 —— 自有玩法',
    headline: '一张商品图，裂变成一整组展示镜头',
    blocks: [
      uploadBlock({ key: 'reference', title: '商品图', max: 1, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_EC),
      durationChips(),
      textBlock({ key: 'prompt', title: '补充说明', max: 2000, placeholder: '可选：想裂变出哪几个镜头（正面 / 侧面 / 细节 / 场景）' }),
    ],
  }),
  'video.storyboard_to_video': pageRefRatioDuration({
    source: 'https://laoyu.quantv.com/apps?id=cmr1w901f011114i3dyig00lf',
    requirement: '分镜图需包含多个分镜',
    headline: '一张分镜图逐格拍成成片，适合展示完整叙事',
  }),
  'video.scene_stitch': ownWorkbench({
    sourceNote: '知渔没有"多场景拼接"页 —— 自有玩法',
    headline: '一张首帧带出上下左右多个场景',
    blocks: [
      uploadBlock({ key: 'first', title: '首帧', note: '镜头从这一格开始', max: 1, hint: '点击或拖拽上传图片' }),
      uploadBlock({ key: 'scenes', title: '场景图', note: '按转场顺序上传，最多 6 张', max: 6, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_EC),
      durationChips(),
    ],
  }),
  'video.beat_mashup': ownWorkbench({
    sourceNote: '知渔没有"卡点混剪"页 —— 自有玩法（他们的爆款复刻是"参考一条片子"，不是"多张图卡点"）',
    headline: '多张图跟着音乐卡点依次出来',
    blocks: [
      uploadBlock({ key: 'reference', title: '素材图', note: '按卡点顺序上传，最多 8 张', max: 8, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_EC),
      durationChips(),
      textBlock({ key: 'prompt', title: '补充说明', max: 2000, placeholder: '可选：卡点节奏（快切 / 慢推）与结尾定格画面' }),
    ],
  }),

  /* ── 建筑家装（知渔这一族 12 页，除"空间漫游"外都能对上）──────────────────── */
  'video.space_tour': ownWorkbench({
    sourceNote: '知渔这一族是按**房间**拆的单图页（淋浴 / 台盆 / 浴室 / 书房 / 卧室 / 餐厅），没有"通用空间漫游"页 —— 我们这条是通用版，不硬套某一个房间页',
    headline: '镜头沿动线走一遍，把空间讲明白',
    blocks: [
      uploadBlock({ key: 'reference', title: '空间图', note: '一张能看到完整动线的空间照', max: 1, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_INTERIOR),
      textBlock({ key: 'prompt', title: '补充说明', max: 2000, placeholder: '可选：走位路线（进门 → 客厅 → 阳台）与镜头速度' }),
    ],
  }),
  'video.light_shift': pageSingleRef({
    source: 'https://laoyu.quantv.com/apps?id=cmr97klck001i9vzg58za4env',
    requirement: '人视图',
    headline: '机位不动，只让光线与阴影走一遍，适合展示室内光线变化',
  }),
  'video.day_night': pageRefRatioDuration({
    source: 'https://laoyu.quantv.com/apps?id=cmr1w8rja010u14i3hpueua4o',
    requirement: '鸟瞰图，带环境',
    headline: '同一场景的气候变化：他们那一页的例子是季节（寒冬降临），我们这条做日夜与天气',
  }),
  'video.furnishing_in': pageSingleRef({
    source: 'https://laoyu.quantv.com/apps?id=cmr973iuh011n2xm0giaodt4m',
    requirement: '人视图',
    headline: '家具与软装依次落位，空房变样板间',
  }),
  'video.floorplan_grow': pageSingleRef({
    source: 'https://laoyu.quantv.com/apps?id=cmr9777qu013q2xm0qrvn3cdi',
    requirement: '平面图',
    headline: '从户型图长出一整套三维空间',
  }),
  'video.building_grow': pageFirstLast({
    source: 'https://laoyu.quantv.com/apps?id=cmr95whex00hm2xm0mxtqjly9',
    headline: '通过首图与尾图的控制，实现平滑的建筑生长效果',
    first: '首图要求：建筑场景空地图',
    last: '尾图要求：建筑效果图',
  }),
  'video.plant_grow': pageFirstLast({
    source: 'https://laoyu.quantv.com/apps?id=cmr95g674008o2xm0e6tk58ne',
    headline: '通过首图与尾图的控制，实现平滑的生长变化效果',
    first: '首图要求：景观空地图',
    last: '尾图要求：景观效果图',
  }),
  'video.interior_story': ownWorkbench({
    sourceNote: '知渔这一族没有"空间叙事短片"页：他们是"单图/首尾图的变化效果"，没有叙事片这一档 —— 自有玩法',
    headline: '一支短片讲这个空间的一天',
    blocks: [
      uploadBlock({ key: 'reference', title: '空间图', note: '同一个空间的 2~6 张不同机位图效果最好', max: 6, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_INTERIOR),
      textBlock({
        key: 'prompt', title: '分镜脚本', max: 5000,
        placeholder: '写清这支片子怎么走：清晨拉开窗帘 → 上午工作台 → 午后沙发 → 夜晚灯光',
        action: SCRIPT_ACTION,
      }),
    ],
  }),

  /* ── 电商专区 ───────────────────────────────────────────────────────────── */
  'video.product_explode': ownWorkbench({
    sourceNote: '知渔视频侧没有"产品爆炸"页（他们的爆炸是**图片**侧的「电影级高端产品爆炸瞬间海报」）—— 视频这条是自有玩法',
    headline: '商品在空中炸开，零件与成分悬浮',
    blocks: [
      uploadBlock({ key: 'reference', title: '商品图', note: '结构分层越清楚，炸开越好看', max: 1, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_EC),
      durationChips(),
      textBlock({ key: 'prompt', title: '补充说明', max: 2000, placeholder: '可选：要炸出哪几层（外壳 / 内芯 / 配件）与定格瞬间' }),
    ],
  }),
  'video.snack_unbox': ownWorkbench({
    sourceNote: '知渔没有"开箱"页（他们的爆款复刻是"参考一条片子"）—— 自有玩法',
    headline: '拆袋、倒出、入口，一条龙展示',
    blocks: [
      uploadBlock({ key: 'reference', title: '商品图', note: '包装正面 + 内容物各一张', max: 3, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_EC),
      durationChips(),
      textBlock({ key: 'prompt', title: '补充说明', max: 2000, placeholder: '可选：开箱动作顺序与结尾卖点画面' }),
    ],
  }),
  'video.tech_rotate': ownWorkbench({
    sourceNote: '知渔的"单图控制"页是按对象拆的（淋浴/台盆/灯具/餐桌展示），没有"3C 旋转展示"页 —— 自有玩法',
    headline: '360 度转一圈，把接口与厚度讲清楚',
    blocks: [
      uploadBlock({ key: 'reference', title: '产品图', note: '正视角、背景干净的产品图', max: 1, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_EC),
      textBlock({ key: 'prompt', title: '补充说明', max: 2000, placeholder: '可选：旋转方向与要停留展示的部位（接口 / 按键 / 厚度）' }),
    ],
  }),
  'video.food_craving': ownWorkbench({
    sourceNote: '知渔视频侧没有"食品特写"页 —— 自有玩法',
    headline: '拉丝、爆汁、冒热气，把馋感拍出来',
    blocks: [
      uploadBlock({ key: 'reference', title: '食品图', max: 1, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_EC),
      durationChips(),
      textBlock({ key: 'prompt', title: '补充说明', max: 2000, placeholder: '可选：想强调的质感（拉丝 / 爆汁 / 热气 / 酥脆）' }),
    ],
  }),
  'video.tech_tvc': pageAiVideo({ headline: '一支完整的产品广告片：悬念、特写、收束', materialNote: '上传产品图片，最多 6 张' }),
  'video.home_goods_demo': ownWorkbench({
    sourceNote: '知渔没有"家居好物演示"页（他们的爆款复刻是"参考一条片子"，不是"在家用一遍"）—— 自有玩法',
    headline: '在家里用一遍，把省事讲清楚',
    blocks: [
      uploadBlock({ key: 'reference', title: '商品图', max: 1, hint: '点击或拖拽上传图片' }),
      uploadBlock({ key: 'scene', title: '家用场景图', note: '可选：真实家里的使用环境', max: 3, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_EC),
      durationChips(),
      textBlock({ key: 'prompt', title: '补充说明', max: 2000, placeholder: '可选：要演示的使用步骤与"省了哪一步"' }),
    ],
  }),
  'video.multi_angle_showcase': ownWorkbench({
    sourceNote: '知渔视频侧的"多角度"是**图片**侧的「商品多角度多视图」；视频这一侧没有同页 —— 自有玩法',
    headline: '正侧背、材质与细节，一次讲完',
    blocks: [
      uploadBlock({ key: 'reference', title: '商品图', note: '同一件商品的多角度图，最多 6 张', max: 6, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_EC),
      durationChips(),
    ],
  }),
  'video.product_placement': ownWorkbench({
    sourceNote: '知渔没有"产品植入"页（他们只有内容替换：换模特 / 换产品）—— 自有玩法',
    headline: '把商品自然放进已有视频里，保留原片节奏',
    blocks: [
      uploadBlock({ key: 'referenceVideo', title: '目标视频', note: '商品要植入进去的那条片子', max: 1, hint: '点击或拖拽视频上传', acceptHint: VIDEO_ACCEPT_HINT, accept: VIDEO_ACCEPT }),
      uploadBlock({ key: 'reference', title: '商品图', max: 1, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_EC),
      textBlock({ key: 'prompt', title: '补充说明', max: 2000, placeholder: '可选：商品出现在第几秒、出现在哪个位置' }),
    ],
  }),
  'video.text_consistency': ownWorkbench({
    sourceNote: '知渔没有"文字一致性"页 —— 自有玩法（他们的文案要求写在各自 app 的提示词里）',
    headline: '包装与卖点文字全程不糊、不改样',
    blocks: [
      uploadBlock({ key: 'reference', title: '商品图', note: '包装文字要清楚可读', max: 1, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_EC),
      durationChips(),
      textBlock({ key: 'prompt', title: '必须逐字准确的文字', max: 1000, placeholder: '例如：品牌名 · 规格 · 卖点短句（画面里出现哪些字就写哪些）' }),
    ],
  }),

  /* ── 人像摄影 ───────────────────────────────────────────────────────────── */
  'video.model_runway': pageModelShowcase({
    headline: '模特旋转椅子依次展示服装',
    slots: [
      { key: 'outfit1', title: '穿搭图1', max: 1 },
      { key: 'outfit2', title: '穿搭图2', max: 1 },
      { key: 'outfit3', title: '穿搭图3', max: 1 },
      { key: 'chair', title: '椅子图', max: 1 },
    ],
  }),
  'video.ai_styling': ownWorkbench({
    sourceNote: '知渔只有**一页**模特服装展示（穿搭图1/2/3 + 椅子图）；"同一模特换几套衣服"是另一种字段形态（模特图 + 多套服装图），不硬套那一页',
    headline: '同一模特，把几套衣服依次穿上',
    blocks: [
      uploadBlock({ key: 'modelImage', title: '模特图', note: '正脸、光线均匀的一张', max: 1, hint: '点击或拖拽上传图片' }),
      uploadBlock({ key: 'outfits', title: '服装图', note: '按换装顺序上传，最多 6 套', max: 6, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_EC),
      durationChips(),
    ],
  }),
  'video.street_style': ownWorkbench({
    sourceNote: '知渔只有一页模特服装展示（穿搭图1/2/3 + 椅子图），没有"街拍带货"页 —— 自有玩法',
    headline: '街头走两步，把版型与搭配演出来',
    blocks: [
      uploadBlock({ key: 'modelImage', title: '模特图', max: 1, hint: '点击或拖拽上传图片' }),
      uploadBlock({ key: 'outfits', title: '穿搭图', note: '最多 4 套', max: 4, hint: '点击或拖拽上传图片' }),
      uploadBlock({ key: 'scene', title: '街景图', note: '可选：想走的街道环境', max: 1, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_EC),
      durationChips(),
    ],
  }),
  'video.beauty_macro': ownWorkbench({
    sourceNote: '知渔视频侧没有美妆微距页 —— 自有玩法',
    headline: '膏体、粉质、上脸，微距讲质感',
    blocks: [
      uploadBlock({ key: 'reference', title: '产品图', max: 1, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_EC),
      durationChips(),
      textBlock({ key: 'prompt', title: '补充说明', max: 2000, placeholder: '可选：要拍的质地（膏体 / 粉质 / 水感）与上脸镜头' }),
    ],
  }),

  /* ── 创意应用 ───────────────────────────────────────────────────────────── */
  'video.festival_spot': ownWorkbench({
    sourceNote: '知渔没有节日营销页（短剧三页是剧情带货，不是节点氛围片）—— 自有玩法',
    headline: '节点氛围 + 商品，适合大促与节日投放',
    blocks: [
      uploadBlock({ key: 'reference', title: '商品图', max: 1, hint: '点击或拖拽上传图片' }),
      ratioChips(RATIO_EC),
      durationChips(),
      textBlock({ key: 'prompt', title: '节点与氛围', max: 2000, placeholder: '例如：中秋 · 暖黄灯笼 · 家人围坐 · 礼盒特写收尾' }),
    ],
  }),
  'video.book_selling': pageAiVideo({ headline: '翻页、金句、场景，把一本书讲清楚', materialNote: '上传图书或封面图，最多 6 张' }),
  'video.food_asmr': pageAiVideo({ headline: '近距离的咀嚼与热气，声音画面一起上', materialNote: '上传食品图片，最多 6 张' }),
  /* ⚠️ 辅助能力（tier: assistant）**不给工作台** —— 画面修改 / 延长续写 / 运镜控制这三条
     没有自己的子页面，按 fuses 声明长在别的技能的创作台上（见 videoSkills.js 的 fuses）。
     门禁 test/video-skill-workbench-declaration-0919 ① 守的就是这条。 */
};

/* ═══ 知渔右栏页签（**取证记录**，不是我们要渲染的文案）═══════════════════════════════
   实测（docs/design/data/quantv-video-pages.json）：路由型 7 条是「作品示例 / 我的作品 / 教学示例」
   三条，广场型（app）只有「作品示例 / 我的作品」两条。
   ⚠️ **我们不照搬这三个名字** —— 用户自己把这一栏叫「历史」，原话（2026-09-19）：
     「各个子skill自己的页面跑生成的话，一方面是会在工作台右边的**历史**里面展示自己这个 skill
       生成的历史记录，另一方面**同时也**会进入**我的作品**里面去。」
     —— 他把「历史」和「我的作品」当成两件事（前者是本页页签、后者是左侧导航那一项），
        把页签改名成「我的作品」会正好和左侧导航那一项撞车。
   所以这里只作为**取证**留档（门禁对着 docs/design/data/quantv-video-pages.json 校验），页面沿用
   我们自己的措辞（用户口径：「文案和表达你可以稍微改一改」）。 */
export const VIDEO_WORKBENCH_TABS = {
  route: ['作品示例', '我的作品', '教学示例'],
  market: ['作品示例', '我的作品'],
};

export function getVideoWorkbench(skillId) {
  const spec = VIDEO_WORKBENCHES[skillId];
  if (!spec) return null;
  return { ...spec };
}
