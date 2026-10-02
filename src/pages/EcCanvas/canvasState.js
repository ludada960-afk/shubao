/* 批 CY-㊴：框选要按"节点真实占位"判（含 footer），不再用写死的 +60。
   这条 import 只为 selectNodesInRect 服务，别把它挪去别处。 */
import { canvasNodeFootprint } from './canvasMediaFitModel.js';
/* 2026-10-02：fitViewport / readableInitialViewport 原先自己写死 `n.h + 60`，
   与「整卡高度」的另一个口径又对不上。统一走 footprint（含 footer、按 showMeta 分支）。 */

export function getCanvasPointerIntent({ tool = 'select', button = 0, altKey = false, spaceKey = false, isInteractive = false } = {}) {
  if (isInteractive) return 'ignore';
  if (button === 1) return 'pan';
  if (button !== 0) return 'ignore';
  if (tool === 'hand' || altKey || spaceKey) return 'pan';
  return 'marquee';
}

export function getNodePointerIntent({ tool = 'select', button = 0 } = {}) {
  if (button !== 0) return 'ignore';
  return tool === 'hand' ? 'select' : 'drag';
}

export function canvasCursorForState({ tool = 'select', pointerKind = null, spaceKey = false } = {}) {
  if (pointerKind === 'pan') return 'grabbing';
  if (pointerKind === 'marquee') return 'crosshair';
  if (tool === 'hand' || spaceKey) return 'grab';
  return 'default';
}

export function bindNonPassiveWheel(element, handler) {
  if (!element?.addEventListener || !handler) return () => {};
  const options = { passive: false };
  element.addEventListener('wheel', handler, options);
  return () => element.removeEventListener('wheel', handler, options);
}

export function zoomAroundCursor(viewport, point, factor) {
  const scale = Math.max(0.15, Math.min(4, viewport.scale * factor));
  const worldX = (point.x - viewport.x) / viewport.scale;
  const worldY = (point.y - viewport.y) / viewport.scale;
  return { scale, x: point.x - worldX * scale, y: point.y - worldY * scale };
}

export function zoomPreviewByWheel(scale, deltaY) {
  const factor = deltaY < 0 ? 1.15 : 0.87;
  return Math.max(0.5, Math.min(4, Number((scale * factor).toFixed(2))));
}

export const ASSET_GROUPS = ['白底图', '主图', '详情图', 'SKU', '素材'];

const ASSET_META = {
  white_bg: { name: '白底首图', group: '白底图', role: '白底首图', ratio: '1:1', usage: '搜索结果首图，平台必备，白底突出产品，提升点击率' },
  main_text: { name: '场景主图', group: '主图', role: '场景主图', ratio: '1:1', usage: '搜索展示主力图，场景+卖点文案，吸引买家点击' },
  main_3x4: { name: '竖版主图', group: '主图', role: '竖版主图', ratio: '3:4', usage: '抖音/小红书竖版流量，竖版构图更沉浸，利于转化' },
  transparent: { name: '透明PNG素材', group: '素材', role: '透明PNG素材', ratio: '1:1', usage: '二次合成素材，可自由叠加任意背景，设计师必备' },
  sku: { name: 'SKU规格图', group: 'SKU', role: 'SKU规格图', ratio: '1:1', usage: '颜色/尺码选择器展示图，降低买家决策成本，减少退货' },
  detail_slice_size: { name: '尺寸标注图', group: '详情图', role: '尺寸标注图', ratio: '9:16', usage: '详情页尺寸背书，精准尺码参考，降低因尺码不符退货率' },
  detail_slice_scene: { name: '场景使用图', group: '详情图', role: '场景使用图', ratio: '9:16', usage: '真实使用场景展示，帮助买家代入使用感，提升购买欲' },
  detail_slice_qc: { name: '品质背书图', group: '详情图', role: '品质背书图', ratio: '9:16', usage: '品质信任背书，降低买家疑虑，适用于食品/母婴/医疗类' },
  detail_slice_compare: { name: '优势对比图', group: '详情图', role: '优势对比图', ratio: '9:16', usage: '与竞品直观对比，突出差异化卖点，提升转化' },
  detail_slice_feature: { name: '细节功能图', group: '详情图', role: '细节功能图', ratio: '9:16', usage: '产品细节/工艺放大展示，建立品质感知，支撑定价溢价' },
  detail_slice_care: { name: '使用维护图', group: '详情图', role: '使用维护图', ratio: '9:16', usage: '使用注意事项说明，减少因误用导致的差评和退货' },
  detail_long: { name: '详情长图', group: '详情图', role: '详情长图', ratio: '长图', usage: '将多张详情切片合成为一张可交付长图' },
};

export function getAssetMeta(sourceKey = '') {
  const baseKey = String(sourceKey).replace(/_\d+$/, '');
  const meta = ASSET_META[baseKey];
  if (meta) return meta;
  return { name: sourceKey || '电商素材', group: '素材', role: '电商素材', ratio: '1:1', usage: '' };
}

export function normalizeAsset(input = {}, index = 0, counters = {}) {
  const sourceKey = input.sourceKey || input.key || input.label || `image_${index + 1}`;
  const meta = getAssetMeta(sourceKey);
  const roleCounter = (counters[meta.role] || 0) + 1;
  counters[meta.role] = roleCounter;
  const suffix = roleCounter > 1 || String(sourceKey).match(/_\d+$/) ? `-${String(roleCounter).padStart(2, '0')}` : '-01';
  const name = input.name || `${meta.name}${suffix}`;
  const ratio = input.ratio || meta.ratio;
  const w = input.w || 200;
  const h = input.h || (ratio === '3:4' ? Math.round(w * 4 / 3) : ratio === '9:16' ? Math.round(w * 16 / 9) : ratio === '长图' ? 300 : w);
  return {
    id: input.id || `asset_${sourceKey}_${index}`,
    assetId: input.assetId || `asset_${sourceKey}_${index}`,
    url: input.url || input.src || input.image_url || '',
    name,
    group: ASSET_GROUPS.includes(input.group) ? input.group : meta.group,
    role: input.role || meta.role,
    ratio,
    usage: input.usage || meta.usage,
    sourceKey,
    sourceDirectionId: input.sourceDirectionId,
    provenance: input.provenance || input.assetOrigin,
    sequence: input.sequence ?? input.planSequence ?? input.shotSequence ?? input.shotIndex ?? input.generationIndex,
    derivedFromIds: Array.isArray(input.derivedFromIds) ? [...input.derivedFromIds] : undefined,
    sourceNodeIds: Array.isArray(input.sourceNodeIds) ? [...input.sourceNodeIds] : undefined,
    editable: input.editable !== false,
    x: input.x ?? 0,
    y: input.y ?? 0,
    w,
    h,
    label: input.label || sourceKey,
    displayLabel: name,
    size: input.size || '',
    rotation: input.rotation || 0,
    loaded: Boolean(input.loaded),
  };
}

export function fitViewport(nodes, rect, padding = 56) {
  if (!nodes.length || !rect?.width || !rect?.height) return null;
  /* 2026-10-02：原先是 `n.y + n.h + 60`。那个 60 是"猜的 footer + 行距"，
     而 footer 的真值就在 canvasNodeFootprint 里（还会按 showMeta 分支）——
     两处各猜一次，就必然对不上，表现为「适应画布后底部被切掉一截」。
     现在整卡高度只有 footprint 一个口径。 */
  const boxes = nodes.map(canvasNodeFootprint).filter(Boolean);
  const minX = Math.min(...boxes.map(n => n.x));
  const minY = Math.min(...boxes.map(n => n.y));
  const maxX = Math.max(...boxes.map(n => n.x + n.w));
  const maxY = Math.max(...boxes.map(n => n.y + n.h));
  const scale = Math.max(0.15, Math.min(1.5, Math.min(
    (rect.width - padding * 2) / Math.max(1, maxX - minX),
    (rect.height - padding * 2) / Math.max(1, maxY - minY),
  )));
  return { scale, x: (rect.width - (maxX - minX) * scale) / 2 - minX * scale, y: (rect.height - (maxY - minY) * scale) / 2 - minY * scale };
}

export function readableInitialViewport(nodes, rect, { padding = 72, minScale = 0.68 } = {}) {
  const fitted = fitViewport(nodes, rect, padding);
  if (!fitted || fitted.scale >= minScale) return fitted;
  const boxes = nodes.map(canvasNodeFootprint).filter(Boolean);
  const minX = Math.min(...boxes.map(node => node.x));
  const minY = Math.min(...boxes.map(node => node.y));
  const maxX = Math.max(...boxes.map(node => node.x + node.w));
  const scale = minScale;
  return {
    scale,
    x: (rect.width - (maxX - minX) * scale) / 2 - minX * scale,
    y: padding - minY * scale,
  };
}

export function canStitch(nodes, selectedIds) {
  return [...selectedIds].filter(id => nodes.find(n => n.id === id)?.group === '详情图').length >= 2;
}

/* ═══ 批 CY-㊴（2026-10-01）：框选口径 = **完整框住**才选中 ═══════════════════════
   用户原话（澄清后）：「我选中了右边三张图，你的拖动框选却没有把最下面的图
     **完整选中**呀。…这下面为什么还是漏了一些呀？」
   ⇒ 他要的不是"碰到就选"，而是"**整个节点都在框里才选中**"。

   走过的两步，都要记下来：
   ① 原来底边写的是 `node.y + node.h + 60` —— 一个**写死的 60px**，
      "节点占位要算上 footer"的真值其实早就存在（`canvasNodeFootprint`，
      footer 34px 且按 showMeta 分支），不是这项的根因。
   ② 真正的根因是**相交即选**：框的下沿压到节点上面一点点，它就整块变选中态，
      而蓝色框选矩形并没有盖住它 —— 用户看到的就是"框没盖满，却被选中了"。

   ⚠️ 这里推翻了 `test/canvas-interaction-model.test.mjs` 里
   「marquee selection includes **intersecting** nodes only」那条门禁 ——
   那是**旧口径**（相交即选），与用户现在的要求相反。门禁已同步改写为
   「必须完整框住」，并保留"矩形方向无关、隐藏节点不参与"这两个真正要守的性质。
   ============================================================================ */
export function selectNodesInRect(nodes, rect) {
  const left = Math.min(rect.x, rect.x + rect.w);
  const right = Math.max(rect.x, rect.x + rect.w);
  const top = Math.min(rect.y, rect.y + rect.h);
  const bottom = Math.max(rect.y, rect.y + rect.h);
  return nodes.filter(node => {
    if (node?.hidden) return false;
    const box = canvasNodeFootprint(node);
    if (!box) return false;
    /* 完整包含：四条边都落在框内（用户要的"完整选中"） */
    return box.x >= left && box.x + box.w <= right
      && box.y >= top && box.y + box.h <= bottom;
  }).map(node => node.id);
}

/* ═══ 批 CY-㊴ 之十七（2026-10-01）：视口裁剪 ═══════════════════════════════════════
   用户原话：「整个网站各个地方进行操作，都会有所延迟」。

   画布世界是 6400×4800，而 `visibleNodes` 原来**只是个分组过滤**（按 group），
   屏外的节点 DOM 一样全量渲染、全量重渲染。节点一多，每次交互都在为看不见的东西付钱。

   这里按"节点占位是否与可视矩形相交"来筛。

   ⚠️ **overscan（外扩）是必须的，不是优化**：没有它，节点在屏幕边缘**刚要进来 / 刚要出去**
   的那一帧会突然出现 / 消失（pop）。外扩一圈让节点在真正露脸前就已经在 DOM 里。
   经验值取一屏的 25%。

   ⚠️ **相交即保留**（不是"完整在视口内"）—— 与框选那条"完整框住才选"的规则**故意相反**：
     框选是用户主动表达"我要这些"，必须精确；
     裁剪只是"别渲染看不见的东西"，半个身位露出来就该渲染，否则会被切一半。

   ⚠️ 隐藏节点（hidden）一律不返回 —— 它们本来就不该占渲染开销。 */
export const CANVAS_CULL_OVERSCAN_RATIO = 0.25;

export function canvasViewportWorldRect(viewport, visibleSize, overscanRatio = CANVAS_CULL_OVERSCAN_RATIO) {
  const scale = Number(viewport?.scale) > 0 ? Number(viewport.scale) : 1;
  const width = Number(visibleSize?.width) > 0 ? Number(visibleSize.width) : 1440;
  const height = Number(visibleSize?.height) > 0 ? Number(visibleSize.height) : 900;
  const marginX = width * overscanRatio;
  const marginY = height * overscanRatio;
  /* viewport.x/y 是"世界坐标 → 屏幕"的平移量：屏幕 0 对应世界 -x/scale */
  return {
    left: (-Number(viewport?.x || 0) - marginX) / scale,
    top: (-Number(viewport?.y || 0) - marginY) / scale,
    right: (-Number(viewport?.x || 0) + width + marginX) / scale,
    bottom: (-Number(viewport?.y || 0) + height + marginY) / scale,
  };
}

export function canvasNodesInViewport(nodes, worldRect, pinnedIds = null) {
  if (!worldRect) return nodes;
  return nodes.filter(node => {
    if (node?.hidden) return false;
    /* ⚠️ **被"钉住"的节点一律保留**，哪怕完全在视口外。
       因为有一类功能是**通过 DOM 查询**去找节点的 —— 例如文字编辑：
         containerRef.current?.querySelector(`[data-canvas-node-id="${editingTextNodeId}"] [contenteditable="true"]`)
       节点一旦被裁掉，那次查询就落空，表现为"点进去编辑，光标不出现"。
       与其逐个去补这些例外，不如把"当前正在用的节点"全部钉住 ——
       它们最多也就十几个，渲染开销可以忽略，却能让裁剪这件事**没有例外**。 */
    if (pinnedIds?.has(node.id)) return true;
    const box = canvasNodeFootprint(node);
    if (!box) return false;
    return box.x + box.w >= worldRect.left && box.x <= worldRect.right
      && box.y + box.h >= worldRect.top && box.y <= worldRect.bottom;
  });
}

export function moveSelectedNodes(nodes, selectedIds, dx, dy) {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  return nodes.map(node => ids.has(node.id) && !node.locked
    ? { ...node, x: (node.x || 0) + dx, y: (node.y || 0) + dy }
    : node);
}

export function addConnection(connections, from, to, type = 'reference') {
  if (!from || !to || from === to) return connections;
  if (connections.some(edge => {
    const edgeFrom = edge.fromNodeId || edge.from;
    const edgeTo = edge.toNodeId || edge.to;
    const edgeRelation = edge.relation || edge.type;
    return edgeFrom === from && edgeTo === to && edgeRelation === type;
  })) return connections;
  return [...connections, {
    id: `edge_${from}_${to}_${type}`,
    fromNodeId: from,
    fromPort: 'output',
    toNodeId: to,
    toPort: 'input',
    relation: type,
    from,
    to,
    type,
  }];
}

export function removeConnectionsForNodes(connections, ids) {
  const set = ids instanceof Set ? ids : new Set(ids || []);
  return connections.filter(edge => {
    const from = edge.fromNodeId || edge.from;
    const to = edge.toNodeId || edge.to;
    return !set.has(from) && !set.has(to);
  });
}
