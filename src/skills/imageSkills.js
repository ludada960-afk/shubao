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
/* ═══ 2026-09-19 批 O-⑦：比例照知渔收成 **7 档**（含 2:3 / 3:2）═════════════════════════
   知渔的 ratio 字段原文（`inputConfigs` 逐字，docs/design/data/quantv-image-key-specs.json）：
     1:1方图 | 2:3竖版长图 | 3:2横版摄影 | 3:4竖版海报 | 4:3横版主图 | 9:16手机竖屏 | 16:9手机横屏
   顺序也照他们（1:1 → 2:3 → 3:2 → 3:4 → 4:3 → 9:16 → 16:9）。
   副说明本身有信息：「竖版海报 / 横版主图 / 手机竖屏」告诉用户这一档是给什么场景用的。
   ⚠️ 加档位**必须与引擎同时加**：服务端 LEGAL_IMAGE_SIZES 是权威，而
      "界面能给的恰好就是引擎认得的那几个"（src/services/imageSizeCatalog.js 第 9 行）——
      只改界面 = 用户选了被**静默回落成 1:1**（不报错、不提示）。
      本批已同步改：引擎尺寸表 + 客户端镜像 + skillRun.LEGAL_RATIOS + 尺寸门禁（4 处）。
      计费不用改：ecommerceBilling 的 SIZE_TO_RESOLUTION 就是遍历引擎那张表建的。 */
const RATIO = [
  { value: '1:1', label: '1:1 方图' },
  { value: '2:3', label: '2:3 竖版长图' },
  { value: '3:2', label: '3:2 横版摄影' },
  { value: '3:4', label: '3:4 竖版海报' },
  { value: '4:3', label: '4:3 横版主图' },
  { value: '9:16', label: '9:16 手机竖屏' },
  { value: '16:9', label: '16:9 手机横屏' },
];
/* ═══ 2026-09-19 批 P：分辨率/清晰度的**档位与写法逐页照知渔**══════════════════════════
   依据：docs/design/data/quantv-image-pages.json（34 个对照页 CDP 实采）+ catalog.json 的 inputConfigs。
   实测这**不是一套**档位，各页写法都不一样：
     · 三档「1K 标准 / 2K 高清 / 4K 超清」—— 电商海报设计 / 商品多角度多视图 / 批量出图 / 商品场景展示 / 一键模特换背景；
     · 三档**无空格**「1K标准 / 2K高清 / 4K超清」—— 电影级爆炸 / 极地冰封 / 悬浮主视觉 / 汽水广告九宫格 / 装修系五页；
     · 三档**只有数字**「1K / 2K / 4K」—— 平面转建筑效果图 / 建筑九宫格分镜；
     · 三档「1K 标清 / 2K 高清 / 4K 超清」—— 夏季蔬果巨物（他们写作"标清"）；
     · **两档**「2K 高清 / 4K 超清」—— 中文海报 / 相似图 / 毛坯家装 / 图片换风格 / 人物姿势参考 / 极简日系饮品。
   ⇒ 这一页给几档、叫什么，全部照那一页抄。值仍是 1K/2K/4K（引擎口径），只有**标签**照他们。
     默认值保持 2K（与 skillRun 的回落口径一致：界面显示什么，就跑什么）。 */
/* ═══ 2026-09-19 批 P：比例药丸**两种写法 + 两种顺序**（逐页实采）══════════════════════
   · 带后缀（1:1 方图 / 2:3 竖版长图 / …）—— 电商海报设计 / 商品场景展示 / 商品多角度多视图 /
     批量出图 / 一键模特换背景 / 中文海报那一类页面（我们的 RATIO）；
   · **只有数字**（1:1 / 2:3 / …）—— 电影级爆炸 / 极地冰封 / 悬浮主视觉 / 汽水广告九宫格 /
     平面转建筑效果图 / 建筑九宫格分镜（他们的建筑室内页与电商专区的"爆款配方"页都是这种）；
   · 顺序也不一样：中文海报 / 爆款商品文字海报这两页的实测顺序是
     1:1 → 4:3 → 3:4 → 3:2 → 2:3 → 16:9 → 9:16（与他们自己接口里的数组顺序不同，以页面为准）。
   值仍是 1:1/2:3/… （引擎口径），只有**标签与顺序**照他们。 */
const RATIO_BARE = [
  { value: '1:1', label: '1:1' },
  { value: '2:3', label: '2:3' },
  { value: '3:2', label: '3:2' },
  { value: '3:4', label: '3:4' },
  { value: '4:3', label: '4:3' },
  { value: '9:16', label: '9:16' },
  { value: '16:9', label: '16:9' },
];
const RATIO_SIZED = [
  { value: '1:1', label: '1:1方图' },
  { value: '4:3', label: '4:3横版主图' },
  { value: '3:4', label: '3:4竖版海报' },
  { value: '3:2', label: '3:2横版摄影' },
  { value: '2:3', label: '2:3竖版长图' },
  { value: '16:9', label: '16:9手机横屏' },
  { value: '9:16', label: '9:16手机竖屏' },
];
const CLARITY_3 = [
  { value: '1K', label: '1K 标准' },
  { value: '2K', label: '2K 高清' },
  { value: '4K', label: '4K 超清' },
];
const CLARITY_3_TIGHT = [
  { value: '1K', label: '1K标准' },
  { value: '2K', label: '2K高清' },
  { value: '4K', label: '4K超清' },
];
const CLARITY_3_PLAIN = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
];
const CLARITY_2 = [
  { value: '2K', label: '2K 高清' },
  { value: '4K', label: '4K 超清' },
];

/* 这两个字段在 20 多条技能里重复出现，**只能有一份定义**（含默认值）。
   默认值必须与 skillRun.js 的回落值一致：界面显示什么，就跑什么。 */
/* label 可改：知渔「爆款商品文字海报」「中文海报一键生成」这两页里，比例那一格的标题就叫
   「生成尺寸」（不是「比例」）—— 文案照他们。 */
const ratioField = (options = RATIO, label = '比例', group = '生成设置') => ({ key: 'ratio', label, kind: 'segmented', group, options, required: true, default: options[0].value });
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
/* ═══ 批 P：图片复刻页的语言是 **11 档**（逐页实采）══════════════════════════════════
   ?tool=image-clone 的语言下拉实测只有：English / 简体中文 / 日本語 / 俄语 / 韩语 / 法语 /
   德语 / 泰语 / 巴西语 / 西班牙语 / 越南语 —— 比 A+/详情图少了「马来西亚语」，也比套图少了「无文字」。
   上一版我们照 LANGUAGE_FULL 给了 12 档（多一个马来西亚语），逐页比对时就被抓出来了。 */
const LANGUAGE_CLONE = LANGUAGE_FULL.filter(item => !['马来西亚语', '繁体中文'].includes(item.value));
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
const clarityField = ({ options = CLARITY_3, label = '分辨率' } = {}) => ({ key: 'clarity', label, kind: 'segmented', group: '生成设置', options, required: true, default: '2K' });
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
    /* ═══ 2026-09-19 批 O-⑥：complexity 从 'simple' 改成 'standard' ═══════════════════════
       依据：知渔「中文海报一键生成」实测有 **8 个字段**
         （主题 / 画面描述 / 用途 8 档 / 生成尺寸 / 字体 6 档 / 颜色 15 档 / 效果 18 档 / 分辨率 2 档）。
       本仓判据是「simple 档字段不得超过 4 个」—— 一个 8 字段的工作台本来就不该标 simple。
       这不是为了让门禁过而放宽：字段数是**实测抄来的**，改的是"这一档有多复杂"这个判断。 */
    id: 'image.poster', board: 'image', name: '海报设计', category: '创意应用', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'warm' },
    summary: '先立主视觉，再排信息层级', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '设计一张电商海报：以我上传的这张商品图为主视觉。产品卖点：{{points}}。要求：单一视觉焦点、清晰的信息层级与阅读顺序，并留出安全的标题区；画面内的文字必须逐字准确，不得臆造文案、日期、价格或 logo。',
    /* ═══ 2026-09-19 批 O-⑥：**映射改正 + 字段照抄** ═══════════════════════════════════════
       ⚠️ 我原来的映射表把「海报设计」指到了「中文海报一键生成」—— **串页了**
          （中文海报一键生成 8 字段，是 image.cn_poster 的对应页）。
       它真正的对应页是知渔的「**电商海报设计**」，inputConfigs 逐字：
         上传图片 [file 必填] · 产品卖点（可选，不用很复杂，简单一点）[multiText **可选**] ·
         比例 [7 档] · 分辨率 [1K标准/2K高清/4K超清]
       ⇒ 我们原来是 主题 + 画面描述（两个自由文本框，没有上传位），与他们的**结构完全不同**：
          他们是"上传商品图 + 可选卖点"，我们却让用户凭空描述一张海报。按他们改。 */
    fields: [
      { key: 'assets', label: '上传图片', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'points', label: '产品卖点（可选，不用很复杂，简单一点）',
        longLabelReason: '照知渔原文逐字：他们这一页的第二格标题就叫「产品卖点（可选，不用很复杂，简单一点）」',
        kind: 'textarea', rows: 2, placeholder: '买一送一，满99减30' },
      ratioField(),
      /* 批 P：照知渔「电商海报设计」这一页的写法 —— 三档「1K 标准 / 2K 高清 / 4K 超清」 */
      clarityField(),
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
    /* 批 J-⑭：这三条是**预览型**（竞品对应 CTA 也是「生成预览」）。
       previewStep = 点主按钮**先出预览、确认后才真出图扣费**。 */
    previewStep: true,
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
      /* ═══ 2026-09-19 批 O-⑨：**上传位并回「基础信息」组**（照知渔的分组结构）═══════════
         依据：知渔 ?tool=product-listing-set 实测（CDP 全文，docs/design/67 §2）左栏是
           「**基础信息**」【上传图片 0/6 → 目标市场 9 → 目标平台 5 → 文案语言 14】
           →「产品卖点与设计风格」→「套图结构配置」
         —— 上传位在**基础信息组里面**，不是独立的一组。
         我们原来把它单独拎出来当第一组，于是分组顺序与他们差一组（多一个「上传图片」头）。
         ⚠️ 上传位的 label 仍是「素材」（我们自己叫得顺），但**归组**必须与他们一致 ——
            分组是布局（要一模一样），字段名是文案（可以不一样）。 */
      uploadField({ maxImages: 6, group: '基础信息' }),
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
    /* 批 J-⑭：这三条是**预览型**（竞品对应 CTA 也是「生成预览」）。
       previewStep = 点主按钮**先出预览、确认后才真出图扣费**。 */
    previewStep: true,
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
    /* 批 J-⑭：这三条是**预览型**（竞品对应 CTA 也是「生成预览」）。
       previewStep = 点主按钮**先出预览、确认后才真出图扣费**。 */
    previewStep: true,
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
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.callout_diagram', board: 'image', name: '卖点标注图解', category: '电商专区', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'warm' },
    summary: '一根根引线把成分与卖点标出来', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '做一张卖点标注图解：主视觉是{{product}}，画面描述：{{prompt}}。字体：{{font}}。要求：用细引线连到要强调的部位、每条引线配一行短标注，标注排版整齐、指向准确、字号统一，背景干净；画面内文字逐字准确，不得臆造数据与认证标识。',
    /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（5 → 6）══════════════════════════════════════
       知渔「爆款商品文字海报」逐字：
         主题 [singleText 必填 help="海报上的标题文字"] · 上传产品图 [file **可选**] ·
         画面描述 [multiText 必填 ph="补充画面描述，让画面更丰富"] · 字体 [radio 必填 6 档] ·
         生成尺寸 [radio 必填 7 档] · 分辨率 [select 必填 1K标准/2K高清/4K超清]
       ⇒ 我们多一格「标注点」、少一格「字体」；而且他们的产品图是**可选**（不上传就靠描述写）。
          按他们改：主题 / 上传产品图（可选）/ 画面描述 / 字体 / 比例 / 分辨率。 */
    fields: [
      { key: 'product', label: '主题', kind: 'text', required: true, group: '主题与画面', placeholder: '海报上的标题文字' },
      { key: 'assets', label: '上传产品图', kind: 'upload', maxImages: 1, role: 'product', group: '主题与画面', slotLabel: '上传商品图（可选，不上传就按描述画）' },
      { key: 'prompt', label: '画面描述', kind: 'textarea', rows: 3, required: true, group: '主题与画面', placeholder: '补充画面描述，让画面更丰富' },
      /* 批 P：知渔这一页的「字体」是**必填**（optional=false），我们原来没标必填 —— 照他们标上 */
      { key: 'font', label: '字体', kind: 'segmented', required: true, group: '主题与画面', options: [
        { value: '书法体', label: '书法体' }, { value: '无衬线体', label: '无衬线体' },
        { value: '霓虹灯字', label: '霓虹灯字' }, { value: '书写体', label: '书写体' },
        { value: '哥特体', label: '哥特体' }, { value: '自定义', label: '自定义' },
      ] },
      /* 批 P：他们这一格的标题是「生成尺寸」（不是「比例」）—— 文案照他们 */
      ratioField(RATIO_SIZED, '生成尺寸'),
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.giant_product', board: 'image', name: '巨型产品广告', category: '电商专区', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'accent' },
    summary: '把人放进巨型商品的尺度里', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '极简商业广告：把{{subject}}放大成巨型装置，人物以自然姿态倚靠或站在它旁边形成尺度反差；单色渐变背景，镜面地板带柔和反射，棚拍光干净通透。画面要有一个明确的视觉焦点，空间关系可信，光线有来处；商品细节与包装文字必须清晰可辨。',
    /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（6 → 4）══════════════════════════════════════
       知渔「夏季蔬果巨物场景化摄影」的 inputConfigs 逐字：
         蔬菜水果名字 [singleText 必填] · 替换指令 [multiText **hidden:true**] · 比例 [3:2/4:3/16:9] · 清晰度 [1K标清/2K高清/4K超清]
       我们原来是 素材/商品名/品牌字/比例/数量/分辨率 —— **多了两个他们没用的（品牌字、数量）**，
       而且他们的第一个字段是「蔬菜水果名字」（一个名字输入），不是上传位。按他们改。
       ═══ 2026-09-19 批 P：再核一层 —— **「替换指令」在知渔是 hidden:true** ═══════════════════
       逐页实采（docs/design/data/quantv-image-pages.json）里这一页左栏只有三格：
         蔬菜水果名字 * | 比例 * 3:2 4:3 16:9 | 清晰度 * 1K标清 2K高清 4K超清
       「替换指令」根本没渲染（他们拿它当内置提示词，不让用户改）。我们照抄成可见输入框是错的：
       用户会以为"这段长文案是我要写的"。⇒ 删掉这一格；比例收成他们那 3 档；清晰度照他们写「标清」。 */
    fields: [
      { key: 'subject', label: '蔬菜水果名字', longLabelReason: '照知渔原文逐字：他们这一页的第一个字段名就叫「蔬菜水果名字」（这是一个纯文本输入，不是上传位）',
        kind: 'text', required: true, group: '主题', placeholder: '例如：柠檬、草莓、牛油果' },
      ratioField([
        { value: '3:2', label: '3:2' },
        { value: '4:3', label: '4:3' },
        { value: '16:9', label: '16:9' },
      ]),
      clarityField({ label: '清晰度', options: [
        { value: '1K', label: '1K标清' },
        { value: '2K', label: '2K高清' },
        { value: '4K', label: '4K超清' },
      ] }),
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
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
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
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
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
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
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
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.tropical_poster', board: 'image', name: '热带饮品海报', category: '电商专区', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'warm' },
    summary: '夏天汽水那种亮到发光的海报', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '做一张热带风饮品海报：{{drink}}居中偏右、略微左倾，瓶身挂满冰凉水珠，内部液体透出光感；背景是明亮的热带色块与水果切片，整体明亮、饱和度高、夏日氛围强，包装上的文字必须清晰准确。',
    /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（6 → 3）══════════════════════════════════════
       知渔「极简日系饮品海报」的 inputConfigs 逐字：
         饮料名称 [singleText 必填] · 比例 [7 档] · 清晰度 [2K高清/4K超清]
       我们原来是 素材/商品名/水果元素/标语/比例/分辨率 —— **多三格**（上传位、水果元素、标语）。
       他们的这一页就是"给个名字直接出图"，照他们收成 3 格。 */
    /* ═══ 2026-09-19 批 P：这一页只剩两格 —— 他们的「比例」是 hidden:true ═════════════════
       逐页实采左栏：「饮料名称 * | 清晰度 * 2K高清 4K超清」—— 比例那一格根本没渲染
       （他们把它藏了，出图尺寸由内置提示词定）。我们原来照着 inputConfigs 摆了一格 7 档比例，
       用户选了它却不生效（服务端仍按他们那套出图）—— 就是我们最忌讳的"死控件"。⇒ 去掉。 */
    fields: [
      { key: 'drink', label: '饮料名称', longLabelReason: '照知渔原文逐字：他们这一页的字段名就叫「饮料名称」（纯文本输入，没有上传位）',
        kind: 'text', required: true, group: '主题', placeholder: '例如：青柠气泡水' },
      clarityField({ label: '清晰度', options: CLARITY_2 }),
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
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
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
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },

  /* ── 电商专区 ─────────────────────────────────────────────────────────── */
  {
    id: 'image.white_bg', board: 'image', name: '白底商品图', category: '电商专区', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'cool' },
    summary: '干净白底，多角度呈现细节', pipeline: 'builtinSkill', availability: 'ready',
    visual: 'free',
    brief: '把商品从原图里抠出来，输出{{mode}}的白底/透明底商品图：商品完整居中、边缘锐利、比例真实，柔和的棚拍光影带出材质与体积感，保留商品自身的颜色、结构与文字；不要添加道具、场景或任何文字。',
    /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（4 → 2）══════════════════════════════════════
       知渔「提取电商白底图」逐字只有 **2 格**：
         上传图片（最好是1：1的比例）[file 必填] · 抠图模式 [radio 必填：透明背景 | 白色背景]
       我们原来是 素材/比例/分辨率/数量 —— **多三格**（比例、分辨率、数量他们都没有）。
       ⚠️ 「抠图模式：透明背景 | 白色背景」正是我上一版从「去除背景」删掉的那一档 ——
          它属于**这一页**（知渔把"纯去背"和"去背后选底色"拆成两个页面）。现在归位。
       ⚠️ 这一页的 brief 也随之改成"抠图"语义（原来是"生成白底图"）。 */
    fields: [
      { key: 'assets', label: '上传图片（最好是1：1的比例）',
        longLabelReason: '照知渔原文逐字：他们这一页的上传位标题就叫「上传图片（最好是1：1的比例）」',
        /* 批 P：知渔这一页的上传位是 **maxImages=1**（一次一张），我们原来给了 6 —— 照他们收成 1 */
        kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'mode', label: '抠图模式', kind: 'segmented', required: true, group: '输出设置', options: [
        { value: '透明背景', label: '透明背景' }, { value: '白色背景', label: '白色背景' },
      ] },
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
    brief: '把商品放进真实使用场景。{{scene}}。商品要保持可辨认的结构、颜色与材质，场景的光线、透视与投影要和商品对得上，像一张真实拍出来的生活照；不要出现文字或水印。',
    /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（5 → 4）══════════════════════════════════════
       知渔「商品场景展示」逐字：
         上传商品图 [file 必填] · 修图指令 [multiText 必填（他们给了完整占位文案）] · 比例 [7 档] · 分辨率 [1K标准/2K高清/4K超清]
       我们多一格「数量」；而且他们的第二格叫「修图指令」且是一段多行指令（不是一个短场景词）—— 按他们改。 */
    fields: [
      /* 批 P：知渔这一页的上传位是 **maxImages=1**（一张商品图），我们原来给了 6 —— 照他们收成 1 */
      { key: 'assets', label: '上传商品图', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'scene', label: '修图指令', kind: 'textarea', rows: 3, required: true,
        placeholder: '请输入商品展示图设计指令，如：设计一张展示图，突出产品的主要功能和特点，背景使用浅色调以突出产品，加入一些动态元素使图像更具吸引力，整体风格简洁大方，符合现代审美等。' },
      ratioField(),
      clarityField(),
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
    brief: '生成商品的多角度成套图，视角：{{angle}}。同一件商品在同一组光线与背景下的连拍感，比例、颜色与细节在各角度之间保持一致；不要改变商品结构。细节补充：{{detail}}。',
    /* ═══ 2026-09-19 批 P：整页照知渔重排（5 格 → 5 格，但**内容全不一样**）═══════════════
       知渔「商品多角度多视图」逐页实采左栏：
         上传原图 [file 必填，最多 **8** 张] · 选择视角（**多选**）[6 档：正面/侧面/背面/俯视/仰视/45度角] ·
         细节补充 [multiText **可选**，占位"补充描述，如商品材质、场景要求、光线风格等..."] ·
         比例 [7 档] · 分辨率 [1K 标准/2K 高清/4K 超清]
       我们的旧版：素材(最多 6) / 角度(只有 4 档：正面·侧面·背面·俯视，而且**单选**) / 比例 / 分辨率 / 数量。
       ⇒ 三处是"功能区两回事"：① 视角少两档且不能多选（他们的卖点就是"多选视角一次出多张"）；
          ② 没有「细节补充」这一格；③ 我们多一格「数量」，他们那页没有。全部照他们改。 */
    fields: [
      { key: 'assets', label: '上传原图', longLabelReason: '照知渔原文逐字：这一页的上传位标题就是「上传原图」',
        kind: 'upload', required: true, maxImages: 8, role: 'product', slotLabel: '上传商品图' },
      { key: 'angle', label: '选择视角（多选）', longLabelReason: '照知渔原文逐字：这一页第二格叫「选择视角（多选）」，括号里的"多选"是他们写的',
        kind: 'segmented', required: true, multiple: true, options: [
        { value: '正面', label: '正面' }, { value: '侧面', label: '侧面' },
        { value: '背面', label: '背面' }, { value: '俯视', label: '俯视' },
        { value: '仰视', label: '仰视' }, { value: '45度角', label: '45度角' },
      ] },
      { key: 'detail', label: '细节补充', kind: 'textarea', rows: 2,
        placeholder: '补充描述，如商品材质、场景要求、光线风格等...' },
      ratioField(),
      clarityField(),
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
    brief: '把衣服穿到模特身上（{{mode}}）。保留模特的五官、身材比例与肤色；衣服要贴合身体、褶皱与垂坠自然，面料质感、图案与版型必须与衣服图一致，光线统一；不要改变衣服的颜色与图案。',
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
      /* ═══ 批 P：这一页照知渔逐格对齐（他们 ?tool=ai-outfit 的实测，见 docs/design/data/quantv-image-pages.json）═══
         他们的格子是：模特选择 → 服装选择（套装 / 多件）→ 上传衣服图 → Pose 参考（可选）→ 背景参考（可选）
                   → 模型选择 → 分辨率（1K / 2K / 4K）→ 比例（自适应 / 1:1 / 3:2 / 2:3 / 16:9 / 9:16）→ 生成张数（1-4）
         ⇒ 我们原来多一格「补充要求」（他们**没有**这一格，多出来的字段就是"没对上"）——本批删掉。
         ⚠️ 两处**如实保留的差异**（都不是漏抄，理由写在下面）：
            · 「模型选择」：他们的下拉是"智能图片image"。我们的模型由路由层按 capability 注入、
              **换模型就换计费 SKU**，属钱路上的决定（批 O-⑧ 已定性，等用户拍板）——本轮不加假下拉。
            · 比例里的「自适应」：我们引擎没有这一档（服务端对未知比例会**静默回落成 1:1**），
              给了就是坑，所以照抄他们其余 5 档。 */
      ratioField([
        { value: '1:1', label: '1:1' },
        { value: '3:2', label: '3:2' },
        { value: '2:3', label: '2:3' },
        { value: '16:9', label: '16:9' },
        { value: '9:16', label: '9:16' },
      ]),
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
      /* 批 P：知渔这一页三格素材**都是必填**（角色图 / 场景图 optional=false），我们原来没标必填 */
      { key: 'character', label: '上传角色图', longLabelReason: '照知渔原文逐字：这一页第二格叫「上传角色图」', kind: 'upload', maxImages: 2, required: true, role: 'person', slotLabel: '上传人物图' },
      { key: 'backdrop', label: '上传场景图', longLabelReason: '照知渔原文逐字：这一页第三格叫「上传场景图」', kind: 'upload', maxImages: 2, required: true, role: 'scene', slotLabel: '上传场景图' },
      { key: 'prompt', label: '自定义提示词', longLabelReason: '照知渔原文逐字：这一页第四格叫「自定义提示词」', kind: 'textarea', rows: 3, required: true },
      /* 批 P：知渔这一页的比例是 **10 档**（比常规 7 档多 4:5 小红书封面 / 5:4 产品主图 / 21:9 超横屏）——
         这三档我们引擎原来没有，本批连尺寸表一起加齐（见 modelCatalog.LEGAL_IMAGE_SIZES 批 P 注释）。 */
      ratioField([
        { value: '1:1', label: '1:1 方图' },
        { value: '2:3', label: '2:3 竖版长图' },
        { value: '3:2', label: '3:2 横版摄影' },
        { value: '3:4', label: '3:4 竖版海报' },
        { value: '4:3', label: '4:3 横版主图' },
        { value: '4:5', label: '4:5 小红书封面' },
        { value: '5:4', label: '5:4 产品主图' },
        { value: '9:16', label: '9:16 手机竖屏' },
        { value: '16:9', label: '16:9 手机横屏' },
        { value: '21:9', label: '21:9 超横屏' },
      ]),
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
    brief: '商品广告：商品在空中炸开分解。主体碎裂成多个碎片向四周飞散，悬浮的残骸与颗粒定格在半空，逐层可见，电影慢动作瞬间，逼真物理，细微粉尘与液滴散落，戏剧性景深，高速摄影风格，中心主体锐利对焦，体积光，照片级真实；必须保留商品本身的形状、颜色、材质与包装文字，碎片不得遮住标签。',
    /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（6 → 4）══════════════════════════════════════
       知渔「电影级高端产品爆炸瞬间海报」逐字：
         上传图片（产品图）[file 必填] · 替换指令 [multiText 必填] · 比例 [7 档] · 清晰度 [1K标准/2K高清/4K超清]
       我们多两格（商品名、数量）。 */
    /* ═══ 2026-09-19 批 P：**「替换指令」在知渔是 hidden:true**，页面上没有这一格 ═══════════
       逐页实采左栏：上传图片（产品图）| 比例 * 1:1 2:3 3:2 3:4 4:3 9:16 更多 | 清晰度 * 1K标准 2K高清 4K超清
       —— 三格，没有"替换指令"（那是他们的内置提示词）。照抄成可见输入框＝让用户以为这段要自己写。 */
    fields: [
      { key: 'assets', label: '上传图片（产品图）', longLabelReason: '照知渔原文逐字：他们这一页的上传位标题就叫「上传图片（产品图）」',
        kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      /* 批 P：比例药丸只有数字（1:1 / 2:3 / …），照他们这一页 */
      ratioField(RATIO_BARE),
      clarityField({ label: '清晰度', options: CLARITY_3_TIGHT }),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.ice_ad', board: 'image', name: '极地冰封海报', category: '电商专区', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'cool' },
    summary: '商品封进巨型冰块，超现实大场面', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '超现实广告海报：商品被完整封存在一块巨大的透明冰块中央，置于广袤极地冰原，背景压一行巨大的品牌字「{{brand}}」，低角度仰拍突出体量感，体积光穿过冰体产生折射与内辉光，冰面裂纹细节，远处暴风雪氛围，电影级广告摄影，超现实商业大片；商品标签与轮廓必须保持清晰可辨，画面内文字逐字准确、不得臆造。',
    /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（6 → 4）══════════════════════════════════════
       知渔「极地冰封巨型广告海报」逐字：
         上传图片（产品图）[file 必填] · 品牌名 [singleText 必填] · 比例 [7 档] · 清晰度 [1K标准/2K高清/4K超清]
       我们多两格（色调、数量），而他们的第二格是**品牌名** —— 按他们改。 */
    fields: [
      { key: 'assets', label: '上传图片（产品图）', longLabelReason: '照知渔原文逐字：他们这一页的上传位标题就叫「上传图片（产品图）」',
        kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      { key: 'brand', label: '品牌名', kind: 'text', required: true, placeholder: '画面里那行品牌字，逐字准确' },
      /* 批 P：比例药丸只有数字（照他们这一页） */
      ratioField(RATIO_BARE),
      clarityField({ label: '清晰度', options: CLARITY_3_TIGHT }),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.float_kv', board: 'image', name: '悬浮主视觉', category: '电商专区', complexity: 'standard',
    cover: { template: 'hero-single', accent: 'neutral' },
    summary: '产品悬浮 + 单向光，高级静物广告', pipeline: 'visualCreation', availability: 'ready',
    visual: 'brand-kv',
    brief: '高端产品摄影：商品悬浮于画面中央，强烈明暗对比与几何光影切割，大面积暗部保留，产品是唯一视觉焦点，柔和反射，真实摄影质感，品牌主视觉，无杂乱元素；商品结构与包装文字必须完整保留。画面要有一个明确的视觉焦点，空间关系可信，光线有来处。',
    /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（6 → 4）══════════════════════════════════════
       知渔「蓝白降落伞悬浮产品创意3D渲染广告」逐字：
         上传图片（产品图）[file 必填] · 替换指令 [multiText 必填] · 比例 [7 档] · 清晰度 [1K标准/2K高清/4K超清]
       我们多两格（光影、背景自由文本），他们的第二格是**替换指令** —— 按他们改。 */
    /* ═══ 2026-09-19 批 P：**「替换指令」在知渔是 hidden:true**，页面上没有这一格 ═══════════
       逐页实采左栏：上传图片（产品图）| 比例 * 1:1 2:3 3:2 3:4 4:3 9:16 更多 | 清晰度 * 1K标准 2K高清 4K超清 */
    fields: [
      { key: 'assets', label: '上传图片（产品图）', longLabelReason: '照知渔原文逐字：他们这一页的上传位标题就叫「上传图片（产品图）」',
        kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      /* 批 P：比例药丸只有数字（照他们这一页） */
      ratioField(RATIO_BARE),
      clarityField({ label: '清晰度', options: CLARITY_3_TIGHT }),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.tvc_grid', board: 'image', name: '九宫格 TVC 分镜', category: '电商专区', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'accent' },
    summary: '一张图出 3×3 广告分镜板', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '做一张九宫格广告分镜板（3×3）：同一个商品在九个镜头里依次出现。要求：每格是一帧独立画面，景别与机位有变化，整体色调统一，格与格之间有叙事顺序；商品在每一格里都保持结构、颜色与包装文字一致，画面内文字逐字准确。',
    /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（5 → 3）══════════════════════════════════════
       知渔「汽水广告九宫格」的 inputConfigs 逐字：
         上传图片（汽水图）[file 必填] · 比例 [7 档] · 清晰度 [1K标准/2K高清/4K超清]
       我们多两格（商品名、九个镜头自由文本）—— 他们的镜头顺序由"九宫格"这个模板本身决定。 */
    fields: [
      { key: 'assets', label: '上传图片（汽水图）', longLabelReason: '照知渔原文逐字：他们这一页的上传位标题就叫「上传图片（汽水图）」',
        kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传商品图' },
      /* 批 P：这一页的比例药丸**只有数字**（1:1 / 2:3 / …），没有"方图/竖版长图"后缀 —— 照他们 */
      ratioField(RATIO_BARE),
      clarityField({ label: '清晰度', options: CLARITY_3_TIGHT }),
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
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
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
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
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
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
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
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.cn_poster', board: 'image', name: '中文海报', category: '创意应用', complexity: 'standard',
    cover: { template: 'poster-style', accent: 'warm' },
    summary: '中文标题与画面一起排', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '设计一张中文海报。主题：{{topic}}。画面描述：{{prompt}}。用途：{{use}}。字体：{{font}}。颜色：{{color}}。效果：{{effect}}。要求：中文标题逐字准确、层级清楚，不出现错字或臆造文案，画面给标题留出安全区。',
    /* ═══ 2026-09-19 批 O-⑥c：**字段逐个照知渔补齐**（5 → 8）═════════════════════════════
       依据：用户第 19 轮「你**抄的完全就没有对上**」+「全部去把这些子页面 1:1 的去把它们抄过来」。
       知渔「中文海报一键生成」的 inputConfigs 逐字（.tmp/laoyu2/dump-cnposter 实测）：
         主题 [singleText 必填 ph="请输入海报主题"] · 画面描述 [multiText 必填 ph="补充画面描述，让画面更丰富"] ·
         用途 [radio 可选 8 档] · 生成尺寸 [radio 必填 7 档] · 字体 [radio 可选 6 档] ·
         颜色 [radio 可选 15 档] · 效果 [radio 可选 18 档] · 选择分辨率 [select 必填 2K高清/4K超清]
       ⇒ 我们原来只有 主题/描述/用途/字体/比例 五格，且**用途 4 档（他们 8）、字体 4 档（他们 6）、
          完全没有颜色与效果** —— 这三处就是"功能区完全两回事"。
       ⚠️ 「颜色」15 档与「效果」18 档照原文全收（他们这两档里都有「自定义」一项，也照收）；
          「生成尺寸」用我们的比例字段（值集已与知渔一致：7 档）；分辨率用 clarityField。
       ⚠️ 标签逐字用他们的写法（"书法体 / 无衬线体 / 霓虹灯字…"），不用我上一版自造的"黑体/宋体/圆体"。 */
    fields: [
      { key: 'topic', label: '主题', kind: 'text', required: true, placeholder: '请输入海报主题' },
      { key: 'prompt', label: '画面描述', kind: 'textarea', rows: 3, required: true, placeholder: '补充画面描述，让画面更丰富' },
      { key: 'use', label: '用途', kind: 'segmented', group: '画面设置', options: [
        { value: '电商促销', label: '电商促销' }, { value: '旅游宣传', label: '旅游宣传' },
        { value: '音乐节', label: '音乐节' }, { value: '艺术画展', label: '艺术画展' },
        { value: '发布会', label: '发布会' }, { value: '产品展示', label: '产品展示' },
        { value: '节日庆典', label: '节日庆典' }, { value: '自定义', label: '自定义' },
      ] },
      /* ═══ 2026-09-19 批 P：**「生成尺寸」在第 4 格，不在最后** ═══════════════════════════
         逐页实采（docs/design/data/quantv-image-pages.json）他们的左栏顺序是：
           主题 | 画面描述 | 用途(8) | **生成尺寸(7)** | 字体(6) | 颜色(15) | 效果(18) | 选择分辨率(2)
         我们原来是 主题/画面描述/用途/字体/颜色/效果/比例/分辨率 —— **尺寸掉到了最后**，
         用户按他们的顺序找尺寸会找不到。照他们的位置摆回第 4 格，标题也照他们叫「生成尺寸」。 */
      /* ⚠️ group 也写「画面设置」：工作台是按**分组**渲染的（同组的字段按声明顺序排），
         如果它落在「生成设置」组里，就会被排到字体/颜色/效果**后面**去 ——
         知渔那一页的顺序是 用途 → 生成尺寸 → 字体 → 颜色 → 效果，位置错了就等于没抄对。 */
      ratioField(RATIO_SIZED, '生成尺寸', '画面设置'),
      { key: 'font', label: '字体', kind: 'segmented', group: '画面设置', options: [
        { value: '书法体', label: '书法体' }, { value: '无衬线体', label: '无衬线体' },
        { value: '霓虹灯字', label: '霓虹灯字' }, { value: '书写体', label: '书写体' },
        { value: '哥特体', label: '哥特体' }, { value: '自定义', label: '自定义' },
      ] },
      { key: 'color', label: '颜色', kind: 'segmented', group: '画面设置', options: [
        { value: '金色', label: '金色' }, { value: '银色', label: '银色' }, { value: '红色', label: '红色' },
        { value: '蓝色', label: '蓝色' }, { value: '绿色', label: '绿色' }, { value: '紫色', label: '紫色' },
        { value: '橙色', label: '橙色' }, { value: '哑光', label: '哑光' }, { value: '亮光', label: '亮光' },
        { value: '黑色', label: '黑色' }, { value: '白色', label: '白色' }, { value: '灰色', label: '灰色' },
        { value: '棕色', label: '棕色' }, { value: '粉色', label: '粉色' }, { value: '自定义', label: '自定义' },
      ] },
      { key: 'effect', label: '效果', kind: 'segmented', group: '画面设置', options: [
        { value: '3D', label: '3D' }, { value: '2D', label: '2D' }, { value: '扁平化', label: '扁平化' },
        { value: '手绘', label: '手绘' }, { value: '水彩', label: '水彩' }, { value: '油画', label: '油画' },
        { value: '素描', label: '素描' }, { value: '黑白', label: '黑白' }, { value: '复古', label: '复古' },
        { value: '霓虹灯', label: '霓虹灯' }, { value: '渐变', label: '渐变' }, { value: '浮雕', label: '浮雕' },
        { value: '阴影', label: '阴影' }, { value: '发光', label: '发光' }, { value: '描边', label: '描边' },
        { value: '卡通', label: '卡通' }, { value: '插画', label: '插画' }, { value: '自定义', label: '自定义' },
      ] },
      /* 批 P：他们的分辨率是**两档**（2K高清 / 4K超清）且标题叫「选择分辨率」—— 照他们 */
      clarityField({ label: '选择分辨率', options: CLARITY_2 }),
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
      languageField('文案语言', LANGUAGE_CLONE),
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
      /* 批 O-⑥d：标签照知渔原文（他们这一档叫「参考强度」，值就是 低/中/高）
         批 P：这一格在知渔是**必填**（optional=false），我们原来没标必填 —— 照他们标上 */
      { key: 'strength', label: '参考强度', kind: 'segmented', required: true, group: '生成设置', options: [
        { value: '低', label: '低' }, { value: '中', label: '中' }, { value: '高', label: '高' },
      ] },
      ratioField(),
      /* 批 O-⑥d：补「选择分辨率」—— 知渔「相似图生成」的 inputConfigs 是 4 个字段
         （上传参考图 / 参考强度 / 比例 / 选择分辨率），我们原来缺最后一格 */
      /* 批 P：他们这一格是**两档**（2K高清 / 4K超清），标题就叫「选择分辨率」—— 照他们 */
      clarityField({ label: '选择分辨率', options: CLARITY_2 }),
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
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
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
    brief: '把这张户型图转成三维建筑效果图。建筑类型：{{buildingType}}。建筑气质：{{buildingMood}}。场地环境：{{siteContext}}。光影氛围：{{lightMood}}。补充要求：{{notes}}。要求：房间数量、开间进深、门窗位置与户型图**完全一致**，家具按常规布局摆放且尺度合理，顶面、地面与墙面的材质统一，光线从窗户自然进入；不要新增或删减房间，不要改动承重结构，画面里不出现文字与尺寸标注。',
    /* ═══ 2026-09-19 批 O-⑥a：**字段逐个照知渔补齐**（4 → 8）═════════════════════════════
       依据：用户第 19 轮「你**抄的完全就没有对上**」+「全部去把这些子页面 1:1 的去把它们抄过来」。
       知渔「平面转建筑效果图」的 inputConfigs 逐字（docs/design/data/quantv-image-key-specs.json）：
         参考图 [file] · 建筑类型 [select: 别墅设计/住宅设计/办公建筑/商业建筑/校园建筑/博览建筑] ·
         建筑气质 [radio: 现代简约/精致曲线/典雅中式/稳重石材] ·
         场地环境 [radio: 住宅环境/城市街区/自然环境/滨水临湖] ·
         光影氛围 [radio: 晴朗日光/柔和逆光/写实静谧/阴天雾感/黎明晨光/夕阳暖光/夜景灯光/质感蓝调] ·
         更多描述 [multiText 可选] · 比例 [7 档] · 清晰度 [1K/2K/4K]
       ⇒ **我们原来把"建筑气质/场地环境/光影氛围"三个维度糊成了一格「空间与风格」文本域** ——
          这正是用户说的"功能区完全两回事"。现在按他们的四个维度**拆开**，并把「数量」去掉
          （他们这一页没有数量档；比例与清晰度我们已有对应字段）。
       ⚠️ 「更多描述」保留可选（原文就是 optional）。 */
    fields: [
      { key: 'assets', label: '参考图', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传户型图 / 平面图' },
      { key: 'buildingType', label: '建筑类型', kind: 'select', required: true, group: '建筑与场地', options: [
        { value: '别墅设计', label: '别墅设计' }, { value: '住宅设计', label: '住宅设计' },
        { value: '办公建筑', label: '办公建筑' }, { value: '商业建筑', label: '商业建筑' },
        { value: '校园建筑', label: '校园建筑' }, { value: '博览建筑', label: '博览建筑' },
      ] },
      { key: 'buildingMood', label: '建筑气质', kind: 'segmented', required: true, group: '建筑与场地', options: [
        { value: '现代简约', label: '现代简约' }, { value: '精致曲线', label: '精致曲线' },
        { value: '典雅中式', label: '典雅中式' }, { value: '稳重石材', label: '稳重石材' },
      ] },
      { key: 'siteContext', label: '场地环境', kind: 'segmented', required: true, group: '建筑与场地', options: [
        { value: '住宅环境', label: '住宅环境' }, { value: '城市街区', label: '城市街区' },
        { value: '自然环境', label: '自然环境' }, { value: '滨水临湖', label: '滨水临湖' },
      ] },
      /* 批 P：这一格实测是 **8 档全铺**（他们那页没有「更多」）—— maxVisible 显式声明 */
      { key: 'lightMood', label: '光影氛围', kind: 'segmented', required: true, group: '建筑与场地', maxVisible: 8, options: [
        { value: '晴朗日光', label: '晴朗日光' }, { value: '柔和逆光', label: '柔和逆光' },
        { value: '写实静谧', label: '写实静谧' }, { value: '阴天雾感', label: '阴天雾感' },
        { value: '黎明晨光', label: '黎明晨光' }, { value: '夕阳暖光', label: '夕阳暖光' },
        { value: '夜景灯光', label: '夜景灯光' }, { value: '质感蓝调', label: '质感蓝调' },
      ] },
      { key: 'notes', label: '更多描述', kind: 'textarea', rows: 2, group: '建筑与场地',
        placeholder: '可选：补充户型、材料、家具等具体要求' },
      /* 批 P：这一页的比例是**只有数字的 7 档**，而且**铺满**（他们那页没出现「更多」）—— maxVisible 显式声明 */
      { ...ratioField(RATIO_BARE), maxVisible: 7 },
      /* 批 P：这一页的清晰度只有数字（1K / 2K / 4K），没有"标准/高清/超清"后缀 —— 照他们 */
      clarityField({ label: '清晰度', options: CLARITY_3_PLAIN }),
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
      { key: 'assets', label: '上传图片', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传空间照片' },
      /* 批 O-⑥：知渔「装修风格转换」的第二格是**自由指令**（multiText 必填，带完整占位文案），
         不是一个风格选择器 —— 按他们改成指令输入（判据：功能区一模一样） */
      { key: 'style', label: '家装指令', kind: 'textarea', rows: 3, required: true, placeholder: '请输入您的家装修改指令，如：将客厅的墙壁颜色改为浅蓝色，增加一些现代风格的家具，地板更换为木质地板等。' },
      ratioField(),
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.rough_interior', board: 'image', name: '毛坯房设计', category: '建筑家装', complexity: 'standard',
    cover: { template: 'before-after', accent: 'soft' },
    summary: '毛坯现场照，直接出精装方案', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '把这张毛坯房照片做成精装完成后的样子。装修风格：{{style}}。其他需求：{{plan}}。要求：墙体、梁柱、门窗与管道位置**完全保留**，只在其上增加吊顶、地面、墙面饰面与家具；机位与透视不变，光线从原有窗户进入，材质真实、色温统一，不出现结构改动与文字标注。',
    /* ═══ 2026-09-19 批 O-⑥d：**字段逐个照知渔补齐**（4 → 5）═════════════════════════════
       依据：用户第 19 轮「你**抄的完全没有对上**」+「全部去把这些子页面 1:1 的去把它们抄过来」。
       知渔「毛坯家装设计」的 inputConfigs 逐字：
         上传图片 [file] · 选择装修风格 [radio 必填 5 档：轻奢奶油风/现代简约风/北欧风/中国风/工业复古风] ·
         其他需求 [multiText 可选 ph="描述您想要的其他装修需求..."] · 比例 [7 档] · 选择分辨率 [2K高清/4K超清]
       ⇒ 我们原来把"装修风格"这一档**整个丢了**（只有一个自由文本"设计要点"），还多了一档「数量」。
          现在按他们拆成「选择装修风格（5 档必填）+ 其他需求（可选）」，「数量」去掉（他们没有）。 */
    fields: [
      /* 批 P：知渔这一页的上传位是 **maxImages=1**（一张毛坯现场照），我们原来给了 2 */
      { key: 'assets', label: '上传图片', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传毛坯现场照' },
      { key: 'style', label: '选择装修风格', kind: 'segmented', required: true, group: '设计风格', options: [
        { value: '轻奢奶油风', label: '轻奢奶油风' }, { value: '现代简约风', label: '现代简约风' },
        { value: '北欧风', label: '北欧风' }, { value: '中国风', label: '中国风' },
        { value: '工业复古风', label: '工业复古风' },
      ] },
      { key: 'plan', label: '其他需求', kind: 'textarea', rows: 2, group: '设计风格', placeholder: '描述您想要的其他装修需求...' },
      ratioField(),
      /* 批 P：他们这一格是**两档**（2K高清 / 4K超清），标题叫「选择分辨率」 */
      clarityField({ label: '选择分辨率', options: CLARITY_2 }),
    ],
    cases: [], history: true,
  },
  {
    /* 批 O-⑥ 升档（有证据）：知渔「日夜气候切换」实测就是 4 字段（上传图片 / 一句指令 / 比例 / 分辨率），
       我们把这一档抄进来之后字段数就超过 simple 的 4 上限 —— 改的是"这一档有多复杂"这个判断，不是放宽门禁。 */
    id: 'image.day_night_still', board: 'image', name: '日夜气候切换', category: '建筑家装', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'cool' },
    summary: '同一张图，出白天 / 黄昏 / 夜晚三版', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '把这张建筑 / 空间图改成「{{moment}}」的样子。要求：建筑结构、机位、构图与材质**完全不变**，只改变光线方向、色温、天空与阴影；室内灯光在夜景中要自然亮起并有真实反射，地面湿度与反光符合天气设定，不出现结构变化与文字。',
    fields: [
      { key: 'assets', label: '上传图片', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传建筑 / 空间图' },
      /* 批 O-⑥：知渔「日夜气候切换」的第二格是**修图指令**（multiText 必填）—— 按他们改 */
      { key: 'moment', label: '修图指令', kind: 'textarea', rows: 3, required: true,
        placeholder: '例如：把画面改成黄昏时分，暖橙色侧光，天空有渐变的晚霞' },
      ratioField(),
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
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
      { key: 'assets', label: '上传图片', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传空间图' },
      { key: 'target', label: '家装指令', kind: 'textarea', rows: 3, required: true, placeholder: '例如：布艺沙发换皮质沙发，地毯换木地板，主灯换轨道灯' },
      ratioField(),
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
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
    /* 批 O-⑥ 升档（有证据）：知渔「效果图质感提升」实测就是 4 字段（上传图片 / 一句指令 / 比例 / 分辨率），
       我们把这一档抄进来之后字段数就超过 simple 的 4 上限 —— 改的是"这一档有多复杂"这个判断，不是放宽门禁。 */
    id: 'image.render_quality', board: 'image', name: '效果图质感提升', category: '建筑家装', complexity: 'standard',
    cover: { template: 'before-after', accent: 'neutral' },
    summary: '把普通效果图提到商业出图水准', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '提升这张效果图的画面质感，不改变任何结构、家具与机位。要求：修正材质反射与粗糙度，让木纹、石材、金属、织物各自可辨；补足环境光遮蔽与柔和阴影，降低塑料感与噪点，提亮暗部但不死黑，整体色温统一、画面干净通透，达到商业出图水准。',
    fields: [
      { key: 'assets', label: '上传图片', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传效果图' },
      /* 批 O-⑥：知渔「效果图质感提升」的第二格是**后期指令**（multiText 必填）—— 按他们改 */
      { key: 'focus', label: '后期指令', kind: 'textarea', rows: 3, required: true,
        placeholder: '例如：增强金属与玻璃的反射、补上接触阴影、去掉塑料感' },
      ratioField(),
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
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
      { key: 'assets', label: '上传3D模型图（必选）',
        longLabelReason: '照知渔原文逐字：他们这一页的上传位标题就叫「上传3D模型图（必选）」，括号里的"必选"是他们写在标题里的',
        kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传模型图 / 白模' },
      /* 批 O-⑥：知渔「室内3D模型渲染」的第二格是**图片编辑指令**（multiText 必填）—— 按他们改 */
      { key: 'style', label: '图片编辑指令', kind: 'textarea', rows: 3, required: true,
        placeholder: '描述渲染风格、材质、光照等' },
      ratioField(),
      /* 批 O-六：补「分辨率」—— 知渔这一页有这一档，我们原来没有 */
      clarityField(),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.arch_grid', board: 'image', name: '建筑九宫格分镜', category: '建筑家装', complexity: 'standard',
    cover: { template: 'case-3up', accent: 'cool' },
    summary: '一张九宫格讲完一栋建筑', pipeline: 'visualCreation', availability: 'ready',
    visual: 'poster',
    brief: '做一张建筑九宫格分镜板（3×3）。大师风格：{{masterStyle}}。光影调节：{{lightTone}}。创意描述：{{notes}}。要求：九格是同一栋建筑的九个视角或时段，透视与结构一致，格与格之间有叙事顺序（远景 → 中景 → 细节 → 室内 → 夜景），色调统一，不出现文字、标注与水印。',
    /* ═══ 2026-09-19 批 O-⑥b：**字段逐个照知渔补齐**（3 → 6）═════════════════════════════
       依据：用户第 19 轮「你**抄的完全就没有对上**」+「全部去把这些子页面 1:1 的去把它们抄过来」。
       知渔「建筑九宫格分镜」的 inputConfigs 逐字（docs/design/data/quantv-image-key-specs.json）：
         参考图 [file] · 大师风格 [radio 9 档] · 光影调节 [radio 9 档] ·
         创意描述（可选）[multiText] · 比例 [7 档] · 清晰度 [1K/2K/4K]
       ⇒ 我们原来只有「九个镜头」一个自由文本域、且缺清晰度 —— 现在按他们的两档 radio 拆开。
       ⚠️ 「九个镜头」那个文本域**去掉**：知渔这一页没有它，镜头顺序由"九宫格"这个模板本身决定
          （他们的 brief 写在 app 的 systemPrompt 里）。多一格就是没对上。 */
    fields: [
      { key: 'assets', label: '参考图', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传建筑图' },
      /* 批 P：9 档实测**铺满**（他们那页没有「更多」）—— maxVisible 显式声明 */
      { key: 'masterStyle', label: '大师风格', kind: 'segmented', required: true, group: '风格与光影', maxVisible: 9, options: [
        { value: '韦斯·安德森', label: '韦斯·安德森风格' }, { value: '罗杰·迪金斯', label: '罗杰·迪金斯风格' },
        { value: '王家卫', label: '王家卫风格' }, { value: '克里斯托弗·诺兰', label: '克里斯托弗·诺兰风格' },
        { value: '宫崎骏', label: '宫崎骏风格' }, { value: '新海诚', label: '新海诚风格' },
        { value: '李安', label: '李安风格' }, { value: '大卫·芬奇', label: '大卫·芬奇风格' },
        { value: '丹尼斯·维伦纽瓦', label: '丹尼斯·维伦纽瓦风格' },
      ] },
      /* 批 P：9 档实测**铺满**（他们那页没有「更多」）—— maxVisible 显式声明 */
      { key: 'lightTone', label: '光影调节', kind: 'segmented', required: true, group: '风格与光影', maxVisible: 9, options: [
        { value: '自然光感', label: '自然光感' }, { value: '柔和逆光', label: '柔和逆光' },
        { value: '几何光影', label: '几何光影' }, { value: '暖调氛围', label: '暖调氛围' },
        { value: '蓝调时刻', label: '蓝调时刻' }, { value: '黄昏时刻', label: '黄昏时刻' },
        { value: '晨雾柔光', label: '晨雾柔光' }, { value: '夜晚时分', label: '夜晚时分' },
        { value: '明亮通透', label: '明亮通透' },
      ] },
      { key: 'notes', label: '创意描述（可选）',
        longLabelReason: '照知渔原文逐字：他们这一页的字段名就叫「创意描述（可选）」，括号里的"可选"是他们写在标题里的，不是我们加的',
        kind: 'textarea', rows: 2, group: '风格与光影',
        placeholder: '可选：补充叙事、场景或构图要求' },
      /* 批 P：比例只有数字的 7 档，且实测**铺满**（没有「更多」）—— 照他们 */
      { ...ratioField(RATIO_BARE), maxVisible: 7 },
      /* 批 P：这一页的清晰度只有数字（1K / 2K / 4K）—— 照他们 */
      clarityField({ label: '清晰度', options: CLARITY_3_PLAIN }),
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
      /* 批 P：知渔这一页的第二格是**必填**的「修图指令」（optional=false），我们原来没标必填 */
      { key: 'prompt', label: '修图指令', longLabelReason: '照知渔原文逐字：人像变清晰这一页的第二格叫「修图指令」', kind: 'textarea', rows: 3, required: true },
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
    brief: '保留人物五官与脸型，按这条指令换发型：{{style}}。发丝走向、发量感与光线要自然可信，肤色与背景保持一致；不要改变人物的身份特征。',
    /* ═══ 2026-09-19 批 P：第二格照知渔改成**多行「图片编辑指令」**═══════════════════════════
       知渔「AI换发型」逐字：上传图片 [file] · 图片编辑指令 [multiText **必填**，
         默认值「给人物更换黑长直发型 发丝顺滑 自然垂落 发尾齐整」，
         占位「描述想要的发型和发色...」] · 比例 [7 档] · 分辨率 [1K 标准/2K 高清/4K 超清]
       我们原来是一格**单行**「发型」（还选填）—— 他们要的是一句完整的编辑指令（含发色、发质、
       走向），单行写不下，而且不填就跑（他们必填）。⇒ 改成多行 + 必填 + 照抄他们的默认值与占位。 */
    fields: [
      { key: 'assets', label: '上传图片', longLabelReason: '照知渔原文逐字：这一页的上传位标题就是「上传图片」', kind: 'upload', required: true, maxImages: 1, role: 'person', slotLabel: '上传人像图' },
      { key: 'style', label: '图片编辑指令', longLabelReason: '照知渔原文逐字：这一页第二格叫「图片编辑指令」',
        kind: 'textarea', rows: 2, required: true,
        default: '给人物更换黑长直发型 发丝顺滑 自然垂落 发尾齐整',
        placeholder: '描述想要的发型和发色...' },
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
      /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（5 → 4）══════════════════════════════════════
         知渔「人物姿势参考」逐字（**两格都是上传位，没有文本指令**）：
           上传高清模特图 [file 必填] · 上传姿势图 [file 必填] · 比例 [7 档] · 选择分辨率 [2K高清/4K超清]
         我们原来是 素材(1) + 「姿势」自由文本 + 比例 + 数量 + 分辨率 —— 语义整个不对：
         他们要的是**给一张姿势参考图**，我们却让用户用文字描述姿势。按他们改成两个上传位。 */
      { key: 'assets', label: '上传高清模特图', longLabelReason: '照知渔原文逐字：他们这一页的第一个上传位标题就叫「上传高清模特图」',
        kind: 'upload', required: true, maxImages: 1, role: 'person', slotLabel: '上传人物图' },
      { key: 'pose', label: '上传姿势图', kind: 'upload', required: true, maxImages: 1, role: 'reference', slotLabel: '上传姿势参考图' },
      ratioField(),
      /* 批 P：他们这一格是**两档**（2K高清 / 4K超清），标题叫「选择分辨率」 */
      clarityField({ label: '选择分辨率', options: CLARITY_2 }),
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
    brief: '去掉背景，只保留主体，输出透明底。主体边缘要干净，发丝与透明材质要处理好，不要残留原背景，也不要改变主体本身的颜色与结构。',
    /* ═══ 2026-09-19 批 O：**改回 1:1**（用户第 19 轮：「你抄的完全就没有对上」）═══════════
       知渔 ?tool=remove-background 实测（CDP 全文，docs/design/67 §2）**只有两样东西**：
         「最多上传 5 张图片」+ 0/5 计数 + 一个「+」上传位 → 一颗「去除背景 / 消耗 0.40 积分」
         → 「请先上传需要去除背景的图片」；右栏示例是「原图 ↔ 去背景后」两图对照。
       **没有底色，也没有比例。**
       我上一版多给了「底色（透明/白色/纯色）」和「比例」两档，理由是"多给的是能力，不是坑" ——
       但用户的判据是**一模一样**，多出来的字段就是"没对上"。
       而且知渔把这两件事分在**两个页面**：
         · ?tool=remove-background  去除背景 = 纯去背，无选项；
         · ?id=cmppkwl86g…（应用市场的「提取电商白底图」）才有「抠图模式：透明背景 | 白色背景」。
       所以这里**删掉**底色与比例，把「底色」搬到它真正属于的那一页（image.white_bg）。 */
    fields: [
      uploadField({ maxImages: 5, slotLabel: '点击或拖拽上传图片', hint: '最多上传 5 张图片，一次批量去背景' }),
    ],
    cases: [], history: true,
  },
  {
    id: 'image.swap_bg', board: 'image', name: '换背景', category: '图片编辑', complexity: 'standard',
    cover: { template: 'before-after', accent: 'cool' },
    summary: '人物或商品留着，背景换掉', pipeline: 'visualCreation', availability: 'needs_ref',
    visual: 'free',
    brief: '保留主体，把背景换成我给的这张（或按下面的要求）：{{prompt}}。主体的光线要与新背景对得上，投影方向一致，边缘融合自然；不要改变主体的形态与颜色。',
    /* ═══ 2026-09-19 批 O-⑥：字段逐个照知渔（标签与必填态对齐）══════════════════════════════
       知渔「一键模特换背景」逐字：
         上传原模特图 [file 必填] · 上传场景图 [file **可选**] ·
         自定义输入背景提示词（选填）[multiText 可选 ph="请输入背景的相关词" help="背景的相关词"] ·
         比例 [7 档] · 分辨率 [1K标准/2K高清/4K超清]
       字段数我们本来也是 5，差的是**标签与必填态**：他们第二格是可选、第三格标题带"（选填）"——
       照他们改（文案可以不一样，但"哪一格可选"是逻辑，必须一致）。 */
    fields: [
      { key: 'assets', label: '上传原模特图', longLabelReason: '照知渔原文逐字：他们这一页的上传位标题就叫「上传原模特图」',
        kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传原图' },
      { key: 'backdrop', label: '上传场景图', kind: 'upload', maxImages: 1, role: 'scene', slotLabel: '上传背景图（可选，不上传就按下面的词生成）' },
      { key: 'prompt', label: '自定义输入背景提示词（选填）',
        longLabelReason: '照知渔原文逐字：他们这一页的第三格标题就叫「自定义输入背景提示词（选填）」',
        kind: 'textarea', rows: 3, placeholder: '请输入背景的相关词' },
      ratioField(),
      clarityField(),
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
      { key: 'assets', label: '上传图片', longLabelReason: '照知渔原文逐字：一键美化图片这一页的上传位标题就是「上传图片」', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传图片' },
      /* 批 P：知渔这一页第二格叫「修图指令」且**必填**（我们原来叫「要求」且选填） */
      { key: 'prompt', label: '修图指令', longLabelReason: '照知渔原文逐字：这一页第二格叫「修图指令」', kind: 'textarea', rows: 3, required: true, placeholder: '例如：把背景杂物清掉，光线调亮一点' },
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
    brief: '主体不动，把风格材质换成「{{material}}」。新材质的反光、纹理与质感要真实可信，并与环境光一致；保持主体的形状、比例与结构不变。',
    /* ═══ 2026-09-19 批 P：第二格照知渔换成**22 档「风格选择」**═══════════════════════════
       知渔「图片换风格」逐字（副标题就写着"保持结构不变更换风格材质"—— 与我们的"材质替换"是同一件事）：
         上传参考图 [file 必填] · 风格选择 [radio **必填 22 档**] · 比例 [7 档] · 选择分辨率 [2K高清/4K超清]
         22 档原文：精致韩漫 / 写实 / 新莫奈花园 / 中国红 / 赛博机械 / 3D / 玩偶 / 动画电影 / 可爱玩偶 /
                   丑萌粘土 / 陶瓷娃娃 / 浪漫光影 / 国风-水墨 / 精致美漫 / 莫奈花园 / 水彩风 / 水墨 /
                   梦幻 / 日漫 / 动漫 / 天使 / 油画
       我们原来是一格**单行自由文本「材质」**（还得用户自己打"磨砂陶瓷、原木"）——
       他们给的是 22 个点一下就换的风格（前 6 个铺开 + 「更多」收折，见 FieldRenderer 的收折规则）。 */
    fields: [
      { key: 'assets', label: '上传参考图', longLabelReason: '照知渔原文逐字：图片换风格这一页的上传位标题就是「上传参考图」', kind: 'upload', required: true, maxImages: 1, role: 'product', slotLabel: '上传图片' },
      { key: 'material', label: '风格选择', longLabelReason: '照知渔原文逐字：这一页第二格叫「风格选择」', kind: 'segmented', required: true, options: [
        { value: '精致韩漫', label: '精致韩漫' }, { value: '写实', label: '写实' },
        { value: '新莫奈花园', label: '新莫奈花园' }, { value: '中国红', label: '中国红' },
        { value: '赛博机械', label: '赛博机械' }, { value: '3D', label: '3D' },
        { value: '玩偶', label: '玩偶' }, { value: '动画电影', label: '动画电影' },
        { value: '可爱玩偶', label: '可爱玩偶' }, { value: '丑萌粘土', label: '丑萌粘土' },
        { value: '陶瓷娃娃', label: '陶瓷娃娃' }, { value: '浪漫光影', label: '浪漫光影' },
        { value: '国风-水墨', label: '国风-水墨' }, { value: '精致美漫', label: '精致美漫' },
        { value: '莫奈花园', label: '莫奈花园' }, { value: '水彩风', label: '水彩风' },
        { value: '水墨', label: '水墨' }, { value: '梦幻', label: '梦幻' },
        { value: '日漫', label: '日漫' }, { value: '动漫', label: '动漫' },
        { value: '天使', label: '天使' }, { value: '油画', label: '油画' },
      ] },
      ratioField(),
      /* 批 P：他们这一格是**两档**（2K高清 / 4K超清），标题叫「选择分辨率」 */
      clarityField({ label: '选择分辨率', options: CLARITY_2 }),
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
