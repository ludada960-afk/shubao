const ACTIONS = new Set(['retouch', 'extend', 'translate', 'upscale']);

export function assertCanvasAction(action) {
  if (!ACTIONS.has(action)) throw new Error(`不支持的画布操作: ${action || 'unknown'}`);
  return action;
}

export function buildCanvasTransformPrompt({ action, prompt = '', targetLanguage = '中文' } = {}) {
  assertCanvasAction(action);
  const instruction = {
    retouch: '只修改用户描述的局部区域。商品主体、轮廓、材质、颜色、logo、文字位置和整体构图必须保持一致。',
    extend: '扩展画布边缘并补全自然背景。商品主体保持原比例、位置、细节和光影，不要复制或拉伸商品。',
    translate: `将画面中的可见文案翻译成${targetLanguage}，保持原有版式、字号层级、商品主体和视觉风格，不添加额外文案。`,
    upscale: '生成更清晰的电商交付图。只提升纹理、边缘和细节质量，不改变商品外观、比例、颜色、logo或版式。',
  }[action];
  return [
    'Create a polished ecommerce product image from the supplied reference.',
    instruction,
    'Keep the product identity exact and do not invent additional products.',
    prompt.trim() || '按照上述操作完成优化。',
  ].join('\n');
}

export function parseVisionLayers(raw = '') {
  const match = String(raw).match(/\{[\s\S]*\}/);
  if (!match) return [];
  let parsed;
  try { parsed = JSON.parse(match[0]); } catch { return []; }
  if (!Array.isArray(parsed?.layers)) return [];
  return parsed.layers
    .filter(layer => layer && typeof layer.name === 'string')
    .slice(0, 8)
    .map(layer => ({
      name: layer.name.trim().slice(0, 40),
      description: String(layer.description || '').trim().slice(0, 240),
    }))
    .filter(layer => layer.name);
}

export function analyzeSceneCapabilities({ layers = [] } = {}) {
  return {
    semanticAnalysis: Array.isArray(layers),
    pixelLayers: false,
    psdExport: false,
  };
}

export function cropRectForRatio(width, height, ratio) {
  const target = {
    '1:1': 1,
    '3:4': 3 / 4,
    '4:3': 4 / 3,
    '9:16': 9 / 16,
  }[ratio] || width / height;
  const current = width / height;
  if (Math.abs(current - target) < 0.001) return { left: 0, top: 0, width, height };
  if (current > target) {
    const nextWidth = Math.max(1, Math.round(height * target));
    return { left: Math.floor((width - nextWidth) / 2), top: 0, width: nextWidth, height };
  }
  const nextHeight = Math.max(1, Math.round(width / target));
  return { left: 0, top: Math.floor((height - nextHeight) / 2), width, height: nextHeight };
}

export function gridRects(width, height, columns = 2, rows = 2) {
  const rects = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const left = Math.floor(width * column / columns);
      const top = Math.floor(height * row / rows);
      const right = Math.floor(width * (column + 1) / columns);
      const bottom = Math.floor(height * (row + 1) / rows);
      rects.push({ left, top, width: right - left, height: bottom - top });
    }
  }
  return rects;
}
