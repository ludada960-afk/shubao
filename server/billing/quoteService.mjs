import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_PREFIX = 'bq1';
const TOKEN_VERSION = 1;
const DEFAULT_TTL_MS = 10 * 60 * 1000;
const QUOTE_FIELDS = Object.freeze([
  'sku',
  'quantity',
  'units',
  'totalUnits',
  'currency',
]);

function normalizeOwnerEmail(value) {
  const ownerEmail = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!ownerEmail || !ownerEmail.includes('@')) throw new TypeError('ownerEmail is invalid');
  return ownerEmail;
}

function positiveSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer`);
  }
  return value;
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be non-empty`);
  return value.trim();
}

function normalizeQuote(value = {}) {
  const quote = {
    sku: nonEmptyString(value.sku, 'sku'),
    quantity: positiveSafeInteger(value.quantity, 'quantity'),
    units: positiveSafeInteger(value.units, 'units'),
    totalUnits: positiveSafeInteger(value.totalUnits, 'totalUnits'),
    currency: nonEmptyString(value.currency, 'currency'),
  };
  if (quote.units * quote.quantity !== quote.totalUnits) {
    throw new TypeError('quote totalUnits must equal units times quantity');
  }
  return quote;
}

function quoteError(code, status, message) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.reQuoteRequired = true;
  error.retryable = false;
  return error;
}

function invalidQuote() {
  return quoteError('BILLING_QUOTE_INVALID', 409, '费用确认已失效，请重新获取费用后再生成');
}

function signature(secret, encodedPayload) {
  return createHmac('sha256', secret)
    .update(`${TOKEN_PREFIX}.${encodedPayload}`)
    .digest('base64url');
}

function parseToken(secret, quoteId) {
  if (typeof quoteId !== 'string' || !quoteId.trim()) {
    throw quoteError('BILLING_QUOTE_REQUIRED', 400, '请先重新获取费用后再生成');
  }
  const parts = quoteId.trim().split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) throw invalidQuote();
  const expected = Buffer.from(signature(secret, parts[1]), 'base64url');
  let actual;
  try {
    actual = Buffer.from(parts[2], 'base64url');
  } catch {
    throw invalidQuote();
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw invalidQuote();

  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw invalidQuote();
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.v !== TOKEN_VERSION) {
    throw invalidQuote();
  }
  return payload;
}

export function createBillingQuoteService({
  secret,
  now = Date.now,
  ttlMs = DEFAULT_TTL_MS,
} = {}) {
  if (!(typeof secret === 'string' && secret.length >= 32) && !Buffer.isBuffer(secret)) {
    throw new TypeError('billing quote secret must contain at least 32 characters');
  }
  if (typeof now !== 'function') throw new TypeError('now must be a function');
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw new TypeError('ttlMs must be a positive safe integer');

  function currentTime() {
    const value = Number(now());
    if (!Number.isFinite(value)) throw new TypeError('now must return a finite timestamp');
    return Math.trunc(value);
  }

  function readFreshQuote({ quoteId, ownerEmail } = {}) {
    const payload = parseToken(secret, quoteId);
    let normalizedPayload;
    try {
      normalizedPayload = {
        ownerEmail: normalizeOwnerEmail(payload.ownerEmail),
        ...normalizeQuote(payload),
        issuedAt: new Date(nonEmptyString(payload.issuedAt, 'issuedAt')).toISOString(),
        expiresAt: new Date(nonEmptyString(payload.expiresAt, 'expiresAt')).toISOString(),
      };
    } catch {
      throw invalidQuote();
    }
    const issuedAtMs = Date.parse(normalizedPayload.issuedAt);
    const expiresAtMs = Date.parse(normalizedPayload.expiresAt);
    if (!Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs) || expiresAtMs <= issuedAtMs) {
      throw invalidQuote();
    }
    if (currentTime() >= expiresAtMs) {
      throw quoteError('BILLING_QUOTE_EXPIRED', 409, '费用确认已过期，请重新获取费用后再生成');
    }
    if (normalizedPayload.ownerEmail !== normalizeOwnerEmail(ownerEmail)) {
      throw quoteError('BILLING_QUOTE_MISMATCH', 409, '当前生成方案与费用确认不一致，请重新获取费用');
    }
    return {
      quoteId: quoteId.trim(),
      ...normalizedPayload,
    };
  }

  return {
    issue({ ownerEmail, quote } = {}) {
      const normalizedOwner = normalizeOwnerEmail(ownerEmail);
      const normalizedQuote = normalizeQuote(quote);
      const issuedAtMs = currentTime();
      const expiresAtMs = issuedAtMs + ttlMs;
      if (!Number.isSafeInteger(expiresAtMs)) throw new RangeError('quote expiry must be a safe timestamp');
      const payload = {
        v: TOKEN_VERSION,
        ownerEmail: normalizedOwner,
        ...normalizedQuote,
        issuedAt: new Date(issuedAtMs).toISOString(),
        expiresAt: new Date(expiresAtMs).toISOString(),
      };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      return {
        quoteId: `${TOKEN_PREFIX}.${encodedPayload}.${signature(secret, encodedPayload)}`,
        expiresAt: payload.expiresAt,
      };
    },

    verifyFresh({ quoteId, ownerEmail } = {}) {
      return readFreshQuote({ quoteId, ownerEmail });
    },

    verify({ quoteId, ownerEmail, expectedQuote } = {}) {
      const fresh = readFreshQuote({ quoteId, ownerEmail });
      const normalizedExpected = normalizeQuote(expectedQuote);
      const mismatched = QUOTE_FIELDS.some(field => fresh[field] !== normalizedExpected[field]);
      if (mismatched) {
        throw quoteError('BILLING_QUOTE_MISMATCH', 409, '当前生成方案与费用确认不一致，请重新获取费用');
      }
      return fresh;
    },
  };
}
