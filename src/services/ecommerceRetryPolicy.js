const FAILED_STATES = new Set(['failed', 'needs_review', 'error', 'rejected']);
const DELIVERED_STATES = new Set(['completed', 'complete', 'finished', 'done', 'success']);

function normalizedState(asset = {}) {
  return String(asset.status || asset.state || '').trim().toLowerCase();
}

function assetId(asset = {}) {
  return String(asset.id || asset.assetId || asset.key || '').trim();
}

function stableUrl(asset = {}) {
  return String(asset.stableUrl || asset.stable_url || asset.url || '').trim();
}

function taskAssets(task = {}) {
  const assets = [
    ...(Array.isArray(task.assets) ? task.assets : []),
    ...(Array.isArray(task.output?.assets) ? task.output.assets : []),
  ];
  const seen = new Set();
  return assets.filter(asset => {
    const id = assetId(asset);
    const key = id || JSON.stringify(asset);
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(asset && typeof asset === 'object');
  });
}

export function getEcommerceAutoRepairDecision(task = {}, { maxFailedAssets = 2 } = {}) {
  const assets = taskAssets(task);
  const failedAssets = assets.filter(asset => FAILED_STATES.has(normalizedState(asset)));
  const failedIds = new Set(failedAssets.map(assetId).filter(Boolean));
  const deliveredIds = new Set(assets
    .filter(asset => DELIVERED_STATES.has(normalizedState(asset)) && stableUrl(asset))
    .map(assetId)
    .filter(Boolean));
  let deliveredCount = deliveredIds.size;
  const outputImages = {
    ...(task.images && typeof task.images === 'object' ? task.images : {}),
    ...(task.output?.images && typeof task.output.images === 'object' ? task.output.images : {}),
  };
  Object.entries(outputImages).forEach(([id, url]) => {
    if (url && !failedIds.has(String(id)) && !deliveredIds.has(String(id))) deliveredCount += 1;
  });
  const failedCount = failedAssets.length;

  if (!failedCount) return { allowed: false, reason: 'no_failed_assets', deliveredCount, failedCount };
  if (!deliveredCount) return { allowed: false, reason: 'full_batch_failed', deliveredCount, failedCount };
  if (failedCount > maxFailedAssets) return { allowed: false, reason: 'too_many_failed_assets', deliveredCount, failedCount };
  return { allowed: true, reason: 'partial_failure', deliveredCount, failedCount };
}

export function shouldAutoRepairEcommerceTask(decision) {
  return Boolean(decision?.allowed);
}
