import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUpstreamCostLedger, UPSTREAM_LEDGER_VERSION } from '../server/billing/upstreamLedger.mjs';

test('upstream ledger contains the audited CNY snapshots and source state', () => {
  const ledger = buildUpstreamCostLedger();

  assert.equal(ledger.version, UPSTREAM_LEDGER_VERSION);
  assert.match(ledger.currencyPolicy, /人民币 1:1/);
  assert.equal(ledger.providerReportedSpendCny, 25.7005);
  assert.deepEqual(ledger.providers.map(provider => provider.id), ['relay_65535', 'change2pro', 'ip233']);
  assert.equal(ledger.providers[0].balanceCny, 6.6);
  assert.equal(ledger.providers[0].reportedSpendCny, 24.9205);
  assert.equal(ledger.providers[1].reportedSpendCny, 0.78);
  assert.equal(ledger.providers[2].reportedRequests, 0);

  const fast = ledger.routes.find(route => route.id === 'ip233-sd5-fast');
  assert.equal(fast.providerLabel, 'IP233 Media API');
  assert.equal(fast.unitPriceCny, 2.47);
  assert.equal(fast.status, 'connected');
  assert.match(fast.health, /库存/);
  assert.equal(fast.appActions.find(action => action.sku === 'video_seedance_fast_short').points, 40);
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
