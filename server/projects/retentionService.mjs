export const RETENTION_MS = Object.freeze({
  temporary: 24 * 60 * 60 * 1000,
  unfinished: 7 * 24 * 60 * 60 * 1000,
  completed: 30 * 24 * 60 * 60 * 1000,
});

const GRACE_MS = 24 * 60 * 60 * 1000;

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function parseMetadata(value) {
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function assetFromRow(row) {
  return {
    id: row.id,
    assetId: row.asset_id,
    ownerEmail: String(row.owner_email || '').trim().toLowerCase(),
    projectId: row.project_id,
    stableUrl: row.stable_url,
    contentHash: row.content_hash,
    expiresAt: row.expires_at,
    retentionState: row.retention_state,
    retentionPinned: Number(row.retention_pinned) === 1 || row.retention_class === 'permanent',
    expired: row.retention_state === 'deleted',
  };
}

function noOpAssetStore() {
  return { remove() {} };
}

export function createRetentionService({ db, assetStore = noOpAssetStore(), now = () => new Date(), graceMs = GRACE_MS } = {}) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('db is required');
  if (typeof assetStore.remove !== 'function') throw new TypeError('assetStore.remove is required');
  const clock = () => {
    const date = asDate(now());
    if (!date) throw new TypeError('now must return a valid date');
    return date;
  };
  const effectiveGraceMs = Number.isFinite(graceMs) && graceMs > 0 ? graceMs : GRACE_MS;
  const hasTable = name => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
  const hasColumn = (table, column) => hasTable(table)
    && db.prepare(`PRAGMA table_info(${table})`).all().some(entry => entry.name === column);
  const protectedByReference = (asset, current) => {
    if (asset.retentionPinned) return true;
    const importedSource = db.prepare(`SELECT metadata_json FROM project_assets
      WHERE owner_email = ? AND deleted_at IS NULL
        AND (metadata_json LIKE '%sourceProjectAssetRef%' OR metadata_json LIKE '%importedFromProjectAsset%')`)
      .all(asset.ownerEmail)
      .some(row => {
        const metadata = parseMetadata(row.metadata_json);
        const references = [metadata.sourceProjectAssetRef, metadata.importedFromProjectAsset]
          .filter(value => value && typeof value === 'object' && !Array.isArray(value));
        return references.some(reference => {
          const projectId = String(reference.projectId || '').trim();
          const projectAssetId = String(reference.projectAssetId || '').trim();
          const expectedContentHash = String(reference.expectedContentHash || '').trim();
          if (projectId !== asset.projectId || projectAssetId !== asset.id
            || expectedContentHash !== String(asset.contentHash || '').trim()) return false;
          return Boolean(db.prepare(`SELECT 1 FROM project_assets
            WHERE id = ? AND owner_email = ? AND project_id = ? AND content_hash = ? AND deleted_at IS NULL LIMIT 1`)
            .get(asset.id, asset.ownerEmail, projectId, expectedContentHash));
        });
    });
    if (importedSource) return true;
    if (hasTable('product_profile_assets') && hasTable('product_profiles')) {
      const profileReference = db.prepare(`SELECT 1
        FROM product_profile_assets reference
        JOIN product_profiles profile ON profile.id = reference.profile_id
        WHERE profile.owner_email = ? AND profile.status = 'active'
          AND reference.owner_email = ? AND reference.project_id = ?
          AND reference.project_asset_id = ? AND reference.expected_content_hash = ?
        LIMIT 1`).get(
        asset.ownerEmail, asset.ownerEmail, asset.projectId, asset.id, asset.contentHash,
      );
      if (profileReference) return true;
    }
    const canvas = db.prepare(`SELECT 1 FROM canvas_sessions
      WHERE owner_email = ? AND project_id = ? AND status IN ('active', 'saved') AND expires_at > ?
        AND (snapshot LIKE ? OR snapshot LIKE ?) LIMIT 1`)
      .get(asset.ownerEmail, asset.projectId, current.toISOString(), `%${asset.assetId}%`, `%${asset.stableUrl}%`);
    if (canvas) return true;
    const run = db.prepare(`SELECT 1 FROM project_generation_runs
      WHERE project_id = ? AND owner_email = ? AND status NOT IN ('completed', 'needs_review', 'failed', 'cancelled') LIMIT 1`)
      .get(asset.projectId, asset.ownerEmail);
    if (run) return true;
    let work = null;
    if (hasTable('works')) {
      work = hasColumn('works', 'owner_email')
        ? db.prepare("SELECT 1 FROM works WHERE owner_email = ? AND COALESCE(deleted_at, '') = '' AND payload LIKE ? LIMIT 1")
          .get(asset.ownerEmail, `%${asset.stableUrl}%`)
        : db.prepare("SELECT 1 FROM works WHERE COALESCE(deleted_at, '') = '' AND payload LIKE ? LIMIT 1")
          .get(`%${asset.stableUrl}%`);
    }
    if (work) return true;
    const composition = db.prepare(`SELECT 1 FROM composition_revisions revision
      JOIN composition_documents document ON document.id = revision.document_id
      WHERE document.project_id = ? AND document.owner_email = ?
        AND (revision.background_asset_id = ? OR revision.rendered_asset_id = ? OR revision.layers LIKE ?) LIMIT 1`)
      .get(asset.projectId, asset.ownerEmail, asset.assetId, asset.assetId, `%${asset.assetId}%`);
    if (composition) return true;
    if (hasTable('video_workbench_asset_versions')) {
      const videoVersion = db.prepare(`SELECT 1 FROM video_workbench_asset_versions
        WHERE owner_email = ? AND project_id = ? AND source_project_asset_id = ? LIMIT 1`)
        .get(asset.ownerEmail, asset.projectId, asset.id);
      if (videoVersion) return true;
    }
    for (const [table, column] of [
      ['video_shot_candidates', 'provenance_json'],
      ['video_replay_manifests', 'manifest_json'],
      ['video_export_manifests', 'manifest_json'],
      ['video_generation_drafts', 'draft_json'],
      ['video_project_memory_facts', 'asset_refs_json'],
    ]) {
      if (!hasTable(table) || !hasColumn(table, column)) continue;
      const videoReference = db.prepare(`SELECT 1 FROM ${table}
        WHERE owner_email = ? AND project_id = ? AND (${column} LIKE ? OR ${column} LIKE ?) LIMIT 1`)
        .get(asset.ownerEmail, asset.projectId, `%${asset.id}%`, `%${asset.stableUrl}%`);
      if (videoReference) return true;
    }
    const dispute = db.prepare(`SELECT 1 FROM billing_holds hold
      LEFT JOIN billing_hold_items item ON item.hold_id = hold.id
      LEFT JOIN project_generation_runs run ON run.hold_id = hold.id
      WHERE hold.status = 'disputed' AND hold.owner_email = ?
        AND (run.owner_email IS NULL OR run.owner_email = ?) AND (
        hold.metadata LIKE ? OR hold.metadata LIKE ? OR item.reference_id = ? OR run.project_id = ?
      ) LIMIT 1`)
      .get(asset.ownerEmail, asset.ownerEmail, `%${asset.assetId}%`, `%${asset.stableUrl}%`, asset.assetId, asset.projectId);
    return Boolean(dispute);
  };
  const report = () => ({ markedAssetIds: [], isolatedAssetIds: [], deletedAssetIds: [], protectedAssetIds: [] });

  function markExpired() {
    const current = clock();
    const rows = db.prepare("SELECT * FROM project_assets WHERE deleted_at IS NULL AND retention_state = 'active' AND COALESCE(retention_pinned, 0) = 0 AND retention_class <> 'permanent'").all();
    const marked = [];
    for (const row of rows) {
      const asset = assetFromRow(row);
      const expiry = asDate(asset.expiresAt)
        || new Date(asDate(row.created_at).getTime() + (RETENTION_MS[row.retention_class] || RETENTION_MS.completed));
      if (expiry > current) continue;
      db.prepare("UPDATE project_assets SET retention_state = 'marked', marked_at = ? WHERE id = ? AND retention_state = 'active'")
        .run(current.toISOString(), asset.id);
      marked.push(asset.assetId);
    }
    return { markedAssetIds: marked };
  }

  function isolateMarked() {
    const current = clock();
    const result = report();
    const rows = db.prepare("SELECT * FROM project_assets WHERE deleted_at IS NULL AND retention_state = 'marked'").all();
    for (const row of rows) {
      const asset = assetFromRow(row);
      if (protectedByReference(asset, current)) {
        result.protectedAssetIds.push(asset.assetId);
        continue;
      }
      db.prepare("UPDATE project_assets SET retention_state = 'isolated', isolated_at = ? WHERE id = ? AND retention_state = 'marked'")
        .run(current.toISOString(), asset.id);
      result.isolatedAssetIds.push(asset.assetId);
    }
    return result;
  }

  function deleteIsolated() {
    const current = clock();
    const result = report();
    const rows = db.prepare("SELECT * FROM project_assets WHERE deleted_at IS NULL AND retention_state = 'isolated'").all();
    for (const row of rows) {
      const asset = assetFromRow(row);
      const isolatedAt = asDate(row.isolated_at);
      if (!isolatedAt || isolatedAt.getTime() + effectiveGraceMs > current.getTime()) continue;
      const references = db.prepare("SELECT * FROM project_assets WHERE asset_id = ? AND deleted_at IS NULL").all(asset.assetId)
        .map(assetFromRow);
      const ownedReferences = references.filter(reference => reference.ownerEmail === asset.ownerEmail);
      const protectedReference = ownedReferences.find(reference => protectedByReference(reference, current));
      const pendingReference = ownedReferences.find(reference => {
        const referenceRow = db.prepare('SELECT isolated_at, retention_state FROM project_assets WHERE id = ?').get(reference.id);
        const referenceIsolatedAt = asDate(referenceRow?.isolated_at);
        return reference.retentionState !== 'isolated' || !referenceIsolatedAt || referenceIsolatedAt.getTime() + effectiveGraceMs > current.getTime();
      });
      if (protectedReference || pendingReference) {
        if (protectedReference) {
          db.prepare("UPDATE project_assets SET retention_state = 'marked', isolated_at = NULL WHERE id = ?").run(asset.id);
        }
        result.protectedAssetIds.push(asset.assetId);
        continue;
      }
      db.prepare("UPDATE project_assets SET retention_state = 'deleted', deleted_at = ? WHERE id = ? AND deleted_at IS NULL")
        .run(current.toISOString(), asset.id);
      const remainingReferences = db.prepare("SELECT 1 FROM project_assets WHERE asset_id = ? AND deleted_at IS NULL LIMIT 1").get(asset.assetId);
      if (!remainingReferences) assetStore.remove(asset.assetId);
      result.deletedAssetIds.push(asset.assetId);
    }
    return result;
  }

  return {
    markExpired,
    isolateMarked,
    deleteIsolated,
    sweep() {
      const marked = markExpired();
      const isolated = isolateMarked();
      const deleted = deleteIsolated();
      return {
        markedAssetIds: marked.markedAssetIds,
        isolatedAssetIds: isolated.isolatedAssetIds,
        deletedAssetIds: deleted.deletedAssetIds,
        protectedAssetIds: [...new Set([...isolated.protectedAssetIds, ...deleted.protectedAssetIds])],
      };
    },
    listProjectAssets(projectId) {
      return db.prepare('SELECT * FROM project_assets WHERE project_id = ? ORDER BY created_at DESC').all(projectId).map(assetFromRow);
    },
    describeWork({ ownerEmail, work } = {}) {
      const urls = (Array.isArray(work?.images) ? work.images : Object.values(work?.images || {}))
        .map(image => typeof image === 'string' ? image : image?.url)
        .map(url => String(url || '').trim())
        .filter(Boolean);
      if (!urls.length) return null;
      const rows = urls.flatMap(url => db.prepare(`SELECT * FROM project_assets
        WHERE owner_email = ? AND stable_url = ? ORDER BY created_at DESC`).all(String(ownerEmail || '').trim().toLowerCase(), url));
      if (!rows.length) return null;
      const current = clock();
      const assets = rows.map(assetFromRow);
      if (assets.some(asset => asset.expired)) return { expired: true, preserved: false };
      if (assets.some(asset => protectedByReference(asset, current))) {
        return { expiresAt: null, preserved: true, expired: false };
      }
      const expiresAt = rows.map(row => asDate(row.expires_at)
        || new Date(asDate(row.created_at).getTime() + (RETENTION_MS[row.retention_class] || RETENTION_MS.completed)))
        .sort((left, right) => left - right)[0];
      return { expiresAt: expiresAt.toISOString(), preserved: false, expired: expiresAt <= current };
    },
  };
}
