import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import Database from 'better-sqlite3';

import { createVisualAnalysisService } from '../server/ecommerceEngine/visualAnalysisService.mjs';
import { createVisualAnalysisStore } from '../server/ecommerceEngine/visualAnalysisStore.mjs';
import { createVlmClient, createVlmDeadline } from '../server/ecommerceEngine/vlmClient.mjs';
import { buildProductTruthPrompt } from '../server/ecommerceEngine/productTruth.mjs';
import { buildStyleReferencePrompt } from '../server/ecommerceEngine/styleReferenceProfile.mjs';

const PRODUCT_ASSETS = [{ assetId: 'sha256-product-front', url: '/product-front.png' }];
const STYLE_ASSETS = [{ assetId: 'sha256-style-front', url: '/style-front.png' }];
const VALID_PRODUCT_RESULT = {
  productName: 'Vision Bottle',
  primaryColors: ['#ffffff'],
  materials: ['glass'],
  confidence: 0.94,
};
const VALID_STYLE_RESULT = {
  palette: ['#fff4e8'],
  lighting: 'soft side light',
  composition: 'centered hero',
  confidence: 0.89,
};

function createHarness({ db = new Database(':memory:'), promptVersion = 'visual-v1', callVision } = {}) {
  let visionCalls = 0;
  const calls = [];
  const service = createVisualAnalysisService({
    store: createVisualAnalysisStore(db),
    model: 'gpt-5.6-terra',
    promptVersion,
    readAsset: async asset => ({
      buffer: Buffer.from(asset.assetId),
      contentType: 'image/png',
    }),
    callVision: async request => {
      visionCalls += 1;
      calls.push(request);
      if (callVision) return callVision(request);
      if (request.type === 'product') {
        return {
          ...VALID_PRODUCT_RESULT,
          sourceAssetIds: ['model-must-not-control-provenance'],
        };
      }
      return {
        ...VALID_STYLE_RESULT,
        productName: 'Competitor Bottle',
        logos: ['Other Brand'],
        visibleText: ['500ml'],
      };
    },
  });
  return { db, service, calls, visionCallCount: () => visionCalls };
}

test('same asset hashes, model and prompt version reuse one product and one style call', async t => {
  const harness = createHarness();
  t.after(() => harness.db.close());
  const input = {
    productAssets: PRODUCT_ASSETS,
    styleAssets: STYLE_ASSETS,
    userFacts: { productName: 'User Bottle', category: 'skincare' },
  };

  const first = await harness.service.analyze(input);
  const replay = await harness.service.analyze(input);

  assert.equal(harness.visionCallCount(), 2);
  assert.deepEqual(replay, first);
  assert.equal(first.productTruth.productName, 'User Bottle');
  assert.deepEqual(first.productTruth.sourceAssetIds, ['sha256-product-front']);
  assert.deepEqual(first.styleReferenceProfile.sourceAssetIds, ['sha256-style-front']);
  assert.equal(Object.hasOwn(first.productTruth, 'palette'), false);
  assert.equal(Object.hasOwn(first.productTruth, 'visibleText'), false);
  assert.equal(Object.hasOwn(first.productTruth, 'referenceProduct'), false);
  assert.equal(Object.hasOwn(first.styleReferenceProfile, 'productName'), false);
  assert.equal(Object.hasOwn(first.styleReferenceProfile, 'logos'), false);
  assert.match(first.cache.product, /^[a-f0-9]{64}$/);
  assert.match(first.cache.style, /^[a-f0-9]{64}$/);
  assert.deepEqual(harness.calls.map(call => ({
    type: call.type,
    assetIds: call.assets.map(asset => asset.assetId),
  })), [
    { type: 'product', assetIds: ['sha256-product-front'] },
    { type: 'style', assetIds: ['sha256-style-front'] },
  ]);
});

test('prompt version changes invalidate both independent cache entries', async t => {
  const db = new Database(':memory:');
  t.after(() => db.close());
  let calls = 0;
  const callVision = ({ type }) => {
    calls += 1;
    return type === 'product'
      ? { productName: 'Bottle', confidence: 0.9 }
      : { palette: ['#ffffff'], confidence: 0.9 };
  };
  const first = createHarness({ db, promptVersion: 'visual-v1', callVision });
  const second = createHarness({ db, promptVersion: 'visual-v2', callVision });
  const input = { productAssets: PRODUCT_ASSETS, styleAssets: STYLE_ASSETS, userFacts: {} };

  await first.service.analyze(input);
  await second.service.analyze(input);

  assert.equal(calls, 4);
});

test('visual analysis cache survives reopening its SQLite database', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'visual-analysis-store-'));
  const path = join(directory, 'cache.db');
  const firstDb = new Database(path);
  const firstStore = createVisualAnalysisStore(firstDb);
  firstStore.put({
    key: 'cache-key',
    type: 'product',
    model: 'gpt-5.6-terra',
    promptVersion: 'visual-v1',
    result: { productName: 'Durable Bottle' },
  });
  firstDb.close();

  const secondDb = new Database(path);
  t.after(async () => {
    secondDb.close();
    await rm(directory, { recursive: true, force: true });
  });
  const secondStore = createVisualAnalysisStore(secondDb);

  assert.deepEqual(secondStore.get('cache-key'), { productName: 'Durable Bottle' });
});

test('provider and low-confidence failures use structured fail-closed errors', async t => {
  const unavailable = createHarness({
    callVision: () => { throw new Error('network unavailable'); },
  });
  t.after(() => unavailable.db.close());
  await assert.rejects(
    () => unavailable.service.analyze({ productAssets: PRODUCT_ASSETS, styleAssets: [], userFacts: {} }),
    error => error?.code === 'VISUAL_ANALYSIS_UNAVAILABLE'
      && error?.status === 503
      && error?.retryable === true
      && !/mock/i.test(JSON.stringify(error)),
  );

  const lowConfidence = createHarness({
    callVision: () => ({ productName: 'Maybe Bottle', confidence: 0.2 }),
  });
  t.after(() => lowConfidence.db.close());
  await assert.rejects(
    () => lowConfidence.service.analyze({ productAssets: PRODUCT_ASSETS, styleAssets: [], userFacts: {} }),
    error => error?.code === 'VISUAL_ANALYSIS_LOW_CONFIDENCE' && error?.status === 422,
  );
});

test('rejects missing, non-finite, non-numeric, and out-of-range confidence before caching', async t => {
  const invalidConfidenceValues = [undefined, '0.9', Number.NaN, -0.01, 1.01];

  for (const [index, confidence] of invalidConfidenceValues.entries()) {
    const harness = createHarness({
      callVision: () => ({
        ...VALID_PRODUCT_RESULT,
        ...(confidence === undefined ? { confidence: undefined } : { confidence }),
      }),
    });
    t.after(() => harness.db.close());

    await assert.rejects(
      () => harness.service.analyze({ productAssets: PRODUCT_ASSETS, styleAssets: [], userFacts: {} }),
      error => error?.code === 'VISUAL_ANALYSIS_INVALID_RESPONSE'
        && error?.status === 502
        && error?.retryable === false,
      `invalid confidence case ${index}`,
    );
  }
});

test('visual-analysis prompts require a numeric top-level confidence field', () => {
  const productPrompt = buildProductTruthPrompt({ sourceAssetIds: ['product-asset'] });
  const stylePrompt = buildStyleReferencePrompt({ sourceAssetIds: ['style-asset'] });

  assert.match(productPrompt.systemPrompt, /"confidence": 0/);
  assert.match(productPrompt.systemPrompt, /top-level confidence field as a JSON number from 0 to 1/i);
  assert.match(stylePrompt.systemPrompt, /"palette": \[\]/);
  assert.match(stylePrompt.systemPrompt, /"lighting": ""/);
  assert.match(stylePrompt.systemPrompt, /top-level sourceAssetIds and confidence/i);
  assert.match(stylePrompt.systemPrompt, /confidence must be a JSON number from 0 to 1/i);
});

test('rejects empty, wrong-analysis-type, and field-type-invalid VLM results', async t => {
  const cases = [
    {
      label: 'empty product',
      callVision: () => ({ confidence: 0.9 }),
      styleAssets: [],
    },
    {
      label: 'style-only product response',
      callVision: () => ({ ...VALID_STYLE_RESULT }),
      styleAssets: [],
    },
    {
      label: 'type-invalid product field',
      callVision: () => ({ ...VALID_PRODUCT_RESULT, productName: [] }),
      styleAssets: [],
    },
    {
      label: 'empty style',
      callVision: ({ type }) => type === 'product' ? VALID_PRODUCT_RESULT : { confidence: 0.9 },
      styleAssets: STYLE_ASSETS,
    },
    {
      label: 'product-only style response',
      callVision: ({ type }) => type === 'product' ? VALID_PRODUCT_RESULT : VALID_PRODUCT_RESULT,
      styleAssets: STYLE_ASSETS,
    },
    {
      label: 'type-invalid style field',
      callVision: ({ type }) => type === 'product'
        ? VALID_PRODUCT_RESULT
        : { palette: '#ffffff', confidence: 0.9 },
      styleAssets: STYLE_ASSETS,
    },
  ];

  for (const current of cases) {
    const harness = createHarness({ callVision: current.callVision });
    t.after(() => harness.db.close());
    await assert.rejects(
      () => harness.service.analyze({
        productAssets: PRODUCT_ASSETS,
        styleAssets: current.styleAssets,
        userFacts: {},
      }),
      error => error?.code === 'VISUAL_ANALYSIS_INVALID_RESPONSE' && error?.status === 502,
      current.label,
    );
  }
});

test('drops a malformed optional uncertain-facts field without discarding valid product truth', async t => {
  const harness = createHarness({
    callVision: () => ({
      ...VALID_PRODUCT_RESULT,
      uncertainFacts: 'the model returned a prose note instead of an array',
    }),
  });
  t.after(() => harness.db.close());

  const result = await harness.service.analyze({
    productAssets: PRODUCT_ASSETS,
    styleAssets: [],
    userFacts: {},
  });

  assert.equal(result.productTruth.productName, 'Vision Bottle');
  assert.equal(
    result.productTruth.uncertainFacts.some(fact => fact.value === 'the model returned a prose note instead of an array'),
    false,
  );
});

test('drops malformed optional style metadata while retaining valid transferable analysis', async t => {
  const harness = createHarness({
    callVision: ({ type }) => type === 'product'
      ? VALID_PRODUCT_RESULT
      : {
          ...VALID_STYLE_RESULT,
          lighting: { unsuitable: 'object value' },
          prohibitedTransfers: 'not an array',
        },
  });
  t.after(() => harness.db.close());

  const result = await harness.service.analyze({
    productAssets: PRODUCT_ASSETS,
    styleAssets: STYLE_ASSETS,
    userFacts: {},
  });

  assert.equal(result.styleReferenceProfile.lighting, '');
  assert.deepEqual(result.styleReferenceProfile.palette, ['#fff4e8']);
  assert.equal(result.styleReferenceProfile.prohibitedTransfers.includes('reference products'), true);
});

test('rejects every explicitly supplied malformed product or style asset', async t => {
  const cases = [
    { label: 'non-array product', productAssets: 'product', styleAssets: [] },
    { label: 'null product entry', productAssets: [null], styleAssets: [] },
    { label: 'mixed malformed product entry', productAssets: [...PRODUCT_ASSETS, null], styleAssets: [] },
    { label: 'product entry without ID', productAssets: [{ url: '/missing-id.png' }], styleAssets: [] },
    { label: 'non-array style', productAssets: PRODUCT_ASSETS, styleAssets: 'style' },
    { label: 'null style entry', productAssets: PRODUCT_ASSETS, styleAssets: [null] },
    { label: 'mixed malformed style entry', productAssets: PRODUCT_ASSETS, styleAssets: [...STYLE_ASSETS, {}] },
  ];

  for (const current of cases) {
    const harness = createHarness();
    t.after(() => harness.db.close());
    await assert.rejects(
      () => harness.service.analyze({
        productAssets: current.productAssets,
        styleAssets: current.styleAssets,
        userFacts: {},
      }),
      error => error?.code === 'VISUAL_ANALYSIS_INVALID_INPUT' && error?.status === 400,
      current.label,
    );
    assert.equal(harness.visionCallCount(), 0, current.label);
  }
});

test('VLM client is injectable, requires explicit configuration and sends original detail', async () => {
  assert.throws(
    () => createVlmClient({ apiKey: '', baseUrl: '' }),
    error => error?.code === 'VISUAL_ANALYSIS_UNAVAILABLE' && error?.status === 503,
  );
  let request;
  const client = createVlmClient({
    apiKey: 'test-only-key',
    baseUrl: 'https://vision.example/',
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        async json() {
          return { choices: [{ message: { content: '{"palette":["#ffffff"],"confidence":0.9}' } }] };
        },
      };
    },
  });

  const result = await client.analyzeJson({
    systemPrompt: 'Return JSON only.',
    userPrompt: 'Analyze style.',
    images: ['data:image/png;base64,AA=='],
  });

  assert.deepEqual(result, { palette: ['#ffffff'], confidence: 0.9 });
  assert.equal(request.url, 'https://vision.example/v1/chat/completions');
  assert.equal(request.body.model, 'gpt-5.6-luna');
  assert.equal(request.body.messages[1].content[1].image_url.detail, 'original');
  assert.equal(request.options.headers.Authorization, 'Bearer test-only-key');
});

test('VLM client retries transient upstream responses before returning valid JSON', async () => {
  const statuses = [503, 429, 200];
  const observedDelays = [];
  let callCount = 0;
  const client = createVlmClient({
    apiKey: 'test-only-key',
    baseUrl: 'https://vision.example',
    retryDelaysMs: [10, 20],
    sleepImpl: async milliseconds => observedDelays.push(milliseconds),
    fetchImpl: async () => {
      const status = statuses[callCount++];
      return {
        ok: status === 200,
        status,
        async json() {
          return { choices: [{ message: { content: '{"probe":"ok"}' } }] };
        },
      };
    },
  });

  const result = await client.analyzeJson({
    systemPrompt: 'Return JSON only.',
    userPrompt: 'Analyze style.',
    images: ['data:image/png;base64,AA=='],
  });

  assert.deepEqual(result, { probe: 'ok' });
  assert.equal(callCount, 3);
  assert.deepEqual(observedDelays, [10, 20]);
});

test('VLM client rejects non-JSON model output instead of fabricating facts', async () => {
  const client = createVlmClient({
    apiKey: 'test-only-key',
    baseUrl: 'https://vision.example',
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { choices: [{ message: { content: 'not json' } }] };
      },
    }),
  });

  await assert.rejects(
    () => client.analyzeJson({ systemPrompt: 'JSON', userPrompt: 'Analyze', images: ['data:image/png;base64,AA=='] }),
    error => error?.code === 'VISUAL_ANALYSIS_INVALID_RESPONSE'
      && error?.status === 502
      && error?.retryable === false,
  );
});

test('VLM client aborts a bounded request and clears its timeout', async () => {
  const timerToken = { id: 'visual-timeout' };
  let scheduledMs = 0;
  let clearedToken;
  let observedSignal;
  const client = createVlmClient({
    apiKey: 'test-only-key',
    baseUrl: 'https://vision.example',
    timeoutMs: 25,
    setTimeoutImpl(callback, milliseconds) {
      scheduledMs = milliseconds;
      queueMicrotask(callback);
      return timerToken;
    },
    clearTimeoutImpl(token) {
      clearedToken = token;
    },
    fetchImpl: async (_url, options) => {
      observedSignal = options.signal;
      if (!observedSignal) throw new Error('missing AbortSignal');
      return new Promise((_resolve, reject) => {
        observedSignal.addEventListener('abort', () => reject(observedSignal.reason), { once: true });
      });
    },
  });

  await assert.rejects(
    () => client.analyzeJson({
      systemPrompt: 'Return JSON only.',
      userPrompt: 'Analyze style.',
      images: ['data:image/png;base64,AA=='],
    }),
    error => error?.code === 'VISUAL_ANALYSIS_UNAVAILABLE' && error?.status === 503,
  );

  assert.equal(scheduledMs, 25);
  assert.equal(observedSignal.aborted, true);
  assert.equal(clearedToken, timerToken);
});

test('VLM client completes bounded text requests without requiring an image', async () => {
  let request;
  const client = createVlmClient({
    apiKey: 'test-only-key',
    baseUrl: 'https://vision.example',
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        async json() {
          return { choices: [{ message: { content: '润色后的商品描述' } }] };
        },
      };
    },
  });

  const result = await client.completeText({
    systemPrompt: 'Rewrite the product brief.',
    userPrompt: 'Original product brief.',
  });

  assert.equal(result, '润色后的商品描述');
  assert.equal(request.url, 'https://vision.example/v1/chat/completions');
  assert.equal(request.body.messages[1].content[0].type, 'text');
  assert.equal(request.body.messages[1].content.length, 1);
  assert.ok(request.options.signal instanceof AbortSignal);
});

test('VLM client forwards an external abort without retrying the cancelled request', async () => {
  const externalController = new AbortController();
  let callCount = 0;
  let observedSignal;
  const client = createVlmClient({
    apiKey: 'test-only-key',
    baseUrl: 'https://vision.example',
    retryDelaysMs: [1, 1],
    sleepImpl: async () => {},
    fetchImpl: async (_url, options) => {
      callCount += 1;
      observedSignal = options.signal;
      return new Promise((_resolve, reject) => {
        observedSignal.addEventListener('abort', () => reject(observedSignal.reason), { once: true });
      });
    },
  });

  const completion = client.completeText({
    systemPrompt: 'Analyze.',
    userPrompt: 'Product.',
    images: ['data:image/png;base64,AA=='],
    signal: externalController.signal,
  });
  externalController.abort(new Error('route deadline reached'));

  await assert.rejects(
    completion,
    error => error?.code === 'VISUAL_ANALYSIS_ABORTED'
      && error?.status === 499
      && error?.retryable === false,
  );
  assert.equal(callCount, 1);
  assert.equal(observedSignal.aborted, true);
});

test('VLM route deadline aborts the whole analysis with a gateway-timeout error', () => {
  const timerToken = { id: 'route-deadline' };
  let deadlineCallback;
  let clearedToken;
  const deadline = createVlmDeadline({
    timeoutMs: 75_000,
    setTimeoutImpl(callback, milliseconds) {
      assert.equal(milliseconds, 75_000);
      deadlineCallback = callback;
      return timerToken;
    },
    clearTimeoutImpl(token) {
      clearedToken = token;
    },
  });

  deadlineCallback();

  assert.equal(deadline.signal.aborted, true);
  assert.equal(deadline.signal.reason?.code, 'VISUAL_ANALYSIS_TIMEOUT');
  assert.equal(deadline.signal.reason?.status, 504);
  assert.equal(deadline.signal.reason?.retryable, true);
  deadline.cleanup();
  assert.equal(clearedToken, timerToken);
});
