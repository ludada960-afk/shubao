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
  const merchantOrderId = value.merchantOrderId ?? value.localOrderId;
  if (value.merchantOrderId !== undefined && value.localOrderId !== undefined
    && nonEmptyString(value.merchantOrderId, 'merchantOrderId')
      !== nonEmptyString(value.localOrderId, 'localOrderId')) {
    throw codedError('PAYMENT_PROVIDER_ORDER_CONFLICT', 'Provider event merchant order identifiers disagree');
  }
  if (merchantOrderId !== undefined) {
    event.merchantOrderId = nonEmptyString(merchantOrderId, 'merchantOrderId');
  }
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

function productSnapshotFromPayload(payload, order) {
  let product;
  try {
    product = JSON.parse(payload);
  } catch {
    throw new Error(`Payment order ${order.id} has an invalid catalog snapshot`);
  }
  if (!product || typeof product !== 'object'
    || typeof product.sku !== 'string' || product.sku.trim() === ''
    || typeof product.currency !== 'string' || product.currency.trim() === ''
    || !Number.isSafeInteger(product.priceFen) || product.priceFen <= 0
    || !Number.isSafeInteger(product.grantUnits) || product.grantUnits <= 0
    || (product.validityDays !== null
      && (!Number.isSafeInteger(product.validityDays) || product.validityDays < 0))) {
    throw new Error(`Payment order ${order.id} has an invalid catalog snapshot`);
  }
  return product;
}

function expiryForOrder(order, product) {
  if (product.validityDays === null) return null;
  const createdAtMs = Date.parse(order.createdAt);
  if (!Number.isFinite(createdAtMs)) {
    throw new Error(`Payment order ${order.id} has an invalid creation time`);
  }
  return new Date(createdAtMs + product.validityDays * DAY_MS).toISOString();
}

function isUniqueConstraint(error) {
  return error?.code === 'SQLITE_CONSTRAINT_UNIQUE' || error?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY';
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

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_provider_order_unique
    ON payment_orders (provider, provider_order_id)
    WHERE provider_order_id <> ''
  `);

  const statements = {
    insertOrder: db.prepare(`
      INSERT INTO payment_orders (
        id, owner_email, product_sku, catalog_version, amount_cny,
        grant_currency, grant_units, provider, provider_order_id, status,
        idempotency_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', 'pending', ?, ?, ?)
    `),
    insertCatalogSnapshot: db.prepare(`
      INSERT INTO billing_catalog (sku, version, payload, enabled, effective_at)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(sku, version) DO NOTHING
    `),
    selectOrderById: db.prepare('SELECT * FROM payment_orders WHERE id = ?'),
    selectOrderByIdempotencyKey: db.prepare('SELECT * FROM payment_orders WHERE idempotency_key = ?'),
    selectOrderByProviderOrder: db.prepare(`
      SELECT * FROM payment_orders WHERE provider = ? AND provider_order_id = ?
    `),
    selectOrderByAnyProviderOrder: db.prepare(`
      SELECT * FROM payment_orders WHERE provider_order_id = ?
    `),
    selectOrderByProviderAndId: db.prepare(`
      SELECT * FROM payment_orders WHERE provider = ? AND id = ?
    `),
    selectOrderByIdAnyProvider: db.prepare('SELECT * FROM payment_orders WHERE id = ?'),
    selectCatalogSnapshot: db.prepare(`
      SELECT payload FROM billing_catalog WHERE sku = ? AND version = ?
    `),
    updateProviderOrder: db.prepare(`
      UPDATE payment_orders
      SET provider_order_id = ?, updated_at = ?
      WHERE id = ? AND status = 'pending' AND provider_order_id = ''
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

  function paymentProviderOrderConflict() {
    return codedError('PAYMENT_PROVIDER_ORDER_CONFLICT', 'Provider order id is already bound to another payment order');
  }

  function orderForIdempotency(input, error) {
    const existing = orderFromRow(statements.selectOrderByIdempotencyKey.get(input.idempotencyKey));
    if (!existing) throw error;
    if (!sameOrderRequest(existing, input)) {
      throw codedError('PAYMENT_IDEMPOTENCY_CONFLICT', 'Payment order idempotency key conflicts with another request');
    }
    return existing;
  }

  const createOrderSnapshot = db.transaction((input, product) => {
    const existing = orderFromRow(statements.selectOrderByIdempotencyKey.get(input.idempotencyKey));
    if (existing) {
      if (!sameOrderRequest(existing, input)) {
        throw codedError('PAYMENT_IDEMPOTENCY_CONFLICT', 'Payment order idempotency key conflicts with another request');
      }
      return existing;
    }

    const now = new Date().toISOString();
    statements.insertCatalogSnapshot.run(product.sku, CATALOG_VERSION, JSON.stringify(product), now);
    const id = randomUUID();
    try {
      statements.insertOrder.run(
        id,
        input.ownerEmail,
        product.sku,
        CATALOG_VERSION,
        product.priceFen,
        product.currency,
        product.grantUnits,
        input.provider,
        input.idempotencyKey,
        now,
        now,
      );
    } catch (error) {
      if (isUniqueConstraint(error)) return orderForIdempotency(input, error);
      throw error;
    }
    return getOrder(id);
  });

  function providerSnapshot(order) {
    return {
      ...order,
      merchantOrderId: order.id,
      localOrderId: order.id,
      remoteIdempotencyKey: order.id,
    };
  }

  function bindProviderOrder(order, providerOrderId) {
    try {
      const update = statements.updateProviderOrder.run(
        providerOrderId,
        new Date().toISOString(),
        order.id,
      );
      if (update.changes === 1) return getOrder(order.id);
    } catch (error) {
      if (isUniqueConstraint(error)) throw paymentProviderOrderConflict();
      throw error;
    }
    const current = getOrder(order.id);
    if (current?.provider === order.provider && current.providerOrderId === providerOrderId) return current;
    throw paymentProviderOrderConflict();
  }

  function isTerminalProviderCreationError(error) {
    return error?.code === 'PAYMENT_PROVIDER_ORDER_REJECTED';
  }

  function createRemoteOrder(order, adapter) {
    let providerResult;
    try {
      providerResult = adapter.createOrder(providerSnapshot(order));
    } catch (error) {
      if (isTerminalProviderCreationError(error)) {
        statements.markCreateFailed.run(new Date().toISOString(), order.id);
      }
      throw error;
    }
    return bindProviderOrder(order, nonEmptyString(providerResult?.providerOrderId, 'providerOrderId'));
  }

  function createOrder(input) {
    const normalized = normalizeCreateInput(input);
    const product = getProduct(normalized.productSku);
    const adapter = adapterFor(normalized.provider, 'createOrder');
    const order = createOrderSnapshot(normalized, product);
    if (order.status === 'pending' && order.providerOrderId === '') {
      return createRemoteOrder(order, adapter);
    }
    return order;
  }

  const settleVerifiedEvent = db.transaction((provider, verifiedEvent) => {
    const processed = statements.insertProcessedEvent.run(
      provider,
      verifiedEvent.eventId,
      new Date().toISOString(),
    );
    let order = orderFromRow(
      statements.selectOrderByProviderOrder.get(provider, verifiedEvent.providerOrderId),
    );

    if (processed.changes === 0) {
      if (!order && verifiedEvent.merchantOrderId) {
        order = orderFromRow(statements.selectOrderByProviderAndId.get(provider, verifiedEvent.merchantOrderId));
      }
      if (!order || order.providerOrderId !== verifiedEvent.providerOrderId || order.status !== 'credited') {
        throw codedError('PAYMENT_EVENT_REPLAY_INVALID', 'Replayed provider event does not match a credited order');
      }
      return order;
    }

    if (order && verifiedEvent.merchantOrderId && order.id !== verifiedEvent.merchantOrderId) {
      throw paymentProviderOrderConflict();
    }
    if (!order && verifiedEvent.merchantOrderId) {
      order = orderFromRow(statements.selectOrderByProviderAndId.get(provider, verifiedEvent.merchantOrderId));
      if (!order) {
        const anyProviderOrder = orderFromRow(
          statements.selectOrderByIdAnyProvider.get(verifiedEvent.merchantOrderId),
        );
        if (anyProviderOrder) throw codedError('PAYMENT_PROVIDER_MISMATCH', 'Provider does not match the payment order');
      } else if (order.providerOrderId === '') {
        order = bindProviderOrder(order, verifiedEvent.providerOrderId);
      } else if (order.providerOrderId !== verifiedEvent.providerOrderId) {
        throw paymentProviderOrderConflict();
      }
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

    const catalogRow = statements.selectCatalogSnapshot.get(order.productSku, order.catalogVersion);
    if (!catalogRow) {
      throw new Error(`Payment order ${order.id} catalog snapshot was not found`);
    }
    const product = productSnapshotFromPayload(catalogRow.payload, order);
    walletService.grant({
      ownerEmail: order.ownerEmail,
      currency: product.currency,
      units: product.grantUnits,
      idempotencyKey: `payment-order-grant:${order.id}`,
      sourceType: 'payment_order',
      sourceId: order.id,
      expiresAt: expiryForOrder(order, product),
      metadata: {
        productSku: product.sku,
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
