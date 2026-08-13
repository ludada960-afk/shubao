const ACTIONS = new Set(['retouch', 'extend', 'translate', 'upscale', 'move-scale']);

export function assertCanvasAction(action) {
  if (!ACTIONS.has(action)) throw new Error(`不支持的画布操作: ${action || 'unknown'}`);
  return action;
}

export function buildCanvasTransformPrompt({ action, prompt = '', targetLanguage = '中文', sourceBox, targetBox, rotation = 0 } = {}) {
  assertCanvasAction(action);
  const instruction = {
    retouch: '只修改用户描述的局部区域。商品主体、轮廓、材质、颜色、logo、文字位置和整体构图必须保持一致。',
    extend: '扩展画布边缘并补全自然背景。商品主体保持原比例、位置、细节和光影，不要复制或拉伸商品。',
    translate: `将画面中的可见文案翻译成${targetLanguage}，保持原有版式、字号层级、商品主体和视觉风格，不添加额外文案。`,
    upscale: '生成更清晰的电商交付图。只提升纹理、边缘和细节质量，不改变商品外观、比例、颜色、logo或版式。',
    'move-scale': `只移动或缩放原图归一化区域 ${JSON.stringify(sourceBox)} 内的完整对象，将它自然地放到归一化目标区域 ${JSON.stringify(targetBox)}，目标旋转 ${Number(rotation) || 0} 度。原位置用相邻背景自然补全；除这个对象外，商品、文字、logo、背景、画幅和其他内容必须保持不变。`,
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

export function parseVisionTextBlocks(raw = '') {
  const match = String(raw).match(/\{[\s\S]*\}/);
  if (!match) return [];
  let parsed;
  try { parsed = JSON.parse(match[0]); } catch { return []; }
  if (!Array.isArray(parsed?.blocks)) return [];
  return parsed.blocks
    .filter(block => block && typeof block.text === 'string' && block.text.trim())
    .slice(0, 40)
    .map((block, index) => ({
      id: String(block.id || `text-${index + 1}`).slice(0, 60),
      text: block.text.trim().slice(0, 400),
      x: clampUnit(block.x),
      y: clampUnit(block.y),
      width: clampUnit(block.width, 0.1),
      height: clampUnit(block.height, 0.08),
      color: /^#[0-9a-f]{6}$/i.test(String(block.color || '')) ? block.color : '#111111',
      background: /^#[0-9a-f]{6}$/i.test(String(block.background || '')) ? block.background : '#ffffff',
    }))
    .map(block => ({
      ...block,
      width: Math.min(block.width, 1 - block.x),
      height: Math.min(block.height, 1 - block.y),
    }))
    .filter(block => block.width > 0 && block.height > 0);
}

function clampUnit(value, fallback = 0) {
  const parsed = Number(value);
  return Math.min(1, Math.max(0, Number.isFinite(parsed) ? parsed : fallback));
}

function normalizeUnitBox(box) {
  if (!Array.isArray(box) || box.length !== 4) return null;
  const values = box.map(Number);
  if (!values.every(Number.isFinite)) return null;
  const [x, y, width, height] = values;
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.000001 || y + height > 1.000001) return null;
  return [clampUnit(x), clampUnit(y), Math.min(width, 1 - x), Math.min(height, 1 - y)];
}

function boxOverlapRatio(left, right) {
  if (!left || !right) return 0;
  const leftRight = left[0] + left[2];
  const leftBottom = left[1] + left[3];
  const rightRight = right[0] + right[2];
  const rightBottom = right[1] + right[3];
  const width = Math.max(0, Math.min(leftRight, rightRight) - Math.max(left[0], right[0]));
  const height = Math.max(0, Math.min(leftBottom, rightBottom) - Math.max(left[1], right[1]));
  return (width * height) / Math.max(Number.EPSILON, left[2] * left[3]);
}

function safeLayerId(value, fallback) {
  return String(value || fallback).trim().replace(/[^a-z0-9_-]/gi, '-').slice(0, 60) || fallback;
}

export function normalizeCanvasLayerPlan(raw = {}, { maxInstances = 8, maxTextBlocks = 20 } = {}) {
  const groupBox = normalizeUnitBox(raw?.productGroup?.box);
  const productGroup = groupBox ? {
    name: String(raw.productGroup?.name || '商品主体').trim().slice(0, 80) || '商品主体',
    box: groupBox,
    confidence: clampUnit(raw.productGroup?.confidence, 0.5),
  } : null;
  const instances = (Array.isArray(raw?.instances) ? raw.instances : [])
    .map((item, index) => {
      const box = normalizeUnitBox(item?.box);
      const confidence = clampUnit(item?.confidence, 0);
      const kind = String(item?.kind || '').trim().toLowerCase();
      if (!box || kind !== 'product' || confidence < 0.55) return null;
      if (productGroup && boxOverlapRatio(box, productGroup.box) < 0.2) return null;
      return {
        id: safeLayerId(item.id, `product-${index + 1}`),
        name: String(item.name || `商品 ${index + 1}`).trim().slice(0, 80) || `商品 ${index + 1}`,
        kind: 'product',
        box,
        confidence,
      };
    })
    .filter(Boolean)
    .slice(0, Math.max(1, Math.min(8, Number(maxInstances) || 8)));
  const textBlocks = (Array.isArray(raw?.textBlocks) ? raw.textBlocks : [])
    .map((block, index) => {
      const text = String(block?.text || '').trim().slice(0, 400);
      const box = normalizeUnitBox(block?.box);
      const confidence = clampUnit(block?.confidence, 0);
      if (!text || !box || confidence < 0.5) return null;
      return {
        id: safeLayerId(block.id, `text-${index + 1}`),
        text,
        box,
        confidence,
        color: /^#[0-9a-f]{6}$/i.test(String(block?.color || '')) ? block.color : '#111111',
        background: /^#[0-9a-f]{6}$/i.test(String(block?.background || '')) ? block.background : '#ffffff',
      };
    })
    .filter(Boolean)
    .slice(0, Math.max(1, Math.min(40, Number(maxTextBlocks) || 20)));
  return { productGroup, instances, textBlocks };
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

function gridGuidePixels(size, divisions, positions) {
  const internalCount = Math.max(0, divisions - 1);
  const values = Array.isArray(positions) && positions.length === internalCount
    ? positions.map(value => Number(value))
    : [];
  if (values.length !== internalCount || values.some(value => !Number.isFinite(value))) {
    return Array.from({ length: divisions + 1 }, (_, index) => Math.floor(size * index / divisions));
  }
  const normalized = values
    .map(value => Math.min(1, Math.max(0, value)))
    .sort((left, right) => left - right);
  const pixels = [0];
  for (let index = 0; index < normalized.length; index += 1) {
    const remaining = normalized.length - index;
    const requested = Math.round(normalized[index] * size);
    const minimum = pixels[index] + 1;
    const maximum = size - remaining;
    pixels.push(Math.min(maximum, Math.max(minimum, requested)));
  }
  pixels.push(size);
  return pixels;
}

export function gridRectsFromGuides(width, height, columns = 2, rows = 2, verticalPositions, horizontalPositions) {
  const safeWidth = Math.max(1, Math.round(Number(width) || 1));
  const safeHeight = Math.max(1, Math.round(Number(height) || 1));
  const safeColumns = Math.min(5, Math.max(1, Math.round(Number(columns) || 2)));
  const safeRows = Math.min(5, Math.max(1, Math.round(Number(rows) || 2)));
  const xBounds = gridGuidePixels(safeWidth, safeColumns, verticalPositions);
  const yBounds = gridGuidePixels(safeHeight, safeRows, horizontalPositions);
  const rects = [];
  for (let row = 0; row < safeRows; row += 1) {
    for (let column = 0; column < safeColumns; column += 1) {
      rects.push({
        left: xBounds[column],
        top: yBounds[row],
        width: xBounds[column + 1] - xBounds[column],
        height: yBounds[row + 1] - yBounds[row],
      });
    }
  }
  return rects;
}
