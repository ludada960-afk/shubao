import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  createContentBilling,
  describeContentGenerationFailure,
} from '../server/billing/contentBilling.mjs';

const OWNER = 'buyer@example.com';
const STABLE_ASSET_RE = /^\/api\/generated-assets\/[a-f0-9]{64}\.(?:jpg|png|webp)$/;

function assetUrl(index, extension = 'png') {
  return `/api/generated-assets/${index.toString(16).padStart(64, '0')}.${extension}`;
}

function delivery(totalImages = 9, copy = { title: '完整的小红书文案' }) {
  return {
    ...copy,
    cover_url: totalImages > 0 ? assetUrl(0) : '',
    image_urls: Array.from(
      { length: Math.max(0, totalImages - 1) },
      (_, index) => assetUrl(index + 1),
    ),
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasCopy(result) {
  return ['title', 'caption', 'body_text'].some(key => (
    typeof result?.[key] === 'string' && result[key].trim()
  )) || (Array.isArray(result?.copyLines) && result.copyLines.some(line => (
    typeof line === 'string' && line.trim()
  )));
}

function stableAssetCount(result) {
  const urls = [result?.cover_url, ...(Array.isArray(result?.image_urls) ? result.image_urls : [])]
    .filter(url => typeof url === 'string' && STABLE_ASSET_RE.test(url));
  return new Set(urls).size;
}

function createFakeHarness({
  availableUnits = 3,
  unlimited = false,
  failBalanceReads = false,
} = {}) {
  let balance = {
    availableUnits: unlimited ? 0 : availableUnits,
    heldUnits: 0,
    unlimited,
  };
  const holds = new Map();
  const terminal = new Map();
  const calls = { holdSet: [], completeSet: [], failSet: [] };

  const contentEntitlements = {
    holdSet(input) {
      calls.holdSet.push(clone(input));
      const existing = holds.get(input.generationId);
      if (existing) {
        assert.deepEqual(input, existing.input);
        return existing.result;
      }
      if (!unlimited && balance.availableUnits < 1) {
        const error = new Error('Insufficient content_sets');
        error.code = 'BILLING_INSUFFICIENT_CREDITS';
        throw error;
      }
      if (!unlimited) {
        balance = {
          ...balance,
          availableUnits: balance.availableUnits - 1,
          heldUnits: balance.heldUnits + 1,
        };
      }
      const result = {
        id: `hold-${input.generationId}`,
        status: 'pending',
        currency: 'content_sets',
        balance: { ...balance },
      };
      holds.set(input.generationId, { input: clone(input), result });
      return result;
    },

    completeSet(input) {
      calls.completeSet.push(clone(input));
      const existing = terminal.get(input.generationId);
      if (existing?.status === 'settled') return existing;
      const hold = holds.get(input.generationId);
      if (!hold) throw new Error('unknown hold');
      if (stableAssetCount(input.result) !== 9 || !hasCopy(input.result)) {
        return {
          status: 'needs_review',
          holdId: hold.result.id,
          workId: input.workId,
        };
      }
      if (!unlimited) {
        balance = { ...balance, heldUnits: balance.heldUnits - 1 };
      }
      const settled = {
        status: 'settled',
        holdId: hold.result.id,
        workId: input.workId,
        settlement: { status: 'settled', units: 1, balance: { ...balance } },
        entitlement: {
          workId: input.workId,
          includedCount: unlimited ? 0 : 5,
          usedCount: 0,
          heldCount: 0,
          unlimited,
        },
      };
      terminal.set(input.generationId, settled);
      return settled;
    },

    failSet(input) {
      calls.failSet.push(clone(input));
      const existing = terminal.get(input.generationId);
      if (existing) {
        if (existing.status !== 'released' || existing.reason !== input.reason) {
          const error = new Error('idempotency conflict');
          error.code = 'CONTENT_SET_IDEMPOTENCY_CONFLICT';
          throw error;
        }
        return existing;
      }
      const hold = holds.get(input.generationId);
      if (!hold) throw new Error('unknown hold');
      if (!unlimited) {
        balance = {
          ...balance,
          availableUnits: balance.availableUnits + 1,
          heldUnits: balance.heldUnits - 1,
        };
      }
      const released = {
        status: 'released',
        holdId: hold.result.id,
        workId: input.workId,
        reason: input.reason,
        release: { status: 'released', balance: { ...balance } },
      };
      terminal.set(input.generationId, released);
      return released;
    },
  };

  const walletService = {
    getBalance(ownerEmail, currency) {
      assert.equal(ownerEmail, OWNER);
      assert.equal(currency, 'content_sets');
      if (failBalanceReads) throw new Error('balance lookup unavailable');
      return { ...balance };
    },
  };

  return {
    calls,
    service: createContentBilling({ contentEntitlements, walletService }),
  };
}

test('beginContentGeneration derives a stable work id, ignores client authority, and reuses the same hold', () => {
  const { service, calls } = createFakeHarness();
  const request = {
    ownerEmail: ' Buyer@Example.COM ',
    generationId: 'client_generation-01',
    workId: 'client-controlled-work',
    mode: 'XHS',
    planSnapshot: { regenPerWork: 999 },
    regenPerWork: 999,
    kind: 'user',
  };

  const first = service.beginContentGeneration(request);
  const repeated = service.beginContentGeneration(request);

  assert.deepEqual(repeated, first);
  assert.deepEqual(calls.holdSet, [
    {
      ownerEmail: OWNER,
      generationId: 'client_generation-01',
      workId: 'content-client_generation-01',
      mode: 'xhs',
    },
    {
      ownerEmail: OWNER,
      generationId: 'client_generation-01',
      workId: 'content-client_generation-01',
      mode: 'xhs',
    },
  ]);
  assert.deepEqual(first, {
    currency: 'content_sets',
    status: 'held',
    settledUnits: 0,
    balance: 2,
    heldUnits: 1,
    unlimited: false,
    generationId: 'client_generation-01',
    holdId: 'hold-client_generation-01',
    workId: 'content-client_generation-01',
    entitlement: null,
  });
});

test('beginContentGeneration validates generation ids and decorates insufficient balance errors', () => {
  const { service } = createFakeHarness({ availableUnits: 0 });
  for (const generationId of ['../escape', 'space id', 'x'.repeat(129), '']) {
    assert.throws(() => service.beginContentGeneration({
      ownerEmail: OWNER,
      generationId,
      mode: 'xhs',
    }), error => error.code === 'CONTENT_GENERATION_ID_INVALID', generationId || 'blank');
  }
  assert.throws(() => service.beginContentGeneration({
    ownerEmail: OWNER,
    generationId: 'valid-id',
    mode: 'xhs',
  }), error => (
    error.code === 'BILLING_INSUFFICIENT_CREDITS'
      && error.required === 1
      && error.available === 0
      && error.currency === 'content_sets'
  ));
});

test('completeContentGeneration settles exactly nine stable assets and returns the authoritative balance', () => {
  const { service, calls } = createFakeHarness();
  service.beginContentGeneration({ ownerEmail: OWNER, generationId: 'settle-1', mode: 'xhs' });

  const billing = service.completeContentGeneration({
    ownerEmail: OWNER,
    generationId: 'settle-1',
    workId: 'client-work',
    result: delivery(),
    planSnapshot: { regenPerWork: 999 },
    regenPerWork: 999,
    kind: 'user',
  });

  assert.equal(calls.completeSet.length, 1);
  assert.deepEqual(Object.keys(calls.completeSet[0]).sort(), [
    'generationId', 'ownerEmail', 'result', 'workId',
  ]);
  assert.equal(calls.completeSet[0].workId, 'content-settle-1');
  assert.deepEqual(billing, {
    currency: 'content_sets',
    status: 'settled',
    settledUnits: 1,
    balance: 2,
    heldUnits: 0,
    unlimited: false,
    generationId: 'settle-1',
    holdId: 'hold-settle-1',
    workId: 'content-settle-1',
    entitlement: {
      workId: 'content-settle-1',
      includedCount: 5,
      usedCount: 0,
      heldCount: 0,
      unlimited: false,
    },
  });
});

test('completeContentGeneration keeps one to eight stable assets in needs_review without releasing the hold', () => {
  const { service, calls } = createFakeHarness();
  service.beginContentGeneration({ ownerEmail: OWNER, generationId: 'review-1', mode: 'plog' });

  const billing = service.completeContentGeneration({
    ownerEmail: OWNER,
    generationId: 'review-1',
    result: delivery(8, { copyLines: ['一段完整情绪文案'] }),
  });

  assert.equal(calls.completeSet.length, 1);
  assert.equal(calls.failSet.length, 0);
  assert.deepEqual(billing, {
    currency: 'content_sets',
    status: 'needs_review',
    settledUnits: 0,
    balance: 2,
    heldUnits: 1,
    unlimited: false,
    generationId: 'review-1',
    holdId: 'hold-review-1',
    workId: 'content-review-1',
    entitlement: null,
  });
});

test('completeContentGeneration releases zero-delivery or copyless results instead of freezing them', async t => {
  const cases = [
    ['zero stable assets', { title: '有文案', cover_url: 'https://temporary.example/cover.png', image_urls: [] }],
    ['no copy', { cover_url: assetUrl(0), image_urls: [] }],
  ];

  for (const [index, [label, result]] of cases.entries()) {
    await t.test(label, () => {
      const { service, calls } = createFakeHarness();
      const generationId = `empty-${index}`;
      service.beginContentGeneration({ ownerEmail: OWNER, generationId, mode: 'xhs' });

      const billing = service.completeContentGeneration({ ownerEmail: OWNER, generationId, result });

      assert.equal(calls.completeSet.length, 0);
      assert.equal(calls.failSet.length, 1);
      assert.equal(calls.failSet[0].reason, 'generation_failed');
      assert.equal(billing.status, 'released');
      assert.equal(billing.settledUnits, 0);
      assert.equal(billing.balance, 3);
      assert.equal(billing.heldUnits, 0);
    });
  }
});

test('failContentGeneration is idempotent across catch and finally reasons', () => {
  const { service, calls } = createFakeHarness();
  service.beginContentGeneration({ ownerEmail: OWNER, generationId: 'failure-1', mode: 'plog' });

  const first = service.failContentGeneration({
    ownerEmail: OWNER,
    generationId: 'failure-1',
    reason: 'provider_failed',
    kind: 'system',
  });
  const repeated = service.failContentGeneration({
    ownerEmail: OWNER,
    generationId: 'failure-1',
    reason: 'client_disconnected',
    kind: 'user',
  });

  assert.deepEqual(repeated, first);
  assert.deepEqual(calls.failSet.map(call => call.reason), [
    'generation_failed',
    'generation_failed',
  ]);
  assert.deepEqual(first, {
    currency: 'content_sets',
    status: 'released',
    settledUnits: 0,
    balance: 3,
    heldUnits: 0,
    unlimited: false,
    generationId: 'failure-1',
    holdId: 'hold-failure-1',
    workId: 'content-failure-1',
    entitlement: null,
  });
});

test('successful billing mutations use their transaction balance without a follow-up lookup', () => {
  const settledHarness = createFakeHarness({ failBalanceReads: true });
  const begun = settledHarness.service.beginContentGeneration({
    ownerEmail: OWNER,
    generationId: 'mutation-balance-settle',
    mode: 'xhs',
  });
  const completed = settledHarness.service.completeContentGeneration({
    ownerEmail: OWNER,
    generationId: 'mutation-balance-settle',
    result: delivery(),
  });

  assert.equal(begun.balance, 2);
  assert.equal(begun.heldUnits, 1);
  assert.equal(completed.balance, 2);
  assert.equal(completed.heldUnits, 0);

  const releasedHarness = createFakeHarness({ failBalanceReads: true });
  releasedHarness.service.beginContentGeneration({
    ownerEmail: OWNER,
    generationId: 'mutation-balance-release',
    mode: 'plog',
  });
  const released = releasedHarness.service.failContentGeneration({
    ownerEmail: OWNER,
    generationId: 'mutation-balance-release',
  });

  assert.equal(released.balance, 3);
  assert.equal(released.heldUnits, 0);
});

test('failure messaging only claims a refund after billing confirms release', () => {
  const imageError = new Error('Image API timeout');
  const emptyError = Object.assign(new Error('empty'), { code: 'CONTENT_DELIVERY_EMPTY' });
  const pendingMessage = '创作额度释放状态待确认，请稍后查看余额';

  assert.equal(
    describeContentGenerationFailure(imageError, null),
    `图片生成暂时失败，${pendingMessage}`,
  );
  assert.equal(
    describeContentGenerationFailure(imageError, { status: 'held' }),
    `图片生成暂时失败，${pendingMessage}`,
  );
  assert.equal(
    describeContentGenerationFailure(imageError, { status: 'released' }),
    '图片生成暂时失败，创作额度已退回',
  );
  assert.equal(
    describeContentGenerationFailure(emptyError, null),
    `未生成可交付内容，${pendingMessage}`,
  );
  assert.equal(
    describeContentGenerationFailure(emptyError, { status: 'released' }),
    '未生成可交付内容，创作额度已退回',
  );
});

test('unlimited owners expose unlimited billing while still settling one shadow unit', () => {
  const { service } = createFakeHarness({ unlimited: true });
  const begun = service.beginContentGeneration({ ownerEmail: OWNER, generationId: 'unlimited-1', mode: 'xhs' });
  const completed = service.completeContentGeneration({
    ownerEmail: OWNER,
    generationId: 'unlimited-1',
    result: delivery(),
  });

  assert.equal(begun.unlimited, true);
  assert.equal(begun.balance, null);
  assert.equal(completed.status, 'settled');
  assert.equal(completed.settledUnits, 1);
  assert.equal(completed.unlimited, true);
  assert.equal(completed.balance, null);
  assert.equal(completed.entitlement.unlimited, true);
});

test('preview billing creates a safe server identity without touching entitlements', () => {
  const { service, calls } = createFakeHarness();
  const explicit = service.previewContentGeneration({
    generationId: 'preview-1',
    workId: 'client-work',
    mode: 'plog',
    kind: 'user',
  });
  const generated = service.previewContentGeneration({ mode: 'xhs' });

  assert.deepEqual(explicit, {
    currency: 'content_sets',
    status: 'preview',
    settledUnits: 0,
    balance: null,
    heldUnits: 0,
    unlimited: false,
    generationId: 'preview-1',
    holdId: null,
    workId: 'content-preview-1',
    entitlement: null,
  });
  assert.match(generated.generationId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(generated.workId, `content-${generated.generationId}`);
  assert.deepEqual(calls, { holdSet: [], completeSet: [], failSet: [] });
});

function extractBalancedBlock(source, openingBrace) {
  let depth = 0;
  let state = 'code';
  let escaped = false;
  for (let index = openingBrace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (state === 'line-comment') {
      if (char === '\n') state = 'code';
      continue;
    }
    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        state = 'code';
        index += 1;
      }
      continue;
    }
    if (state !== 'code') {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      const closing = state === 'single' ? "'" : state === 'double' ? '"' : '`';
      if (char === closing) state = 'code';
      continue;
    }
    if (char === '/' && next === '/') {
      state = 'line-comment';
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      state = 'block-comment';
      index += 1;
      continue;
    }
    if (char === "'") {
      state = 'single';
      continue;
    }
    if (char === '"') {
      state = 'double';
      continue;
    }
    if (char === '`') {
      state = 'template';
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openingBrace, index + 1);
    }
  }
  throw new Error('Unbalanced source block');
}

function findFirst(source, values) {
  const indexes = values.map(value => source.indexOf(value)).filter(index => index >= 0);
  return indexes.length ? Math.min(...indexes) : -1;
}

function extractRouteHandler(source, routePath, nextRoutePath) {
  const routeStart = findFirst(source, [
    `app.post('${routePath}'`,
    `app.post("${routePath}"`,
  ]);
  assert.notEqual(routeStart, -1, `route ${routePath} exists`);
  const nextStart = findFirst(source.slice(routeStart + 1), [
    `app.post('${nextRoutePath}'`,
    `app.post("${nextRoutePath}"`,
  ]);
  assert.notEqual(nextStart, -1, `route ${nextRoutePath} follows ${routePath}`);
  return source.slice(routeStart, routeStart + 1 + nextStart);
}

function extractNamedFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `function ${name} exists`);
  return extractBalancedBlock(source, source.indexOf('{', start));
}

function assertBefore(source, earlier, later, message) {
  const earlierIndex = typeof earlier === 'string' ? source.indexOf(earlier) : source.search(earlier);
  const laterIndex = typeof later === 'string' ? source.indexOf(later) : source.search(later);
  assert.notEqual(earlierIndex, -1, `${message}: earlier marker`);
  assert.notEqual(laterIndex, -1, `${message}: later marker`);
  assert.ok(earlierIndex < laterIndex, message);
}

test('server initializes content billing from the same SQLite handle and gives preview a rate-limited access boundary', async () => {
  const server = await fs.readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  assert.match(server, /const db = initDB\(\);/);
  assert.match(server, /createWalletService\(db,\s*\{\s*isUnlimited:\s*isUnlimitedBetaEmail\s*\}\)/);
  assert.match(server, /createContentEntitlements\(db, walletService\)/);
  assert.match(server, /createContentBilling\(\{\s*contentEntitlements,\s*walletService,?\s*\}\)/);

  assert.match(server, /CONTENT_PREVIEW_ROUTES\s*=\s*new Set\(\[\s*['"]\/api\/generate['"],\s*['"]\/api\/plog-generate['"]\s*\]\)/);
  const middleware = extractNamedFunction(server, 'betaAccessMiddleware');
  assert.match(middleware, /CONTENT_PREVIEW_ROUTES\.has\(req\.path\)/);
  assert.match(middleware, /req\.body\?\.preview === true/);
  assert.match(middleware, /req\._contentPreview = true/);
  assertBefore(middleware, 'req._contentPreview = true', 'requireBetaEmail', 'preview is separated before beta email auth');
  assert.match(server, /betaAccessMiddleware\(req, res, continueWithRateLimit\)/);

  const startError = extractNamedFunction(server, 'sendContentBillingStartError');
  assert.match(startError, /BILLING_INSUFFICIENT_CREDITS/);
  assert.match(startError, /status\(402\)/);
  for (const field of ['code', 'required', 'available', 'resumeable']) {
    assert.match(startError, new RegExp(`\\b${field}\\b`));
  }
});

test('XHS and Plog routes hold before upstream work, persist before image events, and finalize billing before complete', async t => {
  const server = await fs.readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const cases = [
    {
      name: 'XHS',
      path: '/api/generate',
      nextPath: '/api/analyze',
      mode: 'xhs',
      firstUpstream: 'contentAnalysis(',
      previewLimit: /const allPrompts = preview\s*\?\s*\[coverPromptTask\]/,
    },
    {
      name: 'Plog',
      path: '/api/plog-generate',
      nextPath: '/api/create-payment',
      mode: 'plog',
      firstUpstream: 'enrichLensesWithLLM(',
      previewLimit: /const totalCount = preview \? 1 : 9;/,
    },
  ];

  for (const spec of cases) {
    await t.test(spec.name, () => {
      const route = extractRouteHandler(server, spec.path, spec.nextPath);
      assert.match(route, /const preview = req\._contentPreview === true/);
      assert.match(route, /previewContentGeneration\(/);
      assert.match(route, /beginContentGeneration\(\{[\s\S]*ownerEmail:\s*req\._userEmail[\s\S]*generationId:\s*req\.body\?\.generationId[\s\S]*mode:\s*['"]/);
      assert.match(route, new RegExp(`mode:\\s*['"]${spec.mode}['"]`));
      assertBefore(route, 'beginContentGeneration(', 'res.setHeader', `${spec.name} holds before SSE headers`);
      assertBefore(route, 'beginContentGeneration(', spec.firstUpstream, `${spec.name} holds before upstream work`);
      assert.match(route, spec.previewLimit);

      assertBefore(route, 'await persistGeneratedAsset(', 'results.push(', `${spec.name} persists before collecting results`);
      assertBefore(route, 'await persistGeneratedAsset(', /send\((?:'|")image(?:'|")/, `${spec.name} persists before image SSE`);
      assertBefore(route, 'completeContentGeneration(', /send\((?:'|")complete(?:'|")/, `${spec.name} bills before complete SSE`);
      assert.match(route, /billingLifecycleHandled = true;[\s\S]*send\((?:'|")complete(?:'|")/);
      assert.match(route, /catch\s*\([^)]*\)\s*\{[\s\S]*failContentGeneration\(/);
      assert.match(route, /finally\s*\{[\s\S]*if \(!preview && !billingLifecycleHandled\)[\s\S]*failContentGeneration\(/);

      assert.match(route, /generationId:\s*billingContext\.generationId/);
      assert.match(route, /workId:\s*billingContext\.workId/);
      assert.match(route, /billing/);
      assert.doesNotMatch(route, /req\.body\?\.email|req\.body\.email|body\.email/);
      assert.doesNotMatch(route, /req\.body\?\.kind|req\.body\.kind|body\.kind/);
      assert.doesNotMatch(route, /consumeUserCredit|deductCredit/);
    });
  }
});
