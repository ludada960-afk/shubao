export const ECOMMERCE_TASK_REFERENCE_VERSION = 1;
export const ECOMMERCE_TASK_REFERENCE_TTL_MS = 24 * 60 * 60 * 1000;

const USER_STATES = {
  queued: '等待生成',
  draft: '等待生成',
  submitted: '正在生成',
  polling: '正在生成',
  downloading: '正在生成',
  quality_check: '质量检查',
  repairing: '正在修复',
  completed: '已完成',
  needs_review: '需要确认',
  failed: '失败',
  cancelled: '失败',
};

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizedOwner(ownerEmail) {
  return cleanText(ownerEmail).toLowerCase();
}

function storageFor(storage) {
  return storage || globalThis.localStorage;
}

function isErrorState(state) {
  return /(?:^|[_-])(?:failed|cancelled|error|rejected|final|finished|done|success)(?:$|[_-])/i.test(state);
}

export function normalizeEcommerceAsset(asset = {}) {
  const state = cleanText(asset.status || asset.state).toLowerCase() || 'queued';
  const error = cleanText(asset.error || asset.message);
  const userState = USER_STATES[state] || (error || isErrorState(state) ? '失败' : '正在生成');
  const plan = asset.plan && typeof asset.plan === 'object' ? asset.plan : {};

  return {
    id: cleanText(asset.id || asset.assetId || asset.key),
    role: cleanText(plan.role || plan.purpose || asset.role || asset.purpose || asset.type),
    label: cleanText(plan.label || plan.title || asset.label || asset.title || plan.role || plan.purpose || asset.role || asset.purpose || asset.type),
    state,
    userState,
    stableUrl: cleanText(asset.stableUrl || asset.stable_url),
    error,
  };
}

export function normalizeEcommerceAssets(assets) {
  return (Array.isArray(assets) ? assets : []).map(normalizeEcommerceAsset);
}

export function taskKey({ ownerEmail, draftId } = {}) {
  const owner = normalizedOwner(ownerEmail);
  const draft = cleanText(draftId);
  if (!owner || !draft) return '';
  return `sb-ecommerce-task:v${ECOMMERCE_TASK_REFERENCE_VERSION}:${encodeURIComponent(owner)}:${encodeURIComponent(draft)}`;
}

export function saveEcommerceTaskReference({ ownerEmail, draftId, taskId, createdAt = Date.now(), storage } = {}) {
  const owner = normalizedOwner(ownerEmail);
  const draft = cleanText(draftId);
  const task = cleanText(taskId);
  const key = taskKey({ ownerEmail: owner, draftId: draft });
  if (!key || !task || !Number.isFinite(createdAt)) return false;
  try {
    storageFor(storage)?.setItem(key, JSON.stringify({
      version: ECOMMERCE_TASK_REFERENCE_VERSION,
      ownerEmail: owner,
      draftId: draft,
      taskId: task,
      createdAt,
    }));
    return true;
  } catch {
    return false;
  }
}

export function loadEcommerceTaskReference({ ownerEmail, draftId, now = Date.now(), storage } = {}) {
  const owner = normalizedOwner(ownerEmail);
  const draft = cleanText(draftId);
  const key = taskKey({ ownerEmail: owner, draftId: draft });
  if (!key || !Number.isFinite(now)) return null;
  try {
    const stored = storageFor(storage)?.getItem(key);
    const record = stored ? JSON.parse(stored) : null;
    const valid = record
      && record.version === ECOMMERCE_TASK_REFERENCE_VERSION
      && record.ownerEmail === owner
      && record.draftId === draft
      && cleanText(record.taskId)
      && Number.isFinite(record.createdAt)
      && record.createdAt <= now
      && now - record.createdAt <= ECOMMERCE_TASK_REFERENCE_TTL_MS;
    if (!valid) {
      if (stored) storageFor(storage)?.removeItem(key);
      return null;
    }
    return { taskId: record.taskId, createdAt: record.createdAt };
  } catch {
    return null;
  }
}

export function clearEcommerceTaskReference({ ownerEmail, draftId, taskId, storage } = {}) {
  const owner = normalizedOwner(ownerEmail);
  const draft = cleanText(draftId);
  const key = taskKey({ ownerEmail: owner, draftId: draft });
  const expectedTaskId = cleanText(taskId);
  if (!key || !expectedTaskId) return false;
  try {
    const record = JSON.parse(storageFor(storage)?.getItem(key) || 'null');
    if (
      record?.version !== ECOMMERCE_TASK_REFERENCE_VERSION
      || record?.ownerEmail !== owner
      || record?.draftId !== draft
      || record?.taskId !== expectedTaskId
    ) return false;
    storageFor(storage)?.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
