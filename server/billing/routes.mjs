import { FEATURE_SKUS, PRODUCTS, quoteFeature } from './catalog.mjs';

const CURRENCIES = new Set(['ec_points', 'content_sets']);
const SAFE_IDENTIFIER = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;

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
  const normalized = value === undefined ? 'content_sets' : identifier(value, 'currency');
  if (!CURRENCIES.has(normalized)) throw codedError('BILLING_REQUEST_INVALID');
  return normalized;
}

function publicCatalog() {
  const products = Object.values(PRODUCTS)
    .filter(product => product.enabled !== false)
    .map(({ enabled, providerCostCny, ...product }) => ({ ...product }));
  const features = Object.entries(FEATURE_SKUS)
    .filter(([, feature]) => feature.enabled !== false)
    .map(([sku, feature]) => ({
      sku,
      units: feature.units,
      currency: feature.currency ?? 'ec_points',
    }));
  return { products, features };
}

function publicQuote(quote) {
  return {
    sku: quote.sku,
    quantity: quote.quantity,
    units: quote.units,
    totalUnits: quote.totalUnits,
    currency: quote.currency,
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
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
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
  if (error?.code === 'BILLING_INSUFFICIENT_CREDITS') {
    return {
      status: 402,
      body: { error: '额度不足，请购买套餐后继续', code: error.code, retryable: false },
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
      return fn(req, res);
    } catch (error) {
      return sendMappedError(res, error);
    }
  };
}

export function createBillingRouteHandlers({ walletService, paymentService, authenticateOwner } = {}) {
  if (!walletService || typeof walletService.getBalance !== 'function' || typeof walletService.listLedger !== 'function') {
    throw new TypeError('walletService with getBalance and listLedger is required');
  }
  if (!paymentService || typeof paymentService.createOrder !== 'function' || typeof paymentService.getOrder !== 'function') {
    throw new TypeError('paymentService with createOrder and getOrder is required');
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

    catalog: handler((_req, res) => res.json(publicCatalog())),

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

    quote: handler((req, res) => {
      ownerFor(req);
      const sku = identifier(req.body?.sku, 'sku');
      const quantity = pageNumber(req.body?.quantity, 1, 'quantity');
      return res.json({ quote: publicQuote(quoteFeature(sku, quantity)) });
    }),

    createOrder: handler((req, res) => {
      const ownerEmail = ownerFor(req);
      const productSku = identifier(req.body?.productSku, 'productSku');
      if (!Object.hasOwn(PRODUCTS, productSku) || PRODUCTS[productSku].enabled === false) {
        throw codedError('BILLING_REQUEST_INVALID');
      }
      const order = paymentService.createOrder({
        ownerEmail,
        productSku,
        provider: identifier(req.body?.provider, 'provider'),
        idempotencyKey: identifier(req.body?.idempotencyKey, 'idempotencyKey'),
      });
      return res.status(201).json({ order: publicOrder(order) });
    }),

    order: handler((req, res) => {
      const ownerEmail = ownerFor(req);
      const order = paymentService.getOrder(identifier(req.params?.id, 'orderId'));
      if (!order || order.ownerEmail !== ownerEmail) throw codedError('BILLING_ORDER_NOT_FOUND');
      return res.json({ order: publicOrder(order) });
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
  app.get('/api/billing/ledger', handlers.requireUser, handlers.ledger);
  return handlers;
}
