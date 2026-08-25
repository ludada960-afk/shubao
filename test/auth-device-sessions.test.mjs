/**
 * P2 设备管理：GET /api/auth/sessions 列表 + DELETE 吊销单设备
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import Database from 'better-sqlite3';
import express from 'express';

import { ensureAccessSchema, bootstrapDefaultAccountAccess, requireAccountAccess } from '../server/accessControl.mjs';
import { ensureAuthSchema, migrateAccountAccessToAuthUsers } from '../server/auth/authSchema.mjs';
import { createAuthService } from '../server/auth/authService.mjs';
import { mountAuthRoutes } from '../server/authRoutes.mjs';

const SECRET = 'p2-devices-secret-p2-devices-secret-32+';

async function createHarness(t) {
  const db = new Database(':memory:');
  ensureAccessSchema(db);
  bootstrapDefaultAccountAccess(db);
  ensureAuthSchema(db);
  migrateAccountAccessToAuthUsers(db);
  const authService = createAuthService({ db, secret: SECRET });
  const app = express();
  app.use(express.json());
  mountAuthRoutes(app, {
    authService,
    requireAccess: email => requireAccountAccess(db, email),
  });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
  });
  return { db, authService, baseUrl };
}

function bearer(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

test('sessions endpoint requires a bearer token', async t => {
  const h = await createHarness(t);
  const res = await fetch(`${h.baseUrl}/api/auth/sessions`);
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.code, 'AUTH_SESSION_REQUIRED');
});

test('lists only own active sessions and marks the current device', async t => {
  const h = await createHarness(t);
  const web = h.authService.issueSession('867550189@qq.com', { device: 'web-chrome', ip: '10.0.0.2' });
  h.authService.issueSession('867550189@qq.com', { device: 'ios-app', ip: '10.0.0.3' });
  h.authService.issueSession('240485042@qq.com', { device: 'other-user' });

  const res = await fetch(`${h.baseUrl}/api/auth/sessions`, bearer(web.accessToken));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.sessions.length, 2, '只允许看到自己的活跃会话');
  const current = body.sessions.filter(s => s.current);
  assert.equal(current.length, 1);
  assert.equal(current[0].device, 'web-chrome');
  assert.equal(current[0].ip, '10.0.0.2');
  assert.ok(current[0].id);
});

test('delete revokes exactly one own device session', async t => {
  const h = await createHarness(t);
  const web = h.authService.issueSession('867550189@qq.com', { device: 'web' });
  const ios = h.authService.issueSession('867550189@qq.com', { device: 'ios' });
  const iosJti = h.authService.verifyAccessToken(ios.accessToken).jti;

  const del = await fetch(`${h.baseUrl}/api/auth/sessions/${encodeURIComponent(iosJti)}`, {
    method: 'DELETE',
    ...bearer(web.accessToken),
  });
  assert.equal(del.status, 200);
  const body = await del.json();
  assert.equal(body.ok, true);
  assert.equal(body.revoked, 1);

  assert.throws(() => h.authService.verifyAccessToken(ios.accessToken), e => e.code === 'AUTH_SESSION_REVOKED');
  assert.ok(h.authService.verifyAccessToken(web.accessToken), '当前会话不受影响');

  const after = await (await fetch(`${h.baseUrl}/api/auth/sessions`, bearer(web.accessToken))).json();
  assert.equal(after.sessions.length, 1);
  assert.equal(after.sessions[0].current, true);

  const missing = await fetch(`${h.baseUrl}/api/auth/sessions/not-a-jti`, { method: 'DELETE', ...bearer(web.accessToken) });
  assert.equal(missing.status, 404);
});

test("cannot revoke another user's session", async t => {
  const h = await createHarness(t);
  const alice = h.authService.issueSession('867550189@qq.com', { device: 'alice' });
  const bob = h.authService.issueSession('240485042@qq.com', { device: 'bob' });
  const bobJti = h.authService.verifyAccessToken(bob.accessToken).jti;

  const res = await fetch(`${h.baseUrl}/api/auth/sessions/${encodeURIComponent(bobJti)}`, {
    method: 'DELETE',
    ...bearer(alice.accessToken),
  });
  assert.equal(res.status, 404, '跨用户吊销按不存在处理，避免枚举');
  assert.ok(h.authService.verifyAccessToken(bob.accessToken), '目标会话必须仍然有效');
});

test('revoked sessions disappear from the device list and their tokens die', async t => {
  const h = await createHarness(t);
  const a = h.authService.issueSession('867550189@qq.com', { device: 'a' });
  const b = h.authService.issueSession('867550189@qq.com', { device: 'b' });
  h.authService.revokeUserSession(
    h.authService.verifyAccessToken(a.accessToken).userId,
    h.authService.verifyAccessToken(a.accessToken).jti,
  );
  assert.throws(() => h.authService.verifyAccessToken(a.accessToken), e => e.code === 'AUTH_SESSION_REVOKED');
  const list = await (await fetch(`${h.baseUrl}/api/auth/sessions`, bearer(b.accessToken))).json();
  assert.equal(list.sessions.length, 1);
});
