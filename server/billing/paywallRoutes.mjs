/**
 * 4c183cd4 续命 P-D commerce paywall 路由层
 *
 * 3 个端点：
 *   - POST /api/billing/paywall/create   - 创建 paywall 订单（鉴权 user）
 *   - POST /api/billing/paywall/callback - 三方支付回调（无鉴权；用 sandbox 固定密钥验签）
 *   - GET  /api/billing/paywall/status   - 查 paywall 订单状态（鉴权 user/admin）
 *
 * 退款端点走 admin 域（mountAdminRoutes），不挂这里。
 */
import { PAYWALL_SCHEMA_VERSION } from './paywall.mjs';

const SAFE_IDENTIFIER = /^[a-z0-9][a-z0-9_-]{0,127}$/i;

function codedError(code, message = code, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function identifier(value, label) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!SAFE_IDENTIFIER.test(normalized)) throw codedError('PAYWALL_REQUEST_INVALID', `${label} is invalid`);
  return normalized;
}

function ownerFor(req) {
  const owner = typeof req?.paywallOwnerEmail === 'string' ? req.paywallOwnerEmail.trim().toLowerCase() : '';
  if (!owner) throw codedError('PAYWALL_AUTH_REQUIRED', 'paywall auth required', 401);
  return owner;
}

function isAdminCaller(req) {
  return req?.paywallAdminAccess?.ok === true;
}

function paywallHttpError(error) {
  if (String(error?.code || '').startsWith('AUTH_SESSION_')) {
    return {
      status: error.code === 'AUTH_SESSION_UNAUTHORIZED' ? (error.status || 403) : 401,
      body: { error: '登录状态无效或已过期，请重新登录', code: error.code },
    };
  }
  if (error?.code === 'PAYWALL_CHANNEL_DISABLED') {
    return { status: 503, body: { error: '当前支付渠道未开通，请联系管理员', code: error.code, retryable: false } };
  }
  if (error?.code === 'PAYWALL_TRANSACTION_NOT_FOUND') {
    return { status: 404, body: { error: 'paywall 订单不存在', code: error.code } };
  }
  if (error?.code === 'PAYWALL_SIGNATURE_INVALID') {
    return { status: 401, body: { error: '回调签名校验失败', code: error.code } };
  }
  if (error?.code === 'PAYWALL_AMOUNT_MISMATCH') {
    return { status: 422, body: { error: '回调金额与订单不一致', code: error.code } };
  }
  if (error?.code === 'PAYWALL_STATE_INVALID') {
    return { status: 409, body: { error: error.message || '订单状态不允许该操作', code: error.code } };
  }
  if (error?.code === 'PAYWALL_SKU_NOT_ALLOWED' || error?.code === 'PAYWALL_AMOUNT_INVALID') {
    return { status: 422, body: { error: error.message || 'paywall 参数非法', code: error.code } };
  }
  if (error?.code === 'PAYWALL_CHANNEL_INVALID') {
    return { status: 400, body: { error: 'paywall 渠道参数非法', code: error.code } };
  }
  return {
    status: Number.isInteger(error?.status) ? error.status : 400,
    body: { error: error?.message || 'paywall 请求参数无效', code: error?.code || 'PAYWALL_REQUEST_INVALID' },
  };
}

function sendMappedError(res, error) {
  const mapped = paywallHttpError(error);
  return res.status(mapped.status).json(mapped.body);
}

function handler(fn) {
  return (req, res) => {
    try {
      const result = fn(req, res);
      if (result !== null && typeof result === 'object' && typeof result.then === 'function') {
        return Promise.resolve(result).catch(error => sendMappedError(res, error));
      }
      return result;
    } catch (error) {
      return sendMappedError(res, error);
    }
  };
}

export function createPaywallRouteHandlers({ paywallService, authenticateOwner, authorizeAdmin = null } = {}) {
  if (!paywallService || typeof paywallService.createOrder !== 'function') {
    throw new TypeError('paywallService with createOrder is required');
  }
  if (typeof authenticateOwner !== 'function') {
    throw new TypeError('authenticateOwner is required');
  }

  return {
    requireUser(req, res, next) {
      try {
        req.paywallOwnerEmail = authenticateOwner(req);
        if (typeof authorizeAdmin === 'function') {
          try {
            req.paywallAdminAccess = authorizeAdmin(req.paywallOwnerEmail);
          } catch (error) {
            req.paywallAdminAccess = { ok: false, error: error?.message || 'admin check failed' };
          }
        }
        return next();
      } catch (error) {
        return sendMappedError(res, error);
      }
    },
    channels: handler((_req, res) => res.json({
      schemaVersion: PAYWALL_SCHEMA_VERSION,
      sandbox: true,
      channels: paywallService.channels().map(channel => ({
        id: channel,
        label: channel === 'wechat_qr' ? '微信支付' : '支付宝',
        mode: channel === 'wechat_qr' ? 'qr' : 'redirect',
        description: 'sandbox 沙箱模式，不连真通道',
      })),
      allowedSkus: paywallService.allowedSkus(),
    })),
    create: handler((req, res) => {
      const ownerEmail = ownerFor(req);
      const sku = identifier(req.body?.sku, 'sku');
      const channel = identifier(req.body?.channel, 'channel');
      const idempotencyKey = req.body?.idempotencyKey
        ? identifier(req.body.idempotencyKey, 'idempotencyKey')
        : `paywall:${ownerEmail}:${sku}:${channel}:${Date.now()}`;
      // 用 idempotencyKey 复用 (owner+sku+channel+amount) 已有 transaction
      const existing = paywallService.listTransactions
        ? paywallService.listTransactions({ limit: 5 }).find(t =>
            t.ownerEmail === ownerEmail && t.sku === sku && t.channel === channel && t.status === 'created'
              && t.createdAt > new Date(Date.now() - 30 * 60_000).toISOString())
        : null;
      if (existing && existing.idempotencyKey === idempotencyKey) {
        return res.status(201).json({ transaction: existing, deduped: true });
      }
      const clientAmount = req.body?.clientAmountFen;
      const tx = paywallService.createOrder({
        ownerEmail,
        sku,
        channel,
        clientAmountFen: clientAmount === undefined ? null : clientAmount,
      });
      return res.status(201).json({ transaction: tx });
    }),
    callback: handler((req, res) => {
      const body = req.body && Object.keys(req.body).length ? req.body : {};
      // channel 也可走 query string（部分三方回调用 query）
      if (!body.channel && req.query?.channel) body.channel = req.query.channel;
      const result = paywallService.handleCallback(body, {
        rawBody: req.rawBody || null,
        headers: req.headers || {},
      });
      if (result.duplicate) {
        return res.status(200).json({ ok: true, duplicate: true, transaction: result.transaction });
      }
      return res.status(200).json({ ok: true, transaction: result.transaction });
    }),
    status: handler((req, res) => {
      const ownerEmail = ownerFor(req);
      const txId = typeof req.query?.id === 'string' ? req.query.id.trim() : '';
      const providerOrderId = typeof req.query?.providerOrderId === 'string' ? req.query.providerOrderId.trim() : '';
      const channel = typeof req.query?.channel === 'string' ? req.query.channel.trim() : '';
      const tx = providerOrderId && channel
        ? paywallService.getStatus({ providerOrderId, channel })
        : paywallService.getTransaction(txId);
      if (!tx) throw codedError('PAYWALL_TRANSACTION_NOT_FOUND', 'paywall 订单不存在', 404);
      if (tx.ownerEmail !== ownerEmail && !isAdminCaller(req)) {
        throw codedError('PAYWALL_AUTH_REQUIRED', '无权查看该订单', 403);
      }
      return res.json({ transaction: tx });
    }),
  };
}

export function mountPaywallRoutes(app, { paywallService, authenticateOwner, authorizeAdmin = null }) {
  if (!app || typeof app.get !== 'function' || typeof app.post !== 'function') {
    throw new TypeError('app with get and post is required');
  }
  const handlers = createPaywallRouteHandlers({ paywallService, authenticateOwner, authorizeAdmin });
  app.get('/api/billing/paywall/channels', handlers.channels);
  app.post('/api/billing/paywall/create', handlers.requireUser, handlers.create);
  app.post('/api/billing/paywall/callback', handlers.callback);
  app.get('/api/billing/paywall/status', handlers.requireUser, handlers.status);
  return handlers;
}
