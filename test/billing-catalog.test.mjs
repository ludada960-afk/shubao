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

test('catalog lookups reject inherited prototype keys', () => {
  for (const sku of ['toString', '__proto__', 'constructor']) {
    assert.throws(() => getProduct(sku), /unknown product sku/i);
    assert.throws(() => quoteFeature(sku, 1), /unknown feature sku/i);
  }
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

test('quotes an explicit design-direction refresh as one AI point', () => {
  assert.deepEqual(quoteFeature('ec_direction_refresh', 1), {
    sku: 'ec_direction_refresh',
    quantity: 1,
    units: 1000,
    totalUnits: 1000,
    currency: 'ec_points',
    providerCostCny: 0.05,
  });
});

test('pixel-layer preparation has a server-authoritative quote', () => {
  assert.deepEqual(quoteFeature('ec_layer_psd', 1), {
    sku: 'ec_layer_psd', quantity: 1, units: 3000, totalUnits: 3000,
    currency: 'ec_points', providerCostCny: 0.20,
  });
});

test('quote quantity must be a positive integer', () => {
  for (const quantity of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => quoteFeature('ec_image_2k', quantity), /quantity/i);
  }
});

test('rejects quotes whose total units are not a safe integer', () => {
  assert.throws(
    () => quoteFeature('ec_image_2k', Number.MAX_SAFE_INTEGER),
    /totalUnits.*safe integer/i,
  );
});

test('rejects a feature price below the 70 percent contribution margin gate', () => {
  assert.throws(() => assertContributionMargin({ providerCostCny: 0.0694 }, 0.20), /margin/i);
});

test('accepts a feature price at the 70 percent contribution margin gate', () => {
  assert.ok(Math.abs(assertContributionMargin({ providerCostCny: 0.027 }, 0.1) - 0.7) < 1e-12);
});

test('accepts the exact 70 percent contribution margin boundary', () => {
  assert.doesNotThrow(() => assertContributionMargin({ providerCostCny: 0.5373 }, 1.99));
});

test('rejects a mathematically below-gate margin without micro-yuan rounding', () => {
  assert.throws(() => assertContributionMargin({ providerCostCny: 0.2700004 }, 1), /margin/i);
});

test('accepts a positive provider cost smaller than one micro-yuan', () => {
  assert.doesNotThrow(() => assertContributionMargin({ providerCostCny: 0.0000004 }, 1));
});

test('prices and provider costs must be positive finite numbers', () => {
  for (const unitPriceCny of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => assertContributionMargin({ providerCostCny: 0.01 }, unitPriceCny), /price/i);
  }
  for (const providerCostCny of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => assertContributionMargin({ providerCostCny }, 0.1), /cost/i);
  }
});
