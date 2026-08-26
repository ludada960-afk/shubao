import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  loadEcommerceTaskReference,
  saveEcommerceTaskReference,
} from '../src/pages/Home/ec/ecommerceTaskProgressModel.js';

test('Canvas image inputs resolve app-relative assets before server processing', async t => {
  const originalLocation = globalThis.location;
  globalThis.location = { origin: 'https://canvas.example' };
  t.after(() => {
    if (originalLocation === undefined) delete globalThis.location;
    else globalThis.location = originalLocation;
  });

  const { normalizeCanvasImageUrl } = await import(`../src/services/api.js?canvas-image-url=${Date.now()}`);
  assert.equal(normalizeCanvasImageUrl('/images/curator.png'), 'https://canvas.example/images/curator.png');
  assert.equal(normalizeCanvasImageUrl('https://cdn.example/product.png'), 'https://cdn.example/product.png');
  assert.equal(normalizeCanvasImageUrl('data:image/png;base64,abc'), 'data:image/png;base64,abc');
  assert.equal(normalizeCanvasImageUrl('blob:https://canvas.example/id'), 'blob:https://canvas.example/id');
});

test('video platform cutover keeps explicit rollback gates in the runtime contract', async () => {
  const [server, config, uploadClient] = await Promise.all([
    fs.readFile(new URL('../server/index.mjs', import.meta.url), 'utf8'),
    fs.readFile(new URL('../server/config.mjs', import.meta.url), 'utf8'),
    fs.readFile(new URL('../src/services/videoUploadClient.js', import.meta.url), 'utf8'),
  ]);
  for (const name of [
    'VIDEO_PLATFORM_OWNER_READS', 'VIDEO_PLATFORM_ATTEMPTS', 'VIDEO_PLATFORM_OUTBOX',
    'VIDEO_PLATFORM_PROJECT_BRIDGE', 'VIDEO_PLATFORM_TUS_UPLOAD', 'VIDEO_PLATFORM_READ_NEW_STATE',
  ]) assert.match(config, new RegExp(name));
  assert.match(server, /readVideoPlatformFlags\(process\.env\)/);
  assert.match(server, /VIDEO_PLATFORM_PROJECT_BRIDGE \? videoProjectBridge : null/);
  assert.match(server, /uploadMode: videoPlatformFlags\.VIDEO_PLATFORM_TUS_UPLOAD \? 'tus' : 'direct'/);
  assert.match(uploadClient, /callbacks\.resumable === false/);
  assert.match(uploadClient, /'\/api\/video\/assets'/);
});

function ecommerceStorage(owner = 'owner@example.com') {
  const values = new Map([['sb-auth', JSON.stringify({
    email: owner,
    token: 'signed-ecommerce-session',
    expiresAt: '2999-01-01T00:00:00.000Z',
  })]]);
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

test('saving a Work repairs legacy cached media without re-persisting playback URLs', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const storage = ecommerceStorage();
  const transientUrl = '/api/video/media/legacy-video?purpose=playback&signature=expired';
  storage.setItem('sb-works', JSON.stringify([{
    _saveKey: 'legacy-media-work',
    _phone: 'owner@example.com',
    video_url: transientUrl,
    video: {
      stableUrl: '/api/video/assets/legacy-video',
      playbackUrl: transientUrl,
      url: transientUrl,
    },
  }]));
  globalThis.localStorage = storage;
  globalThis.fetch = async () => new Response(JSON.stringify({ _saveKey: 'saved-media-work' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });

  const { saveWork } = await import(`../src/services/api.js?save-work-cache=${Date.now()}`);
  await saveWork({
    title: '新作品',
    video_url: transientUrl,
    video: { stableUrl: '/api/video/assets/new-video', playbackUrl: transientUrl, url: transientUrl },
  }, 'owner@example.com');

  const cached = JSON.parse(storage.getItem('sb-works'));
  const legacy = cached.find(work => work._saveKey === 'legacy-media-work');
  assert.equal(legacy.video_url, '/api/video/assets/legacy-video');
  assert.equal(legacy.video.url, '/api/video/assets/legacy-video');
  assert.equal(legacy.video.playbackUrl, undefined);
});

function ecommerceTaskResponse(task, status = 200) {
  return new Response(JSON.stringify({ task }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function completedContentStream() {
  return new Response(
    'data: {"type":"complete","cover_url":"/api/generated-assets/cover.png","image_urls":["/api/generated-assets/page.png"],"billing":{"currency":"content_sets","status":"settled","balance":2}}\n\n',
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );
}

test('composition lookup is authenticated and scoped to one project version', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = ecommerceStorage();
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), authorization: options.headers?.Authorization });
    return new Response(JSON.stringify({ documents: [{ id: 'composition-1' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });

  const { listTextCompositions } = await import(`../src/services/api.js?composition-list=${Date.now()}`);
  const documents = await listTextCompositions({ projectId: 'project-1', versionId: 'version-1' });

  assert.deepEqual(documents, [{ id: 'composition-1' }]);
  assert.equal(calls[0].url, '/api/compositions?projectId=project-1&versionId=version-1');
  assert.equal(calls[0].authorization, 'Bearer signed-ecommerce-session');
});

test('Canvas pixel-layer and PSD export helpers use signed owner requests only', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = ecommerceStorage();
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url);
    if (path.endsWith('/api/billing/quote')) {
      return new Response(JSON.stringify({ quote: { quoteId: 'layer-quote' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    calls.push({
      url: path,
      authorization: options.headers?.Authorization,
      body: options.body ? JSON.parse(options.body) : null,
    });
    if (path.endsWith('/api/canvas/pixel-layers')) {
      return new Response(JSON.stringify({
        document: { id: 'composition-1', capabilities: { semanticAnalysis: true, pixelLayers: true, psdExport: true } },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: {
        'content-type': 'image/vnd.adobe.photoshop',
        'content-disposition': 'attachment; filename="composition-1.psd"',
      },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });

  const { createCanvasPixelLayers, exportCanvasPsd } = await import(`../src/services/api.js?canvas-psd=${Date.now()}`);
  const layered = await createCanvasPixelLayers({ documentId: 'composition-1', expectedRevision: 2 });
  const psd = await exportCanvasPsd({ documentId: 'composition-1' });

  assert.equal(layered.document.capabilities.psdExport, true);
  assert.deepEqual(Array.from(new Uint8Array(psd.buffer)), [1, 2, 3]);
  assert.equal(psd.filename, 'composition-1.psd');
  assert.deepEqual(calls.map(call => call.url), ['/api/canvas/pixel-layers', '/api/canvas/psd-export']);
  assert.equal(calls[0].body.billing_quote_id, 'layer-quote');
  assert.ok(calls[0].body.billing_action_id);
  for (const call of calls) {
    assert.equal(call.authorization, 'Bearer signed-ecommerce-session');
    assert.equal(Object.hasOwn(call.body, 'email'), false);
  }
});

test('paid content APIs send owned reference asset IDs rather than raw resumable image data', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const storage = ecommerceStorage();
  const bodies = [];
  globalThis.localStorage = storage;
  globalThis.fetch = async (_url, options = {}) => {
    bodies.push(JSON.parse(options.body));
    return completedContentStream();
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });

  const { generateContent, generatePlogContent } = await import(`../src/services/api.js?content-assets=${Date.now()}`);
  await generateContent('夏日通勤', [], { referenceAssetIds: ['a'.repeat(64) + '.jpg'] });
  await generatePlogContent({
    text: '下班后的咖啡',
    referenceAssets: {
      style: ['b'.repeat(64) + '.png'],
      source: ['c'.repeat(64) + '.webp'],
    },
  });

  assert.deepEqual(bodies[0].images, []);
  assert.deepEqual(bodies[0].referenceAssetIds, ['a'.repeat(64) + '.jpg']);
  assert.equal(bodies[0].images.includes?.('data:image/png;base64,unsafe') || false, false);
  assert.equal(bodies[1].refImage, undefined);
  assert.deepEqual(bodies[1].referenceAssets, {
    style: ['b'.repeat(64) + '.png'],
    source: ['c'.repeat(64) + '.webp'],
  });
});

test('active owner and draft task resumes with GET polling, emits only a delivered stable image once, and never posts a duplicate', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const storage = ecommerceStorage();
  const calls = [];
  const emitted = [];
  globalThis.localStorage = storage;
  saveEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-resume', taskId: 'task-resume', storage });
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    if (calls.length === 1) {
      return ecommerceTaskResponse({
        id: 'task-resume',
        status: 'quality_check',
        assets: [{ assetId: 'main-1', role: 'main_text', label: '主图文案', status: 'quality_check', stableUrl: '/api/generated-assets/main-1.png' }],
      });
    }
    return ecommerceTaskResponse({
      id: 'task-resume',
      status: 'completed',
      assets: [{
        assetId: 'main-1',
        role: 'main_text',
        label: '主图文案',
        displayName: '主图文案',
        group: '主图',
        ratio: '1:1',
        size: '2048x2048',
        width: 2048,
        height: 2048,
        status: 'completed',
        stableUrl: '/api/generated-assets/main-1.png',
      }],
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });

  const { generateEcommerce } = await import(`../src/services/api.js?resume=${Date.now()}`);
  const result = await generateEcommerce({
    productName: '测试商品', category: '其他', platform: '淘宝', draftId: 'ec-draft-resume',
    pollIntervalMs: 0, maxPollAttempts: 3, onImage: image => emitted.push(image),
  });

  assert.equal(result.taskId, 'task-resume');
  assert.deepEqual(result.imageRecords, [{
    id: 'main-1',
    key: 'main-1',
    assetId: 'main-1',
    url: '/api/generated-assets/main-1.png',
    stableUrl: '/api/generated-assets/main-1.png',
    displayName: '主图文案',
    name: '主图文案',
    label: '主图文案',
    role: 'main_text',
    group: '主图',
    ratio: '1:1',
    size: '2048x2048',
    width: 2048,
    height: 2048,
    state: 'completed',
  }]);
  assert.deepEqual(calls, [
    { url: '/api/ecommerce/jobs/task-resume', method: 'GET' },
    { url: '/api/ecommerce/jobs/task-resume', method: 'GET' },
  ]);
  assert.deepEqual(emitted, [{
    id: 'main-1', url: '/api/generated-assets/main-1.png', stableUrl: '/api/generated-assets/main-1.png',
    role: 'main_text', label: '主图文案', displayName: '主图文案', group: '主图', ratio: '1:1',
    size: '2048x2048', width: 2048, height: 2048, state: 'completed', taskId: 'task-resume',
  }]);
  assert.equal(loadEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-resume', storage }), null);
});

test('a timeout preserves the newly saved owner and draft task reference', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const storage = ecommerceStorage();
  globalThis.localStorage = storage;
  globalThis.fetch = async (_url, options = {}) => {
    if (options.method === 'POST') {
      return new Response(JSON.stringify({ taskId: 'task-timeout' }), { status: 202, headers: { 'content-type': 'application/json' } });
    }
    return ecommerceTaskResponse({ id: 'task-timeout', status: 'polling', assets: [] });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });

  const { generateEcommerce } = await import(`../src/services/api.js?timeout=${Date.now()}`);
  await assert.rejects(
    generateEcommerce({ productName: '测试商品', category: '其他', platform: '淘宝', draftId: 'ec-draft-timeout', pollIntervalMs: 0, maxPollAttempts: 1 }),
    error => error.code === 'ECOMMERCE_POLL_TIMEOUT' && error.resumeable === true,
  );
  const reference = loadEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-timeout', storage });
  assert.equal(reference?.taskId, 'task-timeout');
  assert.equal(typeof reference?.createdAt, 'number');
});

test('a forbidden saved task is cleared as expired without posting or leaking another owner reference', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const storage = ecommerceStorage();
  globalThis.localStorage = storage;
  saveEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-expired', taskId: 'task-forbidden', storage });
  saveEcommerceTaskReference({ ownerEmail: 'other@example.com', draftId: 'ec-draft-expired', taskId: 'task-other', storage });
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    return new Response(JSON.stringify({ error: '无权读取此任务' }), { status: 403, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });

  const { generateEcommerce } = await import(`../src/services/api.js?expired=${Date.now()}`);
  await assert.rejects(
    generateEcommerce({ productName: '测试商品', category: '其他', platform: '淘宝', draftId: 'ec-draft-expired' }),
    error => error.code === 'ECOMMERCE_TASK_EXPIRED' && error.status === 403,
  );
  assert.deepEqual(calls, [{ url: '/api/ecommerce/jobs/task-forbidden', method: 'GET' }]);
  assert.equal(loadEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-expired', storage }), null);
  assert.equal(loadEcommerceTaskReference({ ownerEmail: 'other@example.com', draftId: 'ec-draft-expired', storage })?.taskId, 'task-other');
});

test('terminal failed and cancelled polls clear their task reference without delivering partial results', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });

  for (const status of ['failed', 'cancelled']) {
    const storage = ecommerceStorage();
    globalThis.localStorage = storage;
    globalThis.fetch = async (_url, options = {}) => options.method === 'POST'
      ? new Response(JSON.stringify({ taskId: `task-${status}` }), { status: 202, headers: { 'content-type': 'application/json' } })
      : ecommerceTaskResponse({ id: `task-${status}`, status, assets: [], error: '任务停止' });
    const { generateEcommerce } = await import(`../src/services/api.js?terminal-${status}=${Date.now()}`);
    await assert.rejects(
      generateEcommerce({ productName: '测试商品', category: '其他', platform: '淘宝', draftId: `ec-draft-${status}`, pollIntervalMs: 0, maxPollAttempts: 1 }),
      status === 'cancelled' ? /生成已停止/ : /任务停止.*请重试未完成的图片/,
    );
    assert.equal(loadEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: `ec-draft-${status}`, storage }), null, status);
  }

});

test('an incomplete suite is repaired automatically and only the complete retry is delivered', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const storage = ecommerceStorage();
  const calls = [];
  const emitted = [];
  globalThis.localStorage = storage;
  saveEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-review', taskId: 'task-review', storage });
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url);
    const method = options.method || 'GET';
    calls.push({ path, method, body: options.body ? JSON.parse(options.body) : null });
    if (path === '/api/ecommerce/jobs/task-review') {
      return ecommerceTaskResponse({
        id: 'task-review',
        status: 'needs_review',
        output: { images: {} },
        assets: [
          { assetId: 'main-1', status: 'completed', stableUrl: '/api/generated-assets/partial-main.png' },
          { assetId: 'detail-1', status: 'needs_review', previewUrl: '/api/generated-assets/review-2.png' },
        ],
      });
    }
    if (path === '/api/ecommerce/jobs/task-review/retry-plan') {
      return new Response(JSON.stringify({ plan: { sku: 'ec_image_2k', quantity: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (path === '/api/billing/quote') {
      return new Response(JSON.stringify({ quote: { quoteId: 'retry-quote', totalUnits: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (path === '/api/ecommerce/jobs/task-review/retry-failed') {
      return new Response(JSON.stringify({ taskId: 'task-review-retry', status: 'queued' }), { status: 202, headers: { 'content-type': 'application/json' } });
    }
    if (path === '/api/ecommerce/jobs/task-review-retry') {
      return ecommerceTaskResponse({
        id: 'task-review-retry',
        status: 'completed',
        output: {
          images: {
            'main-1': '/api/generated-assets/final-main.png',
            'detail-1': '/api/generated-assets/final-detail.png',
          },
          errors: [],
        },
        assets: [
          { assetId: 'main-1', status: 'completed', stableUrl: '/api/generated-assets/final-main.png' },
          { assetId: 'detail-1', status: 'completed', stableUrl: '/api/generated-assets/final-detail.png' },
        ],
      });
    }
    throw new Error(`unexpected fetch: ${method} ${path}`);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });

  const { generateEcommerce } = await import(`../src/services/api.js?auto-suite-repair=${Date.now()}`);
  const result = await generateEcommerce({
    productName: '测试商品',
    category: '其他',
    platform: '淘宝',
    draftId: 'ec-draft-review',
    pollIntervalMs: 0,
    maxPollAttempts: 2,
    onImage: image => emitted.push(image),
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.taskId, 'task-review-retry');
  assert.deepEqual(emitted.map(image => image.stableUrl).sort(), [
    '/api/generated-assets/final-detail.png',
    '/api/generated-assets/final-main.png',
  ]);
  assert.equal(emitted.some(image => image.stableUrl.includes('review-')), false);
  assert.deepEqual(calls.map(call => [call.method, call.path]), [
    ['GET', '/api/ecommerce/jobs/task-review'],
    ['POST', '/api/ecommerce/jobs/task-review/retry-plan'],
    ['POST', '/api/billing/quote'],
    ['POST', '/api/ecommerce/jobs/task-review/retry-failed'],
    ['GET', '/api/ecommerce/jobs/task-review-retry'],
  ]);
  assert.equal(loadEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-review', storage }), null);
});

test('a saved failed task requires an explicit retry before a replacement POST is allowed', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const storage = ecommerceStorage();
  const calls = [];
  globalThis.localStorage = storage;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    if (options.method === 'POST') {
      return new Response('data: {"type":"complete","images":{"main":"/api/generated-assets/retry.png"},"errors":[]}\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    }
    return ecommerceTaskResponse({ id: 'task-failed-resume', status: 'failed', assets: [], error: '上次任务失败' });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });

  saveEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-failed-resume', taskId: 'task-failed-resume', storage });
  const { generateEcommerce } = await import(`../src/services/api.js?retry-required=${Date.now()}`);
  await assert.rejects(
    generateEcommerce({ productName: '测试商品', category: '其他', platform: '淘宝', draftId: 'ec-draft-failed-resume' }),
    error => error.code === 'ECOMMERCE_TASK_RETRY_REQUIRED',
  );
  assert.deepEqual(calls, [{ url: '/api/ecommerce/jobs/task-failed-resume', method: 'GET' }]);

  saveEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-failed-resume', taskId: 'task-failed-resume', storage });
  const retryResult = await generateEcommerce({
    productName: '测试商品',
    category: '其他',
    platform: '淘宝',
    draftId: 'ec-draft-failed-resume',
    retry: true,
  });
  assert.equal(retryResult.status, 'completed');
  assert.deepEqual(calls.slice(1), [
    { url: '/api/ecommerce/jobs/task-failed-resume', method: 'GET' },
    { url: '/api/generate-ecommerce', method: 'POST' },
  ]);
});

test('SSE full-batch failure stops without an automatic retry or billing quote', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const storage = ecommerceStorage();
  const calls = [];
  let retryNumber = 0;
  globalThis.localStorage = storage;
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url);
    const method = options.method || 'GET';
    calls.push({ url: path, method });
    if (path === '/api/generate-ecommerce') {
      return new Response(
        'data: {"type":"job","taskId":"task-sse-review"}\n\n' +
        'data: {"type":"image","id":"main","state":"needs_review","previewUrl":"/api/generated-assets/sse-review.png"}\n\n' +
        'data: {"type":"complete","status":"needs_review","images":{"main":"/api/generated-assets/sse-review.png"},"errors":[]}\n\n',
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      );
    }
    if (path.endsWith('/retry-plan')) {
      return new Response(JSON.stringify({ plan: { sku: 'ec_image_2k', quantity: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (path === '/api/billing/quote') {
      return new Response(JSON.stringify({ quote: { quoteId: `repair-quote-${retryNumber + 1}`, totalUnits: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (path.endsWith('/retry-failed')) {
      retryNumber += 1;
      return new Response(JSON.stringify({ taskId: `task-sse-retry-${retryNumber}`, status: 'queued' }), { status: 202, headers: { 'content-type': 'application/json' } });
    }
    return ecommerceTaskResponse({
      id: path.split('/').pop(),
      status: 'needs_review',
      assets: [{ assetId: 'main', status: 'needs_review', previewUrl: '/api/generated-assets/sse-review.png' }],
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });

  const { generateEcommerce } = await import(`../src/services/api.js?sse-needs-review=${Date.now()}`);
  await assert.rejects(
    generateEcommerce({
      productName: '测试商品',
      category: '其他',
      platform: '淘宝',
      draftId: 'ec-draft-sse-review',
    }),
    error => error.code === 'ECOMMERCE_TASK_RETRY_REQUIRED'
      && error.retryable === true
      && /停止自动重跑/.test(error.message),
  );
  assert.equal(loadEcommerceTaskReference({
    ownerEmail: 'owner@example.com',
    draftId: 'ec-draft-sse-review',
    storage,
  })?.taskId, 'task-sse-review');
  assert.equal(retryNumber, 0);
  assert.equal(calls.filter(call => call.url.endsWith('/retry-failed')).length, 0);
  assert.equal(calls.filter(call => call.url === '/api/billing/quote').length, 0);
});

test('legacy ecommerce SSE never previews a quality-check intermediate as a delivered image', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const emitted = [];
  globalThis.localStorage = ecommerceStorage();
  globalThis.fetch = async () => new Response(
    'data: {"type":"job","taskId":"task-sse-delivery"}\n\n'
      + 'data: {"type":"image","id":"main-1","url":"/api/generated-assets/intermediate.png","state":"quality_check"}\n\n'
      + 'data: {"type":"image","id":"main-1","url":"/api/generated-assets/review.png","state":"needs_review"}\n\n'
      + 'data: {"type":"image","id":"main-1","url":"/api/generated-assets/unknown.png"}\n\n'
      + 'data: {"type":"image","id":"main-1","url":"/api/generated-assets/final.png","state":"completed"}\n\n'
      + 'data: {"type":"complete","status":"completed","images":{"main-1":"/api/generated-assets/final.png"},"errors":[]}\n\n',
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });

  const { generateEcommerce } = await import(`../src/services/api.js?sse-delivery=${Date.now()}`);
  const result = await generateEcommerce({
    productName: '测试商品', category: '其他', platform: '淘宝', onImage: image => emitted.push(image),
  });

  assert.deepEqual(result.images, { 'main-1': '/api/generated-assets/final.png' });
  assert.deepEqual(emitted.map(image => [image.stableUrl, image.state]), [
    ['/api/generated-assets/final.png', 'completed'],
  ]);
});

test('frontend generation entrypoints only target implemented generation routes', async () => {
  const api = await fs.readFile(new URL('../src/services/api.js', import.meta.url), 'utf8');
  const server = await fs.readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  assert.match(api, /\/api\/generate-ecommerce/);
  assert.doesNotMatch(api, /generate-ecommerce-v2|\/api\/auto-generate|\/api\/trial\//);
  assert.equal((server.match(/app\.get\('\/api\/ecommerce\/jobs\/:id'/g) || []).length, 1);
  assert.match(server, /app\.post\('\/api\/generate-ecommerce'/);
  assert.match(server, /app\.post\('\/api\/ecommerce\/design-directions'/);
  assert.match(server, /app\.post\('\/api\/canvas\/regenerate'/);
  assert.doesNotMatch(server, /quality:\s*['"]high['"]/);
});

test('stable ecommerce quality analysis uses the detected JPEG, PNG, or WebP MIME', async () => {
  const server = await fs.readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  assert.match(server, /async function analyzeStableEcommerceAsset\(/);
  assert.match(server, /stableAssetDataUrl\(\{\s*buffer,\s*contentType:/);
  const start = server.indexOf('async function analyzeStableEcommerceAsset(');
  const end = server.indexOf('\nfunction qualityAdapter', start);
  const qualitySource = server.slice(start, end);
  assert.doesNotMatch(qualitySource, /contentType:\s*['"]image\/png['"]/);
  assert.match(qualitySource, /createEcommerceVlmClient\(\)\.analyzeJson\(/);
  assert.doesNotMatch(qualitySource, /callMiniLLM\(/);
});

test('formal ecommerce visual quality schema requires an explicit semantic layout verdict', async () => {
  const server = await fs.readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const start = server.indexOf('async function analyzeStableEcommerceAsset(');
  const end = server.indexOf('\nconst ecommerceBilling', start);
  const qualitySource = server.slice(start, end);

  assert.match(qualitySource, /buildFormalEcommerceQualityPrompt\(\)/);
  assert.doesNotMatch(qualitySource, /single_product\|collage\|uncertain/);
  assert.match(qualitySource, /details:[\s\S]*layout/);
});

test('ecommerce asset upload forwards a caller AbortController signal', async t => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let requestSignal;
  globalThis.fetch = async (_url, options = {}) => {
    requestSignal = options.signal;
    return new Response(JSON.stringify({
      original: { assetId: 'asset-upload-signal', url: '/api/assets/original.png', role: 'product' },
      preview: { url: '/api/assets/preview.png' },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { uploadEcommerceAsset } = await import(`../src/services/api.js?asset-signal=${Date.now()}`);
  const asset = await uploadEcommerceAsset({
    data: 'data:image/png;base64,AA==',
    role: 'product',
    signal: controller.signal,
  });
  assert.equal(requestSignal, controller.signal);
  assert.equal(asset.assetId, 'asset-upload-signal');
});

test('generation rejects a stream that never reaches complete', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = { getItem: () => JSON.stringify({ email: '867550189@qq.com' }) };
  globalThis.fetch = async () => new Response(
    'data: {"type":"progress","step":"generating"}\n\n',
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );
  const { generateEcommerce } = await import(`../src/services/api.js?contract=${Date.now()}`);
  await assert.rejects(
    generateEcommerce({ productName: '测试商品', category: '其他', platform: '淘宝' }),
    /生成未完成/
  );
});

test('generation propagates an SSE error instead of swallowing it as parse noise', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = { getItem: () => JSON.stringify({ email: '867550189@qq.com' }) };
  globalThis.fetch = async () => new Response(
    'data: {"type":"error","error":"上游生成失败","code":"UPSTREAM_ERROR"}\n\n',
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );
  const { generateEcommerce } = await import(`../src/services/api.js?error=${Date.now()}`);
  await assert.rejects(
    generateEcommerce({ productName: '测试商品', category: '其他', platform: '淘宝' }),
    /上游生成失败/
  );
});

test('generation does not report success when the completed task contains no images', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = { getItem: () => JSON.stringify({ email: '867550189@qq.com' }) };
  globalThis.fetch = async () => new Response(
    'data: {"type":"complete","images":{},"errors":[{"error":"上游没有返回图片"}]}\n\n',
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );
  const { generateEcommerce } = await import(`../src/services/api.js?empty=${Date.now()}`);
  await assert.rejects(
    generateEcommerce({ productName: '测试商品', category: '其他', platform: '淘宝' }),
    /上游没有返回图片/
  );
});

test('homepage ecommerce long-description mode uses the unified ecommerce route', async () => {
  const source = await fs.readFile(new URL('../src/pages/Home/XhsContentMode.jsx', import.meta.url), 'utf8');
  assert.match(source, /generateEcommerce\(/);
  assert.doesNotMatch(source, /for \(let i = 0; i < 5; i\+\+\)[\s\S]{0,500}regenerateImage\(/);
});

test('canvas regeneration forwards supplementary visual references', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const requests = [];
  const controller = new AbortController();
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = { getItem: () => JSON.stringify({ email: '867550189@qq.com' }) };
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    requests.push({ url: String(url), body, signal: options.signal });
    if (String(url).endsWith('/api/billing/quote')) {
      return new Response(JSON.stringify({ quote: { quoteId: 'canvas-quote' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ url: '/api/generated-assets/test.png', taskId: 'canvas-task-1', replay: false }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const { regenerateCanvasImage } = await import(`../src/services/api.js?canvas-refs=${Date.now()}`);
  const generated = await regenerateCanvasImage({
    prompt: '保留商品结构，换成夏日场景',
    imageUrl: '/api/generated-assets/source.png',
    referenceImages: ['/api/ec-temp-img/reference.png'],
    references: [
      { sourceNodeId: 'source', assetId: 'asset-source', url: '/api/generated-assets/source.png', displayName: '正面图', mention: '@正面图', role: 'product', order: 0 },
      { sourceNodeId: 'reference', assetId: 'asset-reference', url: '/api/ec-temp-img/reference.png', displayName: '参考图 1', mention: '@参考图 1', role: 'reference', order: 1 },
    ],
    ratio: '3:4',
    resolution: '4K',
    creationIntent: 'visual',
    skillId: 'poster',
    includeMetadata: true,
    signal: controller.signal,
  });
  assert.deepEqual(generated, { url: '/api/generated-assets/test.png', taskId: 'canvas-task-1', replay: false, ratio: '', resolution: '' });
  const requestBody = requests.find(request => request.url.endsWith('/api/canvas/regenerate')).body;
  assert.deepEqual(requestBody.reference_images, ['/api/ec-temp-img/reference.png']);
  assert.deepEqual(requestBody.reference_metadata.map(item => item.mention), ['@正面图', '@参考图 1']);
  assert.equal(requestBody.ratio, '3:4');
  assert.equal(requestBody.resolution, '4K');
  assert.equal(requestBody.creation_intent, 'visual');
  assert.equal(requestBody.skill_id, 'poster');
  assert.equal(requests.find(request => request.url.endsWith('/api/canvas/regenerate')).signal, controller.signal);
  assert.equal(requests.find(request => request.url.endsWith('/api/billing/quote')).body.sku, 'ec_image_4k');
  assert.equal(requestBody.billing_quote_id, 'canvas-quote');
  assert.match(requestBody.request_key, /^canvas-[0-9a-f]{8}$/);
  assert.equal(requestBody.billing_action_id, requestBody.request_key);
});

test('canvas regeneration recovers a gateway timeout by polling durable status without resubmitting', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const requests = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = { getItem: () => JSON.stringify({ email: '867550189@qq.com' }) };
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), body: JSON.parse(options.body || '{}') });
    if (String(url).endsWith('/api/billing/quote')) {
      return new Response(JSON.stringify({ quote: { quoteId: 'timeout-quote' } }), { status: 200 });
    }
    if (String(url).endsWith('/api/canvas/regenerate/status')) {
      return new Response(JSON.stringify({
        status: 'completed',
        taskId: 'canvas-timeout-recovered',
        url: '/api/generated-assets/recovered.png',
        ratio: '3:4',
        resolution: '2K',
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'gateway timeout' }), { status: 524 });
  };

  const { regenerateCanvasImage } = await import(`../src/services/api.js?canvas-timeout-recovery=${Date.now()}`);
  const result = await regenerateCanvasImage({
    prompt: '保留商品结构并生成场景图',
    imageUrl: '/api/generated-assets/source.png',
    ratio: '3:4',
    includeMetadata: true,
  });

  assert.equal(result.url, '/api/generated-assets/recovered.png');
  assert.equal(requests.filter(request => request.url.endsWith('/api/canvas/regenerate')).length, 1);
  assert.equal(requests.filter(request => request.url.endsWith('/api/canvas/regenerate/status')).length, 1);
  const generationBody = requests.find(request => request.url.endsWith('/api/canvas/regenerate')).body;
  const statusBody = requests.find(request => request.url.endsWith('/api/canvas/regenerate/status')).body;
  assert.equal(statusBody.request_key, generationBody.request_key);
  assert.equal(statusBody.billing_action_id, generationBody.billing_action_id);
});

test('Canvas text generation sends ordered visual references to the signed vision route', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const requests = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = {
    getItem: () => JSON.stringify({ token: 'signed-canvas-session', expiresAt: '2999-01-01T00:00:00.000Z' }),
  };
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), headers: options.headers, body: JSON.parse(options.body || '{}') });
    if (String(url).endsWith('/api/billing/quote')) {
      return new Response(JSON.stringify({ quote: { quoteId: 'canvas-text-quote' } }), { status: 200 });
    }
    return new Response(JSON.stringify({ text: '保留杯身结构的夏日卖点文案' }), { status: 200 });
  };

  const { regenerateCanvasText } = await import(`../src/services/api.js?canvas-text-refs=${Date.now()}`);
  const result = await regenerateCanvasText({
    prompt: '提炼三条卖点',
    referenceImages: ['/api/generated-assets/a.png', '/api/generated-assets/b.png'],
    references: [
      { sourceNodeId: 'a', url: '/api/generated-assets/a.png', displayName: '正面图', mention: '@正面图', role: 'product', order: 0 },
      { sourceNodeId: 'b', url: '/api/generated-assets/b.png', displayName: '参考图 1', mention: '@参考图 1', role: 'reference', order: 1 },
    ],
    count: 3,
  });

  assert.equal(result.text, '保留杯身结构的夏日卖点文案');
  assert.equal(requests[0].url, '/api/billing/quote');
  assert.equal(requests[0].body.sku, 'ec_ai_assistant');
  assert.equal(requests[1].url, '/api/canvas/regenerate-text');
  assert.equal(requests[1].headers.Authorization, 'Bearer signed-canvas-session');
  assert.deepEqual(requests[1].body.reference_images, ['/api/generated-assets/a.png', '/api/generated-assets/b.png']);
  assert.deepEqual(requests[1].body.reference_metadata.map(item => item.mention), ['@正面图', '@参考图 1']);
  assert.equal(requests[1].body.count, 3);
  assert.equal(requests[1].body.billing_quote_id, 'canvas-text-quote');
  assert.match(requests[1].body.billing_action_id, /^canvas-[0-9a-f]{8}$/);
});

test('canvas regeneration keeps a stable billing action for retries and separates explicit variants', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const requests = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = { getItem: () => JSON.stringify({ email: '867550189@qq.com' }) };
  globalThis.fetch = async (url, options = {}) => {
    const body = JSON.parse(options.body || '{}');
    requests.push({ url: String(url), body, signal: options.signal });
    if (String(url).endsWith('/api/billing/quote')) {
      return new Response(JSON.stringify({ quote: { quoteId: `quote-${requests.length}` } }), { status: 200 });
    }
    return new Response(JSON.stringify({ url: '/api/generated-assets/canvas.png' }), { status: 200 });
  };

  const api = await import(`../src/services/api.js?stable-canvas-action=${Date.now()}`);
  const base = { prompt: '保留商品结构', imageUrl: '/api/generated-assets/source.png', ratio: '1:1' };
  await api.regenerateCanvasImage({ ...base, requestKey: 'run-1:1' });
  await api.regenerateCanvasImage({ ...base, requestKey: 'run-1:1' });
  await api.regenerateCanvasImage({ ...base, requestKey: 'run-1:2' });

  const generationRequests = requests.filter(request => request.url.endsWith('/api/canvas/regenerate'));
  assert.equal(generationRequests.length, 3);
  assert.equal(generationRequests[0].body.billing_action_id, generationRequests[1].body.billing_action_id);
  assert.notEqual(generationRequests[0].body.billing_action_id, generationRequests[2].body.billing_action_id);
  assert.equal(generationRequests[0].body.request_key, generationRequests[1].body.request_key);
  assert.notEqual(generationRequests[0].body.request_key, generationRequests[2].body.request_key);
});

test('Canvas API helpers send the signed session token and omit body email authority', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const requests = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = {
    getItem: () => JSON.stringify({
      email: 'stale-owner@example.com',
      token: 'signed-canvas-session',
      expiresAt: '2999-01-01T00:00:00.000Z',
    }),
  };
  globalThis.fetch = async (url, options = {}) => {
    requests.push({
      url: String(url),
      headers: options.headers || {},
      body: JSON.parse(options.body || '{}'),
    });
    if (String(url).endsWith('/api/billing/quote')) {
      return new Response(JSON.stringify({ quote: { quoteId: `quote-${requests.length}` } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      url: '/api/generated-assets/canvas.png',
      layers: [],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const api = await import(`../src/services/api.js?canvas-auth=${Date.now()}`);
  await api.regenerateCanvasImage({
    prompt: '保留商品结构',
    imageUrl: '/api/generated-assets/source.png',
    ratio: '1:1',
  });
  await api.transformCanvasImage({
    action: 'upscale',
    imageUrl: '/api/generated-assets/source.png',
  });
  await api.transformCanvasImage({
    action: 'upscale',
    imageUrl: '/api/generated-assets/source.png',
    resolution: '4K',
  });
  await api.analyzeCanvasLayers('/api/generated-assets/source.png');

  assert.deepEqual(requests.map(request => request.url), [
    '/api/billing/quote',
    '/api/canvas/regenerate',
    '/api/billing/quote',
    '/api/canvas/transform',
    '/api/billing/quote',
    '/api/canvas/transform',
    '/api/billing/quote',
    '/api/canvas/analyze-layers',
  ]);
  assert.deepEqual(
    requests.filter(request => request.url.endsWith('/api/billing/quote')).map(request => request.body.sku),
    ['ec_image_2k', 'ec_image_2k', 'ec_image_4k', 'ec_smart_layer'],
  );
  const layerRequest = requests.find(request => request.url.endsWith('/api/canvas/analyze-layers'));
  assert.match(layerRequest.body.billing_quote_id, /^quote-/);
  assert.match(layerRequest.body.billing_action_id, /^canvas-[0-9a-f-]{36}$/i);
  for (const request of requests) {
    assert.equal(request.headers.Authorization, 'Bearer signed-canvas-session', request.url);
    assert.equal(Object.hasOwn(request.body, 'email'), false, request.url);
  }
});

test('Canvas browser segmentation sends a signed plan before billed mask materialization', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const requests = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = {
    getItem: () => JSON.stringify({
      token: 'signed-canvas-session',
      expiresAt: '2999-01-01T00:00:00.000Z',
    }),
  };
  globalThis.fetch = async (url, options = {}) => {
    const body = JSON.parse(options.body || '{}');
    requests.push({ url: String(url), headers: options.headers || {}, body });
    if (String(url).endsWith('/api/billing/quote')) {
      return new Response(JSON.stringify({ quote: { quoteId: `quote-${requests.length}` } }), { status: 200 });
    }
    if (String(url).endsWith('/api/canvas/segmentation-plan')) {
      return new Response(JSON.stringify({
        source: { width: 100, height: 80 },
        prompts: [{ id: 'product-1', box: [10, 10, 50, 50] }],
        plan_token: 'signed-plan',
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ url: '/api/generated-assets/result.png', layers: [] }), { status: 200 });
  };

  const api = await import(`../src/services/api.js?browser-segmentation=${Date.now()}`);
  const masks = [{ prompt_id: 'product-1', data: 'data:image/png;base64,iVBORw0KGgo=' }];
  await api.createCanvasSegmentationPlan('/api/generated-assets/source.png');
  await api.removeBg({
    image_url: '/api/generated-assets/source.png',
    segmentation_plan_token: 'signed-plan',
    segmentation_masks: masks,
  });
  await api.analyzeCanvasLayers('/api/generated-assets/source.png', {
    planToken: 'signed-plan',
    masks,
  });

  assert.deepEqual(requests.map(request => request.url), [
    '/api/canvas/segmentation-plan',
    '/api/billing/quote',
    '/api/remove-bg',
    '/api/billing/quote',
    '/api/canvas/analyze-layers',
  ]);
  for (const request of requests) assert.equal(request.headers.Authorization, 'Bearer signed-canvas-session');
  for (const request of requests.filter(item => !item.url.endsWith('/api/billing/quote') && !item.url.endsWith('/api/canvas/segmentation-plan'))) {
    assert.equal(request.body.segmentation_plan_token, 'signed-plan');
    assert.deepEqual(request.body.segmentation_masks, masks);
  }
});

test('Canvas API helpers preserve structured non-2xx errors', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = {
    getItem: () => JSON.stringify({
      token: 'expired-canvas-session',
      expiresAt: '2999-01-01T00:00:00.000Z',
    }),
  };
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: '登录状态无效或已过期',
    code: 'AUTH_SESSION_REQUIRED',
    resumeable: false,
    detail: 'signed Canvas request rejected',
  }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });

  const api = await import(`../src/services/api.js?canvas-errors=${Date.now()}`);
  const calls = [
    () => api.regenerateCanvasImage({
      prompt: '保留商品结构',
      imageUrl: '/api/generated-assets/source.png',
      ratio: '1:1',
    }),
    () => api.transformCanvasImage({
      action: 'upscale',
      imageUrl: '/api/generated-assets/source.png',
    }),
    () => api.analyzeCanvasLayers('/api/generated-assets/source.png'),
  ];

  for (const call of calls) {
    await assert.rejects(
      call(),
      error => error.name === 'ApiError'
        && error.status === 401
        && error.code === 'AUTH_SESSION_REQUIRED'
        && error.payload?.detail === 'signed Canvas request rejected',
    );
  }
});

test('all service-layer expensive requests carry the authenticated session email', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const requests = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = { getItem: () => JSON.stringify({ email: '867550189@qq.com' }) };
  globalThis.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : {};
    requests.push({ url: String(url), body, signal: options.signal });
    if (String(url).endsWith('/api/billing/quote')) {
      return new Response(JSON.stringify({ quote: { quoteId: `quote-${requests.length}` } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (String(url).endsWith('/api/generate')) {
      return new Response('data: {"type":"complete","image_urls":[],"cover_url":""}\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    }
    if (String(url).endsWith('/api/regenerate-image')) {
      return new Response(JSON.stringify({ url: '/api/generated-assets/test.png' }), { status: 200 });
    }
    return new Response(JSON.stringify({ prompt: 'test', url: '/api/generated-assets/test.png', directions: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const api = await import(`../src/services/api.js?auth-contract=${Date.now()}`);
  await api.reversePrompt({ image_url: '/api/generated-assets/source.png', product_name: '商品' });
  await api.removeBg({ image_url: '/api/generated-assets/source.png' });
  await api.generateContent('测试内容', []);
  await api.autoRecognizeEcommerce({ smartBrief: '测试商品', refShots: [] });
  const designDirectionController = new AbortController();
  await api.getDesignDirections(
    { product_name: '测试商品', real_shots: [], ref_shots: [] },
    { signal: designDirectionController.signal },
  );
  await api.polishECText({ text: '测试文案', product_name: '商品', category: '其他' });
  await api.extractProductLink('https://example.com/product');
  await api.regenerateImage('测试提示词', '其他');
  await api.regenerateText('测试文案', '其他');

  const generationRequests = requests.filter(request => !request.url.endsWith('/api/billing/quote'));
  assert.equal(generationRequests.length, 9);
  for (const request of generationRequests) {
    assert.equal(request.body.email, '867550189@qq.com', `${request.url} must carry session email`);
  }
  const designDirectionRequest = generationRequests.find(request => request.url.endsWith('/api/ecommerce/design-directions'));
  assert.equal(designDirectionRequest.signal, designDirectionController.signal);
  const regenerateImageRequest = generationRequests.find(request => request.url.endsWith('/api/regenerate-image'));
  assert.ok(regenerateImageRequest.body.billing_quote_id);
  assert.ok(regenerateImageRequest.body.billing_action_id);
  for (const path of ['/api/ecommerce/auto-recognize', '/api/polish-ec-text', '/api/regenerate-text', '/api/extract-product-link']) {
    const request = generationRequests.find(candidate => candidate.url.endsWith(path));
    assert.ok(request.body.billing_quote_id, `${path} must carry a server quote`);
    assert.ok(request.body.billing_action_id, `${path} must carry an idempotency action`);
  }
});

test('direct generation screens cannot bypass the authenticated API payload helpers', async () => {
  const canvas = await fs.readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const plog = await fs.readFile(new URL('../src/pages/Plog/index.jsx', import.meta.url), 'utf8');
  const xhs = await fs.readFile(new URL('../src/pages/Home/XhsContentMode.jsx', import.meta.url), 'utf8');
  const remake = await fs.readFile(new URL('../src/pages/Remake/index.jsx', import.meta.url), 'utf8');
  const api = await fs.readFile(new URL('../src/services/api.js', import.meta.url), 'utf8');

  assert.doesNotMatch(canvas, /fetch\([^\n]*\/api\/remove-bg/);
  assert.match(canvas, /removeBg\(\{[\s\S]{0,160}image_url:/);
  assert.match(plog, /generatePlogContent\(/);
  assert.match(xhs, /generatePlogContent\(/);
  assert.match(api, /JSON\.stringify\(withSessionEmail\(payload\)\)/);
  assert.match(remake, /JSON\.stringify\(withSessionEmail\(\{ taskId,[\s\S]{0,220}billing_quote_id/);
  assert.match(remake, /JSON\.stringify\(withSessionEmail\(\{[\s\S]{0,300}productName:/);
  assert.match(api, /if \(!res\.ok\) \{[\s\S]{0,100}throw await createApiError\(res,/);
  assert.match(plog, /handleGenerationAccessError\(e, dispatch,/);
  assert.match(api, /if \(!res\.ok\) \{[\s\S]{0,100}throw await createApiError\(res,/);
  assert.match(remake, /if \(!res\.ok\) throw await createApiError\(res,/);
});

test('stability hardening keeps body tiers, image-route rate limits, and polling caps wired', async () => {
  const [server, remake] = await Promise.all([
    fs.readFile(new URL('../server/index.mjs', import.meta.url), 'utf8'),
    fs.readFile(new URL('../src/pages/Remake/index.jsx', import.meta.url), 'utf8'),
  ]);

  // ② Body 大小分层：全局默认 100kb，仅 base64 图片直传路由单独放开 15mb。
  assert.match(server, /LARGE_BODY_ROUTES = new Set\(\[/);
  assert.match(server, /express\.json\(\{ limit: '15mb', verify: captureWebhookBody \}\)/);
  assert.match(server, /app\.use\(express\.json\(\{ limit: '100kb', verify: captureWebhookBody \}\)\)/);
  assert.match(server, /for \(const largeBodyRoute of LARGE_BODY_ROUTES\)/);
  // 大体名单覆盖关键 base64 直传入口；ec-temp-upload 必须在列。
  assert.match(server, /'\/api\/ec-temp-upload',/);

  // ③ 公开图片路由：限频中间件挂到 proxy-image 与 public-image。
  assert.match(server, /IMAGE_ROUTE_RATE_LIMIT = \{ max: 240/);
  assert.match(server, /function imageRouteRateLimiter/);
  assert.match(server, /app\.get\('\/api\/proxy-image', imageRouteRateLimiter,/);
  assert.match(server, /app\.get\('\/api\/public-image', imageRouteRateLimiter,/);

  // ④ Remake 轮询硬上限与用户可见失败态。
  assert.match(remake, /POLL_MAX_ATTEMPTS = 150/);
  assert.match(remake, /POLL_MAX_CONSECUTIVE_FAILURES = 5/);
  assert.match(remake, /任务处理超时：超过 5 分钟仍未完成/);
  assert.match(remake, /任务状态查询连续失败/);

  // ⑤ admin 看板系统失败率阈值标记（>10% 高亮）。
  const adminPage = await fs.readFile(new URL('../src/pages/AdminConsole/index.jsx', import.meta.url), 'utf8');
  assert.match(adminPage, /const systemFailureAlert = systemFailureRate > 0\.1/);
  assert.match(adminPage, /系统异常/);
  assert.match(adminPage, /systemFailureRate \* 100/);
});

test('pricing page exposes no legacy or clickable payment-provider path while providers are unavailable', async () => {
  const pricing = await fs.readFile(new URL('../src/pages/Pricing/index.jsx', import.meta.url), 'utf8');
  const pricingModal = await fs.readFile(new URL('../src/components/business/Modals.jsx', import.meta.url), 'utf8');
  const insufficientModal = await fs.readFile(new URL('../src/components/billing/InsufficientBalanceModal.jsx', import.meta.url), 'utf8');
  const constants = await fs.readFile(new URL('../src/constants/data.js', import.meta.url), 'utf8');
  const pricingModalOnly = pricingModal.slice(pricingModal.indexOf('export function PricingModal()'));

  for (const source of [pricing, pricingModalOnly]) {
    assert.doesNotMatch(source, /\/api\/create-payment/);
    assert.doesNotMatch(source, /支付宝支付|微信支付/);
    assert.doesNotMatch(source, /Stripe[\s\S]{0,80}(支付宝|微信)/);
    assert.doesNotMatch(source, /paid=1/);
    assert.doesNotMatch(source, /\bpaidSuccess\b/);
    assert.match(source, /支付服务接入中/);
  }
  assert.match(pricing, /所有创作功能共用一套 AI 积分/);
  assert.match(pricing, /PRICING_PLANS/);
  assert.doesNotMatch(pricing, /小红书 \/ Plog · AI 积分/);
  assert.doesNotMatch(pricingModalOnly, /小红书 \/ Plog AI 积分/);
  assert.match(pricingModalOnly, /所有创作功能共用一套 AI 积分/);
  assert.match(pricingModalOnly, /PRICING_PLANS/);
  assert.doesNotMatch(pricing, /每套套餐中的「套」是什么意思/);
  assert.doesNotMatch(pricing, /服务端|实时报价|幂等/);
  assert.doesNotMatch(pricingModalOnly, /套餐 SKU|支付通道|幂等|服务端|实时报价/);
  assert.doesNotMatch(insufficientModal, /支付通道|幂等|服务端|实时报价/);
  assert.match(insufficientModal, /查看可用套餐/);
  assert.doesNotMatch(pricingModalOnly, /CLEAR_PAYWALL/);
  assert.match(pricingModalOnly, /#0f766e|#14b8a6/i);
  assert.doesNotMatch(constants, /PRICING_EC[\s\S]{0,900}(?:price|sets|credits|grantUnits|validityDays)\s*:/);
});

test('pricing order restoration is cancelled when its owner or modal session changes', async () => {
  const pricingModal = await fs.readFile(new URL('../src/components/business/Modals.jsx', import.meta.url), 'utf8');
  const pricingModalOnly = pricingModal.slice(pricingModal.indexOf('export function PricingModal()'));
  const restoreEffect = pricingModalOnly.match(/useEffect\(\(\) => \{[\s\S]*?loadPendingPaymentOrder\(state\.phone\)[\s\S]*?\n  \}, \[plans, refreshBillingBalance, state\.logged, state\.phone, state\.showPrice\]\);/)?.[0] || '';
  assert.match(restoreEffect, /new AbortController\(\)/, 'payment restore must own an abort controller');
  assert.match(restoreEffect, /fetchBillingOrder\(saved\.orderId,\s*\{\s*signal:/, 'payment restore must pass its abort signal');
  assert.match(restoreEffect, /return \(\) => \{[\s\S]*?abort\(\)/, 'owner/modal changes must abort the restore request');
  assert.match(pricingModalOnly, /if \(state\.logged\) return undefined;[\s\S]{0,180}paymentAbortRef\.current\?\.abort\(\)/, 'logout must abort an active payment poll');
  assert.match(pricingModalOnly, /if \(state\.showPrice\) return undefined;[\s\S]{0,180}paymentAbortRef\.current\?\.abort\(\)/, 'closing the modal must abort the restore request');
});
