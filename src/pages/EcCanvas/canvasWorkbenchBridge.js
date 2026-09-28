/* ═══ 2026-09-28 批 CY-⑨（CV-2 第 2 步）：**画布节点 ↔ 子页面工作台**的桥（纯函数）═══════════════
   用户已拍板（docs/design/89 §5 第 2 步 + §7 第 3 条）：
     · 画布 → 子页面：**节点上**「在完整工作台里编辑」（打开对应 skill 子页面，参数带过去）；
     · 子页面 → 画布：「送到画布」。
   本文件只放**纯函数**，门禁可以直接测它们；节点与页面的接线在 EcCanvas/index.jsx 与
   MediaCreation/index.jsx（那里各只有一小段）。

   ⚠️ **只认图片技能**：视频子页面还没有接 `creationLaunch` 这条落地链路（它只在图片侧
      MediaCreation 里被消费）——给了入口就是"点了没反应"，按铁律**接不通的一律不渲染**。
      视频侧等落地链路接好再放出来（记在 RTK）。
   ⚠️ 两条解析路径，都**不猜**：
       ① 建节点时存下的 `subpageSkillId`（CV-2 之后新建/改过技能的节点走这条，最准）；
       ② 按 `skillLabel` 与技能名**精确相等**回查（覆盖更早建的节点与已存在的草稿）；
       两条都不中 ⇒ 返回 null ⇒ 入口不渲染。宁可没有这颗按钮，也不给一个会跳错页面的按钮。 */

import { IMAGE_SKILLS, getImageSkill } from '../../skills/imageSkills.js';

/** 节点 → 子页面坐标；解析不出来返回 null（调用方据此决定**不渲染**入口）。 */
export function canvasWorkbenchTargetOf(node = {}) {
  if (!node || typeof node !== 'object') return null;
  /* 明确标了别的板块（video）就直接不给 —— 那不是"没写"，是"不是图片技能"。 */
  if (node.subpageDomain && node.subpageDomain !== 'image') return null;
  const byId = node.subpageSkillId ? getImageSkill(node.subpageSkillId) : null;
  const skill = byId
    || (node.skillLabel ? IMAGE_SKILLS.find(item => item.name === node.skillLabel) : null)
    || (node.skill ? IMAGE_SKILLS.find(item => item.id === node.skill) : null);
  if (!skill?.id) return null;
  return { domain: 'image', skillId: skill.id, skill };
}

/** 节点参数 → 子页面字段种子：**只带这条技能真的声明了的字段**（逐条核对，不做猜测映射）。
 *  对应关系（画布参数 → 子页面字段 key）：
 *    ratio      → `ratio`（比例）
 *    resolution → `resolution` / `clarity`（清晰度：两条技能族用的是两个 key，谁在给谁）
 *    count      → `count`（数量）
 *  提示词**不走这里**：子页面用 `planPreviewTargetKey(skill)` 决定写进哪个字段
 *  （与首页「做同款」/画布「回到工作台」同一条既有做法，见 MediaCreation 的 launch 落地）。 */
export function canvasNodeSeedValues(node = {}, skill = null) {
  const fields = Array.isArray(skill?.fields) ? skill.fields : [];
  const has = key => fields.some(field => field?.key === key);
  const seed = {};
  if (has('ratio') && node?.ratio) seed.ratio = node.ratio;
  if (has('resolution') && node?.resolution) seed.resolution = node.resolution;
  if (has('clarity') && node?.resolution) seed.clarity = node.resolution;
  const count = Number(node?.count);
  if (has('count') && Number.isFinite(count) && count > 0) seed.count = count;
  return seed;
}
