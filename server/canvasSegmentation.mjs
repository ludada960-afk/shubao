import sharp from 'sharp';

const LIGHT_BACKGROUND_TOLERANCE = 34;
const UNIFORM_BACKGROUND_TOLERANCE = 42;
const CORNER_CONSISTENCY_TOLERANCE = 28;
const MIN_SUBJECT_RATIO = 0.005;
const MIN_BACKGROUND_RATIO = 0.02;

function rgbDistance(r, g, b, reference) {
  return Math.hypot(r - reference.r, g - reference.g, b - reference.b);
}

function sampleCornerColors(data, info) {
  const { width, height, channels } = info;
  const patchSize = Math.max(1, Math.min(24, width, height, Math.floor(Math.min(width, height) * 0.06)));
  const corners = [
    [0, 0],
    [width - patchSize, 0],
    [0, height - patchSize],
    [width - patchSize, height - patchSize],
  ];
  const means = [];
  for (const [startX, startY] of corners) {
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let y = startY; y < startY + patchSize; y += 1) {
      for (let x = startX; x < startX + patchSize; x += 1) {
        const offset = (y * width + x) * channels;
        if (data[offset + 3] < 220) continue;
        r += data[offset];
        g += data[offset + 1];
        b += data[offset + 2];
        count += 1;
      }
    }
    if (!count) return null;
    means.push({ r: r / count, g: g / count, b: b / count });
  }
  return means;
}

function inferUniformBackground(data, info) {
  const means = sampleCornerColors(data, info);
  if (!means || means.length !== 4) return null;
  const reference = means.reduce((total, color) => ({
    r: total.r + color.r / means.length,
    g: total.g + color.g / means.length,
    b: total.b + color.b / means.length,
  }), { r: 0, g: 0, b: 0 });
  const consistent = means.every(color => rgbDistance(color.r, color.g, color.b, reference) <= CORNER_CONSISTENCY_TOLERANCE);
  return consistent ? reference : null;
}

export async function segmentUniformBackground(imageBuffer) {
  const { data, info } = await sharp(imageBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const totalPixels = width * height;
  const original = Buffer.from(data);
  const reference = inferUniformBackground(data, info);
  const isLightBackground = index => {
    const offset = index * channels;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const alpha = data[offset + 3];
    return alpha > 0 && r > 224 && g > 224 && b > 224 && Math.max(r, g, b) - Math.min(r, g, b) < LIGHT_BACKGROUND_TOLERANCE;
  };
  const isUniformBackground = index => {
    if (!reference) return false;
    const offset = index * channels;
    return data[offset + 3] > 0 && rgbDistance(data[offset], data[offset + 1], data[offset + 2], reference) <= UNIFORM_BACKGROUND_TOLERANCE;
  };
  const isBackground = index => isLightBackground(index) || isUniformBackground(index);
  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;
  const enqueue = index => {
    if (index < 0 || index >= totalPixels || visited[index] || !isBackground(index)) return;
    visited[index] = 1;
    queue[tail++] = index;
  };
  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x < width - 1) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y < height - 1) enqueue(index + width);
  }

  const subjectPixels = totalPixels - tail;
  const backgroundCoverage = tail / totalPixels;
  const segmented = tail > 0
    && subjectPixels >= Math.max(16, Math.ceil(totalPixels * MIN_SUBJECT_RATIO))
    && backgroundCoverage >= MIN_BACKGROUND_RATIO
    && backgroundCoverage <= 1 - MIN_SUBJECT_RATIO;
  const subjectData = Buffer.from(original);
  const backgroundData = Buffer.from(original);
  for (let index = 0; index < totalPixels; index += 1) {
    const alphaOffset = index * channels + 3;
    if (segmented) {
      if (visited[index]) subjectData[alphaOffset] = 0;
      else backgroundData[alphaOffset] = 0;
    } else {
      subjectData[alphaOffset] = original[alphaOffset];
      backgroundData[alphaOffset] = 0;
    }
  }

  return {
    subject: sharp(subjectData, { raw: { width, height, channels } }).png().toBuffer(),
    background: sharp(backgroundData, { raw: { width, height, channels } }).png().toBuffer(),
    segmented,
    method: segmented ? (reference ? 'uniform-border-flood-fill' : 'light-border-flood-fill') : 'none',
    backgroundCoverage,
  };
}

function maskError(code, message) {
  return Object.assign(new Error(message), { code, status: 422 });
}

function maskSummary(data, width, height) {
  let active = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let index = 0; index < data.length; index += 1) {
    if (data[index] < 16) continue;
    active += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!active) throw maskError('SEGMENTATION_MASK_EMPTY', '分割结果没有有效像素');
  const coverage = active / (width * height);
  if (coverage > 0.98 || coverage < 0.005) {
    throw maskError('SEGMENTATION_MASK_IMPLAUSIBLE', '分割结果覆盖范围不可信');
  }
  return {
    data,
    width,
    height,
    coverage,
    bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
  };
}

export async function normalizeSegmentationMask(maskBuffer, { width, height } = {}) {
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) {
    throw new TypeError('mask width and height are required');
  }
  const { data, info } = await sharp(maskBuffer, { failOn: 'error' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== width || info.height !== height) {
    throw maskError('SEGMENTATION_MASK_DIMENSIONS', '分割结果尺寸与源图不一致');
  }
  let transparent = 0;
  let opaque = 0;
  for (let index = 0; index < width * height; index += 1) {
    const alpha = data[index * info.channels + 3];
    if (alpha < 250) transparent += 1;
    if (alpha > 5) opaque += 1;
  }
  const hasMeaningfulAlpha = transparent > 0 && opaque > 0;
  const alpha = Buffer.alloc(width * height);
  for (let index = 0; index < alpha.length; index += 1) {
    const offset = index * info.channels;
    alpha[index] = hasMeaningfulAlpha
      ? data[offset + 3]
      : Math.max(data[offset], data[offset + 1], data[offset + 2]);
  }
  return maskSummary(alpha, width, height);
}

export function maskIntersectionOverUnion(left, right) {
  if (!left?.data || !right?.data || left.width !== right.width || left.height !== right.height) return 0;
  let intersection = 0;
  let union = 0;
  for (let index = 0; index < left.data.length; index += 1) {
    const leftActive = left.data[index] >= 16;
    const rightActive = right.data[index] >= 16;
    if (leftActive && rightActive) intersection += 1;
    if (leftActive || rightActive) union += 1;
  }
  return union ? intersection / union : 0;
}

export function unionSegmentationMasks(masks = []) {
  const first = masks[0];
  if (!first?.data || !masks.every(mask => mask.width === first.width && mask.height === first.height)) {
    throw new TypeError('compatible segmentation masks are required');
  }
  const data = Buffer.alloc(first.data.length);
  for (const mask of masks) {
    for (let index = 0; index < data.length; index += 1) data[index] = Math.max(data[index], mask.data[index]);
  }
  return maskSummary(data, first.width, first.height);
}

export async function segmentationMaskToPng(mask) {
  if (!mask?.data) throw new TypeError('segmentation mask is required');
  return sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } }).png().toBuffer();
}

export async function compositeMaskedAsset(sourceBuffer, mask) {
  if (!mask?.data || !mask?.bounds) throw new TypeError('segmentation mask is required');
  const { data, info } = await sharp(sourceBuffer, { failOn: 'error' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== mask.width || info.height !== mask.height) {
    throw maskError('SEGMENTATION_SOURCE_DIMENSIONS', '源图尺寸与分割结果不一致');
  }
  const output = Buffer.from(data);
  for (let index = 0; index < mask.data.length; index += 1) {
    const alphaOffset = index * info.channels + 3;
    output[alphaOffset] = Math.round(output[alphaOffset] * mask.data[index] / 255);
  }
  const full = sharp(output, { raw: { width: info.width, height: info.height, channels: info.channels } });
  const buffer = await full.extract({
    left: mask.bounds.x,
    top: mask.bounds.y,
    width: mask.bounds.width,
    height: mask.bounds.height,
  }).png().toBuffer();
  return {
    buffer,
    width: mask.bounds.width,
    height: mask.bounds.height,
    bounds: {
      x: mask.bounds.x / info.width,
      y: mask.bounds.y / info.height,
      width: mask.bounds.width / info.width,
      height: mask.bounds.height / info.height,
    },
  };
}
