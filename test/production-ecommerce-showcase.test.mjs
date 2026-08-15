import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertStableAssets,
  buildCompositePayload,
  buildDetailDirectionPayload,
  buildDetailGenerationPayload,
  buildUsagePayload,
  fetchImageBytes,
  generateProductionEcommerceShowcase,
  requestCanvasResult,
} from '../scripts/generate-production-ecommerce-showcase.mjs';

const stableUrl = (digit, extension = 'png') => `/api/generated-assets/${digit.repeat(64)}.${extension}`;

function productionFixture({ failDetail = false, failComposite = false, failUsage = false } = {}) {
  const calls = [];
  let canvasCalls = 0;
  const detailUrls = ['a', 'b', 'c', 'd', 'e'].map(value => stableUrl(value));
  const request = async (path, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ path, options, body });
    if (path === '/api/session') return { ok: true, email: '867550189@qq.com' };
    if (path === '/api/billing/balance') return { balances: { ec_points: { availableUnits: 300000 } } };
    if (path === '/api/ecommerce/design-directions') {
      return {
        degraded: false,
        analysis: { status: 'complete' },
        directions: [{
          id: 'detail-suite',
          title: '珍珠白耳机完整详情套图',
          overall_spec: {
            locked: true,
            visual_style: '珍珠白与香槟金高级电商视觉',
            lighting: '柔和高调棚拍与自然场景光',
            composition: '竖版连续详情叙事',
            product_fidelity: '锁定耳机和充电盒结构',
          },
          execution_guide: '五张详情图保持同一商品、材质、色调和中文层级。',
        }],
      };
    }
    if (path === '/api/billing/quote') {
      const quantity = body.quantity;
      return { quote: { quoteId: `quote-${quantity}`, totalUnits: quantity * 1000 } };
    }
    if (path === '/api/generate-ecommerce') return { taskId: 'ec_showcase_detail_task' };
    if (path === '/api/ecommerce/jobs/ec_showcase_detail_task') {
      return {
        task: {
          id: 'ec_showcase_detail_task',
          status: failDetail ? 'failed' : 'completed',
          error: failDetail ? 'asset plan must contain at least one item' : '',
          assets: failDetail
            ? []
            : detailUrls.map((url, index) => ({ id: `detail-${index + 1}`, state: 'completed', stableUrl: url })),
        },
      };
    }
    if (path === '/api/canvas/regenerate') {
      canvasCalls += 1;
      if (failComposite) throw new Error('provider rejected stage two');
      if (failUsage && canvasCalls === 2) throw new Error('returned HTTP 524');
      return {
        taskId: canvasCalls === 1 ? 'canvas_showcase_composite_task' : 'canvas_showcase_usage_task',
        url: stableUrl(canvasCalls === 1 ? 'f' : '9'),
        billing: { status: 'settled' },
      };
    }
    if (path === '/api/canvas/regenerate/status') {
      if (failUsage) throw new Error('returned HTTP 524');
      return { status: 'completed', taskId: 'canvas_showcase_usage_task', url: stableUrl('9') };
    }
    if (path === '/api/billing/ledger?currency=ec_points&limit=100&offset=0') {
      return { entries: [{ referenceId: stableUrl('f'), status: 'settled' }] };
    }
    throw new Error(`Unexpected production request: ${path}`);
  };
  return { calls, detailUrls, request };
}

test('detail direction and generation payload request five distinct 3:4 commercial duties', () => {
  const product = { assetId: 'asset-earbuds', url: '/api/ecommerce/assets/earbuds.png' };
  const directionPayload = buildDetailDirectionPayload({ product });
  assert.deepEqual(directionPayload.requested_images, [{
    key: 'detail',
    label: '高级耳机详情图',
    count: 5,
    ratio: '3:4',
    targetRatio: '3:4',
  }]);

  const generationPayload = buildDetailGenerationPayload({
    product,
    direction: { id: 'detail-suite', execution_guide: '保持完整商品。' },
    quoteId: 'quote-5',
  });
  assert.deepEqual(generationPayload.sizing.images, [{
    id: 'detail',
    ratio: '3:4',
    targetRatio: '3:4',
    cropPolicy: 'none',
    count: 5,
  }]);
  assert.equal(generationPayload.billing_quote_id, 'quote-5');
});

test('v3 composite payload consumes only unique stable assets in a dense 4:3 tilted layout', () => {
  const detailUrls = ['a', 'b', 'c', 'd', 'e'].map(value => stableUrl(value));
  const payload = buildCompositePayload({ detailUrls, quoteId: 'quote-1', requestKey: 'showcase-composite-v1' });
  assert.equal(payload.image_url, detailUrls[0]);
  assert.deepEqual(payload.reference_images, detailUrls.slice(1));
  assert.deepEqual(payload.reference_metadata.map(item => item.mention), ['@详情图 1', '@详情图 2', '@详情图 3', '@详情图 4', '@详情图 5']);
  assert.equal(payload.ratio, '4:3');
  assert.match(payload.prompt, /shallow directional fan/i);
  assert.match(payload.prompt, /compact icon-and-type/i);
  assert.match(payload.request_key, /showcase-composite-v1/);
  assert.equal(payload.billing_quote_id, 'quote-1');
  assert.throws(() => assertStableAssets([detailUrls[0], detailUrls[0]]), /unique/i);
  assert.throws(() => assertStableAssets(['https://provider.example/result.png']), /stable/i);
});

test('face-forward usage payload requires a visible face and a worn earbud', () => {
  const detailUrls = ['a', 'b', 'c', 'd', 'e'].map(value => stableUrl(value));
  const payload = buildUsagePayload({ detailUrls, quoteId: 'quote-usage' });
  assert.equal(payload.ratio, '3:4');
  assert.match(payload.prompt, /face clearly visible/i);
  assert.match(payload.prompt, /earbud (?:is )?visibly worn/i);
  assert.match(payload.request_key, /earbuds-model-usage-v4$/);
  assert.equal(payload.billing_quote_id, 'quote-usage');
  assert.equal(payload.billing_action_id, 'showcase-showcase-20260815-earbuds-model-usage-v4');
});

test('usage failure preserves its quote and billing action for a no-requote retry', async () => {
  const failedFixture = productionFixture({ failUsage: true });
  let failedAudit;
  await assert.rejects(
    () => generateProductionEcommerceShowcase({
      sessionToken: 'session',
      request: failedFixture.request,
      productAsset: { assetId: 'asset-earbuds', url: '/api/ecommerce/assets/earbuds.png' },
      pollIntervalMs: 0,
      maxPollAttempts: 1,
      writeAudit: false,
      download: false,
    }),
    error => {
      failedAudit = error.audit;
      assert.equal(failedAudit.usage.status, 'failed');
      assert.equal(failedAudit.usage.quoteId, 'quote-1');
      assert.equal(failedAudit.usage.billingActionId, 'showcase-showcase-20260815-earbuds-model-usage-v4');
      return true;
    },
  );

  const resumedFixture = productionFixture();
  const resumed = await generateProductionEcommerceShowcase({
    sessionToken: 'session',
    request: resumedFixture.request,
    resumeAudit: failedAudit,
    pollIntervalMs: 0,
    writeAudit: false,
    download: false,
  });

  assert.equal(resumedFixture.calls.filter(call => call.path === '/api/billing/quote').length, 0);
  const usagePayload = resumedFixture.calls.find(call => (
    call.path === '/api/canvas/regenerate' || call.path === '/api/canvas/regenerate/status'
  )).body;
  assert.equal(usagePayload.billing_quote_id, 'quote-1');
  assert.equal(usagePayload.billing_action_id, failedAudit.usage.billingActionId);
  assert.equal(resumed.usage.status, 'completed');
});

test('stable asset download retries one transient timeout without resubmitting generation', async () => {
  let attempts = 0;
  const bytes = Buffer.alloc(12_000, 1);
  const result = await fetchImageBytes({
    url: 'https://shuimg.cn/api/generated-assets/example.png',
    token: 'session',
    timeoutMs: 25,
    maxAttempts: 2,
    fetchImpl: async (_url, options) => {
      attempts += 1;
      assert.ok(options.signal);
      if (attempts === 1) throw Object.assign(new Error('timed out'), { name: 'TimeoutError' });
      return new Response(bytes, { status: 200, headers: { 'content-type': 'image/png' } });
    },
  });
  assert.equal(attempts, 2);
  assert.equal(result.length, bytes.length);
});

test('Canvas production recovery polls durable status after a gateway timeout without resubmitting', async () => {
  const calls = [];
  const payload = { request_key: 'stable-request', prompt: 'same prompt' };
  const request = async (path) => {
    calls.push(path);
    if (path === '/api/canvas/regenerate') throw new Error('returned HTTP 524');
    if (calls.filter(value => value === '/api/canvas/regenerate/status').length === 1) {
      return { status: 'processing', taskId: 'canvas-stable' };
    }
    return { status: 'completed', taskId: 'canvas-stable', url: stableUrl('f') };
  };

  const result = await requestCanvasResult({
    request,
    payload,
    pollIntervalMs: 0,
    maxPollAttempts: 3,
  });

  assert.equal(result.url, stableUrl('f'));
  assert.equal(calls.filter(path => path === '/api/canvas/regenerate').length, 1);
  assert.equal(calls.filter(path => path === '/api/canvas/regenerate/status').length, 2);
});

test('status-first recovery falls back once to the same idempotent request when production lacks the status route', async () => {
  const calls = [];
  const payload = { request_key: 'stable-request', prompt: 'same prompt' };
  const request = async path => {
    calls.push(path);
    if (path === '/api/canvas/regenerate/status') throw new Error('returned HTTP 404');
    return { status: 'completed', taskId: 'canvas-existing', url: stableUrl('e'), replay: true };
  };

  const result = await requestCanvasResult({
    request,
    payload,
    pollIntervalMs: 0,
    maxPollAttempts: 3,
    statusFirst: true,
  });

  assert.equal(result.url, stableUrl('e'));
  assert.deepEqual(calls, ['/api/canvas/regenerate/status', '/api/canvas/regenerate']);
});

test('stage two uses the five delivered assets without resubmitting stage one', async () => {
  const fixture = productionFixture();
  const result = await generateProductionEcommerceShowcase({
    sessionToken: 'session',
    request: fixture.request,
    productAsset: { assetId: 'asset-earbuds', url: '/api/ecommerce/assets/earbuds.png' },
    pollIntervalMs: 0,
    writeAudit: false,
    download: false,
  });
  assert.equal(fixture.calls.filter(call => call.path === '/api/generate-ecommerce').length, 1);
  const composite = fixture.calls.find(call => call.path === '/api/canvas/regenerate').body;
  assert.equal(composite.image_url, fixture.detailUrls[0]);
  assert.deepEqual(composite.reference_images, fixture.detailUrls.slice(1));
  assert.equal(result.stageOne.stableUrls.length, 5);
  assert.equal(result.stageTwo.stableUrl, stableUrl('f'));
});

test('stage-two failure preserves completed stage-one evidence for deliberate retry', async () => {
  const fixture = productionFixture({ failComposite: true });
  await assert.rejects(
    () => generateProductionEcommerceShowcase({
      sessionToken: 'session',
      request: fixture.request,
      productAsset: { assetId: 'asset-earbuds', url: '/api/ecommerce/assets/earbuds.png' },
      pollIntervalMs: 0,
      writeAudit: false,
      download: false,
    }),
    error => {
      assert.match(error.message, /stage two/i);
      assert.equal(error.audit.stageOne.status, 'completed');
      assert.equal(error.audit.stageOne.taskId, 'ec_showcase_detail_task');
      assert.equal(error.audit.stageTwo.status, 'failed');
      return true;
    },
  );
  assert.equal(fixture.calls.filter(call => call.path === '/api/generate-ecommerce').length, 1);
});

test('stage-one failure preserves terminal evidence and never starts stage two', async () => {
  const fixture = productionFixture({ failDetail: true });
  await assert.rejects(
    () => generateProductionEcommerceShowcase({
      sessionToken: 'session',
      request: fixture.request,
      productAsset: { assetId: 'asset-earbuds', url: '/api/ecommerce/assets/earbuds.png' },
      pollIntervalMs: 0,
      writeAudit: false,
      download: false,
    }),
    error => {
      assert.match(error.message, /stage one/i);
      assert.equal(error.audit.stageOne.status, 'failed');
      assert.equal(error.audit.stageOne.taskId, 'ec_showcase_detail_task');
      assert.equal(error.audit.stageOne.error, 'asset plan must contain at least one item');
      assert.equal(error.audit.stageTwo.status, 'pending');
      return true;
    },
  );
  assert.equal(fixture.calls.filter(call => call.path === '/api/canvas/regenerate').length, 0);
});

test('resume audit skips stage one and reuses its stable outputs', async () => {
  const fixture = productionFixture();
  const resumeAudit = {
    stageOne: {
      status: 'completed',
      taskId: 'ec_existing_detail_task',
      requestKey: 'showcase-earbuds-details-v1',
      stableUrls: fixture.detailUrls,
    },
    stageTwo: { status: 'pending', requestKey: 'showcase-earbuds-composite-v1' },
  };
  const result = await generateProductionEcommerceShowcase({
    sessionToken: 'session',
    request: fixture.request,
    productAsset: { assetId: 'unused', url: '/api/ecommerce/assets/unused.png' },
    resumeAudit,
    pollIntervalMs: 0,
    writeAudit: false,
    download: false,
  });
  assert.equal(fixture.calls.filter(call => call.path === '/api/ecommerce/design-directions').length, 0);
  assert.equal(fixture.calls.filter(call => call.path === '/api/generate-ecommerce').length, 0);
  assert.equal(result.stageOne.taskId, 'ec_existing_detail_task');
  assert.equal(result.stageTwo.status, 'completed');
});
