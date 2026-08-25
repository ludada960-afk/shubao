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
  const status = Number(response.status || 0);
  const structuredMessage = payload?.error || payload?.message || '';
  // 5xx 且响应体不是结构化 JSON（典型：dev 代理指向未启动的后端、网关错误页）时，
  // 不把「Internal Server Error」这类英文原文透给用户，回退到业务方传入的中文提示。
  const message = structuredMessage
    || (status >= 500 ? '' : (raw || response.statusText || ''))
    || fallbackMessage;
  return new ApiError(String(message).slice(0, 300), {
    status,
    code: payload?.code || 'API_ERROR',
    payload: payload ?? (status >= 500 && raw && !structuredMessage ? { rawBody: raw.slice(0, 500) } : payload),
    resumeable: payload?.resumeable,
    retryable: payload?.retryable,
    retryAfter: Number.isFinite(payload?.retryAfter) ? payload.retryAfter : null,
    taskId: payload?.taskId,
    providerJobId: payload?.providerJobId,
    reQuoteRequired: payload?.reQuoteRequired,
  });
}

export function isInsufficientCreditsError(error) {
  // 后端钱包服务使用 BILLING_INSUFFICIENT_CREDITS，部分任务级错误只带 code 不带 status。
  return error?.status === 402
    || error?.code === 'INSUFFICIENT_CREDITS'
    || error?.code === 'BILLING_INSUFFICIENT_CREDITS';
}
import { handleSessionResponse } from './auth.js';
