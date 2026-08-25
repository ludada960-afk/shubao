import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import Database from 'better-sqlite3';
import express from 'express';

import { ensureAccessSchema, bootstrapDefaultAccountAccess, requireAccountAccess } from '../server/accessControl.mjs';
import { ensureAuthSchema, migrateAccountAccessToAuthUsers } from '../server/auth/authSchema.mjs';
import { createAuthService } from '../server/auth/authService.mjs';
import { mountAuthRoutes } from '../server/authRoutes.mjs';

const SECRET = 'p1-auth-foundation-secret-p1-auth-foundation-secret-32+';

async function createHarness(t) {
  const db = new Database(':memory:');
  ensureAccessSchema(db);
  bootstrapDefaultAccountAccess(db);
  ensureAuthSchema(db);
  migrateAccountAccessToAuthUsers(db);
  let clock = Date.parse('2026-08-25T00:00:00.000Z');
  const authService = createAuthService({ db, secret: SECRET, now: () => clock });
  const app = express();
  app.use(express.json());
  mountAuthRoutes(app, {
    authService,
    requireAccess: email => requireAccountAccess(db, email),
    mailer: {
      canSend: () => true,
      sendVerificationCodeMail: async () => {},
      sendPasswordResetMail: async () => {},
    },
  });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
  });
  return { db, authService, baseUrl, advance: ms => { clock += ms; }, clock: () => clock };
}

async function postJson(baseUrl, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('access token lives 30 minutes and carries jti bound to a revocable session', async t => {
  const harness = await createHarness(t);
  const { authService, clock } = harness;
  const session = authService.issueSession('867550189@qq.com');
  assert.equal(new Date(session.accessExpiresAt).getTime() - clock(), 30 * 60 * 1000);
  const verified = authService.verifyAccessToken(session.accessToken);
  assert.ok(verified.jti, 'access token 必须携带 jti');
  const row = harness.db.prepare('SELECT * FROM auth_sessions WHERE jti = ?').get(verified.jti);
  assert.ok(row, '会话必须入库可吊销');
  assert.equal(row.revoked_at, null);

  harness.advance(31 * 60 * 1000);
  assert.throws(
    () => authService.verifyAccessToken(session.accessToken),
    error => error.code === 'AUTH_SESSION_EXPIRED',
  );
});

test('refresh rotation is mandatory and replaying an old refresh token revokes the whole family', async t => {
  const harness = await createHarness(t);
  const { authService, db } = harness;
  const original = authService.issueSession('867550189@qq.com');

  const first = await postJson(harness.baseUrl, '/api/auth/refresh', { refreshToken: original.refreshToken });
  assert.equal(first.status, 200);
  assert.notEqual(first.body.refreshToken, original.refreshToken, '刷新必须轮换 refresh token');

  const second = await postJson(harness.baseUrl, '/api/auth/refresh', { refreshToken: first.body.refreshToken });
  assert.equal(second.status, 200);

  // 重放第一代 refresh token → family 全部吊销
  const replay = await postJson(harness.baseUrl, '/api/auth/refresh', { refreshToken: original.refreshToken });
  assert.equal(replay.status, 401);
  assert.equal(replay.body.code, 'AUTH_SESSION_REPLAY');

  const revokedRows = db.prepare(
    'SELECT COUNT(*) AS c FROM auth_sessions WHERE family_id = (SELECT family_id FROM auth_sessions LIMIT 1) AND revoked_at IS NOT NULL',
  ).get().c;
  assert.ok(revokedRows >= 1, 'family 内会话必须带 revoked_at');

  // 家族内最新 token 也已死亡
  const latestReplay = await postJson(harness.baseUrl, '/api/auth/refresh', { refreshToken: second.body.refreshToken });
  assert.equal(latestReplay.status, 401);
  // v2 access token 同步失效（吊销检查走 DB）
  const login = await postJson(harness.baseUrl, '/api/auth/login', { email: '867550189@qq.com', password: 'x' });
  assert.equal(login.status, 401);
});

test('remember-me extends refresh lifetime from 7 days to 90 days', async t => {
  const harness = await createHarness(t);
  const { authService, db } = harness;
  const plain = authService.issueSession('867550189@qq.com');
  const remembered = authService.issueSession('240485042@qq.com', { remember: true });

  const plainRow = db.prepare('SELECT remember, expires_at FROM auth_sessions WHERE jti = ?')
    .get(authService.verifyAccessToken(plain.accessToken).jti);
  const rememberedRow = db.prepare('SELECT remember, expires_at FROM auth_sessions WHERE jti = ?')
    .get(authService.verifyAccessToken(remembered.accessToken).jti);
  assert.equal(plainRow.remember, 0);
  assert.equal(rememberedRow.remember, 1);
  const nowMs = harness.clock();
  const plainDays = (Date.parse(plainRow.expires_at) - nowMs) / 86400000;
  const rememberedDays = (Date.parse(rememberedRow.expires_at) - nowMs) / 86400000;
  assert.ok(Math.abs(plainDays - 7) < 0.01, `默认 refresh 应为 7 天，实际 ${plainDays}`);
  assert.ok(Math.abs(rememberedDays - 90) < 0.01, `记住我 refresh 应为 90 天，实际 ${rememberedDays}`);

  // 记住我会话轮换后仍保持 90 天窗口
  const rotated = authService.rotateRefreshToken(remembered.refreshToken, {});
  const afterRotate = db.prepare('SELECT expires_at FROM auth_sessions WHERE jti = ?')
    .get(authService.verifyAccessToken(rotated.accessToken).jti);
  assert.ok((Date.parse(afterRotate.expires_at) - harness.clock()) / 86400000 > 89);
});

test('logout revokes the session and its access token immediately', async t => {
  const harness = await createHarness(t);
  const { authService } = harness;
  const session = authService.issueSession('867550189@qq.com');
  const loggedOut = await postJson(harness.baseUrl, '/api/auth/logout', { refreshToken: session.refreshToken });
  assert.equal(loggedOut.status, 200);
  assert.equal(loggedOut.body.revoked, 1);
  assert.throws(
    () => authService.verifyAccessToken(session.accessToken),
    error => error.code === 'AUTH_SESSION_REVOKED',
  );
});