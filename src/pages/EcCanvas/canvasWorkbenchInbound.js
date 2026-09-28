/* ═══ 2026-09-28 批 CY-⑩（CV-2 第 2 步·反向）：**子页面 → 画布**（「送到画布」）的纯函数 ═════════════
   用户拍板（docs/design/89 §5 第 2 步）：「子页面 → 画布：把当前 skill + 已填参数 + 已上传素材变成一个节点」。
   本文件与 `canvasWorkbenchBridge.js`（画布 → 子页面）成对：那边算"子页面坐标 + 参数种子"，
   这边算"落到画布上的节点"。门禁可以直接测这两个纯函数，接线各只有一小段。

   ⚠️ 三条纪律（每条都有原因）：
     ① **追加、不覆盖**：用户画布上可能已经有活儿 —— 收到「送到画布」只在**空白处添一个节点**，
        绝不学首页"发射器"（`ec-plan-launch`）那样把整张图换成新方案：那是"发一整套方案"的语义，
        不是"把这一张拿到画布上继续做"；
     ② 节点上要记 `subpageSkillId / skillLabel / prompt` ⇒ 送过去之后还能**原路回工作台**
        （与批 CY-⑨ 的"画布 → 子页面"对称，形成闭环）；
     ③ **只送已就绪、有 url 的结果**（占位/失败项不送 —— 送了就是空壳节点，铁律：不摆假东西）。
   本文件不算钱（没有任何计费调用）。 */

/** 子页面发出的"送到画布"载荷。与画布→子页面那条用**同一个跨路由载体**（`creationLaunch`），
 *  只是 kind 不同（那边 `canvas-node-edit`，这边 `to-canvas`）—— 站内跨路由只有一个载体，别再造第二个。 */
export function isWorkbenchInbound(launch) {
  return Boolean(launch) && launch.kind === 'to-canvas';
}

/** 把载荷里的结果图变成画布节点（纯函数，返回**新节点数组**，调用方负责 append）。 */
export function workbenchInboundNodesOf({ launch = {}, existing = [], now = Date.now(), gap = 48, card = 240 } = {}) {
  const items = (Array.isArray(launch?.images) ? launch.images : []).filter(item => String(item?.url || '').trim());
  if (!items.length) return [];
  /* 落点：现有节点的**最右缘**再往右一格（不与已有节点叠），同批按 y 依次排开；
     画布空着就从左上角开始（与"铺素材"同一套坐标口径：x/y 是画布坐标，单位 px）。 */
  const rightEdge = existing.reduce((max, node) => Math.max(max, (Number(node?.x) || 0) + (Number(node?.w) || card)), 0);
  const topY = existing.length ? Math.min(...existing.map(node => Number(node?.y) || 0)) : 80;
  const x = existing.length ? rightEdge + gap : 80;
  const rowGap = 24;
  return items.map((item, index) => ({
    id: `wb_inbound_${now}_${index + 1}`,
    kind: 'image',
    /* provenance = generated：它是"生成出来的成品"，不是上传的素材（派生/降级规则看这个字段） */
    provenance: 'generated',
    status: 'ready',
    url: String(item.url).trim(),
    assetId: item.assetId || '',
    name: String(item.name || launch.title || '工作台结果'),
    displayLabel: String(launch.title || '工作台结果').slice(0, 12),
    /* 与铺素材节点同一批几何字段（normalizeCanvasNode 还会补默认值） */
    x: Math.round(x),
    y: Math.round(topY + index * (card + rowGap)),
    w: card,
    h: card,
    rotation: 0,
    flipX: false,
    flipY: false,
    locked: false,
    hidden: false,
    editable: true,
    showMeta: true,
    /* 原路回工作台要用的两样（与 CY-⑨ 对称） */
    skillLabel: String(launch.title || ''),
    subpageSkillId: String(launch.skillId || ''),
    subpageDomain: 'image',
    ...(launch.prompt ? { prompt: String(launch.prompt) } : {}),
  }));
}
