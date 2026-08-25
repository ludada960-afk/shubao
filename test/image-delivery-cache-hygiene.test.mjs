import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

import {
  createImageDelivery,
  resolveDerivativesMaxBytes,
  resolveProxyCacheTtlMs,
} from '../server/imageDelivery.mjs';

const HOUR_MS = 60 * 60 * 1000;
const DERIVATIVE_SWEEP_SETTLE_MS = 5_000;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function listDerivativeNames(root) {
  try {
    return (await readdir(root)).filter(name => !name.startsWith('.'));

  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

async function seedFile(filePath, size, mtimeMs) {
  await writeFile(filePath, Buffer.alloc(size, 0x61));
  const date = new Date(mtimeMs);
  await utimes(filePath, date, date);
}

async function waitFor(condition, timeoutMs = DERIVATIVE_SWEEP_SETTLE_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return true;
    await delay(25);
  }
  return condition();
}

test('env resolvers fall back to documented defaults', () => {
  assert.equal(resolveDerivativesMaxBytes(undefined), 2 * 1024 * 1024 * 1024);
  assert.equal(resolveDerivativesMaxBytes('not-a-number'), 2 * 1024 * 1024 * 1024);
  assert.equal(resolveDerivativesMaxBytes('-5'), 2 * 1024 * 1024 * 1024);
  assert.equal(resolveDerivativesMaxBytes('4096'), 4096);
  assert.equal(resolveProxyCacheTtlMs(undefined), 72 * HOUR_MS);
  assert.equal(resolveProxyCacheTtlMs('bogus'), 72 * HOUR_MS);
  assert.equal(resolveProxyCacheTtlMs('24'), 24 * HOUR_MS);
});

test('derivatives budget evicts oldest files first and always keeps the newest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shubao-derivatives-lru-'));
  try {
    const derivativeRoot = join(root, '.derivatives');
    await mkdir(derivativeRoot, { recursive: true });
    const now = Date.now();
    await seedFile(join(derivativeRoot, 'old-a.webp'), 100, now - 4_000);
    await seedFile(join(derivativeRoot, 'old-b.webp'), 200, now - 3_000);
    await seedFile(join(derivativeRoot, 'mid-c.webp'), 300, now - 2_000);
    await seedFile(join(derivativeRoot, 'new-d.webp'), 400, now - 1_000);
    const delivery = createImageDelivery({
      assetRoot: root,
      proxyCacheRoot: join(root, 'proxy'),
      derivativesMaxBytes: 600,
    });
    const summary = await delivery.enforceDerivativesBudget();
    assert.equal(summary.fileCount, 4);
    assert.equal(summary.totalBytes, 1000);
    // 1000 -> 删 100 -> 900 -> 删 200 -> 700 -> 删 300 -> 400 <= 600 停止
    assert.equal(summary.removedFiles, 3);
    assert.equal(summary.reclaimedBytes, 600);
    assert.deepEqual(await listDerivativeNames(derivativeRoot), ['new-d.webp']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('budget under the cap is a no-op', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shubao-derivatives-ok-'));
  try {
    const derivativeRoot = join(root, '.derivatives');
    await mkdir(derivativeRoot, { recursive: true });
    const now = Date.now();
    await seedFile(join(derivativeRoot, 'keep.webp'), 10, now - 1_000);
    const delivery = createImageDelivery({
      assetRoot: root,
      proxyCacheRoot: join(root, 'proxy'),
      derivativesMaxBytes: 2 * 1024 * 1024 * 1024,
    });
    const summary = await delivery.enforceDerivativesBudget();
    assert.equal(summary.removedFiles, 0);
    assert.equal(summary.reclaimedBytes, 0);
    assert.deepEqual(await listDerivativeNames(derivativeRoot), ['keep.webp']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('writing a derivative schedules an LRU sweep that drops stale cache files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shubao-derivatives-sweep-'));
  try {
    const id = 'd'.repeat(64) + '.png';
    await writeFile(join(root, id), await sharp({
      create: { width: 800, height: 600, channels: 3, background: '#123456' },
    }).png().toBuffer());
    const derivativeRoot = join(root, '.derivatives');
    await mkdir(derivativeRoot, { recursive: true });
    const stalePath = join(derivativeRoot, 'stale.v3.w640.webp');
    await seedFile(stalePath, 64, Date.now() - HOUR_MS);
    const delivery = createImageDelivery({
      assetRoot: root,
      proxyCacheRoot: join(root, 'proxy'),
      derivativesMaxBytes: 1, // 任何真实派生图都会超限，触发清扫
    });
    await delivery.readGeneratedVariant(id, 'thumb');
    const settled = await waitFor(async () => !(await readFileIfExists(stalePath)));
    assert.ok(settled, 'stale derivative should be swept after a new write');
    const names = await listDerivativeNames(derivativeRoot);
    assert.equal(names.length, 1, `only the freshly written derivative survives, got ${names.join(',')}`);
    assert.ok(!names.some(name => name.includes('.tmp-')), 'atomic write must not leave temp files');

  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function readFileIfExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;

    throw error;
  }
}

test('concurrent derivative writers stay within budget without corrupting reads', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shubao-derivatives-concurrent-'));
  try {
    // 注意：asset id 必须是 hex（safeAssetId 校验 [a-f0-9]{64}）
    const ids = ['ea', 'eb', 'ec'].map(prefix => prefix.repeat(32) + '.png');
    for (const id of ids) {
      await writeFile(join(root, id), await sharp({
        create: { width: 900, height: 700, channels: 3, background: '#654321' },
      }).png().toBuffer());
    }
    const delivery = createImageDelivery({
      assetRoot: root,
      proxyCacheRoot: join(root, 'proxy'),
      derivativesMaxBytes: 8 * 1024,
    });

    const results = await Promise.all(ids.map(id => delivery.readGeneratedVariant(id, 'thumb')));
    for (const result of results) {
      assert.equal(result.contentType, 'image/webp');
      assert.ok(result.buffer.length > 0);
    }

    const summary = await delivery.enforceDerivativesBudget();
    assert.ok(summary.totalBytes <= 8 * 1024, `budget respected: ${summary.totalBytes}`);
    assert.ok(summary.fileCount >= 1, 'newest derivative is never evicted outright');
    const names = await listDerivativeNames(join(root, '.derivatives'));
    assert.ok(names.every(name => !name.includes('.tmp-')), 'no temp leftovers after concurrent writes');

  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('pruneProxyCache deletes only files older than the TTL', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shubao-proxy-cache-ttl-'));
  try {
    const proxyRoot = join(root, 'cache_img');
    const localDir = join(proxyRoot, 'local');
    await mkdir(localDir, { recursive: true });
    const now = Date.now();
    await seedFile(join(proxyRoot, 'fresh.source'), 120, now - 1_000);
    await seedFile(join(proxyRoot, 'stale.source'), 240, now - 96 * HOUR_MS);
    await seedFile(join(localDir, 'nested.stale.webp'), 60, now - 80 * HOUR_MS);
    const delivery = createImageDelivery({ assetRoot: root, proxyCacheRoot: proxyRoot });
    const result = await delivery.pruneProxyCache({ maxAgeMs: 72 * HOUR_MS, nowMs: now });
    assert.equal(result.scannedFiles, 3);
    assert.equal(result.scannedBytes, 420);
    assert.equal(result.deletedFiles, 2);
    assert.equal(result.deletedBytes, 300);
    assert.deepEqual(await listDerivativeNames(proxyRoot).then(names => names.filter(name => name === 'fresh.source')), ['fresh.source']);
    let localRemaining = [];
    try {
      localRemaining = await readdir(localDir);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    assert.deepEqual(localRemaining, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('pruneProxyCache tolerates a missing cache directory and invalid ttl values', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shubao-proxy-cache-empty-'));
  try {
    const delivery = createImageDelivery({ assetRoot: root, proxyCacheRoot: join(root, 'missing') });
    const result = await delivery.pruneProxyCache({ maxAgeMs: Number.NaN });
    assert.deepEqual(result, { scannedFiles: 0, scannedBytes: 0, deletedFiles: 0, deletedBytes: 0 });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
