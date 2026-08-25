import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import Database from 'better-sqlite3';
import express from 'express';

import {
  ensureAccessSchema,
  bootstrapDefaultAccountAccess,
  requireAccountAccess,
} from '../server/accessControl.mjs';
import { ensureAuthSchema, migrateAccountAccessToAuthUsers } from '../server/auth/authSchema.mjs';
import { createAuthService, createDualModeSessionTokens, LEGACY_GRACE_MS } from '../server/auth/authService.mjs';
import { createSessionTokenService, authenticateContentRequest } from '../server/billing/contentBilling.mjs';
import { mountAuthRoutes } from '../server/authRoutes.mjs';

const SECRET = 'p1-auth-foundation-secret-p1-auth-foundation-secret-32+';

async function createHarness(t) {
  const db = new Database(':memory:');
  ensureAccessSchema(db);
  bootstrapDefaultAccountAccess(db);
  ensureAuthSchema(db);
  const bridge = migrateAccountAccessToAuthUsers(db);
  let clock = Date.parse('2026-08-25T00:00:00.000Z');
  const legacyTokens = createSessionTokenService({ secret: SECRET, now: () => clock });
  const authService = createAuthService({ db, secret: SECRET, now: () => clock });
  const dual = createDualModeSessionTokens({ authService, legacy: legacyTokens, now: () => clock });
  const app = express();
  app.use(express.json());
  mountAuthRoutes(app, {
    authService,
    requireAccess: email => requireAccountAccess(db, email),
    legacyTokens,
    mailer: { canSend: () => true, sendVerificationCodeMail: async () => {}, sendPasswordResetMail: async () => {} },
  });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
  });
  return { db, authService, legacyTokens, dual, baseUrl, bridge, advance: ms => { clock += ms; }, clock: () => clock };
}

test('legacy HMAC tokens stay valid within the 30-day grace window and mint one replacement session', async t => {
  const harness = await createHarness(t);
  const { authService, legacyTokens, dual } = harness;

  // 存量客户端持有的 HMAC token（无 jti、无 DB 行）
  const issuedAt = harness.clock();
  const legacyToken = legacyTokens.issue('867550189@qq.com').token;
  assert.equal(new Date(legacyTokens.issue('867550189@qq.com').expiresAt).getTime() - issuedAt, 7 * 86400000);

  const req = { headers: { authorization: `Bearer ${legacyToken}` }, body: {} };
  const resolvedEmail = authenticateContentRequest(req, {
    sessionTokens: dual,
    authorizeEmail: email => requireAccountAccess(harness.db, email),
  });
  assert.equal(resolvedEmail, '867550189@qq.com');
  assert.ok(req._sessionRenewal?.accessToken, 'legacy 命中即换发新 session（响应旁路）');
  assert.ok(req._sessionRenewal.refreshToken);

  // 换发的 session 真实入库、可独立验证
  const renewalVerify = authService.verifyAccessToken(req._sessionRenewal.accessToken);
  assert.equal(renewalVerify.email, '867550189@qq.com');
  const row = harness.db.prepare('SELECT device FROM auth_sessions WHERE jti = ?').get(renewalVerify.jti);
  assert.equal(row.device, 'legacy-migration');

  // 同一 legacy token 只换发一次
  const secondReq = { headers: { authorization: `Bearer ${legacyToken}` }, body: {} };
  authenticateContentRequest(secondReq, {
    sessionTokens: dual,
    authorizeEmail: email => requireAccountAccess(harness.db, email),
  });
  assert.equal(secondReq._sessionRenewal, undefined, '同一 legacy token 不重复换发');

  // 宽限期内 v2 会话吊销不会被 legacy 分支“洗白”
  const v2 = authService.issueSession('240485042@qq.com');
  authService.revokeAllUserSessions(authService.getUserByEmail('240485042@qq.com').id);
  assert.throws(
    () => dual.verify(v2.accessToken),
    error => error.code === 'AUTH_SESSION_REVOKED',
  );
});

test('legacy acceptance ends after the 30-day grace window', async t => {
  const harness = await createHarness(t);
  const { legacyTokens, dual, advance } = harness;
  const legacyToken = legacyTokens.issue('867550189@qq.com').token;
  assert.equal(LEGACY_GRACE_MS, 30 * 24 * 60 * 60 * 1000);
  advance(31 * 24 * 60 * 60 * 1000);
  assert.throws(
    () => dual.verify(legacyToken),
    error => error.code === 'AUTH_SESSION_INVALID',
    '宽限期结束后 legacy 分支必须关闭',
  );
});

test('exchange endpoint swaps a legacy token for a fresh revocable session', async t => {
  const harness = await createHarness(t);
  const { authService, legacyTokens, baseUrl } = harness;
  const legacyToken = legacyTokens.issue('867550189@qq.com').token;
  const res = await fetch(`${baseUrl}/api/auth/session/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: legacyToken }),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.email, '867550189@qq.com');
  assert.ok(body.refreshToken);
  const verified = authService.verifyAccessToken(body.token);
  assert.equal(verified.email, '867550189@qq.com');
  // 换发后的会话可被 logout 吊销（服务端会话语义完整）
  const out = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: body.refreshToken }),
  });
  assert.equal((await out.json()).revoked, 1);
  assert.throws(
    () => authService.verifyAccessToken(body.token),
    error => error.code === 'AUTH_SESSION_REVOKED',
  );
});

test('account_access → auth_users bridge migration is idempotent and keeps admin roles', async t => {
  const harness = await createHarness(t);
  const { db, bridge } = harness;
  assert.equal(bridge.applied, true);
  assert.ok(bridge.bridged >= 2);
  const firstCount = db.prepare('SELECT COUNT(*) AS c FROM auth_users').get().c;
  assert.equal(db.prepare("SELECT role FROM auth_users WHERE primary_email = '867550189@qq.com'").get().role, 'owner');
  assert.equal(db.prepare("SELECT role FROM auth_users WHERE primary_email = '240485042@qq.com'").get().role, 'tester');
  assert.ok(db.prepare("SELECT 1 FROM access_migrations WHERE id = 'auth-users-bridge-v1'").get());

  // 重跑：幂等，不再新增行
  const rerun = migrateAccountAccessToAuthUsers(db);
  assert.deepEqual(rerun, { applied: false, migrationId: 'auth-users-bridge-v1', bridged: 0 });
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM auth_users').get().c, firstCount);

  // 新增账号后以新迁移 ID 再桥接：只补增量
  db.prepare(`
    INSERT INTO account_access (email, role, status, created_by)
    VALUES ('fresh-admin@example.com', 'admin', 'active', 'test')
  `).run();
  const incremental = migrateAccountAccessToAuthUsers(db, { migrationId: 'auth-users-bridge-v2-test' });
  assert.equal(incremental.applied, true);
  assert.equal(incremental.bridged, 1);
  assert.equal(
    db.prepare("SELECT role FROM auth_users WHERE primary_email = 'fresh-admin@example.com'").get().role,
    'admin',
    'owner/admin 角色必须作为管理员标记带入 auth_users',
  );
});

test('index.mjs guard no longer trusts body email on unsigned guarded routes', async () => {
  const source = await readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('function betaAccessMiddleware');
  assert.notEqual(start, -1);
  const openingBrace = source.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') { depth -= 1; if (depth === 0) { end = index; break; } }
  }
  const declaration = source.slice(start, end + 1);
  const middleware = new Function(
    'CONTENT_PREVIEW_ROUTES',
    'SIGNED_GENERATION_ROUTES',
    'authenticateContentRequest',
    'contentSessionTokens',
    'authorizeAccountEmail',
    'getGenerationRouteFeature',
    'requireFeatureAccess',
    'db',
    'contentBillingHttpError',
    'normalizeGuardedPath',
    `${declaration}; return betaAccessMiddleware;`,
  )(
    new Set(),
    new Set(),
    () => {
      throw Object.assign(new Error('signed session required'), { code: 'AUTH_SESSION_REQUIRED' });
    },
    {},
    () => {
      throw new Error('authorizeAccountEmail must never be consulted for body email authority');
    },
    () => null,
    () => ({ ok: true }),
    {},
    error => ({ status: 401, body: { error: error.message, code: error.code } }),
    path => path,
  );
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let downstream = 0;
  middleware(
    { method: 'POST', path: '/api/generate', body: { email: 'spoofed@example.com' }, headers: {} },
    response,
    () => { downstream += 1; },
    '/api/generate',
  );
  assert.equal(response.statusCode, 401, '/api/generate 必须要求签名会话');
  assert.equal(response.body.code, 'AUTH_SESSION_REQUIRED');
  assert.equal(downstream, 0);
});
