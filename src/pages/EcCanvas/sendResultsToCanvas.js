/* ═══════════════════════════════════════════════════════════════════════════
   把一批已生成的图片送进画布 —— EcStudio 精修工坊 / EcAuto 一键出图 共用
   2026-09-29 批 CY-⑰
   ═══════════════════════════════════════════════════════════════════════════

   问题：同一个产品里**三条等价产图路径，只有���条能把结果拿回画布**。
     · MediaCreation（技能子页）：每张结果有「送到画布」，用的是
       \`SET_CREATION_LAUNCH\` + \`OPEN_CANVAS\` 这一对 store 动作；
     · EcStudio 精修工坊：结果区只有「重新生成 / 取消」+ 下载长图；
     · EcAuto 一键出图：结果区只有「下载」+「重新生成」。
   ⇒ 后两页的产物是**死胡同**：出了图，除了下载没有第二条去处。

   为什么不能顺手 \`NAVIGATE page:'ec-canvas'\`：MediaCreation 那边踩过并记录了
   （index.jsx:2305-2310）——用 NAVIGATE 时画布会挂载、图也加上了，
   **但两三秒后被弹回子页面**（\`canvasEntryTab\` / \`galleryItem\` 没一起复位）。
   ⇒ 这里**逐字复用**那对动作，不发明第二条路。

   纯函数：只拼 store 动作，不碰 dispatch —— 门禁可以直接断言拼出来的形状。
   ═══════════════════════════════════════════════════════════════════════════ */

/** 一条 launch 的形状（与 canvasWorkbenchInbound.js 的消费端严格对齐）。 */
export function buildCanvasLaunchFromUrls(items = [], { skillId = '', title = '生成结果', prompt = '' } = {}) {
  const images = (Array.isArray(items) ? items : [])
    .map(item => {
      const url = String(typeof item === 'string' ? item : item?.url || '').trim();
      if (!url) return null;
      return {
        url,
        assetId: String((typeof item === 'object' && item?.assetId) || '').trim(),
        name: String((typeof item === 'object' && item?.name) || '').trim() || title,
      };
    })
    .filter(Boolean);
  if (!images.length) return null;
  return { kind: 'to-canvas', skillId, title, prompt: String(prompt || ''), images };
}

/** 组装成"按顺序 dispatch 的两个动作"，调用方只要 `for (const a of actions) dispatch(a)`。 */
export function canvasEntryActionsForResults(items = [], options = {}) {
  const launch = buildCanvasLaunchFromUrls(items, options);
  if (!launch) return [];
  /* ⚠️ 顺序有依赖：先放 launch 再开画布，反了会开出一个空画布。 */
  return [{ type: 'SET_CREATION_LAUNCH', launch }, { type: 'OPEN_CANVAS' }];
}

/**
 * 把 `{ [assetId]: stableUrl }` 这种形状（EcStudio/EcAuto 的结果就是这个形状）
 * 摊成 [{url, assetId, name}]，并按 key 排序保证顺序稳定。
 */
export function resultItemsFromImageMap(images = {}, { prefix = '结果' } = {}) {
  if (!images || typeof images !== 'object') return [];
  return Object.entries(images)
    .map(([assetId, url]) => ({ url: String(url || '').trim(), assetId: String(assetId || '').trim(), name: `${prefix} ${assetId}` }))
    .filter(item => item.url);
}
