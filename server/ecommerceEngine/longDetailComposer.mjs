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
  for (const [index, buffer] of buffers.entries()) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error(`第 ${index + 1} 张详情图为空`);
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
  const encoded = await output.toBuffer({ resolveWithObject: true });
  if (!Buffer.isBuffer(encoded.data) || !encoded.data.length) throw new Error('详情长图输出为空');
  if (encoded.info.width !== width || encoded.info.height !== height) throw new Error('详情长图输出尺寸校验失败');
  const contentType = outputFormat === 'jpg' ? 'image/jpeg' : 'image/png';
  return {
    buffer: encoded.data,
    width,
    height,
    count: resized.length,
    format: outputFormat,
    contentType,
    byteSize: encoded.data.length,
  };
}

export async function composeAndPersistLongDetail({
  imageUrls,
  sourceIds = [],
  format = 'png',
  width = 1440,
} = {}, {
  imageInputReader,
  generatedAssetStore,
  sharpImpl = sharp,
} = {}) {
  if (!imageInputReader?.read) throw new Error('长图图片读取器未配置');
  if (!generatedAssetStore?.persistBuffer || !generatedAssetStore?.read) throw new Error('长图持久存储未配置');
  if (!Array.isArray(imageUrls) || imageUrls.length < 2) throw new Error('请至少提供 2 张详情图');
  if (imageUrls.length > 20) throw new Error('切片数不能超过 20');
  if (sourceIds.length && sourceIds.length !== imageUrls.length) throw new Error('详情图来源顺序无效');

  const buffers = [];
  for (const [index, url] of imageUrls.entries()) {
    if (typeof url !== 'string' || !url.trim()) throw new Error(`第 ${index + 1} 张详情图地址无效`);
    const image = await imageInputReader.read(url);
    if (!Buffer.isBuffer(image?.buffer) || !image.buffer.length) throw new Error(`第 ${index + 1} 张详情图为空`);
    buffers.push(image.buffer);
  }

  const composed = await composeLongDetail(buffers, { width, format, sharpImpl });
  const asset = await generatedAssetStore.persistBuffer({
    buffer: composed.buffer,
    contentType: composed.contentType,
    taskId: `ecommerce_long_detail_${Date.now()}`,
    label: 'ecommerce_long_detail',
  });
  const durable = await generatedAssetStore.read(asset.id);
  if (!durable?.buffer?.length) throw new Error('详情长图持久存储校验失败');
  if (durable.buffer.length !== composed.byteSize) throw new Error('详情长图持久存储大小不一致');

  return {
    id: asset.id,
    url: asset.url,
    width: composed.width,
    height: composed.height,
    count: composed.count,
    format: composed.format,
    contentType: composed.contentType,
    byteSize: composed.byteSize,
    sourceIds: sourceIds.length ? [...sourceIds] : imageUrls.map((_, index) => String(index + 1)),
  };
}
