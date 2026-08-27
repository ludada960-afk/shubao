// test/price-defense-plan.test.mjs
// 2026-08-26 周一切片 · §6 #4 竞争降价预案
// -----------------------------------------------------------------------------
// 验证：阈值 2% / streak 4 周 / admin bySku promotionEligible 标注 / env 关闭。
// -----------------------------------------------------------------------------
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFENSE_PLAN,
  annotateDefenseCandidates,
  buildDefenseSummary,
  evaluateDefensePlan,
  isDefensePlanEnabled,
  isoWeekStartUtc,
} from '../server/billing/priceDefensePlan.mjs';

test('DEFENSE_PLAN metadata is wired to the standard short/long SKUs', () => {
  assert.equal(DEFENSE_PLAN.flag, 'price_defense_2026_08_26');
  assert.equal(DEFENSE_PLAN.threshold, 0.02);
  assert.equal(DEFENSE_PLAN.streakWeeks, 4);
  assert.equal(DEFENSE_PLAN.candidates.length, 2);
  const skus = DEFENSE_PLAN.candidates.map(c => c.sku);
  assert.ok(skus.includes('video_seedance_standard_short'));
  assert.ok(skus.includes('video_seedance_standard_long'));
  const short = DEFENSE_PLAN.candidates.find(c => c.sku === 'video_seedance_standard_short');
  assert.equal(short.currentPriceFen, 1190);
  assert.equal(short.promoPriceFen, 990);
});

test('isDefensePlanEnabled defaults to true and respects env PRICE_DEFENSE_PLAN=0', () => {
  assert.equal(isDefensePlanEnabled({ env: {} }), true);
  assert.equal(isDefensePlanEnabled({ env: { PRICE_DEFENSE_PLAN: '1' } }), true);
  assert.equal(isDefensePlanEnabled({ env: { PRICE_DEFENSE_PLAN: '0' } }), false);
});

test('evaluateDefensePlan returns insufficient_data on empty input', () => {
  const out = evaluateDefensePlan({ weeklyRows: [] });
  assert.equal(out.triggered, false);
  assert.equal(out.reason, 'insufficient_data');
  assert.equal(out.weeksObserved, 0);
});

test('evaluateDefensePlan triggers after 4 consecutive weeks below 2% conversion', () => {
  const rows = [
    { weekStart: '2026-07-27', signups: 100, payingUsers: 5 },  // 5% above
    { weekStart: '2026-08-03', signups: 100, payingUsers: 1 },  // 1% below
    { weekStart: '2026-08-10', signups: 100, payingUsers: 1 },  // 1% below
    { weekStart: '2026-08-17', signups: 100, payingUsers: 1 },  // 1% below
    { weekStart: '2026-08-24', signups: 100, payingUsers: 1 },  // 1% below
  ];
  const out = evaluateDefensePlan({ weeklyRows: rows });
  assert.equal(out.triggered, true);
  assert.equal(out.currentStreak, 4);
  assert.equal(out.reason, 'within_band');
  assert.equal(out.lastWeek.weekStart, '2026-08-24');
  assert.equal(out.lastWeek.conversionRate, 0.01);
});

test('evaluateDefensePlan does not trigger when only 3 weeks are below threshold', () => {
  const rows = [
    { weekStart: '2026-08-10', signups: 100, payingUsers: 1 },
    { weekStart: '2026-08-17', signups: 100, payingUsers: 1 },
    { weekStart: '2026-08-24', signups: 100, payingUsers: 1 },
  ];
  const out = evaluateDefensePlan({ weeklyRows: rows });
  assert.equal(out.triggered, false);
  assert.equal(out.currentStreak, 3);
  assert.equal(out.reason, 'below_streak');
});

test('evaluateDefensePlan resets streak when an intervening week is above threshold', () => {
  const rows = [
    { weekStart: '2026-08-03', signups: 100, payingUsers: 1 },
    { weekStart: '2026-08-10', signups: 100, payingUsers: 5 },  // 5% breaks streak
    { weekStart: '2026-08-17', signups: 100, payingUsers: 1 },
    { weekStart: '2026-08-24', signups: 100, payingUsers: 1 },
  ];
  const out = evaluateDefensePlan({ weeklyRows: rows });
  assert.equal(out.triggered, false);
  assert.equal(out.currentStreak, 2);
});

test('evaluateDefensePlan treats zero-signup weeks as null and breaks streak', () => {
  // 周序列：[1% 不达标, null(无人注册), 1% 不达标]
  // 从最新周向回数：先撞上 1% 不达标，streak=1；下一周 null → break，不再向上数。
  // 防御性策略：null 不计入 streak 但也不打断，最新一周不达标可被孤立统计。
  const rows = [
    { weekStart: '2026-08-10', signups: 100, payingUsers: 1 },
    { weekStart: '2026-08-17', signups: 0, payingUsers: 0 },
    { weekStart: '2026-08-24', signups: 100, payingUsers: 1 },
  ];
  const out = evaluateDefensePlan({ weeklyRows: rows });
  assert.equal(out.triggered, false);
  assert.equal(out.currentStreak, 1);
  // 反向用例：把 null 放在尾部，确认 null 直接阻断。
  const nullAtTail = [
    { weekStart: '2026-08-10', signups: 100, payingUsers: 1 },
    { weekStart: '2026-08-17', signups: 100, payingUsers: 1 },
    { weekStart: '2026-08-24', signups: 0, payingUsers: 0 },
  ];
  const out2 = evaluateDefensePlan({ weeklyRows: nullAtTail });
  // 从最新周开始：null → break，streak 立即归零。
  assert.equal(out2.currentStreak, 0);
  assert.equal(out2.triggered, false);
});

test('evaluateDefensePlan disabled_by_env when env forces it off even if data triggers', () => {
  const rows = [
    { weekStart: '2026-08-03', signups: 100, payingUsers: 1 },
    { weekStart: '2026-08-10', signups: 100, payingUsers: 1 },
    { weekStart: '2026-08-17', signups: 100, payingUsers: 1 },
    { weekStart: '2026-08-24', signups: 100, payingUsers: 1 },
  ];
  const out = evaluateDefensePlan({ weeklyRows: rows, env: { PRICE_DEFENSE_PLAN: '0' } });
  assert.equal(out.enabled, false);
  assert.equal(out.triggered, false);
  assert.equal(out.reason, 'disabled_by_env');
  assert.equal(out.currentStreak, 4);
});

test('annotateDefenseCandidates adds promotion fields only to candidate SKUs', () => {
  const bySku = [
    { sku: 'video_seedance_standard_short', actions: 10, points_consumed: 460000, theoretical_revenue: 120.5, cash_revenue: 119, provider_cost_cny: 50.7 },
    { sku: 'video_seedance_standard_long', actions: 5, points_consumed: 285000, theoretical_revenue: 75.1, cash_revenue: 74.5, provider_cost_cny: 25.35 },
    { sku: 'ec_image_2k', actions: 100, points_consumed: 100000, theoretical_revenue: 26.18, cash_revenue: 0, provider_cost_cny: 3.8 },
  ];
  const evaluation = { triggered: true };
  const out = annotateDefenseCandidates(bySku, evaluation);
  const short = out.find(r => r.sku === 'video_seedance_standard_short');
  const long = out.find(r => r.sku === 'video_seedance_standard_long');
  const image = out.find(r => r.sku === 'ec_image_2k');
  assert.equal(short.promotionEligible, true);
  assert.equal(short.promoPriceFen, 990);
  assert.equal(short.promoMarginFloor, 0.40);
  assert.equal(short.planFlag, 'price_defense_2026_08_26');
  assert.equal(short.promotionTriggered, true);
  assert.equal(long.promoPriceFen, 1590);
  assert.equal(image.promotionEligible, undefined);
  assert.equal(image.promoPriceFen, undefined);
});

test('annotateDefenseCandidates sets promotionTriggered=false when evaluation not triggered', () => {
  const bySku = [{ sku: 'video_seedance_standard_short', actions: 1, points_consumed: 46000, theoretical_revenue: 11.9, cash_revenue: 11.9, provider_cost_cny: 5.07 }];
  const out = annotateDefenseCandidates(bySku, { triggered: false });
  assert.equal(out[0].promotionEligible, true);
  assert.equal(out[0].promotionTriggered, false);
});

test('buildDefenseSummary rolls up evaluation + candidate bySku + plan flag', () => {
  const bySku = [
    { sku: 'video_seedance_standard_short', actions: 10, points_consumed: 460000, theoretical_revenue: 120.5, cash_revenue: 119, provider_cost_cny: 50.7 },
    { sku: 'ec_image_2k', actions: 100, points_consumed: 100000, theoretical_revenue: 26.18, cash_revenue: 0, provider_cost_cny: 3.8 },
  ];
  const weeklyRows = [
    { weekStart: '2026-08-03', signups: 100, payingUsers: 1 },
    { weekStart: '2026-08-10', signups: 100, payingUsers: 1 },
    { weekStart: '2026-08-17', signups: 100, payingUsers: 1 },
    { weekStart: '2026-08-24', signups: 100, payingUsers: 1 },
  ];
  const summary = buildDefenseSummary(bySku, { weeklyRows, env: {} });
  assert.equal(summary.flag, 'price_defense_2026_08_26');
  assert.equal(summary.triggered, true);
  assert.equal(summary.currentStreak, 4);
  assert.equal(summary.weeksObserved, 4);
  assert.equal(summary.candidates.length, 2);
  const stdShort = summary.bySku.find(r => r.sku === 'video_seedance_standard_short');
  assert.equal(stdShort.promotionEligible, true);
  assert.equal(stdShort.promotionTriggered, true);
  // 非候选 SKU 不被改写。
  const image = summary.bySku.find(r => r.sku === 'ec_image_2k');
  assert.equal(image.promotionEligible, undefined);
});

test('isoWeekStartUtc rolls timestamps back to the Monday of that UTC week', () => {
  assert.equal(isoWeekStartUtc('2026-08-26T10:00:00Z'), '2026-08-24'); // 周三
  assert.equal(isoWeekStartUtc('2026-08-24T00:00:01Z'), '2026-08-24'); // 周一
  assert.equal(isoWeekStartUtc('2026-08-23T23:59:59Z'), '2026-08-17'); // 周日
  assert.equal(isoWeekStartUtc('2026-08-30T12:00:00Z'), '2026-08-24'); // 周日
  assert.equal(isoWeekStartUtc(null), null);
  assert.equal(isoWeekStartUtc('not-a-date'), null);
});

test('adminOperations imports priceDefensePlan and exposes defensePlan block', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile(new URL('../server/adminOperations.mjs', import.meta.url), 'utf8');
  assert.match(source, /from '\.\/billing\/priceDefensePlan\.mjs'/, 'adminOperations must import priceDefensePlan');
  assert.match(source, /buildDefenseSummary\(/, 'adminOperations must call buildDefenseSummary');
  assert.match(source, /weeklyConversionRows\(/, 'adminOperations must compute weekly conversion rows');
  assert.match(source, /defensePlan:/, 'adminOperations summary must surface a defensePlan block');
});
