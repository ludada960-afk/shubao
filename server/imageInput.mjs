import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
const GENERATED_ASSET_RE = /^\/api\/generated-assets\/([a-f0-9]{64}\.(?:jpg|jpeg|png|webp))$/i;
const TEMP_IMAGE_RE = /^\/api\/ec-temp-img\/([^/]+)$/i;
const DATA_IMAGE_RE = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i;

const EXTENSION_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

function contentTypeForName(name) {
  return EXTENSION_TYPES[path.extname(name).slice(1).toLowerCase()] || 'application/octet-stream';
}

function ensureBufferSize(buffer, maxBytes) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error('图片为空');
  if (buffer.length > maxBytes) throw new Error('图片文件过大');
  return buffer;
}

function decodeDataUrl(value, maxBytes) {
  const match = String(value).match(DATA_IMAGE_RE);
  if (!match) throw new Error('图片格式无效');
  const buffer = ensureBufferSize(Buffer.from(match[2].replace(/\s/g, ''), 'base64'), maxBytes);
  return { buffer, contentType: match[1].toLowerCase() };
}

function safeTempPath(tempUploadDir, encodedName) {
  let name;
  try { name = decodeURIComponent(encodedName); } catch { throw new Error('图片地址无效'); }
  if (!/^[a-z0-9][a-z0-9_.-]*$/i.test(name)) throw new Error('图片地址无效');
  const root = path.resolve(tempUploadDir);
  const target = path.resolve(root, name);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error('图片地址无效');
  return target;
}

async function fetchImage(url, fetchImpl, maxBytes) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('图片地址无效'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('图片地址无效');
  const response = await fetchImpl(parsed.href, {
    headers: { 'User-Agent': 'ShubaoAI/2.0' },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`读取图片失败（${response.status}）`);
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > maxBytes) throw new Error('图片文件过大');
  const buffer = ensureBufferSize(Buffer.from(await response.arrayBuffer()), maxBytes);
  const contentType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0].toLowerCase();
  if (!contentType.startsWith('image/')) throw new Error('远程地址不是图片');
  return { buffer, contentType };
}

export function createImageInputReader({ generatedAssetStore, tempUploadDir, fetchImpl = fetch, maxBytes = DEFAULT_MAX_BYTES } = {}) {
  if (!generatedAssetStore?.read) throw new Error('generatedAssetStore.read is required');
  if (!tempUploadDir) throw new Error('tempUploadDir is required');

  return {
    async read(input) {
      if (typeof input !== 'string' || !input.trim()) throw new Error('缺少图片');
      const source = input.trim();
      if (source.startsWith('data:')) return decodeDataUrl(source, maxBytes);

      const generatedMatch = source.match(GENERATED_ASSET_RE);
      if (generatedMatch) {
        const asset = await generatedAssetStore.read(generatedMatch[1]);
        if (!asset?.buffer) throw new Error('生成图片已失效');
        return {
          buffer: ensureBufferSize(asset.buffer, maxBytes),
          contentType: asset.contentType || contentTypeForName(generatedMatch[1]),
        };
      }

      const tempMatch = source.match(TEMP_IMAGE_RE);
      if (tempMatch) {
        const target = safeTempPath(tempUploadDir, tempMatch[1]);
        try {
          const buffer = ensureBufferSize(await fs.readFile(target), maxBytes);
          return { buffer, contentType: contentTypeForName(target) };
        } catch (error) {
          if (error?.code === 'ENOENT') throw new Error('临时图片不存在');
          throw error;
        }
      }

      if (source.startsWith('/')) throw new Error('不支持的图片地址');
      return fetchImage(source, fetchImpl, maxBytes);
    },
  };
}

export function imageBufferToDataUrl({ buffer, contentType = 'image/png' }) {
  return `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`;
}

export { DEFAULT_MAX_BYTES };
