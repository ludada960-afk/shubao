import { isInsufficientCreditsError } from '../services/apiError.js';

/**
 * Keep generation access failures consistent across all ecommerce entrypoints.
 * The caller owns its form state; this helper only opens the appropriate modal.
 */
export function handleGenerationAccessError(error, dispatch, {
  source = 'ecommerce',
  message = '当前商品图配置、图片和提示词都已保留，充值后可以继续生成。',
} = {}) {
  if (isInsufficientCreditsError(error)) {
    dispatch({
      type: 'OPEN_PAYWALL',
      tab: 'ecommerce',
      reason: 'INSUFFICIENT_CREDITS',
      pendingAction: { source, message },
    });
    return 'credits';
  }
  if (error?.status === 401 || error?.status === 403) {
    dispatch({ type: 'SHOW_LOGIN', show: true });
    return 'login';
  }
  return null;
}
