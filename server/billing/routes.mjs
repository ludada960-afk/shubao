import { FEATURE_SKUS, PRODUCTS, quoteFeature } from './catalog.mjs';
import { quoteVideoMeter, listVideoMeterTiers } from './videoMeter.mjs';

const CURRENCIES = new Set(['ec_points', 'content_sets']);
const SAFE_IDENTIFIER = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;
const LEGACY_PAYMENT_DISABLED_BODY = Object.freeze({
  error: '旧支付接口已停用，支付服务暂不可用',
  code: 'PAYMENT_PROVIDER_DISABLED',
  retryable: false,
  legacyDisabled: true,
});

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function identifier(value, label) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!SAFE_IDENTIFIER.test(normalized)) throw codedError('BILLING_REQUEST_INVALID');
  return normalized;
}

function pageNumber(value, fallback, label) {
  if (value === undefined) return fallback;
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^(?:0|[1-9]\d*)$/.test(text)) {
    throw codedError('BILLING_REQUEST_INVALID');
  }
  const number = Number(text);
  if (!Number.isSafeInteger(number) || (label === 'limit' && (number < 1 || number > MAX_PAGE_LIMIT))) {
    throw codedError('BILLING_REQUEST_INVALID');
  }
  return number;
}

function currency(value) {
  // New work is settled in the shared ecommerce point wallet. The legacy
  // content-set ledger remains readable when callers explicitly request it.
  const normalized = value === undefined ? 'ec_points' : identifier(value, 'currency');
  if (!CURRENCIES.has(normalized)) throw codedError('BILLING_REQUEST_INVALID');
  return normalized;
}

function publicCatalog(paymentService, paymentChannelRegistry) {
  const products = Object.values(PRODUCTS)
    // Keep old content-set SKUs available to server-side compatibility code,
    // but never advertise them as purchasable commercial plans.
    .filter(product => product.enabled !== false && product.currency !== 'content_sets')
    .map(({ enabled, providerCostCny, ...product }) => ({ ...product }));
  const features = Object.entries(FEATURE_SKUS)
    .filter(([, feature]) => feature.enabled !== false && feature.public !== false && feature.currency !== 'content_sets')
    .map(([sku, feature]) => ({
      sku,
      units: feature.units,
      currency: feature.currency ?? 'ec_points',
      // 视频按量终案：零售现金锚随目录下发，价格页据此展示「能买什么」。
      ...(Number.isSafeInteger(feature.priceFen) ? { priceFen: feature.priceFen } : {}),
    }));
  const paymentChannels = (typeof paymentChannelRegistry?.listChannels === 'function'
    ? paymentChannelRegistry.listChannels()
    : [])
    .filter(channel => SAFE_IDENTIFIER.test(channel?.id || ''))
    .map(({ id, label, kind, status, enabled, description, availabilityNote }) => ({
      id,
      label,
      kind,
      status,
      enabled: enabled === true,
      ...(description ? { description } : {}),
      ...(availabilityNote ? { availabilityNote } : {}),
    }));
  const paymentProviders = (typeof paymentService?.listProviders === 'function'
    ? paymentService.listProviders()
    : [])
    .filter(provider => SAFE_IDENTIFIER.test(provider?.id || ''))
    .map(provider => ({ id: provider.id, enabled: provider.enabled === true }));
  return {
    billing: { primaryCurrency: 'ec_points', displayUnit: 'AI 积分', unitsPerPoint: 1000 },
    products,
    features,
    paymentProviders,
    paymentChannels,
  };
}

function publicQuote(quote) {
  return {
    sku: quote.sku,
    quantity: quote.quantity,
    units: quote.units,
    totalUnits: quote.totalUnits,
    currency: quote.currency,
    quoteId: quote.quoteId,
    expiresAt: quote.expiresAt,
  };
}

function publicOrder(order) {
  return {
    id: order.id,
    productSku: order.productSku,
    catalogVersion: order.catalogVersion,
    amountCny: order.amountCny,
    grantCurrency: order.grantCurrency,
    grantUnits: order.grantUnits,
    provider: order.provider,
    providerOrderId: order.providerOrderId,
    channelRef: order.channelRef || '',
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    ...(order.checkout && typeof order.checkout === 'object' ? { checkout: order.checkout } : {}),
  };
}

function isSqliteBusy(error) {
  return error?.code === 'SQLITE_BUSY'
    || error?.code === 'SQLITE_LOCKED'
    || /database (?:is )?(?:busy|locked)/i.test(String(error?.message || ''));
}

export function billingHttpError(error) {
  if (isSqliteBusy(error)) {
    return {
      status: 503,
      body: {
        error: '账务服务繁忙，请稍后重试',
        code: 'BILLING_DATABASE_BUSY',
        retryable: true,
        retryAfterSeconds: 1,
      },
    };
  }
  if (String(error?.code || '').startsWith('AUTH_SESSION_')) {
    return {
      status: error.code === 'AUTH_SESSION_UNAUTHORIZED' ? (error.status || 403) : 401,
      body: { error: '登录状态无效或已过期，请重新登录', code: error.code },
    };
  }
  if (error?.code === 'PAYMENT_PROVIDER_DISABLED') {
    return {
      status: 503,
      body: { error: '支付服务暂不可用，请稍后重试', code: error.code, retryable: false },
    };
  }
  if (error?.code === 'PAYMENT_PROVIDER_UNAVAILABLE'
    || error?.code === 'PAYMENT_PROVIDER_INVALID_RESPONSE') {
    return {
      status: 503,
      body: { error: '支付渠道暂时不可用，请稍后重试', code: error.code, retryable: true },
    };
  }
  if (error?.code === 'PAYMENT_PROVIDER_ORDER_REJECTED') {
    return {
      status: 422,
      body: { error: '支付渠道未能创建订单，请检查支付方式后重试', code: error.code, retryable: false },
    };
  }
  if (error?.code === 'BILLING_INSUFFICIENT_CREDITS') {
    return {
      status: 402,
      body: { error: '额度不足，请购买套餐后继续', code: error.code, retryable: false },
    };
  }
  if (String(error?.code || '').startsWith('BILLING_QUOTE_')) {
    return {
      status: Number.isInteger(error?.status) ? error.status : 409,
      body: {
        error: error?.message || '费用确认已失效，请重新获取费用',
        code: error.code,
        retryable: false,
        reQuoteRequired: true,
      },
    };
  }
  if (error?.code === 'BILLING_ORDER_NOT_FOUND') {
    return { status: 404, body: { error: '订单不存在', code: error.code } };
  }
  return {
    status: 400,
    body: { error: '账务请求参数无效', code: error?.code || 'BILLING_REQUEST_INVALID' },
  };
}

function sendMappedError(res, error) {
  const mapped = billingHttpError(error);
  if (mapped.body.retryable && typeof res.set === 'function') res.set('Retry-After', '1');
  return res.status(mapped.status).json(mapped.body);
}

function ownerFor(req) {
  const owner = typeof req?.billingOwnerEmail === 'string' ? req.billingOwnerEmail.trim().toLowerCase() : '';
  if (!owner) throw codedError('AUTH_SESSION_REQUIRED');
  return owner;
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

export function createBillingRouteHandlers({ walletService, paymentService, quoteService, authenticateOwner, paymentChannelRegistry, authorizeAdmin, costSummary: costSummaryFn } = {}) {
  if (!walletService || typeof walletService.getBalance !== 'function' || typeof walletService.listLedger !== 'function') {
    throw new TypeError('walletService with getBalance and listLedger is required');
  }
  if (!paymentService || typeof paymentService.createOrder !== 'function' || typeof paymentService.getOrder !== 'function') {
    throw new TypeError('paymentService with createOrder and getOrder is required');
  }
  if (!quoteService || typeof quoteService.issue !== 'function') {
    throw new TypeError('quoteService.issue is required');
  }
  if (typeof authenticateOwner !== 'function') throw new TypeError('authenticateOwner is required');

  return {
    requireUser(req, res, next) {
      try {
        req.billingOwnerEmail = authenticateOwner(req);
        return next();
      } catch (error) {
        return sendMappedError(res, error);
      }
    },
    // 4c183cd4 续命 P2 成本核算精确化：账务域内的管理员鉴权，复用 admin 角色检查
    requireAdmin(req, res, next) {
      try {
        const actorEmail = authenticateOwner(req);
        if (typeof authorizeAdmin !== 'function') {
          throw codedError('ADMIN_AUTH_UNAVAILABLE');
        }
        const access = authorizeAdmin(actorEmail);
        if (!access?.ok) {
          throw Object.assign(new Error(access?.error || 'admin access denied'), {
            code: 'AUTH_SESSION_UNAUTHORIZED',
            status: 403,
          });
        }
        req.billingOwnerEmail = actorEmail;
        return next();
      } catch (error) {
        return sendMappedError(res, error);
      }
    },
    // 4c183cd4 续命 P2：账务域内"全站毛利 + 异常用量预警"端点
    costSummary: handler((req, res) => {
      if (typeof costSummaryFn !== 'function') {
        throw Object.assign(new Error('cost summary 暂不可用'), { code: 'COST_SUMMARY_UNAVAILABLE', status: 503 });
      }
      const query = { ...req.query };
      return res.json(costSummaryFn(query));
    }),

    catalog: handler((_req, res) => res.json(publicCatalog(paymentService, paymentChannelRegistry))),

    legacyPaymentDisabled: handler((_req, res) => (
      res.status(503).json({ ...LEGACY_PAYMENT_DISABLED_BODY })
    )),

    balance: handler((req, res) => {
      const ownerEmail = ownerFor(req);
      const balances = Object.fromEntries(
        [...CURRENCIES].map(unit => [unit, walletService.getBalance(ownerEmail, unit)]),
      );
      return res.json({
        unlimited: Object.values(balances).some(balance => balance.unlimited),
        balances,
      });
    }),

    legacyCredits: handler((req, res) => {
      const balance = walletService.getBalance(ownerFor(req), 'content_sets');
      return res.json({
        credits: balance.availableUnits,
        availableUnits: balance.availableUnits,
        heldUnits: balance.heldUnits,
        unlimited: balance.unlimited,
      });
    }),

    quote: handler((req, res) => {
      const ownerEmail = ownerFor(req);
      const sku = identifier(req.body?.sku, 'sku');
      const quantity = pageNumber(req.body?.quantity, 1, 'quantity');
      const quote = quoteFeature(sku, quantity);
      const reference = quoteService.issue({ ownerEmail, quote });
      return res.json({ quote: publicQuote({ ...quote, ...reference }) });
    }),

    createOrder: handler((req, res) => {
      const ownerEmail = ownerFor(req);
      const productSku = identifier(req.body?.productSku, 'productSku');
      if (!Object.hasOwn(PRODUCTS, productSku)
        || PRODUCTS[productSku].enabled === false
        || PRODUCTS[productSku].currency !== 'ec_points') {
        throw codedError('BILLING_REQUEST_INVALID');
      }
      const order = paymentService.createOrder({
        ownerEmail,
        productSku,
        provider: identifier(req.body?.provider, 'provider'),
        idempotencyKey: identifier(req.body?.idempotencyKey, 'idempotencyKey'),
      });
      if (order !== null && typeof order === 'object' && typeof order.then === 'function') {
        return Promise.resolve(order)
          .then(created => res.status(201).json({ order: publicOrder(created) }));
      }
      return res.status(201).json({ order: publicOrder(order) });
    }),

    order: handler((req, res) => {
      const ownerEmail = ownerFor(req);
      const order = paymentService.getOrder(identifier(req.params?.id, 'orderId'));
      if (!order || order.ownerEmail !== ownerEmail) throw codedError('BILLING_ORDER_NOT_FOUND');
      return res.json({ order: publicOrder(order) });
    }),

    providerWebhook: handler((req, res) => {
      if (typeof paymentService.applyProviderEvent !== 'function') {
        throw codedError('PAYMENT_PROVIDER_DISABLED');
      }
      const provider = identifier(req.params?.provider, 'provider');
      const order = paymentService.applyProviderEvent(provider, req.body, {
        rawBody: req.rawBody,
        headers: req.headers,
      });
      if (order !== null && typeof order === 'object' && typeof order.then === 'function') {
        return Promise.resolve(order)
          .then(credited => res.json({ ok: true, order: publicOrder(credited) }));
      }
      return res.json({ ok: true, order: publicOrder(order) });
    }),

    // 4c183cd4 续命 P-B 视频按量切价：实时报价 (model/seconds/resolution -> cost + margin)
    videoMeter: handler((req, res) => {
      const quote = quoteVideoMeter({
        model: req.query?.model,
        seconds: req.query?.seconds,
        resolution: req.query?.resolution,
      });
      return res.json({ quote, tiers: listVideoMeterTiers({ includeHidden: false }) });
    }),

    ledger: handler((req, res) => {
      const ownerEmail = ownerFor(req);
      const selectedCurrency = currency(req.query?.currency);
      const limit = pageNumber(req.query?.limit, DEFAULT_PAGE_LIMIT, 'limit');
      const offset = pageNumber(req.query?.offset, 0, 'offset');
      const entries = walletService.listLedger(ownerEmail, selectedCurrency).slice(offset, offset + limit);
      return res.json({ currency: selectedCurrency, limit, offset, entries });
    }),
  };
}

export function mountBillingRoutes(app, deps) {
  if (!app || typeof app.get !== 'function' || typeof app.post !== 'function') {
    throw new TypeError('app with get and post is required');
  }
  const handlers = createBillingRouteHandlers(deps);
  app.get('/api/billing/catalog', handlers.catalog);
  app.get('/api/billing/balance', handlers.requireUser, handlers.balance);
  app.post('/api/billing/quote', handlers.requireUser, handlers.quote);
  app.post('/api/billing/orders', handlers.requireUser, handlers.createOrder);
  app.get('/api/billing/orders/:id', handlers.requireUser, handlers.order);
  app.post('/api/billing/webhooks/:provider', handlers.providerWebhook);
  app.get('/api/billing/ledger', handlers.requireUser, handlers.ledger);
  // 4c183cd4 续命 P-B 视频按量切价：GET 端点；公开报价 (无需登录)
  app.get('/api/billing/video-meter', handlers.videoMeter);
  // 4c183cd4 续命 P2 成本核算精确化：admin-only 全站毛利 + 异常用量预警
  app.get('/api/billing/cost-summary', handlers.requireAdmin, handlers.costSummary);
  app.post('/api/create-payment', handlers.legacyPaymentDisabled);
  app.get('/api/payment/success', handlers.legacyPaymentDisabled);
  app.post('/api/payment/webhook', handlers.legacyPaymentDisabled);
  app.get('/api/user/credits', handlers.requireUser, handlers.legacyCredits);
  return handlers;
}