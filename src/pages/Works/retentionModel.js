export function formatRetentionStatus(retention, now = new Date()) {
  const { expiresAt, preserved, expired } = retention || {};
  if (expired) return { label: '原图已到期', action: '重新生成', available: false };
  if (preserved) return { label: '已长期保留', action: null, available: true };
  const date = expiresAt ? new Date(expiresAt) : null;
  if (date && Number.isFinite(date.getTime()) && date > now) {
    return { label: `保留至 ${date.toLocaleDateString('zh-CN')}`, action: '保存到作品集', available: true };
  }
  return { label: '已保存到作品集', action: null, available: true };
}

const CLEANUP_VERSION = 'retention-cleanup-v1';
const OBSOLETE_KEYS = ['shubao_ec_canvas_state', 'shubao_ec_draft_indexes'];

export function cleanupLegacyCanvasStorage(storage) {
  if (!storage || storage.getItem(CLEANUP_VERSION)) return false;
  OBSOLETE_KEYS.forEach(key => storage.removeItem(key));
  storage.setItem(CLEANUP_VERSION, '1');
  return true;
}
