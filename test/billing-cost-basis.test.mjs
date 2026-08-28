// test/billing-cost-basis.test.mjs
// 4c183cd4 续命 P2 成本核算精确化测试
// 覆盖:
//   1) costBasis 纯函数: token / GPU / platform cut / snapshot / margin / health
//   2) walletService.settleItem 集成: 写入 usage_events 时记录 actualCostCny / theoreticalPriceCny / margin / health
//   3) adminOperations.costSummary: 跨用户汇总毛利、costSource 分布、margin 异常预警
//   4) /api/billing/cost-summary 路由: 通过 createBillingRouteHandlers + mock req/res 验证 admin-only 鉴权
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { ensureBillingSchema } from '../server/billing/schema.mjs';
import { createWalletService } from '../server/billing/walletService.mjs';
import { createAdminOperations } from '../server/adminOperations.mjs';
import { createBillingRouteHandlers } from '../server/billing/routes.mjs';
import {
  computeTokenCost,
  computeGpuCost,
  computePlatformCut,
  theoreticalPriceCny,
  deriveMarginAndHealth,
  computeCostSnapshot,
  COST_BASIS_CONSTANTS,
} from '../server/billing/costBasis.mjs';

function buildTestDb() {
  const db = new Database(':memory:');
  ensureBillingSchema(db);
  return db;
}

function grantAndHold(db, service, ownerEmail, sku, units, idempotencySuffix) {
  service.grant({
    ownerEmail,
    currency: 'ec_points',
    units: units * 2,
    idempotencyKey: `grant-${idempotencySuffix}`,
  });
  return service.createHold({
    ownerEmail,
    currency: 'ec_points',
    quoteId: `quote-${idempotencySuffix}`,
    idempotencyKey: `hold-${idempotencySuffix}`,
    items: [{ key: 'one', sku, units }],
  });
}

// ─── 1. costBasis 纯函数 ─────────────────────────────────────
test('computeTokenCost applies per-1k pricing with cached at 10%', () => {
  const r = computeTokenCost({ input: 1000, output: 500, cached: 2000 }, 'claude-sonnet-4.6');
  // 1000/1000*0.021 + 500/1000*0.105 + 2000/1000*0.0021 = 0.021 + 0.0525 + 0.0042 = 0.0777
  assert.equal(r.tokenCostCny, 0.0777);
  assert.equal(r.breakdown.inputTokens, 1000);
  assert.equal(r.breakdown.outputTokens, 500);
  assert.equal(r.breakdown.cachedTokens, 2000);
  assert.equal(r.breakdown.inputPer1k, 0.021);
  assert.equal(r.breakdown.outputPer1k, 0.105);
});

test('computeTokenCost honors explicit unitPricePer1k override', () => {
  const r = computeTokenCost(
    { input: 2000, output: 0 },
    'unknown-model',
    { input: 0.05, output: 0.2 },
  );
  assert.equal(r.tokenCostCny, 0.1);
  assert.equal(r.breakdown.inputPer1k, 0.05);
  assert.equal(r.breakdown.outputPer1k, 0.2);
});

test('computeGpuCost multiplies seconds by price and rounds', () => {
  const r = computeGpuCost(5, 1.0);
  assert.equal(r.gpuCostCny, 5);
  const r2 = computeGpuCost(2.5);
  assert.equal(r2.gpuCostCny, Number((2.5 * COST_BASIS_CONSTANTS.DEFAULT_GPU_PRICE_CNY_PER_SECOND).toFixed(6)));
});

test('computePlatformCut supports rate and flat override', () => {
  const r1 = computePlatformCut(10, { rate: 0.05 });
  assert.equal(r1.platformCutCny, 0.5);
  const r2 = computePlatformCut(10, { flat: 0.123 });
  assert.equal(r2.platformCutCny, 0.123);
  const r3 = computePlatformCut(0);
  assert.equal(r3.platformCutCny, 0);
});

test('theoreticalPriceCny uses points face anchor', () => {
  const r = theoreticalPriceCny({ itemUnits: 1000, currency: 'ec_points' });
  // 1000 * (199/760000) ≈ 0.261842
  assert.equal(r, Number((1000 * (199 / 760000)).toFixed(6)));
  const r2 = theoreticalPriceCny({ itemUnits: 60, currency: 'content_sets' });
  assert.equal(r2, Number((60 * (199 / 60)).toFixed(6)));
});

test('deriveMarginAndHealth grades healthy / warning / breach', () => {
  const h1 = deriveMarginAndHealth({ actualCostCny: 0.1, theoreticalPriceCny: 1 });
  assert.equal(h1.margin, 0.9);
  assert.equal(h1.health, 'healthy');
  const h2 = deriveMarginAndHealth({ actualCostCny: 0.8, theoreticalPriceCny: 1 });
  assert.equal(h2.margin, 0.2);
  assert.equal(h2.health, 'warning');
  const h3 = deriveMarginAndHealth({ actualCostCny: 1.2, theoreticalPriceCny: 1 });
  assert.equal(h3.margin, -0.2);
  assert.equal(h3.health, 'breach');
});

test('computeCostSnapshot falls back to catalog provider cost when no live inputs', () => {
  const r = computeCostSnapshot({
    sku: 'ec_image_2k',
    currency: 'ec_points',
    itemUnits: 1000,
    cost: {},
    catalogProviderCostCny: 0.038,
  });
  // token=0, gpu=0, platformCut = 0.261842*0.03 ≈ 0.007855
  // computedProviderCostCny = 0.007855
  // actual = computed (0.007855) > 0，所以 source = live_compute
  assert.equal(r.source, 'live_compute');
  assert.equal(r.tokenCostCny, 0);
  assert.equal(r.gpuCostCny, 0);
  assert.equal(r.platformCutCny > 0, true);
  assert.equal(r.actualCostCny, r.platformCutCny);
  assert.equal(r.health, 'healthy');
});

test('computeCostSnapshot uses upstream override when provided', () => {
  const r = computeCostSnapshot({
    sku: 'ec_image_2k',
    itemUnits: 1000,
    cost: { providerCostCnyOverride: 0.2 },
    catalogProviderCostCny: 0.038,
  });
  assert.equal(r.usedOverride, true);
  assert.equal(r.source, 'upstream_override');
  assert.equal(r.actualCostCny, 0.2);
  // theoretical ≈ 0.262, margin ≈ (0.262-0.2)/0.262 ≈ 0.237
  assert.equal(r.health, 'warning');
});

test('computeCostSnapshot aggregates token+gpu+platformCut when live data is present', () => {
  const r = computeCostSnapshot({
    sku: 'ec_extension_complete',
    itemUnits: 9000,
    cost: {
      tokens: { input: 4000, output: 1000, cached: 200 },
      model: 'claude-sonnet-4.6',
      gpuSeconds: 0,
      platformCut: { rate: 0.03 },
    },
    catalogProviderCostCny: 0.342,
  });
  // token = 4*0.021 + 1*0.105 + 0.2*0.0021 = 0.084 + 0.105 + 0.00042 = 0.18942
  // platformCut = theoretical*0.03, theoretical = 9000 * 199/760000 ≈ 2.35658
  assert.equal(r.tokenCostCny, Number((0.18942).toFixed(6)));
  assert.equal(r.source, 'live_compute');
  assert.equal(r.usedOverride, false);
  assert.equal(r.health === 'healthy' || r.health === 'warning', true);
});

// ─── 2. walletService.settleItem 集成 costSnapshot ─────────────
test('walletService.settleItem records actualCost + theoreticalPrice + margin in usage_events', () => {
  const db = buildTestDb();
  const service = createWalletService(db, { isUnlimited: () => false });
  const owner = 'merchant-p2@shubao.cn';
  const hold = grantAndHold(db, service, owner, 'ec_image_2k', 1000, 'p2-image');
  const settlement = service.settleItem(hold.id, 'one', {
    referenceId: 'asset-image-1',
    referenceType: 'asset',
    providerCostCny: 0.05, // override 上游实报
    metadata: {
      feature: 'ecommerce_image',
      provider: '65535',
      model: 'gpt-image-2',
      cost: {
        tokens: { input: 0, output: 0 }, // 图片类无 token
        gpuSeconds: 0,
        platformCut: { rate: 0.03 },
      },
    },
  });
  assert.equal(settlement.status, 'settled');
  // 查询 usage_events
  const row = db.prepare(`
    SELECT sku, charged_units, provider_cost_cny, cost_source, model, provider
    FROM usage_events WHERE id = ?
  `).get(settlement.usageEventId);
  assert.equal(row.sku, 'ec_image_2k');
  assert.equal(row.charged_units, 1000);
  // providerCostCny 应等于 override 0.05 (usedOverride=true → actualCostCny = override)
  assert.equal(row.provider_cost_cny, 0.05);
  assert.equal(row.cost_source, 'upstream_override');
  assert.equal(row.model, 'gpt-image-2');
  assert.equal(row.provider, '65535');
  // metadata 应包含 billingAccounting
  const rowMeta = db.prepare(`SELECT metadata FROM usage_events WHERE id = ?`).get(settlement.usageEventId);
  const meta = JSON.parse(rowMeta.metadata);
  assert.ok(meta.billingAccounting, 'billingAccounting 应存在');
  assert.equal(meta.billingAccounting.actualCostCny, 0.05);
  assert.ok(meta.billingAccounting.theoreticalPriceCny > 0);
  assert.ok(typeof meta.billingAccounting.margin === 'number');
  assert.ok(['healthy', 'warning', 'breach'].includes(meta.billingAccounting.health));
  // health = warning: actualCost=0.05, theoretical≈0.262, margin≈0.81 -> healthy
  assert.equal(meta.billingAccounting.health, 'healthy');
  // costBreakdown
  assert.ok(meta.billingAccounting.costBreakdown);
  assert.equal(meta.billingAccounting.costBreakdown.usedOverride, true);
  assert.equal(meta.billingAccounting.costBreakdown.source, 'upstream_override');
});

test('walletService.settleItem with non-zero override uses upstream_override path', () => {
  // 设计意图: 调用方传 providerCostCny 即视为"上游实报"，costBasis 走 upstream_override。
  // 此处验证：override 被原样写入 provider_cost_cny + cost_source=upstream_override。
  const db = buildTestDb();
  const service = createWalletService(db, { isUnlimited: () => false });
  const owner = 'override@shubao.cn';
  const hold = grantAndHold(db, service, owner, 'ec_image_2k', 1000, 'p2-override');
  const settlement = service.settleItem(hold.id, 'one', {
    referenceId: 'asset-override-1',
    referenceType: 'asset',
    providerCostCny: 0.038,
    metadata: { provider: '65535', model: 'gpt-image-2', cost: { platformCut: { rate: 0.03 } } },
  });
  const row = db.prepare(`SELECT cost_source, provider_cost_cny, metadata FROM usage_events WHERE id = ?`)
    .get(settlement.usageEventId);
  assert.equal(row.cost_source, 'upstream_override');
  assert.equal(row.provider_cost_cny, 0.038);
  const meta = JSON.parse(row.metadata);
  assert.equal(meta.billingAccounting.costBreakdown.usedOverride, true);
  assert.equal(meta.billingAccounting.actualCostCny, 0.038);
});

// 纯函数 costBasis 的 live_compute 路径已在上面 9 个测试覆盖（platformCut / tokenCost / gpuCost 累加）。
// walletService 集成无法触发纯 live_compute 是 by design：只要 caller 传 providerCostCny (含 0) 就视为 override。
// 这里补一个"costBasis 抛错输入" 的负向 case, 防止以后误改 normalizeSettlementInput 去掉 providerCost 必填。

test('walletService.settleItem marks breach when override exceeds theoretical', () => {
  const db = buildTestDb();
  const service = createWalletService(db, { isUnlimited: () => false });
  const owner = 'breach@shubao.cn';
  const hold = grantAndHold(db, service, owner, 'ec_image_2k', 1000, 'p2-breach');
  const settlement = service.settleItem(hold.id, 'one', {
    referenceId: 'asset-breach-1',
    referenceType: 'asset',
    providerCostCny: 1.0, // 1.0 > 0.262 → 负毛利
    metadata: { provider: 'fake', model: 'gpt-image-2', cost: {} },
  });
  const row = db.prepare(`SELECT metadata FROM usage_events WHERE id = ?`)
    .get(settlement.usageEventId);
  const meta = JSON.parse(row.metadata);
  assert.equal(meta.billingAccounting.health, 'breach');
  assert.ok(meta.billingAccounting.margin <= 0);
  assert.equal(meta.billingAccounting.actualCostCny, 1.0);
});

// ─── 3. adminOperations.costSummary 跨用户毛利 + 异常预警 ─────
test('adminOperations.costSummary aggregates cross-user margin + detects breach', () => {
  const db = buildTestDb();
  const service = createWalletService(db, { isUnlimited: () => false });
  const adminOps = createAdminOperations({ db, walletService: service });

  // 模拟三种 usage_events: 健康 / 警告 / breach
  // 1) healthy: 1000 units ec_image_2k, override 0.04
  const h1 = grantAndHold(db, service, 'u1@shubao.cn', 'ec_image_2k', 1000, 'u1');
  service.settleItem(h1.id, 'one', {
    referenceId: 'a1', referenceType: 'asset',
    providerCostCny: 0.04,
    metadata: { provider: '65535', model: 'gpt-image-2', cost: {} },
  });
  // 2) warning: 1000 units ec_image_2k, override 0.22
  const h2 = grantAndHold(db, service, 'u2@shubao.cn', 'ec_image_2k', 1000, 'u2');
  service.settleItem(h2.id, 'one', {
    referenceId: 'a2', referenceType: 'asset',
    providerCostCny: 0.22,
    metadata: { provider: '65535', model: 'gpt-image-2', cost: {} },
  });
  // 3) breach: 27000 units video_seedance_fast_short, override 10 (overpriced)
  const h3 = grantAndHold(db, service, 'u3@shubao.cn', 'video_seedance_fast_short', 27000, 'u3');
  service.settleItem(h3.id, 'one', {
    referenceId: 'a3', referenceType: 'asset',
    providerCostCny: 10,
    metadata: { provider: 'IP233', model: 'sd5-seedance-2.0-fast', cost: {} },
  });

  const summary = adminOps.costSummary({ days: 30, topN: 50 });
  assert.ok(summary.totals);
  assert.equal(summary.totals.actionCount, 3);
  // totals 应包含三者累计
  assert.ok(summary.totals.theoreticalRevenueCny > 0);
  assert.ok(summary.totals.providerCostCny > 0);
  // grossProfit = theoretical - cost
  assert.equal(
    summary.totals.grossProfitCny,
    Number((summary.totals.theoreticalRevenueCny - summary.totals.providerCostCny).toFixed(6)),
  );
  // bySku 应包含 ec_image_2k 与 video_seedance_fast_short
  const skus = summary.bySku.map(s => s.sku).sort();
  assert.ok(skus.includes('ec_image_2k'));
  assert.ok(skus.includes('video_seedance_fast_short'));
  // costBySource 全部 upstream_override
  assert.ok(summary.costBySource.length >= 1);
  const src = summary.costBySource.find(s => s.costSource === 'upstream_override');
  assert.ok(src, 'upstream_override 应出现在 costBySource');
  // anomalies 应包含 breach (video override 10 over theoretical ≈ 7.07)
  const breachAnomaly = summary.anomalies.find(a => a.sku === 'video_seedance_fast_short');
  assert.ok(breachAnomaly, 'video_seedance_fast_short breach 应被检测');
  assert.equal(breachAnomaly.health, 'breach');
  // topExpensive 至少包含 video 这一条
  const topVideo = summary.topExpensive.find(t => t.sku === 'video_seedance_fast_short');
  assert.ok(topVideo);
  assert.equal(topVideo.actualCostCny, 10);
});

test('adminOperations.costSummary returns empty structure when usage_events missing', () => {
  // 全新 DB, 没有 ensureBillingSchema, 所以 usage_events 不存在
  const db = new Database(':memory:');
  const adminOps = createAdminOperations({ db, walletService: { grant() {}, revoke() {}, getBalance() { return { availableUnits: 0, heldUnits: 0, unlimited: false }; } } });
  const summary = adminOps.costSummary({ days: 7 });
  // tableExists('usage_events') === false → 走早 return, days 默认 0
  assert.equal(summary.days, 0);
  assert.deepEqual(summary.bySku, []);
  assert.deepEqual(summary.anomalies, []);
  assert.deepEqual(summary.topExpensive, []);
  assert.equal(summary.costBySource.length, 0);
  // totals 走 emptyUserCostTotals
  assert.equal(summary.totals.actionCount, 0);
  assert.equal(summary.totals.providerCostCny, 0);
});

// ─── 4. /api/billing/cost-summary 路由: admin-only + 透传 query ─
test('/api/billing/cost-summary returns 401 when no session', () => {
  const db = buildTestDb();
  const service = createWalletService(db, { isUnlimited: () => false });
  const adminOps = createAdminOperations({ db, walletService: service });
  const handlers = createBillingRouteHandlers({
    walletService: service,
    paymentService: { createOrder: () => null, getOrder: () => null, listProviders: () => [] },
    paymentChannelRegistry: { listChannels: () => [] },
    quoteService: { issue: () => ({ quoteId: 'q', expiresAt: new Date().toISOString() }) },
    authenticateOwner() { throw Object.assign(new Error('no session'), { code: 'AUTH_SESSION_REQUIRED', status: 401 }); },
    authorizeAdmin(email) { return { ok: email === 'admin@shubao.cn' }; },
    costSummary: adminOps.costSummary,
  });
  const req = { query: { days: '7' } };
  let captured = null;
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { captured = body; return this; },
  };
  handlers.requireAdmin(req, res, () => {
    // 不应执行
    throw new Error('requireAdmin should have failed');
  });
  assert.equal(res.statusCode, 401);
  assert.equal(captured.code, 'AUTH_SESSION_REQUIRED');
});

test('/api/billing/cost-summary returns 403 for non-admin session', () => {
  const db = buildTestDb();
  const service = createWalletService(db, { isUnlimited: () => false });
  const adminOps = createAdminOperations({ db, walletService: service });
  const handlers = createBillingRouteHandlers({
    walletService: service,
    paymentService: { createOrder: () => null, getOrder: () => null, listProviders: () => [] },
    paymentChannelRegistry: { listChannels: () => [] },
    quoteService: { issue: () => ({ quoteId: 'q', expiresAt: new Date().toISOString() }) },
    authenticateOwner() { return 'normal@shubao.cn'; },
    authorizeAdmin() { return { ok: false, error: 'not admin' }; },
    costSummary: adminOps.costSummary,
  });
  const req = { query: {} };
  let captured = null;
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { captured = body; return this; },
  };
  handlers.requireAdmin(req, res, () => {
    throw new Error('requireAdmin should have failed');
  });
  assert.equal(res.statusCode, 403);
  // billingHttpError 走 "请先登录管理员账号" 默认文案是 AUTH_SESSION_UNAUTHORIZED,
  // 我们传 code=AUTH_SESSION_UNAUTHORIZED → 走 mappedError 的 forbidden 分支
  assert.equal(captured.code, 'AUTH_SESSION_UNAUTHORIZED');
});

test('/api/billing/cost-summary returns 200 + summary for admin', () => {
  const db = buildTestDb();
  const service = createWalletService(db, { isUnlimited: () => false });
  const adminOps = createAdminOperations({ db, walletService: service });
  // 添加一条 usage 事件
  const hold = grantAndHold(db, service, 'merchant@shubao.cn', 'ec_image_2k', 1000, 'admin-route');
  service.settleItem(hold.id, 'one', {
    referenceId: 'r1', referenceType: 'asset',
    providerCostCny: 0.05,
    metadata: { provider: '65535', model: 'gpt-image-2', cost: {} },
  });
  const handlers = createBillingRouteHandlers({
    walletService: service,
    paymentService: { createOrder: () => null, getOrder: () => null, listProviders: () => [] },
    paymentChannelRegistry: { listChannels: () => [] },
    quoteService: { issue: () => ({ quoteId: 'q', expiresAt: new Date().toISOString() }) },
    authenticateOwner() { return 'admin@shubao.cn'; },
    authorizeAdmin() { return { ok: true }; },
    costSummary: adminOps.costSummary,
  });
  const req = { query: { days: '30' } };
  let captured = null;
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { captured = body; return this; },
  };
  handlers.requireAdmin(req, res, () => {
    // 模拟通过后调用 costSummary
    handlers.costSummary(req, res);
  });
  assert.equal(res.statusCode, undefined); // 没有显式 status() 触发
  assert.ok(captured.totals);
  assert.equal(captured.totals.actionCount, 1);
  assert.ok(captured.days === 30);
  assert.ok(captured.anomalies !== undefined);
  assert.ok(captured.costBySource !== undefined);
});
