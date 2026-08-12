/**
 * 认证服务 - 邮箱验证码
 *
 * 流程：
 * 1. 用户填邮箱 → POST /api/auth/send-code → 发验证码
 * 2. 用户填验证码 → POST /api/auth/verify-code → 验证登录
 */

const STORAGE_KEY = 'sb-auth';
const API_BASE = '';
const invalidSessionListeners = new Set();

function getStored() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}

export function getSessionToken() {
  const session = getStored();
  if (!session || typeof session.token !== 'string' || !session.token.trim()) return '';
  if (session.expiresAt && Number.isFinite(Date.parse(session.expiresAt)) && Date.parse(session.expiresAt) <= Date.now()) return '';
  return session.token.trim();
}

export function clearSession() {
  try { globalThis.localStorage?.removeItem?.(STORAGE_KEY); } catch {}
  invalidSessionListeners.forEach(listener => {
    try { listener(); } catch { /* a subscriber must not block session cleanup */ }
  });
}

export function onSessionInvalid(callback) {
  if (typeof callback !== 'function') return () => {};
  invalidSessionListeners.add(callback);
  return () => invalidSessionListeners.delete(callback);
}

export function handleSessionResponse(response) {
  if (response?.status === 401) clearSession();
  return response;
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

  const user = {
    id: d.id || d.email,
    email: d.email || normalizedEmail,
    nickname: d.nickname || normalizedEmail.split('@')[0],
    token: d.token || '',
    expiresAt: d.expiresAt || '',
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}

export async function getSession() {
  const session = getStored();
  if (!session?.token || !getSessionToken()) {
    clearSession();
    return null;
  }
  try {
    const response = await fetch(`${API_BASE}/api/session`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (!response.ok) {
      handleSessionResponse(response);
      return null;
    }
    const verified = await response.json();
    const email = String(verified?.email || '').trim().toLowerCase();
    if (!verified?.ok || !email) {
      clearSession();
      return null;
    }
    const next = { ...session, email, id: session.id || email, nickname: session.nickname || email.split('@')[0] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

export async function signOut() {
  clearSession();
}

export function onAuthChange(callback) {
  return { unsubscribe: () => {} };
}
