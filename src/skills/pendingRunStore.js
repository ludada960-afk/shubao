/* ═══ 进行中的生成：落盘 + 恢复（刷新不丢图）═════════════════════════════════════
   为什么必须有：出图是**要花钱**的动作。用户在技能工作台点了「立即生成」，等的时候
   顺手刷新了一下页面 / 手滑按了 F5 / 被系统回收了标签页 —— 结果就是：
   钱已经花了、图生成了，但界面上什么都没有，用户只会认为"白扣了"。
   竞品在这条上没有做得比我们好，这正是我们自己必须补上的坑。

   做法：把"进行中的这一轮"写进 localStorage（很小的一段 JSON），
   回到页面时按**同一个请求体**去问服务端要结果（幂等键保证不会重复扣费）。
   ⚠️ 只存必要字段：File/blob 这类没法序列化的对象必须剥掉，
      否则 JSON.stringify 会把整条记录写坏。 */

const KEY_PREFIX = 'sb-media-run:';

/* 上传位里可能有 File（上传中/失败的那张）—— 落盘前必须剥掉，只留能复原的字段 */
function serializeUpload(value) {
  if (!Array.isArray(value)) return [];
  return value.map(item => ({
    url: String(item?.url || ''),
    previewUrl: String(item?.previewUrl || '').startsWith('blob:') ? '' : String(item?.previewUrl || ''),
    name: String(item?.name || ''),
    assetId: String(item?.assetId || ''),
    status: String(item?.status || ''),
    error: String(item?.error || ''),
  }));
}

export function serializeValues(values = {}) {
  const out = {};
  for (const [key, value] of Object.entries(values || {})) {
    out[key] = Array.isArray(value) ? serializeUpload(value) : value;
  }
  return out;
}

function storage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function savePendingRun(skillId, payload) {
  const store = storage();
  if (!store || !skillId) return;
  try {
    store.setItem(KEY_PREFIX + skillId, JSON.stringify({ ...payload, values: serializeValues(payload.values) }));
  } catch { /* 存不下就算了，不能因为落盘失败打断创作 */ }
}

export function readPendingRun(skillId) {
  const store = storage();
  if (!store || !skillId) return null;
  try {
    const raw = store.getItem(KEY_PREFIX + skillId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.slots) ? parsed : null;
  } catch { return null; }
}

export function clearPendingRun(skillId) {
  const store = storage();
  if (!store || !skillId) return;
  try { store.removeItem(KEY_PREFIX + skillId); } catch { /* ignore */ }
}

/* 有没有"还没等到结果"的槽位 —— 只有这种才值得在回到页面时去问服务端 */
export function hasUnsettled(run) {
  return (run?.slots || []).some(slot => slot.status === 'pending' || slot.status === 'generating');
}
