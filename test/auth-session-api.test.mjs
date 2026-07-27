import assert from 'node:assert/strict';
import test from 'node:test';
import { createSessionTokenService } from '../server/billing/contentBilling.mjs';
import { createSessionHandler } from '../server/projects/projectRoutes.mjs';

const SESSION_SECRET = 'session-api-test-secret-session-api-test-secret-session';

test('session handler returns a market-facing invalid-session response for expired tokens', () => {
  let now = Date.parse('2026-07-27T10:00:00.000Z');
  const sessionTokens = createSessionTokenService({ secret: SESSION_SECRET, now: () => now, ttlMs: 1_000 });
  const token = sessionTokens.issue('owner@example.com').token;
  now += 2_000;
  const handler = createSessionHandler({
    authenticateOwner(request) {
      return sessionTokens.verify(request.headers.authorization.replace(/^Bearer\s+/i, ''));
    },
  });
  const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };

  handler({ headers: { authorization: `Bearer ${token}` } }, response);

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { code: 'AUTH_SESSION_EXPIRED', error: '登录已失效，请重新登录' });
});
