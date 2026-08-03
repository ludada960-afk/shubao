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
