import assert from 'node:assert/strict';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

import { verifyProductionEcommerce } from '../scripts/verify-production-ecommerce.mjs';

const PRODUCT = { assetId: 'a'.repeat(64) + '.png', url: '/api/generated-assets/' + 'a'.repeat(64) + '.png' };
const REFERENCE = { assetId: 'b'.repeat(64) + '.png', url: '/api/generated-assets/' + 'b'.repeat(64) + '.png' };
const STABLE_URLS = [
  '/api/generated-assets/' + 'c'.repeat(64) + '.png',
  '/api/generated-assets/' + 'd'.repeat(64) + '.png',
  '/api/generated-assets/' + 'e'.repeat(64) + '.png',
];

function completedDirections() {
  return {
    analysis: {
      status: 'complete',
      product_observations: ['红色苹果'],
      product_uncertainties: [],
      reference_style: ['干净电商摄影'],
      commercial_opportunities: ['突出新鲜质感'],
    },
    degraded: false,
    directions: [{
      id: 'canary-direction-1',
      title: '生产验收设计方案',
      one_liner: '真实展示商品外观',
      commercial_objective: '建立商品识别',
      audience: '电商消费者',
      execution_guide: '保持商品真实并区分每张图职责',
      overall_spec: {
        locked: true,
        visual_style: '真实、清晰、克制',
        lighting: '柔和棚拍光',
        composition: '主体居中并保留信息空间',
        product_fidelity: '商品外观、颜色、比例和结构保持一致',
      },
      deliverables: [
        { role: 'main_text', count: 1, shots: [{ index: 0, label: '商品识别主图' }] },
        { role: 'detail', count: 1, shots: [{ index: 0, label: '核心卖点详情图' }] },
        { role: 'white_background', count: 1, shots: [{ index: 0, label: '白底首图' }] },
      ],
    }],
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function completedTask() {
  const assetPlan = [
    {
      id: 'main-text', role: 'main_text', label: '商品识别主图', ratio: '1:1', generationSize: '2048x2048',
      commercialDutyId: 'main:identity', communicationGoal: '建立商品识别', purpose: '商品识别主图',
    },
    {
      id: 'detail-feature', role: 'detail_slice_feature', label: '核心卖点详情图', ratio: '3:4', generationSize: '1536x2048',
      commercialDutyId: 'detail:feature', communicationGoal: '解释核心卖点', purpose: '核心卖点详情图',
    },
    {
      id: 'white-background', role: 'white_background', label: '白底首图', ratio: '1:1', generationSize: '2048x2048',
      commercialDutyId: 'white:catalog', communicationGoal: '提供标准商品识别', purpose: '白底首图',
    },
  ];
  return {
    id: 'task-canary', status: 'completed', quote: { units: 3 },
    assetPlan,
    assets: STABLE_URLS.map((stableUrl, index) => ({
      assetId: assetPlan[index].id,
      state: 'completed',
      role: assetPlan[index].role,
      label: assetPlan[index].label,
      stableUrl,
    })),
    progress: {
      projectId: 'project-canary',
      sourceVersionId: 'version-source-canary',
      resultVersionId: 'version-result-canary',
      executionCount: { quoteUnits: 3 },
      orchestrationSnapshot: {
        productTruth: { productName: 'Apple' },
        styleReferenceProfile: { palette: ['#ff0000'] },
        visualAnalysisCache: { product: 'product-cache', style: 'style-cache' },
      },
    },
  };
}

function completedWork(overrides = {}) {
  const task = completedTask();
  return {
    taskId: 'task-canary',
    projectId: task.progress.projectId,
    sourceVersionId: task.progress.sourceVersionId,
    resultVersionId: task.progress.resultVersionId,
    productAssets: [PRODUCT],
    referenceAssets: [REFERENCE],
    images: task.assetPlan.map((plan, index) => ({
      key: plan.id,
      displayName: plan.label,
      name: plan.label,
      role: plan.role,
      group: plan.role === 'white_background' ? '白底图' : plan.role.startsWith('detail') ? '详情图' : '主图',
      ratio: plan.ratio,
      size: plan.generationSize,
      width: Number(plan.generationSize.split('x')[0]),
      height: Number(plan.generationSize.split('x')[1]),
      url: STABLE_URLS[index],
    })),
    ...overrides,
  };
}

test('ecommerce production verifier requires an authenticated canary token before reading the fixture', async () => {
  await assert.rejects(
    verifyProductionEcommerce({ sessionToken: '', fixturePath: 'missing-file.png' }),
    /SHUBAO_CANARY_SESSION_TOKEN is required/,
  );
});

test('ecommerce production verifier checks delivery metadata, source continuity, image variants and Canvas persistence', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'shubao-production-canary-'));
  const fixturePath = join(directory, 'fixture.png');
  await writeFile(fixturePath, Buffer.from('fixture'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const thumb = await sharp({ create: { width: 640, height: 640, channels: 3, background: '#ef4444' } }).webp().toBuffer();
  const canvas = await sharp({ create: { width: 1280, height: 1280, channels: 3, background: '#ef4444' } }).webp().toBuffer();
  const requests = [];
  let canvasSession = null;
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const variant = parsed.searchParams.get('variant') || '';
    requests.push({ path, variant, options });
    if (path === '/api/session') return json({ ok: true, email: 'canary@example.com' });
    if (path === '/api/ecommerce/assets') {
      const body = JSON.parse(options.body);
      return json(body.role === 'product' ? { original: PRODUCT } : { original: REFERENCE }, 201);
    }
    if (path === '/api/ecommerce/design-directions') return json(completedDirections());
    if (path === '/api/billing/quote') return json({ quote: { quoteId: 'bq1.canary.signature', totalUnits: 3000 } });
    if (path === '/api/generate-ecommerce') return json({ taskId: 'task-canary', status: 'queued' }, 202);
    if (path === '/api/ecommerce/jobs/task-canary') return json({ ok: true, task: completedTask() });
    if (path === '/api/works') return json([completedWork()]);
    if (path === new URL(STABLE_URLS[0], 'https://shuimg.cn').pathname && ['thumb', 'canvas'].includes(variant)) {
      const body = variant === 'thumb' ? thumb : canvas;
      return new Response(body, {
        headers: { 'content-type': 'image/webp', 'cache-control': 'public, max-age=31536000, immutable' },
      });
    }
    if (path === '/api/canvas-sessions' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      canvasSession = { id: 'canvas-canary', revision: 1, snapshot: body.snapshot };
      return json({ session: canvasSession }, 201);
    }
    if (path === '/api/canvas-sessions/canvas-canary/save') {
      const body = JSON.parse(options.body);
      canvasSession = { ...canvasSession, revision: 2, snapshot: body.snapshot };
      return json({ session: canvasSession });
    }
    if (path === '/api/canvas-sessions/canvas-canary') return json({ session: canvasSession });
    throw new Error(`unexpected request ${path}`);
  };

  const result = await verifyProductionEcommerce({
    baseUrl: 'https://shuimg.cn', sessionToken: 'signed-canary-token', fixturePath, fetchImpl, pollIntervalMs: 0,
  });

  assert.deepEqual(result.stableUrls, STABLE_URLS);
  assert.equal(result.canvasSessionId, 'canvas-canary');
  assert.deepEqual(requests.filter(request => request.variant).map(request => request.variant), ['thumb', 'canvas']);
  assert.deepEqual(requests.filter(request => request.path.startsWith('/api/canvas-sessions')).map(request => request.path), [
    '/api/canvas-sessions',
    '/api/canvas-sessions/canvas-canary/save',
    '/api/canvas-sessions/canvas-canary',
  ]);
  const directionRequest = requests.find(request => request.path === '/api/ecommerce/design-directions');
  assert.equal(directionRequest.options.headers.authorization, 'Bearer signed-canary-token');
  const directionBody = JSON.parse(directionRequest.options.body);
  assert.equal(directionBody.real_shots[0], PRODUCT.url);
  assert.equal(directionBody.ref_shots[0], REFERENCE.url);
  assert.deepEqual(directionBody.requested_images.map(image => image.count), [1, 1, 1]);
  const generation = requests.find(request => request.path === '/api/generate-ecommerce');
  assert.equal(generation.options.headers.authorization, 'Bearer signed-canary-token');
  const body = JSON.parse(generation.options.body);
  assert.equal(body.billing_quote_id, 'bq1.canary.signature');
  assert.deepEqual(body.sizing.images.map(image => image.count), [1, 1, 1]);
  assert.deepEqual(body.sizing.images.map(image => image.id), [
    'main_text', 'detail', 'white_background',
  ]);
  assert.equal(body.assets.product[0].assetId, PRODUCT.assetId);
  assert.equal(body.assets.reference[0].assetId, REFERENCE.assetId);
  assert.equal(body.direction.id, 'canary-direction-1');
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
    if (path === '/api/ecommerce/design-directions') return json(completedDirections());
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
