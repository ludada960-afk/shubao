// Material Watermark Model (2026-09-08)
// 核心原则：水印应用到素材（图片/视频），不是画布
// 分离：图片水印模型 + 视频水印模型
// 导出：默认配置、归一化函数、平铺生成函数

// ===== 图片水印默认配置 =====
export const DEFAULT_IMAGE_WATERMARK = Object.freeze({
  enabled: false,
  type: 'text', // 'text' | 'logo'
  text: 'SHUBAO AI',
  fontFamily: 'system-ui',
  fontSize: 24,
  fontWeight: 600,
  color: '#111827',
  opacity: 0.3,
  rotation: -15,
  position: 'bottom-right',
  offsetX: 20,
  offsetY: 20,
  tilePattern: 'none', // 'none' | 'grid' | 'diagonal'
  tileGapX: 100,
  tileGapY: 100,
  logoUrl: '',
  logoOpacity: 0.5,
  logoScale: 1,
});

// ===== 视频水印默认配置 =====
export const DEFAULT_VIDEO_WATERMARK = Object.freeze({
  enabled: false,
  type: 'text', // 'text' | 'logo' | 'dynamic'
  text: 'SHUBAO AI',
  fontFamily: 'system-ui',
  fontSize: 28,
  fontWeight: 600,
  color: '#ffffff',
  opacity: 0.4,
  rotation: 0,
  position: 'bottom-right',
  offsetX: 30,
  offsetY: 30,
  dynamic: {
    enabled: false,
    mode: 'scroll', // 'scroll' | 'vertical' | 'diagonal' | 'bounce' | 'fade' | 'pulse'
    speed: 1,
    direction: 'horizontal', // 'horizontal' | 'vertical' | 'diagonal'
    text: 'SHUBAO AI',
  },
  logoUrl: '',
  logoOpacity: 0.5,
  logoScale: 1,
});

// ===== 水印位置预设 =====
export const WATERMARK_POSITIONS = Object.freeze([
  { value: 'top-left', label: '左上', icon: '↖' },
  { value: 'top-center', label: '上中', icon: '↑' },
  { value: 'top-right', label: '右上', icon: '↗' },
  { value: 'center-left', label: '左中', icon: '←' },
  { value: 'center', label: '正中', icon: '⊙' },
  { value: 'center-right', label: '右中', icon: '→' },
  { value: 'bottom-left', label: '左下', icon: '↙' },
  { value: 'bottom-center', label: '下中', icon: '↓' },
  { value: 'bottom-right', label: '右下', icon: '↘' },
]);

// ===== 平铺模式预设 =====
export const TILE_PATTERNS = Object.freeze([
  { value: 'none', label: '单个' },
  { value: 'grid', label: '网格平铺' },
  { value: 'diagonal', label: '对角线平铺' },
]);

// ===== 动态水印模式预设 =====
export const DYNAMIC_WATERMARK_MODES = Object.freeze([
  { value: 'scroll', label: '横向滚动' },
  { value: 'vertical', label: '纵向滚动' },
  { value: 'diagonal', label: '对角线滚动' },
  { value: 'bounce', label: '弹跳' },
  { value: 'fade', label: '淡入淡出' },
  { value: 'pulse', label: '脉冲闪烁' },
]);

// ===== 辅助函数 =====
function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ===== 图片水印归一化 =====
export function normalizeImageWatermark(value) {
  const v = value && typeof value === 'object' ? value : {};
  const text = typeof v.text === 'string' && v.text.trim()
    ? v.text.trim().slice(0, 80)
    : DEFAULT_IMAGE_WATERMARK.text;
  return {
    enabled: v.enabled === true,
    type: ['text', 'logo'].includes(v.type) ? v.type : DEFAULT_IMAGE_WATERMARK.type,
    text,
    fontFamily: v.fontFamily || DEFAULT_IMAGE_WATERMARK.fontFamily,
    fontSize: Math.round(clampNumber(v.fontSize, DEFAULT_IMAGE_WATERMARK.fontSize, 8, 120)),
    fontWeight: [400, 500, 600, 700, 800, 900].includes(Number(v.fontWeight)) ? Number(v.fontWeight) : DEFAULT_IMAGE_WATERMARK.fontWeight,
    color: typeof v.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.color) ? v.color : DEFAULT_IMAGE_WATERMARK.color,
    opacity: clampNumber(v.opacity, DEFAULT_IMAGE_WATERMARK.opacity, 0, 1),
    rotation: clampNumber(v.rotation, DEFAULT_IMAGE_WATERMARK.rotation, -180, 180),
    position: WATERMARK_POSITIONS.some(p => p.value === v.position) ? v.position : DEFAULT_IMAGE_WATERMARK.position,
    offsetX: Math.round(clampNumber(v.offsetX, DEFAULT_IMAGE_WATERMARK.offsetX, 0, 500)),
    offsetY: Math.round(clampNumber(v.offsetY, DEFAULT_IMAGE_WATERMARK.offsetY, 0, 500)),
    tilePattern: ['none', 'grid', 'diagonal'].includes(v.tilePattern) ? v.tilePattern : DEFAULT_IMAGE_WATERMARK.tilePattern,
    tileGapX: Math.round(clampNumber(v.tileGapX, DEFAULT_IMAGE_WATERMARK.tileGapX, 20, 1000)),
    tileGapY: Math.round(clampNumber(v.tileGapY, DEFAULT_IMAGE_WATERMARK.tileGapY, 20, 1000)),
    logoUrl: typeof v.logoUrl === 'string' ? v.logoUrl.trim() : '',
    logoOpacity: clampNumber(v.logoOpacity, DEFAULT_IMAGE_WATERMARK.logoOpacity, 0, 1),
    logoScale: clampNumber(v.logoScale, DEFAULT_IMAGE_WATERMARK.logoScale, 0.1, 5),
  };
}

// ===== 视频水印归一化 =====
export function normalizeVideoWatermark(value) {
  const v = value && typeof value === 'object' ? value : {};
  const text = typeof v.text === 'string' && v.text.trim()
    ? v.text.trim().slice(0, 80)
    : DEFAULT_VIDEO_WATERMARK.text;
  
  const dynamic = v.dynamic && typeof v.dynamic === 'object' ? v.dynamic : {};
  
  return {
    enabled: v.enabled === true,
    type: ['text', 'logo', 'dynamic'].includes(v.type) ? v.type : DEFAULT_VIDEO_WATERMARK.type,
    text,
    fontFamily: v.fontFamily || DEFAULT_VIDEO_WATERMARK.fontFamily,
    fontSize: Math.round(clampNumber(v.fontSize, DEFAULT_VIDEO_WATERMARK.fontSize, 12, 120)),
    fontWeight: [400, 500, 600, 700, 800, 900].includes(v.fontWeight) ? v.fontWeight : DEFAULT_VIDEO_WATERMARK.fontWeight,
    color: typeof v.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.color) ? v.color : DEFAULT_VIDEO_WATERMARK.color,
    opacity: clampNumber(v.opacity, DEFAULT_VIDEO_WATERMARK.opacity, 0, 1),
    rotation: clampNumber(v.rotation, DEFAULT_VIDEO_WATERMARK.rotation, -180, 180),
    position: WATERMARK_POSITIONS.some(p => p.value === v.position) ? v.position : DEFAULT_VIDEO_WATERMARK.position,
    offsetX: Math.round(clampNumber(v.offsetX, DEFAULT_VIDEO_WATERMARK.offsetX, 0, 500)),
    offsetY: Math.round(clampNumber(v.offsetY, DEFAULT_VIDEO_WATERMARK.offsetY, 0, 500)),
    dynamic: {
      enabled: dynamic.enabled === true,
      mode: ['scroll', 'vertical', 'diagonal', 'bounce', 'fade', 'pulse'].includes(dynamic.mode) ? dynamic.mode : DEFAULT_VIDEO_WATERMARK.dynamic.mode,
      speed: clampNumber(dynamic.speed, DEFAULT_VIDEO_WATERMARK.dynamic.speed, 0.1, 10),
      direction: ['horizontal', 'vertical', 'diagonal'].includes(dynamic.direction) ? dynamic.direction : DEFAULT_VIDEO_WATERMARK.dynamic.direction,
      text: typeof dynamic.text === 'string' && dynamic.text.trim() ? dynamic.text.trim().slice(0, 80) : DEFAULT_VIDEO_WATERMARK.dynamic.text,
    },
    logoUrl: typeof v.logoUrl === 'string' ? v.logoUrl.trim() : '',
    logoOpacity: clampNumber(v.logoOpacity, DEFAULT_VIDEO_WATERMARK.logoOpacity, 0, 1),
    logoScale: clampNumber(v.logoScale, DEFAULT_VIDEO_WATERMARK.logoScale, 0.1, 5),
  };
}

// ===== 兼容性导出（旧接口） =====
export const CANVAS_WATERMARK_DEFAULT_TEXT = 'AI生成 · 薯包AI';

export const CANVAS_WATERMARK_DEFAULTS = Object.freeze({
  enabled: false,
  text: 'AI生成 · 薯包AI',
  opacity: 0.16,
  size: 15,
  rotation: -24,
  gapX: 260,
  gapY: 160,
});

export function normalizeCanvasWatermark(value) {
  const v = value && typeof value === 'object' ? value : {};
  const text = typeof v.text === 'string' && v.text.trim()
    ? v.text.trim().slice(0, 40)
    : CANVAS_WATERMARK_DEFAULTS.text;
  return {
    enabled: v.enabled === true,
    text,
    opacity: clampNumber(v.opacity, CANVAS_WATERMARK_DEFAULTS.opacity, 0.04, 0.6),
    size: Math.round(clampNumber(v.size, CANVAS_WATERMARK_DEFAULTS.size, 10, 48)),
    rotation: Math.round(clampNumber(v.rotation, CANVAS_WATERMARK_DEFAULTS.rotation, -90, 90)),
    gapX: Math.round(clampNumber(v.gapX, CANVAS_WATERMARK_DEFAULTS.gapX, 90, 520)),
    gapY: Math.round(clampNumber(v.gapY, CANVAS_WATERMARK_DEFAULTS.gapY, 70, 520)),
  };
}

// 计算平铺水印瓦片（兼容旧接口）
export function buildCanvasWatermarkTiles(watermark, viewport = { width: 1600, height: 900 }) {
  const w = normalizeCanvasWatermark(watermark);
  if (!w.enabled) return [];
  const width = Math.max(1, Number(viewport.width) || 0);
  const height = Math.max(1, Number(viewport.height) || 0);
  const gapX = Math.max(1, w.gapX);
  const gapY = Math.max(1, w.gapY);
  const cols = Math.ceil(width / gapX) + 1;
  const rows = Math.ceil(height / gapY) + 1;
  const tiles = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      tiles.push({
        id: `wm-${row}-${col}`,
        x: col * gapX + (row % 2 ? gapX / 2 : 0),
        y: row * gapY,
      });
    }
  }
  return tiles;
}

// ===== 新增：计算素材水印平铺瓦片（支持网格/对角线） =====
export function buildImageWatermarkTiles(watermark, viewport = { width: 1600, height: 900 }) {
  const w = normalizeImageWatermark(watermark);
  if (!w.enabled) return [];
  
  const width = Math.max(1, Number(viewport.width) || 0);
  const height = Math.max(1, Number(viewport.height) || 0);
  
  if (w.tilePattern === 'none') {
    // 单个水印，根据位置计算位置
    const { x, y } = calculateWatermarkPosition(w, width, height);
    return [{ id: 'wm-single', x, y }];
  }
  
  const gapX = Math.max(1, w.tileGapX);
  const gapY = Math.max(1, w.tileGapY);
  const cols = Math.ceil(width / gapX) + 1;
  const rows = Math.ceil(height / gapY) + 1;
  const tiles = [];
  
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      let x = col * gapX;
      let y = row * gapY;
      
      if (w.tilePattern === 'diagonal') {
        // 对角线模式：奇数行偏移半个间距
        x += (row % 2) * (gapX / 2);
      }
      
      tiles.push({
        id: `wm-${row}-${col}`,
        x,
        y,
      });
    }
  }
  return tiles;
}

// 计算单个水印的位置
function calculateWatermarkPosition(w, width, height) {
  const offsetX = w.offsetX || 0;
  const offsetY = w.offsetY || 0;
  const fontSize = w.fontSize || 24;
  const estimatedWidth = (w.text?.length || 8) * fontSize * 0.6;
  const estimatedHeight = fontSize * 1.2;
  
  let x, y;
  switch (w.position) {
    case 'top-left':
      x = offsetX;
      y = offsetY;
      break;
    case 'top-center':
      x = width / 2 - estimatedWidth / 2;
      y = offsetY;
      break;
    case 'top-right':
      x = width - estimatedWidth - offsetX;
      y = offsetY;
      break;
    case 'center-left':
      x = offsetX;
      y = height / 2 - estimatedHeight / 2;
      break;
    case 'center':
      x = width / 2 - estimatedWidth / 2;
      y = height / 2 - estimatedHeight / 2;
      break;
    case 'center-right':
      x = width - estimatedWidth - offsetX;
      y = height / 2 - estimatedHeight / 2;
      break;
    case 'bottom-left':
      x = offsetX;
      y = height - estimatedHeight - offsetY;
      break;
    case 'bottom-center':
      x = width / 2 - estimatedWidth / 2;
      y = height - estimatedHeight - offsetY;
      break;
    case 'bottom-right':
    default:
      x = width - estimatedWidth - offsetX;
      y = height - estimatedHeight - offsetY;
      break;
  }
  return { x: Math.max(0, x), y: Math.max(0, y) };
}

// 计算视频水印平铺瓦片
export function buildVideoWatermarkTiles(watermark, viewport = { width: 1920, height: 1080 }) {
  const w = normalizeVideoWatermark(watermark);
  if (!w.enabled) return [];
  
  // 视频水印暂时只支持单个位置（视频水印通常不平铺）
  const { x, y } = calculateVideoWatermarkPosition(w, viewport.width, viewport.height);
  return [{ id: 'wm-video-single', x, y }];
}

function calculateVideoWatermarkPosition(w, width, height) {
  const offsetX = w.offsetX || 0;
  const offsetY = w.offsetY || 0;
  const fontSize = w.fontSize || 28;
  const estimatedWidth = (w.text?.length || 8) * fontSize * 0.6;
  const estimatedHeight = fontSize * 1.2;
  
  let x, y;
  switch (w.position) {
    case 'top-left':
      x = offsetX;
      y = offsetY;
      break;
    case 'top-center':
      x = width / 2 - estimatedWidth / 2;
      y = offsetY;
      break;
    case 'top-right':
      x = width - estimatedWidth - offsetX;
      y = offsetY;
      break;
    case 'center-left':
      x = offsetX;
      y = height / 2 - estimatedHeight / 2;
      break;
    case 'center':
      x = width / 2 - estimatedWidth / 2;
      y = height / 2 - estimatedHeight / 2;
      break;
    case 'center-right':
      x = width - estimatedWidth - offsetX;
      y = height / 2 - estimatedHeight / 2;
      break;
    case 'bottom-left':
      x = offsetX;
      y = height - estimatedHeight - offsetY;
      break;
    case 'bottom-center':
      x = width / 2 - estimatedWidth / 2;
      y = height - estimatedHeight - offsetY;
      break;
    case 'bottom-right':
    default:
      x = width - estimatedWidth - offsetX;
      y = height - estimatedHeight - offsetY;
      break;
  }
  return { x: Math.max(0, x), y: Math.max(0, y) };
}