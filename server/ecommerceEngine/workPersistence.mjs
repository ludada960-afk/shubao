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

export function buildEcommerceTaskWork({ job = {}, assets = [], status } = {}) {
  const taskId = cleanString(job.id);
  if (!taskId) throw new TypeError('ecommerce task id is required');
  const payload = isRecord(job.payload) ? job.payload : {};
  const progress = isRecord(job.progress) ? job.progress : {};
  const generationStatus = cleanString(status || job.status) || 'generating';
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
