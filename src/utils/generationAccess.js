import { isInsufficientCreditsError } from '../services/apiError.js';
import { createPendingPaidAction, savePendingPaidAction } from './pendingPaidAction.js';

const DRAFT_REFERENCES_STORAGE_KEY = 'shubao.pendingPaidDrafts.v1';
const BILLING_CURRENCIES = new Set(['ec_points', 'content_sets']);
const CONTENT_PAYWALL_SOURCES = new Set(['plog', 'xhs-content', 'xhs-plog']);

function supportedCurrency(value) {
  return typeof value === 'string' && BILLING_CURRENCIES.has(value.trim())
    ? value.trim()
    : '';
}

function paywallTab({ currency, source } = {}) {
  const normalizedSource = typeof source === 'string' ? source.trim().toLowerCase() : '';
  return currency === 'content_sets' || CONTENT_PAYWALL_SOURCES.has(normalizedSource)
    ? 'content'
    : 'ecommerce';
}

export function resolvePendingActionCurrency({ currency, action, source } = {}) {
  const callerCurrency = supportedCurrency(currency);
  if (callerCurrency) return callerCurrency;
  const actionCurrency = supportedCurrency(action?.currency);
  if (actionCurrency) return actionCurrency;
  return 'ec_points';
}

function activeSessionOwner(storage, now) {
  try {
    const session = JSON.parse(storage?.getItem?.('sb-auth') || 'null');
    if (!session?.token || typeof session.email !== 'string') return '';
    const expiresAt = Date.parse(session.expiresAt);
    if (session.expiresAt && Number.isFinite(expiresAt) && expiresAt <= now) return '';
    return session.email.trim().toLowerCase();
  } catch {
    return '';
  }
}

function currentStorage(storage) {
  if (storage) return storage;
  try { return globalThis.localStorage; } catch { return null; }
}

function currentRoute(route, location) {
  if (typeof route === 'string' && route.trim()) return route.trim();
  const current = location || globalThis.location;
  return typeof current?.pathname === 'string' && current.pathname.startsWith('/')
    ? current.pathname
    : '/';
}

function draftReference(ownerEmail, source) {
  const value = `${ownerEmail || 'anonymous'}\n${source}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `pending-${(hash >>> 0).toString(36)}`;
}

function stableDraftReference(storage, ownerEmail, source) {
  const key = `${ownerEmail || 'anonymous'}\n${source}`;
  try {
    const stored = JSON.parse(storage?.getItem?.(DRAFT_REFERENCES_STORAGE_KEY) || '{}');
    if (stored && typeof stored === 'object' && typeof stored[key] === 'string' && stored[key]) {
      return stored[key];
    }
    const draftId = draftReference(ownerEmail, source);
    const references = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    storage?.setItem?.(DRAFT_REFERENCES_STORAGE_KEY, JSON.stringify({ ...references, [key]: draftId }));
    return draftId;
  } catch {
    return draftReference(ownerEmail, source);
  }
}

function contentReferenceAction(action, fallbackType) {
  const type = typeof action?.type === 'string' && action.type.trim()
    ? action.type.trim()
    : fallbackType;
  const references = Array.isArray(action?.referenceAssetIds)
    ? [...new Set(action.referenceAssetIds.filter(value => (
      typeof value === 'string'
      && value.trim() !== ''
      && !/^(?:data:|blob:)/i.test(value.trim())
    )).map(value => value.trim()))]
    : [];
  return {
    type,
    currency: 'content_sets',
    ...(references.length ? { referenceAssetIds: references } : {}),
  };
}

/**
 * Keep generation access failures consistent across all ecommerce entrypoints.
 * The caller owns its form state; this helper only opens the appropriate modal.
 */
export function handleGenerationAccessError(error, dispatch, {
  source = 'ecommerce',
  ownerEmail,
  route = '',
  draftId = '',
  action = {},
  quoteId,
  storage,
  now,
  location,
  currency,
} = {}) {
  if (isInsufficientCreditsError(error)) {
    const requestedNow = typeof now === 'function' ? now() : Date.now();
    const createdAt = Number.isFinite(requestedNow) ? requestedNow : Date.now();
    const backingStorage = currentStorage(storage);
    const resolvedOwner = typeof ownerEmail === 'string' && ownerEmail.trim()
      ? ownerEmail.trim().toLowerCase()
      : activeSessionOwner(backingStorage, createdAt);
    const resolvedSource = typeof source === 'string' && source.trim() ? source.trim() : 'ecommerce';
    const resolvedRoute = currentRoute(route, location);
    const resolvedDraftId = typeof draftId === 'string' && draftId.trim()
      ? draftId.trim()
      : stableDraftReference(backingStorage, resolvedOwner, resolvedSource);
    const payload = error?.payload || error || {};
    const resolvedCurrency = resolvePendingActionCurrency({
      currency,
      action,
      source: resolvedSource,
    });
    const resolvedAction = resolvedCurrency === 'content_sets'
      ? contentReferenceAction(action, resolvedSource)
      : {
        ...(action && typeof action === 'object' && !Array.isArray(action) ? action : {}),
        type: typeof action?.type === 'string' && action.type.trim() ? action.type.trim() : resolvedSource,
        currency: resolvedCurrency,
      };
    const billing = {
      required: payload.required ?? error?.required,
      available: payload.available ?? error?.available,
    };
    const storedPendingAction = createPendingPaidAction({
      ownerEmail: resolvedOwner,
      source: resolvedSource,
      route: resolvedRoute,
      draftId: resolvedDraftId,
      action: resolvedAction,
      quoteId,
    }, { now: () => createdAt });
    if (storedPendingAction) {
      savePendingPaidAction(storedPendingAction, { storage: backingStorage });
    }
    const pendingReference = storedPendingAction || {
      source: resolvedSource,
      route: resolvedRoute,
      draftId: resolvedDraftId,
      action: resolvedAction,
      createdAt,
      ...(typeof quoteId === 'string' && quoteId ? { quoteId } : {}),
    };
    const pendingAction = { ...pendingReference, billing };
    dispatch({
      type: 'OPEN_PAYWALL',
      tab: paywallTab({ currency: resolvedCurrency, source: resolvedSource }),
      reason: 'INSUFFICIENT_CREDITS',
      pendingAction,
    });
    return 'credits';
  }
  if (error?.status === 401 || error?.status === 403) {
    dispatch({ type: 'SHOW_LOGIN', show: true });
    return 'login';
  }
  return null;
}
