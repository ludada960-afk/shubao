/**
 * 画布封面 = **拿画布里已有的一个节点当封面**（不生成新图、不额外存任何东西）。
 *
 * 2026-10-03 用户批注：「这画布里面明明有节点，你为什么说是空画布呢，
 *   不能把画布的情况实时展示吗」+「我看到他们知渔这个好像是就拿其中一个节点来做封面啊，
 *   至于是什么节点……一般可能是画布里面生成的作品优先吧」。
 *
 * 原来这里只认 `image` / `output` 两种 kind ⇒ 一张**只放了视频**的画布
 * 取不到封面，卡片显示「空画布」，而下面那行又写着「1 个节点」——
 * 同一张卡上自相矛盾（用户截图就是这个）。
 *
 * 优先级（与用户口径一致：**生成的作品优先**）：
 *   ① output —— 画布里生成出来的成品，最能代表这张画布
 *   ② image / image-composer / suite-composer —— 上传或生成的素材
 *   ③ video —— 视频节点（它的海报帧就是这张画布的主视觉）
 *   ④ 其它带可用地址的节点
 * 排除：纯文字节点、音频（没有画面）、以及正在上传/失败还没有地址的节点 ——
 * 那些取出来只会是一张空白或破图，比「空画布」更糟。
 */
const COVER_KIND_TIERS = Object.freeze([
  ['output', 0],
  ['image', 1],
  ['image-composer', 1],
  ['suite-composer', 1],
  ['layer-group', 1],
  ['video', 2],
]);

const COVER_EXCLUDED_KINDS = new Set(['text', 'text-composer', 'audio']);

/** 节点上能当封面的地址：本地预览优先（先看得到），其次是持久地址。 */
export function canvasNodeCoverUrl(node) {
  if (!node || typeof node !== 'object') return '';
  const kind = String(node.kind || '');
  if (COVER_EXCLUDED_KINDS.has(kind)) return '';
  if (node.status === 'uploading' || node.status === 'upload-error') return '';
  return String(node.localPreviewUrl || node.url || '');
}

/** 节点当封面的优先级档位；不在名单里的按 3（能用但排最后）。 */
export function canvasNodeCoverTier(node) {
  const kind = String(node?.kind || '');
  const found = COVER_KIND_TIERS.find(([name]) => name === kind);
  return found ? found[1] : 3;
}

/**
 * 从一张画布的节点里挑一个当封面。
 * @returns {string} 地址；挑不出时返回 ''（前端据此显示「空画布」）
 */
export function pickCanvasCoverUrl(nodes = []) {
  const list = Array.isArray(nodes) ? nodes : [];
  let best = null;
  for (const node of list) {
    const url = canvasNodeCoverUrl(node);
    if (!url) continue;
    const tier = canvasNodeCoverTier(node);
    if (!best || tier < best.tier) best = { tier, url };
  }
  return best ? best.url : '';
}
