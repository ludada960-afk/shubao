/**
 * 提示词长度上限（2026-09-12 用户批注：全局统一，首页与画布必须一致）。
 * 口径参考竞品：视频 8000 字 / 生图 2000 字；输入框要给足高度并可滚动，不要截断用户内容。
 * 服务端（videoPlanModel / 生图链路）使用同一组数字，避免前后端不一致导致“明明能输入却被截断”。
 */
export const VIDEO_PROMPT_LIMIT = 8000;
export const IMAGE_PROMPT_LIMIT = 2000;
export const TEXT_PROMPT_LIMIT = 2000;

export function promptLimitForKind(kind = 'image') {
  if (kind === 'video') return VIDEO_PROMPT_LIMIT;
  if (kind === 'text') return TEXT_PROMPT_LIMIT;
  return IMAGE_PROMPT_LIMIT;
}

/* ── 9-16 用户批注：输入框高度可拉 + 有明确上限，拉到头仍然超出就滚动 ──
 * 用户原话：「这四个文字输入框本身不大，用户输入几千字要一直滑动」、
 *          「文字输入框右下角不是应该有一个可以拉动的按钮吗（resize 手柄），这样才一次性看全」、
 *          「拉完之后如果字还是超出，还是要有滚动条」。
 * 前端可编辑框（.mention-prompt-field）不是 textarea，原生 resize 手柄用不上，
 * 所以用「行高 × 行数」把可拉伸范围显性化，四个生成框共用同一组数字：
 *   最小 3 行（放得下一句商品描述，和现在高度基本一致）→ 最大 12 行（一屏能看完几千字），
 *   超过最大高度后由 .mention-prompt-field 自带的 overflow:auto 出滚动条。 */
export const PROMPT_MIN_ROWS = 3;
export const PROMPT_MAX_ROWS = 12;
/* 行高（px）与 .mention-prompt-field 的 line-height 1.75 / 14px 对齐；
   上下内边距用 border-box 内的 padding 计算，改 CSS 时同步这里。 */
export const PROMPT_LINE_HEIGHT = 24.5;
export const PROMPT_FIELD_PADDING = 28;

/** 一行文字的像素高度，用于把「行」换算成可写进 CSS 自定义属性的像素值。 */
export function promptRowHeight(lineHeight = PROMPT_LINE_HEIGHT) {
  return Number(lineHeight) || PROMPT_LINE_HEIGHT;
}

/** 生成框输入区的 CSS 自定义属性（把上限写进样式，手柄拖动也不会越过上限）。 */
export function promptFieldCssVars({ lineHeight = PROMPT_LINE_HEIGHT, padding = PROMPT_FIELD_PADDING } = {}) {
  const row = promptRowHeight(lineHeight);
  return {
    '--ec-prompt-line': `${row}px`,
    '--ec-prompt-min-h': `${Math.round(PROMPT_MIN_ROWS * row + padding)}px`,
    '--ec-prompt-max-h': `${Math.round(PROMPT_MAX_ROWS * row + padding)}px`,
  };
}

/** 超限提示要简短、说结果不说机制（用户批注：不要把内部逻辑表达给用户）。 */
export function promptLimitNotice(limit, kind = 'image') {
  const max = Number(limit) || promptLimitForKind(kind);
  return `最多 ${max} 字，已截断`;
}
