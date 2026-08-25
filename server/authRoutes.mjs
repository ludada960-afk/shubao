/**
 * P1 认证底座 — 认证路由（可独立挂载，便于测试）
 *
 * 路由清单：
 *  POST /api/auth/send-code        邮箱验证码（purpose=login|register，DB 化、≤5 次锁定）
 *  POST /api/auth/verify-code      验证码登录 → v2 会话
 *  POST /api/auth/register         验证码注册并首设密码（复用 auth_credentials）
 *  POST /api/auth/login            邮箱 + 密码登录
 *  POST /api/auth/forgot-password  找回密码申请（15 分钟一次性 token，防枚举）
 *  POST /api/auth/reset-password   凭 token 设新密 → 吊销该用户全部会话
 *  POST /api/auth/refresh          refresh 轮换（重放即吊销 family）
 *  POST /api/auth/logout           吊销当前会话
 *  POST /api/auth/session/exchange 存量 HMAC token 换发新会话（30 天宽限期）
 *  P2 账号体系：
 *  GET  /api/auth/providers                    可用第三方登录方式（未配置凭据的不返回）
 *  GET  /api/auth/oauth/:provider/authorize    发起 OAuth（DB 化 state 防 CSRF，单次消费）
 *  GET  /api/auth/oauth/:provider/callback     code→profile→auth_identities upsert→签发会话
 *  GET  /api/auth/sessions                     当前用户在线设备列表
 *  DELETE /api/auth/sessions/:sessionId         吊销单个设备会话
 */
const AUTH_PURPOSES = new Set(['login', 'register']);

function getClientIp(req) {
  return req?.ip || req?.socket?.remoteAddress || 'unknown';
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function sendCoded(res, error, fallbackStatus = 400) {
  const statusByCode = {
    AUTH_PASSWORD_INVALID: 400,
    AUTH_CODE_INVALID: 400,
    AUTH_CODE_EXPIRED: 400,
    AUTH_CODE_LOCKED: 429,
    AUTH_CODE_PURPOSE_INVALID: 400,
    AUTH_RESET_TOKEN_INVALID: 400,
    AUTH_RESET_TOKEN_EXPIRED: 400,
    AUTH_CREDENTIALS_INVALID: 401,
    AUTH_PASSWORD_EXISTS: 409,
    AUTH_SESSION_REQUIRED: 401,
    AUTH_SESSION_INVALID: 401,
    AUTH_SESSION_EXPIRED: 401,
    AUTH_SESSION_REVOKED: 401,
    AUTH_SESSION_REPLAY: 401,
    AUTH_SESSION_UNAUTHORIZED: 403,
    AUTH_PROVIDER_UNAVAILABLE: 404,
    AUTH_PROVIDER_NOT_IMPLEMENTED: 501,
    AUTH_OAUTH_STATE_INVALID: 403,
    AUTH_OAUTH_CALLBACK_INVALID: 400,
    AUTH_OAUTH_PROFILE_INVALID: 502,
    AUTH_OAUTH_UPSTREAM_FAILED: 502,
  };
  const status = statusByCode[error?.code] || fallbackStatus;
  if (status >= 500) console.error('[auth]', error);
  return res.status(status).json({ ok: false, error: error?.message || '认证失败', code: error?.code || 'AUTH_FAILED' });
}

function sessionPayload(session) {
  return {
    ok: true,
    id: session.user.id,
    email: session.user.email,
    nickname: session.user.nickname || session.user.email.split('@')[0],
    token: session.accessToken,
    expiresAt: session.accessExpiresAt,
    refreshToken: session.refreshToken,
    refreshExpiresAt: session.refreshExpiresAt,
  };
}

function safeRedirectTarget(value) {
  const raw = String(value || '/');
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  return raw.slice(0, 300);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

// OAuth 成功页：同源 HTML 引导页把会话写入 localStorage 后跳回应用，
// 避免把 token 放进 URL（历史记录/Referer 泄漏面更大）。?response=json 时返回 JSON。
function renderOauthBootstrapPage(payload, redirectTo) {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  const target = JSON.stringify(redirectTo).replace(/</g, '\\u003c');
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>登录成功，正在返回…</title></head>'
    + '<body style="font-family:system-ui,sans-serif;color:#333;text-align:center;padding-top:18vh">'
    + '<p id="msg">登录成功，正在返回应用…</p>'
    + '<script>'
    + 'try{localStorage.setItem("sb-oauth-payload",' + json + ');}'
    + 'catch(e){document.getElementById("msg").textContent="登录状态保存失败，请关闭后重试";}'
    + 'setTimeout(function(){location.replace(' + target + ');},80);'
    + String.raw`</script></body></html>`;
}

export function mountAuthRoutes(app, {
  authService,
  requireAccess,
  mailer,
  legacyTokens = null,
  providers = null,
  oauthStore = null,
  isProduction = process.env.NODE_ENV === 'production',
} = {}) {
  if (!app || typeof app.post !== 'function') throw new TypeError('app must be an express instance');
  if (typeof authService?.issueSession !== 'function') throw new TypeError('authService is required');
  if (typeof requireAccess !== 'function') throw new TypeError('requireAccess(email) is required');
  const safeMailer = {
    canSend: () => Boolean(mailer?.canSend?.()),
    sendVerificationCodeMail: async input => mailer?.sendVerificationCodeMail?.(input),
    sendPasswordResetMail: async input => mailer?.sendPasswordResetMail?.(input),
  };

  function gateEmail(req, res) {
    const email = normalizeEmail(req.body?.email);
    if (!isEmail(email)) {
      res.status(400).json({ ok: false, error: '请输入正确的邮箱' });
      return null;
    }
    const access = requireAccess(email);
    if (!access?.ok) {
      res.status(access?.status || 403).json({ ok: false, error: access?.error || '当前账号暂时无法使用此功能' });
      return null;
    }
    return access.email;
  }

  // ── 邮箱验证码（登录/注册共用；DB 化存储）──
  app.post('/api/auth/send-code', async (req, res) => {
    const email = gateEmail(req, res);
    if (!email) return undefined;
    const purpose = AUTH_PURPOSES.has(req.body?.purpose) ? req.body.purpose : 'login';
    try {
      const canSend = safeMailer.canSend();
      if (!canSend && isProduction) {
        return res.status(503).json({ ok: false, error: '验证码服务暂时不可用，请稍后再试' });
      }
      const result = await authService.issueEmailCode(email, purpose, {
        code: canSend ? undefined : '123456', // dev mock：与历史行为一致
        deliver: canSend ? code => safeMailer.sendVerificationCodeMail({ to: email, code }) : null,
      });
      return res.json({
        ok: true,
        mock: !canSend,
        reused: Boolean(result.reused),
        retryAfterSeconds: result.retryAfterSeconds ?? 60,
      });
    } catch (error) {
      return sendCoded(res, error);
    }
  });

  app.post('/api/auth/verify-code', async (req, res) => {
    const email = gateEmail(req, res);
    if (!email) return undefined;
    const code = String(req.body?.code || '').trim();
    if (!code) return res.status(400).json({ ok: false, error: '请输入验证码' });
    try {
      authService.consumeEmailCode(email, 'login', code);
      const session = authService.issueSession(email, {
        remember: req.body?.remember === true,
        device: String(req.body?.device || ''),
        ip: getClientIp(req),
      });
      return res.json(sessionPayload(session));
    } catch (error) {
      return sendCoded(res, error);
    }
  });

  // ── 注册：验证码通过后首设密码（复用 auth_credentials 表）──
  app.post('/api/auth/register', async (req, res) => {
    const email = gateEmail(req, res);
    if (!email) return undefined;
    const code = String(req.body?.code || '').trim();
    if (!code) return res.status(400).json({ ok: false, error: '请输入验证码' });
    try {
      authService.consumeEmailCode(email, 'register', code);
      const existing = authService.getUserByEmail(email);
      if (existing && authService.hasCredential(existing.id)) {
        throw Object.assign(new Error('该邮箱已设置密码，请直接登录'), { code: 'AUTH_PASSWORD_EXISTS' });
      }
      const nickname = String(req.body?.nickname || '').trim().slice(0, 64);
      const user = authService.ensureUserByEmail(email, { nickname: nickname || undefined });
      await authService.setPassword(user.id, String(req.body?.password || ''));
      const session = authService.issueSession(user, {
        remember: true,
        device: 'register',
        ip: getClientIp(req),
      });
      return res.json(sessionPayload(session));
    } catch (error) {
      return sendCoded(res, error);
    }
  });

  // ── 密码登录 ──
  app.post('/api/auth/login', async (req, res) => {
    const email = gateEmail(req, res);
    if (!email) return undefined;
    try {
      const user = authService.getUserByEmail(email);
      const hasCredential = user ? authService.hasCredential(user.id) : false;
      let valid = false;
      if (user && hasCredential) {
        valid = await authService.verifyPassword(user.id, String(req.body?.password ?? ''));
      } else {
        // 无凭据时也做一次等价 scrypt 校验成本外的空跑，弱化用户枚举计时信号。
        await authService.verifyPassword(-1, '');
      }
      if (!valid) {
        throw Object.assign(new Error('邮箱或密码不正确'), { code: 'AUTH_CREDENTIALS_INVALID' });
      }
      const session = authService.issueSession(user, {
        remember: req.body?.remember === true,
        device: String(req.body?.device || ''),
        ip: getClientIp(req),
      });
      return res.json(sessionPayload(session));
    } catch (error) {
      return sendCoded(res, error, error?.code === 'AUTH_CREDENTIALS_INVALID' ? 401 : 400);
    }
  });

  // ── 找回密码：邮件发送一次性 reset token（15 分钟），响应恒定防枚举 ──
  app.post('/api/auth/forgot-password', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!isEmail(email)) return res.status(400).json({ ok: false, error: '请输入正确的邮箱' });
    const access = requireAccess(email);
    const canSend = safeMailer.canSend();
    if (!canSend && isProduction) {
      return res.status(503).json({ ok: false, error: '邮件服务暂时不可用，请稍后再试' });
    }
    const respondOk = { ok: true, mock: !canSend };
    if (!access?.ok) return res.json(respondOk); // 防枚举：未授权邮箱静默成功
    try {
      let user = authService.getUserByEmail(email);
      if (!user) user = authService.ensureUserByEmail(email);
      let mockToken = '';
      await authService.requestPasswordReset(user.id, {
        deliverResetToken: async token => {
          if (canSend) {
            await safeMailer.sendPasswordResetMail({ to: email, resetToken: token });
          } else {
            mockToken = token; // dev mock：返回给调用方便于联调
          }
        },
      });
      return res.json(mockToken ? { ...respondOk, resetToken: mockToken } : respondOk);
    } catch (error) {
      return sendCoded(res, error);
    }
  });

  // ── 重置密码：一次性 token + 新密码 → 吊销该用户全部会话 ──
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const result = await authService.resetPassword({
        token: String(req.body?.token || ''),
        password: String(req.body?.password || ''),
      });
      return res.json(result);
    } catch (error) {
      return sendCoded(res, error);
    }
  });

  // ── refresh 轮换 ──
  app.post('/api/auth/refresh', (req, res) => {
    const refreshToken = String(req.body?.refreshToken || '').trim();
    if (!refreshToken) return res.status(400).json({ ok: false, error: '缺少 refreshToken' });
    try {
      const session = authService.rotateRefreshToken(refreshToken, { ip: getClientIp(req) });
      return res.json(sessionPayload(session));
    } catch (error) {
      return sendCoded(res, error, 401);
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const refreshToken = String(req.body?.refreshToken || '').trim();
    if (!refreshToken) return res.json({ ok: true, revoked: 0 });
    return res.json(authService.logoutByRefreshToken(refreshToken));
  });

  // ── 存量 HMAC token 换发新会话（30 天宽限期内有效）──
  app.post('/api/auth/session/exchange', (req, res) => {
    const legacyToken = String(req.body?.token || req.body?.legacyToken || '').trim();
    if (!legacyToken) return res.status(400).json({ ok: false, error: '缺少存量会话令牌' });
    try {
      const verified = authService.verifyAccessToken(legacyToken);
      const user = authService.getUserByEmail(verified.email);
      if (!user) return res.json({ ok: true, alreadyMigrated: true });
      const session = authService.issueSession(user, { remember: false, device: 'exchange' });
      return res.json(sessionPayload(session));
    } catch (v2Error) {
      if (v2Error?.code !== 'AUTH_SESSION_INVALID') return sendCoded(res, v2Error, 401);
      try {
        const access = requireAccess(legacyTokens.verify(legacyToken).email);
        if (!access?.ok) {
          return res.status(access?.status || 403).json({ ok: false, error: access?.error || '当前账号暂时无法使用此功能' });
        }
        const session = authService.issueSession(access.email, { remember: false, device: 'legacy-exchange' });
        return res.json(sessionPayload(session));
      } catch {
        return res.status(401).json({ ok: false, error: '登录状态无效或已过期，请重新登录', code: 'AUTH_SESSION_EXPIRED' });
      }
    }
  });

  // ══════ P2 账号体系：第三方登录 / 设备管理 ══════

  function authenticateBearer(req, res) {
    const header = String(req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ ok: false, error: '缺少会话令牌', code: 'AUTH_SESSION_REQUIRED' });
      return null;
    }
    try {
      return authService.verifyAccessToken(token);
    } catch (error) {
      sendCoded(res, error, 401);
      return null;
    }
  }

  // ── 可用第三方登录方式 ──
  app.get('/api/auth/providers', (req, res) => {
    const available = providers && typeof providers.listAvailable === 'function'
      ? providers.listAvailable()
      : [];
    return res.json({ ok: true, providers: available });
  });

  // ── 发起 OAuth：签发一次性 state 并 302 到授权页 ──
  app.get('/api/auth/oauth/:providerId/authorize', (req, res) => {
    const provider = providers?.getAvailable?.(req.params.providerId);
    if (!provider || !oauthStore) {
      return res.status(404).json({ ok: false, error: '该登录方式暂未开放', code: 'AUTH_PROVIDER_UNAVAILABLE' });
    }
    let issued;
    try {
      issued = oauthStore.issueState(provider.id, { redirectTo: req.query.redirect });
    } catch (error) {
      return sendCoded(res, error);
    }
    const callbackUri = `${req.protocol}://${req.get('host')}/api/auth/oauth/${encodeURIComponent(provider.id)}/callback`;
    let target;
    try {
      target = provider.authorizeUrl(issued.state, { redirectUri: callbackUri });
    } catch (error) {
      return sendCoded(res, error, 404);
    }
    return res.redirect(302, target);
  });

  // ── OAuth 回调：换 profile → auth_identities upsert → 签发会话 ──
  app.get('/api/auth/oauth/:providerId/callback', async (req, res) => {
    const provider = providers?.getAvailable?.(req.params.providerId);
    if (!provider || !oauthStore) {
      return res.status(404).json({ ok: false, error: '该登录方式暂未开放', code: 'AUTH_PROVIDER_UNAVAILABLE' });
    }
    const wantsJson = req.query.response === 'json';
    const respondError = (status, message, code) => {
      if (wantsJson) return res.status(status).json({ ok: false, error: message, code });
      return res.status(status).type('html').send(
        '<!doctype html><meta charset="utf-8"><p style="font-family:system-ui;padding-top:18vh;text-align:center">'
        + escapeHtml(message) + '</p>',
      );
    };
    const code = String(req.query.code || '').trim();
    const state = String(req.query.state || '').trim();
    if (!code || !state) {
      return respondError(400, '回调缺少 code 或 state', 'AUTH_OAUTH_CALLBACK_INVALID');
    }
    const claimed = oauthStore.consumeState(provider.id, state);
    if (!claimed) {
      // state 不存在/已消费/过期 → 一律拒绝（CSRF 与重放防护）。
      return respondError(403, '登录状态已失效，请重新发起登录', 'AUTH_OAUTH_STATE_INVALID');
    }
    let profile;
    try {
      profile = await provider.handleCallback(
        { code, state },
        { redirectUri: `${req.protocol}://${req.get('host')}/api/auth/oauth/${encodeURIComponent(provider.id)}/callback` },
      );
    } catch (error) {
      console.error('[auth][oauth]', provider.id, error?.message);
      return sendCoded(res, Object.assign(error, { code: error?.code || 'AUTH_OAUTH_UPSTREAM_FAILED' }), 502);
    }
    let bound;
    try {
      bound = oauthStore.upsertIdentity(profile); // unionid 归并预留见 oauthStore.mjs
    } catch (error) {
      return sendCoded(res, error, 400);
    }
    const email = bound.user.email;
    const access = requireAccess(email);
    if (!access?.ok) {
      return respondError(access?.status || 403, access?.error || '当前账号暂时无法使用此功能', access?.code || 'ACCOUNT_NOT_ALLOWED');
    }
    const session = authService.issueSession(bound.user, {
      remember: true,
      device: `oauth:${provider.id}`,
      ip: getClientIp(req),
    });
    const payload = {
      ...sessionPayload(session),
      provider: provider.id,
      isNewIdentity: Boolean(bound.created),
    };
    if (wantsJson) return res.json(payload);
    return res.status(200).type('html').send(renderOauthBootstrapPage(payload, claimed.redirectTo));
  });

  // ── 设备管理：当前用户活跃会话列表 ──
  app.get('/api/auth/sessions', (req, res) => {
    const verified = authenticateBearer(req, res);
    if (!verified) return undefined;
    const sessions = authService.listUserSessions(verified.userId, { currentJti: verified.jti });
    return res.json({ ok: true, sessions, identities: [] });
  });

  // ── 设备管理：吊销单个设备会话 ──
  app.delete('/api/auth/sessions/:sessionId', (req, res) => {
    const verified = authenticateBearer(req, res);
    if (!verified) return undefined;
    const sessionId = String(req.params.sessionId || '').trim();
    if (!sessionId) return res.status(400).json({ ok: false, error: '缺少会话标识' });
    const revoked = authService.revokeUserSession(verified.userId, sessionId);
    if (!revoked) {
      return res.status(404).json({ ok: false, error: '会话不存在或已被吊销', code: 'AUTH_SESSION_NOT_FOUND' });
    }
    return res.json({ ok: true, revoked });
  });

  return app;
}