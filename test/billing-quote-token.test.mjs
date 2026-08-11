import assert from 'node:assert/strict';
import test from 'node:test';

import { createBillingQuoteService } from '../server/billing/quoteService.mjs';

const SECRET = 'billing-quote-token-test-secret-billing-quote-token-test-secret';

function quote(overrides = {}) {
  return {
    sku: 'ec_image_2k',
    quantity: 3,
    units: 1000,
    totalUnits: 3000,
    currency: 'ec_points',
    ...overrides,
  };
}

test('issues an owner-bound expiring quote token and verifies the exact accepted quote', () => {
  let now = Date.parse('2026-07-26T00:00:00.000Z');
  const service = createBillingQuoteService({
    secret: SECRET,
    now: () => now,
    ttlMs: 10 * 60 * 1000,
  });

  const issued = service.issue({
    ownerEmail: ' Owner@Example.com ',
    quote: quote(),
  });

  assert.match(issued.quoteId, /^bq1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(issued.expiresAt, '2026-07-26T00:10:00.000Z');
  assert.deepEqual(service.verify({
    quoteId: issued.quoteId,
    ownerEmail: 'owner@example.com',
    expectedQuote: quote(),
  }), {
    quoteId: issued.quoteId,
    ownerEmail: 'owner@example.com',
    sku: 'ec_image_2k',
    quantity: 3,
    units: 1000,
    totalUnits: 3000,
    currency: 'ec_points',
    issuedAt: '2026-07-26T00:00:00.000Z',
    expiresAt: '2026-07-26T00:10:00.000Z',
  });

  now += 1;
  assert.equal(service.verify({
    quoteId: issued.quoteId,
    ownerEmail: ' OWNER@example.com ',
    expectedQuote: quote(),
  }).quoteId, issued.quoteId);
});

test('fails closed for missing, tampered, expired, cross-owner, or mismatched quote tokens', () => {
  let now = Date.parse('2026-07-26T00:00:00.000Z');
  const service = createBillingQuoteService({
    secret: SECRET,
    now: () => now,
    ttlMs: 1000,
  });
  const issued = service.issue({ ownerEmail: 'owner@example.com', quote: quote() });
  const tokenParts = issued.quoteId.split('.');
  const tamperedSignature = `${tokenParts[2].startsWith('A') ? 'B' : 'A'}${tokenParts[2].slice(1)}`;

  const cases = [
    {
      label: 'missing',
      input: { quoteId: '', ownerEmail: 'owner@example.com', expectedQuote: quote() },
      status: 400,
      code: 'BILLING_QUOTE_REQUIRED',
    },
    {
      label: 'tampered',
      input: {
        quoteId: `${tokenParts[0]}.${tokenParts[1]}.${tamperedSignature}`,
        ownerEmail: 'owner@example.com',
        expectedQuote: quote(),
      },
      status: 409,
      code: 'BILLING_QUOTE_INVALID',
    },
    {
      label: 'cross-owner',
      input: { quoteId: issued.quoteId, ownerEmail: 'other@example.com', expectedQuote: quote() },
      status: 409,
      code: 'BILLING_QUOTE_MISMATCH',
    },
    {
      label: 'quantity mismatch',
      input: {
        quoteId: issued.quoteId,
        ownerEmail: 'owner@example.com',
        expectedQuote: quote({ quantity: 4, totalUnits: 4000 }),
      },
      status: 409,
      code: 'BILLING_QUOTE_MISMATCH',
    },
  ];

  for (const entry of cases) {
    assert.throws(
      () => service.verify(entry.input),
      error => {
        assert.equal(error?.status, entry.status, entry.label);
        assert.equal(error?.code, entry.code, entry.label);
        assert.equal(error?.reQuoteRequired, true, entry.label);
        assert.match(error?.message || '', /重新获取费用|重新报价/);
        return true;
      },
    );
  }

  now += 1001;
  assert.throws(
    () => service.verify({
      quoteId: issued.quoteId,
      ownerEmail: 'owner@example.com',
      expectedQuote: quote(),
    }),
    error => error?.status === 409
      && error?.code === 'BILLING_QUOTE_EXPIRED'
      && error?.reQuoteRequired === true,
  );
});

test('preflight verifies quote ownership and freshness without accepting the final generation plan', () => {
  let now = Date.parse('2026-08-12T00:00:00.000Z');
  const service = createBillingQuoteService({
    secret: SECRET,
    now: () => now,
    ttlMs: 1000,
  });
  const issued = service.issue({ ownerEmail: 'owner@example.com', quote: quote() });

  assert.equal(service.verifyFresh({
    quoteId: issued.quoteId,
    ownerEmail: 'OWNER@example.com',
  }).quoteId, issued.quoteId);

  assert.throws(
    () => service.verifyFresh({ quoteId: issued.quoteId, ownerEmail: 'other@example.com' }),
    error => error?.code === 'BILLING_QUOTE_MISMATCH' && error?.status === 409,
  );

  now += 1001;
  assert.throws(
    () => service.verifyFresh({ quoteId: issued.quoteId, ownerEmail: 'owner@example.com' }),
    error => error?.code === 'BILLING_QUOTE_EXPIRED' && error?.status === 409,
  );
});
