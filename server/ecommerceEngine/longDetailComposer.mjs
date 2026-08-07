import sharp from 'sharp';

const FORMATS = new Set(['png', 'jpg']);

export async function composeLongDetail(buffers = [], {
  width = 1440,
  maxHeight = 30_000,
  format = 'png',
  sharpImpl = sharp,
} = {}) {
  if (!Array.isArray(buffers) || buffers.length < 2) throw new Error('请至少提供 2 张详情图');
  if (buffers.length > 20) throw new Error('切片数不能超过 20');
  if (!Number.isSafeInteger(width) || width < 1 || width > 4096) throw new Error('长图宽度无效');
  if (!Number.isSafeInteger(maxHeight) || maxHeight < 1) throw new Error('长图高度限制无效');
  const outputFormat = String(format || 'png').toLowerCase() === 'jpeg' ? 'jpg' : String(format || 'png').toLowerCase();
  if (!FORMATS.has(outputFormat)) throw new Error('长图格式仅支持 PNG 或 JPG');

  const resized = [];
  for (const buffer of buffers) {
    const result = await sharpImpl(buffer, { failOn: 'error', limitInputPixels: 80_000_000 })
      .rotate()
      .resize({ width, withoutEnlargement: false, kernel: 'lanczos3' })
      .png({ compressionLevel: 6 })
      .toBuffer({ resolveWithObject: true });
    if (!result.info.height) throw new Error('详情切片尺寸无效');
    resized.push(result);
  }

  const height = resized.reduce((sum, item) => sum + item.info.height, 0);
  if (height > maxHeight) throw new Error(`拼接后长图过高（${height}px），请减少切片数`);
  let top = 0;
  const composites = resized.map(item => {
    const layer = { input: item.data, top, left: 0 };
    top += item.info.height;
    return layer;
  });
  let output = sharpImpl({
    create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).composite(composites);
  output = outputFormat === 'jpg'
    ? output.flatten({ background: '#ffffff' }).jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    : output.png({ compressionLevel: 9, adaptiveFiltering: false });
  const buffer = await output.toBuffer();
  return { buffer, width, height, count: resized.length, format: outputFormat };
}
