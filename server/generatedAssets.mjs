import crypto from 'crypto';
import { link, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function getSafeHttpUrl(sourceUrl) {
  let parsed;
  try { parsed = new URL(sourceUrl); } catch { throw new Error('生成图片来源必须是 http(s) URL'); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('生成图片来源必须是 http(s) URL');
  }
  return parsed;
}

function assetNameFor(buffer, extension) {
  return `${crypto.createHash('sha256').update(buffer).digest('hex')}.${extension}`;
}

function integrityError(cause) {
  return Object.assign(new Error('生成图片稳定存储校验失败'), {
    code: 'GENERATED_ASSET_INTEGRITY_ERROR',
    ...(cause ? { cause } : {}),
  });
}

export function stableAssetDataUrl({ buffer, contentType } = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('生成图片内容为空');
  const mimeType = String(contentType || '').trim().toLowerCase();
  if (!MIME_EXTENSIONS[mimeType]) throw new Error('生成图片类型不受支持');
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

export function createGeneratedAssetStore({
  directory,
  publicPath = '/api/generated-assets',
  fetchImpl = fetch,
  maxBytes = MAX_IMAGE_BYTES,
} = {}) {
  if (!directory) throw new Error('generated asset directory is required');
  const root = resolve(directory);

  async function persist({ sourceUrl, taskId = '', label = '' } = {}) {
    getSafeHttpUrl(sourceUrl);
    const response = await fetchImpl(sourceUrl, { signal: AbortSignal.timeout(20000) });
    if (!response?.ok) throw new Error(`下载生成图片失败: ${response?.status || 'network error'}`);
    const mimeType = (response.headers?.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const extension = MIME_EXTENSIONS[mimeType];
    if (!extension) throw new Error('生成图片类型不受支持');
    const declaredLength = Number(response.headers?.get('content-length') || 0);
    if (declaredLength > maxBytes) throw new Error('生成图片文件过大');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > maxBytes) throw new Error('生成图片文件过大或为空');

    const fileName = assetNameFor(buffer, extension);
    await mkdir(root, { recursive: true });
    const filePath = resolve(root, fileName);
    try { await stat(filePath); } catch { await writeFile(filePath, buffer, { flag: 'wx' }); }
    return {
      id: fileName,
      fileName,
      taskId,
      label,
      contentType: mimeType,
      url: `${publicPath}/${fileName}`,
    };
  }

  async function persistBuffer({ buffer, contentType = 'image/png', taskId = '', label = '' } = {}) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('生成图片内容为空');
    if (!MIME_EXTENSIONS[contentType]) throw new Error('生成图片类型不受支持');
    if (buffer.length > maxBytes) throw new Error('生成图片文件过大');
    const extension = MIME_EXTENSIONS[contentType];
    const fileName = assetNameFor(buffer, extension);
    await mkdir(root, { recursive: true });
    const filePath = resolve(root, fileName);
    const tempPath = resolve(root, `.${fileName}.${crypto.randomUUID()}.tmp`);
    await writeFile(tempPath, buffer, { flag: 'wx' });
    try {
      try {
        await link(tempPath, filePath);
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
        let existing;
        try {
          existing = await readFile(filePath);
        } catch (readError) {
          throw integrityError(readError);
        }
        if (assetNameFor(existing, extension) !== fileName) throw integrityError();
      }
    } finally {
      try {
        await unlink(tempPath);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
    return {
      id: fileName,
      fileName,
      taskId,
      label,
      contentType,
      url: `${publicPath}/${fileName}`,
    };
  }

  async function read(assetId) {
    const safeName = basename(assetId || '');
    if (!/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(safeName)) return null;
    const filePath = resolve(root, safeName);
    try {
      const buffer = await readFile(filePath);
      const extension = safeName.split('.').pop();
      return { buffer, contentType: extension === 'jpg' ? 'image/jpeg' : `image/${extension}` };
    } catch { return null; }
  }

  async function persistAndRead(input = {}) {
    const asset = await persist(input);
    const stored = await read(asset.id);
    if (!stored) throw new Error('生成图片稳定落盘后读取失败');
    return { asset, ...stored };
  }

  return { persist, persistBuffer, persistAndRead, read };
}
