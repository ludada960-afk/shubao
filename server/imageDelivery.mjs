import crypto from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import sharp from 'sharp';

const MAX_PROXY_BYTES = 20 * 1024 * 1024;
const VARIANTS = Object.freeze({
  thumb: Object.freeze({ width: 360, quality: 74 }),
  canvas: Object.freeze({ width: 960, quality: 82 }),
});

function safeAssetId(assetId = '') {
  const id = basename(String(assetId));
  return /^[a-f0-9]{64}\.(?:jpg|png|webp)$/i.test(id) ? id : '';
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isSafeRemoteImageUrl(value) {
  let url;
  try { url = new URL(value); } catch { return false; }
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1') return false;
  if (/^(?:0|127)\./.test(host) || /^169\.254\./.test(host) || /^10\./.test(host)) return false;
  if (/^192\.168\./.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)) return false;
  return true;
}

function contentTypeIsImage(contentType = '') {
  return String(contentType).split(';')[0].trim().toLowerCase().startsWith('image/');
}

function cachePath(root, key, extension) {
  return join(root, `${key}.${extension}`);
}

async function readIfPresent(filePath) {
  try { return await readFile(filePath); } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeOnce(filePath, buffer) {
  try {
    await writeFile(filePath, buffer, { flag: 'wx' });
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
  }
}

export function imageVariantUrl(url, variant = 'full') {
  const value = typeof url === 'object' ? (url?.url || url?.src || url?.image_url || '') : String(url || '');
  if (!value || variant === 'full' || value.startsWith('data:') || value.startsWith('blob:')) return value;
  if (value.startsWith('/api/generated-assets/') || value.startsWith('/api/gallery-image')) {
    return `${value}${value.includes('?') ? '&' : '?'}variant=${encodeURIComponent(variant)}`;
  }
  if (/^https?:\/\//i.test(value)) {
    return `/api/proxy-image?url=${encodeURIComponent(value)}&variant=${encodeURIComponent(variant)}`;
  }
  return value;
}

export function createImageDelivery({
  assetRoot,
  proxyCacheRoot,
  fetchImpl = fetch,
  maxProxyBytes = MAX_PROXY_BYTES,
} = {}) {
  if (!assetRoot || !proxyCacheRoot) throw new Error('assetRoot and proxyCacheRoot are required');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const generatedRoot = resolve(assetRoot);
  const proxyRoot = resolve(proxyCacheRoot);
  const pending = new Map();

  async function fileMetadata(filePath) {
    try { return await stat(filePath); } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  }

  function contentTypeForPath(filePath) {
    const extension = extname(filePath).slice(1).toLowerCase();
    return extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : `image/${extension || 'png'}`;
  }

  async function coalesce(key, work) {
    if (pending.has(key)) return pending.get(key);
    const promise = Promise.resolve().then(work).finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  }

  async function renderVariant(buffer, variant) {
    if (variant === 'full') return { buffer, contentType: 'application/octet-stream' };
    const config = VARIANTS[variant];
    if (!config) throw new Error('unsupported image variant');
    const output = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({ width: config.width, withoutEnlargement: true })
      .webp({ quality: config.quality, effort: 4 })
      .toBuffer();
    return { buffer: output, contentType: 'image/webp' };
  }

  async function readGeneratedVariant(assetId, variant = 'full') {
    const id = safeAssetId(assetId);
    if (!id) return null;
    const originalPath = join(generatedRoot, id);
    if (!await fileMetadata(originalPath)) return null;
    if (variant === 'full') {
      return { buffer: await readFile(originalPath), contentType: contentTypeForPath(originalPath) };
    }
    if (!VARIANTS[variant]) return null;
    const derivativeRoot = join(generatedRoot, '.derivatives');
    const derivativePath = cachePath(derivativeRoot, `${id}.${variant}`, 'webp');
    const cached = await readIfPresent(derivativePath);
    if (cached) return { buffer: cached, contentType: 'image/webp' };
    return coalesce(`generated:${id}:${variant}`, async () => {
      const existing = await readIfPresent(derivativePath);
      if (existing) return { buffer: existing, contentType: 'image/webp' };
      const original = await readFile(originalPath);
      const rendered = await renderVariant(original, variant);
      await mkdir(derivativeRoot, { recursive: true });
      await writeOnce(derivativePath, rendered.buffer);
      return rendered;
    });
  }

  async function prewarmGeneratedVariants(assetId, variants = Object.keys(VARIANTS)) {
    const requested = [...new Set(variants)].filter(variant => VARIANTS[variant]);
    await Promise.all(requested.map(variant => readGeneratedVariant(assetId, variant)));
  }

  async function readLocalVariant(filePath, variant = 'full') {
    const localPath = resolve(filePath);
    const metadata = await fileMetadata(localPath);
    if (!metadata) return null;
    if (variant === 'full') {
      return { buffer: await readFile(localPath), contentType: contentTypeForPath(localPath) };
    }
    if (!VARIANTS[variant]) return null;
    const key = hash(`${localPath}\0${metadata.size}\0${metadata.mtimeMs}`);
    const derivativeRoot = join(proxyRoot, 'local');
    const derivativePath = cachePath(derivativeRoot, `${key}.${variant}`, 'webp');
    const cached = await readIfPresent(derivativePath);
    if (cached) return { buffer: cached, contentType: 'image/webp' };
    return coalesce(`local:${key}:${variant}`, async () => {
      const existing = await readIfPresent(derivativePath);
      if (existing) return { buffer: existing, contentType: 'image/webp' };
      const rendered = await renderVariant(await readFile(localPath), variant);
      await mkdir(derivativeRoot, { recursive: true });
      await writeOnce(derivativePath, rendered.buffer);
      return rendered;
    });
  }

  async function readProxySource(url) {
    if (!isSafeRemoteImageUrl(url)) throw new Error('invalid remote image URL');
    const key = hash(url);
    const sourcePath = cachePath(proxyRoot, key, 'source');
    const metaPath = cachePath(proxyRoot, key, 'json');
    const cached = await readIfPresent(sourcePath);
    if (cached) {
      const metadata = await readIfPresent(metaPath);
      const contentType = metadata ? JSON.parse(metadata.toString('utf8')).contentType : 'application/octet-stream';
      return { key, buffer: cached, contentType };
    }
    return coalesce(`proxy-source:${key}`, async () => {
      const current = await readIfPresent(sourcePath);
      if (current) {
        const metadata = await readIfPresent(metaPath);
        return { key, buffer: current, contentType: metadata ? JSON.parse(metadata.toString('utf8')).contentType : 'application/octet-stream' };
      }
      let nextUrl = url;
      let response;
      for (let redirects = 0; redirects <= 3; redirects += 1) {
        if (!isSafeRemoteImageUrl(nextUrl)) throw new Error('invalid remote image URL');
        response = await fetchImpl(nextUrl, { signal: AbortSignal.timeout(20_000), redirect: 'manual' });
        const status = Number(response?.status || 0);
        if (status < 300 || status >= 400) break;
        const location = response.headers?.get?.('location');
        if (!location) throw new Error('remote image redirect is invalid');
        nextUrl = new URL(location, nextUrl).toString();
        response = null;
      }
      if (!response) throw new Error('remote image redirect limit exceeded');
      if (!response?.ok) throw new Error(`image source returned ${response?.status || 'network error'}`);
      const contentType = response.headers?.get?.('content-type') || '';
      if (!contentTypeIsImage(contentType)) throw new Error('remote response is not an image');
      const declaredLength = Number(response.headers?.get?.('content-length') || 0);
      if (declaredLength > maxProxyBytes) throw new Error('remote image exceeds size limit');
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length || buffer.length > maxProxyBytes) throw new Error('remote image exceeds size limit');
      await mkdir(proxyRoot, { recursive: true });
      await writeOnce(sourcePath, buffer);
      await writeOnce(metaPath, Buffer.from(JSON.stringify({ contentType })));
      return { key, buffer, contentType };
    });
  }

  async function readProxyVariant(url, variant = 'full') {
    const source = await readProxySource(url);
    if (variant === 'full') return { buffer: source.buffer, contentType: source.contentType };
    if (!VARIANTS[variant]) throw new Error('unsupported image variant');
    const derivativePath = cachePath(proxyRoot, `${source.key}.${variant}`, 'webp');
    const cached = await readIfPresent(derivativePath);
    if (cached) return { buffer: cached, contentType: 'image/webp' };
    return coalesce(`proxy:${source.key}:${variant}`, async () => {
      const existing = await readIfPresent(derivativePath);
      if (existing) return { buffer: existing, contentType: 'image/webp' };
      const rendered = await renderVariant(source.buffer, variant);
      await writeOnce(derivativePath, rendered.buffer);
      return rendered;
    });
  }

  return { readGeneratedVariant, prewarmGeneratedVariants, readLocalVariant, readProxyVariant };
}
