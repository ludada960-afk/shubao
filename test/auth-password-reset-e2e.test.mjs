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

async function createHarness(t, { mails = [] } = {}) {
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
      sendVerificationCodeMail: async input => { mails.push(input); },
      sendPasswordResetMail: async input => { mails.push(input); },
    },
  });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
  });
  return { db, authService, baseUrl, mails, advance: ms => { clock += ms; } };
}

async function postJson(baseUrl, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('password reset E2E: request → one-time token → new password → all sessions revoked', async t => {
  const mails = [];
  const harness = await createHarness(t, { mails });
  const { authService, baseUrl } = harness;

  // 先注册一个带密码的用户并登录，产生两个活跃会话
  const sent = await postJson(baseUrl, '/api/auth/send-code', { email: '867550189@qq.com', purpose: 'register' });
  assert.equal(sent.status, 200);
  const registered = await postJson(baseUrl, '/api/auth/register', {
    email: '867550189@qq.com', code: mails[mails.length - 1].code, password: 'old-pass-1234',
  });
  assert.equal(registered.status, 200);
  const sessionA = registered.body;
  const loginAgain = await postJson(baseUrl, '/api/auth/login', { email: '867550189@qq.com', password: 'old-pass-1234' });
  assert.equal(loginAgain.status, 200);

  // 找回密码：邮件送达一次性 reset token
  const forgot = await postJson(baseUrl, '/api/auth/forgot-password', { email: '867550189@qq.com' });
  assert.equal(forgot.status, 200);
  assert.equal(forgot.body.ok, true);
  assert.equal(forgot.body.mock, false, 'SMTP 可用时不得向响应泄露 reset token');
  const resetToken = mails.find(mail => mail.resetToken)?.resetToken;
  assert.ok(resetToken, 'reset token 必须通过邮件通道下发');

  // 未授权/未知邮箱静默成功（防枚举），且不发送任何邮件
  const mailsBefore = mails.length;
  const stealthy = await postJson(baseUrl, '/api/auth/forgot-password', { email: 'stranger@example.com' });
  assert.equal(stealthy.status, 200);
  assert.equal(mails.length, mailsBefore, '未授权邮箱不发邮件');

  // 凭 token 设新密 → 该用户全部会话被吊销
  const reset = await postJson(baseUrl, '/api/auth/reset-password', { token: resetToken, password: 'brand-new-pass-9' });
  assert.equal(reset.status, 200);
  assert.equal(reset.body.ok, true);
  assert.ok(reset.body.sessionsRevoked >= 2, `应吊销全部会话，实际 ${reset.body.sessionsRevoked}`);
  assert.throws(() => authService.verifyAccessToken(sessionA.token), error => error.code === 'AUTH_SESSION_REVOKED');
  assert.throws(() => authService.verifyAccessToken(loginAgain.body.token), error => error.code === 'AUTH_SESSION_REVOKED');

  // 新密码可登录，旧密码被拒
  const oldLogin = await postJson(baseUrl, '/api/auth/login', { email: '867550189@qq.com', password: 'old-pass-1234' });
  assert.equal(oldLogin.status, 401);
  const newLogin = await postJson(baseUrl, '/api/auth/login', { email: '867550189@qq.com', password: 'brand-new-pass-9' });
  assert.equal(newLogin.status, 200);

  // token 一次性：重放失败
  const replay = await postJson(baseUrl, '/api/auth/reset-password', { token: resetToken, password: 'reuse-attack-1' });
  assert.equal(replay.status, 400);
  assert.equal(replay.body.code, 'AUTH_RESET_TOKEN_INVALID');

  // 过期（>15 分钟）失败
  const second = await postJson(baseUrl, '/api/auth/forgot-password', { email: '867550189@qq.com' });
  assert.equal(second.status, 200);
  const secondToken = mails[mails.length - 1].resetToken;
  harness.advance(16 * 60 * 1000);
  const expired = await postJson(baseUrl, '/api/auth/reset-password', {
    token: secondToken, password: 'too-late-pass-1',
  });
  assert.equal(expired.status, 400);
  assert.equal(expired.body.code, 'AUTH_RESET_TOKEN_EXPIRED');
});