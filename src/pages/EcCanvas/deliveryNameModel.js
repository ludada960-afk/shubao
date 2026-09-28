/* ═══════════════════════════════════════════════════════════════════════════
   导出文件名 —— 2026-09-29 批 CY-⑭
   ═══════════════════════════════════════════════════════════════════════════

   用户原话（逐字，朋友的反馈）：
     「我们现在生成出来的图片是下面的这种情况，就是**图片的名字是一堆乱码**。
       然后上面的这张图片是官方 image 生成出来的图片，他们的**名字是有主动的一个命名的**。
       那我们能不能考虑也去这样做呢？就是**最起码导出的图片它应该得有一个命名**吧。
       至于这个命名的规则应该怎么做？……而且做这个东西**有没有成本**呢？本太大的话，那就算了吧。
       你自己深度思考一下怎么做会更好？」

   实测的乱码长这样：`a9f2e9cd0b3922a2e7f2a96f50458a832657d1797825c88de65546ca8deb5e1.png`
   —— 64 位十六进制。**根因查清楚了**（不是猜测）：
     · 本站生成素材的 id 就是内容的 sha256（`index.jsx` 的 `generated-assets/<sha>.png` 路径）；
     · `stableTaskImageRecords`（`services/api.js`）在没有 label 时**用 id 当 label**；
     · 套图节点 builder 写的是 `name: image.displayName || image.label || meta.name || '电商图'`
       —— `image.label` 恰好是那串 sha，于是**每次都赢过** `meta.name`（白底图/主图/详情图…）；
     · 最后 `browserFileDelivery.uniqueFilenames` 原样用它当文件名。

   命名规则（`deliveryNameFor`）——**零成本**、纯函数、不调任何模型：
     优先级 1：用户自己起过的名字（`node.name`，用户可在图片信息里改）
     优先级 2：业务角色名（`node.role` / `node.group`，套图图位本来就有中文名）
     优先级 3：提示词首句（截到 16 字，只取到第一个标点为止）
     优先级 4：`图片-01`（保底）
     ⚠️ 任何一级取值若"长得像哈希"（≥16 位纯 hex）或为空，一律视为**无效**，直接跳到下一级。
        这条是关键：**乱码不是被"美化"了，是被判定为无效名而丢弃了。**

   为什么不"自动总结提示词"：那要调一次模型 = 真金白银 + 延迟 + 失败态。
     用户自己问的是「有没有成本」—— 这里是零。真正该做的是**让名字本来就对**
     （上游补 role 兜底，见 index.jsx 的套图节点 builder），本模块只做最后一道防线。
   ═══════════════════════════════════════════════════════════════════════════ */

/** ≥16 位纯十六进制 ⇒ 是内容哈希，不是人写的名字。 */
export function looksLikeContentHash(value) {
  const text = String(value ?? '').trim();
  if (text.length < 16) return false;
  if (!/^[0-9a-f]+$/i.test(text)) return false;
  /* 纯数字（像 "20260928123456"）不算哈希，那是日期 */
  return /[a-f]/i.test(text);
}

const ILLEGAL_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]+/g;
const PROMPT_TERMINATORS = /[。！？!?\n]/;

/** 把任意候选名收拾成一个能落盘的文件名主干。 */
function tidy(value) {
  return String(value ?? '')
    .replace(ILLEGAL_FILENAME_CHARS, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();
}

/** 从提示词里取一句短的话当名字。 */
function nameFromPrompt(prompt) {
  const text = String(prompt ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const head = text.split(PROMPT_TERMINATORS)[0] || text;
  const clipped = head.slice(0, 16).trim();
  return clipped.length >= 2 ? clipped : '';
}

/**
 * @param {object} node 画布节点
 * @param {number} index 当前序号（0 起）
 * @param {number} total 本次导出的总张数
 * @returns {string} 文件名主干（不含扩展名）
 */
export function deliveryNameFor(node = {}, index = 0, total = 1) {
  const ordinal = String(index + 1).padStart(2, '0');
  const candidates = [node?.name, node?.displayLabel, node?.role, node?.group, nameFromPrompt(node?.prompt)];
  for (const candidate of candidates) {
    const value = tidy(candidate);
    if (!value) continue;
    if (looksLikeContentHash(value)) continue;
    /* 单张导出时不需要再加序号；多张才编号，避免"白底图-01"里那个多余的 01 */
    return total > 1 ? `${value}-${ordinal}` : value;
  }
  return `图片-${ordinal}`;
}
