import crypto from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import sharp from 'sharp';

const MAX_PROXY_BYTES = 20 * 1024 * 1024;
const DELIVERY_VERSION = 'v3';
const VARIANTS = Object.freeze({
  w320: Object.freeze({ width: 320, webpQuality: 90, avifQuality: 78 }),
  w640: Object.freeze({ width: 640, webpQuality: 90, avifQuality: 78 }),
  w960: Object.freeze({ width: 960, webpQuality: 91, avifQuality: 79 }),
  w1600: Object.freeze({ width: 1600, webpQuality: 92, avifQuality: 80 }),
});
const VARIANT_ALIASES = Object.freeze({ thumb: 'w640', canvas: 'w960', display: 'w1600' });
const OUTPUT_FORMATS = new Set(['webp', 'avif']);
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_DERIVATIVES_MAX_BYTES = 2 * 1024 * 1024 * 1024;
const DEFAULT_PROXY_CACHE_TTL_MS = 72 * HOUR_MS;
const DERIVATIVE_SWEEP_MIN_INTERVAL_MS = 30_000;

export function resolveDerivativesMaxBytes(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_DERIVATIVES_MAX_BYTES;
}

export function resolveProxyCacheTtlMs(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed * HOUR_MS) : DEFAULT_PROXY_CACHE_TTL_MS;
}

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

function canonicalVariant(variant = 'full') {
  const value = String(variant || 'full');
  return VARIANT_ALIASES[value] || value;
}

function normalizedFormat(format = 'webp') {
  const value = String(format || 'webp').toLowerCase();
  return OUTPUT_FORMATS.has(value) ? value : '';
}

function appendVariantParams(value, variant, format) {
  const params = [`variant=${encodeURIComponent(variant)}`];
  if (format && format !== 'webp') params.push(`format=${encodeURIComponent(format)}`);
  params.push('v=3');
  return `${value}${value.includes('?') ? '&' : '?'}${params.join('&')}`;
}

export function imageVariantUrl(url, variant = 'full', format = 'webp') {
  const value = typeof url === 'object' ? (url?.url || url?.src || url?.image_url || '') : String(url || '');
  if (!value || variant === 'full' || value.startsWith('data:') || value.startsWith('blob:')) return value;
  const outputFormat = normalizedFormat(format);
  if (!outputFormat) return value;
  if (value.startsWith('/api/generated-assets/') || value.startsWith('/api/gallery-image')) {
    return appendVariantParams(value, variant, outputFormat);
  }
  if (/^https?:\/\//i.test(value)) {
    return appendVariantParams(`/api/proxy-image?url=${encodeURIComponent(value)}`, variant, outputFormat);
  }
  return value;
}

export function createImageDelivery({
  assetRoot,
  proxyCacheRoot,
  fetchImpl = fetch,
  maxProxyBytes = MAX_PROXY_BYTES,
  derivativesMaxBytes = resolveDerivativesMaxBytes(process.env.DERIVATIVES_MAX_BYTES),
} = {}) {
  if (!assetRoot || !proxyCacheRoot) throw new Error('assetRoot and proxyCacheRoot are required');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const generatedRoot = resolve(assetRoot);
  const proxyRoot = resolve(proxyCacheRoot);
  const derivativeRoot = join(generatedRoot, '.derivatives');
  const derivativesCapBytes = resolveDerivativesMaxBytes(derivativesMaxBytes);
  const pending = new Map();

  let derivativeSweepChain = Promise.resolve();
  let derivativeSweepLastRunAt = 0;

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

  // 原子落盘：先写临时文件再 rename，读方永远不会看到半张图，跨进程并发也安全。
  async function writeAtomic(filePath, buffer) {
    const tempPath = filePath + '.tmp-' + process.pid + '-' + crypto.randomBytes(6).toString('hex');
    try {
      await writeFile(tempPath, buffer, { flag: 'wx' });
      await rename(tempPath, filePath);
    } finally {
      await rm(tempPath, { force: true }).catch(() => {});
    }
  }

  async function collectDerivativeEntries(rootDir) {
    const entries = [];
    const walk = async dir => {
      let dirents;
      try {
        dirents = await readdir(dir, { withFileTypes: true });
      } catch (error) {
        if (error?.code === 'ENOENT') return;
        throw error;
      }
      for (const dirent of dirents) {
        const childPath = join(dir, dirent.name);
        if (dirent.isDirectory()) {
          await walk(childPath);
          continue;
        }
        if (!dirent.isFile()) continue;
        const stats = await stat(childPath).catch(error => (error?.code === 'ENOENT' ? null : Promise.reject(error)));
        if (stats) entries.push({ path: childPath, size: stats.size, mtimeMs: stats.mtimeMs });
      }
    };
    await walk(rootDir);
    return entries;
  }

  // .derivatives 容量上限（DERIVATIVES_MAX_BYTES）：超出时按 mtime 从旧到新删除，永远保留最新一个文件。
  async function enforceDerivativesBudget() {
    const entries = await collectDerivativeEntries(derivativeRoot);
    const totalBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
    const summary = { fileCount: entries.length, totalBytes, removedFiles: 0, reclaimedBytes: 0 };
    if (totalBytes <= derivativesCapBytes || entries.length <= 1) return summary;
    const oldestFirst = [...entries].sort((left, right) => left.mtimeMs - right.mtimeMs || (left.path < right.path ? -1 : 1));
    let remainingBytes = totalBytes;
    for (let index = 0; index < oldestFirst.length - 1 && remainingBytes > derivativesCapBytes; index += 1) {
      const entry = oldestFirst[index];
      try {
        await rm(entry.path, { force: true });
      } catch {
        continue;
      }
      remainingBytes -= entry.size;
      summary.removedFiles += 1;
      summary.reclaimedBytes += entry.size;
    }
    return summary;
  }

  // 写入路径惰性触发；节流避免每次派生都全目录扫描。
  function scheduleDerivativesBudgetSweep() {
    const nowMs = Date.now();
    if (nowMs - derivativeSweepLastRunAt < DERIVATIVE_SWEEP_MIN_INTERVAL_MS) return;
    derivativeSweepLastRunAt = nowMs;
    derivativeSweepChain = derivativeSweepChain.then(() => enforceDerivativesBudget()).catch(() => {});
  }

  // cache_img 外链代理缓存 TTL 清理（PROXY_CACHE_TTL_HOURS），由 index.mjs 的每日 retention sweep 调用。
  async function pruneProxyCache({ maxAgeMs = resolveProxyCacheTtlMs(process.env.PROXY_CACHE_TTL_HOURS), nowMs = Date.now() } = {}) {
    const requestedMaxAgeMs = Number(maxAgeMs);
    const ageLimitMs = Number.isFinite(requestedMaxAgeMs) && requestedMaxAgeMs > 0
      ? Math.floor(requestedMaxAgeMs)
      : DEFAULT_PROXY_CACHE_TTL_MS;
    const cutoffMs = Number(nowMs) - ageLimitMs;
    const entries = await collectDerivativeEntries(proxyRoot);
    const result = { scannedFiles: entries.length, scannedBytes: 0, deletedFiles: 0, deletedBytes: 0 };
    for (const entry of entries) {
      result.scannedBytes += entry.size;
      if (entry.mtimeMs >= cutoffMs) continue;
      try {
        await rm(entry.path, { force: true });
      } catch {
        continue;
      }
      result.deletedFiles += 1;
      result.deletedBytes += entry.size;
    }
    return result;
  }

  async function renderVariant(buffer, variant, format = 'webp') {
    if (variant === 'full') return { buffer, contentType: 'application/octet-stream' };
    const canonical = canonicalVariant(variant);
    const config = VARIANTS[canonical];
    if (!config) throw new Error('unsupported image variant');
    const outputFormat = normalizedFormat(format);
    if (!outputFormat) throw new Error('unsupported image format');
    let pipeline = sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({ width: config.width, withoutEnlargement: true });
    pipeline = outputFormat === 'avif'
      ? pipeline.avif({ quality: config.avifQuality, effort: 2 })
      : pipeline.webp({ quality: config.webpQuality, effort: 4, smartSubsample: true });
    return { buffer: await pipeline.toBuffer(), contentType: `image/${outputFormat}` };
  }

  async function readGeneratedVariant(assetId, variant = 'full', format = 'webp') {
    const id = safeAssetId(assetId);
    if (!id) return null;
    const originalPath = join(generatedRoot, id);
    if (!await fileMetadata(originalPath)) return null;
    if (variant === 'full') {
      return { buffer: await readFile(originalPath), contentType: contentTypeForPath(originalPath) };
    }
    const canonical = canonicalVariant(variant);
    const outputFormat = normalizedFormat(format);
    if (!VARIANTS[canonical] || !outputFormat) return null;
    const derivativeRoot = join(generatedRoot, '.derivatives');
    const derivativePath = cachePath(derivativeRoot, `${id}.${DELIVERY_VERSION}.${canonical}`, outputFormat);
    const cached = await readIfPresent(derivativePath);
    if (cached) return { buffer: cached, contentType: `image/${outputFormat}` };
    return coalesce(`generated:${id}:${canonical}:${outputFormat}`, async () => {
      const existing = await readIfPresent(derivativePath);
      if (existing) return { buffer: existing, contentType: `image/${outputFormat}` };
      const original = await readFile(originalPath);
      const rendered = await renderVariant(original, canonical, outputFormat);
      await mkdir(derivativeRoot, { recursive: true });
      await writeAtomic(derivativePath, rendered.buffer);
      scheduleDerivativesBudgetSweep();
      return rendered;
    });
  }

  async function prewarmGeneratedVariants(assetId, variants = ['thumb', 'canvas'], formats = ['webp', 'avif']) {
    const requested = [...new Set(variants)].filter(variant => VARIANTS[canonicalVariant(variant)]);
    const requestedFormats = [...new Set(formats)].filter(format => normalizedFormat(format));
    await Promise.all(requested.flatMap(variant => requestedFormats.map(format => readGeneratedVariant(assetId, variant, format))));
  }

  async function readLocalVariant(filePath, variant = 'full', format = 'webp') {
    const localPath = resolve(filePath);
    const metadata = await fileMetadata(localPath);
    if (!metadata) return null;
    if (variant === 'full') {
      return { buffer: await readFile(localPath), contentType: contentTypeForPath(localPath) };
    }
    const canonical = canonicalVariant(variant);
    const outputFormat = normalizedFormat(format);
    if (!VARIANTS[canonical] || !outputFormat) return null;
    const key = hash(`${localPath}\0${metadata.size}\0${metadata.mtimeMs}`);
    const derivativeRoot = join(proxyRoot, 'local');
    const derivativePath = cachePath(derivativeRoot, `${key}.${DELIVERY_VERSION}.${canonical}`, outputFormat);
    const cached = await readIfPresent(derivativePath);
    if (cached) return { buffer: cached, contentType: `image/${outputFormat}` };
    return coalesce(`local:${key}:${canonical}:${outputFormat}`, async () => {
      const existing = await readIfPresent(derivativePath);
      if (existing) return { buffer: existing, contentType: `image/${outputFormat}` };
      const rendered = await renderVariant(await readFile(localPath), canonical, outputFormat);
      await mkdir(derivativeRoot, { recursive: true });
      await writeOnce(derivativePath, rendered.buffer);
      return rendered;
    });
  }

  async function prewarmLocalVariants(requests = [], { concurrency = 2 } = {}) {
    const jobs = [];
    for (const request of requests) {
      const filePath = request?.filePath;
      if (!filePath) continue;
      const variants = request.variants || ['thumb'];
      const formats = request.formats || ['avif'];
      for (const variant of variants) {
        for (const format of formats) jobs.push({ filePath, variant, format });
      }
    }
    let cursor = 0;
    const worker = async () => {
      while (cursor < jobs.length) {
        const job = jobs[cursor];
        cursor += 1;
        try {
          await readLocalVariant(job.filePath, job.variant, job.format);
        } catch {
          // A corrupt source must not prevent the remaining gallery images from warming.
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(Number(concurrency) || 1, jobs.length || 1)) }, worker));
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

  async function readProxyVariant(url, variant = 'full', format = 'webp') {
    const source = await readProxySource(url);
    if (variant === 'full') return { buffer: source.buffer, contentType: source.contentType };
    const canonical = canonicalVariant(variant);
    const outputFormat = normalizedFormat(format);
    if (!VARIANTS[canonical]) throw new Error('unsupported image variant');
    if (!outputFormat) throw new Error('unsupported image format');
    const derivativePath = cachePath(proxyRoot, `${source.key}.${DELIVERY_VERSION}.${canonical}`, outputFormat);
    const cached = await readIfPresent(derivativePath);
    if (cached) return { buffer: cached, contentType: `image/${outputFormat}` };
    return coalesce(`proxy:${source.key}:${canonical}:${outputFormat}`, async () => {
      const existing = await readIfPresent(derivativePath);
      if (existing) return { buffer: existing, contentType: `image/${outputFormat}` };
      const rendered = await renderVariant(source.buffer, canonical, outputFormat);
      await writeOnce(derivativePath, rendered.buffer);
      return rendered;
    });
  }

  return {
    readGeneratedVariant,
    prewarmGeneratedVariants,
    readLocalVariant,
    prewarmLocalVariants,
    readProxyVariant,
    enforceDerivativesBudget,
    pruneProxyCache,
  };
}
