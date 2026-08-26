import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

import { ensureBillingSchema } from '../server/billing/schema.mjs';
import { createWalletService } from '../server/billing/walletService.mjs';
import { bootstrapDefaultAccountAccess } from '../server/accessControl.mjs';
import { createAdminOperations } from '../server/adminOperations.mjs';

const UNIT_REVENUE_CNY = 199 / 760000;

function harness() {
  const db = new Database(':memory:');
  ensureBillingSchema(db);
  bootstrapDefaultAccountAccess(db);
  const walletService = createWalletService(db);
  return { db, walletService };
}

function insertUsageEvent(db, { sku, units, providerCostCny, createdAt }) {
  db.prepare(`
    INSERT INTO usage_events (
      id, owner_email, currency, sku, charged_units, shadow_units,
      provider_cost_cny, credit_face_value_cny, cash_revenue_cny, promo_subsidy_cny,
      cost_source, cost_confidence, feature, provider, model, catalog_version,
      reference_type, reference_id, metadata, created_at
    ) VALUES (?, ?, 'ec_points', ?, ?, 0, ?, ?, 0, 0, 'catalog_fixed', 'medium', '', '', '', 0, 'video_generation', ?, '{}', ?)
  `).run(
    'evt-' + Math.random().toString(36).slice(2),
    '240485042@qq.com',
    sku,
    units,
    providerCostCny,
    Number((units * UNIT_REVENUE_CNY).toFixed(6)),
    'asset-1',
    createdAt,
  );
}

test('admin summary exposes a video cost board with today/7-day windows and per-model margin', () => {
  const { db, walletService } = harness();
  try {
    // 今日：两条标准档（¥5.07/条）；近 7 日另含一条 MiniMax 落库成本（保守上界 ¥5.45，
    // 双情景：1:1 情景 ≈¥0.76 倾向 / 7.15 情景 ¥5.45，待充值实测定案）；
    // 10 天前的 fast 档与非视频 SKU 不应进入窗口。
    const now = new Date();
    const stamp = offsetDays => new Date(now.getTime() - offsetDays * 86_400_000)
      .toISOString().slice(0, 19).replace('T', ' ');
    insertUsageEvent(db, { sku: 'video_seedance_standard_short', units: 62000, providerCostCny: 5.07, createdAt: stamp(0) });
    insertUsageEvent(db, { sku: 'video_seedance_standard_short', units: 62000, providerCostCny: 5.07, createdAt: stamp(0) });
    insertUsageEvent(db, { sku: 'video_minimax_h3_2k_short', units: 68000, providerCostCny: 5.45, createdAt: stamp(3) });
    insertUsageEvent(db, { sku: 'video_seedance_fast_short', units: 40000, providerCostCny: 5.07, createdAt: stamp(10) });
    insertUsageEvent(db, { sku: 'ec_image_2k', units: 1000, providerCostCny: 0.038, createdAt: stamp(0) });

    const operations = createAdminOperations({ db, walletService });
    const summary = operations.summary({});
    const board = summary.videoCost;

    assert.equal(board.timezoneNote, 'utc');
    assert.equal(board.grossProfitFormula, 'credit_face_value_cny - provider_cost_cny');

    assert.equal(board.today.calls, 2);
    assert.equal(board.last7Days.calls, 3);
    assert.equal(board.last7Days.providerCostCny, 15.59);
    // 与落库口径一致：面值按单条事件 toFixed(6) 后再求和。
    const expectedRevenue = Number((2 * Number((62000 * UNIT_REVENUE_CNY).toFixed(6))
      + Number((68000 * UNIT_REVENUE_CNY).toFixed(6))).toFixed(6));
    assert.equal(board.last7Days.theoreticalRevenueCny, expectedRevenue);
    assert.equal(board.last7Days.grossProfitCny, Number((expectedRevenue - 15.59).toFixed(6)));

    const standard = board.byModel.find(row => row.productId === 'seedance_standard');
    const minimax = board.byModel.find(row => row.productId === 'minimax_h3_2k');
    assert.ok(standard, 'seedance_standard row present');
    assert.equal(standard.provider, 'IP233');
    assert.equal(standard.label, 'Seedance 2.0 标准');
    assert.equal(standard.callsToday, 2);
    assert.equal(standard.calls7d, 2);
    assert.equal(standard.avgCostPerCallCny7d, 5.07);
    assert.ok(minimax, 'minimax_h3_2k row present');
    assert.equal(minimax.provider, 'Poke');
    assert.equal(minimax.callsToday, 0);
    assert.equal(minimax.calls7d, 1);
    // 落库口径仍按保守上界 ¥5.45 结算；H3 行额外携带双情景区间毛利，避免单点展示误导。
    assert.equal(minimax.avgCostPerCallCny7d, 5.45);
    assert.match(minimax.costScenarioNote, /双情景/);
    const minimaxRevenue = Number((68000 * UNIT_REVENUE_CNY).toFixed(6));
    assert.deepEqual(minimax.grossProfitRangeCny7d, [
      Number((minimaxRevenue - 5.45).toFixed(6)),
      Number((minimaxRevenue - 0.76).toFixed(6)),
    ]);
    assert.deepEqual(minimax.theoreticalMarginRange7d, [
      Number(((minimaxRevenue - 5.45) / minimaxRevenue).toFixed(4)),
      Number(((minimaxRevenue - 0.76) / minimaxRevenue).toFixed(4)),
    ]);
    // 非 H3 行不携带区间字段。
    assert.equal(standard.grossProfitRangeCny7d, undefined);
    assert.equal(standard.costScenarioNote, undefined);
    assert.equal(board.byModel.some(row => row.productId === 'seedance_fast'), false,
      'generations older than 7 days stay out of the window');
  } finally {
    db.close();
  }
});

test('video cost board stays empty-safe before any generation settles', () => {
  const { db, walletService } = harness();
  try {
    const operations = createAdminOperations({ db, walletService });
    const board = operations.summary({}).videoCost;
    assert.deepEqual(board.today, {
      calls: 0, pointsConsumed: 0, theoreticalRevenueCny: 0, cashRevenueCny: 0,
      providerCostCny: 0, grossProfitCny: 0,
    });
    assert.deepEqual(board.byModel, []);
  } finally {
    db.close();
  }
});
