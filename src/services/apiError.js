export class ApiError extends Error {
  constructor(message, { status = 0, code = 'API_ERROR', payload = null, resumeable = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
    this.resumeable = Boolean(resumeable);
  }
}

export async function createApiError(response, fallbackMessage = '请求失败') {
  const raw = await response.text().catch(() => '');
  let payload = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch {}
  const message = payload?.error || payload?.message || raw || response.statusText || fallbackMessage;
  return new ApiError(String(message).slice(0, 300), {
    status: Number(response.status || 0),
    code: payload?.code || 'API_ERROR',
    payload,
    resumeable: payload?.resumeable,
  });
}

export function isInsufficientCreditsError(error) {
  return error?.status === 402 || error?.code === 'INSUFFICIENT_CREDITS';
}
