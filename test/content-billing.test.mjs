import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import Database from 'better-sqlite3';
import {
  authenticateContentRequest,
  contentBillingHttpError,
  createBilledSseRunner,
  createContentBilling,
  createGeneratedAssetPersister,
  createPreviewSseRunner,
  createSessionTokenService,
  describeContentGenerationFailure,
} from '../server/billing/contentBilling.mjs';
import { ensureBillingSchema } from '../server/billing/schema.mjs';
import { createWalletService } from '../server/billing/walletService.mjs';
import { createContentEntitlements } from '../server/billing/contentEntitlements.mjs';

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

  const db = new Database(':memory:');

  return {
    db,
    calls,
    service: createContentBilling({ db, contentEntitlements, walletService }),
  };
}

function createDurableHarness({ leaseMs = 1_000 } = {}) {
  let clock = Date.parse('2026-07-25T12:00:00.000Z');
  const db = new Database(':memory:');
  ensureBillingSchema(db);
  const walletService = createWalletService(db, {
    isUnlimited: email => email === OWNER,
    now: () => clock,
  });
  const contentEntitlements = createContentEntitlements(db, walletService);
  const createService = () => createContentBilling({
    db,
    contentEntitlements,
    walletService,
    now: () => clock,
    leaseMs,
  });
  return {
    db,
    createService,
    service: createService(),
    advance(ms) { clock += ms; },
  };
}

class FakeResponse extends EventEmitter {
  constructor({ writeResult = true, writeError = null } = {}) {
    super();
    this.writeResult = writeResult;
    this.writeError = writeError;
    this.headers = {};
    this.headersSent = false;
    this.flushed = false;
    this.ended = false;
    this.statusCode = 200;
    this.jsonBody = null;
    this.writes = [];
  }

  setHeader(name, value) {
    this.headers[String(name).toLowerCase()] = value;
  }

  flushHeaders() {
    this.flushed = true;
    this.headersSent = true;
  }

  write(chunk) {
    if (this.writeError) throw this.writeError;
    this.writes.push(String(chunk));
    return this.writeResult;
  }

  end() {
    this.ended = true;
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  json(body) {
    this.headersSent = true;
    this.jsonBody = body;
    return this;
  }
}

function parsedSseEvents(response) {
  return response.writes.flatMap(chunk => chunk.split('\n\n'))
    .filter(Boolean)
    .map(frame => JSON.parse(frame.replace(/^data:\s*/, '')));
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

  assert.equal(first.action, 'start');
  assert.equal(repeated.action, 'in_progress');
  assert.equal(repeated.leaseToken, null);
  assert.deepEqual(repeated.billing, first.billing);
  assert.deepEqual(calls.holdSet, [
    {
      ownerEmail: OWNER,
      generationId: 'client_generation-01',
      workId: 'content-client_generation-01',
      mode: 'xhs',
    },
  ]);
  assert.deepEqual(first.billing, {
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
  const begun = service.beginContentGeneration({ ownerEmail: OWNER, generationId: 'settle-1', mode: 'xhs' });

  const billing = service.completeContentGeneration({
    ownerEmail: OWNER,
    generationId: 'settle-1',
    leaseToken: begun.leaseToken,
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
  assert.equal(billing.jobStatus, 'completed');
  assert.deepEqual(billing.billing, {
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
  const begun = service.beginContentGeneration({ ownerEmail: OWNER, generationId: 'review-1', mode: 'plog' });

  const billing = service.completeContentGeneration({
    ownerEmail: OWNER,
    generationId: 'review-1',
    leaseToken: begun.leaseToken,
    result: delivery(8, { copyLines: ['一段完整情绪文案'] }),
  });

  assert.equal(calls.completeSet.length, 1);
  assert.equal(calls.failSet.length, 0);
  assert.equal(billing.jobStatus, 'needs_review');
  assert.deepEqual(billing.billing, {
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
      const begun = service.beginContentGeneration({ ownerEmail: OWNER, generationId, mode: 'xhs' });

      const billing = service.completeContentGeneration({
        ownerEmail: OWNER,
        generationId,
        leaseToken: begun.leaseToken,
        result,
      });

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
  const begun = service.beginContentGeneration({ ownerEmail: OWNER, generationId: 'failure-1', mode: 'plog' });

  const first = service.failContentGeneration({
    ownerEmail: OWNER,
    generationId: 'failure-1',
    leaseToken: begun.leaseToken,
    reason: 'provider_failed',
    kind: 'system',
  });
  const repeated = service.failContentGeneration({
    ownerEmail: OWNER,
    generationId: 'failure-1',
    leaseToken: begun.leaseToken,
    reason: 'client_disconnected',
    kind: 'user',
  });

  assert.equal(first.action, 'failed');
  assert.equal(repeated.action, 'terminal');
  assert.deepEqual(repeated.billing, first.billing);
  assert.deepEqual(calls.failSet.map(call => call.reason), ['generation_failed']);
  assert.deepEqual(first.billing, {
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
    leaseToken: begun.leaseToken,
    result: delivery(),
  });

  assert.equal(begun.balance, 2);
  assert.equal(begun.heldUnits, 1);
  assert.equal(completed.balance, 2);
  assert.equal(completed.heldUnits, 0);

  const releasedHarness = createFakeHarness({ failBalanceReads: true });
  const releaseBegun = releasedHarness.service.beginContentGeneration({
    ownerEmail: OWNER,
    generationId: 'mutation-balance-release',
    mode: 'plog',
  });
  const released = releasedHarness.service.failContentGeneration({
    ownerEmail: OWNER,
    generationId: 'mutation-balance-release',
    leaseToken: releaseBegun.leaseToken,
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

test('HMAC sessions authenticate the signed owner and reject tampering or expiry', () => {
  let clock = Date.parse('2026-07-25T12:00:00.000Z');
  const sessions = createSessionTokenService({
    secret: 'test-only-session-secret-with-32-bytes',
    now: () => clock,
    ttlMs: 60_000,
  });
  const issued = sessions.issue(' Buyer@Example.COM ');

  assert.equal(issued.email, OWNER);
  assert.equal(issued.expiresAt, '2026-07-25T12:01:00.000Z');
  assert.deepEqual(sessions.verify(issued.token), {
    email: OWNER,
    iat: Math.floor(clock / 1000),
    exp: Math.floor((clock + 60_000) / 1000),
    expiresAt: issued.expiresAt,
  });
  assert.throws(
    () => sessions.verify(`${issued.token.slice(0, -1)}${issued.token.endsWith('a') ? 'b' : 'a'}`),
    error => error.code === 'AUTH_SESSION_INVALID',
  );
  clock += 60_001;
  assert.throws(() => sessions.verify(issued.token), error => error.code === 'AUTH_SESSION_EXPIRED');
});

test('content authentication trusts only a verified session token and ignores body email authority', () => {
  const sessions = createSessionTokenService({
    secret: 'test-only-session-secret-with-32-bytes',
    now: () => Date.parse('2026-07-25T12:00:00.000Z'),
  });
  const token = sessions.issue(OWNER).token;
  const authorizeEmail = email => ({ ok: true, email });

  assert.equal(authenticateContentRequest({
    headers: { authorization: `Bearer ${token}` },
    body: { email: '867550189@qq.com' },
  }, { sessionTokens: sessions, authorizeEmail }), OWNER);
  assert.equal(authenticateContentRequest({
    headers: { 'x-shubao-session': token },
    body: { email: '867550189@qq.com' },
  }, { sessionTokens: sessions, authorizeEmail }), OWNER);
  assert.throws(() => authenticateContentRequest({
    headers: {},
    body: { email: '867550189@qq.com' },
  }, { sessionTokens: sessions, authorizeEmail }), error => error.code === 'AUTH_SESSION_REQUIRED');
});

test('billing HTTP errors distinguish validation, auth, insufficient balance, and conflicts', () => {
  assert.deepEqual(contentBillingHttpError(Object.assign(new Error('bad input'), {
    code: 'CONTENT_GENERATION_ID_INVALID',
  })), {
    status: 400,
    body: { error: '生成任务参数无效，请刷新后重试', code: 'CONTENT_GENERATION_ID_INVALID', resumeable: false },
  });
  assert.equal(contentBillingHttpError(Object.assign(new Error('expired'), {
    code: 'AUTH_SESSION_EXPIRED',
  })).status, 401);
  assert.deepEqual(contentBillingHttpError(Object.assign(new Error('low'), {
    code: 'BILLING_INSUFFICIENT_CREDITS',
    required: 1,
    available: 0,
  })), {
    status: 402,
    body: {
      error: '创作套数不足，请购买套餐后继续',
      code: 'BILLING_INSUFFICIENT_CREDITS',
      required: 1,
      available: 0,
      resumeable: true,
    },
  });
  for (const code of [
    'CONTENT_GENERATION_IDEMPOTENCY_CONFLICT',
    'CONTENT_GENERATION_CONFLICT',
    'CONTENT_GENERATION_LEASE_LOST',
    'CONTENT_GENERATION_TERMINAL',
  ]) {
    const mapped = contentBillingHttpError(Object.assign(new Error('conflict'), { code }));
    assert.equal(mapped.status, 409, code);
    assert.equal(mapped.body.resumeable, false, code);
  }
});

test('generated asset persister supports HTTP, data URLs, and raw b64_json with magic-byte validation', async () => {
  const calls = { persist: [], persistBuffer: [] };
  const generatedAssetStore = {
    async persist(input) {
      calls.persist.push(input);
      return { url: assetUrl(40, 'jpg') };
    },
    async persistBuffer(input) {
      calls.persistBuffer.push(input);
      return { url: assetUrl(41, input.contentType === 'image/png' ? 'png' : 'webp') };
    },
  };
  const persistGeneratedAsset = createGeneratedAssetPersister({ generatedAssetStore, maxBytes: 64 });
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([4, 0, 0, 0]), Buffer.from('WEBP'), Buffer.from([1])]);

  assert.equal(await persistGeneratedAsset({
    source: 'https://provider.example/image.jpg',
    generationId: 'asset-http',
    label: 'cover',
  }), assetUrl(40, 'jpg'));
  assert.equal(await persistGeneratedAsset({
    source: `data:image/png;base64,${png.toString('base64')}`,
    generationId: 'asset-data',
    label: 'cover',
  }), assetUrl(41, 'png'));
  assert.equal(await persistGeneratedAsset({
    source: { b64_json: webp.toString('base64') },
    generationId: 'asset-raw',
    label: 'p1',
  }), assetUrl(41, 'webp'));

  assert.equal(calls.persist.length, 1);
  assert.equal(calls.persistBuffer.length, 2);
  assert.equal(calls.persistBuffer[0].contentType, 'image/png');
  assert.deepEqual(calls.persistBuffer[0].buffer, png);
  assert.equal(calls.persistBuffer[1].contentType, 'image/webp');
  assert.deepEqual(calls.persistBuffer[1].buffer, webp);

  await assert.rejects(
    persistGeneratedAsset({ source: { b64_json: Buffer.from('not-an-image').toString('base64') } }),
    error => error.code === 'GENERATED_ASSET_INVALID',
  );
  await assert.rejects(
    persistGeneratedAsset({ source: { b64_json: Buffer.alloc(65, 1).toString('base64') } }),
    error => error.code === 'GENERATED_ASSET_TOO_LARGE',
  );
});

test('unlimited owners expose unlimited billing while still settling one shadow unit', () => {
  const { service } = createFakeHarness({ unlimited: true });
  const begun = service.beginContentGeneration({ ownerEmail: OWNER, generationId: 'unlimited-1', mode: 'xhs' });
  const completed = service.completeContentGeneration({
    ownerEmail: OWNER,
    generationId: 'unlimited-1',
    leaseToken: begun.leaseToken,
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

  assert.equal(explicit.action, 'preview');
  assert.deepEqual(explicit.billing, {
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

test('durable jobs hold once, report in-progress, and replay completed delivery after restart', t => {
  const harness = createDurableHarness();
  t.after(() => harness.db.close());
  const generationId = 'durable-complete-1';
  const first = harness.service.beginContentGeneration({ ownerEmail: OWNER, generationId, mode: 'xhs' });
  const concurrent = harness.service.beginContentGeneration({ ownerEmail: OWNER, generationId, mode: 'xhs' });

  assert.equal(first.action, 'start');
  assert.equal(first.jobStatus, 'processing');
  assert.match(first.leaseToken, /^[0-9a-f-]{36}$/i);
  assert.equal(concurrent.action, 'in_progress');
  assert.equal(concurrent.leaseToken, null);
  assert.equal(
    harness.db.prepare("SELECT COUNT(*) AS count FROM billing_holds WHERE quote_id = ?").get(generationId).count,
    1,
  );

  const fullDelivery = {
    ...delivery(),
    image_count: 8,
    pages: [{ page_id: 1 }],
    custom: { stable: true },
  };
  const completed = harness.service.completeContentGeneration({
    ownerEmail: OWNER,
    generationId,
    leaseToken: first.leaseToken,
    result: fullDelivery,
  });
  assert.equal(completed.jobStatus, 'completed');
  assert.equal(completed.billing.status, 'settled');

  const restarted = harness.createService();
  const replay = restarted.beginContentGeneration({ ownerEmail: OWNER, generationId, mode: 'xhs' });
  assert.equal(replay.action, 'replay');
  assert.equal(replay.replay, true);
  assert.deepEqual(replay.delivery, fullDelivery);
  assert.deepEqual(replay.billing, completed.billing);
  assert.equal(
    harness.db.prepare('SELECT COUNT(*) AS count FROM usage_events WHERE reference_id = ?').get(first.workId).count,
    1,
  );
});

test('expired processing leases are reclaimed with fencing against the old worker', t => {
  const harness = createDurableHarness({ leaseMs: 100 });
  t.after(() => harness.db.close());
  const generationId = 'durable-reclaim-1';
  const first = harness.service.beginContentGeneration({ ownerEmail: OWNER, generationId, mode: 'plog' });
  harness.advance(101);
  const reclaimed = harness.service.beginContentGeneration({ ownerEmail: OWNER, generationId, mode: 'plog' });

  assert.equal(reclaimed.action, 'start');
  assert.equal(reclaimed.reclaimed, true);
  assert.notEqual(reclaimed.leaseToken, first.leaseToken);
  assert.throws(() => harness.service.completeContentGeneration({
    ownerEmail: OWNER,
    generationId,
    leaseToken: first.leaseToken,
    result: delivery(9, { caption: '旧 worker' }),
  }), error => error.code === 'CONTENT_GENERATION_LEASE_LOST');

  const completed = harness.service.completeContentGeneration({
    ownerEmail: OWNER,
    generationId,
    leaseToken: reclaimed.leaseToken,
    result: delivery(9, { caption: '新 worker' }),
  });
  assert.equal(completed.jobStatus, 'completed');
});

test('needs-review and failed jobs persist replayable terminal state without duplicate billing', async t => {
  await t.test('needs review', () => {
    const harness = createDurableHarness();
    t.after(() => harness.db.close());
    const generationId = 'durable-review-1';
    const begun = harness.service.beginContentGeneration({ ownerEmail: OWNER, generationId, mode: 'plog' });
    const partial = { ...delivery(4, { caption: '部分稳定结果' }), image_count: 3 };
    const completed = harness.service.completeContentGeneration({
      ownerEmail: OWNER,
      generationId,
      leaseToken: begun.leaseToken,
      result: partial,
    });
    const replay = harness.createService().beginContentGeneration({ ownerEmail: OWNER, generationId, mode: 'plog' });

    assert.equal(completed.jobStatus, 'needs_review');
    assert.equal(completed.billing.status, 'needs_review');
    assert.equal(completed.billing.heldUnits, 0);
    assert.equal(replay.action, 'replay');
    assert.deepEqual(replay.delivery, partial);
    assert.equal(replay.billing.status, 'needs_review');
  });

  await t.test('failed and released', () => {
    const harness = createDurableHarness();
    t.after(() => harness.db.close());
    const generationId = 'durable-failed-1';
    const begun = harness.service.beginContentGeneration({ ownerEmail: OWNER, generationId, mode: 'xhs' });
    const failed = harness.service.failContentGeneration({
      ownerEmail: OWNER,
      generationId,
      leaseToken: begun.leaseToken,
      error: Object.assign(new Error('provider failed'), { code: 'IMAGE_PROVIDER_FAILED' }),
    });
    const terminal = harness.createService().beginContentGeneration({ ownerEmail: OWNER, generationId, mode: 'xhs' });

    assert.equal(failed.jobStatus, 'failed');
    assert.equal(failed.billing.status, 'released');
    assert.equal(terminal.action, 'terminal');
    assert.equal(terminal.error.code, 'IMAGE_PROVIDER_FAILED');
    assert.deepEqual(terminal.billing, failed.billing);
    assert.deepEqual(
      harness.service.failContentGeneration({
        ownerEmail: OWNER,
        generationId,
        leaseToken: begun.leaseToken,
        error: new Error('repeated'),
      }).billing,
      failed.billing,
    );
  });
});

test('billed SSE runner completes durably after disconnect and replays without upstream work', async t => {
  const harness = createDurableHarness();
  t.after(() => harness.db.close());
  const runner = createBilledSseRunner(harness.service);
  const generationId = 'runner-disconnect-1';
  let upstreamCalls = 0;
  const disconnected = new FakeResponse();

  const completed = await runner({
    res: disconnected,
    ownerEmail: OWNER,
    generationId,
    mode: 'xhs',
    generate: async ({ send }) => {
      upstreamCalls += 1;
      send('progress', { step: 'image' });
      disconnected.emit('close');
      return delivery();
    },
  });
  assert.equal(completed.jobStatus, 'completed');
  assert.equal(upstreamCalls, 1);
  assert.equal(parsedSseEvents(disconnected).some(event => event.type === 'complete'), false);

  const replayResponse = new FakeResponse();
  const replayed = await runner({
    res: replayResponse,
    ownerEmail: OWNER,
    generationId,
    mode: 'xhs',
    generate: async () => {
      upstreamCalls += 1;
      throw new Error('replay must not call upstream');
    },
  });
  const replayEvent = parsedSseEvents(replayResponse).find(event => event.type === 'complete');
  assert.equal(replayed.action, 'replay');
  assert.equal(upstreamCalls, 1);
  assert.equal(replayEvent.replay, true);
  assert.equal(replayEvent.cover_url, assetUrl(0));
  assert.equal(replayEvent.billing.status, 'settled');
});

test('write false or throw closes only transport while durable completion continues', async t => {
  for (const [label, response] of [
    ['write false', new FakeResponse({ writeResult: false })],
    ['write throw', new FakeResponse({ writeError: new Error('socket closed') })],
  ]) {
    await t.test(label, async () => {
      const harness = createDurableHarness();
      t.after(() => harness.db.close());
      const runner = createBilledSseRunner(harness.service);
      const result = await runner({
        res: response,
        ownerEmail: OWNER,
        generationId: `runner-${label.replace(' ', '-')}`,
        mode: 'plog',
        generate: async ({ send }) => {
          send('image', { id: 'cover', url: assetUrl(0) });
          return delivery(9, { caption: '后台继续完成' });
        },
      });
      assert.equal(result.jobStatus, 'completed');
      assert.equal(result.billing.status, 'settled');
    });
  }
});

test('billed SSE runner releases persist failures and returns 402 or 202 before flushing', async t => {
  await t.test('persist failure releases', async () => {
    const harness = createDurableHarness();
    t.after(() => harness.db.close());
    const runner = createBilledSseRunner(harness.service);
    const generationId = 'runner-persist-fail';
    const response = new FakeResponse();
    const failed = await runner({
      res: response,
      ownerEmail: OWNER,
      generationId,
      mode: 'xhs',
      generate: async () => {
        throw Object.assign(new Error('invalid base64 image'), { code: 'GENERATED_ASSET_INVALID' });
      },
    });
    assert.equal(failed.jobStatus, 'failed');
    assert.equal(failed.billing.status, 'released');
    assert.equal(
      harness.service.beginContentGeneration({ ownerEmail: OWNER, generationId, mode: 'xhs' }).action,
      'terminal',
    );
  });

  await t.test('402 before SSE flush', async () => {
    const harness = createFakeHarness({ availableUnits: 0 });
    t.after(() => harness.db.close());
    const runner = createBilledSseRunner(harness.service);
    const response = new FakeResponse();
    let generated = false;
    await runner({
      res: response,
      ownerEmail: OWNER,
      generationId: 'runner-insufficient',
      mode: 'xhs',
      generate: async () => { generated = true; return delivery(); },
    });
    assert.equal(response.statusCode, 402);
    assert.equal(response.jsonBody.code, 'BILLING_INSUFFICIENT_CREDITS');
    assert.equal(response.jsonBody.resumeable, true);
    assert.equal(response.flushed, false);
    assert.equal(generated, false);
  });

  await t.test('202 in progress before SSE flush', async () => {
    const harness = createDurableHarness();
    t.after(() => harness.db.close());
    const generationId = 'runner-in-progress';
    harness.service.beginContentGeneration({ ownerEmail: OWNER, generationId, mode: 'plog' });
    const runner = createBilledSseRunner(harness.service);
    const response = new FakeResponse();
    let generated = false;
    await runner({
      res: response,
      ownerEmail: OWNER,
      generationId,
      mode: 'plog',
      generate: async () => { generated = true; return delivery(); },
    });
    assert.equal(response.statusCode, 202);
    assert.equal(response.jsonBody.code, 'CONTENT_GENERATION_IN_PROGRESS');
    assert.equal(response.flushed, false);
    assert.equal(generated, false);
  });
});

test('preview SSE runner calls one cover generator, never bills, and strips full-plan fields', async () => {
  const harness = createFakeHarness();
  const runner = createPreviewSseRunner({ previewContentGeneration: harness.service.previewContentGeneration });
  const response = new FakeResponse();
  let coverCalls = 0;
  await runner({
    res: response,
    generationId: 'preview-runner-1',
    mode: 'xhs',
    generateCover: async () => {
      coverCalls += 1;
      return {
        url: assetUrl(0),
        delivery: {
          title: '本地预览',
          cover_url: assetUrl(0),
          image_urls: [],
          pages: [{ page_id: 1 }],
          image_prompts: [{ page_id: 1, prompt: 'full plan' }],
          cover_prompt: 'hidden prompt',
        },
      };
    },
  });
  const complete = parsedSseEvents(response).find(event => event.type === 'complete');
  assert.equal(coverCalls, 1);
  assert.equal(complete.billing.status, 'preview');
  assert.equal(complete.billing.settledUnits, 0);
  assert.equal(Object.hasOwn(complete, 'pages'), false);
  assert.equal(Object.hasOwn(complete, 'image_prompts'), false);
  assert.equal(Object.hasOwn(complete, 'cover_prompt'), false);
  assert.deepEqual(harness.calls, { holdSet: [], completeSet: [], failSet: [] });
  harness.db.close();
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
  const parameterEnd = source.indexOf(')', start);
  return extractBalancedBlock(source, source.indexOf('{', parameterEnd));
}

function assertBefore(source, earlier, later, message) {
  const earlierIndex = typeof earlier === 'string' ? source.indexOf(earlier) : source.search(earlier);
  const laterIndex = typeof later === 'string' ? source.indexOf(later) : source.search(later);
  assert.notEqual(earlierIndex, -1, `${message}: earlier marker`);
  assert.notEqual(laterIndex, -1, `${message}: later marker`);
  assert.ok(earlierIndex < laterIndex, message);
}

test('server initializes durable billing, signed sessions, trusted proxy IPs, and token-only paid auth', async () => {
  const server = await fs.readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  assert.match(server, /const db = initDB\(\);/);
  assert.match(server, /createWalletService\(db,\s*\{\s*isUnlimited:\s*isUnlimitedBetaEmail\s*\}\)/);
  assert.match(server, /createContentEntitlements\(db, walletService\)/);
  assert.match(server, /createContentBilling\(\{\s*db,\s*contentEntitlements,\s*walletService,?\s*\}\)/);
  assert.match(server, /createGeneratedAssetPersister\(\{\s*generatedAssetStore/);
  assert.match(server, /createBilledSseRunner\(/);
  assert.match(server, /createPreviewSseRunner\(/);
  assert.match(server, /process\.env\.AUTH_SESSION_SECRET/);
  assert.match(server, /crypto\.randomBytes\(32\)/);
  assert.match(server, /createSessionTokenService\(/);
  assert.match(server, /console\.warn\([^)]*AUTH_SESSION_SECRET/);
  assert.match(server, /app\.set\(['"]trust proxy['"],\s*['"]loopback['"]\)/);

  assert.match(server, /CONTENT_PREVIEW_ROUTES\s*=\s*new Set\(\[\s*['"]\/api\/generate['"],\s*['"]\/api\/plog-generate['"]\s*\]\)/);
  const getClientIp = extractNamedFunction(server, 'getClientIp');
  assert.match(getClientIp, /req\.ip/);
  assert.doesNotMatch(getClientIp, /x-forwarded-for/i);

  const middleware = extractNamedFunction(server, 'betaAccessMiddleware');
  assert.match(middleware, /CONTENT_PREVIEW_ROUTES\.has\(req\.path\)/);
  assert.match(middleware, /req\.body\?\.preview === true/);
  assert.match(middleware, /req\._contentPreview = true/);
  assert.match(middleware, /authenticateContentRequest\(req/);
  assertBefore(middleware, 'req._contentPreview = true', 'authenticateContentRequest', 'preview is separated before session auth');
  assertBefore(middleware, 'authenticateContentRequest', 'requireBetaEmail(req.body?.email)', 'paid content auth precedes legacy body auth');
  assert.match(server, /betaAccessMiddleware\(req, res, continueWithRateLimit\)/);

  const verifyRoute = extractRouteHandler(server, '/api/auth/verify-code', '/api/plog-generate');
  assert.match(verifyRoute, /contentSessionTokens\.issue\(access\.email\)/);
  assert.match(verifyRoute, /token/);
  assert.match(verifyRoute, /expiresAt/);
});

test('XHS and Plog routes use shared runners, stable persistence, and local one-cover previews', async t => {
  const server = await fs.readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const cases = [
    {
      name: 'XHS',
      path: '/api/generate',
      nextPath: '/api/analyze',
      mode: 'xhs',
      paidFunction: 'generateXhsContentSet',
      previewFunction: 'runXhsPreview',
      paidUpstream: /contentAnalysis\(/,
      forbiddenPreview: /contentAnalysis\(|visualPlanning\(|callMiniLLM\(/,
    },
    {
      name: 'Plog',
      path: '/api/plog-generate',
      nextPath: '/api/create-payment',
      mode: 'plog',
      paidFunction: 'generatePlogContentSet',
      previewFunction: 'runPlogPreview',
      paidUpstream: /enrichLensesWithLLM\(/,
      forbiddenPreview: /enrichLensesWithLLM\(|extractToneFromImage\(|callMiniLLM\(/,
    },
  ];

  for (const spec of cases) {
    await t.test(spec.name, () => {
      const route = extractRouteHandler(server, spec.path, spec.nextPath);
      assert.match(route, /req\._contentPreview === true/);
      assert.match(route, new RegExp(`${spec.previewFunction}\\(req, res\\)`));
      assert.match(route, /runBilledContentSse\(\{/);
      assert.match(route, /ownerEmail:\s*req\._userEmail/);
      assert.match(route, /generationId:\s*req\.body\?\.generationId/);
      assert.match(route, new RegExp(`mode:\\s*['"]${spec.mode}['"]`));
      assertBefore(route, `${spec.previewFunction}(req, res)`, 'runBilledContentSse(', `${spec.name} preview exits before paid runner`);
      assert.doesNotMatch(route, /req\.body\?\.email|req\.body\.email|body\.email/);
      assert.doesNotMatch(route, /req\.body\?\.kind|req\.body\.kind|body\.kind/);
      assert.doesNotMatch(route, /req\.body\?\.workId|req\.body\.workId|body\.workId/);
      assert.doesNotMatch(route, /consumeUserCredit|deductCredit/);

      const paid = extractNamedFunction(server, spec.paidFunction);
      assert.match(paid, spec.paidUpstream);
      assertBefore(paid, 'await persistGeneratedAsset(', 'results.push(', `${spec.name} persists before collecting results`);
      assertBefore(paid, 'await persistGeneratedAsset(', /send\((?:'|")image(?:'|")/, `${spec.name} persists before image SSE`);

      const preview = extractNamedFunction(server, spec.previewFunction);
      assert.match(preview, /runContentPreviewSse\(/);
      assert.match(preview, /await persistGeneratedAsset\(/);
      assert.doesNotMatch(preview, spec.forbiddenPreview);
      assert.doesNotMatch(preview, /pages|image_prompts|cover_prompt/);
    });
  }
});
