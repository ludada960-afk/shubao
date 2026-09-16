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

export const CREATIVE_NAV_GROUPS = Object.freeze([
  Object.freeze({
    id: 'commerce',
    label: '电商生图',
    eyebrow: 'Ecommerce imaging',
    description: '从商品素材出发，快速整理能上架、能转化的完整视觉。',
    icon: 'shopping-bag',
    board: 'image',
    primaryAction: { type: 'NAVIGATE', page: 'image-creation' },
    items: Object.freeze([
      Object.freeze({ id: 'commerce-suite', label: '商品套图', description: '主图、场景图、详情图一次规划', hint: '开始生成', icon: 'cards-three', motion: 'layers', skillId: 'image.product_suite' }),
      Object.freeze({ id: 'commerce-tryon', label: '万物上身', description: '把商品自然放入人物与真实场景', hint: '开始试穿', icon: 't-shirt', motion: 'tryon', skillId: 'image.try_on' }),
      /* 9-13 用户批注：左侧导航里已经有「无限画布」，这里再放一个「电商画布」是多余且定位错误
         （画布服务所有项目，不是只服务电商）→ 撤掉这个入口。 */
    ]),
  }),
  Object.freeze({
    id: 'video',
    label: '视频生成',
    eyebrow: 'Video generation',
    description: '把图片、视频和声音素材整理成可确认的创作过程。',
    icon: 'clapperboard',
    board: 'video',
    primaryAction: { type: 'NAVIGATE', page: 'video-creation' },
    items: Object.freeze([
      Object.freeze({ id: 'video-studio', label: '视频生成', description: '从素材、分镜到候选版本，进入视频工作台', hint: '开始生成', icon: 'film-strip', motion: 'film', skillId: 'video.smart' }),
    ]),
  }),
  Object.freeze({
    id: 'content',
    label: '小红书图文',
    eyebrow: 'Xiaohongshu creation',
    description: '把素材整理成适合发布的小红书图文和生活记录。',
    icon: 'notebook-pen',
    board: 'image',
    primaryAction: { type: 'NAVIGATE', page: 'image-creation' },
    items: Object.freeze([
      Object.freeze({ id: 'content-xhs', label: '种草图文', description: '封面、配图、标题、正文和标签一起生成', hint: '开始创作', icon: 'notebook', motion: 'pages', skillId: 'image.xhs_note' }),
      /* Plog 与种草共用同一个图文工作台（同一条 SSE 链路，只是发布形态不同），
         所以指向**同一条技能**：进去以后在工作台里切「生活碎片」即可，不必造第二条技能。 */
      Object.freeze({ id: 'content-plog', label: 'Plog 生活碎片', description: '把生活素材整理成有情绪的发布成品', hint: '整理碎片', icon: 'camera', motion: 'camera', skillId: 'image.xhs_note' }),
    ]),
  }),
  Object.freeze({
    id: 'visual',
    label: '自由创作',
    eyebrow: 'Open visual creation',
    description: '从一句想法或参考图开始，发展出可继续编辑的视觉。',
    icon: 'wand-sparkles',
    board: 'image',
    primaryAction: { type: 'NAVIGATE', page: 'image-creation' },
    items: Object.freeze([
      Object.freeze({ id: 'visual-free', label: '自由创作', description: '开放定义主体、场景、构图与画面语言', hint: '自由生成', icon: 'magic-wand', motion: 'magic', skillId: 'image.free' }),
      Object.freeze({ id: 'visual-poster', label: '海报设计', description: '先建立视觉焦点，再组织信息层级', hint: '设计海报', icon: 'shapes', motion: 'layout', skillId: 'image.poster' }),
      Object.freeze({ id: 'visual-social-cover', label: '社媒封面', description: '让主题在移动端缩略图中一眼可读', hint: '制作封面', icon: 'image-square', motion: 'cover', skillId: 'image.social_cover' }),
      Object.freeze({ id: 'visual-brand-kv', label: '品牌主视觉', description: '把品牌调性扩展成统一画面语言', hint: '建立主视觉', icon: 'presentation', motion: 'orbit', skillId: 'image.brand_kv' }),
    ]),
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

/* 技能 id → 它属于哪个领域（用来点亮左侧导航）。
   ⚠️ 这张表必须**与技能声明源对齐**：技能改名/下线时这里要跟着改，
      否则会出现"人在海报子页面、导航却点亮了自由创作"。test/media-skill-embed-0918 守着对齐。 */
const SKILL_GROUP = Object.freeze({
  'image.product_suite': 'commerce',
  'image.try_on': 'commerce',
  'video.smart': 'video',
  'image.xhs_note': 'content',
  'image.free': 'visual',
  'image.poster': 'visual',
  'image.social_cover': 'visual',
  'image.brand_kv': 'visual',
});

export function navigationGroupForSkill(skillId) {
  return SKILL_GROUP[String(skillId || '').trim()] || '';
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
  if (groupId === 'content') return state.mode === 'content' || state.page === 'plog';
  if (groupId === 'visual') return state.mode === 'visual';
  if (groupId === 'commerce') return state.mode === 'ecommerce' || ['ec-studio', 'ec-auto'].includes(state.page);
  return false;
}

