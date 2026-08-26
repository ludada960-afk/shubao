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
    // 今日：两条标准档（¥5.07/条）；近 7 日另含一条 MiniMax 历史落库成本（旧保守上界 ¥5.45；
    // 成本已于 2026-09 定案为 1:1 口径 ¥0.76/条，看板展示层应按定案值重算单值毛利）；
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
    // 历史落库仍为旧上界 ¥5.45；H3 行展示层按定案成本 ¥0.76 重算单值毛利，无区间字段。
    assert.equal(minimax.providerCostCny7d, 0.76);
    assert.equal(minimax.avgCostPerCallCny7d, 0.76);
    assert.match(minimax.costNote, /成本已定案/);
    assert.ok(!('grossProfitRangeCny7d' in minimax), 'range fields are gone after finalization');
    assert.ok(!('theoreticalMarginRange7d' in minimax), 'range fields are gone after finalization');
    const minimaxRevenue = Number((68000 * UNIT_REVENUE_CNY).toFixed(6));
    assert.equal(minimax.grossProfitCny7d, Number((minimaxRevenue - 0.76).toFixed(6)));
    assert.equal(minimax.theoreticalMargin7d, Number(((minimaxRevenue - 0.76) / minimaxRevenue).toFixed(4)));
    // 非 H3 行不受影响、不带定案注记。
    assert.equal(standard.avgCostPerCallCny7d, 5.07);
    assert.equal(standard.costNote, undefined);
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

test('monitoring totals separate billing rejections and expose aggregate systemFailureRate for the >10% alert', () => {
  const { db, walletService } = harness();
  try {
    db.exec(`
      CREATE TABLE ecommerce_jobs (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        payload TEXT NOT NULL DEFAULT '{}',
        output TEXT NOT NULL DEFAULT '{}',
        error TEXT NOT NULL DEFAULT '',
        progress TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const insert = db.prepare(
      "INSERT INTO ecommerce_jobs (id, owner_email, status, error) VALUES (?, 'tester@example.com', ?, ?)",
    );
    for (let index = 0; index < 7; index += 1) insert.run(`ec-ok-${index}`, 'completed', '');
    insert.run('ec-billing-rejected', 'failed', 'AI 积分不足，请购买套餐后继续');
    insert.run('ec-system-1', 'failed', 'upstream unreachable');
    insert.run('ec-system-2', 'failed', 'asset_retry_exhausted:upstream unreachable');

    const operations = createAdminOperations({ db, walletService });
    const totals = operations.summary({}).jobs.totals;
    assert.equal(totals.completed, 7);
    assert.equal(totals.failed, 3);
    assert.equal(totals.billingRejected, 1);
    assert.equal(totals.systemFailed, 2);
    // 表观失败率 3/10；剔除业务拒绝后的真实系统失败率 2/9 ≈ 22.22% → 超过 10% 阈值应高亮。
    assert.equal(totals.failureRate, 0.3);
    assert.equal(totals.systemFailureRate, Number((2 / 9).toFixed(4)));
  } finally {
    db.close();
  }
});
