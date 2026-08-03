const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));
const round = value => Math.round(value * 10000) / 10000;

export function normalizeCanvasPoint(point = {}) {
  return { x: round(clamp(point.x)), y: round(clamp(point.y)) };
}

export function normalizeCanvasCropRect(rect = {}) {
  const x = clamp(rect.x);
  const y = clamp(rect.y);
  const w = clamp(rect.w, 0, 1 - x);
  const h = clamp(rect.h, 0, 1 - y);
  return { x: round(x), y: round(y), w: round(w), h: round(h) };
}

export function createCanvasAnnotation(tool, start, options = {}) {
  const point = normalizeCanvasPoint(start);
  const base = {
    id: options.id || `annotation_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    tool,
    color: options.color || '#ef4444',
    width: clamp(options.width || 3, 1, 12),
  };
  if (tool === 'pen') return { ...base, points: [point] };
  if (tool === 'rectangle') return { ...base, originX: point.x, originY: point.y, x: point.x, y: point.y, w: 0, h: 0 };
  if (tool === 'arrow') return { ...base, x1: point.x, y1: point.y, x2: point.x, y2: point.y };
  return { ...base, x: point.x, y: point.y, text: String(options.text || '').trim() || '标注' };
}

export function updateCanvasAnnotation(annotation, nextPoint) {
  if (!annotation) return annotation;
  const point = normalizeCanvasPoint(nextPoint);
  if (annotation.tool === 'pen') return { ...annotation, points: [...(annotation.points || []), point] };
  if (annotation.tool === 'rectangle') {
    const originX = Number.isFinite(annotation.originX) ? annotation.originX : annotation.x;
    const originY = Number.isFinite(annotation.originY) ? annotation.originY : annotation.y;
    return {
      ...annotation,
      x: round(Math.min(originX, point.x)),
      y: round(Math.min(originY, point.y)),
      w: round(Math.abs(point.x - originX)),
      h: round(Math.abs(point.y - originY)),
    };
  }
  if (annotation.tool === 'arrow') return { ...annotation, x2: point.x, y2: point.y };
  return annotation;
}

function rectsOverlap(a, b, gap = 0) {
  return a.x < b.x + b.w + gap
    && a.x + a.w + gap > b.x
    && a.y < b.y + b.h + gap
    && a.y + a.h + gap > b.y;
}

export function findCanvasBlankPlacement({
  width,
  height,
  viewport = { x: 0, y: 0, scale: 1 },
  bounds = { width: 1200, height: 800 },
  nodes = [],
  sourceNode,
  preferred,
  gap = 28,
} = {}) {
  const scale = Math.max(0.05, Number(viewport.scale) || 1);
  const visible = {
    x: (0 - (Number(viewport.x) || 0)) / scale + 24,
    y: (0 - (Number(viewport.y) || 0)) / scale + 24,
    w: Math.max(0, (Number(bounds.width) || 1200) / scale - 48),
    h: Math.max(0, (Number(bounds.height) || 800) / scale - 48),
  };
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const maxX = Math.max(visible.x, visible.x + visible.w - w);
  const maxY = Math.max(visible.y, visible.y + visible.h - h);
  const clampCandidate = candidate => ({
    x: round(clamp(candidate.x, visible.x, maxX)),
    y: round(clamp(candidate.y, visible.y, maxY)),
  });
  const occupied = nodes
    .filter(node => node && node.hidden !== true)
    .map(node => ({ x: Number(node.x) || 0, y: Number(node.y) || 0, w: Number(node.w) || 1, h: Number(node.h) || 1 }));
  const available = candidate => !occupied.some(rect => rectsOverlap({ ...candidate, w, h }, rect, gap));
  const candidates = [];
  if (preferred && Number.isFinite(preferred.x) && Number.isFinite(preferred.y)) {
    candidates.push(
      preferred,
      { x: preferred.x + w + gap, y: preferred.y },
      { x: preferred.x - w - gap, y: preferred.y },
      { x: preferred.x, y: preferred.y + h + gap },
      { x: preferred.x, y: preferred.y - h - gap },
    );
  }
  if (sourceNode) {
    candidates.push(
      { x: sourceNode.x + sourceNode.w + gap, y: sourceNode.y },
      { x: sourceNode.x, y: sourceNode.y + sourceNode.h + gap },
      { x: sourceNode.x - w - gap, y: sourceNode.y },
      { x: sourceNode.x, y: sourceNode.y - h - gap },
    );
  }
  const stepX = Math.max(120, Math.min(w + gap, 320));
  const stepY = Math.max(100, Math.min(h + gap, 260));
  for (let y = visible.y; y <= maxY; y += stepY) {
    for (let x = visible.x; x <= maxX; x += stepX) candidates.push({ x, y });
  }
  for (const candidate of candidates) {
    const normalized = clampCandidate(candidate);
    if (available(normalized)) return normalized;
  }
  return clampCandidate(candidates[0] || { x: visible.x, y: visible.y });
}
