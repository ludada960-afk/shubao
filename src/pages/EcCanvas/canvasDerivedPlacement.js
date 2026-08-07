function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boundsFor(node) {
  const x = finite(node?.x);
  const y = finite(node?.y);
  const width = Math.max(0, finite(node?.w ?? node?.width));
  const height = Math.max(0, finite(node?.h ?? node?.height));
  return { x, y, right: x + width, bottom: y + height };
}

function intersects(candidate, node, gap) {
  const bounds = boundsFor(node);
  return candidate.x < bounds.right + gap
    && candidate.x + candidate.width + gap > bounds.x
    && candidate.y < bounds.bottom + gap
    && candidate.y + candidate.height + gap > bounds.y;
}

export function placeDerivedRightOfSources({
  sources = [],
  occupied = [],
  width,
  height,
  gap = 80,
} = {}) {
  const outputWidth = finite(width);
  const outputHeight = finite(height);
  const spacing = Math.max(0, finite(gap));
  if (outputWidth <= 0 || outputHeight <= 0) throw new Error('派生图片尺寸无效');
  if (!Array.isArray(sources) || !sources.length) return { x: 0, y: 0 };

  const sourceBounds = sources.map(boundsFor);
  const union = {
    left: Math.min(...sourceBounds.map(item => item.x)),
    top: Math.min(...sourceBounds.map(item => item.y)),
    right: Math.max(...sourceBounds.map(item => item.right)),
  };
  const sourceIds = new Set(sources.map(source => source?.id).filter(Boolean));
  const blockers = (occupied || []).filter(node => !sourceIds.has(node?.id));

  for (let column = 0; column < 100; column += 1) {
    const candidate = {
      x: union.right + spacing + column * (outputWidth + spacing),
      y: union.top,
      width: outputWidth,
      height: outputHeight,
    };
    if (!blockers.some(node => intersects(candidate, node, 0))) {
      return { x: candidate.x, y: candidate.y };
    }
  }
  return { x: union.right + spacing, y: union.top + outputHeight + spacing };
}
