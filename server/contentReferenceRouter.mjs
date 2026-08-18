export const CONTENT_REFERENCE_LIMITS = Object.freeze({
  style: 3,
  source: 6,
});

function cleanImageList(value, limit) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map(item => {
      if (typeof item === 'string') return item.trim();
      return String(item?.url || item?.data || '').trim();
    })
    .filter(Boolean))]
    .slice(0, limit);
}

export function normalizeReferenceGroups(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const nested = source.referenceAssets && typeof source.referenceAssets === 'object'
    ? source.referenceAssets
    : {};
  const styleInput = Array.isArray(nested.style) ? nested.style : (
    Array.isArray(source.style) ? source.style : source.referenceAssetIds
  );
  const sourceInput = Array.isArray(nested.source) ? nested.source : source.source;
  return {
    style: cleanImageList(styleInput, CONTENT_REFERENCE_LIMITS.style),
    source: cleanImageList(sourceInput, CONTENT_REFERENCE_LIMITS.source),
  };
}

function sourceStartIndex(task, length) {
  const index = Number.isInteger(task?.index) ? task.index : 1;
  return Math.max(0, (index - 1) % Math.max(1, length));
}

export function selectSourceInputs({ groups, task } = {}) {
  const source = normalizeReferenceGroups(groups).source;
  if (!source.length) return [];
  const use = String(task?.reference_use || task?.referenceUse || '').trim().toLowerCase();
  if (!use || use === 'none' || use === 'style' || use === 'tone') return [];
  if (String(task?.id || '').toLowerCase() === 'cover') return source.slice(0, 3);

  const start = sourceStartIndex(task, source.length);
  const first = source[start];
  if (use === 'comparison' || use === 'collage') {
    const second = source[(start + 1) % source.length];
    return [...new Set([first, second])];
  }
  return first ? [first] : [];
}

export function referenceUsageLabel(groups = {}) {
  const normalized = normalizeReferenceGroups(groups);
  if (normalized.source.length && normalized.style.length) {
    return '保留我的素材主体，并借鉴风格参考的色调、光线和构图';
  }
  if (normalized.source.length) return '保留我的素材主体，按主题生成不同场景和镜头';
  if (normalized.style.length) return '借鉴风格参考的色调、光线和构图；本组按主题自由生成';
  return '不使用参考图，按主题和文字描述自由生成';
}
