import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { PRODUCTS } from '../server/billing/catalog.mjs';
import {
  buildPricingPlans,
  createPricingModalViewState,
  createOrderRequest,
  enabledPaymentProviders,
  transitionPricingModalView,
} from '../src/components/billing/pricingCatalogModel.js';

const PUBLIC_PRODUCTS = Object.values(PRODUCTS).map(({
  providerCostCny: _providerCostCny,
  ...product
}) => product);
const PRICING_EC = [
  { sku: 'ec_trial_990', name: '体验包' },
  { sku: 'ec_starter_29', name: '入门包' },
  { sku: 'ec_growth_79', name: '成长包' },
  { sku: 'ec_studio_199', name: '工作室包' },
];
const PRICING_XHS = [
  { sku: 'xhs_entry_19', name: '入门' },
  { sku: 'xhs_growth_49', name: '进阶' },
  { sku: 'xhs_creator_99', name: '创作者' },
  { sku: 'xhs_studio_199', name: '工作室' },
];

test('authoritative server catalog contains the exact ecommerce permanent point packs', () => {
  assert.deepEqual(
    PUBLIC_PRODUCTS
      .filter(product => product.currency === 'ec_points')
      .map(({ sku, priceFen, grantUnits, validityDays }) => ({
        sku, priceFen, grantUnits, validityDays,
      })),
    [
      { sku: 'ec_trial_990', priceFen: 990, grantUnits: 30000, validityDays: null },
      { sku: 'ec_starter_29', priceFen: 2900, grantUnits: 105000, validityDays: null },
      { sku: 'ec_growth_79', priceFen: 7900, grantUnits: 295000, validityDays: null },
      { sku: 'ec_studio_199', priceFen: 19900, grantUnits: 760000, validityDays: null },
    ],
  );
});

test('authoritative server catalog contains the exact Xiaohongshu and Plog packages', () => {
  assert.deepEqual(
    PUBLIC_PRODUCTS
      .filter(product => product.currency === 'content_sets')
      .map(({ sku, priceFen, grantUnits, validityDays }) => ({
        sku, priceFen, grantUnits, validityDays,
      })),
    [
      { sku: 'xhs_entry_19', priceFen: 1900, grantUnits: 3, validityDays: 30 },
      { sku: 'xhs_growth_49', priceFen: 4900, grantUnits: 10, validityDays: 30 },
      { sku: 'xhs_creator_99', priceFen: 9900, grantUnits: 25, validityDays: 30 },
      { sku: 'xhs_studio_199', priceFen: 19900, grantUnits: 60, validityDays: 30 },
    ],
  );
});

test('static pricing metadata contains no trusted price, grant, or validity fields', async () => {
  const source = await fs.readFile(new URL('../src/constants/data.js', import.meta.url), 'utf8');
  const pricingStart = source.indexOf('export const PRICING_XHS');
  const pricingEnd = source.indexOf('/* ═══════ 功能亮点', pricingStart);
  const pricingSource = source.slice(pricingStart, pricingEnd);
  assert.match(pricingSource, /sku\s*:/);
  assert.doesNotMatch(pricingSource, /\b(?:price|priceFen|sets|credits|grantUnits|validityDays|per)\s*:/);
});

test('pricing view model takes price, grants, validity, and enabled state from server data', () => {
  const catalog = {
    products: PUBLIC_PRODUCTS.map(product => (
      product.sku === 'ec_growth_79' ? { ...product, enabled: false } : { ...product, enabled: true }
    )),
    paymentProviders: [],
  };

  assert.deepEqual(
    buildPricingPlans(catalog, PRICING_EC, 'ec_points').map(plan => ({
      sku: plan.sku,
      priceFen: plan.priceFen,
      grantUnits: plan.grantUnits,
      validityDays: plan.validityDays,
      enabled: plan.enabled,
    })),
    [
      { sku: 'ec_trial_990', priceFen: 990, grantUnits: 30000, validityDays: null, enabled: true },
      { sku: 'ec_starter_29', priceFen: 2900, grantUnits: 105000, validityDays: null, enabled: true },
      { sku: 'ec_growth_79', priceFen: 7900, grantUnits: 295000, validityDays: null, enabled: false },
      { sku: 'ec_studio_199', priceFen: 19900, grantUnits: 760000, validityDays: null, enabled: true },
    ],
  );
});

test('interrupted pricing flow opens full plans and returns without clearing pending work', () => {
  const pendingAction = { id: 'pending-1', source: 'ecommerce' };
  const initial = createPricingModalViewState({
    interrupted: true,
    pendingAction,
    priceReason: 'INSUFFICIENT_CREDITS',
  });
  assert.deepEqual(initial, {
    mode: 'insufficient',
    interrupted: true,
    pendingAction,
    priceReason: 'INSUFFICIENT_CREDITS',
  });

  const plans = transitionPricingModalView(initial, 'VIEW_PLANS');
  assert.equal(plans.mode, 'plans');
  assert.equal(plans.pendingAction, pendingAction);
  assert.equal(plans.priceReason, 'INSUFFICIENT_CREDITS');

  const returned = transitionPricingModalView(plans, 'RETURN_TO_INSUFFICIENT');
  assert.equal(returned.mode, 'insufficient');
  assert.equal(returned.pendingAction, pendingAction);
  assert.equal(returned.priceReason, 'INSUFFICIENT_CREDITS');
});

test('interrupted plan browser exposes all four authoritative content packages and validity', () => {
  const modal = transitionPricingModalView(createPricingModalViewState({
    interrupted: true,
    pendingAction: { id: 'pending-content' },
    priceReason: 'INSUFFICIENT_CREDITS',
  }), 'VIEW_PLANS');
  assert.equal(modal.mode, 'plans');

  assert.deepEqual(
    buildPricingPlans({ products: PUBLIC_PRODUCTS }, PRICING_XHS, 'content_sets')
      .map(plan => ({
        sku: plan.sku,
        priceFen: plan.priceFen,
        grantUnits: plan.grantUnits,
        validityDays: plan.validityDays,
      })),
    [
      { sku: 'xhs_entry_19', priceFen: 1900, grantUnits: 3, validityDays: 30 },
      { sku: 'xhs_growth_49', priceFen: 4900, grantUnits: 10, validityDays: 30 },
      { sku: 'xhs_creator_99', priceFen: 9900, grantUnits: 25, validityDays: 30 },
      { sku: 'xhs_studio_199', priceFen: 19900, grantUnits: 60, validityDays: 30 },
    ],
  );
});

test('enabled payment providers expose only safe public identifiers', () => {
  assert.deepEqual(enabledPaymentProviders({
    paymentProviders: [
      { id: 'testpay', enabled: true, secret: 'must-not-leak', url: 'https://private.invalid' },
      { id: 'disabled', enabled: false },
    ],
  }), [{ id: 'testpay', enabled: true }]);
  assert.deepEqual(enabledPaymentProviders({ paymentProviders: [] }), []);
});

test('secure order request contains exactly trusted identifiers and a standards UUID fallback', () => {
  const cryptoFallback = {
    getRandomValues(bytes) {
      bytes.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
      return bytes;
    },
  };
  const payload = createOrderRequest({
    productSku: 'ec_starter_29',
    provider: 'testpay',
    amount: 0.01,
    price: 0.01,
    sets: 999,
    credits: 999,
    email: 'attacker@example.com',
  }, cryptoFallback);

  assert.deepEqual(Object.keys(payload).sort(), ['idempotencyKey', 'productSku', 'provider']);
  assert.equal(payload.productSku, 'ec_starter_29');
  assert.equal(payload.provider, 'testpay');
  assert.match(payload.idempotencyKey, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
