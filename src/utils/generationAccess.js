import { isInsufficientCreditsError } from '../services/apiError.js';
import { createPendingPaidAction, savePendingPaidAction } from './pendingPaidAction.js';

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
} = {}) {
  if (isInsufficientCreditsError(error)) {
    const storedPendingAction = createPendingPaidAction({
      ownerEmail, source, route, draftId, action, quoteId,
    }, { now });
    if (storedPendingAction) savePendingPaidAction(storedPendingAction, { storage, now });
    const payload = error?.payload || error || {};
    const pendingAction = storedPendingAction && {
      ...storedPendingAction,
      billing: {
        required: payload.required ?? error?.required,
        available: payload.available ?? error?.available,
      },
    };
    dispatch({
      type: 'OPEN_PAYWALL',
      tab: 'ecommerce',
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
