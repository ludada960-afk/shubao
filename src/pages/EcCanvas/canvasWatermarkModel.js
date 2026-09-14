// ── §18 色值迁移例外声明（2026-09-14 本批）─────────────────────────────────
// 本文件**有意不参与** §18「硬编码色值 → token」迁移：
//   这里的 color / strokeColor 是**水印本身的颜色**，会随作品导出**写进图片像素**，
//   属于用户内容（content），不是界面主题色（chrome）。
//   若换成 var(--sb-*) 再遇到主题切换，水印颜色会随主题漂移 —— 那是改产品语义。
// 与 scripts/design-ratchet.mjs 的 DATA_FILES 同理：受棘轮基线约束（只降不升），
// 但语义上不属于 token 迁移对象。日后若要收编，须独立裁定并附像素级依据。
// ═══════════════════════════════════════════════════════════════════════════
// 素材水印模型 (2026-09-08 重构 · 统一模型)
// 核心原则：
//   1. 水印应用到素材（图片/视频），不是画布
//   2. 只有一个水印面板；图片/视频只是同一模型的两套默认值与动态能力
//   3. 位置用「相对素材的百分比」表达 —— 预览与素材所见即所得
//   4. 字号/Logo 尺寸按素材宽度比例换算，保证不同尺寸素材上视觉一致
// ═══════════════════════════════════════════════════════════════════════════

/** 统一水印默认值（图片与视频共用字段，动态水印为视频专属） */
export const DEFAULT_WATERMARK = Object.freeze({
  enabled: false,
  type: 'text',                 // 'text' 文字水印 | 'logo' 图片水印
  text: '薯包AI',
  fontFamily: 'system-ui',
  fontSize: 64,                 // 以素材宽度 1000px 为基准的字号（渲染时按宽度换算）
  fontWeight: 600,
  color: '#111827',
  strokeColor: '#ffffff',
  strokeOpacity: 0,             // 0 表示不描边
  opacity: 0.5,
  rotation: 0,                  // -180..180 度
  xPercent: 50,                 // 水印中心在素材中的横向位置 0..100
  yPercent: 50,                 // 水印中心在素材中的纵向位置 0..100
  tile: false,                  // 铺满图片（网格重复填充）
  tileGapXPercent: 24,          // 平铺横向间距（相对素材宽度）
  tileGapYPercent: 24,          // 平铺纵向间距（相对素材高度）
  logoUrl: '',
  logoScale: 0.14,              // Logo 宽度 / 素材宽度
  motion: {                     // 视频水印动态（图片忽略）
    mode: 'static',             // static | rotate | drift | marquee | pulse | flicker | trace
    speed: 1,                   // 0.2..4
    intervalSec: 20,            // 定时跳位间隔（防搬运业界默认 20s）
    direction: 'horizontal',    // horizontal | vertical | diagonal
    safePaddingPercent: 6,      // 动态水印安全边距（避免贴边被裁）
    seed: 1,
  },
});

export const WATERMARK_MATERIALS = Object.freeze([
  { value: 'image', label: '图片', hint: '应用到图片素材（主图/详情图/白底图…）' },
  { value: 'video', label: '视频', hint: '应用到视频素材，可开启动态水印' },
]);

export const WATERMARK_TYPES = Object.freeze([
  { value: 'text', label: '文字水印' },
  { value: 'logo', label: '图片水印' },
]);

/** 视频动态水印模式（参考剪映/SproutVideo 等成熟做法） */
export const WATERMARK_MOTION_MODES = Object.freeze([
  { value: 'static', label: '静态', hint: '固定位置，适合成片交付' },
  { value: 'rotate', label: '定时跳位', hint: '每隔一段时间换一个位置，防搬运裁剪' },
  { value: 'drift', label: '缓慢漂移', hint: '在安全区内连续漂浮，难以擦除' },
  { value: 'marquee', label: '跑马灯', hint: '沿一个方向循环滚动' },
  { value: 'pulse', label: '心跳脉冲', hint: '周期缩放呼吸' },
  { value: 'flicker', label: '闪烁', hint: '透明度周期变化' },
  { value: 'trace', label: '溯源水印', hint: '带时间戳的动态文本，可追查二次搬运' },
]);

export const WATERMARK_FONT_FAMILIES = Object.freeze([
  { value: 'system-ui', label: '系统默认' },
  { value: 'serif', label: '衬线' },
  { value: 'monospace', label: '等宽' },
]);

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function pickEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

const LEGACY_POSITION_PERCENT = Object.freeze({
  'top-left': { xPercent: 12, yPercent: 12 },
  'top-center': { xPercent: 50, yPercent: 12 },
  'top-right': { xPercent: 88, yPercent: 12 },
  'center-left': { xPercent: 12, yPercent: 50 },
  center: { xPercent: 50, yPercent: 50 },
  'center-right': { xPercent: 88, yPercent: 50 },
  'bottom-left': { xPercent: 12, yPercent: 88 },
  'bottom-center': { xPercent: 50, yPercent: 88 },
  'bottom-right': { xPercent: 88, yPercent: 88 },
});

const LEGACY_MOTION_MODE = Object.freeze({
  scroll: 'marquee',
  vertical: 'marquee',
  diagonal: 'marquee',
  bounce: 'drift',
  fade: 'flicker',
  pulse: 'pulse',
});

/** 旧版「九宫格位置 + 偏移」→ 百分比位置 */
function positionFromLegacy(value) {
  const preset = LEGACY_POSITION_PERCENT[value.position] || LEGACY_POSITION_PERCENT['bottom-right'];
  const offsetX = clampNumber(value.offsetX, 0, 0, 500);
  const offsetY = clampNumber(value.offsetY, 0, 0, 500);
  const dirX = preset.xPercent > 50 ? -1 : 1;
  const dirY = preset.yPercent > 50 ? -1 : 1;
  return {
    xPercent: clampNumber(preset.xPercent + dirX * offsetX * 0.08, preset.xPercent, 0, 100),
    yPercent: clampNumber(preset.yPercent + dirY * offsetY * 0.08, preset.yPercent, 0, 100),
  };
}

/**
 * 归一化水印配置（图片/视频共用）。
 * 兼容 9-08 之前的旧字段：position/offsetX/offsetY/tilePattern/logoScale(倍数)/dynamic。
 */
export function normalizeWatermark(value, { material = 'image' } = {}) {
  const v = value && typeof value === 'object' ? value : {};
  const isVideo = material === 'video';
  const fallback = isVideo
    ? { ...DEFAULT_WATERMARK, color: '#ffffff', opacity: 0.4, fontSize: 28 }
    : DEFAULT_WATERMARK;

  const legacyPosition = LEGACY_POSITION_PERCENT[v.position] ? positionFromLegacy(v) : null;
  const legacyTile = v.tilePattern === 'grid' || v.tilePattern === 'diagonal';
  const legacyMotion = v.dynamic && typeof v.dynamic === 'object' ? v.dynamic : null;
  const motion = v.motion && typeof v.motion === 'object' ? v.motion : {};
  /* 新模型：logoScale = Logo 宽度 / 素材宽度（0.02..0.8）。
     旧模型用的是「倍数」(默认 1)，值大于 0.8 时按旧倍数换算，避免历史节点被放大到 80%。 */
  const rawLogoScale = Number(v.logoScale);
  const logoScale = Number.isFinite(rawLogoScale) && rawLogoScale > 0
    ? (rawLogoScale > 0.8
      ? clampNumber(rawLogoScale * 0.14, fallback.logoScale, 0.02, 0.8)
      : clampNumber(rawLogoScale, fallback.logoScale, 0.02, 0.8))
    : fallback.logoScale;

  return {
    enabled: v.enabled === true,
    type: pickEnum(v.type, ['text', 'logo'], fallback.type),
    text: typeof v.text === 'string' && v.text.trim()
      ? v.text.trim().slice(0, 40)
      : fallback.text,
    fontFamily: pickEnum(v.fontFamily, ['system-ui', 'serif', 'monospace'], fallback.fontFamily),
    fontSize: Math.round(clampNumber(v.fontSize, fallback.fontSize, 10, 140)),
    fontWeight: [400, 500, 600, 700, 800, 900].includes(Number(v.fontWeight))
      ? Number(v.fontWeight)
      : fallback.fontWeight,
    color: typeof v.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.color) ? v.color : fallback.color,
    strokeColor: typeof v.strokeColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.strokeColor)
      ? v.strokeColor
      : fallback.strokeColor,
    strokeOpacity: clampNumber(v.strokeOpacity, fallback.strokeOpacity, 0, 1),
    opacity: clampNumber(v.opacity, fallback.opacity, 0, 1),
    rotation: Math.round(clampNumber(v.rotation, fallback.rotation, -180, 180)),
    xPercent: Math.round(clampNumber(
      v.xPercent,
      legacyPosition ? legacyPosition.xPercent : fallback.xPercent,
      0,
      100,
    )),
    yPercent: Math.round(clampNumber(
      v.yPercent,
      legacyPosition ? legacyPosition.yPercent : fallback.yPercent,
      0,
      100,
    )),
    tile: v.tile === true || legacyTile,
    tileGapXPercent: clampNumber(v.tileGapXPercent, fallback.tileGapXPercent, 6, 60),
    tileGapYPercent: clampNumber(v.tileGapYPercent, fallback.tileGapYPercent, 6, 60),
    logoUrl: typeof v.logoUrl === 'string' ? v.logoUrl.trim() : '',
    logoScale,
    motion: {
      mode: pickEnum(
        motion.mode,
        ['static', 'rotate', 'drift', 'marquee', 'pulse', 'flicker', 'trace'],
        legacyMotion
          ? LEGACY_MOTION_MODE[legacyMotion.mode] || fallback.motion.mode
          : fallback.motion.mode,
      ),
      speed: clampNumber(motion.speed, fallback.motion.speed, 0.2, 4),
      intervalSec: Math.round(clampNumber(motion.intervalSec, fallback.motion.intervalSec, 2, 120)),
      direction: pickEnum(
        motion.direction,
        ['horizontal', 'vertical', 'diagonal'],
        legacyMotion ? pickEnum(legacyMotion.direction, ['horizontal', 'vertical', 'diagonal'], 'horizontal') : fallback.motion.direction,
      ),
      safePaddingPercent: clampNumber(motion.safePaddingPercent, fallback.motion.safePaddingPercent, 0, 25),
      seed: Math.round(clampNumber(motion.seed, fallback.motion.seed, 1, 9999)),
    },
  };
}

export function normalizeImageWatermark(value) {
  return normalizeWatermark(value, { material: 'image' });
}

export function normalizeVideoWatermark(value) {
  return normalizeWatermark(value, { material: 'video' });
}

/** 素材上的实际字号（px）：以 1000px 宽为基准等比换算，保证所见即所得 */
export function watermarkFontSizePx(config, materialWidth) {
  const width = Math.max(1, Number(materialWidth) || 0);
  return Math.max(6, (Number(config?.fontSize) || DEFAULT_WATERMARK.fontSize) * (width / 1000));
}

/** 素材上的 Logo 宽度（px）：相对素材宽度 */
export function watermarkLogoWidthPx(config, materialWidth) {
  const width = Math.max(1, Number(materialWidth) || 0);
  return Math.max(10, (Number(config?.logoScale) || DEFAULT_WATERMARK.logoScale) * width);
}

/**
 * 生成水印瓦片坐标（相对素材的百分比 0..100）。
 * 单个水印返回一个瓦片；铺满时按网格重复填充（对齐参考面板「铺满图片」）。
 */
export function buildWatermarkTiles(config, { width = 1000, height = 1000 } = {}) {
  const w = normalizeWatermark(config);
  if (!w.enabled) return [];
  const ww = Math.max(1, Number(width) || 0);
  const hh = Math.max(1, Number(height) || 0);

  if (!w.tile) {
    return [{ id: 'wm-single', xPercent: w.xPercent, yPercent: w.yPercent }];
  }

  const gapX = Math.max(4, w.tileGapXPercent);
  const gapY = Math.max(4, w.tileGapYPercent);
  const cols = Math.max(1, Math.ceil(100 / gapX));
  const rows = Math.max(1, Math.ceil(100 / gapY));
  const startX = gapX / 2;
  const startY = gapY / 2;
  const tiles = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      tiles.push({
        id: 'wm-' + row + '-' + col,
        xPercent: startX + col * gapX + (row % 2 ? gapX / 2 : 0),
        yPercent: startY + row * gapY,
      });
    }
  }
  void ww; void hh;
  return tiles;
}

/** 视频动态水印的 CSS 动画参数（返回 null 表示静态） */
export function watermarkMotionAnimation(config, { material = 'image', width = 1000, height = 1000 } = {}) {
  const w = normalizeWatermark(config, { material });
  if (!w.enabled || material !== 'video') return null;
  const mode = w.motion.mode;
  if (mode === 'static') return null;
  const speed = Math.max(0.2, w.motion.speed);
  const duration = Math.max(0.4, 8 / speed);
  const base = { animationDuration: duration + 's', animationIterationCount: 'infinite' };
  void width; void height;
  switch (mode) {
    case 'rotate':
      return { ...base, animationName: 'ec-watermark-rotate', animationDuration: Math.max(2, w.motion.intervalSec) + 's', animationTimingFunction: 'steps(4, end)' };
    case 'drift':
      return { ...base, animationName: 'ec-watermark-drift', animationTimingFunction: 'ease-in-out', animationDirection: 'alternate', animationDuration: duration * 3 + 's' };
    case 'marquee':
      return {
        ...base,
        animationName: w.motion.direction === 'vertical' ? 'ec-watermark-marquee-vertical' : w.motion.direction === 'diagonal' ? 'ec-watermark-marquee-diagonal' : 'ec-watermark-marquee',
        animationTimingFunction: 'linear',
      };
    case 'pulse':
      return { ...base, animationName: 'ec-watermark-pulse', animationTimingFunction: 'ease-in-out', animationDirection: 'alternate' };
    case 'flicker':
      return { ...base, animationName: 'ec-watermark-flicker', animationTimingFunction: 'ease-in-out' };
    case 'trace':
      return { ...base, animationName: 'ec-watermark-flicker', animationTimingFunction: 'ease-in-out', animationDuration: '4s' };
    default:
      return null;
  }
}

/* ═══════════ 旧接口（9-08 画布覆盖层水印，保持向后兼容）═══════════ */

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
        id: 'wm-' + row + '-' + col,
        x: col * gapX + (row % 2 ? gapX / 2 : 0),
        y: row * gapY,
      });
    }
  }
  return tiles;
}

/** 旧接口：图片水印平铺（像素坐标） */
export function buildImageWatermarkTiles(watermark, viewport = { width: 1600, height: 900 }) {
  const w = normalizeWatermark(watermark, { material: 'image' });
  if (!w.enabled) return [];
  const width = Math.max(1, Number(viewport.width) || 0);
  const height = Math.max(1, Number(viewport.height) || 0);
  return buildWatermarkTiles(w, { width, height }).map(tile => ({
    id: tile.id,
    x: (tile.xPercent / 100) * width,
    y: (tile.yPercent / 100) * height,
  }));
}

/** 旧接口：视频水印平铺（像素坐标，单个位置） */
export function buildVideoWatermarkTiles(watermark, viewport = { width: 1920, height: 1080 }) {
  const w = normalizeWatermark(watermark, { material: 'video' });
  if (!w.enabled) return [];
  const width = Math.max(1, Number(viewport.width) || 0);
  const height = Math.max(1, Number(viewport.height) || 0);
  return buildWatermarkTiles(w, { width, height }).map(tile => ({
    id: tile.id,
    x: (tile.xPercent / 100) * width,
    y: (tile.yPercent / 100) * height,
  }));
}

export const DEFAULT_IMAGE_WATERMARK = Object.freeze({ ...DEFAULT_WATERMARK });
export const DEFAULT_VIDEO_WATERMARK = Object.freeze({
  ...DEFAULT_WATERMARK,
  color: '#ffffff',
  opacity: 0.4,
  fontSize: 28,
});
