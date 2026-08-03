export class ApiError extends Error {
  constructor(message, { status = 0, code = 'API_ERROR', payload = null, resumeable = false, retryable = false, retryAfter = null, taskId = '', providerJobId = '', reQuoteRequired = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
    this.resumeable = Boolean(resumeable);
    this.retryable = Boolean(retryable);
    this.retryAfter = Number.isFinite(retryAfter) ? retryAfter : null;
    this.taskId = typeof taskId === 'string' ? taskId : '';
    this.providerJobId = typeof providerJobId === 'string' ? providerJobId : '';
    this.reQuoteRequired = Boolean(reQuoteRequired);
  }
}

export async function createApiError(response, fallbackMessage = '请求失败') {
  handleSessionResponse(response);
  const raw = await response.text().catch(() => '');
  let payload = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch {}
  const message = payload?.error || payload?.message || raw || response.statusText || fallbackMessage;
  return new ApiError(String(message).slice(0, 300), {
    status: Number(response.status || 0),
    code: payload?.code || 'API_ERROR',
    payload,
    resumeable: payload?.resumeable,
    retryable: payload?.retryable,
    retryAfter: Number.isFinite(payload?.retryAfter) ? payload.retryAfter : null,
    taskId: payload?.taskId,
    providerJobId: payload?.providerJobId,
    reQuoteRequired: payload?.reQuoteRequired,
  });
}

export function isInsufficientCreditsError(error) {
  return error?.status === 402 || error?.code === 'INSUFFICIENT_CREDITS';
}
import { handleSessionResponse } from './auth.js';
