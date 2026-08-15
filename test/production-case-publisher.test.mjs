import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import sharp from 'sharp';

import {
  importCase,
  resolveCoverStrategy,
} from '../scripts/import-ecommerce-gallery-case.mjs';

const output = (index) => ({
  id: `output-${index}`,
  role: 'detail',
  title: `真实详情图 ${index}`,
  prompt: `精确生成提示词 ${index}`,
  url: `${String(index).padStart(2, '0')}.png`,
  taskId: `task-${index}`,
  requestKey: `request-${index}`,
  quoteId: `quote-${index}`,
  ratio: '3:4',
});

test('auto cover uses a mosaic only for a complete image suite', () => {
  assert.equal(resolveCoverStrategy('auto', 1), 'single');
  assert.equal(resolveCoverStrategy('auto', 3), 'single');
  assert.equal(resolveCoverStrategy('auto', 4), 'mosaic');
  assert.equal(resolveCoverStrategy('single', 8), 'single');
  assert.equal(resolveCoverStrategy('mosaic', 2), 'mosaic');
});

test('manifest import preserves exact prompts, production provenance, and source assets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shubao-case-publisher-'));
  const input = join(root, 'input');
  const gallery = join(root, 'gallery');
  await import('node:fs/promises').then(({ mkdir }) => mkdir(input, { recursive: true }));
  const outputs = [1, 2, 3, 4].map(output);
  for (let index = 1; index <= outputs.length; index += 1) {
    await sharp({ create: { width: 300, height: 400, channels: 3, background: { r: 235, g: 226 - index, b: 210 } } })
      .png()
      .toFile(join(input, `${String(index).padStart(2, '0')}.png`));
  }
  const manifest = {
    id: 'production-earbuds',
    title: '真实耳机生产套图',
    category: '电商套图',
    prompt: '生成统一的完整耳机套图',
    sourceAssets: [{ id: 'product', role: 'product', url: '/uploads/product.png', name: '商品母图' }],
    outputs,
    cover: { strategy: 'auto', outputIds: outputs.map(item => item.id) },
    remix: { mode: 'product_suite', prompt: '生成统一的完整耳机套图', sourceAssetRoles: ['product'] },
  };
  await writeFile(join(input, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const entry = await importCase(['--input', input, '--output', gallery]);
  const persisted = JSON.parse(await readFile(join(gallery, manifest.id, 'case.json'), 'utf8'));

  assert.equal(entry.cover_strategy, 'mosaic');
  assert.equal(entry.cover_mosaic_url, entry.cover_url);
  assert.deepEqual(entry.sourceAssets, manifest.sourceAssets);
  assert.deepEqual(entry.remix, manifest.remix);
  assert.deepEqual(persisted.images.map(image => image.prompt), outputs.map(item => item.prompt));
  assert.deepEqual(persisted.images.map(image => image.taskId), outputs.map(item => item.taskId));
  assert.deepEqual(persisted.images.map(image => image.requestKey), outputs.map(item => item.requestKey));
  assert.deepEqual(persisted.images.map(image => image.quoteId), outputs.map(item => item.quoteId));
});
