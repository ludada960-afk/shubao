export function zoomAroundCursor(viewport, point, factor) {
  const scale = Math.max(0.15, Math.min(4, viewport.scale * factor));
  const worldX = (point.x - viewport.x) / viewport.scale;
  const worldY = (point.y - viewport.y) / viewport.scale;
  return { scale, x: point.x - worldX * scale, y: point.y - worldY * scale };
}

export const ASSET_GROUPS = ['主图', '详情图', 'SKU', '素材'];

const ASSET_META = {
  white_bg: { name: '白底首图', group: '主图', role: '白底首图', ratio: '1:1', usage: '搜索结果首图，平台必备，白底突出产品，提升点击率' },
  main_text: { name: '场景主图', group: '主图', role: '场景主图', ratio: '1:1', usage: '搜索展示主力图，场景+卖点文案，吸引买家点击' },
  main_3x4: { name: '竖版主图', group: '主图', role: '竖版主图', ratio: '3:4', usage: '抖音/小红书竖版流量，竖版构图更沉浸，利于转化' },
  transparent: { name: '透明PNG素材', group: '素材', role: '透明PNG素材', ratio: '1:1', usage: '二次合成素材，可自由叠加任意背景，设计师必备' },
  sku: { name: 'SKU规格图', group: 'SKU', role: 'SKU规格图', ratio: '1:1', usage: '颜色/尺码选择器展示图，降低买家决策成本，减少退货' },
  detail_slice_size: { name: '尺寸标注图', group: '详情图', role: '尺寸标注图', ratio: '3:4', usage: '详情页尺寸背书，精准尺码参考，降低因尺码不符退货率' },
  detail_slice_scene: { name: '场景使用图', group: '详情图', role: '场景使用图', ratio: '3:4', usage: '真实使用场景展示，帮助买家代入使用感，提升购买欲' },
  detail_slice_qc: { name: '品质背书图', group: '详情图', role: '品质背书图', ratio: '3:4', usage: '品质信任背书，降低买家疑虑，适用于食品/母婴/医疗类' },
  detail_slice_compare: { name: '优势对比图', group: '详情图', role: '优势对比图', ratio: '3:4', usage: '与竞品直观对比，突出差异化卖点，提升转化' },
  detail_slice_feature: { name: '细节功能图', group: '详情图', role: '细节功能图', ratio: '3:4', usage: '产品细节/工艺放大展示，建立品质感知，支撑定价溢价' },
  detail_slice_care: { name: '使用维护图', group: '详情图', role: '使用维护图', ratio: '3:4', usage: '使用注意事项说明，减少因误用导致的差评和退货' },
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
  const h = input.h || (ratio === '3:4' ? Math.round(w * 4 / 3) : ratio === '长图' ? 300 : w);
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
  const minX = Math.min(...nodes.map(n => n.x));
  const minY = Math.min(...nodes.map(n => n.y));
  const maxX = Math.max(...nodes.map(n => n.x + n.w));
  const maxY = Math.max(...nodes.map(n => n.y + n.h + 60));
  const scale = Math.max(0.15, Math.min(1.5, Math.min(
    (rect.width - padding * 2) / Math.max(1, maxX - minX),
    (rect.height - padding * 2) / Math.max(1, maxY - minY),
  )));
  return { scale, x: (rect.width - (maxX - minX) * scale) / 2 - minX * scale, y: (rect.height - (maxY - minY) * scale) / 2 - minY * scale };
}

export function canStitch(nodes, selectedIds) {
  return [...selectedIds].filter(id => nodes.find(n => n.id === id)?.group === '详情图').length >= 2;
}

export function selectNodesInRect(nodes, rect) {
  const left = Math.min(rect.x, rect.x + rect.w);
  const right = Math.max(rect.x, rect.x + rect.w);
  const top = Math.min(rect.y, rect.y + rect.h);
  const bottom = Math.max(rect.y, rect.y + rect.h);
  return nodes.filter(node => {
    const nodeRight = node.x + (node.w || 0);
    const nodeBottom = node.y + (node.h || 0) + 60;
    return nodeRight >= left && node.x <= right && nodeBottom >= top && node.y <= bottom;
  }).map(node => node.id);
}

export function moveSelectedNodes(nodes, selectedIds, dx, dy) {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  return nodes.map(node => ids.has(node.id) ? { ...node, x: (node.x || 0) + dx, y: (node.y || 0) + dy } : node);
}

export function addConnection(connections, from, to, type = 'reference') {
  if (!from || !to || from === to) return connections;
  if (connections.some(edge => edge.from === from && edge.to === to && edge.type === type)) return connections;
  return [...connections, { from, to, type }];
}

export function removeConnectionsForNodes(connections, ids) {
  const set = ids instanceof Set ? ids : new Set(ids || []);
  return connections.filter(edge => !set.has(edge.from) && !set.has(edge.to));
}
