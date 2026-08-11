const DEFAULT_OWNER_EMAIL = '867550189@qq.com';
const DEFAULT_BETA_TESTER_EMAILS = Object.freeze(['240485042@qq.com']);
const DEFAULT_BETA_EMAILS = Object.freeze([DEFAULT_OWNER_EMAIL, ...DEFAULT_BETA_TESTER_EMAILS]);

function configuredEmails(name, required = []) {
  const raw = typeof process?.env?.[name] === 'string' ? process.env[name] : '';
  const values = raw.split(',').map(value => normalizeEmail(value)).filter(Boolean);
  return new Set([...required, ...values].map(value => normalizeEmail(value)).filter(Boolean));
}

function accessMode() {
  const value = typeof process?.env?.SHUBAO_ACCESS_MODE === 'string'
    ? process.env.SHUBAO_ACCESS_MODE.trim().toLowerCase()
    : '';
  return ['commercial', 'public', 'paid'].includes(value) ? 'commercial' : 'closed';
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function closedBetaEmails() {
  return configuredEmails('SHUBAO_CLOSED_BETA_EMAILS', DEFAULT_BETA_EMAILS);
}

function unlimitedBetaEmails() {
  return configuredEmails('SHUBAO_UNLIMITED_EMAILS');
}

export function isAllowedBetaEmail(value) {
  const email = normalizeEmail(value);
  return accessMode() === 'commercial' ? isEmail(email) : closedBetaEmails().has(email);
}

export function isUnlimitedBetaEmail(value) {
  return unlimitedBetaEmails().has(normalizeEmail(value));
}

export function requireBetaEmail(value) {
  const email = normalizeEmail(value);
  if (!email) return { ok: false, status: 401, error: '请先登录后再继续操作' };
  if (!isEmail(email)) return { ok: false, status: 400, error: '邮箱格式不正确' };
  if (!isAllowedBetaEmail(email)) return { ok: false, status: 403, error: '当前账号暂时无法使用此功能' };
  return { ok: true, email };
}

export function betaAccessMiddleware(req, res, next) {
  const result = requireBetaEmail(req.body?.email || req.query?.email || req.headers['x-shubao-email']);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  req.betaEmail = result.email;
  next();
}
