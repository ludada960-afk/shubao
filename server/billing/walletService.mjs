import { randomUUID } from 'node:crypto';

const INTERNAL_METADATA_KEY = '_walletService';
const INTERNAL_METADATA_VERSION = 1;
const DEFAULT_HOLD_DURATION_MS = 60 * 60 * 1000;
const KNOWN_OPERATIONS = new Set([
  'grant',
  'hold',
  'settle',
  'release',
  'release_remainder',
  'expire',
]);

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be non-empty`);
  }
  return value.trim();
}

function positiveSafeInteger(value, label = 'units') {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer`);
  }
  return value;
}

function checkedAdd(left, right, label) {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new RangeError(`${label} must remain a safe integer`);
  }
  return result;
}

function providerCost(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError('providerCostCny must be finite and non-negative');
  }
  return value;
}

function jsonValue(value, label = 'metadata') {
  const normalized = value === undefined ? {} : value;
  try {
    const serialized = JSON.stringify(normalized);
    if (serialized === undefined) throw new TypeError();
    return JSON.parse(serialized);
  } catch {
    throw new TypeError(`${label} must be JSON-serializable`);
  }
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, sortJson(value[key])]),
    );
  }
  return value;
}

function fingerprint(value) {
  return JSON.stringify(sortJson(value));
}

function parseJsonSafely(value, fallback = {}) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasNonEmptyString(value, key) {
  return typeof value?.[key] === 'string' && value[key].trim() !== '';
}

function hasBalanceShape(value) {
  return isPlainObject(value)
    && Number.isSafeInteger(value.availableUnits)
    && Number.isSafeInteger(value.heldUnits)
    && typeof value.unlimited === 'boolean';
}

function hasStoredResultShape(operation, result) {
  if (!isPlainObject(result)) return false;
  if (operation === 'grant') {
    return hasNonEmptyString(result, 'id')
      && hasNonEmptyString(result, 'creditLotId')
      && hasNonEmptyString(result, 'ledgerId')
      && hasBalanceShape(result.balance);
  }
  if (operation === 'hold') {
    return hasNonEmptyString(result, 'id')
      && hasNonEmptyString(result, 'ledgerId')
      && Array.isArray(result.items)
      && hasBalanceShape(result.balance);
  }
  if (operation === 'settle') {
    return result.status === 'settled'
      && hasNonEmptyString(result, 'holdId')
      && hasNonEmptyString(result, 'itemId')
      && hasNonEmptyString(result, 'itemKey')
      && hasNonEmptyString(result, 'usageEventId')
      && hasNonEmptyString(result, 'ledgerId')
      && hasBalanceShape(result.balance);
  }
  if (operation === 'release') {
    return result.status === 'released'
      && hasNonEmptyString(result, 'holdId')
      && hasNonEmptyString(result, 'itemId')
      && hasNonEmptyString(result, 'itemKey')
      && hasNonEmptyString(result, 'ledgerId')
      && hasBalanceShape(result.balance);
  }
  if (operation === 'release_remainder') {
    return hasNonEmptyString(result, 'holdId')
      && hasNonEmptyString(result, 'ledgerId')
      && Array.isArray(result.releasedItemKeys)
      && hasBalanceShape(result.balance);
  }
  if (operation === 'expire') {
    return hasNonEmptyString(result, 'ledgerId')
      && Array.isArray(result.lotIds)
      && result.lotIds.length > 0
      && Number.isSafeInteger(result.expiredUnits)
      && result.expiredUnits > 0
      && hasBalanceShape(result.balance);
  }
  return false;
}

function readMetadataEnvelope(rawMetadata, fallback = {}) {
  const parsed = parseJsonSafely(rawMetadata, fallback);
  const internal = isPlainObject(parsed) ? parsed[INTERNAL_METADATA_KEY] : null;
  const valid = isPlainObject(parsed)
    && Object.prototype.hasOwnProperty.call(parsed, 'userMetadata')
    && isPlainObject(internal)
    && internal.version === INTERNAL_METADATA_VERSION
    && KNOWN_OPERATIONS.has(internal.operation)
    && typeof internal.fingerprint === 'string'
    && internal.fingerprint.trim() !== ''
    && hasStoredResultShape(internal.operation, internal.result);
  return {
    parsed,
    internal: valid ? internal : null,
    userMetadata: valid ? parsed.userMetadata : parsed,
    valid,
  };
}

function normalizeOptionalDate(value, label) {
  if (value === undefined || value === null) return null;
  const text = nonEmptyString(value, label);
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) throw new TypeError(`${label} must be a valid date`);
  return new Date(timestamp).toISOString();
}

function normalizeOptionalIdempotencyKey(value, fallback) {
  return value === undefined
    ? fallback
    : nonEmptyString(value, 'idempotencyKey');
}

function normalizeGrantInput(input = {}) {
  const ownerEmail = nonEmptyString(input.ownerEmail, 'ownerEmail');
  const currency = nonEmptyString(input.currency, 'currency');
  const units = positiveSafeInteger(input.units);
  const idempotencyKey = nonEmptyString(input.idempotencyKey, 'idempotencyKey');
  const sourceType = input.sourceType === undefined
    ? 'grant'
    : nonEmptyString(input.sourceType, 'sourceType');
  const sourceId = input.sourceId === undefined
    ? idempotencyKey
    : nonEmptyString(input.sourceId, 'sourceId');
  const expiresAt = normalizeOptionalDate(input.expiresAt, 'expiresAt');
  if (expiresAt !== null && Date.parse(expiresAt) <= Date.now()) {
    throw new TypeError('expiresAt must be in the future');
  }
  const metadata = jsonValue(input.metadata);
  const refundable = input.refundable === undefined ? false : input.refundable;
  if (typeof refundable !== 'boolean') {
    throw new TypeError('refundable must be a boolean');
  }

  const operationInput = {
    ownerEmail,
    currency,
    units,
    idempotencyKey,
    sourceType,
    sourceId,
    refundable,
    expiresAt,
    metadata,
  };
  return { ...operationInput, fingerprint: fingerprint(operationInput) };
}

function normalizeHoldInput(input = {}) {
  const ownerEmail = nonEmptyString(input.ownerEmail, 'ownerEmail');
  const currency = nonEmptyString(input.currency, 'currency');
  const quoteId = nonEmptyString(input.quoteId, 'quoteId');
  const idempotencyKey = nonEmptyString(input.idempotencyKey, 'idempotencyKey');
  const expiresAt = normalizeOptionalDate(input.expiresAt, 'expiresAt');
  const metadata = jsonValue(input.metadata);
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new TypeError('items must be a non-empty array');
  }

  const seenKeys = new Set();
  let totalUnits = 0;
  const items = input.items.map((item, index) => {
    const key = nonEmptyString(item?.key, `item key at index ${index}`);
    if (seenKeys.has(key)) throw new TypeError(`duplicate item key: ${key}`);
    seenKeys.add(key);
    const sku = nonEmptyString(item?.sku, `sku at index ${index}`);
    const units = positiveSafeInteger(item?.units, `item units at index ${index}`);
    totalUnits = checkedAdd(totalUnits, units, 'total units');
    return { key, sku, units };
  });

  const operationInput = {
    ownerEmail,
    currency,
    quoteId,
    idempotencyKey,
    expiresAt,
    items,
    metadata,
  };
  return {
    ...operationInput,
    totalUnits,
    fingerprint: fingerprint(operationInput),
  };
}

function normalizeSettlementInput(holdId, itemKey, options = {}) {
  const normalizedHoldId = nonEmptyString(holdId, 'holdId');
  const normalizedItemKey = nonEmptyString(itemKey, 'itemKey');
  const referenceId = nonEmptyString(options.referenceId, 'referenceId');
  const referenceType = options.referenceType === undefined
    ? 'asset'
    : nonEmptyString(options.referenceType, 'referenceType');
  const providerCostCny = providerCost(options.providerCostCny);
  const metadata = jsonValue(options.metadata);
  const idempotencyKey = normalizeOptionalIdempotencyKey(
    options.idempotencyKey,
    `settle:${normalizedHoldId}:${normalizedItemKey}`,
  );
  const operationInput = {
    holdId: normalizedHoldId,
    itemKey: normalizedItemKey,
    referenceType,
    referenceId,
    providerCostCny,
    metadata,
  };
  return {
    ...operationInput,
    idempotencyKey,
    fingerprint: fingerprint(operationInput),
  };
}

function normalizeReleaseInput(holdId, itemKey, options = {}) {
  const normalizedHoldId = nonEmptyString(holdId, 'holdId');
  const normalizedItemKey = nonEmptyString(itemKey, 'itemKey');
  const reason = nonEmptyString(options.reason, 'reason');
  const metadata = jsonValue(options.metadata);
  const idempotencyKey = normalizeOptionalIdempotencyKey(
    options.idempotencyKey,
    `release:${normalizedHoldId}:${normalizedItemKey}`,
  );
  const operationInput = {
    holdId: normalizedHoldId,
    itemKey: normalizedItemKey,
    reason,
    metadata,
  };
  return {
    ...operationInput,
    idempotencyKey,
    fingerprint: fingerprint(operationInput),
  };
}

function normalizeRemainderInput(holdId, options = {}) {
  const normalizedHoldId = nonEmptyString(holdId, 'holdId');
  const reason = nonEmptyString(options.reason, 'reason');
  const metadata = jsonValue(options.metadata);
  const idempotencyKey = normalizeOptionalIdempotencyKey(
    options.idempotencyKey,
    `release-remainder:${normalizedHoldId}`,
  );
  const operationInput = {
    holdId: normalizedHoldId,
    reason,
    metadata,
  };
  return {
    ...operationInput,
    idempotencyKey,
    fingerprint: fingerprint(operationInput),
  };
}

function balanceResult(wallet, unlimited) {
  return {
    availableUnits: unlimited ? 0 : (wallet?.available_units ?? 0),
    heldUnits: unlimited ? 0 : (wallet?.held_units ?? 0),
    unlimited,
  };
}

function holdStatus(totalUnits, settledUnits, releasedUnits) {
  const terminalUnits = checkedAdd(settledUnits, releasedUnits, 'terminal units');
  if (terminalUnits < totalUnits) return 'pending';
  if (settledUnits === totalUnits) return 'settled';
  if (releasedUnits === totalUnits) return 'released';
  return 'closed';
}

function idempotencyConflict(idempotencyKey) {
  const error = new Error(`Idempotency conflict for key: ${idempotencyKey}`);
  error.code = 'BILLING_IDEMPOTENCY_CONFLICT';
  return error;
}

function insufficientCredits(currency, required, available) {
  const error = new Error(
    `Insufficient ${currency}: required ${required}, available ${available}`,
  );
  error.code = 'BILLING_INSUFFICIENT_CREDITS';
  return error;
}

export function createWalletService(db, { isUnlimited = () => false } = {}) {
  if (!db || typeof db.prepare !== 'function' || typeof db.transaction !== 'function') {
    throw new TypeError('db must be a better-sqlite3 database');
  }
  if (typeof isUnlimited !== 'function') {
    throw new TypeError('isUnlimited must be a function');
  }

  const statements = {
    ensureWallet: db.prepare(`
      INSERT INTO wallets (owner_email, currency)
      VALUES (?, ?)
      ON CONFLICT(owner_email, currency) DO NOTHING
    `),
    selectWallet: db.prepare(`
      SELECT owner_email, currency, available_units, held_units, version, updated_at
      FROM wallets
      WHERE owner_email = ? AND currency = ?
    `),
    updateWallet: db.prepare(`
      UPDATE wallets
      SET available_units = ?, held_units = ?, version = version + 1,
          updated_at = datetime('now')
      WHERE owner_email = ? AND currency = ?
    `),
    selectLedgerByKey: db.prepare(`
      SELECT * FROM wallet_ledger WHERE idempotency_key = ?
    `),
    insertLedger: db.prepare(`
      INSERT INTO wallet_ledger (
        id, owner_email, currency, event_type, delta_available, delta_held,
        balance_available, balance_held, reference_type, reference_id,
        idempotency_key, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertLot: db.prepare(`
      INSERT INTO credit_lots (
        id, owner_email, currency, source_type, source_id, granted_units,
        remaining_units, refundable, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    selectExpiredLots: db.prepare(`
      SELECT id, remaining_units, expires_at
      FROM credit_lots
      WHERE owner_email = ? AND currency = ?
        AND expires_at IS NOT NULL
        AND julianday(expires_at) <= julianday(?)
        AND remaining_units > 0
      ORDER BY expires_at ASC, created_at ASC, id ASC
    `),
    sumExpiredLots: db.prepare(`
      SELECT COALESCE(SUM(remaining_units), 0) AS units
      FROM credit_lots
      WHERE owner_email = ? AND currency = ?
        AND expires_at IS NOT NULL
        AND julianday(expires_at) <= julianday(?)
        AND remaining_units > 0
    `),
    expireLot: db.prepare(`
      UPDATE credit_lots
      SET remaining_units = 0
      WHERE id = ? AND remaining_units = ?
    `),
    selectReservableLots: db.prepare(`
      SELECT id, granted_units, remaining_units, expires_at
      FROM credit_lots
      WHERE owner_email = ? AND currency = ? AND remaining_units > 0
        AND (expires_at IS NULL OR julianday(expires_at) > julianday(?))
      ORDER BY
        CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END ASC,
        expires_at ASC,
        created_at ASC,
        id ASC
    `),
    reserveLot: db.prepare(`
      UPDATE credit_lots
      SET remaining_units = remaining_units - ?
      WHERE id = ? AND remaining_units >= ?
        AND (expires_at IS NULL OR julianday(expires_at) > julianday(?))
    `),
    selectLot: db.prepare(`
      SELECT id, granted_units, remaining_units, expires_at,
             CASE
               WHEN expires_at IS NULL OR julianday(expires_at) > julianday(?) THEN 1
               ELSE 0
             END AS unexpired
      FROM credit_lots
      WHERE id = ?
    `),
    restoreLot: db.prepare(`
      UPDATE credit_lots
      SET remaining_units = remaining_units + ?
      WHERE id = ?
        AND (expires_at IS NULL OR julianday(expires_at) > julianday(?))
        AND remaining_units + ? <= granted_units
    `),
    insertHold: db.prepare(`
      INSERT INTO billing_holds (
        id, owner_email, currency, quote_id, status, total_units,
        settled_units, released_units, idempotency_key, expires_at, metadata
      ) VALUES (?, ?, ?, ?, 'pending', ?, 0, 0, ?, ?, ?)
    `),
    selectHold: db.prepare(`
      SELECT * FROM billing_holds WHERE id = ?
    `),
    insertHoldItem: db.prepare(`
      INSERT INTO billing_hold_items (
        id, hold_id, item_key, sku, units, status, reference_id
      ) VALUES (?, ?, ?, ?, ?, 'pending', '')
    `),
    selectHoldItems: db.prepare(`
      SELECT * FROM billing_hold_items
      WHERE hold_id = ?
      ORDER BY rowid ASC
    `),
    selectHoldItem: db.prepare(`
      SELECT * FROM billing_hold_items
      WHERE hold_id = ? AND item_key = ?
    `),
    settleHoldItem: db.prepare(`
      UPDATE billing_hold_items
      SET status = 'settled', reference_id = ?
      WHERE id = ? AND status = 'pending'
    `),
    releaseHoldItem: db.prepare(`
      UPDATE billing_hold_items
      SET status = 'released', reference_id = ?
      WHERE id = ? AND status = 'pending'
    `),
    updateHold: db.prepare(`
      UPDATE billing_holds
      SET status = ?, settled_units = ?, released_units = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `),
    updateHoldMetadata: db.prepare(`
      UPDATE billing_holds SET metadata = ? WHERE id = ?
    `),
    insertUsage: db.prepare(`
      INSERT INTO usage_events (
        id, owner_email, currency, sku, charged_units, shadow_units,
        provider_cost_cny, reference_type, reference_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    listLedger: db.prepare(`
      SELECT * FROM wallet_ledger
      WHERE owner_email = ? AND currency = ?
      ORDER BY created_at DESC, id DESC
    `),
  };

  function ensureWallet(ownerEmail, currency) {
    statements.ensureWallet.run(ownerEmail, currency);
    return statements.selectWallet.get(ownerEmail, currency);
  }

  function storedLedgerMetadata(operation, operationFingerprint, userMetadata, extra = {}, result) {
    return JSON.stringify({
      [INTERNAL_METADATA_KEY]: {
        version: INTERNAL_METADATA_VERSION,
        operation,
        fingerprint: operationFingerprint,
        ...extra,
        result,
      },
      userMetadata,
    });
  }

  function existingMutation(idempotencyKey, operation, operationFingerprint) {
    const row = statements.selectLedgerByKey.get(idempotencyKey);
    if (!row) return { found: false };
    const envelope = readMetadataEnvelope(row.metadata, null);
    const internal = envelope.internal;
    if (
      !internal
      || internal.operation !== operation
      || internal.fingerprint !== operationFingerprint
    ) {
      throw idempotencyConflict(idempotencyKey);
    }
    return { found: true, result: internal.result };
  }

  function buildHoldResult(holdId) {
    const hold = statements.selectHold.get(holdId);
    if (!hold) throw new Error(`Unknown hold: ${holdId}`);
    const metadataEnvelope = readMetadataEnvelope(hold.metadata, {});
    const items = statements.selectHoldItems.all(holdId).map(item => ({
      id: item.id,
      key: item.item_key,
      sku: item.sku,
      units: item.units,
      status: item.status,
      referenceId: item.reference_id,
    }));
    return {
      id: hold.id,
      ownerEmail: hold.owner_email,
      currency: hold.currency,
      quoteId: hold.quote_id,
      status: hold.status,
      totalUnits: hold.total_units,
      settledUnits: hold.settled_units,
      releasedUnits: hold.released_units,
      expiresAt: hold.expires_at,
      createdAt: hold.created_at,
      updatedAt: hold.updated_at,
      metadata: metadataEnvelope.userMetadata,
      items,
    };
  }

  function loadHoldAccounting(hold) {
    const envelope = readMetadataEnvelope(hold.metadata, null);
    const internal = envelope.internal;
    if (!internal || internal.operation !== 'hold') {
      throw new Error(`Hold accounting metadata is invalid: ${hold.id}`);
    }
    if (!['paid', 'unlimited'].includes(internal.accountingMode)) {
      throw new Error(`Hold accounting mode is invalid: ${hold.id}`);
    }
    if (!Array.isArray(internal.allocations)) {
      throw new Error(`Hold allocations are invalid: ${hold.id}`);
    }
    return {
      accountingMode: internal.accountingMode,
      allocations: internal.allocations,
    };
  }

  function reconcileExpiredLots(ownerEmail, currency, wallet, nowIso) {
    const expiredLots = statements.selectExpiredLots.all(ownerEmail, currency, nowIso);
    if (expiredLots.length === 0) return wallet;

    let expiredUnits = 0;
    for (const lot of expiredLots) {
      expiredUnits = checkedAdd(expiredUnits, lot.remaining_units, 'expired units');
    }
    if (wallet.available_units < expiredUnits) {
      throw new Error(`Expired lot balance invariant violation for ${ownerEmail}`);
    }
    for (const lot of expiredLots) {
      if (statements.expireLot.run(lot.id, lot.remaining_units).changes !== 1) {
        throw new Error(`Credit lot changed during expiry reconciliation: ${lot.id}`);
      }
    }

    const availableUnits = wallet.available_units - expiredUnits;
    statements.updateWallet.run(availableUnits, wallet.held_units, ownerEmail, currency);
    const postWallet = statements.selectWallet.get(ownerEmail, currency);
    const balance = balanceResult(postWallet, false);
    const lotIds = expiredLots.map(lot => lot.id);
    const expiryInput = {
      ownerEmail,
      currency,
      lots: expiredLots.map(lot => ({
        id: lot.id,
        units: lot.remaining_units,
        expiresAt: lot.expires_at,
      })),
    };
    const operationFingerprint = fingerprint(expiryInput);
    const ledgerId = randomUUID();
    const referenceId = lotIds.join(',');
    const result = { ledgerId, lotIds, expiredUnits, balance };
    statements.insertLedger.run(
      ledgerId,
      ownerEmail,
      currency,
      'expire',
      -expiredUnits,
      0,
      balance.availableUnits,
      balance.heldUnits,
      'credit_lot_expiry',
      referenceId,
      `expire:${ownerEmail}:${currency}:${referenceId}`,
      storedLedgerMetadata(
        'expire',
        operationFingerprint,
        {},
        { lotIds },
        result,
      ),
    );
    return postWallet;
  }

  function reserveHoldLots(ownerEmail, currency, items, nowIso) {
    const lots = statements.selectReservableLots
      .all(ownerEmail, currency, nowIso)
      .map(lot => ({ ...lot }));
    const allocations = [];

    for (const item of items) {
      let remaining = item.units;
      const itemAllocation = {
        itemId: item.id,
        itemKey: item.key,
        lots: [],
      };
      for (const lot of lots) {
        if (remaining === 0) break;
        if (lot.remaining_units === 0) continue;
        const reserved = Math.min(remaining, lot.remaining_units);
        const update = statements.reserveLot.run(reserved, lot.id, reserved, nowIso);
        if (update.changes !== 1) {
          throw new Error(`Credit lot changed during hold reservation: ${lot.id}`);
        }
        itemAllocation.lots.push({
          lotId: lot.id,
          units: reserved,
          expiresAt: lot.expires_at,
        });
        lot.remaining_units -= reserved;
        remaining -= reserved;
      }
      if (remaining !== 0) {
        throw new Error(`Credit lot invariant violation: ${remaining} units unavailable`);
      }
      allocations.push(itemAllocation);
    }
    return allocations;
  }

  function allocationForItem(accounting, item) {
    const allocation = accounting.allocations.find(entry => (
      entry?.itemId === item.id && entry?.itemKey === item.item_key
    ));
    if (!allocation || !Array.isArray(allocation.lots)) {
      throw new Error(`Hold item allocation is invalid: ${item.id}`);
    }
    let allocatedUnits = 0;
    for (const lot of allocation.lots) {
      if (!hasNonEmptyString(lot, 'lotId')) {
        throw new Error(`Hold lot allocation is invalid: ${item.id}`);
      }
      positiveSafeInteger(lot.units, 'allocated units');
      allocatedUnits = checkedAdd(allocatedUnits, lot.units, 'allocated units');
    }
    if (accounting.accountingMode === 'paid' && allocatedUnits !== item.units) {
      throw new Error(`Hold item allocation does not match units: ${item.id}`);
    }
    if (accounting.accountingMode === 'unlimited' && allocatedUnits !== 0) {
      throw new Error(`Unlimited hold unexpectedly has paid allocations: ${item.id}`);
    }
    return allocation;
  }

  function restoreItemAllocation(accounting, item, nowIso) {
    const allocation = allocationForItem(accounting, item);
    let restoredUnits = 0;
    let expiredUnits = 0;
    for (const reserved of allocation.lots) {
      const lot = statements.selectLot.get(nowIso, reserved.lotId);
      if (!lot) throw new Error(`Unknown allocated credit lot: ${reserved.lotId}`);
      if (lot.unexpired === 1) {
        const update = statements.restoreLot.run(
          reserved.units,
          lot.id,
          nowIso,
          reserved.units,
        );
        if (update.changes !== 1) {
          throw new Error(`Credit lot changed during hold release: ${lot.id}`);
        }
        restoredUnits = checkedAdd(restoredUnits, reserved.units, 'restored units');
      } else {
        expiredUnits = checkedAdd(expiredUnits, reserved.units, 'expired released units');
      }
    }
    return { restoredUnits, expiredUnits };
  }

  const grantTx = db.transaction(input => {
    const existing = existingMutation(input.idempotencyKey, 'grant', input.fingerprint);
    if (existing.found) return existing.result;

    const wallet = ensureWallet(input.ownerEmail, input.currency);
    const unlimited = Boolean(isUnlimited(input.ownerEmail));
    let availableUnits = wallet.available_units;
    const heldUnits = wallet.held_units;
    if (!unlimited) {
      availableUnits = checkedAdd(availableUnits, input.units, 'available units');
      statements.updateWallet.run(
        availableUnits,
        heldUnits,
        input.ownerEmail,
        input.currency,
      );
    }

    const creditLotId = randomUUID();
    const ledgerId = randomUUID();
    statements.insertLot.run(
      creditLotId,
      input.ownerEmail,
      input.currency,
      input.sourceType,
      input.sourceId,
      input.units,
      input.units,
      input.refundable ? 1 : 0,
      input.expiresAt,
    );

    const balance = balanceResult(
      statements.selectWallet.get(input.ownerEmail, input.currency),
      unlimited,
    );
    const result = {
      id: creditLotId,
      creditLotId,
      ledgerId,
      ownerEmail: input.ownerEmail,
      currency: input.currency,
      units: input.units,
      balance,
    };
    statements.insertLedger.run(
      ledgerId,
      input.ownerEmail,
      input.currency,
      'grant',
      unlimited ? 0 : input.units,
      0,
      balance.availableUnits,
      balance.heldUnits,
      input.sourceType,
      input.sourceId,
      input.idempotencyKey,
      storedLedgerMetadata('grant', input.fingerprint, input.metadata, { creditLotId }, result),
    );
    return result;
  });

  const createHoldTx = db.transaction(input => {
    const existing = existingMutation(input.idempotencyKey, 'hold', input.fingerprint);
    if (existing.found) return existing.result;

    let wallet = ensureWallet(input.ownerEmail, input.currency);
    const accountingMode = Boolean(isUnlimited(input.ownerEmail)) ? 'unlimited' : 'paid';
    const unlimited = accountingMode === 'unlimited';
    const nowIso = new Date().toISOString();
    if (!unlimited) {
      wallet = reconcileExpiredLots(input.ownerEmail, input.currency, wallet, nowIso);
    }
    let availableUnits = wallet.available_units;
    let heldUnits = wallet.held_units;
    if (!unlimited) {
      if (availableUnits < input.totalUnits) {
        return {
          insufficient: true,
          currency: input.currency,
          required: input.totalUnits,
          available: availableUnits,
        };
      }
    }

    const holdId = randomUUID();
    const holdItems = input.items.map(item => ({ ...item, id: randomUUID() }));
    const allocations = unlimited
      ? holdItems.map(item => ({ itemId: item.id, itemKey: item.key, lots: [] }))
      : reserveHoldLots(input.ownerEmail, input.currency, holdItems, nowIso);
    if (!unlimited) {
      availableUnits -= input.totalUnits;
      heldUnits = checkedAdd(heldUnits, input.totalUnits, 'held units');
      statements.updateWallet.run(
        availableUnits,
        heldUnits,
        input.ownerEmail,
        input.currency,
      );
    }

    const expiresAt = input.expiresAt
      ?? new Date(Date.now() + DEFAULT_HOLD_DURATION_MS).toISOString();
    statements.insertHold.run(
      holdId,
      input.ownerEmail,
      input.currency,
      input.quoteId,
      input.totalUnits,
      input.idempotencyKey,
      expiresAt,
      JSON.stringify(input.metadata),
    );
    for (const item of holdItems) {
      statements.insertHoldItem.run(
        item.id,
        holdId,
        item.key,
        item.sku,
        item.units,
      );
    }

    const ledgerId = randomUUID();
    const balance = balanceResult(
      statements.selectWallet.get(input.ownerEmail, input.currency),
      unlimited,
    );
    const result = buildHoldResult(holdId);
    result.ledgerId = ledgerId;
    result.balance = balance;
    const storedMetadata = storedLedgerMetadata(
      'hold',
      input.fingerprint,
      input.metadata,
      { holdId, accountingMode, allocations },
      result,
    );
    statements.insertLedger.run(
      ledgerId,
      input.ownerEmail,
      input.currency,
      'hold',
      unlimited ? 0 : -input.totalUnits,
      unlimited ? 0 : input.totalUnits,
      balance.availableUnits,
      balance.heldUnits,
      'quote',
      input.quoteId,
      input.idempotencyKey,
      storedMetadata,
    );
    statements.updateHoldMetadata.run(storedMetadata, holdId);
    return result;
  });

  const settleItemTx = db.transaction(input => {
    const existing = existingMutation(input.idempotencyKey, 'settle', input.fingerprint);
    if (existing.found) return existing.result;

    const hold = statements.selectHold.get(input.holdId);
    if (!hold) throw new Error(`Unknown hold: ${input.holdId}`);
    const item = statements.selectHoldItem.get(input.holdId, input.itemKey);
    if (!item) throw new Error(`Unknown hold item: ${input.itemKey}`);
    if (item.status === 'released') {
      throw new Error(`Hold item ${input.itemKey} is already released; cannot settle`);
    }
    if (item.status === 'settled') {
      throw idempotencyConflict(input.idempotencyKey);
    }

    const accounting = loadHoldAccounting(hold);
    allocationForItem(accounting, item);
    const wallet = ensureWallet(hold.owner_email, hold.currency);
    const unlimited = accounting.accountingMode === 'unlimited';
    let heldUnits = wallet.held_units;
    if (!unlimited) {
      if (heldUnits < item.units) {
        throw new Error(`Held balance invariant violation for hold ${hold.id}`);
      }
      heldUnits -= item.units;
      statements.updateWallet.run(
        wallet.available_units,
        heldUnits,
        hold.owner_email,
        hold.currency,
      );
    }

    if (statements.settleHoldItem.run(input.referenceId, item.id).changes !== 1) {
      throw new Error(`Hold item ${input.itemKey} changed during settlement`);
    }
    const settledUnits = checkedAdd(hold.settled_units, item.units, 'settled units');
    const nextStatus = holdStatus(hold.total_units, settledUnits, hold.released_units);
    statements.updateHold.run(nextStatus, settledUnits, hold.released_units, hold.id);

    const usageEventId = randomUUID();
    statements.insertUsage.run(
      usageEventId,
      hold.owner_email,
      hold.currency,
      item.sku,
      unlimited ? 0 : item.units,
      unlimited ? item.units : 0,
      input.providerCostCny,
      input.referenceType,
      input.referenceId,
      JSON.stringify(input.metadata),
    );

    const ledgerId = randomUUID();
    const balance = balanceResult(
      statements.selectWallet.get(hold.owner_email, hold.currency),
      unlimited,
    );
    const result = {
      holdId: hold.id,
      itemId: item.id,
      itemKey: item.item_key,
      status: 'settled',
      units: item.units,
      referenceId: input.referenceId,
      usageEventId,
      ledgerId,
      holdStatus: nextStatus,
      balance,
    };
    statements.insertLedger.run(
      ledgerId,
      hold.owner_email,
      hold.currency,
      'settle',
      0,
      unlimited ? 0 : -item.units,
      balance.availableUnits,
      balance.heldUnits,
      input.referenceType,
      input.referenceId,
      input.idempotencyKey,
      storedLedgerMetadata(
        'settle',
        input.fingerprint,
        input.metadata,
        { holdId: hold.id, holdItemId: item.id, usageEventId },
        result,
      ),
    );
    return result;
  });

  const releaseItemTx = db.transaction(input => {
    const existing = existingMutation(input.idempotencyKey, 'release', input.fingerprint);
    if (existing.found) return existing.result;

    const hold = statements.selectHold.get(input.holdId);
    if (!hold) throw new Error(`Unknown hold: ${input.holdId}`);
    const item = statements.selectHoldItem.get(input.holdId, input.itemKey);
    if (!item) throw new Error(`Unknown hold item: ${input.itemKey}`);
    if (item.status === 'settled') {
      throw new Error(`Hold item ${input.itemKey} is already settled; cannot release`);
    }
    if (item.status === 'released') {
      throw idempotencyConflict(input.idempotencyKey);
    }

    const accounting = loadHoldAccounting(hold);
    const wallet = ensureWallet(hold.owner_email, hold.currency);
    const unlimited = accounting.accountingMode === 'unlimited';
    let restoredUnits = 0;
    let expiredUnits = 0;
    if (unlimited) {
      allocationForItem(accounting, item);
    } else {
      ({ restoredUnits, expiredUnits } = restoreItemAllocation(
        accounting,
        item,
        new Date().toISOString(),
      ));
    }
    let availableUnits = wallet.available_units;
    let heldUnits = wallet.held_units;
    if (!unlimited) {
      if (heldUnits < item.units) {
        throw new Error(`Held balance invariant violation for hold ${hold.id}`);
      }
      availableUnits = checkedAdd(availableUnits, restoredUnits, 'available units');
      heldUnits -= item.units;
      statements.updateWallet.run(
        availableUnits,
        heldUnits,
        hold.owner_email,
        hold.currency,
      );
    }

    if (statements.releaseHoldItem.run(input.reason, item.id).changes !== 1) {
      throw new Error(`Hold item ${input.itemKey} changed during release`);
    }
    const releasedUnits = checkedAdd(hold.released_units, item.units, 'released units');
    const nextStatus = holdStatus(hold.total_units, hold.settled_units, releasedUnits);
    statements.updateHold.run(nextStatus, hold.settled_units, releasedUnits, hold.id);

    const ledgerId = randomUUID();
    const balance = balanceResult(
      statements.selectWallet.get(hold.owner_email, hold.currency),
      unlimited,
    );
    const result = {
      holdId: hold.id,
      itemId: item.id,
      itemKey: item.item_key,
      status: 'released',
      units: item.units,
      reason: input.reason,
      restoredUnits,
      expiredUnits,
      ledgerId,
      holdStatus: nextStatus,
      balance,
    };
    statements.insertLedger.run(
      ledgerId,
      hold.owner_email,
      hold.currency,
      'release',
      unlimited ? 0 : restoredUnits,
      unlimited ? 0 : -item.units,
      balance.availableUnits,
      balance.heldUnits,
      'billing_hold_item',
      item.id,
      input.idempotencyKey,
      storedLedgerMetadata(
        'release',
        input.fingerprint,
        input.metadata,
        { holdId: hold.id, holdItemId: item.id, reason: input.reason },
        result,
      ),
    );
    return result;
  });

  const releaseRemainderTx = db.transaction(input => {
    const existing = existingMutation(
      input.idempotencyKey,
      'release_remainder',
      input.fingerprint,
    );
    if (existing.found) return existing.result;

    const hold = statements.selectHold.get(input.holdId);
    if (!hold) throw new Error(`Unknown hold: ${input.holdId}`);
    const pendingItems = statements.selectHoldItems
      .all(input.holdId)
      .filter(item => item.status === 'pending');
    const accounting = loadHoldAccounting(hold);
    let releasedNow = 0;
    let restoredNow = 0;
    let expiredNow = 0;
    const nowIso = new Date().toISOString();
    for (const item of pendingItems) {
      releasedNow = checkedAdd(releasedNow, item.units, 'released remainder units');
      if (accounting.accountingMode === 'paid') {
        const restored = restoreItemAllocation(accounting, item, nowIso);
        restoredNow = checkedAdd(restoredNow, restored.restoredUnits, 'restored units');
        expiredNow = checkedAdd(expiredNow, restored.expiredUnits, 'expired released units');
      } else {
        allocationForItem(accounting, item);
      }
    }

    const wallet = ensureWallet(hold.owner_email, hold.currency);
    const unlimited = accounting.accountingMode === 'unlimited';
    let availableUnits = wallet.available_units;
    let heldUnits = wallet.held_units;
    if (!unlimited && releasedNow > 0) {
      if (heldUnits < releasedNow) {
        throw new Error(`Held balance invariant violation for hold ${hold.id}`);
      }
      availableUnits = checkedAdd(availableUnits, restoredNow, 'available units');
      heldUnits -= releasedNow;
      statements.updateWallet.run(
        availableUnits,
        heldUnits,
        hold.owner_email,
        hold.currency,
      );
    }

    for (const item of pendingItems) {
      if (statements.releaseHoldItem.run(input.reason, item.id).changes !== 1) {
        throw new Error(`Hold item ${item.item_key} changed during remainder release`);
      }
    }
    const releasedUnits = checkedAdd(hold.released_units, releasedNow, 'released units');
    const nextStatus = holdStatus(hold.total_units, hold.settled_units, releasedUnits);
    statements.updateHold.run(nextStatus, hold.settled_units, releasedUnits, hold.id);

    const ledgerId = randomUUID();
    const balance = balanceResult(
      statements.selectWallet.get(hold.owner_email, hold.currency),
      unlimited,
    );
    const result = {
      holdId: hold.id,
      status: nextStatus,
      releasedUnits: releasedNow,
      restoredUnits: restoredNow,
      expiredUnits: expiredNow,
      releasedItemKeys: pendingItems.map(item => item.item_key),
      reason: input.reason,
      ledgerId,
      balance,
    };
    statements.insertLedger.run(
      ledgerId,
      hold.owner_email,
      hold.currency,
      'release_remainder',
      unlimited ? 0 : restoredNow,
      unlimited ? 0 : -releasedNow,
      balance.availableUnits,
      balance.heldUnits,
      'billing_hold',
      hold.id,
      input.idempotencyKey,
      storedLedgerMetadata(
        'release_remainder',
        input.fingerprint,
        input.metadata,
        { holdId: hold.id, reason: input.reason },
        result,
      ),
    );
    return result;
  });

  return {
    grant(input) {
      return grantTx(normalizeGrantInput(input));
    },

    getBalance(ownerEmail, currency) {
      const normalizedOwnerEmail = nonEmptyString(ownerEmail, 'ownerEmail');
      const normalizedCurrency = nonEmptyString(currency, 'currency');
      const unlimited = Boolean(isUnlimited(normalizedOwnerEmail));
      const wallet = statements.selectWallet.get(normalizedOwnerEmail, normalizedCurrency);
      if (unlimited || !wallet) return balanceResult(wallet, unlimited);
      const expiredUnits = statements.sumExpiredLots
        .get(normalizedOwnerEmail, normalizedCurrency, new Date().toISOString()).units;
      return balanceResult({
        ...wallet,
        available_units: Math.max(0, wallet.available_units - expiredUnits),
      }, false);
    },

    createHold(input) {
      const result = createHoldTx(normalizeHoldInput(input));
      if (result?.insufficient) {
        throw insufficientCredits(result.currency, result.required, result.available);
      }
      return result;
    },

    settleItem(holdId, itemKey, options) {
      return settleItemTx(normalizeSettlementInput(holdId, itemKey, options));
    },

    releaseItem(holdId, itemKey, options) {
      return releaseItemTx(normalizeReleaseInput(holdId, itemKey, options));
    },

    releaseRemainder(holdId, options) {
      return releaseRemainderTx(normalizeRemainderInput(holdId, options));
    },

    listLedger(ownerEmail, currency) {
      const normalizedOwnerEmail = nonEmptyString(ownerEmail, 'ownerEmail');
      const normalizedCurrency = nonEmptyString(currency, 'currency');
      return statements.listLedger.all(normalizedOwnerEmail, normalizedCurrency).map(row => {
        const metadata = readMetadataEnvelope(row.metadata, {}).userMetadata;
        return {
          id: row.id,
          ownerEmail: row.owner_email,
          currency: row.currency,
          eventType: row.event_type,
          deltaAvailable: row.delta_available,
          deltaHeld: row.delta_held,
          balanceAvailable: row.balance_available,
          balanceHeld: row.balance_held,
          referenceType: row.reference_type,
          referenceId: row.reference_id,
          idempotencyKey: row.idempotency_key,
          metadata,
          createdAt: row.created_at,
        };
      });
    },
  };
}
