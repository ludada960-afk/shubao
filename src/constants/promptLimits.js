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
