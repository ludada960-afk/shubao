/**
 * 认证服务 — P1 邮箱验证码/密码 + P2 会话刷新、第三方登录与设备管理
 *
 * 存储模型：
 *   sb-auth          当前会话（token/expiresAt/用户信息）；401 即清除
 *   sb-auth-refresh  独立保存的 refresh token；access 401 时仍可静默换新，
 *                    仅在 refresh 本身失效/重放时清除并广播会话失效。
 *   sb-oauth-payload OAuth 回调引导页暂存的会话，adoptOauthBootstrap() 领取后即删。
 *
 * x-shubao-*-token：legacy token 命中宽限换发时服务端通过响应头旁路下发新会话，
 * handleSessionResponse 对所有经过的响应做一次捕获入库。
 */
const STORAGE_KEY = 'sb-auth';
const REFRESH_STORAGE_KEY = 'sb-auth-refresh';
const OAUTH_PAYLOAD_KEY = 'sb-oauth-payload';
const API_BASE = '';
const ACCESS_REFRESH_AHEAD_MS = 5 * 60 * 1000;
const AUTO_REFRESH_INTERVAL_MS = 60 * 1000;
const invalidSessionListeners = new Set();
const sessionRestoredListeners = new Set();
let refreshInFlight = null;

function getStored() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}

function getStoredRefresh() {
  try { return JSON.parse(localStorage.getItem(REFRESH_STORAGE_KEY) || 'null'); } catch { return null; }
}

function writeStored(session) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      id: session.id || session.email || '',
      email: session.email || '',
      nickname: session.nickname || '',
      token: session.token || session.accessToken || '',
      expiresAt: session.expiresAt || session.accessExpiresAt || '',
    }));
  } catch { /* storage unavailable */ }
}

function persistSessionPair(payload) {
  if (!payload?.ok) return false;
  if (payload.token || payload.accessToken) writeStored(payload);
  if (payload.refreshToken) {
    try {
      localStorage.setItem(REFRESH_STORAGE_KEY, JSON.stringify({
        refreshToken: payload.refreshToken,
        refreshExpiresAt: payload.refreshExpiresAt || '',
        email: payload.email || payload.user?.email || getStored()?.email || '',
      }));
    } catch { /* storage unavailable */ }
  }
  return true;
}

export function getSessionToken() {
  const session = getStored();
  if (!session || typeof session.token !== 'string' || !session.token.trim()) return '';
  if (session.expiresAt && Number.isFinite(Date.parse(session.expiresAt)) && Date.parse(session.expiresAt) <= Date.now()) return '';
  return session.token.trim();
}

function notifyRestored() {
  const session = getStored();
  sessionRestoredListeners.forEach(listener => {
    try { listener(session); } catch { /* a subscriber must not break restore */ }
  });
}

export function clearSession() {
  try { globalThis.localStorage?.removeItem?.(STORAGE_KEY); } catch {}
  invalidSessionListeners.forEach(listener => {
    try { listener(); } catch { /* a subscriber must not block session cleanup */ }
  });
}

function clearRefreshCredential() {
  try { globalThis.localStorage?.removeItem?.(REFRESH_STORAGE_KEY); } catch {}
}

export function onSessionInvalid(callback) {
  if (typeof callback !== 'function') return () => {};
  invalidSessionListeners.add(callback);
  return () => invalidSessionListeners.delete(callback);
}

export function onSessionRestored(callback) {
  if (typeof callback !== 'function') return () => {};
  sessionRestoredListeners.add(callback);
  return () => sessionRestoredListeners.delete(callback);
}

// ── legacy 换发响应头捕获：x-shubao-access-token / x-shubao-refresh-token ──
export function captureSessionRenewal(response) {
  try {
    const access = response?.headers?.get?.('x-shubao-access-token');
    if (!access) return false;
    const refresh = response?.headers?.get?.('x-shubao-refresh-token') || '';
    const current = getStored();
    persistSessionPair({
      ok: true,
      token: access,
      refreshToken: refresh || undefined,
      expiresAt: decodeJwtExp(access),
      email: current?.email || '',
      nickname: current?.nickname || '',
    });
    return true;
  } catch {
    return false;
  }
}

function decodeJwtExp(token) {
  // v2 token 形如 base64url(payload).sig，这里只读 exp 用于本地过期判断。
  try {
    const [payloadPart] = String(token).split('.');
    const payload = JSON.parse(atobPayload(payloadPart));
    return payload?.exp ? new Date(payload.exp * 1000).toISOString() : '';
  } catch {
    return '';
  }
}

function atobPayload(part) {
  const normalized = String(part).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return globalThis.atob ? globalThis.atob(padded) : Buffer.from(padded, 'base64').toString('binary');
}

export function handleSessionResponse(response) {
  captureSessionRenewal(response);
  if (response?.status === 401) clearSession();
  return response;
}

async function postJson(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, ok: res.ok, data };
}

// ── P2：refresh 轮换（并发去重）──
export function refreshSession({ force = false } = {}) {
  if (refreshInFlight && !force) return refreshInFlight;
  const storedRefresh = getStoredRefresh();
  const refreshToken = storedRefresh?.refreshToken;
  refreshInFlight = (async () => {
    if (!refreshToken) return false;
    try {
      const { status, data } = await postJson('/api/auth/refresh', { refreshToken });
      if (status === 200 && data?.ok) {
        persistSessionPair(data);
        notifyRestored();
        return true;
      }
      // 失效/过期/重放（family 已被吊销）→ 全部清除并广播下线。
      if ([400, 401, 403].includes(status)) {
        clearRefreshCredential();
        clearSession();
      }
      return false;
    } catch {
      return false; // 网络抖动不清理凭据，等下一个周期。
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export function maybeRefreshSession(options = {}) {
  return refreshSession(options);
}

// ── P2：存量 HMAC token 换发（30 天宽限期内有效）──
export async function exchangeLegacySession(legacyToken) {
  const { status, data } = await postJson('/api/auth/session/exchange', { token: legacyToken });
  if (status === 200 && data?.ok && data.token) {
    persistSessionPair(data);
    notifyRestored();
    return data;
  }
  return null;
}

// ── P2：静默自动刷新（定时 tick + 可手动触发）──
export function runSessionAutoRefreshTick() {
  const session = getStored();
  const refreshCred = getStoredRefresh();
  if (!session?.token || !refreshCred?.refreshToken) return Promise.resolve(false);
  const expiresAt = Date.parse(session.expiresAt || '');
  const nearExpiry = !Number.isFinite(expiresAt) || expiresAt - Date.now() <= ACCESS_REFRESH_AHEAD_MS;
  if (!nearExpiry) return Promise.resolve(false);
  return refreshSession();
}

let autoRefreshTimer = null;
export function startSessionAutoRefresh(intervalMs = AUTO_REFRESH_INTERVAL_MS) {
  stopSessionAutoRefresh();
  autoRefreshTimer = setInterval(() => { runSessionAutoRefreshTick().catch(() => {}); }, intervalMs);
  void runSessionAutoRefreshTick().catch(() => {});
  return () => stopSessionAutoRefresh();
}

export function stopSessionAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

// ── P2：OAuth 回调引导页落地 ──
export function adoptOauthBootstrap() {
  let raw = '';
  try { raw = localStorage.getItem(OAUTH_PAYLOAD_KEY) || ''; } catch {}
  if (!raw) return null;
  try { localStorage.removeItem(OAUTH_PAYLOAD_KEY); } catch {}
  let payload = null;
  try { payload = JSON.parse(raw); } catch { return null; }
  if (!payload?.ok || !(payload.token || payload.accessToken)) return null;
  persistSessionPair(payload);
  notifyRestored();
  return getStored();
}

export async function beginOAuthLogin(providerId) {
  const providers = await fetchAuthProviders();
  if (!providers.some(item => item.id === providerId)) {
    throw new Error('该登录方式暂未开放');
  }
  window.location.assign(
    `${API_BASE}/api/auth/oauth/${encodeURIComponent(providerId)}/authorize?redirect=`
    + encodeURIComponent(window.location.pathname + window.location.search),
  );
}

// ── 第三方方式列表 / 找回密码 / 设备管理 ──
export async function fetchAuthProviders() {
  const res = await fetch(`${API_BASE}/api/auth/providers`);
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  return Array.isArray(data?.providers) ? data.providers : [];
}

export async function fetchAuthSessions() {
  const token = getSessionToken();
  if (!token) throw new Error('请先登录');
  const res = await fetch(`${API_BASE}/api/auth/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  handleSessionResponse(res);
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || '获取设备列表失败');
  const data = await res.json().catch(() => null);
  return Array.isArray(data?.sessions) ? data.sessions : [];
}

export async function revokeAuthSession(sessionId) {
  const token = getSessionToken();
  if (!token) throw new Error('请先登录');
  const res = await fetch(`${API_BASE}/api/auth/sessions/${encodeURIComponent(String(sessionId || ''))}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  handleSessionResponse(res);
  if (res.status === 404) throw new Error('该设备会话已不存在');
  if (!res.ok) throw new Error('吊销失败，请稍后再试');
  return true;
}

// ── 找回密码（P1 后端能力的前端入口）──
export async function forgotPassword(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '提交失败，请稍后再试');
  return { ok: true, mock: Boolean(data.mock), resetToken: data.resetToken || '' };
}

export async function sendOTP(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  // 如果是手机号格式，报错提示
  if (/^1\d{10}$/.test(normalizedEmail)) {
    throw new Error('请输入邮箱地址，如 user@example.com');
  }
  const res = await fetch(`${API_BASE}/api/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail }),
  });

  // 检查 Content-Type 确保是 JSON
  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await res.text();
    console.error('服务器返回非JSON:', text.substring(0, 200));
    throw new Error('服务器响应异常，请稍后重试');
  }

  const d = await res.json();
  if (!res.ok) throw new Error(d.error || '发送失败');

  return {
    ok: true,
    mock: Boolean(d.mock),
    reused: Boolean(d.reused),
    retryAfterSeconds: Number.isFinite(Number(d.retryAfterSeconds))
      ? Math.max(0, Number(d.retryAfterSeconds))
      : 60,
  };
}

export async function verifyOTP(email, code) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const res = await fetch(`${API_BASE}/api/auth/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, code }),
  });
  const d = await res.json();

  if (!d.ok) throw new Error(d.error || '验证失败');

  persistSessionPair(d);
  return {
    id: d.id || d.email,
    email: d.email || normalizedEmail,
    nickname: d.nickname || normalizedEmail.split('@')[0],
    token: d.token || '',
    expiresAt: d.expiresAt || '',
    refreshToken: d.refreshToken || '',
  };
}

export async function getSession() {
  const session = getStored();
  if (!session?.token || !getSessionToken()) {
    // 本地 access 过期但 refresh 仍在 → 先尝试静默续期再走服务端校验。
    if (getStoredRefresh()?.refreshToken) {
      const refreshed = await refreshSession();
      if (refreshed) return getSessionAfterRefresh();
    }
    clearSession();
    return null;
  }
  return verifyAndAdoptSession(session);
}

async function getSessionAfterRefresh() {
  const session = getStored();
  if (!session?.token) return null;
  return verifyAndAdoptSession(session);
}

async function verifyAndAdoptSession(session) {
  try {
    const response = await fetch(`${API_BASE}/api/session`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (response.status === 401) {
      // access 失效但 refresh 可能仍在 → 尝试一轮静默续期后重试一次。
      const refreshed = getStoredRefresh()?.refreshToken ? await refreshSession() : false;
      if (refreshed) {
        const retrySession = getStored();
        if (retrySession?.token) {
          const retry = await fetch(`${API_BASE}/api/session`, {
            headers: { Authorization: `Bearer ${retrySession.token}` },
          });
          if (retry.ok) return finalizeVerifiedSession(retrySession, await retry.json());
        }
      }
      clearSession();
      return null;
    }
    if (!response.ok) {
      clearSession();
      return null;
    }
    return finalizeVerifiedSession(session, await response.json());
  } catch {
    return null;
  }
}

function finalizeVerifiedSession(session, verified) {
  const email = String(verified?.email || '').trim().toLowerCase();
  if (!verified?.ok || !email) {
    clearSession();
    return null;
  }
  const next = { ...session, email, id: session.id || email, nickname: session.nickname || email.split('@')[0] };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function logout() {
  const refreshToken = getStoredRefresh()?.refreshToken || '';
  clearRefreshCredential();
  try {
    if (refreshToken) {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
  } finally {
    clearSession();
  }
}

export async function signOut() {
  await logout();
}

export function onAuthChange(callback) {
  return { unsubscribe: () => {} };
}
