// server/projects/cloneService.js
// 4c183cd4 续命 P-C 1-click 派生升级: 项目级 Clone Service
// 接受: { db, projectStore }
// 路由: POST /api/projects/:projectId/clone  body: { cloneMode, targetKind?, titleHint? }
// 步骤:
//   1) 校验 ownerEmail + cloneMode
//   2) 取源项目 (projectStore.getProject) -> PROJECT_NOT_FOUND
//   3) createProject 创建新项目 (新 id + 派生标题)
//   4) projectStore.createVersion 同步一个 reason=clone 的 version
//   5) db.transaction 内 listProjectAssets -> 逐条 INSERT project_assets (新 id, 同 stable_url,
//      同 content_hash, metadata_json 加 clonedFrom + (change-style -> styleVariation,
//      change-angle -> angleVariation))
//   6) 返回 { project, sourceProject, cloneMode, assetCount, assetMap, version, clonedAt }
import crypto from 'node:crypto';

const ALLOWED_CLONE_MODES = new Set(['same-style', 'change-style', 'change-angle']);
const VERSION_REASON_CLONE = 'clone';

function normalizeCloneMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  if (!ALLOWED_CLONE_MODES.has(mode)) {
    const err = new Error('cloneMode must be one of same-style | change-style | change-angle');
    err.code = 'CLONE_MODE_INVALID';
    throw err;
  }
  return mode;
}

function deriveTitle({ sourceProject, cloneMode, titleHint }) {
  const hint = String(titleHint || '').trim();
  if (hint) return hint;
  const base = String((sourceProject && sourceProject.title) || '').trim() || 'project';
  const suffix = cloneMode === 'change-style'
    ? ' - change-style'
    : cloneMode === 'change-angle'
      ? ' - change-angle'
      : ' - same-style';
  return base + suffix;
}

function buildClonedMetadata({ sourceAsset, cloneMode, clonedAt }) {
  const raw = sourceAsset && sourceAsset.metadata;
  const existing = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  const clonedFrom = {
    projectId: (sourceAsset && sourceAsset.projectId) || '',
    assetId: (sourceAsset && (sourceAsset.id || sourceAsset.assetId)) || '',
    mode: cloneMode,
    clonedAt,
  };
  const next = Object.assign({}, existing, { clonedFrom });
  if (cloneMode === 'change-style') next.styleVariation = { enabled: true, generatedAt: clonedAt };
  if (cloneMode === 'change-angle') next.angleVariation = { enabled: true, generatedAt: clonedAt };
  return next;
}

export function createProjectCloneService({
  db,
  projectStore,
  randomUUID = crypto.randomUUID,
  now = () => new Date(),
} = {}) {
  if (!db || typeof db.transaction !== 'function' || typeof db.prepare !== 'function') {
    throw new TypeError('db (better-sqlite3) is required');
  }
  if (!projectStore || typeof projectStore.createProject !== 'function'
    || typeof projectStore.createVersion !== 'function'
    || typeof projectStore.listProjectAssets !== 'function'
    || typeof projectStore.getProject !== 'function') {
    throw new TypeError('projectStore with createProject + createVersion + getProject + listProjectAssets is required');
  }

  const timestamp = function() {
    const value = now();
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError('now must return a valid date');
    return date;
  };

  const insertAsset = db.prepare([
    'INSERT INTO project_assets',
    '(id, asset_id, owner_email, project_id, version_id, generation_run_id, role,',
    ' content_hash, stable_url, mime_type, metadata_json, retention_class, production_state, created_at)',
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ].join(' '));

  function cloneProject(input) {
    input = input || {};
    const mode = normalizeCloneMode(input.cloneMode);
    const owner = String(input.ownerEmail || '').trim();
    if (!owner) {
      const err = new Error('ownerEmail is required');
      err.code = 'CLONE_OWNER_REQUIRED';
      throw err;
    }
    const sourceId = String(input.projectId || '').trim();
    if (!sourceId) {
      const err = new Error('projectId is required');
      err.code = 'CLONE_PROJECT_REQUIRED';
      throw err;
    }
    const sourceProject = projectStore.getProject({ ownerEmail: owner, projectId: sourceId });
    if (!sourceProject) {
      const err = new Error('source project not found');
      err.code = 'PROJECT_NOT_FOUND';
      throw err;
    }
    const newKind = String(input.targetKind || sourceProject.kind || 'video').trim();
    const newTitle = deriveTitle({ sourceProject, cloneMode: mode, titleHint: input.titleHint });
    const clonedAt = timestamp().toISOString();

    return db.transaction(function() {
      const newProject = projectStore.createProject({
        ownerEmail: owner,
        kind: newKind,
        title: newTitle,
      });
      const version = projectStore.createVersion({
        ownerEmail: owner,
        projectId: newProject.id,
        parentVersionId: null,
        reason: VERSION_REASON_CLONE,
        inputSnapshot: { sourceProjectId: sourceProject.id, cloneMode: mode, clonedAt: clonedAt },
        planSnapshot: { cloneMode: mode, sourceKind: sourceProject.kind, targetKind: newKind },
      });
      const sourceAssets = projectStore.listProjectAssets({ ownerEmail: owner, projectId: sourceProject.id });
      const assetMap = [];
      for (let i = 0; i < sourceAssets.length; i += 1) {
        const asset = sourceAssets[i];
        const sid = String(asset.id || asset.assetId || '').trim();
        if (!sid) continue;
        const contentHash = String(asset.contentHash || '').trim();
        const stableUrl = String(asset.stableUrl || '').trim();
        if (!contentHash || !stableUrl) continue;
        const assetKey = asset.assetId || sid;
        const targetAssetId = newProject.id + ':' + assetKey + ':clone';
        const targetId = newProject.id + ':' + sid + ':clone';
        const metadata = buildClonedMetadata({ sourceAsset: asset, cloneMode: mode, clonedAt: clonedAt });
        const role = String(asset.role || 'generated').trim() || 'generated';
        const retentionClass = String(asset.retentionClass || 'completed').trim() || 'completed';
        const productionState = String(asset.productionState || 'candidate').trim() || 'candidate';
        const mimeType = String(asset.mimeType || 'image/png').trim() || 'image/png';
        insertAsset.run(
          targetId,
          assetKey,
          owner,
          newProject.id,
          version.id,
          null,
          role,
          contentHash,
          stableUrl,
          mimeType,
          JSON.stringify(metadata),
          retentionClass,
          productionState,
          clonedAt,
        );
        assetMap.push({
          sourceAssetId: sid,
          targetAssetId: targetAssetId,
          role: role,
          mediaKind: asset.mediaKind || '',
        });
      }
      return {
        project: newProject,
        sourceProject: sourceProject,
        cloneMode: mode,
        assetCount: assetMap.length,
        assetMap: assetMap,
        version: version,
        clonedAt: clonedAt,
      };
    }).immediate();
  }

  return { cloneProject: cloneProject };
}
