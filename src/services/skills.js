import { withSessionEmail } from './api.js';

/**
 * 技能库 API 客户端（2026-09-10）
 * 与 api.js 相同的会话头约定；所有错误抛出带 errorCode 的 Error，便于 UI 精确定位字段。
 */
const API_BASE = '';

function sessionHeaders(headers = {}) {
  const merged = { ...headers };
  try {
    const raw = globalThis.localStorage?.getItem('sb-auth');
    const session = raw ? JSON.parse(raw) : null;
    if (session?.token) merged.Authorization = `Bearer ${session.token}`;
  } catch { /* 未登录时由服务端返回 401 */ }
  return merged;
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: sessionHeaders(body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(withSessionEmail(body)) : undefined,
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    const error = new Error(data?.error || '技能库请求失败');
    error.errorCode = data?.errorCode || '';
    error.field = data?.field || '';
    error.status = res.status;
    throw error;
  }
  return data;
}

export async function fetchSkillLibrary({ kind = '', signal } = {}) {
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  const data = await request(`/api/skills${query}`, { signal });
  return { builtin: Array.isArray(data.builtin) ? data.builtin : [], mine: Array.isArray(data.mine) ? data.mine : [] };
}

export async function createUserSkill(input, { signal } = {}) {
  const data = await request('/api/skills', { method: 'POST', body: input, signal });
  return data.skill;
}

export async function updateUserSkill(id, input, { signal } = {}) {
  const data = await request(`/api/skills/${encodeURIComponent(id)}`, { method: 'PATCH', body: input, signal });
  return data.skill;
}

export async function archiveUserSkill(id, { signal } = {}) {
  const data = await request(`/api/skills/${encodeURIComponent(id)}`, { method: 'DELETE', signal });
  return data.skill;
}
