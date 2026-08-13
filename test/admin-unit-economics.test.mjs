import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUnitEconomicsRows,
  selectConservativeProduct,
} from '../src/pages/AdminConsole/unitEconomicsModel.js';

const catalog = {
  unitsPerPoint: 1000,
  paymentFeeRate: 0.03,
  products: [
    { sku: 'starter', priceFen: 2900, grantUnits: 105000 },
    { sku: 'studio', priceFen: 19900, grantUnits: 760000 },
  ],
  features: [
    { sku: 'ec_image_2k', units: 1000, providerCostCny: 0.038 },
    { sku: 'video_seedance_standard_short', units: 62000, providerCostCny: 3.64 },
  ],
};

test('unit economics defaults to the most conservative paid point package', () => {
  assert.equal(selectConservativeProduct(catalog.products).sku, 'studio');
});

test('unit economics explains revenue, provider cost, fee, profit, and margin per generation', () => {
  const rows = buildUnitEconomicsRows({ catalog, basisSku: 'studio', quantity: 1 });
  const image = rows.find(row => row.sku === 'ec_image_2k');
  const video = rows.find(row => row.sku === 'video_seedance_standard_short');

  assert.equal(image.points, 1);
  assert.equal(image.revenueCny.toFixed(4), '0.2618');
  assert.equal(image.providerCostCny.toFixed(4), '0.0380');
  assert.equal(image.paymentFeeCny.toFixed(4), '0.0079');
  assert.equal(image.profitCny.toFixed(4), '0.2160');
  assert.equal(image.margin.toFixed(4), '0.8249');

  assert.equal(video.points, 62);
  assert.equal(video.revenueCny.toFixed(4), '16.2342');
  assert.equal(video.providerCostCny.toFixed(4), '3.6400');
  assert.equal(video.paymentFeeCny.toFixed(4), '0.4870');
  assert.equal(video.profitCny.toFixed(4), '12.1072');
});

test('gifted points have zero cash revenue and expose their subsidy cost', () => {
  const [image] = buildUnitEconomicsRows({ catalog, featureSkus: ['ec_image_2k'], revenueMode: 'gift' });
  assert.equal(image.revenueCny, 0);
  assert.equal(image.paymentFeeCny, 0);
  assert.equal(image.profitCny, -0.038);
  assert.equal(image.margin, null);
});
