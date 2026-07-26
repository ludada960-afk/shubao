const CONTENT_SETS = 'content_sets';
const FINAL_BILLING_STATUSES = new Set(['settled', 'needs_review', 'preview']);
const STABLE_ASSET = /^\/api\/generated-assets\/[A-Za-z0-9._-]+$/;

function hash(value) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function referenceIds(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter(value => (
    typeof value === 'string'
    && value.trim() !== ''
    && !/^(?:data:|blob:)/i.test(value.trim())
  )).map(value => value.trim()))];
}

function stableAssets(event) {
  const urls = [event?.cover_url, ...(Array.isArray(event?.image_urls) ? event.image_urls : [])]
    .filter(Boolean);
  return urls.length > 0 && urls.every(url => typeof url === 'string' && STABLE_ASSET.test(url));
}

export function createContentDraftId({ ownerEmail = '', source = 'content' } = {}) {
  const owner = String(ownerEmail || 'anonymous').trim().toLowerCase() || 'anonymous';
  const surface = String(source || 'content').trim().toLowerCase() || 'content';
  return `content-${surface}-${hash(`${owner}\n${surface}`)}`;
}

export function buildContentPendingAction({
  type = 'content',
  draftId = '',
  referenceAssetIds = [],
} = {}) {
  return {
    type: String(type || 'content').trim() || 'content',
    currency: CONTENT_SETS,
    draftId: String(draftId || '').trim(),
    referenceAssetIds: referenceIds(referenceAssetIds),
  };
}

export function acceptAuthoritativeContentCompletion(event) {
  const billing = event?.billing;
  if (event?.type !== 'complete'
    || billing?.currency !== CONTENT_SETS
    || !FINAL_BILLING_STATUSES.has(billing.status)
    || !stableAssets(event)) return null;
  const isPreview = billing.status === 'preview';
  return {
    status: billing.status,
    contentSets: !isPreview && Number.isFinite(billing.balance) ? Math.max(0, billing.balance) : null,
    unlimited: billing.unlimited === true,
    result: event,
  };
}
