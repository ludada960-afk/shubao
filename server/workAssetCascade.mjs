/**
 * 作品删除联动素材回收（feature flag: WORK_ASSET_CASCADE=on|off，默认 on）。
 * softDeleteWork 在同一 SQLite 事务内调用注册的联动钩子：解析作品对
 * project_assets 的结构化引用（payload.projectAssetRefs）与弱引用
 * （image_urls / cover_url 对 stable_url），对失去全部活作品引用、且未被
 * retentionService 完整引用保护集（含分镜首末帧与视频表检查）和 billing
 * disputed 判定保护的素材，把保留档位降级到 completed(30天)；绝不 DELETE 行，
 * 物理删除仍由既有 sweep + grace 流水线执行。flag=off 时 softDeleteWork 不
 * 包事务、不读素材，行为与历史实现逐字节一致。
 */

function parseJSON(value, fallback) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function isWorkAssetCascadeEnabled(env = process.env) {
  return String(env?.WORK_ASSET_CASCADE ?? '').trim().toLowerCase() !== 'off';
}

let workDeleteCascadeHook = null;

export function registerWorkDeleteCascade(hook) {
  workDeleteCascadeHook = typeof hook === 'function' ? hook : null;
}

export function getRegisteredWorkDeleteCascade() {
  return workDeleteCascadeHook;
}

export function createWorkAssetCascade({ db, retention } = {}) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('db is required');
  if (!retention || typeof retention.isProtectedByReference !== 'function') {
    throw new TypeError('retention service with isProtectedByReference is required');
  }

  const structuredRefsFromPayload = payload => {
    const refs = Array.isArray(payload?.projectAssetRefs) ? payload.projectAssetRefs : [];
    return refs
      .map(ref => {
        if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return null;
        const projectAssetId = String(ref.projectAssetId ?? '').trim();
        if (!projectAssetId) return null;
        return {
          projectId: String(ref.projectId ?? '').trim(),
          projectAssetId,
          contentHash: String(ref.contentHash ?? '').trim(),
        };
      })
      .filter(Boolean);
  };

  const weakUrlsFromWork = work => {
    const raw = [String(work.cover_url ?? ''), ...parseJSON(work.image_urls, [])];
    return [...new Set(raw.map(url => String(url ?? '').trim()).filter(Boolean))];
  };

  // 活作品仍引用该素材（排除本次删除行）：payload 覆盖结构化 ref 与内嵌 URL，
  // image_urls / cover_url 列覆盖弱引用。
  const hasOtherLiveWorkReference = (ownerEmail, excludeWorkRowId, assetRowData) => db.prepare(`SELECT 1 FROM works
    WHERE owner_email = ? AND COALESCE(deleted_at, '') = '' AND id <> ?
      AND (payload LIKE ? OR payload LIKE ? OR image_urls LIKE ? OR cover_url = ?)
    LIMIT 1`).get(
    ownerEmail,
    excludeWorkRowId,
    `%${assetRowData.id}%`,
    `%${assetRowData.stable_url}%`,
    `%${assetRowData.stable_url}%`,
    assetRowData.stable_url,
  );

  return function cascadeAfterWorkDelete({ saveKey } = {}) {
    const key = String(saveKey ?? '').trim();
    if (!key) return { evaluated: 0, downgraded: [], sharedWithLiveWork: 0, protectedByReference: 0 };
    const work = db.prepare('SELECT id, owner_email, cover_url, image_urls, payload FROM works WHERE _saveKey = ?').get(key);
    if (!work) return { evaluated: 0, downgraded: [], sharedWithLiveWork: 0, protectedByReference: 0 };
    const owner = String(work.owner_email ?? '').trim().toLowerCase();
    const payload = parseJSON(work.payload, {});
    const candidates = new Map();

    for (const ref of structuredRefsFromPayload(payload)) {
      const rows = db.prepare("SELECT * FROM project_assets WHERE id = ? AND owner_email = ? AND deleted_at IS NULL")
        .all(ref.projectAssetId, owner);
      for (const row of rows) {
        if (ref.projectId && row.project_id !== ref.projectId) continue;
        if (ref.contentHash && row.content_hash !== ref.contentHash) continue;
        candidates.set(row.id, row);
      }
    }
    for (const url of weakUrlsFromWork(work)) {
      const rows = db.prepare("SELECT * FROM project_assets WHERE owner_email = ? AND stable_url = ? AND deleted_at IS NULL")
        .all(owner, url);
      for (const row of rows) candidates.set(row.id, row);
    }

    const current = new Date();
    const summary = { evaluated: candidates.size, downgraded: [], sharedWithLiveWork: 0, protectedByReference: 0 };
    for (const row of candidates.values()) {
      if (hasOtherLiveWorkReference(owner, work.id, row)) {
        summary.sharedWithLiveWork += 1;
        continue;
      }
      // 完整复用 retentionService 的引用保护集（含分镜首末帧与视频表检查）与
      // billing disputed 判定，禁止简化判定。
      if (retention.isProtectedByReference(row, current)) {
        summary.protectedByReference += 1;
        continue;
      }
      db.prepare(`UPDATE project_assets SET
        retention_class = 'completed',
        expires_at = NULL,
        retention_state = 'active',
        marked_at = NULL,
        isolated_at = NULL
        WHERE id = ? AND owner_email = ? AND deleted_at IS NULL
          AND COALESCE(retention_pinned, 0) = 0
          AND retention_class <> 'permanent'`).run(row.id, owner);
      summary.downgraded.push({ projectId: row.project_id, projectAssetId: row.id });
    }
    return summary;
  };
}
