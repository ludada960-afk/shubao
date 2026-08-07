const FAILED_ASSET_STATES = new Set(['failed', 'needs_review', 'cancelled']);
const TERMINAL_JOB_STATES = new Set(['completed', 'needs_review', 'failed', 'cancelled']);

function text(value, fallback = '') {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
}

export function normalizeDurableTask(job = {}) {
  const assets = Array.isArray(job.assets) ? job.assets.map((asset, index) => {
    const previewUrl = text(asset?.previewUrl ?? asset?.preview_url);
    return {
      id: text(asset?.assetId ?? asset?.id, `asset-${index + 1}`),
      state: text(asset?.state ?? asset?.status, 'queued'),
      label: text(asset?.label ?? asset?.role, '图片'),
      error: text(asset?.error),
      ...(previewUrl ? { previewUrl } : {}),
    };
  }).filter(asset => asset.id) : [];
  const status = text(job.status ?? job.state, 'queued');
  const failed = assets.filter(asset => FAILED_ASSET_STATES.has(asset.state)).length;
  const done = assets.filter(asset => asset.state === 'completed').length;
  const progressTotal = Number(job?.progress?.total);
  const total = assets.length || (Number.isSafeInteger(progressTotal) && progressTotal >= 0 ? progressTotal : 0);
  const terminal = TERMINAL_JOB_STATES.has(status);
  const actions = terminal && failed > 0
    ? ['open', 'retry_failed', 'dismiss']
    : terminal ? ['open', 'dismiss'] : ['open'];
  return {
    id: text(job.id),
    title: text(job.title, '电商套图'),
    status,
    done,
    total,
    failed,
    error: text(job.error),
    updatedAt: job.updatedAt,
    actions,
    assets,
  };
}

export function hasActiveDurableTasks(tasks = []) {
  return Array.isArray(tasks) && tasks.some(task => !TERMINAL_JOB_STATES.has(task?.status));
}
