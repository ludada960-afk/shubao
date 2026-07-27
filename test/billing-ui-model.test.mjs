import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import * as billingUiModel from '../src/components/billing/billingUiModel.js';

const {
  formatBalanceDisplay,
  formatBillingUnits,
  formatLedgerEntry,
  getBillingTone,
} = billingUiModel;

const componentSource = (name) => readFileSync(
  new URL(`../src/components/billing/${name}`, import.meta.url),
  'utf8',
);

const priceBadgeSource = componentSource('BillingPriceBadge.jsx');
const balanceCardSource = componentSource('BillingBalanceCard.jsx');
const quoteBreakdownSource = componentSource('BillingQuoteBreakdown.jsx');
const historyListSource = componentSource('BillingHistoryList.jsx');
const insufficientBalanceSource = componentSource('InsufficientBalanceModal.jsx');
const billingStylesSource = componentSource('Billing.module.css');
const allComponentSources = [
  priceBadgeSource,
  balanceCardSource,
  quoteBreakdownSource,
  historyListSource,
].join('\n');

test('formats billing units with the user-facing currency names', () => {
  assert.equal(formatBillingUnits(2500, 'ec_points'), '2.5 AI 积分');
  assert.equal(formatBillingUnits(2, 'content_sets'), '2 创作套数');
});

test('unlimited balance display is visibly non-numeric', () => {
  assert.equal(typeof formatBalanceDisplay, 'function');
  assert.equal(formatBalanceDisplay(0, 'ec_points', true), '不限额度');
  assert.equal(formatBalanceDisplay(999_000, 'ec_points', true), '不限额度');
  assert.equal(formatBalanceDisplay(3, 'content_sets', false), '3 创作套数');
  assert.match(
    insufficientBalanceSource,
    /formatBalanceDisplay\(displayedAvailable,\s*currency,\s*entitlement\?\.unlimited\)/,
  );
});

test('formats ledger entries with a localized label, signed amount, and tone', () => {
  assert.deepEqual(
    formatLedgerEntry({
      eventType: 'grant',
      currency: 'ec_points',
      deltaAvailable: 2000,
      deltaHeld: 0,
    }),
    { label: '赠送', amount: '+2 AI 积分', tone: 'positive' },
  );

  assert.deepEqual(
    formatLedgerEntry({
      eventType: 'settle',
      currency: 'ec_points',
      deltaAvailable: 0,
      deltaHeld: -1000,
    }),
    { label: '结算', amount: '-1 AI 积分', tone: 'negative' },
  );
});

test('maps billing events to restrained presentation tones', () => {
  assert.equal(getBillingTone('grant'), 'positive');
  assert.equal(getBillingTone('refund'), 'positive');
  assert.equal(getBillingTone('hold'), 'warning');
  assert.equal(getBillingTone('settle'), 'negative');
  assert.equal(getBillingTone('unknown-event'), 'neutral');
});

test('balance card exposes an optional user-facing insufficient-balance hint', () => {
  assert.match(balanceCardSource, /insufficient\s*=\s*false/);
  assert.match(balanceCardSource, /insufficientText\s*=\s*['"]当前余额不足，请补充额度后继续['"]/);
  assert.match(balanceCardSource, /className=\{styles\.insufficientHint\}/);
  assert.match(balanceCardSource, /insufficient\s*&&\s*!unlimited/);
  assert.match(billingStylesSource, /\.insufficientHint\s*\{/);
  assert.match(billingStylesSource, /background:\s*#FFF7D6/i);
});

test('billing components retain their key presentation paths', () => {
  assert.match(priceBadgeSource, /formatBillingUnits\(units,\s*currency\)/);
  assert.match(priceBadgeSource, /compact\s*\?\s*styles\.priceBadgeCompact/);

  assert.match(balanceCardSource, /currency="ec_points"/);
  assert.match(balanceCardSource, /currency="content_sets"/);
  assert.match(balanceCardSource, /unlimited\s*\?\s*['"]不限额度['"]/);

  assert.match(quoteBreakdownSource, /formatBillingUnits\(totalUnits,\s*currency\)/);
  assert.match(quoteBreakdownSource, /items\.map\(/);
  assert.match(quoteBreakdownSource, /暂无收费项目/);

  assert.match(historyListSource, /emptyText\s*=\s*['"]暂无积分记录['"]/);
  assert.match(historyListSource, /formatLedgerEntry\(entry\)/);
  assert.match(historyListSource, /tone\$\{formatted\.tone\}/);
});

test('billing components remain pure and side-effect free', () => {
  assert.doesNotMatch(
    allComponentSources,
    /\bfetch\s*\(|localStorage|sessionStorage|useEffect|useState|useContext|navigate\s*\(|window\.location/,
  );
});
