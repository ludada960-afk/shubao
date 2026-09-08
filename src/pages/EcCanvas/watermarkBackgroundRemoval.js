/**
 * 图片水印「去纯色背景」(2026-09-08)
 * 浏览器端实现：取边缘像素估计背景色 → 按色彩距离生成带羽化的 alpha 通道。
 * 纯函数部分（estimateBackgroundColor / alphaForDistance）可单测；
 * 像素处理部分依赖 canvas，仅在浏览器执行。
 */

function clamp01(n) { return Math.min(1, Math.max(0, n)); }

function colorDistance(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  // 感知加权（近似 Rec.601）
  return Math.sqrt(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db);
}

/** 从采样像素中取中位数作为背景色估计（抗噪） */
export function estimateBackgroundColor(samples = []) {
  const list = samples.filter(s => s && Number.isFinite(s.r) && Number.isFinite(s.g) && Number.isFinite(s.b));
  if (!list.length) return { r: 255, g: 255, b: 255 };
  const median = key => {
    const values = list.map(s => s[key]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  };
  return { r: median('r'), g: median('g'), b: median('b') };
}

/**
 * 色彩距离 → alpha。
 * distance <= tolerance 全透明；tolerance..tolerance+feather 之间线性羽化；更远保持不透明。
 */
export function alphaForDistance(distance, tolerance = 32, feather = 16) {
  const t = Math.max(0, Number(tolerance) || 0);
  const f = Math.max(0, Number(feather) || 0);
  if (distance <= t) return 0;
  if (f === 0) return 1;
  return clamp01((distance - t) / f);
}

function readEdgeSamples(data, width, height, sampleStride = 2) {
  const samples = [];
  const push = (x, y) => {
    const idx = (y * width + x) * 4;
    samples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
  };
  const step = Math.max(1, Math.floor(sampleStride));
  for (let x = 0; x < width; x += step) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y += step) { push(0, y); push(width - 1, y); }
  return samples;
}

/**
 * 去除纯色背景，返回 PNG dataURL。
 * @param {string} src 图片地址（dataURL / blob / http）
 * @returns {Promise<{dataUrl:string,width:number,height:number,removedRatio:number,background:{r:number,g:number,b:number}}>}
 */
export async function removeSolidBackground(src, { tolerance = 36, feather = 18, sampleStride = 2 } = {}) {
  if (typeof document === 'undefined') throw new Error('去背景需要在浏览器中执行');
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败，无法去背景'));
    img.src = src;
  });
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) throw new Error('图片尺寸无效');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const background = estimateBackgroundColor(readEdgeSamples(data, width, height, sampleStride));
  let removed = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = alphaForDistance(colorDistance({ r: data[i], g: data[i + 1], b: data[i + 2] }, background), tolerance, feather);
    if (alpha <= 0.02) removed += 1;
    data[i + 3] = Math.round(data[i + 3] * alpha);
  }
  ctx.putImageData(imageData, 0, 0);
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width,
    height,
    removedRatio: removed / (width * height),
    background,
  };
}
