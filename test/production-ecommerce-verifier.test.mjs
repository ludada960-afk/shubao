import assert from 'node:assert/strict';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { verifyProductionEcommerce } from '../scripts/verify-production-ecommerce.mjs';

const PRODUCT = { assetId: 'a'.repeat(64) + '.png', url: '/api/generated-assets/' + 'a'.repeat(64) + '.png' };
const REFERENCE = { assetId: 'b'.repeat(64) + '.png', url: '/api/generated-assets/' + 'b'.repeat(64) + '.png' };
const STABLE_URLS = [
  '/api/generated-assets/' + 'c'.repeat(64) + '.png',
  '/api/generated-assets/' + 'd'.repeat(64) + '.png',
  '/api/generated-assets/' + 'e'.repeat(64) + '.png',
];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function completedTask() {
  return {
    id: 'task-canary', status: 'completed', quote: { units: 3 },
    assetPlan: [{ id: 'one' }, { id: 'two' }, { id: 'three' }],
    assets: STABLE_URLS.map((stableUrl, index) => ({ assetId: `asset-${index}`, state: 'completed', stableUrl })),
    progress: {
      executionCount: { quoteUnits: 3 },
      orchestrationSnapshot: {
        productTruth: { productName: 'Apple' },
        styleReferenceProfile: { palette: ['#ff0000'] },
        visualAnalysisCache: { product: 'product-cache', style: 'style-cache' },
      },
    },
  };
}

test('ecommerce production verifier requires an authenticated canary token before reading the fixture', async () => {
  await assert.rejects(
    verifyProductionEcommerce({ sessionToken: '', fixturePath: 'missing-file.png' }),
    /SHUBAO_CANARY_SESSION_TOKEN is required/,
  );
});

test('ecommerce production verifier checks real analysis, exact counts and Works persistence', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'shubao-production-canary-'));
  const fixturePath = join(directory, 'fixture.png');
  await writeFile(fixturePath, Buffer.from('fixture'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    const path = new URL(url).pathname;
    requests.push({ path, options });
    if (path === '/api/session') return json({ ok: true, email: 'canary@example.com' });
    if (path === '/api/ecommerce/assets') {
      const body = JSON.parse(options.body);
      return json(body.role === 'product' ? { original: PRODUCT } : { original: REFERENCE }, 201);
    }
    if (path === '/api/billing/quote') return json({ quote: { quoteId: 'bq1.canary.signature', totalUnits: 3000 } });
    if (path === '/api/generate-ecommerce') return json({ taskId: 'task-canary', status: 'queued' }, 202);
    if (path === '/api/ecommerce/jobs/task-canary') return json({ ok: true, task: completedTask() });
    if (path === '/api/works') return json([{ taskId: 'task-canary', images: STABLE_URLS.map(url => ({ url })) }]);
    throw new Error(`unexpected request ${path}`);
  };

  const result = await verifyProductionEcommerce({
    baseUrl: 'https://shuimg.cn', sessionToken: 'signed-canary-token', fixturePath, fetchImpl, pollIntervalMs: 0,
  });

  assert.deepEqual(result.stableUrls, STABLE_URLS);
  const generation = requests.find(request => request.path === '/api/generate-ecommerce');
  assert.equal(generation.options.headers.authorization, 'Bearer signed-canary-token');
  const body = JSON.parse(generation.options.body);
  assert.equal(body.billing_quote_id, 'bq1.canary.signature');
  assert.deepEqual(body.sizing.images.map(image => image.count), [1, 1, 1]);
  assert.deepEqual(body.sizing.images.map(image => image.id), [
    'main_text', 'detail_slice_feature', 'white_background',
  ]);
  assert.equal(body.assets.product[0].assetId, PRODUCT.assetId);
  assert.equal(body.assets.reference[0].assetId, REFERENCE.assetId);
});

test('ecommerce production verifier rejects partial delivery and never treats it as an acceptance pass', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'shubao-production-canary-'));
  const fixturePath = join(directory, 'fixture.png');
  await writeFile(fixturePath, Buffer.from('fixture'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const fetchImpl = async url => {
    const path = new URL(url).pathname;
    if (path === '/api/session') return json({ ok: true, email: 'canary@example.com' });
    if (path === '/api/ecommerce/assets') return json({ original: PRODUCT }, 201);
    if (path === '/api/billing/quote') return json({ quote: { quoteId: 'bq1.canary.signature', totalUnits: 3000 } });
    if (path === '/api/generate-ecommerce') return json({ taskId: 'task-canary', status: 'queued' }, 202);
    if (path === '/api/ecommerce/jobs/task-canary') return json({ ok: true, task: { ...completedTask(), status: 'needs_review' } });
    throw new Error(`unexpected request ${path}`);
  };
  await assert.rejects(
    verifyProductionEcommerce({ sessionToken: 'signed-canary-token', fixturePath, fetchImpl, pollIntervalMs: 0 }),
    /ended as needs_review/,
  );
});
