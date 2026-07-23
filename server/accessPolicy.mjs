const CLOSED_BETA_EMAILS = new Set(['867550189@qq.com']);

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isAllowedBetaEmail(value) {
  return CLOSED_BETA_EMAILS.has(normalizeEmail(value));
}

export function requireBetaEmail(value) {
  const email = normalizeEmail(value);
  if (!email) return { ok: false, status: 401, error: '请先登录后再使用内测功能' };
  if (!isAllowedBetaEmail(email)) return { ok: false, status: 403, error: '薯包AI 正在内测，仅受邀账号可以登录' };
  return { ok: true, email };
}

export function betaAccessMiddleware(req, res, next) {
  const result = requireBetaEmail(req.body?.email || req.query?.email || req.headers['x-shubao-email']);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  req.betaEmail = result.email;
  next();
}
