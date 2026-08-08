import { isUnlimitedBetaEmail } from './accessPolicy.mjs';

const EXPENSIVE_POST_ROUTE_LIST = [
  '/api/generate',
  '/api/regenerate-image',
  '/api/regenerate-text',
  '/api/analyze',
  '/api/extract-product-link',
  '/api/ecommerce/auto-recognize',
  '/api/ecommerce/design-directions',
  '/api/polish-ec-text',
  '/api/reverse-prompt',
  '/api/remove-bg',
  '/api/generate-ecommerce',
  '/api/canvas/regenerate',
  '/api/canvas/transform',
  '/api/canvas/segmentation-plan',
  '/api/canvas/analyze-layers',
  '/api/canvas/ocr',
  '/api/canvas/replace-text',
  '/api/canvas/pixel-layers',
  '/api/canvas/psd-export',
  '/api/plog-generate',
  '/api/extension/analyze',
  '/api/extension/regenerate',
];

function isUnlimitedGenerationOwner(email) {
  return isUnlimitedBetaEmail(email);
}

export const BETA_GUARDED_POST_ROUTES = new Set(EXPENSIVE_POST_ROUTE_LIST);
export const RATE_LIMITED_POST_ROUTES = new Set(EXPENSIVE_POST_ROUTE_LIST);

export function getGenerationRateLimit(email) {
  return {
    max: isUnlimitedGenerationOwner(email) ? 60 : 10,
    windowMs: 60_000,
  };
}
