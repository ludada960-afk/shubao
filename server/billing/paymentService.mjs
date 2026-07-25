import { randomUUID } from 'node:crypto';
import { getProduct } from './catalog.mjs';

const CATALOG_VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

function codedError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeOwnerEmail(value) {
  return nonEmptyString(value, 'ownerEmail').toLowerCase();
}

function normalizeProvider(value) {
  return nonEmptyString(value, 'provider').toLowerCase();
}

function normalizeCreateInput(input = {}) {
  return {
    ownerEmail: normalizeOwnerEmail(input.ownerEmail),
    productSku: nonEmptyString(input.productSku, 'productSku'),
    provider: normalizeProvider(input.provider),
    idempotencyKey: nonEmptyString(input.idempotencyKey, 'idempotencyKey'),
  };
}

function normalizeVerifiedEvent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('verified event must be an object');
  }
  const event = {
    eventId: nonEmptyString(value.eventId, 'eventId'),
    providerOrderId: nonEmptyString(value.providerOrderId, 'providerOrderId'),
    status: nonEmptyString(value.status, 'status').toLowerCase(),
  };
  if (event.status !== 'paid') {
    throw codedError('PAYMENT_EVENT_NOT_PAID', 'Provider event must have paid status');
  }
  return event;
}

function orderFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    productSku: row.product_sku,
    catalogVersion: row.catalog_version,
    amountCny: row.amount_cny,
    grantCurrency: row.grant_currency,
    grantUnits: row.grant_units,
    provider: row.provider,
    providerOrderId: row.provider_order_id,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sameOrderRequest(order, input) {
  return order.ownerEmail === input.ownerEmail
    && order.productSku === input.productSku
    && order.provider === input.provider;
}

function expiryForOrder(order) {
  const product = getProduct(order.productSku);
  if (product.validityDays === null) return null;
  const createdAtMs = Date.parse(order.createdAt);
  if (!Number.isFinite(createdAtMs)) {
    throw new Error(`Payment order ${order.id} has an invalid creation time`);
  }
  return new Date(createdAtMs + product.validityDays * DAY_MS).toISOString();
}

export function createPaymentService(db, walletService, providers = {}) {
  if (!db || typeof db.prepare !== 'function' || typeof db.transaction !== 'function') {
    throw new TypeError('db must be a better-sqlite3 database');
  }
  if (!walletService || typeof walletService.grant !== 'function') {
    throw new TypeError('walletService.grant is required');
  }
  if (!providers || typeof providers !== 'object') {
    throw new TypeError('providers must be an object');
  }

  const statements = {
    insertOrder: db.prepare(`
      INSERT INTO payment_orders (
        id, owner_email, product_sku, catalog_version, amount_cny,
        grant_currency, grant_units, provider, provider_order_id, status,
        idempotency_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', 'pending', ?, ?, ?)
    `),
    selectOrderById: db.prepare('SELECT * FROM payment_orders WHERE id = ?'),
    selectOrderByIdempotencyKey: db.prepare('SELECT * FROM payment_orders WHERE idempotency_key = ?'),
    selectOrderByProviderOrder: db.prepare(`
      SELECT * FROM payment_orders WHERE provider = ? AND provider_order_id = ?
    `),
    selectOrderByAnyProviderOrder: db.prepare(`
      SELECT * FROM payment_orders WHERE provider_order_id = ?
    `),
    updateProviderOrder: db.prepare(`
      UPDATE payment_orders
      SET provider_order_id = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'
    `),
    markCreateFailed: db.prepare(`
      UPDATE payment_orders SET status = 'failed', updated_at = ? WHERE id = ?
    `),
    markPaid: db.prepare(`
      UPDATE payment_orders SET status = 'paid', updated_at = ? WHERE id = ? AND status = 'pending'
    `),
    markCredited: db.prepare(`
      UPDATE payment_orders SET status = 'credited', updated_at = ? WHERE id = ? AND status = 'paid'
    `),
    insertProcessedEvent: db.prepare(`
      INSERT INTO processed_provider_events (provider, event_id, processed_at)
      VALUES (?, ?, ?)
      ON CONFLICT(provider, event_id) DO NOTHING
    `),
  };

  function adapterFor(provider, operation) {
    const adapter = providers[provider];
    if (!adapter?.enabled || typeof adapter[operation] !== 'function') {
      throw codedError('PAYMENT_PROVIDER_DISABLED', `Payment provider ${provider} is disabled`);
    }
    return adapter;
  }

  function getOrder(id) {
    return orderFromRow(statements.selectOrderById.get(nonEmptyString(id, 'orderId')));
  }

  function createOrder(input) {
    const normalized = normalizeCreateInput(input);
    const product = getProduct(normalized.productSku);
    const adapter = adapterFor(normalized.provider, 'createOrder');
    const existing = orderFromRow(statements.selectOrderByIdempotencyKey.get(normalized.idempotencyKey));
    if (existing) {
      if (!sameOrderRequest(existing, normalized)) {
        throw codedError('PAYMENT_IDEMPOTENCY_CONFLICT', 'Payment order idempotency key conflicts with another request');
      }
      return existing;
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    statements.insertOrder.run(
      id,
      normalized.ownerEmail,
      product.sku,
      CATALOG_VERSION,
      product.priceFen,
      product.currency,
      product.grantUnits,
      normalized.provider,
      normalized.idempotencyKey,
      now,
      now,
    );
    const snapshot = getOrder(id);

    try {
      const providerResult = adapter.createOrder({ ...snapshot });
      const providerOrderId = nonEmptyString(providerResult?.providerOrderId, 'providerOrderId');
      const update = statements.updateProviderOrder.run(providerOrderId, new Date().toISOString(), id);
      if (update.changes !== 1) {
        throw new Error(`Unable to attach provider order to payment order ${id}`);
      }
    } catch (error) {
      statements.markCreateFailed.run(new Date().toISOString(), id);
      throw error;
    }
    return getOrder(id);
  }

  const settleVerifiedEvent = db.transaction((provider, verifiedEvent) => {
    const processed = statements.insertProcessedEvent.run(
      provider,
      verifiedEvent.eventId,
      new Date().toISOString(),
    );
    const order = orderFromRow(
      statements.selectOrderByProviderOrder.get(provider, verifiedEvent.providerOrderId),
    );

    if (processed.changes === 0) {
      if (!order || order.status !== 'credited') {
        throw codedError('PAYMENT_EVENT_REPLAY_INVALID', 'Replayed provider event does not match a credited order');
      }
      return order;
    }

    if (!order) {
      const mismatchedOrder = orderFromRow(
        statements.selectOrderByAnyProviderOrder.get(verifiedEvent.providerOrderId),
      );
      if (mismatchedOrder) {
        throw codedError('PAYMENT_PROVIDER_MISMATCH', 'Provider does not match the payment order');
      }
      throw codedError('PAYMENT_ORDER_NOT_FOUND', 'Payment order was not found for provider event');
    }
    if (order.status !== 'pending') {
      throw codedError('PAYMENT_ORDER_STATE_INVALID', `Payment order ${order.id} cannot be settled from ${order.status}`);
    }
    if (statements.markPaid.run(new Date().toISOString(), order.id).changes !== 1) {
      throw codedError('PAYMENT_ORDER_STATE_INVALID', `Payment order ${order.id} could not enter paid state`);
    }

    walletService.grant({
      ownerEmail: order.ownerEmail,
      currency: order.grantCurrency,
      units: order.grantUnits,
      idempotencyKey: `payment-order-grant:${order.id}`,
      sourceType: 'payment_order',
      sourceId: order.id,
      expiresAt: expiryForOrder(order),
      metadata: {
        productSku: order.productSku,
        provider: order.provider,
        providerOrderId: order.providerOrderId,
        paymentOrderId: order.id,
      },
    });
    if (statements.markCredited.run(new Date().toISOString(), order.id).changes !== 1) {
      throw codedError('PAYMENT_ORDER_STATE_INVALID', `Payment order ${order.id} could not be credited`);
    }
    return getOrder(order.id);
  });

  function applyProviderEvent(providerInput, event) {
    const provider = normalizeProvider(providerInput);
    const adapter = adapterFor(provider, 'verifyEvent');
    const verifiedEvent = normalizeVerifiedEvent(adapter.verifyEvent(event));
    return settleVerifiedEvent(provider, verifiedEvent);
  }

  return { createOrder, applyProviderEvent, getOrder };
}
