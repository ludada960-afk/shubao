const MODE_IDS = new Set(['ecommerce', 'video', 'content', 'visual']);

const DEFAULT_KINDS = {
  ecommerce: 'product-suite',
  video: 'video-workflow',
  content: 'content-set',
  visual: 'visual-skill',
};

export function creationNavigationContract() {
  return {
    primary: 'home',
    /* 用户 9-10: 视频入口与其余三个域一致, 落首页视频模块 (不再有独立 video-studio 页面入口) */
    video: { page: 'home', mode: 'video' },
    canvas: 'ec-canvas',
    works: { page: 'ec-canvas', tab: 'works' },
  };
}

export function isDirectCreationMode(mode) {
  return mode === 'content' || mode === 'visual';
}

export function normalizeShowcase({ mode = '', subMode = '', entry = {} } = {}) {
  const normalizedMode = MODE_IDS.has(mode) ? mode : 'content';
  const normalizedSubMode = typeof subMode === 'string' ? subMode.trim() : '';
  const fallbackKind = normalizedMode === 'content' && normalizedSubMode === 'plog'
    ? 'plog-set'
    : DEFAULT_KINDS[normalizedMode];
  const assets = Array.isArray(entry.assets)
    ? entry.assets.filter(asset => asset && (asset.src || asset.url))
    : [];

  return {
    id: String(entry.id || `${normalizedMode}-${normalizedSubMode || 'default'}`),
    mode: normalizedMode,
    subMode: normalizedSubMode,
    kind: String(entry.kind || fallbackKind),
    eyebrow: String(entry.eyebrow || '').trim(),
    title: String(entry.title || '').trim(),
    description: String(entry.description || '').trim(),
    outputLabel: String(entry.outputLabel || '').trim(),
    assets,
  };
}

