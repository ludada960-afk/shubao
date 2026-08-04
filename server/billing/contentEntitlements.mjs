import { resolveContentBillingConfig } from './contentBillingConfig.mjs';

const CONTENT_CURRENCY = 'content_sets';
const CONTENT_ITEM_KEY = 'content-set';
const CONTENT_ITEM_SKU = 'content_full_set';
const DAY_MS = 24 * 60 * 60 * 1000;
const PERMANENT_EXPIRY = '9999-12-31T23:59:59.999Z';
const GENERATED_ASSET_URL_RE = /^\/api\/generated-assets\/([a-f0-9]{64}\.(?:jpg|png|webp))$/;

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

function normalizeMode(value) {
  return nonEmptyString(value, 'mode').toLowerCase();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseJson(value, code, message) {
  try {
    const parsed = JSON.parse(value);
    if (!isPlainObject(parsed)) throw new TypeError();
    return parsed;
  } catch {
    throw codedError(code, message);
  }
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, sortJson(value[key])]),
    );
  }
  return value;
}

function fingerprint(value) {
  return JSON.stringify(sortJson(value));
}

function holdIdempotencyKey(generationId) {
  return `content-set:${generationId}:hold`;
}

function settleIdempotencyKey(generationId) {
  return `content-set:${generationId}:settle`;
}

function releaseIdempotencyKey(generationId) {
  return `content-set:${generationId}:release`;
}

function serverHoldMetadata({ generationId, workId, mode }) {
  return { generationId, workId, mode };
}

function normalizeSetInput(input = {}, { requireMode = false } = {}) {
  const normalized = {
    ownerEmail: normalizeOwnerEmail(input.ownerEmail),
    generationId: nonEmptyString(input.generationId, 'generationId'),
    workId: nonEmptyString(input.workId, 'workId'),
  };
  if (requireMode) normalized.mode = normalizeMode(input.mode);
  return normalized;
}

function normalizeRegenerationInput(input = {}, { requireKind = false } = {}) {
  const normalized = {
    ownerEmail: normalizeOwnerEmail(input.ownerEmail),
    workId: nonEmptyString(input.workId, 'workId'),
    regenerationId: nonEmptyString(input.regenerationId, 'regenerationId'),
  };
  if (requireKind) {
    const kind = nonEmptyString(input.kind, 'kind').toLowerCase();
    if (!['system', 'user'].includes(kind)) {
      throw new TypeError("kind must be 'system' or 'user'");
    }
    normalized.kind = kind;
  }
  return normalized;
}

function hasCopy(result) {
  if (!isPlainObject(result)) return false;
  for (const key of ['title', 'caption', 'body_text']) {
    if (typeof result[key] === 'string' && result[key].trim() !== '') return true;
  }
  return Array.isArray(result.copyLines)
    && result.copyLines.some(line => typeof line === 'string' && line.trim() !== '');
}

function generatedAssetId(value) {
  if (typeof value !== 'string') return null;
  return GENERATED_ASSET_URL_RE.exec(value)?.[1] ?? null;
}

export function isCompleteContentDelivery(result) {
  if (!isPlainObject(result)
    || !generatedAssetId(result.cover_url)
    || !Array.isArray(result.image_urls)) {
    return false;
  }
  const urls = [result.cover_url, ...result.image_urls];
  const assetIds = urls.map(generatedAssetId);
  return hasCopy(result)
    && urls.length === 9
    && assetIds.every(Boolean)
    && new Set(assetIds).size === assetIds.length;
}

export function isAcceptablePartialContentDelivery(result) {
  if (!isPlainObject(result) || !hasCopy(result)) return false;
  const urls = [];
  if (Object.hasOwn(result, 'cover_url')) urls.push(result.cover_url);
  if (Object.hasOwn(result, 'image_urls')) {
    if (!Array.isArray(result.image_urls)) return false;
    urls.push(...result.image_urls);
  }
  const assetIds = urls.map(generatedAssetId);
  return assetIds.length > 0
    && assetIds.every(Boolean)
    && new Set(assetIds).size === assetIds.length;
}

function catalogSourceError(reason) {
  return codedError(
    'CONTENT_ENTITLEMENT_SOURCE_INVALID',
    `Content entitlement source is invalid: ${reason}`,
  );
}

function validateProductSnapshot(payload, order) {
  let product;
  try {
    product = JSON.parse(payload);
  } catch {
    throw catalogSourceError('catalog payload is not valid JSON');
  }
  const regenerationRequired = order.grant_currency === CONTENT_CURRENCY;
  const validRegeneration = regenerationRequired
    ? Number.isSafeInteger(product.regenPerWork) && product.regenPerWork > 0
    : product.regenPerWork === undefined
      || product.regenPerWork === null
      || (Number.isSafeInteger(product.regenPerWork) && product.regenPerWork > 0);
  const validityDays = product.validityDays ?? null;
  if (!isPlainObject(product)
    || typeof product.sku !== 'string' || product.sku.trim() === ''
    || typeof product.currency !== 'string' || product.currency.trim() === ''
    || !Number.isSafeInteger(product.priceFen) || product.priceFen <= 0
    || !Number.isSafeInteger(product.grantUnits) || product.grantUnits <= 0
    || !validRegeneration
    || (validityDays !== null
      && (!Number.isSafeInteger(validityDays) || validityDays < 0))) {
    throw catalogSourceError('catalog payload has an invalid content product shape');
  }
  if (product.sku !== order.product_sku
    || product.currency !== order.grant_currency
    || product.priceFen !== order.amount_cny
    || product.grantUnits !== order.grant_units) {
    throw catalogSourceError('catalog payload does not match the payment order');
  }
  return { ...product, validityDays };
}

function expiryFromCompletion(completedAt, validityDays) {
  if (validityDays === null) return PERMANENT_EXPIRY;
  const timestamp = Date.parse(completedAt);
  if (!Number.isFinite(timestamp)) throw new TypeError('completedAt must be a valid date');
  return new Date(timestamp + validityDays * DAY_MS).toISOString();
}

function entitlementResult(row, planSnapshot = null) {
  const snapshot = planSnapshot ?? parseJson(
    row.plan_snapshot,
    'CONTENT_ENTITLEMENT_INTEGRITY_ERROR',
    `Entitlement ${row.work_id} has an invalid plan snapshot`,
  );
  const unlimited = snapshot.unlimited === true;
  return {
    workId: row.work_id,
    ownerEmail: row.owner_email,
    includedCount: row.included_count,
    usedCount: row.used_count,
    heldCount: row.held_count,
    availableCount: unlimited
      ? null
      : row.included_count - row.used_count - row.held_count,
    expiresAt: row.expires_at,
    unlimited,
    planSnapshot: snapshot,
  };
}

export function createContentEntitlements(db, walletService, options = {}) {
  if (!db || typeof db.prepare !== 'function' || typeof db.transaction !== 'function') {
    throw new TypeError('db must be a better-sqlite3 database');
  }
  if (!walletService
    || typeof walletService.createHold !== 'function'
    || typeof walletService.settleItem !== 'function'
    || typeof walletService.releaseItem !== 'function') {
    throw new TypeError('walletService hold, settle, and release methods are required');
  }
  const billingConfig = resolveContentBillingConfig(options);
  const contentCurrency = billingConfig.currency;
  const contentItemKey = billingConfig.itemKey;
  const contentItemSku = billingConfig.itemSku;
  const contentItemUnits = billingConfig.itemUnits;

  const statements = {
    selectHoldByKey: db.prepare('SELECT * FROM billing_holds WHERE idempotency_key = ?'),
    selectHoldItem: db.prepare(`
      SELECT * FROM billing_hold_items WHERE hold_id = ? AND item_key = ?
    `),
    selectLot: db.prepare('SELECT * FROM credit_lots WHERE id = ?'),
    selectPaymentOrder: db.prepare('SELECT * FROM payment_orders WHERE id = ?'),
    selectCatalog: db.prepare(`
      SELECT payload FROM billing_catalog WHERE sku = ? AND version = ?
    `),
    selectEntitlement: db.prepare(`
      SELECT * FROM work_regeneration_entitlements WHERE work_id = ?
    `),
    insertEntitlement: db.prepare(`
      INSERT INTO work_regeneration_entitlements (
        work_id, owner_email, included_count, used_count, held_count,
        expires_at, plan_snapshot
      ) VALUES (?, ?, ?, 0, 0, ?, ?)
    `),
    updateEntitlement: db.prepare(`
      UPDATE work_regeneration_entitlements
      SET used_count = ?, held_count = ?, plan_snapshot = ?
      WHERE work_id = ? AND owner_email = ?
        AND used_count = ? AND held_count = ?
        AND ? >= 0 AND ? >= 0
    `),
  };

  function loadSetContext(input) {
    const idempotencyKey = holdIdempotencyKey(input.generationId);
    const hold = statements.selectHoldByKey.get(idempotencyKey);
    if (!hold) {
      throw codedError('CONTENT_SET_NOT_FOUND', `Unknown content generation: ${input.generationId}`);
    }
    if (hold.owner_email !== input.ownerEmail) {
      throw codedError(
        'CONTENT_ENTITLEMENT_OWNER_MISMATCH',
        'Content generation belongs to another owner',
      );
    }
    if (hold.currency !== contentCurrency
      || hold.quote_id !== input.generationId
      || hold.total_units !== contentItemUnits) {
      throw catalogSourceError('hold identity does not match the content generation');
    }

    const envelope = parseJson(
      hold.metadata,
      'CONTENT_ENTITLEMENT_SOURCE_INVALID',
      'Content hold accounting metadata is invalid',
    );
    const userMetadata = envelope.userMetadata;
    const internal = envelope._walletService;
    if (!isPlainObject(userMetadata)
      || userMetadata.generationId !== input.generationId
      || userMetadata.workId !== input.workId
      || typeof userMetadata.mode !== 'string'
      || userMetadata.mode.trim() === '') {
      throw codedError(
        'CONTENT_ENTITLEMENT_CONFLICT',
        'Content generation conflicts with its server context',
      );
    }
    const mode = userMetadata.mode;
    const item = statements.selectHoldItem.get(hold.id, contentItemKey);
    if (!item
      || item.sku !== contentItemSku
      || item.units !== contentItemUnits) {
      throw catalogSourceError('content hold item is invalid');
    }

    const expectedFingerprint = fingerprint({
      ownerEmail: input.ownerEmail,
      currency: contentCurrency,
      quoteId: input.generationId,
      idempotencyKey,
      expiresAt: null,
      items: [{ key: contentItemKey, sku: contentItemSku, units: contentItemUnits }],
      metadata: serverHoldMetadata({ ...input, mode }),
    });
    if (!isPlainObject(internal)
      || internal.version !== 1
      || internal.operation !== 'hold'
      || internal.fingerprint !== expectedFingerprint
      || internal.holdId !== hold.id
      || !['paid', 'unlimited'].includes(internal.accountingMode)
      || !Array.isArray(internal.allocations)
      || internal.allocations.length !== 1) {
      throw catalogSourceError('wallet hold envelope could not be verified');
    }
    const allocation = internal.allocations[0];
    if (!isPlainObject(allocation)
      || allocation.itemId !== item.id
      || allocation.itemKey !== item.item_key
      || !Array.isArray(allocation.lots)) {
      throw catalogSourceError('wallet item allocation could not be verified');
    }
    return { hold, item, internal, allocation, mode };
  }

  function provePaidSource(context) {
    if (context.internal.accountingMode !== 'paid'
      || context.internal.result?.balance?.unlimited !== false
      || context.allocation.lots.length === 0) {
      throw catalogSourceError('paid hold accounting mode is inconsistent');
    }
    let allocatedUnits = 0;
    let paymentOrderId = null;
    const lots = [];
    for (const reserved of context.allocation.lots) {
      if (!isPlainObject(reserved)
        || typeof reserved.lotId !== 'string' || reserved.lotId.trim() === ''
        || !Number.isSafeInteger(reserved.units) || reserved.units <= 0) {
        throw catalogSourceError('paid lot allocation is malformed');
      }
      allocatedUnits += reserved.units;
      if (!Number.isSafeInteger(allocatedUnits)) {
        throw catalogSourceError('paid lot allocation overflowed');
      }
      const lot = statements.selectLot.get(reserved.lotId);
      if (!lot
        || lot.owner_email !== context.hold.owner_email
        || lot.currency !== contentCurrency
        || lot.source_type !== 'payment_order'
        || (lot.expires_at ?? null) !== (reserved.expiresAt ?? null)) {
        throw catalogSourceError('allocated credit lot does not prove a paid source');
      }
      if (paymentOrderId !== null && paymentOrderId !== lot.source_id) {
        throw catalogSourceError('content set spans multiple payment orders');
      }
      paymentOrderId = lot.source_id;
      lots.push(lot);
    }
    if (allocatedUnits !== context.item.units || paymentOrderId === null) {
      throw catalogSourceError('paid allocation does not match the held item');
    }

    const order = statements.selectPaymentOrder.get(paymentOrderId);
    if (!order
      || order.owner_email !== context.hold.owner_email
      || order.grant_currency !== contentCurrency
      || order.status !== 'credited') {
      throw catalogSourceError('payment order does not match the paid hold');
    }
    const catalog = statements.selectCatalog.get(order.product_sku, order.catalog_version);
    if (!catalog) throw catalogSourceError('payment catalog snapshot was not found');
    const product = validateProductSnapshot(catalog.payload, order);
    const orderCreatedAt = Date.parse(order.created_at);
    if (!Number.isFinite(orderCreatedAt)) {
      throw catalogSourceError('payment order creation time is invalid');
    }
    const expectedLotExpiry = product.validityDays === null
      ? null
      : new Date(orderCreatedAt + product.validityDays * DAY_MS).toISOString();
    for (const lot of lots) {
      if (lot.granted_units !== order.grant_units
        || (lot.expires_at ?? null) !== expectedLotExpiry) {
        throw catalogSourceError('credit lot does not match the payment snapshot');
      }
    }
    return {
      paymentOrderId: order.id,
      productSku: product.sku,
      catalogVersion: order.catalog_version,
      regenPerWork: product.regenPerWork ?? null,
      validityDays: product.validityDays,
      unlimited: false,
    };
  }

  function proveSource(context) {
    if (context.internal.accountingMode === 'unlimited') {
      if (context.allocation.lots.length !== 0
        || context.internal.result?.balance?.unlimited !== true) {
        throw catalogSourceError('unlimited hold accounting mode is inconsistent');
      }
      return {
        paymentOrderId: null,
        productSku: contentItemSku,
        catalogVersion: null,
        regenPerWork: null,
        validityDays: null,
        unlimited: true,
      };
    }
    return provePaidSource(context);
  }

  function validateStoredPlan(row) {
    const plan = parseJson(
      row.plan_snapshot,
      'CONTENT_ENTITLEMENT_INTEGRITY_ERROR',
      `Entitlement ${row.work_id} has an invalid plan snapshot`,
    );
    if (plan.version !== 1
      || plan.workId !== row.work_id
      || plan.ownerEmail !== row.owner_email
      || typeof plan.generationId !== 'string' || plan.generationId.trim() === ''
      || typeof plan.mode !== 'string' || plan.mode.trim() === ''
      || typeof plan.unlimited !== 'boolean'
      || !Array.isArray(plan.attempts)
      || row.used_count < 0
      || row.held_count < 0
      || row.used_count + row.held_count > row.included_count
      || (plan.unlimited && (row.included_count !== 0
        || row.used_count !== 0 || row.held_count !== 0
        || plan.paymentOrderId !== null || plan.regenPerWork !== null))
      || (!plan.unlimited && (
        typeof plan.paymentOrderId !== 'string' || plan.paymentOrderId.trim() === ''
        || (plan.regenPerWork === null
          ? row.included_count !== 0 || row.used_count !== 0 || row.held_count !== 0
          : !Number.isSafeInteger(plan.regenPerWork) || plan.regenPerWork !== row.included_count)
      ))) {
      throw codedError(
        'CONTENT_ENTITLEMENT_INTEGRITY_ERROR',
        `Entitlement ${row.work_id} violates its stored plan`,
      );
    }
    return plan;
  }

  function matchingCompletedEntitlement(row, context) {
    if (!row) return null;
    if (row.owner_email !== context.hold.owner_email) {
      throw codedError(
        'CONTENT_ENTITLEMENT_OWNER_MISMATCH',
        'Work belongs to another owner',
      );
    }
    const plan = validateStoredPlan(row);
    if (plan.generationId !== context.hold.quote_id
      || plan.mode !== context.mode
      || plan.holdId !== context.hold.id) {
      throw codedError(
        'CONTENT_ENTITLEMENT_CONFLICT',
        'Work is already bound to another content source',
      );
    }
    if (context.item.status !== 'settled') {
      throw codedError(
        'CONTENT_ENTITLEMENT_CONFLICT',
        'Work entitlement exists before its content set was settled',
      );
    }
    return {
      status: 'settled',
      holdId: context.hold.id,
      workId: row.work_id,
      settlement: plan.settlement ?? null,
      entitlement: entitlementResult(row, plan),
    };
  }

  const completeSetTx = db.transaction((input, result, acceptedPartial) => {
    const context = loadSetContext(input);
    const existingRow = statements.selectEntitlement.get(input.workId);
    const completed = matchingCompletedEntitlement(existingRow, context);
    if (completed) return completed;
    if (context.item.status !== 'pending') {
      throw codedError(
        'CONTENT_SET_STATE_INVALID',
        `Content set cannot complete from ${context.item.status}`,
      );
    }
    if (acceptedPartial && !isAcceptablePartialContentDelivery(result)) {
      throw codedError(
        'CONTENT_PARTIAL_DELIVERY_INVALID',
        'Accepted partial delivery requires unique stable assets and non-blank copy',
      );
    }
    if (!acceptedPartial && !isCompleteContentDelivery(result)) {
      return {
        status: 'needs_review',
        holdId: context.hold.id,
        workId: input.workId,
      };
    }
    if (existingRow) {
      throw codedError(
        'CONTENT_ENTITLEMENT_CONFLICT',
        'Work is already bound to another content source',
      );
    }

    const source = proveSource(context);
    const completedAt = new Date().toISOString();
    const expiresAt = expiryFromCompletion(completedAt, source.validityDays);
    const settlement = walletService.settleItem(context.hold.id, contentItemKey, {
      referenceType: 'content_work',
      referenceId: input.workId,
      providerCostCny: 0,
      idempotencyKey: settleIdempotencyKey(input.generationId),
      metadata: {
        generationId: input.generationId,
        workId: input.workId,
        mode: context.mode,
        acceptedPartial,
      },
    });
    const planSnapshot = {
      version: 1,
      workId: input.workId,
      ownerEmail: input.ownerEmail,
      paymentOrderId: source.paymentOrderId,
      productSku: source.productSku,
      currency: contentCurrency,
      itemKey: contentItemKey,
      itemUnits: contentItemUnits,
      catalogVersion: source.catalogVersion,
      regenPerWork: source.regenPerWork,
      validityDays: source.validityDays,
      mode: context.mode,
      generationId: input.generationId,
      holdId: context.hold.id,
      unlimited: source.unlimited,
      acceptedPartial,
      completedAt,
      settlement: {
        status: settlement.status,
        holdId: settlement.holdId,
        itemKey: settlement.itemKey,
        units: settlement.units,
        referenceId: settlement.referenceId,
        usageEventId: settlement.usageEventId,
        ledgerId: settlement.ledgerId,
      },
      attempts: [],
    };
    statements.insertEntitlement.run(
      input.workId,
      input.ownerEmail,
      source.unlimited || source.regenPerWork === null ? 0 : source.regenPerWork,
      expiresAt,
      JSON.stringify(planSnapshot),
    );
    const row = statements.selectEntitlement.get(input.workId);
    return {
      status: 'settled',
      holdId: context.hold.id,
      workId: input.workId,
      settlement,
      entitlement: entitlementResult(row, planSnapshot),
    };
  });

  const failSetTx = db.transaction((input, reason) => {
    const context = loadSetContext(input);
    if (context.item.status === 'settled') {
      throw codedError('CONTENT_SET_STATE_INVALID', 'Settled content set cannot be released');
    }
    if (context.item.status === 'released') {
      if (context.item.reference_id !== reason) {
        throw codedError(
          'CONTENT_SET_IDEMPOTENCY_CONFLICT',
          'Content set was released with a different reason',
        );
      }
      return {
        status: 'released',
        holdId: context.hold.id,
        workId: input.workId,
        reason,
      };
    }
    const release = walletService.releaseItem(context.hold.id, contentItemKey, {
      reason,
      idempotencyKey: releaseIdempotencyKey(input.generationId),
      metadata: {
        generationId: input.generationId,
        workId: input.workId,
        mode: context.mode,
      },
    });
    return {
      status: 'released',
      holdId: context.hold.id,
      workId: input.workId,
      reason,
      release,
    };
  });

  function loadEntitlement(input) {
    const row = statements.selectEntitlement.get(input.workId);
    if (!row) {
      throw codedError(
        'CONTENT_ENTITLEMENT_NOT_FOUND',
        `Unknown work entitlement: ${input.workId}`,
      );
    }
    if (row.owner_email !== input.ownerEmail) {
      throw codedError(
        'CONTENT_ENTITLEMENT_OWNER_MISMATCH',
        'Work entitlement belongs to another owner',
      );
    }
    return { row, plan: validateStoredPlan(row) };
  }

  function findAttempt(plan, regenerationId) {
    return plan.attempts.find(attempt => attempt?.regenerationId === regenerationId) ?? null;
  }

  function saveAttemptState(row, plan, nextUsed, nextHeld) {
    if (!Number.isSafeInteger(nextUsed) || nextUsed < 0
      || !Number.isSafeInteger(nextHeld) || nextHeld < 0
      || (!plan.unlimited && nextUsed + nextHeld > row.included_count)
      || (plan.unlimited && (nextUsed !== 0 || nextHeld !== 0))) {
      throw codedError(
        'CONTENT_ENTITLEMENT_INTEGRITY_ERROR',
        'Regeneration counters would violate the entitlement',
      );
    }
    const update = statements.updateEntitlement.run(
      nextUsed,
      nextHeld,
      JSON.stringify(plan),
      row.work_id,
      row.owner_email,
      row.used_count,
      row.held_count,
      nextUsed,
      nextHeld,
    );
    if (update.changes !== 1) {
      throw codedError(
        'CONTENT_ENTITLEMENT_CONFLICT',
        'Regeneration entitlement changed concurrently',
      );
    }
    return statements.selectEntitlement.get(row.work_id);
  }

  function attemptResult(row, plan, attempt) {
    return {
      status: attempt.status,
      kind: attempt.kind,
      regenerationId: attempt.regenerationId,
      workId: row.work_id,
      entitlement: entitlementResult(row, plan),
    };
  }

  const holdRegenerationTx = db.transaction(input => {
    const { row, plan } = loadEntitlement(input);
    const existing = findAttempt(plan, input.regenerationId);
    if (existing) {
      if (existing.kind !== input.kind) {
        throw codedError(
          'CONTENT_REGEN_ATTEMPT_CONFLICT',
          'Regeneration id is already bound to another kind',
        );
      }
      if (existing.status !== 'held') {
        throw codedError(
          'CONTENT_REGEN_STATE_INVALID',
          `Regeneration cannot be held from ${existing.status}`,
        );
      }
      return attemptResult(row, plan, existing);
    }

    if (input.kind === 'user' && !plan.unlimited) {
      const expiresAt = Date.parse(row.expires_at);
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        throw codedError('CONTENT_REGEN_EXPIRED', 'Regeneration entitlement has expired');
      }
      if (row.included_count - row.used_count - row.held_count <= 0) {
        throw codedError(
          'CONTENT_REGEN_INSUFFICIENT',
          'No regeneration credits are available',
        );
      }
    }

    const attempt = {
      regenerationId: input.regenerationId,
      kind: input.kind,
      status: 'held',
      heldAt: new Date().toISOString(),
    };
    plan.attempts = [...plan.attempts, attempt];
    const nextHeld = input.kind === 'user' && !plan.unlimited
      ? row.held_count + 1
      : row.held_count;
    const nextRow = saveAttemptState(row, plan, row.used_count, nextHeld);
    return attemptResult(nextRow, plan, attempt);
  });

  const completeRegenerationTx = db.transaction(input => {
    const { row, plan } = loadEntitlement(input);
    const attempt = findAttempt(plan, input.regenerationId);
    if (!attempt) {
      throw codedError(
        'CONTENT_REGEN_ATTEMPT_NOT_FOUND',
        `Unknown regeneration attempt: ${input.regenerationId}`,
      );
    }
    if (attempt.status === 'completed') return attemptResult(row, plan, attempt);
    if (attempt.status !== 'held') {
      throw codedError(
        'CONTENT_REGEN_STATE_INVALID',
        `Regeneration cannot complete from ${attempt.status}`,
      );
    }

    let nextUsed = row.used_count;
    let nextHeld = row.held_count;
    if (attempt.kind === 'user' && !plan.unlimited) {
      if (nextHeld <= 0 || nextUsed >= row.included_count) {
        throw codedError(
          'CONTENT_ENTITLEMENT_INTEGRITY_ERROR',
          'User regeneration counters are inconsistent',
        );
      }
      nextHeld -= 1;
      nextUsed += 1;
    }
    attempt.status = 'completed';
    attempt.completedAt = new Date().toISOString();
    const nextRow = saveAttemptState(row, plan, nextUsed, nextHeld);
    return attemptResult(nextRow, plan, attempt);
  });

  const releaseRegenerationTx = db.transaction(input => {
    const { row, plan } = loadEntitlement(input);
    const attempt = findAttempt(plan, input.regenerationId);
    if (!attempt) {
      throw codedError(
        'CONTENT_REGEN_ATTEMPT_NOT_FOUND',
        `Unknown regeneration attempt: ${input.regenerationId}`,
      );
    }
    if (attempt.status === 'released') return attemptResult(row, plan, attempt);
    if (attempt.status !== 'held') {
      throw codedError(
        'CONTENT_REGEN_STATE_INVALID',
        `Regeneration cannot release from ${attempt.status}`,
      );
    }

    let nextHeld = row.held_count;
    if (attempt.kind === 'user' && !plan.unlimited) {
      if (nextHeld <= 0) {
        throw codedError(
          'CONTENT_ENTITLEMENT_INTEGRITY_ERROR',
          'User regeneration held count is inconsistent',
        );
      }
      nextHeld -= 1;
    }
    attempt.status = 'released';
    attempt.releasedAt = new Date().toISOString();
    const nextRow = saveAttemptState(row, plan, row.used_count, nextHeld);
    return attemptResult(nextRow, plan, attempt);
  });

  return {
    holdSet(input) {
      const normalized = normalizeSetInput(input, { requireMode: true });
      return walletService.createHold({
        ownerEmail: normalized.ownerEmail,
        currency: contentCurrency,
        quoteId: normalized.generationId,
        idempotencyKey: holdIdempotencyKey(normalized.generationId),
        items: [{ key: contentItemKey, sku: contentItemSku, units: contentItemUnits }],
        metadata: serverHoldMetadata(normalized),
      });
    },

    completeSet(input) {
      const normalized = normalizeSetInput(input);
      return completeSetTx.immediate(normalized, input?.result, false);
    },

    acceptPartial(input) {
      const normalized = normalizeSetInput(input);
      return completeSetTx.immediate(normalized, input?.result, true);
    },

    failSet(input) {
      const normalized = normalizeSetInput(input);
      const reason = input?.reason === undefined
        ? 'generation_failed'
        : nonEmptyString(input.reason, 'reason');
      return failSetTx.immediate(normalized, reason);
    },

    holdRegeneration(input) {
      return holdRegenerationTx.immediate(
        normalizeRegenerationInput(input, { requireKind: true }),
      );
    },

    completeRegeneration(input) {
      return completeRegenerationTx.immediate(normalizeRegenerationInput(input));
    },

    releaseRegeneration(input) {
      return releaseRegenerationTx.immediate(normalizeRegenerationInput(input));
    },
  };
}
