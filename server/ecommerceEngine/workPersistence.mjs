import { sanitizeSnapshot } from './jobStore.mjs';

const STABLE_GENERATED_URL = /^\/api\/generated-assets\/[a-f0-9]{64}\.(?:jpg|png|webp)$/i;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function planFor(asset) {
  const snapshot = isRecord(asset?.requestSnapshot) ? asset.requestSnapshot : {};
  return isRecord(snapshot.assetPlanItem) ? snapshot.assetPlanItem : {};
}

function deliveredImages(assets) {
  return (Array.isArray(assets) ? assets : []).flatMap(asset => {
    const stableUrl = cleanString(asset?.stableUrl);
    if (cleanString(asset?.state) !== 'completed' || !STABLE_GENERATED_URL.test(stableUrl)) return [];
    const plan = planFor(asset);
    const key = cleanString(asset?.assetId || plan.id);
    if (!key) return [];
    const role = cleanString(plan.role) || 'generated';
    const label = cleanString(plan.label || plan.purpose) || role;
    return [{ key, label, role, style: label, url: stableUrl }];
  }).sort((left, right) => left.key.localeCompare(right.key));
}

function workInputSnapshot(payload) {
  const snapshot = sanitizeSnapshot({
    productAssets: Array.isArray(payload.assets?.product) ? payload.assets.product : [],
    selling_points: payload.selling_points,
    material: payload.material,
    restrictions: payload.restrictions,
    skus: payload.skus,
    detail_plan: payload.detail_plan,
    maintenance: payload.maintenance,
    direction: payload.direction,
  });
  return {
    productAssets: Array.isArray(snapshot.productAssets) ? snapshot.productAssets : [],
    selling_points: cleanString(snapshot.selling_points),
    material: cleanString(snapshot.material),
    restrictions: cleanString(snapshot.restrictions),
    skus: Array.isArray(snapshot.skus) ? snapshot.skus : [],
    detail_plan: isRecord(snapshot.detail_plan) ? snapshot.detail_plan : null,
    maintenance: cleanString(snapshot.maintenance),
    direction: isRecord(snapshot.direction) ? snapshot.direction : null,
  };
}

export function buildEcommerceTaskWork({ job = {}, assets = [], status } = {}) {
  const taskId = cleanString(job.id);
  if (!taskId) throw new TypeError('ecommerce task id is required');
  const payload = isRecord(job.payload) ? job.payload : {};
  const progress = isRecord(job.progress) ? job.progress : {};
  const generationStatus = cleanString(status || job.status) || 'generating';
  const inputSnapshot = workInputSnapshot(payload);
  return {
    taskId,
    _saveKey: `ec-task-${taskId}`,
    _phone: cleanString(job.ownerEmail).toLowerCase(),
    product_name: cleanString(payload.product_name) || '商品套图',
    category: cleanString(payload.category) || '其他',
    platform: cleanString(payload.platform) || '淘宝',
    _ecResult: true,
    generationStatus,
    projectId: cleanString(progress.projectId),
    sourceVersionId: cleanString(progress.sourceVersionId),
    generationRunId: cleanString(progress.generationRunId),
    assetPlanFingerprint: cleanString(progress.assetPlanFingerprint),
    resultVersionId: cleanString(progress.resultVersionId),
    at: new Date().toLocaleDateString('zh-CN'),
    ...inputSnapshot,
    images: deliveredImages(assets),
  };
}

export function createEcommerceTaskWorkPersistence({ upsertWork } = {}) {
  if (typeof upsertWork !== 'function') throw new TypeError('upsertWork is required');
  const queues = new Map();

  async function persist(input = {}) {
    const taskId = cleanString(input?.job?.id);
    if (!taskId) throw new TypeError('ecommerce task id is required');
    const previous = queues.get(taskId) || Promise.resolve();
    const next = previous.catch(() => {}).then(async () => {
      const work = buildEcommerceTaskWork(input);
      if (work.images.length === 0) return null;
      await upsertWork(work);
      return work;
    });
    queues.set(taskId, next);
    try {
      return await next;
    } finally {
      if (queues.get(taskId) === next) queues.delete(taskId);
    }
  }

  return { persist };
}

export { STABLE_GENERATED_URL };
