import test from 'node:test';
import assert from 'node:assert/strict';
import { FEATURE_SKUS, PRODUCTS, getProduct, quoteFeature, assertContributionMargin } from '../server/billing/catalog.mjs';

test('client cannot choose the price or grant amount', () => {
  const product = getProduct('ec_starter_29');
  assert.deepEqual(product, { sku: 'ec_starter_29', priceFen: 2900, currency: 'ec_points', grantUnits: 105000, validityDays: null });

  product.priceFen = 1;
  product.grantUnits = 1;
  assert.equal(getProduct('ec_starter_29').priceFen, 2900);
  assert.equal(getProduct('ec_starter_29').grantUnits, 105000);
});

test('exported catalog entries cannot be mutated by callers', () => {
  assert.equal(Object.isFrozen(PRODUCTS), true);
  assert.equal(Object.isFrozen(PRODUCTS.ec_starter_29), true);
  assert.equal(Object.isFrozen(FEATURE_SKUS), true);
  assert.equal(Object.isFrozen(FEATURE_SKUS.ec_image_2k), true);
  assert.throws(() => { PRODUCTS.ec_starter_29.priceFen = 1; }, TypeError);
  assert.throws(() => { FEATURE_SKUS.ec_image_2k.units = 1; }, TypeError);
});

test('quotes ecommerce outputs from server feature weights', () => {
  assert.equal(quoteFeature('ec_image_2k', 8).totalUnits, 8000);
  assert.equal(quoteFeature('ec_image_4k', 2).totalUnits, 4000);
});

test('disabled features remain quote-ineligible', () => {
  assert.throws(() => quoteFeature('ec_layer_psd', 1), /enabled/i);
});

test('quote quantity must be a positive integer', () => {
  for (const quantity of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => quoteFeature('ec_image_2k', quantity), /quantity/i);
  }
});

test('rejects a feature price below the 70 percent contribution margin gate', () => {
  assert.throws(() => assertContributionMargin({ providerCostCny: 0.0694 }, 0.20), /margin/i);
});

test('accepts a feature price at the 70 percent contribution margin gate', () => {
  assert.ok(Math.abs(assertContributionMargin({ providerCostCny: 0.027 }, 0.1) - 0.7) < 1e-12);
});

test('prices and provider costs must be positive finite numbers', () => {
  for (const unitPriceCny of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => assertContributionMargin({ providerCostCny: 0.01 }, unitPriceCny), /price/i);
  }
  for (const providerCostCny of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => assertContributionMargin({ providerCostCny }, 0.1), /cost/i);
  }
});
