import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatBillingUnits,
  formatLedgerEntry,
  getBillingTone,
} from '../src/components/billing/billingUiModel.js';

test('formats billing units with the user-facing currency names', () => {
  assert.equal(formatBillingUnits(2500, 'ec_points'), '2.5 AI 积分');
  assert.equal(formatBillingUnits(2, 'content_sets'), '2 创作套数');
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
