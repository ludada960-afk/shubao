export const CREATIVE_NAV_GROUPS = Object.freeze([
  Object.freeze({
    id: 'commerce',
    label: '电商视觉',
    eyebrow: 'Commerce visuals',
    description: '从商品素材出发，快速整理能上架、能转化的完整视觉。',
    icon: 'shopping-bag',
    primaryAction: { type: 'SET_MODE', mode: 'ecommerce' },
    items: Object.freeze([
      Object.freeze({ id: 'commerce-suite', label: '商品套图', description: '主图、场景图、详情图一次规划', icon: 'cards-three', motion: 'layers', action: { type: 'SET_MODE', mode: 'ecommerce' }, launch: { mode: 'ecommerce', recipeId: 'product_suite' } }),
      Object.freeze({ id: 'commerce-tryon', label: '万物上身', description: '把商品自然放入人物与真实场景', icon: 't-shirt', motion: 'tryon', action: { type: 'SET_MODE', mode: 'ecommerce' }, launch: { mode: 'ecommerce', recipeId: 'anything_tryon' } }),
      Object.freeze({ id: 'commerce-canvas', label: '电商画布', description: '继续编辑、编排与导出成品', icon: 'frame-corners', motion: 'canvas', action: { type: 'OPEN_CANVAS' } }),
    ]),
  }),
  Object.freeze({
    id: 'video',
    label: '视频创作',
    eyebrow: 'Video creation',
    description: '把图片、视频和声音素材整理成可确认的创作过程。',
    icon: 'clapperboard',
    primaryAction: { type: 'NAVIGATE', page: 'video-studio' },
    items: Object.freeze([
      Object.freeze({ id: 'video-studio', label: '视频创作', description: '从素材、分镜到候选版本，进入视频工作台', icon: 'film-strip', motion: 'film', action: { type: 'NAVIGATE', page: 'video-studio' } }),
    ]),
  }),
  Object.freeze({
    id: 'content',
    label: '内容发布',
    eyebrow: 'Content publishing',
    description: '把素材整理成适合发布的小红书图文和生活记录。',
    icon: 'notebook-pen',
    primaryAction: { type: 'SET_MODE', mode: 'content' },
    items: Object.freeze([
      Object.freeze({ id: 'content-xhs', label: '小红书图文', description: '封面、配图、标题、正文和标签一起生成', icon: 'notebook', motion: 'pages', action: { type: 'SET_MODE', mode: 'content' }, launch: { mode: 'content', subMode: 'content' } }),
      Object.freeze({ id: 'content-plog', label: 'Plog 生活记录', description: '把生活素材整理成有情绪的发布成品', icon: 'camera', motion: 'camera', action: { type: 'SET_MODE', mode: 'content' }, launch: { mode: 'content', subMode: 'plog' } }),
    ]),
  }),
  Object.freeze({
    id: 'visual',
    label: '自由视觉',
    eyebrow: 'Visual creation',
    description: '从一句想法或参考图开始，发展出可继续编辑的视觉。',
    icon: 'wand-sparkles',
    primaryAction: { type: 'SET_MODE', mode: 'visual' },
    items: Object.freeze([
      Object.freeze({ id: 'visual-free', label: '自由创作', description: '开放定义主体、场景、构图与画面语言', icon: 'magic-wand', motion: 'magic', action: { type: 'SET_MODE', mode: 'visual' }, launch: { mode: 'visual', skillId: 'free' } }),
      Object.freeze({ id: 'visual-poster', label: '海报设计', description: '先建立视觉焦点，再组织信息层级', icon: 'shapes', motion: 'layout', action: { type: 'SET_MODE', mode: 'visual' }, launch: { mode: 'visual', skillId: 'poster' } }),
      Object.freeze({ id: 'visual-social-cover', label: '社媒封面', description: '让主题在移动端缩略图中一眼可读', icon: 'image-square', motion: 'cover', action: { type: 'SET_MODE', mode: 'visual' }, launch: { mode: 'visual', skillId: 'social-cover' } }),
      Object.freeze({ id: 'visual-brand-kv', label: '品牌主视觉', description: '把品牌调性扩展成统一画面语言', icon: 'presentation', motion: 'orbit', action: { type: 'SET_MODE', mode: 'visual' }, launch: { mode: 'visual', skillId: 'brand-kv' } }),
    ]),
  }),
  Object.freeze({
    id: 'workspace',
    label: '工作台',
    eyebrow: 'Workspace',
    description: '集中管理你的画布、作品和正在继续的创作。',
    icon: 'layout-dashboard',
    primaryAction: { type: 'OPEN_CANVAS' },
    items: Object.freeze([
      Object.freeze({ id: 'canvas', label: '无限画布', description: '把生成结果继续编排成完整视觉', icon: 'stack-simple', motion: 'workspace', action: { type: 'OPEN_CANVAS' } }),
      Object.freeze({ id: 'works', label: '我的作品', description: '查看已保存的创作和可恢复项目', icon: 'folder-open', motion: 'archive', action: { type: 'OPEN_CANVAS', tab: 'works' } }),
    ]),
  }),
]);

export function navigationGroupById(groupId) {
  return CREATIVE_NAV_GROUPS.find(group => group.id === groupId) || null;
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
