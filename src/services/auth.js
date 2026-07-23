/**
 * 认证服务 - 邮箱验证码
 *
 * 流程：
 * 1. 用户填邮箱 → POST /api/auth/send-code → 发验证码
 * 2. 用户填验证码 → POST /api/auth/verify-code → 验证登录
 */

const STORAGE_KEY = 'sb-auth';
const API_BASE = '';
export const CLOSED_BETA_EMAIL = '867550189@qq.com';

function getStored() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}

export function isClosedBetaEmail(email) {
  return String(email || '').trim().toLowerCase() === CLOSED_BETA_EMAIL;
}

export async function sendOTP(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  // 如果是手机号格式，报错提示
  if (/^1\d{10}$/.test(normalizedEmail)) {
    throw new Error('请输入邮箱地址，如 user@example.com');
  }
  if (!isClosedBetaEmail(normalizedEmail)) {
    throw new Error('薯包AI 正在内测，此邮箱暂未获邀');
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

  return { ok: true, mock: d.mock };
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

  const user = { id: d.email, email: d.email, nickname: normalizedEmail.split('@')[0] };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  return user;
}

export async function getSession() {
  return getStored();
}

export async function signOut() {
  localStorage.removeItem(STORAGE_KEY);
}

export function onAuthChange(callback) {
  return { unsubscribe: () => {} };
}
