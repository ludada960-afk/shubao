/**
 * 认证服务 - 邮箱验证码
 *
 * 流程：
 * 1. 用户填邮箱 → POST /api/auth/send-code → 发验证码
 * 2. 用户填验证码 → POST /api/auth/verify-code → 验证登录
 */

const STORAGE_KEY = 'sb-auth';
const API_BASE = '';

function getStored() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}

/* 判断是否配置了真实邮箱 SMTP */
async function checkMockMode() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mock@check.test' }),
    });
    const d = await res.json();
    return !!d.mock;
  } catch { return true; }
}

/* 初始 mock 状态 */
let _mockMode = true;

export async function sendOTP(email) {
  // 如果是手机号格式，报错提示
  if (/^1\d{10}$/.test(email)) {
    throw new Error('请输入邮箱地址，如 user@example.com');
  }

  const res = await fetch(`${API_BASE}/api/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
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

  _mockMode = !!d.mock;
  if (d.mock) {
    console.log('[auth-mock] 验证码: 123456');
  }
  return { ok: true, mock: d.mock };
}

export async function verifyOTP(email, code) {
  const res = await fetch(`${API_BASE}/api/auth/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  const d = await res.json();

  if (!d.ok) throw new Error(d.error || '验证失败');

  const user = { id: d.email, email: d.email, nickname: email.split('@')[0] };
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
