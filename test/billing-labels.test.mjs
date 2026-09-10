import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBillingRules, buildLedgerTransactions, skuLabel } from '../server/billing/billingLabels.mjs';
import { FEATURE_SKUS } from '../server/billing/catalog.mjs';

test('every public feature SKU has a Chinese label and lands in the rules catalog', () => {
  const rules = buildBillingRules();
  const labeled = new Set(rules.flatMap(group => group.items.map(item => item.sku)));
  for (const [sku, feature] of Object.entries(FEATURE_SKUS)) {
    if (feature.public === false) continue;
    assert.ok(labeled.has(sku), `SKU ${sku} missing from billing rules`);
    assert.ok(skuLabel(sku), `SKU ${sku} missing Chinese label`);
  }
  const categories = new Set(rules.map(group => group.key));
  for (const expected of ['image', 'canvas', 'text', 'video', 'content']) {
    assert.ok(categories.has(expected), `billing rules missing category ${expected}`);
  }
});

test('new coverage SKUs exist (2026-09-10 audit)', () => {
  for (const sku of ['ec_direction_analysis', 'ec_canvas_recognize', 'ec_preview_cover']) {
    assert.ok(FEATURE_SKUS[sku], `missing audit SKU ${sku}`);
    assert.ok(skuLabel(sku), `missing label for ${sku}`);
  }
  assert.equal(FEATURE_SKUS.ec_direction_analysis.units, 1000);
  assert.equal(FEATURE_SKUS.ec_canvas_recognize.units, 200);
  assert.equal(FEATURE_SKUS.ec_preview_cover.units, 500);
});

function ledgerRow(overrides = {}) {
  return {
    id: overrides.id || 'row',
    eventType: overrides.eventType || 'settle',
    referenceType: overrides.referenceType || '',
    referenceId: overrides.referenceId || '',
    idempotencyKey: overrides.idempotencyKey || '',
    deltaAvailable: overrides.deltaAvailable ?? 0,
    deltaHeld: overrides.deltaHeld ?? 0,
    balanceAvailable: overrides.balanceAvailable ?? 0,
    createdAt: overrides.createdAt || '2026-09-10T00:00:00Z',
    metadata: overrides.metadata || {},
  };
}

const holdMeta = (items, action) => ({
  _walletService: { fingerprint: JSON.stringify({ idempotencyKey: 'k', items, metadata: { action } }) },
});

test('ledger transactions: hold+settle collapse into one labeled spend, +0 settle rows never shown', () => {
  const entries = [
    ledgerRow({ id: 'h1', eventType: 'hold', idempotencyKey: 'ec-hold:task1', referenceId: 'hold-1', deltaAvailable: -3000, deltaHeld: 3000, balanceAvailable: 97000, metadata: holdMeta([{ key: 'main-text', sku: 'ec_image_2k', units: 1000 }], undefined) }),
    ledgerRow({ id: 's1', eventType: 'settle', deltaHeld: -1000, metadata: { _walletService: { fingerprint: JSON.stringify({ holdId: 'hold-1', itemKey: 'main-text', metadata: {} }) } } }),
    ledgerRow({ id: 's2', eventType: 'settle', deltaHeld: -2000, metadata: { _walletService: { fingerprint: JSON.stringify({ holdId: 'hold-1', itemKey: 'detail', metadata: {} }) } } }),
    ledgerRow({ id: 'h2', eventType: 'hold', idempotencyKey: 'canvas-hold:a2', referenceId: 'hold-2', deltaAvailable: -200, deltaHeld: 200, balanceAvailable: 96800, metadata: holdMeta([{ key: 'canvas_action', sku: 'ec_ai_assistant', units: 200 }], 'regenerate_canvas_text') }),
  ];
  const transactions = buildLedgerTransactions(entries);
  assert.equal(transactions.length, 2, 'settle rows must not appear as separate transactions');
  const [first, second] = transactions;
  assert.equal(first.label, 'AI 商品图 · 2K', 'single-sku hold uses the precise SKU label');
  assert.equal(first.amount, -3000);
  assert.equal(second.label, '画布文案重写');
  assert.equal(second.amount, -200);
});

test('grants surface as gains with Chinese labels', () => {
  const entries = [
    ledgerRow({ id: 'g1', eventType: 'grant', referenceType: 'redeem', deltaAvailable: 5000, balanceAvailable: 5000, createdAt: '2026-09-10T01:00:00Z' }),
    ledgerRow({ id: 'g2', eventType: 'grant', referenceType: 'admin_grant', deltaAvailable: 100000, balanceAvailable: 105000, createdAt: '2026-09-09T01:00:00Z' }),
  ];
  const transactions = buildLedgerTransactions(entries);
  assert.equal(transactions.length, 2);
  assert.equal(transactions[0].label, '兑换码兑换');
  assert.equal(transactions[0].amount, 5000);
  assert.equal(transactions[1].label, '管理员发放');
});
