const EXPENSIVE_POST_ROUTE_LIST = [
  '/api/generate',
  '/api/regenerate-image',
  '/api/regenerate-text',
  '/api/analyze',
  '/api/extract-product-link',
  '/api/ecommerce/auto-recognize',
  '/api/ecommerce/design-directions',
  '/api/video/plans',
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

const ROUTE_FEATURES = new Map([
  ['/api/generate', 'content_generation'],
  ['/api/regenerate-image', 'content_generation'],
  ['/api/regenerate-text', 'content_generation'],
  ['/api/analyze', 'content_generation'],
  ['/api/plog-generate', 'content_generation'],
  ['/api/extract-product-link', 'ecommerce_image'],
  ['/api/ecommerce/auto-recognize', 'ecommerce_image'],
  ['/api/ecommerce/design-directions', 'ecommerce_image'],
  ['/api/video/plans', 'video_generation'],
  ['/api/polish-ec-text', 'ecommerce_image'],
  ['/api/generate-ecommerce', 'ecommerce_image'],
  ['/api/extension/analyze', 'ecommerce_image'],
  ['/api/extension/regenerate', 'ecommerce_image'],
  ['/api/reverse-prompt', 'visual_creation'],
  ['/api/remove-bg', 'visual_creation'],
  ['/api/canvas/regenerate', 'visual_creation'],
  ['/api/canvas/transform', 'visual_creation'],
  ['/api/canvas/segmentation-plan', 'visual_creation'],
  ['/api/canvas/analyze-layers', 'visual_creation'],
  ['/api/canvas/ocr', 'visual_creation'],
  ['/api/canvas/replace-text', 'visual_creation'],
  ['/api/canvas/pixel-layers', 'visual_creation'],
  ['/api/canvas/psd-export', 'visual_creation'],
]);

export const BETA_GUARDED_POST_ROUTES = new Set(EXPENSIVE_POST_ROUTE_LIST);
export const RATE_LIMITED_POST_ROUTES = new Set(EXPENSIVE_POST_ROUTE_LIST);

export function getGenerationRouteFeature(path) {
  return ROUTE_FEATURES.get(String(path || '').trim().toLowerCase()) || null;
}

export function getGenerationRateLimit(email) {
  return {
    max: 10,
    windowMs: 60_000,
  };
}
