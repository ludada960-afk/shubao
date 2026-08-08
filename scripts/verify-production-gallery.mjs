import { readdir, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GALLERY_FILE_MAP, GALLERY_IMAGE_EXTENSIONS } from '../server/galleryCatalog.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const galleryRoot = resolve(projectRoot, '薯包出品');
const sourceOnly = process.argv.includes('--source-only');
const baseUrlArg = process.argv.find((value, index) => process.argv[index - 1] === '--base-url');
const baseUrl = String(baseUrlArg || 'https://shuimg.cn').replace(/\/$/, '');

async function catalogEntries() {
  const entries = [];
  for (const [id, folder] of Object.entries(GALLERY_FILE_MAP)) {
    const directory = resolve(galleryRoot, folder);
    const files = (await readdir(directory))
      .filter(file => GALLERY_IMAGE_EXTENSIONS.has(extname(file).toLowerCase()) && !/_backup\./i.test(file))
      .sort((left, right) => left.localeCompare(right, 'zh-CN'));
    if (!files.length) throw new Error(`Gallery case ${id} has no images`);
    for (const file of files) {
      const metadata = await stat(resolve(directory, file));
      if (!metadata.isFile() || metadata.size < 1000) throw new Error(`Gallery asset is empty: ${id}/${file}`);
      entries.push({ id, file });
    }
  }
  if (entries.length !== 117) throw new Error(`Gallery asset count mismatch: expected 117, received ${entries.length}`);
  return entries;
}

async function fetchImage(entry, variant, format, method = 'GET') {
  const url = new URL('/api/gallery-image', baseUrl);
  url.searchParams.set('id', entry.id);
  url.searchParams.set('file', entry.file);
  url.searchParams.set('variant', variant);
  url.searchParams.set('format', format);
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        signal: AbortSignal.timeout(30_000),
        headers: { 'cache-control': 'no-cache' },
      });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.startsWith('image/')) {
        throw new Error(`${response.status} ${contentType || 'missing content type'}`);
      }
      if (method === 'GET') {
        const body = await response.arrayBuffer();
        if (body.byteLength < 1000) throw new Error(`empty image (${body.byteLength} bytes)`);
      }
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolveDelay => setTimeout(resolveDelay, 500 * (2 ** attempt)));
    }
  }
  throw new Error(`Gallery delivery failed for ${entry.id}/${entry.file} ${variant}/${format}: ${lastError?.message || lastError}`);
}

async function runPool(items, worker, concurrency = 8) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await worker(item);
    }
  }));
}

const entries = await catalogEntries();
if (!sourceOnly) {
  await runPool(entries, entry => fetchImage(entry, 'thumb', 'webp'));
  const warmups = entries.flatMap(entry => ['w640', 'w960', 'display'].map(variant => ({ entry, variant })));
  await runPool(warmups, item => fetchImage(item.entry, item.variant, 'avif', 'HEAD'));
}

process.stdout.write(`Gallery verification passed (${entries.length} images${sourceOnly ? ', source only' : ''})\n`);
