/**
 * 提示词 / 套图面板 尺寸冲突检测 (2026-09-10)
 *
 * 设计原则（调研结论）：结构化控件是硬参数的唯一事实源，提示词只表达内容意图。
 * 因此本模块【不修改】任何硬参数，只在两者明显冲突时把它变成用户可见的提示，
 * 并给出一键切换建议。纯字符串匹配，零网络请求、零 API 消耗。
 */

/** 支持的合法比例（与后端 LEGAL_IMAGE_SIZES 的常见集合一致） */
export const KNOWN_RATIOS = Object.freeze([
  '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '4:5', '5:4', '2:1', '1:2', '21:9',
]);

/** 中文/口语表达 -> 比例 */
const WORD_RATIOS = Object.freeze([
  { re: /正方形|方形图|方图|正方形图|1\s*比\s*1/, ratio: '1:1' },
  { re: /竖版|竖图|竖屏|纵向|长图|手机全屏|9\s*比\s*16/, ratio: '9:16' },
  { re: /横版|横图|横屏|宽屏|横幅|16\s*比\s*9/, ratio: '16:9' },
  { re: /3\s*比\s*4|四比三竖/, ratio: '3:4' },
  { re: /4\s*比\s*3/, ratio: '4:3' },
  { re: /2\s*比\s*3/, ratio: '2:3' },
  { re: /3\s*比\s*2/, ratio: '3:2' },
]);

const RATIO_RE = new RegExp('(?:^|[^0-9])(' + KNOWN_RATIOS
  .map(r => r.replace(':', '\\s*[:：]\\s*'))
  .join('|') + ')(?![0-9])', 'g');
const PIXEL_RE = /(\d{2,5})\s*[x×*]\s*(\d{2,5})/g;

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) { const t = y; y = x % y; x = t; }
  return x || 1;
}

export function ratioFromPixels(width, height) {
  const w2 = Number(width);
  const h2 = Number(height);
  if (!Number.isFinite(w2) || !Number.isFinite(h2) || w2 <= 0 || h2 <= 0) return '';
  const d = gcd(Math.round(w2), Math.round(h2));
  const rw = Math.round(w2) / d;
  const rh = Math.round(h2) / d;
  // 只接受能在合法集合里对齐的比例（简化到最小整数后再比对）
  const exact = `${rw}:${rh}`;
  if (KNOWN_RATIOS.includes(exact)) return exact;
  // 尝试用常见基准比例近似（1200x1600 -> 3:4）
  const target = w2 / h2;
  let best = '';
  let bestDiff = Infinity;
  for (const r of KNOWN_RATIOS) {
    const [a, b] = r.split(':').map(Number);
    const diff = Math.abs(a / b - target);
    if (diff < bestDiff) { bestDiff = diff; best = r; }
  }
  return bestDiff <= 0.02 ? best : '';
}

function normalizeRatioToken(token) {
  const cleaned = String(token || '').replace(/\s/g, '').replace('：', ':');
  return KNOWN_RATIOS.includes(cleaned) ? cleaned : '';
}

/** 从任意文本里提取"用户明确写出的尺寸/比例" */
export function parseSizeMentions(text) {
  const source = String(text || '');
  if (!source.trim()) return [];
  const found = [];
  const push = (ratio, raw, kind) => {
    if (!ratio) return;
    if (found.some(item => item.ratio === ratio && item.kind === kind)) return;
    found.push({ ratio, raw: String(raw).trim(), kind });
  };
  for (const match of source.matchAll(RATIO_RE)) push(normalizeRatioToken(match[1]), match[1], 'ratio');
  for (const match of source.matchAll(PIXEL_RE)) {
    push(ratioFromPixels(match[1], match[2]), match[0], 'pixels');
  }
  for (const item of WORD_RATIOS) {
    const match = item.re.exec(source);
    if (match) push(item.ratio, match[0], 'word');
  }
  return found;
}

function ratioLabel(ratio) {
  const [w2, h2] = String(ratio).split(':').map(Number);
  if (w2 === h2) return `${ratio} 方形`;
  return h2 > w2 ? `${ratio} 竖版` : `${ratio} 横版`;
}

/** 建议的套图补丁：只改主图类（主图/白底/透明/SKU），不动详情 */
export const MAIN_SCOPED_KEYS = Object.freeze(['main_text', 'main_3x4', 'white_bg', 'white_background', 'transparent', 'sku', 'main']);

export function suggestSizingImages(images, ratio) {
  const list = Array.isArray(images) ? images : [];
  if (!ratio || !list.length) return null;
  let touched = 0;
  const next = list.map(image => {
    const key = String(image?.key || '');
    if (!MAIN_SCOPED_KEYS.includes(key)) return image;
    if (image?.ratio === ratio) return image;
    touched += 1;
    return { ...image, ratio, targetRatio: ratio, cropPolicy: 'none' };
  });
  return touched ? { images: next, touched } : null;
}

/**
 * 检测冲突：提示词写出的比例，在面板里完全没有。
 * @returns {{ mentions: Array, panelRatios: string[], conflicts: Array }}
 */
export function detectSizingConflict({ promptText = '', images = [] } = {}) {
  const panelRatios = [...new Set((Array.isArray(images) ? images : [])
    .filter(image => Number(image?.count) > 0)
    .map(image => String(image?.ratio || ''))
    .filter(Boolean))];
  const mentions = parseSizeMentions(promptText);
  // 面板里没有任何生效图片时，不存在"冲突"，不打扰用户
  if (!panelRatios.length) return { mentions, panelRatios, conflicts: [] };
  const conflicts = [];
  for (const mention of mentions) {
    if (!mention.ratio) continue;
    if (panelRatios.includes(mention.ratio)) continue;
    // 同一比例可能同时以「16:9」和「横版」出现，冲突只报一次
    if (conflicts.some(item => item.ratio === mention.ratio)) continue;
    const suggestion = suggestSizingImages(images, mention.ratio);
    conflicts.push({
      ratio: mention.ratio,
      raw: mention.raw,
      kind: mention.kind,
      label: ratioLabel(mention.ratio),
      panelRatios: [...panelRatios],
      canApply: Boolean(suggestion),
      applyCount: suggestion ? suggestion.touched : 0,
      suggestion,
    });
  }
  return { mentions, panelRatios, conflicts };
}
