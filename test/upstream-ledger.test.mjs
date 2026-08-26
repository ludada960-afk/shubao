import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUpstreamCostLedger, UPSTREAM_LEDGER_VERSION } from '../server/billing/upstreamLedger.mjs';

test('upstream ledger contains the audited CNY snapshots and source state', () => {
  const ledger = buildUpstreamCostLedger();

  assert.equal(ledger.version, UPSTREAM_LEDGER_VERSION);
  assert.match(ledger.currencyPolicy, /人民币 1:1/);
  assert.equal(ledger.providerReportedSpendCny, 25.7005);
  assert.deepEqual(ledger.providers.map(provider => provider.id), ['relay_65535', 'change2pro', 'ip233', 'poke']);
  assert.equal(ledger.providers[0].balanceCny, 6.6);
  assert.equal(ledger.providers[0].reportedSpendCny, 24.9205);
  assert.equal(ledger.providers[1].reportedSpendCny, 0.78);
  assert.equal(ledger.providers[2].reportedRequests, 0);

  const fast = ledger.routes.find(route => route.id === 'ip233-sd5-fast');
  assert.equal(fast.providerLabel, 'IP233 Media API');
  assert.equal(fast.unitPriceCny, 5.07);
  assert.equal(fast.status, 'connected');
  assert.match(fast.health, /库存/);
  assert.equal(fast.appActions.find(action => action.sku === 'video_seedance_fast_short').points, 40);

  const minimax = ledger.routes.find(route => route.id === 'poke-minimax-h3');
  assert.equal(minimax.providerLabel, 'Poke 中转（MiniMax）');
  // 汇率修正（2026-09）：账面单价保持保守上界 ¥5.45，注释按双情景标注（1:1 情景为倾向情景）。
  assert.equal(minimax.unitPriceCny, 5.45);
  assert.equal(minimax.status, 'configured');
  assert.match(minimax.notes, /1:1 情景 ≈¥0\.76/);
  assert.match(minimax.notes, /待充值实测定案/);
  const pokeProvider = ledger.providers.find(provider => provider.id === 'poke');
  assert.match(pokeProvider.currencyPolicy, /双情景/);
  assert.match(pokeProvider.reconciliationNote, /1:1 情景/);

  const nativeRoute = ledger.routes.find(route => route.id === '65535-seedance-native');
  assert.match(nativeRoute.notes, /×1 读/, 'seedance-native 类报价必须注明按 ×1 读');
});

test('upstream ledger reconciles local settled cost by SKU without changing source totals', () => {
  const ledger = buildUpstreamCostLedger({
    bySku: [
      { sku: 'ec_image_2k', actions: 2, provider_cost_cny: 0.076 },
      { sku: 'video_seedance_fast_short', actions: 1, provider_cost_cny: 2.47 },
    ],
    localSettledCostCny: 2.546,
  });

  const image = ledger.routes.find(route => route.id === '65535-gpt-image-2');
  const video = ledger.routes.find(route => route.id === 'ip233-sd5-fast');
  const relay = ledger.providers.find(provider => provider.id === 'relay_65535');
  const ip233 = ledger.providers.find(provider => provider.id === 'ip233');

  assert.equal(image.localSettledActions, 2);
  assert.equal(image.localSettledCostCny, 0.076);
  assert.equal(video.localSettledActions, 1);
  assert.equal(video.localSettledCostCny, 2.47);
  assert.equal(relay.localAttributedCostCny, 0.076);
  assert.equal(ip233.localAttributedCostCny, 2.47);
  assert.equal(ledger.localSettledCostCny, 2.546);
  assert.equal(ledger.providerReportedSpendCny, 25.7005);
});
