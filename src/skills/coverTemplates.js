/* ═══ 封面模板与提示词（案例墙的产线定义）═══════════════════════════════════════
   依据 docs/design/43-media-architecture.md §6 与用户批注（图 #13）：
   「后期你要根据不同的板块去设计不同的封面模板……你把每一类的封面它的整体的提示词给到我，
    我去生成之后自己在后台上传上来」。
   实测口径（知渔）：封面**统一 4:3**、卡片上只有封面 + 标题，
   所以"风格一致"不是靠审美，是靠**同一比例 + 同一版式 + 同族色相**机械保证。
   本文件只做两件事：① 声明三个模板族的版式与槽位；② 用槽位拼出**可直接使用的出图提示词**。
   ⚠️ 这里只定义"怎么出封面"，不涉及 CSS/渲染 —— 案例卡的渲染是 CaseCard（唯一实现）。 */

export const COVER_ASPECT = '4:3';
export const COVER_SIZE = { width: 1600, height: 1200 };

/* 三个模板族：够用就好，不追求多（模板越多越难保持一致）。 */
export const COVER_TEMPLATES = [
  {
    id: 'case-3up',
    name: '案例三拼',
    useFor: ['电商商品套图', '模特上身 / 试穿', '小红书种草图文'],
    layout: '左侧标题区（占比约 1/3）+ 右侧三张成品图错落排列，三图轻微倾斜、彼此叠压',
    slots: ['subject', 'accent', 'title', 'subtitle'],
  },
  {
    id: 'hero-single',
    name: '主体单图',
    useFor: ['自由创作', '白底商品图'],
    layout: '整幅主体成品图铺满，左上角留白给标题，右下角留一个小角标位',
    slots: ['subject', 'accent', 'title'],
  },
  {
    id: 'poster-style',
    name: '海报满幅',
    useFor: ['海报设计', '社媒封面'],
    layout: '整幅以成品海报为主视觉，底部压一条半透明标题条，标题与副标题左对齐',
    slots: ['subject', 'accent', 'title', 'subtitle'],
  },
  {
    /* 第 4 类：修图 / 复刻 / 试穿 / 去背景这类"输入决定输出"的 skill，
       单张成品说不清它干什么 —— 实测竞品的「提取电商白底图」封面就是原图 → 箭头 → 白底成品。
       43 §10.4 也写了：复刻/修图类 skill 的示例一律做 before/after。 */
    id: 'before-after',
    name: '原图对比',
    useFor: ['模特上身 / 试穿', '图片复刻', '去背景', '修图增强'],
    layout: '左右并置：左边原图、右边 AI 成品，中间一个箭头；两张图等大、同一底色',
    slots: ['subject', 'accent', 'title'],
  },
];

/* 色相分组：同组同色温，跨组一眼能区分（实测他们也是这么分区的）。 */
export const COVER_ACCENTS = {
  warm: { name: '暖调', hint: '米杏、陶土、暖白，适合电商与商业海报' },
  soft: { name: '柔调', hint: '奶油、雾粉、浅灰，适合人像与生活场景' },
  cool: { name: '冷调', hint: '雾蓝、灰绿、冷白，适合白底与修图类' },
  accent: { name: '高饱和', hint: '品牌紫为主点缀，适合社媒封面与活动海报' },
  neutral: { name: '中性', hint: '黑白灰为主，只留一个点缀色，适合自由创作' },
};

export const COVER_STYLE_RULES = [
  '统一 4:3（1600×1200），四角不得出现水印、logo、二维码',
  '标题最多 8 个汉字，副标题最多 16 个汉字；标题字号明显大于副标题',
  '同一套封面的字体气质必须一致（标题用无衬线粗体，副标题用同族常规字重）',
  '留白不少于画面的 18%，保证缩到 274×205 的卡片尺寸时仍然认得出主体',
  '画面里不出现任何模型名、价格、积分或促销文案（那些由界面渲染，不进封面）',
];

/* 槽位 → 中文提示词片段。拼出来的提示词可以直接丢给任意生图模型。 */
export function buildCoverPrompt({ template = 'case-3up', accent = 'neutral', subject = '商品', title = '', subtitle = '' } = {}) {
  const tpl = COVER_TEMPLATES.find(item => item.id === template) || COVER_TEMPLATES[0];
  const tone = COVER_ACCENTS[accent] || COVER_ACCENTS.neutral;
  const lines = [
    '【用途】生成一张 4:3（1600×1200）的案例封面图，用于 AI 创作平台的案例墙卡片。',
    '【版式】' + tpl.layout + '。',
    '【主体】' + subject + '。主体清晰、边缘干净，居中偏右，右侧留出标题区。',
    '【色相】' + tone.name + '：' + tone.hint + '。',
    '【文字】' + (title ? '主标题「' + title + '」' : '主标题留白由后期排版') + (subtitle ? '，副标题「' + subtitle + '」' : '') + '。标题用无衬线粗体，左对齐。',
    '【风格】商业级棚拍质感，柔和棚光 + 轻微景深，画面干净、有呼吸感，缩到 274×205 依然辨识度强。',
    '【禁止】不要水印、logo、二维码、价格、积分、模型名；不要拼贴边框；不要超过两种字体气质。',
    '【留白】不少于画面 18%。',
  ];
  return lines.join('\n');
}

/* 图片板块 7 个 Skill 的封面出图清单：照这个表出图即可，标题即卡片上显示的文字。 */
export const IMAGE_COVER_PLAN = [
  { skillId: 'image.free', template: 'hero-single', accent: 'neutral', subject: '一张风格鲜明的 AI 生成插画或摄影作品', title: '自由创作' },
  { skillId: 'image.poster', template: 'poster-style', accent: 'warm', subject: '一张文化活动的商业海报成品', title: '海报设计', subtitle: '版式与文字层级一起给' },
  { skillId: 'image.social_cover', template: 'poster-style', accent: 'accent', subject: '一张公众号或视频号的封面成品', title: '社媒封面', subtitle: '一眼看懂主题' },
  { skillId: 'image.product_suite', template: 'case-3up', accent: 'warm', subject: '同一款商品的三种电商成品图（白底、场景、卖点）', title: '电商套图', subtitle: '白底+场景+卖点成套' },
  { skillId: 'image.white_bg', template: 'hero-single', accent: 'cool', subject: '一件商品的白底主图，多角度呈现细节', title: '白底商品图' },
  { skillId: 'image.try_on', template: 'before-after', accent: 'soft', subject: '同一位模特穿着商品的前后对照（原图 → 成品）', title: '模特试穿', subtitle: '姿势与场景可选' },
  { skillId: 'image.xhs_note', template: 'case-3up', accent: 'soft', subject: '一组小红书风格的种草图（封面 + 两张内页）', title: '小红书图文', subtitle: '真实感优先' },
];

/* 视频板块 10 个 Skill 的封面计划：与 docs/design/45-cover-shotlist.md 同一张表。
   两张表合起来 17 条 = Hub 上必须出现的 17 张卡；缺一条就会出现空卡（门禁拦截）。 */
export const VIDEO_COVER_PLAN = [
  { skillId: 'video.smart', template: 'case-3up', accent: 'accent', subject: '一段商品短片的三个关键帧（开场、特写、收束）', title: '智能成片', subtitle: '一句话起步' },
  { skillId: 'video.frame', template: 'case-3up', accent: 'cool', subject: '同一镜头首帧与尾帧的对比画面', title: '首尾帧', subtitle: '锁定起点与终点' },
  { skillId: 'video.remake', template: 'case-3up', accent: 'warm', subject: '参考片节奏与替换后成片的对照画面', title: '爆款复刻', subtitle: '保住节奏换内容' },
  { skillId: 'video.image_to_video', template: 'hero-single', accent: 'warm', subject: '一件商品静图与它动起来后的画面并置', title: '图生视频' },
  { skillId: 'video.product_motion', template: 'hero-single', accent: 'warm', subject: '商品旋转、光影扫过的动态瞬间', title: '商品动态' },
  { skillId: 'video.content_swap', template: 'case-3up', accent: 'soft', subject: '同一段动作里人物被替换前后的对照画面', title: '内容替换', subtitle: '一键换人' },
  { skillId: 'video.model_runway', template: 'hero-single', accent: 'soft', subject: '模特转身迈步、衣摆飘动的瞬间', title: '模特动态' },
  { skillId: 'video.camera_move', template: 'case-3up', accent: 'accent', subject: '同一场景下推、移、环绕三种运镜的画面', title: '运镜控制', subtitle: '指定镜头怎么走' },
  { skillId: 'video.extend', template: 'case-3up', accent: 'cool', subject: '同一镜头前后两段连续画面的衔接', title: '延长续写' },
  { skillId: 'video.festival_spot', template: 'poster-style', accent: 'accent', subject: '节日氛围中的商品短片关键画面', title: '节日短片', subtitle: '节点氛围+商品' },
];

/* 两板块合表：封面产线（scripts/build-skill-covers.mjs）与门禁都读这一份，
   保证「声明里有几条 Skill，磁盘上就有几张封面」。 */
export const ALL_COVER_PLAN = [...IMAGE_COVER_PLAN, ...VIDEO_COVER_PLAN];

export const COVER_ASSET_DIR = 'public/skill-covers';
export const COVER_ROUTE_PREFIX = '/skill-covers';

/* 封面文件名 = cover-<skillId>.svg（例：cover-image.poster.svg，见 45 的归档约定）。
   归一化掉 id 里可能出现的路径分隔符，避免生成物越出资产目录。 */
export function coverFileName(skillId) {
  const key = String(skillId == null ? '' : skillId).trim().replace(/[\\/]+/g, '-');
  return 'cover-' + key + '.svg';
}

export function coverRoute(skillId) {
  return COVER_ROUTE_PREFIX + '/' + coverFileName(skillId);
}

export function getCoverPlan(skillId) {
  const key = String(skillId == null ? '' : skillId).trim();
  return ALL_COVER_PLAN.find(item => item.skillId === key) || null;
}


/* ── 封面素材从哪来：**从 skill 自己的案例（cases）来** ─────────────────────────
   2026-09-16 用户指正：「他们的排版应该是基于里面生成案例去做的封面，不是直接做封面」。
   所以这里不另立一套"封面素材表"——封面必须由该 skill 的 cases 排出来：
     · 推荐位（category = 精品推荐）：封面**不烤字**，纯案例图，标题交给卡片底部的遮罩；
     · 其它专区：封面**烤字，字在上方**（竞品的字都在上面，下面是遮罩标题）。
   这条规则让"封面"与"点进去看到的案例"永远是同一批素材 —— 用户不会被封面骗进去。
   版式（由 cover.template 指定）：
     · case-3up     三张案例错落叠压（成套类：电商套图 / 多角度 / 穿搭套图）
     · hero-single  一张案例为主体（单图类：白底图 / 商品动态 / 模特动态）
     · poster-style 一整幅案例铺满（海报 / 社媒封面 / 节日短片 —— 案例本身就是完整画面）
     · before-after 原图 → 成品（修图 / 复刻 / 试穿，43 §10.4 要求我们这么做） */

/* 每种版式需要几张案例：不够就不能出封面（否则会出现缺角的封面）。 */
export const COVER_LAYOUT_TILES = { 'case-3up': 3, 'before-after': 2, 'hero-single': 1, 'poster-style': 1 };

export function coverLayoutOf(skill) {
  const template = skill && skill.cover ? skill.cover.template : '';
  return COVER_LAYOUT_TILES[template] ? template : 'hero-single';
}

/* 推荐位不烤字：竞品实测如此（推荐板块的封面没有标题文字）。 */
export function coverShowTitle(skill) {
  return (skill && skill.category) !== '精品推荐';
}

/* 封面用的案例图：按版式取前 N 条案例；不足则返回空（由门禁拦下，不许出半张封面）。 */
export function coverTilesFor(skill) {
  const need = COVER_LAYOUT_TILES[coverLayoutOf(skill)] || 1;
  const cases = Array.isArray(skill && skill.cases) ? skill.cases : [];
  const tiles = cases.map(item => item && item.cover).filter(Boolean);
  return tiles.length >= need ? tiles.slice(0, need) : [];
}

/* 出图任务：只认"案例够用"的 skill。 */
export function coverJobsFor(skills) {
  const jobs = [];
  const blocked = [];
  for (const skill of skills || []) {
    const tiles = coverTilesFor(skill);
    if (!tiles.length) { blocked.push({ skillId: skill.id, need: COVER_LAYOUT_TILES[coverLayoutOf(skill)], have: (skill.cases || []).length }); continue; }
    const plan = getCoverPlan(skill.id);
    jobs.push({
      skillId: skill.id,
      layout: coverLayoutOf(skill),
      accent: (plan && plan.accent) || 'neutral',
      title: (plan && plan.title) || skill.name,
      /* 卡片底部遮罩上的副标题（竞品实测：标题下一行小字，一行截断） */
      subtitle: String(skill.summary || '').trim(),
      showTitle: coverShowTitle(skill),
      tiles,
    });
  }
  return { jobs, blocked };
}
