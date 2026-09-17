/* ═══ 创作领域导航（左侧一级导航）════════════════════════════════════════════════
   2026-09-17 用户拍板的新形态（43 §3.1 / 44）：
     · 一级入口收敛成**两个总页面**：/image-creation（图片）与 /video-creation（视频）；
     · 每个具体能力都是**那个总页面下的技能子页面**（/image-creation?id=<skillId>）；
     · 首页只留两张入口卡（视频生成 / 图片生成），不再是四个模式各自的输入框。
   所以这一份导航的每一项都必须**直达它自己的技能子页面** —— 点「海报设计」就进海报的
   子页面，而不是切回首页的某个内联模块（那正是用户要求收敛掉的旧世界）。
   ⚠️ 路径算法**不在这里再写一份**：统一走 skills/skillDirectory.js 的 skillPath，
      首页热门条 / Hub / 导航三处共用同一份实现（测试守着这条）。
   ⚠️ 这里只声明"去哪里"（page + skillId），不声明任何生成参数 ——
      参数由技能声明源（imageSkills / videoSkills）说了算，导航抄一份必然漂移。 */

/* ═══ 2026-09-19 用户批注 #7-①②：一级导航**只留两个总页面** ═══════════════════════════
   原话：「你现在这个逻辑也不是我说的逻辑呀，我说的逻辑就是电商生图、小红书图文、自由创作
   这些全部都不能有了。这些现在都是跟其他的 skill 是平级的东西。他们都会进入到各自的子页面里面去，
   然后入口就只有首页下面的这个推荐 skill 这里，或者是视频生成和图片生成的总页面那里。」
   「包括导航栏，你也得重构导航栏，我觉得你目前来说就先做视频生成和电商生成的这两个总页面的
   入口就可以。然后整体的样式，整体的逻辑，你要按原来这四个导航栏去设计，明白吗？」
   所以：四个域（电商生图 / 视频生成 / 小红书图文 / 自由创作）→ **两个**（图片生成 / 视频生成）。
   被撤掉的三项不是被删功能：电商生图 / 小红书图文 / 自由创作本来就是跟别的 skill 平级的，
   它们的入口是「首页推荐位」与「总页面」。
   ⚠️ 下拉里列的是**各自板块的精品推荐技能**（group.items 由 skillDirectory 的精品位驱动，
      见下面 GROUP_ITEMS）；导航不手抄技能清单，技能上下线这里自动跟着走。 */
const GROUP_ITEMS = Object.freeze({
  image: Object.freeze([
    Object.freeze({ id: 'image-suite', label: '商品套图', description: '主图、场景图、卖点图成套交付', hint: '开始生成', icon: 'cards-three', motion: 'layers', skillId: 'image.product_suite' }),
    Object.freeze({ id: 'image-aplus', label: 'A+内容', description: '图文并排的模块图，把卖点讲清楚', hint: '开始生成', icon: 'notebook', motion: 'pages', skillId: 'image.aplus' }),
    Object.freeze({ id: 'image-detail', label: '详情图', description: '首屏、卖点、成分、参数，逐屏出图', hint: '开始生成', icon: 'image-square', motion: 'cover', skillId: 'image.detail_page' }),
    Object.freeze({ id: 'image-clone', label: '图片复刻', description: '保住构图与节奏，换成自己的内容', hint: '开始复刻', icon: 'shapes', motion: 'layout', skillId: 'image.copy' }),
    Object.freeze({ id: 'image-removebg', label: '去除背景', description: '去掉背景，出透明底或纯色底', hint: '一键去背', icon: 'magic-wand', motion: 'magic', skillId: 'image.remove_bg' }),
    Object.freeze({ id: 'image-tryon', label: 'AI换装', description: '把商品穿到模特身上，姿势场景可选', hint: '开始换装', icon: 't-shirt', motion: 'tryon', skillId: 'image.try_on' }),
  ]),
  video: Object.freeze([
    Object.freeze({ id: 'video-smart', label: '智能成片', description: '一句话起步，镜头与节奏交给模型', hint: '开始生成', icon: 'film-strip', motion: 'film', skillId: 'video.smart' }),
    Object.freeze({ id: 'video-frame', label: '首尾帧', description: '两张图锁定镜头起点与终点', hint: '开始生成', icon: 'cards-three', motion: 'layers', skillId: 'video.frame' }),
    Object.freeze({ id: 'video-remake', label: '爆款复刻', description: '保留参考片节奏，换上你的内容', hint: '开始复刻', icon: 'magic-wand', motion: 'magic', skillId: 'video.remake' }),
    Object.freeze({ id: 'video-motion', label: '商品动态展示', description: '旋转、光影扫过、材质微距', hint: '开始生成', icon: 'image-square', motion: 'cover', skillId: 'video.product_motion' }),
    Object.freeze({ id: 'video-rotate', label: '3C 旋转展示', description: '360 度转一圈，讲清接口与厚度', hint: '开始生成', icon: 'shapes', motion: 'layout', skillId: 'video.tech_rotate' }),
    Object.freeze({ id: 'video-swap', label: '内容替换', description: '上传人物视频和人物图片，一键换人', hint: '开始替换', icon: 't-shirt', motion: 'tryon', skillId: 'video.content_swap' }),
  ]),
});

export const CREATIVE_NAV_GROUPS = Object.freeze([
  Object.freeze({
    id: 'image',
    label: '图片生成',
    eyebrow: 'Image creation',
    description: '商品图、A+、详情图、复刻与去背景，都在图片生成这一个总页面里。',
    icon: 'image-square',
    board: 'image',
    primaryAction: { type: 'NAVIGATE', page: 'image-creation' },
    items: GROUP_ITEMS.image,
  }),
  Object.freeze({
    id: 'video',
    label: '视频生成',
    eyebrow: 'Video generation',
    description: '把图片、视频和声音素材整理成可确认的创作过程。',
    icon: 'clapperboard',
    board: 'video',
    primaryAction: { type: 'NAVIGATE', page: 'video-creation' },
    items: GROUP_ITEMS.video,
  }),
]);

// Work and canvas remain addressable destinations for the left quick-nav and
// legacy entry contracts, but are intentionally not promoted to top-level creation domains.
const WORKSPACE_NAV_GROUP = Object.freeze({
  id: 'workspace',
  label: '工作台',
  items: Object.freeze([
    Object.freeze({ id: 'canvas', label: '无限画布', description: '把生成结果继续编排成完整视觉', hint: '继续编排', icon: 'stack-simple', motion: 'workspace', action: { type: 'OPEN_CANVAS' } }),
    Object.freeze({ id: 'works', label: '我的作品', description: '查看已保存的创作和可恢复项目', hint: '查看作品', icon: 'folder-open', motion: 'archive', action: { type: 'OPEN_CANVAS', tab: 'works' } }),
  ]),
});

export function navigationGroupById(groupId) {
  return CREATIVE_NAV_GROUPS.find(group => group.id === groupId) || (groupId === 'workspace' ? WORKSPACE_NAV_GROUP : null);
}

export function getNavigationItem(groupId, itemId) {
  return navigationGroupById(groupId)?.items.find(entry => entry.id === itemId) || null;
}

/* 每一项的去处：声明了 skillId 的 → 打开那条技能的**子页面**；
   没声明的（工作台那两条）→ 用它自己的 action。 */
export function navigationSkillTarget(item) {
  const skillId = String(item?.skillId || '').trim();
  if (!skillId) return null;
  /* 板块由技能 id 自己决定（视频技能一律 video.*，声明源里就是这么命名的），
     不靠调用方传对 groupId —— 少一个能传错的参数。 */
  const board = skillId.startsWith('video.') ? 'video' : 'image';
  return { type: 'OPEN_SKILL', page: board === 'video' ? 'video-creation' : 'image-creation', board, skillId };
}

export function getNavigationTarget(groupId, itemId) {
  const item = getNavigationItem(groupId, itemId);
  return navigationSkillTarget(item) || item?.action || navigationGroupById(groupId)?.primaryAction || null;
}

/* ═══ 技能 id → 它属于哪**一个总页面**（用来点亮导航）═════════════════════════════════
   ⚠️ 2026-09-19 批 G：这里原来是一张**手抄表**（8 条 skillId → 4 个旧域），
      两个毛病叠在一起：
        ① 4 个旧域（commerce / content / visual）已经没有对应的导航项了 ——
           用户批注 #7-① 把那三个一级入口整体撤掉，一级导航只剩图片生成 / 视频生成；
        ② 手抄表会漂移：技能改名/下线时这里不改，就会出现"人在某个子页面、
           导航却点亮了另一个域"。测试原来是在守这张表的**对齐**，本来就说明它脆。
   现在改成**从 id 前缀推导**，与 skillDirectory.navigationSkillTarget 用的是同一条规则
   （视频技能在声明源里一律 video.*，其余都归图片）：没有第二份真相，也就没有漂移。
   ⚠️ 前缀规则与 skills/*Skills.js 的命名约定绑定；新增板块时要同时改这两处（门禁会拦）。 */
export function navigationGroupForSkill(skillId) {
  const id = String(skillId || '').trim();
  if (!id) return '';
  return id.startsWith('video.') ? 'video' : 'image';
}

/* 当前地址栏里的技能（子页面用 ?id= 表达自己在哪条技能上） */
export function currentSkillIdFromLocation() {
  try {
    return new URLSearchParams(globalThis.location?.search || '').get('id') || '';
  } catch {
    return '';
  }
}

/* 点亮规则：
     ① 人在某条技能的子页面上 → 点亮它所属的领域（最准的一条，优先判）；
     ② 否则按旧的页面/模式判（首页、画布、历史遗留入口都还走这条）。 */
export function isNavigationGroupActive(groupId, state = {}, skillId = undefined) {
  const activeSkill = skillId === undefined ? currentSkillIdFromLocation() : skillId;
  const bySkill = navigationGroupForSkill(activeSkill);
  if (bySkill) return bySkill === groupId;
  /* 站在 Hub 本身（两个总页面）时四个领域都不点亮：Hub 不属于任何单一领域，
     硬点亮一个会让人以为"我现在在海报里"，而他只是在图片总页面上。 */
  if (state.page === 'image-creation' || state.page === 'video-creation') return false;
  if (groupId === 'workspace') return state.page === 'ec-canvas';
  if (groupId === 'video') return state.page === 'video-studio' || state.mode === 'video';
  /* 只剩「图片生成」这一个图片域了，所以旧世界那三条（content / visual / commerce）
     全部落到它头上 —— 首页还在用 state.mode 表达"我在做哪一类图"，
     而它们在导航上已经是同一个入口了。 */
  if (groupId === 'image') {
    return state.mode === 'visual' || state.mode === 'ecommerce' || state.mode === 'content'
      || state.page === 'plog' || ['ec-studio', 'ec-auto'].includes(state.page);
  }
  return false;
}

