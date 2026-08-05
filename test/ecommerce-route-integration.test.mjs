import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

import * as orchestratorModule from '../server/ecommerceEngine/orchestrator.mjs';

const { createEcommerceRouteHandlers } = orchestratorModule;

function responseHarness() {
  return {
    statusCode: 200,
    body: null,
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

function timerHarness() {
  const pending = [];
  const cleared = [];
  return {
    pending,
    cleared,
    setTimeoutFn(callback, delay) {
      const handle = {
        callback,
        delay,
        unrefCalls: 0,
        unref() {
          this.unrefCalls += 1;
        },
      };
      pending.push(handle);
      return handle;
    },
    clearTimeoutFn(handle) {
      const index = pending.indexOf(handle);
      if (index >= 0) pending.splice(index, 1);
      cleared.push(handle);
    },
    async runNext() {
      const handle = pending.shift();
      assert.ok(handle, 'expected a scheduled recovery scan');
      await handle.callback();
      return handle;
    },
  };
}

test('generation handler returns HTTP 202 queued without waiting for provider completion', async () => {
  let runCalled = false;
  const handlers = createEcommerceRouteHandlers({
    orchestrator: {
      createJob({ ownerEmail, payload }) {
        assert.equal(ownerEmail, '867550189@qq.com');
        assert.equal(payload.product_name, '测试商品');
        return { id: 'job-http', status: 'queued' };
      },
      runJob() {
        runCalled = true;
        return new Promise(() => {});
      },
      getJob() {
        throw new Error('not used');
      },
    },
    onBackgroundError: () => {},
  });
  const req = {
    _userEmail: '867550189@qq.com',
    body: { product_name: '测试商品' },
  };
  const res = responseHarness();

  await handlers.generate(req, res);

  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.body, { taskId: 'job-http', status: 'queued' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(runCalled, true);

  const planRes = responseHarness();
  handlers.retryPlan({ _userEmail: '867550189@qq.com', params: { id: 'job-http' } }, planRes);
  assert.equal(planRes.statusCode, 503);
  assert.deepEqual(planRes.body, {
    error: '整套重试服务暂不可用，请稍后重试',
    code: 'ECOMMERCE_RETRY_UNAVAILABLE',
  });

  const retryRes = responseHarness();
  await handlers.retryFailed({
    _userEmail: '867550189@qq.com',
    params: { id: 'job-http' },
    body: { billingQuoteId: 'quote-1' },
  }, retryRes);
  assert.equal(retryRes.statusCode, 503);
  assert.deepEqual(retryRes.body, {
    error: '整套重试服务暂不可用，请稍后重试',
    code: 'ECOMMERCE_RETRY_UNAVAILABLE',
  });
});

test('generation handler retries recoverable background failures and coalesces polling wakeups', async () => {
  let attempts = 0;
  const retryDelays = [];
  let finish;
  const completed = new Promise(resolve => { finish = resolve; });
  const task = { id: 'job-recoverable', status: 'generating', assets: [] };
  const handlers = createEcommerceRouteHandlers({
    orchestrator: {
      createJob() {
        return { id: task.id, status: 'queued' };
      },
      async runJob(id) {
        assert.equal(id, task.id);
        attempts += 1;
        if (attempts < 3) {
          throw Object.assign(new Error('quality service unavailable'), {
            code: 'QUALITY_SERVICE_UNAVAILABLE',
            retryable: true,
          });
        }
        task.status = 'completed';
        finish();
        return task;
      },
      getJob() {
        return task;
      },
    },
    backgroundRetryDelaysMs: [25, 75],
    sleep: async delay => { retryDelays.push(delay); },
    onBackgroundError: error => assert.fail(error),
  });

  const generationRes = responseHarness();
  await handlers.generate({ _userEmail: 'owner@example.com', body: {} }, generationRes);
  const pollingRes = responseHarness();
  handlers.getJob({ _userEmail: 'owner@example.com', params: { id: task.id } }, pollingRes);
  await completed;

  assert.equal(generationRes.statusCode, 202);
  assert.equal(pollingRes.statusCode, 200);
  assert.equal(attempts, 3);
  assert.deepEqual(retryDelays, [25, 75]);
});

test('polling cannot restart an exhausted background run before its recovery cooldown', async () => {
  let attempts = 0;
  let nowMs = 1_000;
  const task = { id: 'job-cooldown', status: 'generating', assets: [] };
  const handlers = createEcommerceRouteHandlers({
    orchestrator: {
      createJob() { return { id: task.id, status: 'queued' }; },
      async runJob() {
        attempts += 1;
        throw Object.assign(new Error('quality service unavailable'), {
          code: 'QUALITY_SERVICE_UNAVAILABLE',
          retryable: true,
        });
      },
      getJob() { return task; },
    },
    backgroundRetryDelaysMs: [],
    backgroundRetryCooldownMs: 100,
    now: () => nowMs,
    onBackgroundError: () => {},
  });

  await handlers.generate({ _userEmail: 'owner@example.com', body: {} }, responseHarness());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(attempts, 1);

  handlers.getJob({ _userEmail: 'owner@example.com', params: { id: task.id } }, responseHarness());
  handlers.getJob({ _userEmail: 'owner@example.com', params: { id: task.id } }, responseHarness());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(attempts, 1);

  nowMs += 100;
  handlers.getJob({ _userEmail: 'owner@example.com', params: { id: task.id } }, responseHarness());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(attempts, 2);
});

test('job handler delegates signed owner scope and returns durable asset progress', () => {
  const handlers = createEcommerceRouteHandlers({
    orchestrator: {
      createJob() {
        throw new Error('not used');
      },
      getJob(id, { ownerEmail }) {
        assert.equal(id, 'job-http');
        assert.equal(ownerEmail, '867550189@qq.com');
        return {
          id,
          status: 'generating',
          assets: [{ assetId: 'main', state: 'polling' }],
        };
      },
    },
  });
  const req = {
    _userEmail: '867550189@qq.com',
    params: { id: 'job-http' },
  };
  const res = responseHarness();

  handlers.getJob(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    ok: true,
    task: {
      id: 'job-http',
      status: 'generating',
      assets: [{ assetId: 'main', state: 'polling' }],
    },
  });
});

test('route handlers preserve structured status codes for ownership and billing failures', async () => {
  const handlers = createEcommerceRouteHandlers({
    orchestrator: {
      createJob() {
        throw Object.assign(new Error('额度不足，请购买套餐'), {
          status: 402,
          code: 'BILLING_INSUFFICIENT_CREDITS',
          resumeable: true,
        });
      },
      getJob() {
        throw Object.assign(new Error('无权查看该任务'), { status: 403 });
      },
    },
  });
  const generationRes = responseHarness();
  await handlers.generate({ _userEmail: 'paid@example.com', body: { product_name: '商品' } }, generationRes);
  assert.equal(generationRes.statusCode, 402);
  assert.deepEqual(generationRes.body, {
    error: '额度不足，请购买套餐',
    code: 'BILLING_INSUFFICIENT_CREDITS',
    resumeable: true,
  });

  const jobRes = responseHarness();
  handlers.getJob({ _userEmail: 'paid@example.com', params: { id: 'other-job' } }, jobRes);
  assert.equal(jobRes.statusCode, 403);
  assert.deepEqual(jobRes.body, { error: '无权查看该任务' });
});

test('billing failures preserve the authoritative required and available point amounts', async () => {
  const handlers = createEcommerceRouteHandlers({
    orchestrator: {
      createJob() {
        throw Object.assign(new Error('AI 积分不足，请购买套餐后继续'), {
          status: 402,
          code: 'BILLING_INSUFFICIENT_CREDITS',
          resumeable: true,
          required: 5000,
          available: 1200,
        });
      },
      getJob() {
        throw new Error('not used');
      },
    },
  });
  const res = responseHarness();

  await handlers.generate({ _userEmail: 'paid@example.com', body: { product_name: '商品' } }, res);

  assert.deepEqual(res.body, {
    error: 'AI 积分不足，请购买套餐后继续',
    code: 'BILLING_INSUFFICIENT_CREDITS',
    resumeable: true,
    required: 5000,
    available: 1200,
  });
});

test('startup recovery coalesces callers and retries rejected per-job results within a bounded scan budget', async () => {
  assert.equal(typeof orchestratorModule.createEcommerceStartupRecovery, 'function');
  let attempts = 0;
  const timers = timerHarness();
  const recover = orchestratorModule.createEcommerceStartupRecovery({
    orchestrator: {
      async resumeJobs() {
        attempts += 1;
        return attempts < 3
          ? [{
            status: 'rejected',
            reason: Object.assign(new Error('provider unavailable'), {
              code: 'IMAGE_PROVIDER_UNAVAILABLE',
            }),
          }]
          : [{ status: 'fulfilled', value: { id: 'job-recovered' } }];
      },
    },
    maxAttempts: 1,
    retryDelayMs: 0,
    maxFollowUpScans: 2,
    followUpDelayMs: 25,
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
    onAttemptError: () => {},
  });

  const [first, second] = await Promise.all([recover(), recover()]);

  assert.equal(attempts, 1);
  assert.equal(first, second);
  assert.equal(first[0].status, 'rejected');
  assert.equal(first[0].reason.code, 'IMAGE_PROVIDER_UNAVAILABLE');
  assert.equal(timers.pending.length, 1);
  assert.equal(timers.pending[0].delay, 25);
  assert.equal(timers.pending[0].unrefCalls, 1);

  await timers.runNext();
  assert.equal(attempts, 2);
  assert.equal(timers.pending.length, 1);
  assert.equal(timers.pending[0].unrefCalls, 1);

  await timers.runNext();
  assert.equal(attempts, 3);
  assert.equal(timers.pending.length, 0);
});

test('startup recovery retries transient top-level scan failures in bounded follow-up scans', async () => {
  assert.equal(typeof orchestratorModule.createEcommerceStartupRecovery, 'function');
  let attempts = 0;
  const attemptErrors = [];
  const timers = timerHarness();
  const recover = orchestratorModule.createEcommerceStartupRecovery({
    orchestrator: {
      async resumeJobs() {
        attempts += 1;
        if (attempts < 3) throw new Error(`database unavailable ${attempts}`);
        return [];
      },
    },
    maxAttempts: 1,
    retryDelayMs: 0,
    maxFollowUpScans: 2,
    followUpDelayMs: 50,
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
    onAttemptError: (error, attempt) => attemptErrors.push({ message: error.message, attempt }),
  });

  assert.deepEqual(await recover(), []);
  assert.equal(attempts, 1);
  assert.equal(timers.pending.length, 1);

  await timers.runNext();
  await timers.runNext();

  assert.equal(attempts, 3);
  assert.deepEqual(attemptErrors, [
    { message: 'database unavailable 1', attempt: 1 },
    { message: 'database unavailable 2', attempt: 1 },
  ]);
  assert.equal(timers.pending.length, 0);
});

test('startup recovery stop cancels the pending unref timer', async () => {
  const timers = timerHarness();
  const recover = orchestratorModule.createEcommerceStartupRecovery({
    orchestrator: { resumeJobs: async () => [] },
    maxAttempts: 1,
    retryDelayMs: 0,
    maxFollowUpScans: 1,
    followUpDelayMs: 100,
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
  });

  await recover();
  assert.equal(timers.pending.length, 1);
  assert.equal(timers.pending[0].unrefCalls, 1);

  recover.stop();

  assert.equal(timers.pending.length, 0);
  assert.equal(timers.cleared.length, 1);
});

test('production wiring uses the durable orchestrator, signed ownership, startup resume, and no ecommerce Contact Sheet route', async () => {
  const server = await fs.readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const ecommerceBilling = await fs.readFile(
    new URL('../server/ecommerceEngine/ecommerceBilling.mjs', import.meta.url),
    'utf8',
  );
  const generateRouteCount = (server.match(/app\.post\('\/api\/generate-ecommerce'/g) || []).length;
  assert.equal(generateRouteCount, 1);
  assert.match(server, /createEcommerceOrchestrator\(/);
  assert.match(server, /createEcommerceRouteHandlers\(/);
  assert.match(server, /IMG_BASE\s*&&\s*IMG_KEY\s*\?\s*createProviderRouter\(\{/);
  assert.match(server, /IMAGE_PRIMARY_BASE_URL/);
  assert.match(server, /IMAGE_OVERFLOW_BASE_URL/);
  assert.match(server, /IMAGE_PROVIDER_PROTOCOL/);
  assert.match(server, /IMAGE_TASK_SUBMIT_PATH/);
  assert.match(server, /https:\/\/task-api-1-cn\.65535\.space/);
  assert.doesNotMatch(server, /IMAGE_OVERFLOW_BASE_URL\s*\|\|\s*['"]https:\/\/sub-proxy-us\.65535\.space/);
  assert.match(server, /protocol:\s*['"]legacy-edits['"]/);
  assert.match(server, /IMAGE_LEGACY_TASK_PATH\s*\|\|\s*['"]\/v1\/images\/tasks\/\{id\}['"]/);
  assert.doesNotMatch(server, /IMAGE_PRIMARY_BASE_URL\s*\|\|\s*process\.env\.IMAGE_BASE_URL/);
  assert.match(server, /app\.post\('\/api\/generate-ecommerce',\s*ecommerceRouteHandlers\.generate\)/);
  assert.match(server, /authenticateContentRequest\(req,\s*\{[\s\S]{0,200}sessionTokens:\s*contentSessionTokens/);
  assert.match(server, /createEcommerceStartupRecovery\(/);
  assert.match(server, /await recoverEcommerceStartup\(\)/);
  assert.ok(server.indexOf('await recoverEcommerceStartup()') < server.indexOf('app.listen(PORT'));
  assert.match(server, /recoverEcommerceStartup\.stop\(\)/);
  assert.doesNotMatch(server, /orchestrator\.resumeJobs\(\)\.then\(/);
  const unavailableStart = server.indexOf("const ecommerceProviderAdapter = IMG_BASE && IMG_KEY");
  const unavailableEnd = server.indexOf('const orchestrator = createEcommerceOrchestrator', unavailableStart);
  assert.match(server.slice(unavailableStart, unavailableEnd), /error\.retryable\s*=\s*true/);
  assert.match(ecommerceBilling, /idempotencyKey:\s*`ec-release-remainder:\$\{job\.id\}:setup`/);
  const legacyRouteStart = server.indexOf("app.post('/api/generate-ecommerce'");
  const jobRouteStart = server.indexOf("app.get('/api/ecommerce/jobs/:id'");
  const routeSlice = server.slice(legacyRouteStart, jobRouteStart);
  assert.doesNotMatch(routeSlice, /buildReferenceContactSheet|generateECImage|deductCredit/);
});

test('frontend stores the signed session and follows a 202 ecommerce job to stable completion', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const requests = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  const storage = new Map([[
    'sb-auth',
    JSON.stringify({
      email: '867550189@qq.com',
      token: 'signed-session-token',
    }),
  ]]);
  globalThis.localStorage = {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
  };
  let pollCount = 0;
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).endsWith('/api/generate-ecommerce')) {
      return new Response(JSON.stringify({ taskId: 'job-202', status: 'queued' }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    }
    pollCount += 1;
    return new Response(JSON.stringify({
      ok: true,
      task: pollCount === 1
        ? {
          id: 'job-202',
          status: 'generating',
          progress: { current: 0, total: 1 },
          assets: [{ assetId: 'main', state: 'polling' }],
        }
        : {
          id: 'job-202',
          status: 'completed',
          output: { images: { main: '/api/generated-assets/final.png' }, errors: [] },
          progress: { current: 1, total: 1 },
          assets: [{ assetId: 'main', state: 'completed', stableUrl: '/api/generated-assets/final.png' }],
        },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const api = await import(`../src/services/api.js?async-ecommerce=${Date.now()}`);
  const progress = [];

  const result = await api.generateEcommerce({
    productName: '测试商品',
    category: '数码3C',
    realShots: [],
    refImgs: [],
    pollIntervalMs: 0,
    onProgress: value => progress.push(value),
  });

  assert.equal(result.taskId, 'job-202');
  assert.deepEqual(result.images, { main: '/api/generated-assets/final.png' });
  assert.equal(progress.some(value => value.status === 'generating'), true);
  assert.equal(requests.length, 3);
  for (const request of requests) {
    assert.equal(request.options.headers.Authorization, 'Bearer signed-session-token');
  }
});

test('frontend automatically repairs a small partial failure with one failed-item retry', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = {
    getItem: () => JSON.stringify({
      email: '867550189@qq.com',
      token: 'signed-session-token',
    }),
    setItem: () => {},
  };
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url);
    calls.push([options.method || 'GET', path]);
    if (path.endsWith('/api/generate-ecommerce')) {
      return new Response(JSON.stringify({ taskId: 'job-partial', status: 'queued' }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (path === '/api/ecommerce/jobs/job-partial') {
      return new Response(JSON.stringify({ ok: true, task: {
        id: 'job-partial',
        status: 'needs_review',
        output: { images: { main: '/api/generated-assets/partial.png' }, errors: [] },
        assets: [
          { assetId: 'main', status: 'completed', stableUrl: '/api/generated-assets/partial.png' },
          { assetId: 'detail', status: 'needs_review' },
        ],
      } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (path === '/api/ecommerce/jobs/job-partial/retry-plan') {
      return new Response(JSON.stringify({ plan: { sku: 'ec_image_2k', quantity: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (path === '/api/billing/quote') {
      return new Response(JSON.stringify({ quote: { quoteId: 'retry-quote', totalUnits: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (path === '/api/ecommerce/jobs/job-partial/retry-failed') {
      return new Response(JSON.stringify({ taskId: 'job-complete', status: 'queued' }), { status: 202, headers: { 'content-type': 'application/json' } });
    }
    if (path === '/api/ecommerce/jobs/job-complete') {
      return new Response(JSON.stringify({ ok: true, task: {
        id: 'job-complete',
        status: 'completed',
        output: { images: { main: '/api/generated-assets/final.png' }, errors: [] },
        assets: [{ assetId: 'main', status: 'completed', stableUrl: '/api/generated-assets/final.png' }],
      } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`unexpected request: ${path}`);
  };
  const api = await import(`../src/services/api.js?async-partial=${Date.now()}`);

  const result = await api.generateEcommerce({
    productName: '测试商品',
    category: '数码3C',
    realShots: [],
    refImgs: [],
    pollIntervalMs: 0,
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.taskId, 'job-complete');
  assert.deepEqual(result.images, { main: '/api/generated-assets/final.png' });
  assert.deepEqual(calls, [
    ['POST', '/api/generate-ecommerce'],
    ['GET', '/api/ecommerce/jobs/job-partial'],
    ['POST', '/api/ecommerce/jobs/job-partial/retry-plan'],
    ['POST', '/api/billing/quote'],
    ['POST', '/api/ecommerce/jobs/job-partial/retry-failed'],
    ['GET', '/api/ecommerce/jobs/job-complete'],
  ]);
});

test('frontend preserves structured billing metadata from a failed async job', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = {
    getItem: () => JSON.stringify({
      email: 'paid@example.com',
      token: 'signed-session-token',
    }),
    setItem: () => {},
  };
  globalThis.fetch = async url => {
    if (String(url).endsWith('/api/generate-ecommerce')) {
      return new Response(JSON.stringify({ taskId: 'job-billing', status: 'queued' }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({
      ok: true,
      task: {
        id: 'job-billing',
        status: 'failed',
        output: {
          images: {},
          errors: [{
            error: 'AI 积分不足，请购买套餐后继续',
            code: 'BILLING_INSUFFICIENT_CREDITS',
            resumeable: true,
            required: 5000,
            available: 1200,
          }],
        },
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const api = await import(`../src/services/api.js?async-billing=${Date.now()}`);

  await assert.rejects(
    api.generateEcommerce({
      productName: '测试商品',
      category: '数码3C',
      realShots: [],
      refImgs: [],
      pollIntervalMs: 0,
    }),
    error => error?.code === 'BILLING_INSUFFICIENT_CREDITS'
      && error?.resumeable === true
      && error?.required === 5000
      && error?.available === 1200,
  );
});

test('frontend preserves actionable re-quote metadata from a failed async ecommerce job', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = {
    getItem: () => JSON.stringify({
      email: 'paid@example.com',
      token: 'signed-session-token',
    }),
    setItem: () => {},
  };
  globalThis.fetch = async url => {
    if (String(url).endsWith('/api/generate-ecommerce')) {
      return new Response(JSON.stringify({ taskId: 'job-requote', status: 'queued' }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({
      ok: true,
      task: {
        id: 'job-requote',
        status: 'failed',
        output: {
          images: {},
          errors: [{
            error: '当前生成方案与费用确认不一致，请重新获取费用',
            code: 'BILLING_QUOTE_MISMATCH',
            status: 409,
            retryable: false,
            reQuoteRequired: true,
          }],
        },
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const api = await import(`../src/services/api.js?async-requote=${Date.now()}`);

  await assert.rejects(
    api.generateEcommerce({
      productName: '测试商品',
      category: '数码3C',
      realShots: [],
      refImgs: [],
      billingQuoteId: 'bq1.expired.quote',
      pollIntervalMs: 0,
    }),
    error => error?.status === 409
      && error?.code === 'BILLING_QUOTE_MISMATCH'
      && error?.retryable === false
      && error?.reQuoteRequired === true,
  );
});

test('frontend bounds async polling and preserves the task id on timeout', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  let requestCount = 0;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = {
    getItem: () => JSON.stringify({
      email: '867550189@qq.com',
      token: 'signed-session-token',
    }),
    setItem: () => {},
  };
  globalThis.fetch = async url => {
    requestCount += 1;
    if (String(url).endsWith('/api/generate-ecommerce')) {
      return new Response(JSON.stringify({ taskId: 'job-timeout', status: 'queued' }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({
      ok: true,
      task: { id: 'job-timeout', status: 'generating', assets: [] },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const api = await import(`../src/services/api.js?async-timeout=${Date.now()}`);

  await assert.rejects(
    api.generateEcommerce({
      productName: '测试商品',
      category: '数码3C',
      realShots: [],
      refImgs: [],
      pollIntervalMs: 0,
      maxPollAttempts: 2,
    }),
    error => error?.code === 'ECOMMERCE_POLL_TIMEOUT' && error?.taskId === 'job-timeout',
  );
  assert.equal(requestCount, 3);
});

test('selected design direction reaches the durable job as structured campaign input', async () => {
  const api = await fs.readFile(new URL('../src/services/api.js', import.meta.url), 'utf8');
  const direction = await fs.readFile(new URL('../src/pages/Home/ec/DesignDirection.jsx', import.meta.url), 'utf8');

  assert.match(api, /direction:\s*direction\s*\|\|\s*null/);
  assert.match(direction, /const editableBrief = dir\?\.brief \|\| dir\?\.execution_guide \|\| dir\?\.description \|\| dir\?\.short_desc \|\| ''/);
  assert.match(direction, /direction:\s*\{\s*\.\.\.dir,\s*editableBrief,\s*\}/);
});
