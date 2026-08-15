import { getSessionToken, handleSessionResponse } from './auth.js';
import { createApiError } from './apiError.js';

export const AI_POINT_UNITS = 1000;

function signedHeaders(headers = {}) {
  const token = getSessionToken();
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

async function request(path, options = {}, fallback = '管理后台请求失败') {
  const response = await fetch(path, {
    ...options,
    headers: signedHeaders(options.headers),
  });
  handleSessionResponse(response);
  if (!response.ok) throw await createApiError(response, fallback);
  return response.json();
}

function jsonOptions(method, body) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function queryString(input = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  return query.size ? `?${query}` : '';
}

export function visiblePointsToUnits(value) {
  const points = Number(value);
  if (!Number.isFinite(points) || points <= 0) throw new TypeError('积分必须大于 0');
  const units = Math.round(points * AI_POINT_UNITS);
  if (!Number.isSafeInteger(units) || units <= 0) throw new TypeError('积分数值无效');
  return units;
}

export function ledgerUnitsToVisiblePoints(value) {
  const units = Number(value) || 0;
  return units / AI_POINT_UNITS;
}

export function fetchAccountAccess() {
  return request('/api/account/access', {}, '账号权限读取失败');
}

export function fetchAdminSummary(filters = {}) {
  return request(`/api/admin/summary${queryString(filters)}`, {}, '运营数据读取失败');
}

export function fetchAdminMonitoring(filters = {}) {
  return request(`/api/admin/monitoring${queryString(filters)}`, {}, '运行监控读取失败');
}

export function fetchAdminVideoOperations() {
  return request('/api/admin/video-operations', {}, '视频任务治理数据读取失败');
}

export function reconcileAdminVideos(input) {
  return request('/api/admin/video-operations/reconcile', jsonOptions('POST', input), '视频任务恢复失败');
}

export function operateAdminVideoJob(jobId, input) {
  return request(`/api/admin/video-jobs/${encodeURIComponent(jobId)}/actions`, jsonOptions('POST', input), '视频任务操作失败');
}

export function fetchAdminAccounts(filters = {}) {
  return request(`/api/admin/accounts${queryString(filters)}`, {}, '账号列表读取失败');
}

export function fetchAdminAccount(email) {
  return request(`/api/admin/accounts/${encodeURIComponent(email)}`, {}, '账号详情读取失败');
}

export function createAdminAccount(input) {
  return request('/api/admin/accounts', jsonOptions('POST', input), '账号创建失败');
}

export function updateAdminAccount(email, input) {
  return request(`/api/admin/accounts/${encodeURIComponent(email)}`, jsonOptions('PUT', input), '账号更新失败');
}

export function updateAdminPermissions(email, input) {
  return request(`/api/admin/accounts/${encodeURIComponent(email)}/permissions`, jsonOptions('PUT', input), '权限更新失败');
}

export function adjustAdminCredits(email, input) {
  const units = input.currency === 'content_sets'
    ? Math.round(Number(input.amount))
    : visiblePointsToUnits(input.amount);
  return request(`/api/admin/accounts/${encodeURIComponent(email)}/credits`, jsonOptions('POST', {
    operation: input.operation,
    currency: input.currency,
    units,
    reason: input.reason,
    expiresAt: input.expiresAt || null,
    idempotencyKey: input.idempotencyKey,
  }), '额度调整失败');
}

export function fetchAdminAudit(filters = {}) {
  return request(`/api/admin/audit${queryString(filters)}`, {}, '审计记录读取失败');
}
