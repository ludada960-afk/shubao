import { withSessionEmail } from './api.js';

/** 兑换码 API（2026-09-10） */
const API_BASE = '';

function sessionHeaders(headers = {}) {
  const merged = { ...headers };
  try {
    const raw = globalThis.localStorage?.getItem('sb-auth');
    const session = raw ? JSON.parse(raw) : null;
    if (session?.token) merged.Authorization = `Bearer ${session.token}`;
  } catch { /* 未登录由服务端返回 401 */ }
  return merged;
}

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: sessionHeaders(body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(withSessionEmail(body)) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    const error = new Error(data?.error || '兑换失败');
    error.code = data?.code || '';
    error.status = res.status;
    throw error;
  }
  return data;
}

export async function redeemCode(code) {
  const data = await request('/api/redeem', { method: 'POST', body: { code } });
  return { code: data.code, units: data.units, currency: data.currency };
}

export async function fetchRedeemRecords() {
  const data = await request('/api/redeem/records');
  return Array.isArray(data.records) ? data.records : [];
}
