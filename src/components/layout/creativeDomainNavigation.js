export const CREATIVE_NAV_GROUPS = Object.freeze([
  Object.freeze({
    id: 'commerce',
    label: '电商生图',
    eyebrow: 'Ecommerce imaging',
    description: '从商品素材出发，快速整理能上架、能转化的完整视觉。',
    icon: 'shopping-bag',
    primaryAction: { type: 'SET_MODE', mode: 'ecommerce' },
    items: Object.freeze([
      Object.freeze({ id: 'commerce-suite', label: '商品套图', description: '主图、场景图、详情图一次规划', hint: '开始生成', icon: 'cards-three', motion: 'layers', action: { type: 'SET_MODE', mode: 'ecommerce' }, launch: { mode: 'ecommerce', recipeId: 'product_suite' } }),
      Object.freeze({ id: 'commerce-tryon', label: '万物上身', description: '把商品自然放入人物与真实场景', hint: '开始试穿', icon: 't-shirt', motion: 'tryon', action: { type: 'SET_MODE', mode: 'ecommerce' }, launch: { mode: 'ecommerce', recipeId: 'anything_tryon' } }),
      Object.freeze({ id: 'commerce-canvas', label: '电商画布', description: '继续编辑、编排与导出成品', hint: '打开画布', icon: 'frame-corners', motion: 'canvas', action: { type: 'OPEN_CANVAS' } }),
    ]),
  }),
  Object.freeze({
    id: 'video',
    label: '视频生成',
    eyebrow: 'Video generation',
    description: '把图片、视频和声音素材整理成可确认的创作过程。',
    icon: 'clapperboard',
    primaryAction: { type: 'NAVIGATE', page: 'video-studio' },
    items: Object.freeze([
      Object.freeze({ id: 'video-studio', label: '视频生成', description: '从素材、分镜到候选版本，进入视频工作台', hint: '开始生成', icon: 'film-strip', motion: 'film', action: { type: 'NAVIGATE', page: 'video-studio' } }),
    ]),
  }),
  Object.freeze({
    id: 'content',
    label: '小红书图文',
    eyebrow: 'Xiaohongshu creation',
    description: '把素材整理成适合发布的小红书图文和生活记录。',
    icon: 'notebook-pen',
    primaryAction: { type: 'SET_MODE', mode: 'content' },
    items: Object.freeze([
      Object.freeze({ id: 'content-xhs', label: '种草图文', description: '封面、配图、标题、正文和标签一起生成', hint: '开始创作', icon: 'notebook', motion: 'pages', action: { type: 'SET_MODE', mode: 'content' }, launch: { mode: 'content', subMode: 'content' } }),
      Object.freeze({ id: 'content-plog', label: 'Plog 生活碎片', description: '把生活素材整理成有情绪的发布成品', hint: '整理碎片', icon: 'camera', motion: 'camera', action: { type: 'SET_MODE', mode: 'content' }, launch: { mode: 'content', subMode: 'plog' } }),
    ]),
  }),
  Object.freeze({
    id: 'visual',
    label: '自由创作',
    eyebrow: 'Open visual creation',
    description: '从一句想法或参考图开始，发展出可继续编辑的视觉。',
    icon: 'wand-sparkles',
    primaryAction: { type: 'SET_MODE', mode: 'visual' },
    items: Object.freeze([
      Object.freeze({ id: 'visual-free', label: '自由创作', description: '开放定义主体、场景、构图与画面语言', hint: '自由生成', icon: 'magic-wand', motion: 'magic', action: { type: 'SET_MODE', mode: 'visual' }, launch: { mode: 'visual', skillId: 'free' } }),
      Object.freeze({ id: 'visual-poster', label: '海报设计', description: '先建立视觉焦点，再组织信息层级', hint: '设计海报', icon: 'shapes', motion: 'layout', action: { type: 'SET_MODE', mode: 'visual' }, launch: { mode: 'visual', skillId: 'poster' } }),
      Object.freeze({ id: 'visual-social-cover', label: '社媒封面', description: '让主题在移动端缩略图中一眼可读', hint: '制作封面', icon: 'image-square', motion: 'cover', action: { type: 'SET_MODE', mode: 'visual' }, launch: { mode: 'visual', skillId: 'social-cover' } }),
      Object.freeze({ id: 'visual-brand-kv', label: '品牌主视觉', description: '把品牌调性扩展成统一画面语言', hint: '建立主视觉', icon: 'presentation', motion: 'orbit', action: { type: 'SET_MODE', mode: 'visual' }, launch: { mode: 'visual', skillId: 'brand-kv' } }),
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

export function getNavigationTarget(groupId, itemId) {
  const item = getNavigationItem(groupId, itemId);
  return item?.action || navigationGroupById(groupId)?.primaryAction || null;
}

export function getNavigationItem(groupId, itemId) {
  return navigationGroupById(groupId)?.items.find(entry => entry.id === itemId) || null;
}

export function isNavigationGroupActive(groupId, state = {}) {
  if (groupId === 'workspace') return state.page === 'ec-canvas';
  if (groupId === 'video') return state.page === 'video-studio' || state.mode === 'video';
  if (groupId === 'content') return state.mode === 'content' || state.page === 'plog';
  if (groupId === 'visual') return state.mode === 'visual';
  if (groupId === 'commerce') return state.mode === 'ecommerce' || ['ec-studio', 'ec-auto'].includes(state.page);
  return false;
}
