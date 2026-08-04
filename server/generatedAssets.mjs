import crypto from 'crypto';
import { link, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 20_000;
const DEFAULT_DOWNLOAD_RETRY_DELAYS_MS = Object.freeze([500, 1_500]);
const RETRYABLE_DOWNLOAD_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'ETIMEDOUT',
]);
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

function isRetryableDownloadError(error) {
  const name = String(error?.name || '').trim();
  const code = String(error?.code || '').trim().toUpperCase();
  return name === 'TimeoutError'
    || name === 'AbortError'
    || error instanceof TypeError
    || RETRYABLE_DOWNLOAD_CODES.has(code)
    || error?.retryable === true;
}

function retryableDownloadStatus(status) {
  return status === 408 || status === 425 || status === 429
    || (Number.isInteger(status) && status >= 500);
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
  readFileImpl = readFile,
  onPersist = null,
  downloadTimeoutMs = DEFAULT_DOWNLOAD_TIMEOUT_MS,
  retryDelaysMs = DEFAULT_DOWNLOAD_RETRY_DELAYS_MS,
  sleepImpl = milliseconds => new Promise(resolveSleep => setTimeout(resolveSleep, milliseconds)),
} = {}) {
  if (!directory) throw new Error('generated asset directory is required');
  if (typeof readFileImpl !== 'function') throw new TypeError('readFileImpl must be a function');
  if (!Number.isSafeInteger(downloadTimeoutMs) || downloadTimeoutMs <= 0
    || !Array.isArray(retryDelaysMs) || retryDelaysMs.length > 5
    || retryDelaysMs.some(delay => !Number.isSafeInteger(delay) || delay < 0)
    || typeof sleepImpl !== 'function') {
    throw new TypeError('generated asset download retry configuration is invalid');
  }
  const root = resolve(directory);

  async function notifyPersist(asset) {
    if (typeof onPersist !== 'function') return;
    try { await onPersist(asset); } catch {}
  }

  async function downloadAndPersist({ sourceUrl, taskId = '', label = '' } = {}) {
    getSafeHttpUrl(sourceUrl);
    let response;
    let buffer;
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
      try {
        response = await fetchImpl(sourceUrl, { signal: AbortSignal.timeout(downloadTimeoutMs) });
        if (!response?.ok) {
          const error = Object.assign(
            new Error(`下载生成图片失败: ${response?.status || 'network error'}`),
            { retryable: retryableDownloadStatus(response?.status) },
          );
          throw error;
        }
        buffer = Buffer.from(await response.arrayBuffer());
        break;
      } catch (error) {
        const retryable = isRetryableDownloadError(error);
        if (!retryable) throw error;
        if (attempt >= retryDelaysMs.length) {
          throw Object.assign(new Error('生成图片下载暂时不可用', { cause: error }), {
            code: 'GENERATED_ASSET_DOWNLOAD_UNAVAILABLE',
            retryable: true,
          });
        }
        await sleepImpl(retryDelaysMs[attempt]);
      }
    }
    const mimeType = (response.headers?.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const extension = MIME_EXTENSIONS[mimeType];
    if (!extension) throw new Error('生成图片类型不受支持');
    const declaredLength = Number(response.headers?.get('content-length') || 0);
    if (declaredLength > maxBytes) throw new Error('生成图片文件过大');
    if (!buffer.length || buffer.length > maxBytes) throw new Error('生成图片文件过大或为空');

    const fileName = assetNameFor(buffer, extension);
    await mkdir(root, { recursive: true });
    const filePath = resolve(root, fileName);
    try { await stat(filePath); } catch { await writeFile(filePath, buffer, { flag: 'wx' }); }
    const asset = {
      id: fileName,
      fileName,
      taskId,
      label,
      contentType: mimeType,
      url: `${publicPath}/${fileName}`,
    };
    await notifyPersist(asset);
    return { asset, buffer, contentType: mimeType };
  }

  async function persist(input = {}) {
    const { asset } = await downloadAndPersist(input);
    return asset;
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
          existing = await readFileImpl(filePath);
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
    const asset = {
      id: fileName,
      fileName,
      taskId,
      label,
      contentType,
      url: `${publicPath}/${fileName}`,
    };
    await notifyPersist(asset);
    return asset;
  }

  async function read(assetId) {
    const safeName = basename(assetId || '');
    if (!/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(safeName)) return null;
    const filePath = resolve(root, safeName);
    try {
      const buffer = await readFileImpl(filePath);
      const extension = safeName.split('.').pop();
      return { buffer, contentType: extension === 'jpg' ? 'image/jpeg' : `image/${extension}` };
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  }

  async function persistAndRead(input = {}) {
    return downloadAndPersist(input);
  }

  return { persist, persistBuffer, persistAndRead, read };
}
