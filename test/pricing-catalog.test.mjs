import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { PRODUCTS } from '../server/billing/catalog.mjs';
import {
  buildPricingPlans,
  buildVideoTiers,
  createPricingModalViewState,
  createOrderRequest,
  enabledPaymentProviders,
  formatPaymentProviderLabel,
  formatCatalogGrant,
  listPaymentChannels,
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
  { sku: 'ec_monthpack_39', name: '月卡礼包 · 轻' },
  { sku: 'ec_monthpack_59', name: '月卡礼包 · Pro', pop: true },
];
const PRICING_XHS = [
  { sku: 'ec_trial_990', name: '体验包' },
  { sku: 'ec_starter_29', name: '入门包' },
  { sku: 'ec_growth_79', name: '成长包' },
  { sku: 'ec_studio_199', name: '工作室包' },
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
      { sku: 'ec_monthpack_39', priceFen: 3900, grantUnits: 175000, validityDays: 30 },
      { sku: 'ec_monthpack_59', priceFen: 5900, grantUnits: 270000, validityDays: 30 },
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
      // 2026-08-26 §6 #8 XHS studio 60→50 套（-20% effective uplift, 60 天老客保护期 xhsLegacyProtection.mjs）
      { sku: 'xhs_studio_199', priceFen: 19900, grantUnits: 50, validityDays: 30 },
    ],
  );
});

test('static pricing metadata contains no trusted price, grant, or validity fields', async () => {
  const source = await fs.readFile(new URL('../src/constants/data.js', import.meta.url), 'utf8');
  const pricingStart = source.indexOf('export const PRICING_PLANS');
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
      { sku: 'ec_monthpack_39', priceFen: 3900, grantUnits: 175000, validityDays: 30, enabled: true },
      { sku: 'ec_monthpack_59', priceFen: 5900, grantUnits: 270000, validityDays: 30, enabled: true },
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

test('interrupted plan browser exposes the shared ecommerce-point packages', () => {
  const modal = transitionPricingModalView(createPricingModalViewState({
    interrupted: true,
    pendingAction: { id: 'pending-content' },
    priceReason: 'INSUFFICIENT_CREDITS',
  }), 'VIEW_PLANS');
  assert.equal(modal.mode, 'plans');

  assert.deepEqual(
    buildPricingPlans({ products: PUBLIC_PRODUCTS }, PRICING_XHS, 'ec_points')
      .map(plan => ({
        sku: plan.sku,
        priceFen: plan.priceFen,
        grantUnits: plan.grantUnits,
        validityDays: plan.validityDays,
      })),
    [
      { sku: 'ec_trial_990', priceFen: 990, grantUnits: 30000, validityDays: null },
      { sku: 'ec_starter_29', priceFen: 2900, grantUnits: 105000, validityDays: null },
      { sku: 'ec_growth_79', priceFen: 7900, grantUnits: 295000, validityDays: null },
      { sku: 'ec_studio_199', priceFen: 19900, grantUnits: 760000, validityDays: null },
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

test('payment provider ids map to user-facing channel labels', () => {
  assert.equal(formatPaymentProviderLabel('wechat'), '微信支付');
  assert.equal(formatPaymentProviderLabel('wechat_pay'), '微信支付');
  assert.equal(formatPaymentProviderLabel('alipay'), '支付宝');
  assert.equal(formatPaymentProviderLabel('internal-provider'), '在线支付');
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
test('prepaid month packs expose their gift units to the pricing view', () => {
  const catalog = { products: PUBLIC_PRODUCTS.map(product => ({ ...product, enabled: true })), paymentProviders: [] };
  const plans = buildPricingPlans(catalog, PRICING_EC, 'ec_points');
  const lightPack = plans.find(plan => plan.sku === 'ec_monthpack_39');
  const proPack = plans.find(plan => plan.sku === 'ec_monthpack_59');
  assert.equal(lightPack.giftUnits, 25000);
  assert.equal(proPack.giftUnits, 40000);
  assert.match(formatCatalogGrant(lightPack), /175 AI 积分（含赠 25）/);
  assert.match(formatCatalogGrant(proPack), /270 AI 积分（含赠 40）/);
  // 常规包没有赠分字段，展示保持原样。
  const starter = plans.find(plan => plan.sku === 'ec_starter_29');
  assert.equal(starter.giftUnits, null);
  assert.equal(formatCatalogGrant(starter), '105 AI 积分');
});

test('pricing page video tiers mirror the approved catalog anchors exactly', () => {
  // 页面契约：五档零售价、积分与上架状态必须与 server 目录逐值一致，防止双源漂移。
  const tiers = buildVideoTiers({ features: [] });
  assert.deepEqual(tiers.map(tier => [tier.eyebrow, tier.name, tier.available]), [
    ['FAST', '快试', false],
    ['STANDARD', '标准', false],
    ['PREMIUM', '高品质', false],
    ['FULL HD', '1080P', false],
    ['H3 · 2K', 'H3 2K 精制', false],
  ]);

  const liveTiers = buildVideoTiers({
    features: [
      { sku: 'ec_image_2k', units: 1000 },
      { sku: 'video_seedance_fast_short', units: 27000, priceFen: 690 },
      { sku: 'video_seedance_standard_short', units: 46000, priceFen: 1190 },
      { sku: 'video_seedance_standard_long', units: 57000, priceFen: 1490 },
    ],
  });
  assert.deepEqual(liveTiers.map(tier => [tier.name, tier.available, tier.priceFen, tier.points, tier.imageEquivalent]), [
    ['快试', true, 690, 27, 27],
    ['标准', true, 1190, 46, 46],
    ['高品质', true, 1490, 57, 57],
    ['1080P', false, null, null, null],
    ['H3 2K 精制', false, null, null, null],
  ]);
});

test('payment area renders registry channels without leaking launch switches', () => {
  const channels = listPaymentChannels({
    paymentChannels: [
      { id: 'balance', label: '余额充值', kind: 'internal', status: 'active', enabled: true, description: '当前可用', launchEnv: 'PAYMENT_CHANNEL_BALANCE_X' },
      { id: 'wechat_qr', status: 'unavailable', enabled: false, availabilityNote: '即将开通' },
      { id: '../evil', enabled: true },
    ],
  });
  assert.deepEqual(channels.map(channel => [channel.id, channel.label, channel.status]), [
    ['balance', '余额充值', 'active'],
    ['wechat_qr', '微信支付', 'unavailable'],
  ]);
  assert.equal(channels[0].description, '当前可用');
  assert.equal(channels[1].availabilityNote, '即将开通');
  assert.deepEqual(listPaymentChannels({}), []);
});