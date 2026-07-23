export function zoomAroundCursor(viewport, point, factor) {
  const scale = Math.max(0.15, Math.min(4, viewport.scale * factor));
  const worldX = (point.x - viewport.x) / viewport.scale;
  const worldY = (point.y - viewport.y) / viewport.scale;
  return { scale, x: point.x - worldX * scale, y: point.y - worldY * scale };
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
  return [...selectedIds].filter(id => nodes.find(n => n.id === id)?.group === '详情').length >= 2;
}
