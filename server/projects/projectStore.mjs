import crypto from 'node:crypto';
import { stripTransientWorkPlayback } from '../../shared/workPlayback.mjs';
import { normalizeCanvasPendingProjectAssetImports } from '../../shared/canvasPendingArchive.mjs';
import { sanitizeCanvasSnapshotMedia } from '../../shared/canvasSnapshotMedia.mjs';
import {
  normalizeProductProfileInput,
  normalizeProductProfilePatch,
  normalizeProductProfileAssetRef,
} from './productProfileContract.mjs';

const PROJECT_KINDS = new Set(['ecommerce', 'xiaohongshu', 'plog', 'video']);
const VERSION_REASONS = new Set(['generation', 'manual_save', 'canvas_save', 'accepted_result', 'migration']);
const CHECKPOINT_REASONS = new Set(['payment_required', 'generation_interrupted', 'session_interrupted']);
const PROJECT_ASSET_PRODUCTION_STATES = new Set(['draft', 'candidate', 'delivered', 'archived']);
const USER_PROJECT_ASSET_PRODUCTION_TRANSITIONS = Object.freeze({
  draft: new Set(['draft', 'candidate', 'archived']),
  candidate: new Set(['candidate', 'draft', 'archived']),
  delivered: new Set(['delivered', 'archived']),
  archived: new Set(['archived', 'draft']),
});
const ECOMMERCE_TERMINAL_RUN_STATUSES = new Set(['completed', 'needs_review', 'failed', 'cancelled']);
const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeOwner(value) {
  return String(value || '').trim().toLowerCase();
}
function normalizeProductionState(value) {
  const state = String(value || 'draft').trim().toLowerCase() || 'draft';
  if (!PROJECT_ASSET_PRODUCTION_STATES.has(state)) throw codedError('PROJECT_ASSET_PRODUCTION_STATE_INVALID', 'unknown project asset production state');
  return state;
}
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function parse(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function normalizeCanvasSnapshot(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const snapshot = sanitizeCanvasSnapshotMedia(stripTransientWorkPlayback(value));
  const pending = normalizeCanvasPendingProjectAssetImports(snapshot?.pendingProjectAssetImports);
  const normalized = { ...snapshot };
  if (pending.length) normalized.pendingProjectAssetImports = pending;
  else delete normalized.pendingProjectAssetImports;
  return normalized;
}

function mediaKindFromMimeType(value) {
  const mimeType = String(value || '').toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

function projectAssetFromRow(row) {
  if (!row) return null;
  return {
    projectAssetId: row.id,
    assetId: row.asset_id || '',
    ownerEmail: row.owner_email,
    projectId: row.project_id,
    versionId: row.version_id,
    generationRunId: row.generation_run_id,
    role: row.role,
    parentAssetId: row.parent_asset_id,
    contentHash: row.content_hash,
    stableUrl: row.stable_url,
    mimeType: row.mime_type,
    mediaKind: mediaKindFromMimeType(row.mime_type),
    width: row.width,
    height: row.height,
    expiresAt: row.expires_at,
    retentionClass: row.retention_class,
    retentionPinned: Number(row.retention_pinned) === 1 || row.retention_class === 'permanent',
    retentionState: row.retention_state,
    productionState: row.production_state || 'draft',
    metadata: parse(row.metadata_json, {}),
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

function projectAssetLibraryItemFromRow(row) {
  const asset = projectAssetFromRow(row);
  if (!asset) return null;
  const { ownerEmail: _ownerEmail, ...displayAsset } = asset;
  return {
    ...displayAsset,
    project: {
      id: row.project_id,
      kind: row.project_kind,
      title: row.project_title,
      status: row.project_status,
      updatedAt: row.project_updated_at,
    },
  };
}

function projectAssetLineageRefFromRow(row) {
  return {
    projectAssetId: row.lineage_asset_id,
    assetId: row.lineage_asset_external_id,
    versionId: row.lineage_version_id,
    generationRunId: row.lineage_generation_run_id,
    role: row.lineage_role,
    parentAssetId: row.lineage_parent_asset_id,
    contentHash: row.lineage_content_hash,
    stableUrl: row.lineage_stable_url,
    mimeType: row.lineage_mime_type,
    mediaKind: mediaKindFromMimeType(row.lineage_mime_type),
    width: row.lineage_width,
    height: row.lineage_height,
    retentionClass: row.lineage_retention_class,
    retentionState: row.lineage_retention_state,
    productionState: row.lineage_production_state || 'draft',
    createdAt: row.lineage_asset_created_at,
    relation: row.lineage_relation,
    relationGenerationRunId: row.lineage_relation_generation_run_id,
    relationCreatedAt: row.lineage_relation_created_at,
    project: {
      id: row.lineage_project_id,
      kind: row.lineage_project_kind,
      title: row.lineage_project_title,
      status: row.lineage_project_status,
      updatedAt: row.lineage_project_updated_at,
    },
  };
}

function isReusableProjectAsset(asset, now) {
  if (!asset) return false;
  if (asset.retentionPinned || asset.retentionClass === 'permanent') return true;
  if (asset.retentionState !== 'active') return false;
  if (!asset.expiresAt) return true;
  const expiresAt = new Date(asset.expiresAt);
  return Number.isFinite(expiresAt.getTime()) && expiresAt > now;
}

function normalizeProjectAssetPurpose(value) {
  const purpose = String(value || 'read').trim().toLowerCase() || 'read';
  if (!['read', 'reuse'].includes(purpose)) {
    throw codedError('PROJECT_ASSET_PURPOSE_INVALID', 'project asset purpose is invalid');
  }
  return purpose;
}

function externalProjectAssetRefs(asset) {
  const metadata = asset?.metadata && typeof asset.metadata === 'object' ? asset.metadata : {};
  const candidates = [metadata.sourceProjectAssetRef, metadata.importedFromProjectAsset]
    .filter(value => value && typeof value === 'object' && !Array.isArray(value));
  const seen = new Set();
  return candidates.map(value => ({
    projectId: String(value.projectId || '').trim(),
    projectAssetId: String(value.projectAssetId || '').trim(),
    role: String(value.role || 'reference').trim(),
    expectedContentHash: String(value.expectedContentHash || '').trim(),
  })).filter(value => {
    const key = `${value.projectId}:${value.projectAssetId}:${value.expectedContentHash}`;
    if (!value.projectId || !value.projectAssetId || !value.expectedContentHash || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanProjectAssetValue(value, name, max = 2000) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  if (normalized.length > max || /[\u0000-\u001F\u007F]/.test(normalized)) throw new TypeError(`${name} is invalid`);
  return normalized;
}

function normalizeAssetLibraryQuery(value) {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!normalized) return '';
  if (normalized.length > 120 || /[\u0000-\u001F\u007F]/.test(normalized)) throw new TypeError('query is invalid');
  return normalized.toLowerCase();
}

function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

function normalizeProjectAssetMetadata(value) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('metadata must be an object');
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new TypeError('metadata must be JSON serializable');
  }
  if (typeof serialized !== 'string') throw new TypeError('metadata must be JSON serializable');
  if (serialized.length > 16_000) throw new TypeError('metadata is too large');
  return JSON.parse(serialized);
}

function canvasAssetReferences(snapshot) {
  const references = [];
  const visit = value => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const hasAssetIdentity = Object.hasOwn(value, 'projectAssetId')
      || Object.hasOwn(value, 'project_asset_id')
      || Object.hasOwn(value, 'assetRef')
      || Object.hasOwn(value, 'projectAssetRef');
    if (hasAssetIdentity) references.push(value.assetRef || value.projectAssetRef || value);
    Object.entries(value).forEach(([key, child]) => {
      if (key === 'assetRef' || key === 'projectAssetRef') return;
      visit(child);
    });
  };
  visit(snapshot);
  return references;
}

function canvasAssetReferenceKey(reference = {}) {
  const projectId = String(reference?.projectId || reference?.project_id || '').trim();
  const projectAssetId = String(reference?.projectAssetId || reference?.project_asset_id || '').trim();
  const contentHash = String(reference?.contentHash || reference?.content_hash || '').trim();
  return projectId && projectAssetId && contentHash
    ? `${projectId}:${projectAssetId}:${contentHash}`
    : '';
}

function codedError(code, message) {
  return Object.assign(new Error(message), { code });
}

function normalizeOptionalIdempotencyKey(value) {
  const key = String(value || '').trim();
  if (!key) return '';
  if (key.length > 200 || /[\u0000-\u001F\u007F]/.test(key)) {
    throw new TypeError('idempotencyKey is invalid');
  }
  return key;
}

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function productProfileVariantFromRow(row) {
  return {
    label: row.label,
    color: row.color,
    spec: row.spec,
    size: row.size,
    capacity: row.capacity,
    dimLabel: row.dim_label,
    count: row.count,
  };
}

function productProfileFromRow(row) {
  if (!row) return null;
  return {
    profileId: row.id,
    name: row.name,
    category: row.category,
    facts: parse(row.facts_json, {}),
    status: row.status,
    variants: [],
    assets: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function stableAssetIdFromUrl(value) {
  const match = String(value || '').match(/\/api\/generated-assets\/([^/?#]+)$/i);
  return match ? match[1] : '';
}

function stableAssetContentHash(value) {
  const assetId = stableAssetIdFromUrl(value);
  return assetId.match(/^([a-f0-9]{64})\.(?:jpg|png|webp)$/i)?.[1] || '';
}

function stableAssetMimeType(value) {
  const extension = stableAssetIdFromUrl(value).match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  return extension === 'jpg' ? 'image/jpeg' : extension === 'webp' ? 'image/webp' : extension === 'png' ? 'image/png' : '';
}

function isOwnedApplicationAssetUrl(value) {
  const url = String(value || '').trim();
  return /^\/api\//.test(url) && !/[\u0000-\u001F\u007F]/.test(url);
}

function terminalConflict(currentStatus, requestedStatus) {
  return codedError(
    'GENERATION_RUN_TERMINAL_CONFLICT',
    `generation run is already ${currentStatus}; cannot transition to ${requestedStatus}`,
  );
}

function projectFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    kind: row.kind,
    title: row.title,
    status: row.status,
    headVersionId: row.head_version_id,
    acceptedVersionId: row.accepted_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    deletedAt: row.deleted_at,
  };
}

function versionFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    parentVersionId: row.parent_version_id,
    reason: row.reason,
    sequence: row.sequence,
    inputSnapshot: parse(row.input_snapshot, {}),
    planSnapshot: parse(row.plan_snapshot, {}),
    canvasSnapshotId: row.canvas_snapshot_id,
    createdAt: row.created_at,
  };
}

function checkpointFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    projectId: row.project_id,
    versionId: row.version_id,
    generationRunId: row.generation_run_id,
    reason: row.reason,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

function canvasFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    projectId: row.project_id,
    baseVersionId: row.base_version_id,
    status: row.status,
    revision: row.revision,
    snapshot: normalizeCanvasSnapshot(parse(row.snapshot, {})),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function runFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    sourceVersionId: row.source_version_id,
    resultVersionId: row.result_version_id,
    ownerEmail: row.owner_email,
    kind: row.kind,
    status: row.status,
    quoteId: row.quote_id,
    holdId: row.hold_id,
    progress: parse(row.progress, {}),
    errorCode: row.error_code,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function createProjectStore(db, {
  randomUUID = crypto.randomUUID,
  now = () => new Date(),
  checkpointTtlMs = DAY_MS,
  canvasTtlMs = DAY_MS,
} = {}) {
  const timestamp = () => {
    const value = now();
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError('now must return a valid date');
    return date;
  };
  const requireProject = (ownerEmail, projectId) => {
    const project = projectFromRow(db.prepare('SELECT * FROM projects WHERE id = ? AND owner_email = ? AND deleted_at IS NULL').get(projectId, normalizeOwner(ownerEmail)));
    if (!project) throw codedError('PROJECT_NOT_FOUND', 'project not found');
    return project;
  };
  const requireVersion = (projectId, versionId) => {
    const version = versionFromRow(db.prepare('SELECT * FROM project_versions WHERE id = ? AND project_id = ?').get(versionId, projectId));
    if (!version) throw codedError('VERSION_NOT_FOUND', 'project version not found');
    return version;
  };
  const assertCanvasSnapshotAssets = (ownerEmail, snapshot, { allowExistingReferences = new Set() } = {}) => {
    const current = timestamp();
    for (const reference of canvasAssetReferences(snapshot)) {
      const referencedProjectId = String(reference?.projectId || reference?.project_id || '').trim();
      const projectAssetId = String(reference?.projectAssetId || reference?.project_asset_id || '').trim();
      const contentHash = String(reference?.contentHash || reference?.content_hash || '').trim();
      const stableUrl = String(reference?.stableUrl || reference?.stable_url || '').trim();
      if (!referencedProjectId || !projectAssetId || !contentHash || !stableUrl) {
        throw codedError('CANVAS_ASSET_NOT_FOUND', 'canvas asset reference is incomplete');
      }
      const row = db.prepare(`SELECT pa.*
        FROM project_assets pa
        JOIN projects p ON p.id = pa.project_id AND p.owner_email = pa.owner_email AND p.deleted_at IS NULL
        WHERE pa.id = ? AND pa.owner_email = ? AND pa.project_id = ?
          AND pa.content_hash = ? AND pa.stable_url = ? AND pa.deleted_at IS NULL`).get(
        projectAssetId, normalizeOwner(ownerEmail), referencedProjectId, contentHash, stableUrl,
      );
      if (!row) throw codedError('CANVAS_ASSET_NOT_FOUND', 'canvas asset reference is not owned or authoritative');
      const key = canvasAssetReferenceKey(reference);
      if (!allowExistingReferences.has(key) && !isReusableProjectAsset(projectAssetFromRow(row), current)) {
        throw codedError('PROJECT_ASSET_NOT_REUSABLE', 'project asset is not available for new reuse');
      }
    }
  };
  const hydrateCheckpoint = row => {
    const checkpoint = checkpointFromRow(row);
    if (!checkpoint) return null;
    const project = requireProject(checkpoint.ownerEmail, checkpoint.projectId);
    const version = requireVersion(project.id, checkpoint.versionId);
    return { ...checkpoint, project, version };
  };
  const insertProject = ({ ownerEmail, kind, title = '' }) => {
    const owner = normalizeOwner(ownerEmail);
    if (!owner) throw new TypeError('ownerEmail is required');
    if (!PROJECT_KINDS.has(kind)) throw new TypeError('unknown project kind');
    const id = randomUUID();
    const createdAt = timestamp().toISOString();
    db.prepare(`INSERT INTO projects (id, owner_email, kind, title, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'editing', ?, ?)`).run(id, owner, kind, String(title || '').trim(), createdAt, createdAt);
    return projectFromRow(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
  };

  const requireProductProfile = (ownerEmail, profileId) => {
    const owner = normalizeOwner(ownerEmail);
    const id = String(profileId || '').trim();
    const row = db.prepare('SELECT * FROM product_profiles WHERE id = ? AND owner_email = ?').get(id, owner);
    if (!row) throw codedError('PRODUCT_PROFILE_NOT_FOUND', 'product profile not found');
    return row;
  };

  const hydrateProductProfile = row => {
    const profile = productProfileFromRow(row);
    if (!profile) return null;
    profile.variants = db.prepare(`SELECT * FROM product_profile_variants
      WHERE profile_id = ? ORDER BY ordinal ASC`).all(row.id).map(productProfileVariantFromRow);
    profile.assets = db.prepare(`SELECT project_id, project_asset_id, role, expected_content_hash
      FROM product_profile_assets WHERE profile_id = ?
      ORDER BY created_at ASC, project_asset_id ASC`).all(row.id).map(asset => ({
      projectId: asset.project_id,
      projectAssetId: asset.project_asset_id,
      role: asset.role,
      expectedContentHash: asset.expected_content_hash,
    }));
    return profile;
  };

  const validateProductProfileAssets = (ownerEmail, assets) => {
    const owner = normalizeOwner(ownerEmail);
    const current = timestamp();
    for (const asset of assets) {
      const row = db.prepare(`SELECT pa.*, p.owner_email AS project_owner_email
        FROM project_assets pa
        JOIN projects p ON p.id = pa.project_id AND p.deleted_at IS NULL
        WHERE pa.id = ? AND pa.project_id = ? AND pa.deleted_at IS NULL`).get(
        asset.projectAssetId, asset.projectId,
      );
      if (!row || row.content_hash !== asset.expectedContentHash) {
        throw codedError('PRODUCT_PROFILE_ASSET_NOT_FOUND', 'product profile asset reference is not authoritative');
      }
      if (row.owner_email !== owner || row.project_owner_email !== owner
        || !isReusableProjectAsset(projectAssetFromRow(row), current)) {
        throw codedError('PRODUCT_PROFILE_ASSET_NOT_REUSABLE', 'product profile asset is not available for reuse');
      }
    }
  };

  const insertProductProfileVariants = (profileId, variants, createdAt) => {
    const insert = db.prepare(`INSERT INTO product_profile_variants
      (id, profile_id, ordinal, label, color, spec, size, capacity, dim_label, count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    variants.forEach((variant, ordinal) => insert.run(
      randomUUID(), profileId, ordinal, variant.label, variant.color, variant.spec,
      variant.size, variant.capacity, variant.dimLabel, variant.count, createdAt,
    ));
  };

  const insertProductProfileAssets = (profileId, ownerEmail, assets, createdAt) => {
    const insert = db.prepare(`INSERT INTO product_profile_assets
      (profile_id, owner_email, project_id, project_asset_id, role, expected_content_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    assets.forEach(asset => insert.run(
      profileId, ownerEmail, asset.projectId, asset.projectAssetId, asset.role,
      asset.expectedContentHash, createdAt,
    ));
  };

  const api = {
    createProject({ ownerEmail, kind, title = '' }) {
      return insertProject({ ownerEmail, kind, title });
    },

    createProjectIdempotent({ ownerEmail, idempotencyKey, kind, title = '' }) {
      const owner = normalizeOwner(ownerEmail);
      const key = String(idempotencyKey || '').trim();
      if (!key) throw codedError('IDEMPOTENCY_KEY_REQUIRED', 'idempotency key is required');
      return db.transaction(() => {
        const previous = db.prepare(`SELECT response FROM project_idempotency_keys
          WHERE owner_email = ? AND route = 'POST /api/projects' AND idempotency_key = ?`).get(owner, key);
        if (previous) return { project: parse(previous.response, {}), replayed: true };
        const project = insertProject({ ownerEmail: owner, kind, title });
        db.prepare(`INSERT INTO project_idempotency_keys (owner_email, route, idempotency_key, response, created_at)
          VALUES (?, 'POST /api/projects', ?, ?, ?)`).run(owner, key, JSON.stringify(project), timestamp().toISOString());
        return { project, replayed: false };
      })();
    },

    createProductProfile({ ownerEmail, idempotencyKey, name, category = '', facts = {}, variants = [], assets = [] }) {
      const owner = normalizeOwner(ownerEmail);
      if (!owner) throw new TypeError('ownerEmail is required');
      const key = normalizeOptionalIdempotencyKey(idempotencyKey);
      if (!key) throw codedError('IDEMPOTENCY_KEY_REQUIRED', 'idempotency key is required');
      const input = normalizeProductProfileInput({ name, category, facts, variants, assets });
      const fingerprint = stableSerialize(input);
      return db.transaction(() => {
        const route = 'POST /api/product-profiles';
        const previous = db.prepare(`SELECT response FROM product_profile_idempotency_keys
          WHERE owner_email = ? AND route = ? AND idempotency_key = ?`).get(owner, route, key);
        if (previous) {
          const stored = parse(previous.response, {});
          if (stored.fingerprint !== fingerprint) throw codedError('IDEMPOTENCY_CONFLICT', 'idempotency key belongs to another request');
          return hydrateProductProfile(db.prepare('SELECT * FROM product_profiles WHERE id = ? AND owner_email = ?')
            .get(stored.profileId, owner));
        }
        validateProductProfileAssets(owner, input.assets);
        const profileId = randomUUID();
        const createdAt = timestamp().toISOString();
        db.prepare(`INSERT INTO product_profiles
          (id, owner_email, name, category, facts_json, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`).run(
          profileId, owner, input.name, input.category, JSON.stringify(input.facts), createdAt, createdAt,
        );
        insertProductProfileVariants(profileId, input.variants, createdAt);
        insertProductProfileAssets(profileId, owner, input.assets, createdAt);
        db.prepare(`INSERT INTO product_profile_idempotency_keys
          (owner_email, route, idempotency_key, response, created_at)
          VALUES (?, ?, ?, ?, ?)`).run(owner, route, key, JSON.stringify({ profileId, fingerprint }), createdAt);
        return hydrateProductProfile(db.prepare('SELECT * FROM product_profiles WHERE id = ?').get(profileId));
      }).immediate();
    },

    listProductProfiles({ ownerEmail, status = '', limit = 100 } = {}) {
      const owner = normalizeOwner(ownerEmail);
      if (!owner) throw new TypeError('ownerEmail is required');
      const normalizedStatus = String(status || '').trim();
      if (normalizedStatus && !['active', 'archived'].includes(normalizedStatus)) {
        throw codedError('PRODUCT_PROFILE_STATUS_INVALID', 'product profile status is invalid');
      }
      const parsedLimit = Number(limit);
      const boundedLimit = Math.min(Math.max(Number.isSafeInteger(parsedLimit) ? parsedLimit : 100, 1), 200);
      const rows = normalizedStatus
        ? db.prepare(`SELECT * FROM product_profiles WHERE owner_email = ? AND status = ?
          ORDER BY updated_at DESC, id DESC LIMIT ?`).all(owner, normalizedStatus, boundedLimit)
        : db.prepare(`SELECT * FROM product_profiles WHERE owner_email = ?
          ORDER BY updated_at DESC, id DESC LIMIT ?`).all(owner, boundedLimit);
      return rows.map(hydrateProductProfile);
    },

    getProductProfile({ ownerEmail, profileId }) {
      const owner = normalizeOwner(ownerEmail);
      if (!owner) throw new TypeError('ownerEmail is required');
      const row = db.prepare('SELECT * FROM product_profiles WHERE id = ? AND owner_email = ?').get(String(profileId || '').trim(), owner);
      return hydrateProductProfile(row);
    },

    updateProductProfile({ ownerEmail, profileId, idempotencyKey, patch = {} }) {
      const owner = normalizeOwner(ownerEmail);
      if (!owner) throw new TypeError('ownerEmail is required');
      const key = normalizeOptionalIdempotencyKey(idempotencyKey);
      if (!key) throw codedError('IDEMPOTENCY_KEY_REQUIRED', 'idempotency key is required');
      const normalizedPatch = normalizeProductProfilePatch(patch);
      const id = String(profileId || '').trim();
      const fingerprint = stableSerialize({ profileId: id, patch: normalizedPatch });
      return db.transaction(() => {
        const current = requireProductProfile(owner, id);
        const route = 'PATCH /api/product-profiles/:profileId';
        const previous = db.prepare(`SELECT response FROM product_profile_idempotency_keys
          WHERE owner_email = ? AND route = ? AND idempotency_key = ?`).get(owner, route, key);
        if (previous) {
          const stored = parse(previous.response, {});
          if (stored.fingerprint !== fingerprint || stored.profileId !== id) {
            throw codedError('IDEMPOTENCY_CONFLICT', 'idempotency key belongs to another request');
          }
          return hydrateProductProfile(db.prepare('SELECT * FROM product_profiles WHERE id = ? AND owner_email = ?').get(id, owner));
        }
        if (Object.hasOwn(normalizedPatch, 'assets')) validateProductProfileAssets(owner, normalizedPatch.assets);
        const updatedAt = timestamp().toISOString();
        const assignments = [];
        const values = [];
        if (Object.hasOwn(normalizedPatch, 'name')) { assignments.push('name = ?'); values.push(normalizedPatch.name); }
        if (Object.hasOwn(normalizedPatch, 'category')) { assignments.push('category = ?'); values.push(normalizedPatch.category); }
        if (Object.hasOwn(normalizedPatch, 'facts')) { assignments.push('facts_json = ?'); values.push(JSON.stringify(normalizedPatch.facts)); }
        if (Object.hasOwn(normalizedPatch, 'status')) { assignments.push('status = ?'); values.push(normalizedPatch.status); }
        assignments.push('updated_at = ?');
        values.push(updatedAt, id, owner);
        db.prepare(`UPDATE product_profiles SET ${assignments.join(', ')} WHERE id = ? AND owner_email = ?`).run(...values);
        if (Object.hasOwn(normalizedPatch, 'variants')) {
          db.prepare('DELETE FROM product_profile_variants WHERE profile_id = ?').run(id);
          insertProductProfileVariants(id, normalizedPatch.variants, updatedAt);
        }
        if (Object.hasOwn(normalizedPatch, 'assets')) {
          db.prepare('DELETE FROM product_profile_assets WHERE profile_id = ?').run(id);
          insertProductProfileAssets(id, owner, normalizedPatch.assets, updatedAt);
        }
        db.prepare(`INSERT INTO product_profile_idempotency_keys
          (owner_email, route, idempotency_key, response, created_at)
          VALUES (?, ?, ?, ?, ?)`).run(owner, route, key, JSON.stringify({ profileId: id, fingerprint }), updatedAt);
        return hydrateProductProfile(db.prepare('SELECT * FROM product_profiles WHERE id = ? AND owner_email = ?').get(id, owner));
      }).immediate();
    },

    archiveProductProfile({ ownerEmail, profileId }) {
      const owner = normalizeOwner(ownerEmail);
      if (!owner) throw new TypeError('ownerEmail is required');
      const id = String(profileId || '').trim();
      requireProductProfile(owner, id);
      db.prepare(`UPDATE product_profiles SET status = 'archived', updated_at = ?
        WHERE id = ? AND owner_email = ?`).run(timestamp().toISOString(), id, owner);
      return hydrateProductProfile(db.prepare('SELECT * FROM product_profiles WHERE id = ? AND owner_email = ?').get(id, owner));
    },

    // 把生成结果追加挂到商品档案：弱关联标签(product_profile_assets)只增不删，
    // 引用必须能解析到本主名下可复用的 project_assets，避免档案引用悬空。
    attachProductProfileAssets({ ownerEmail, profileId, assets = [] }) {
      const owner = normalizeOwner(ownerEmail);
      if (!owner) throw new TypeError('ownerEmail is required');
      const id = String(profileId || '').trim();
      const incoming = Array.isArray(assets) ? assets : [];
      return db.transaction(() => {
        requireProductProfile(owner, id);
        const resolvedRefs = [];
        const seen = new Set();
        for (const item of incoming.slice(0, 128)) {
          let ref;
          if (isRecord(item) && String(item.projectId || '').trim()
            && String(item.projectAssetId || '').trim() && String(item.expectedContentHash || '').trim()) {
            ref = normalizeProductProfileAssetRef(item);
          } else {
            const assetKey = String(isRecord(item) ? (item.assetId || '') : item || '').trim();
            if (!assetKey) throw codedError('PRODUCT_PROFILE_ASSET_REF_INVALID', 'asset reference must carry an asset id');
            const row = db.prepare(`SELECT pa.*, p.owner_email AS project_owner_email
              FROM project_assets pa
              JOIN projects p ON p.id = pa.project_id AND p.deleted_at IS NULL
              WHERE pa.owner_email = ? AND pa.asset_id = ? AND pa.deleted_at IS NULL
              ORDER BY pa.created_at DESC, pa.id DESC LIMIT 1`).get(owner, assetKey.slice(0, 256));
            if (!row) throw codedError('PRODUCT_PROFILE_ASSET_NOT_FOUND', 'generated asset is not an owned project asset');
            const rawRole = String(item?.role || '').trim().toLowerCase();
            const role = ['product', 'reference', 'person', 'scene', 'generated'].includes(rawRole) ? rawRole : 'generated';
            ref = normalizeProductProfileAssetRef({
              projectId: row.project_id,
              projectAssetId: row.id,
              role,
              expectedContentHash: row.content_hash,
            });
          }
          validateProductProfileAssets(owner, [ref]);
          const key = `${ref.projectId}\u0000${ref.projectAssetId}\u0000${ref.role}`;
          if (seen.has(key)) continue;
          seen.add(key);
          resolvedRefs.push(ref);
        }
        let added = 0;
        const createdAt = timestamp().toISOString();
        for (const ref of resolvedRefs) {
          const result = db.prepare(`INSERT OR IGNORE INTO product_profile_assets
            (profile_id, owner_email, project_id, project_asset_id, role, expected_content_hash, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
            id, owner, ref.projectId, ref.projectAssetId, ref.role, ref.expectedContentHash, createdAt,
          );
          added += Number(result.changes);
        }
        if (added > 0) {
          db.prepare('UPDATE product_profiles SET updated_at = ? WHERE id = ? AND owner_email = ?').run(createdAt, id, owner);
        }
        return {
          profile: hydrateProductProfile(db.prepare('SELECT * FROM product_profiles WHERE id = ? AND owner_email = ?').get(id, owner)),
          added,
        };
      }).immediate();
    },

    getProject({ ownerEmail, projectId }) {
      return projectFromRow(db.prepare('SELECT * FROM projects WHERE id = ? AND owner_email = ? AND deleted_at IS NULL').get(projectId, normalizeOwner(ownerEmail)));
    },

    createProjectAsset({
      ownerEmail,
      projectId,
      versionId = null,
      generationRunId = null,
      assetId,
      role = 'reference',
      stableUrl,
      contentHash,
      mimeType,
      width = null,
      height = null,
      parentAssetId = null,
      retentionClass = 'source',
      metadata = {},
      productionState = 'draft',
      visibleInLibrary = undefined,
    }) {
      const owner = normalizeOwner(ownerEmail);
      const project = requireProject(owner, projectId);
      const externalAssetId = cleanProjectAssetValue(assetId, 'assetId', 256);
      const normalizedRole = cleanProjectAssetValue(role, 'role', 80);
      const url = cleanProjectAssetValue(stableUrl, 'stableUrl');
      const hash = cleanProjectAssetValue(contentHash, 'contentHash', 256);
      const type = cleanProjectAssetValue(mimeType, 'mimeType', 160).toLowerCase();
      const normalizedProductionState = normalizeProductionState(productionState);
      if (normalizedProductionState !== 'draft') {
        throw codedError('PROJECT_ASSET_PRODUCTION_STATE_SYSTEM_ONLY', 'project asset production state is server-derived');
      }
      const normalizedRetentionClass = cleanProjectAssetValue(retentionClass, 'retentionClass', 40);
      const derivedProductionState = normalizedRetentionClass === 'generated' && normalizedRole === 'generated-video'
        ? 'candidate'
        : normalizedProductionState;
      const normalizedMetadata = { ...normalizeProjectAssetMetadata(metadata) };
      const metadataJson = JSON.stringify(normalizedMetadata);
      if (!isOwnedApplicationAssetUrl(url)) throw new TypeError('stableUrl must be an owned application asset URL');
      if (versionId) requireVersion(project.id, versionId);
      if (parentAssetId) {
        const parent = db.prepare(`SELECT id FROM project_assets
          WHERE id = ? AND owner_email = ? AND project_id = ? AND deleted_at IS NULL`).get(parentAssetId, owner, project.id);
        if (!parent) throw codedError('PROJECT_ASSET_NOT_FOUND', 'parent project asset not found');
      }
      const persist = db.transaction(() => {
        const existing = db.prepare(`SELECT * FROM project_assets
          WHERE owner_email = ? AND project_id = ? AND asset_id = ? AND content_hash = ?
            AND stable_url = ? AND deleted_at IS NULL AND retention_state = 'active'
          ORDER BY created_at DESC LIMIT 1`).get(owner, project.id, externalAssetId, hash, url);
        if (existing) {
          if (derivedProductionState === 'candidate' && existing.production_state === 'draft') {
            db.prepare(`UPDATE project_assets SET production_state = 'candidate'
              WHERE id = ? AND owner_email = ? AND project_id = ? AND deleted_at IS NULL`).run(
              existing.id, owner, project.id,
            );
          }
          return projectAssetFromRow(db.prepare('SELECT * FROM project_assets WHERE id = ?').get(existing.id));
        }
        const id = crypto.randomUUID();
        const createdAt = timestamp().toISOString();
        db.prepare(`INSERT INTO project_assets
          (id, asset_id, owner_email, project_id, version_id, generation_run_id, role, parent_asset_id,
           content_hash, stable_url, mime_type, width, height, metadata_json, retention_class, production_state, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          id, externalAssetId, owner, project.id, versionId, generationRunId, normalizedRole, parentAssetId,
          hash, url, type, Number.isSafeInteger(width) ? width : null, Number.isSafeInteger(height) ? height : null,
          metadataJson, normalizedRetentionClass, derivedProductionState, createdAt,
        );
        return projectAssetFromRow(db.prepare('SELECT * FROM project_assets WHERE id = ?').get(id));
      });
      return persist.immediate();
    },

    getProjectAsset({ ownerEmail, projectId, projectAssetId, purpose = 'read' }) {
      const normalizedPurpose = normalizeProjectAssetPurpose(purpose);
      const project = requireProject(ownerEmail, projectId);
      const asset = projectAssetFromRow(db.prepare(`SELECT * FROM project_assets
        WHERE id = ? AND owner_email = ? AND project_id = ? AND deleted_at IS NULL`)
        .get(projectAssetId, project.ownerEmail, project.id));
      if (normalizedPurpose === 'reuse' && asset && !isReusableProjectAsset(asset, timestamp())) {
        throw codedError('PROJECT_ASSET_NOT_REUSABLE', 'project asset is not available for new reuse');
      }
      return asset;
    },

    setProjectAssetRetention({ ownerEmail, projectId, projectAssetId, pinned }) {
      if (typeof pinned !== 'boolean') throw codedError('PROJECT_ASSET_RETENTION_INVALID', 'pinned must be a boolean');
      return db.transaction(() => {
        const project = requireProject(ownerEmail, projectId);
        const row = db.prepare(`SELECT * FROM project_assets
          WHERE id = ? AND owner_email = ? AND project_id = ? AND deleted_at IS NULL`).get(
          projectAssetId, project.ownerEmail, project.id,
        );
        if (!row) throw codedError('PROJECT_ASSET_NOT_FOUND', 'project asset not found');
        const currentlyPinned = Number(row.retention_pinned) === 1 || row.retention_class === 'permanent';
        if (pinned) {
          if (!currentlyPinned) {
            const previousClass = row.retention_class_before_pin
              || (row.retention_class === 'permanent' ? null : row.retention_class || 'completed');
            db.prepare(`UPDATE project_assets
              SET retention_class = 'permanent', retention_class_before_pin = ?, retention_pinned = 1,
                  expires_at_before_pin = expires_at, expires_at = NULL,
                  retention_state = 'active', marked_at = NULL, isolated_at = NULL
              WHERE id = ? AND owner_email = ? AND project_id = ? AND deleted_at IS NULL`).run(
              previousClass, row.id, project.ownerEmail, project.id,
            );
          }
        } else if (currentlyPinned) {
          const restoredClass = row.retention_class_before_pin && row.retention_class_before_pin !== 'permanent'
            ? row.retention_class_before_pin : 'completed';
          db.prepare(`UPDATE project_assets
            SET retention_class = ?, retention_class_before_pin = NULL, retention_pinned = 0,
                expires_at = expires_at_before_pin, expires_at_before_pin = NULL,
                retention_state = 'active', marked_at = NULL, isolated_at = NULL
            WHERE id = ? AND owner_email = ? AND project_id = ? AND deleted_at IS NULL`).run(
            restoredClass, row.id, project.ownerEmail, project.id,
          );
        }
        return projectAssetFromRow(db.prepare('SELECT * FROM project_assets WHERE id = ?').get(row.id));
      })();
    },

    setProjectAssetProductionState({ ownerEmail, projectId, projectAssetId, productionState }) {
      const project = requireProject(ownerEmail, projectId);
      const normalizedState = normalizeProductionState(productionState);
      const current = db.prepare(`SELECT production_state FROM project_assets
        WHERE id = ? AND owner_email = ? AND project_id = ? AND deleted_at IS NULL`).get(
        projectAssetId, project.ownerEmail, project.id,
      );
      if (!current) throw codedError('PROJECT_ASSET_NOT_FOUND', 'project asset not found');
      const currentState = normalizeProductionState(current.production_state);
      if (normalizedState === 'delivered' && currentState !== 'delivered') {
        throw codedError('PROJECT_ASSET_PRODUCTION_STATE_SYSTEM_ONLY', 'delivered production state is server-derived');
      }
      if (!USER_PROJECT_ASSET_PRODUCTION_TRANSITIONS[currentState]?.has(normalizedState)) {
        throw codedError('PROJECT_ASSET_PRODUCTION_STATE_TRANSITION_INVALID', 'project asset production state transition is invalid');
      }
      const result = db.prepare(`UPDATE project_assets
        SET production_state = ?
        WHERE id = ? AND owner_email = ? AND project_id = ? AND deleted_at IS NULL`).run(
        normalizedState, projectAssetId, project.ownerEmail, project.id,
      );
      if (result.changes !== 1) throw codedError('PROJECT_ASSET_NOT_FOUND', 'project asset not found');
      return projectAssetFromRow(db.prepare('SELECT * FROM project_assets WHERE id = ?').get(projectAssetId));
    },

    setProjectAssetVisibleInLibrary({ ownerEmail, projectId, projectAssetId, visibleInLibrary = true }) {
      const project = requireProject(ownerEmail, projectId);
      const row = db.prepare(`SELECT metadata_json, id FROM project_assets
        WHERE id = ? AND owner_email = ? AND project_id = ? AND deleted_at IS NULL`).get(
        projectAssetId, project.ownerEmail, project.id,
      );
      if (!row) throw codedError('PROJECT_ASSET_NOT_FOUND', 'project asset not found');
      const metadata = parse(row.metadata_json, {});
      metadata.visibleInLibrary = Boolean(visibleInLibrary);
      db.prepare(`UPDATE project_assets SET metadata_json = ? WHERE id = ?`).run(
        JSON.stringify(metadata), row.id,
      );
      return projectAssetFromRow(db.prepare('SELECT * FROM project_assets WHERE id = ?').get(row.id));
    },

    setProjectAssetsVisibleInLibrary({ ownerEmail, projectId, visibleInLibrary = true }) {
      const project = requireProject(ownerEmail, projectId);
      const rows = db.prepare(`SELECT metadata_json, id FROM project_assets
        WHERE owner_email = ? AND project_id = ? AND deleted_at IS NULL`).all(
        project.ownerEmail, project.id,
      );
      const updated = [];
      for (const row of rows) {
        const metadata = parse(row.metadata_json, {});
        metadata.visibleInLibrary = Boolean(visibleInLibrary);
        db.prepare(`UPDATE project_assets SET metadata_json = ? WHERE id = ?`).run(
          JSON.stringify(metadata), row.id,
        );
        updated.push(projectAssetFromRow(db.prepare('SELECT * FROM project_assets WHERE id = ?').get(row.id)));
      }
      return updated;
    },

    getProjectAssetLineage({ ownerEmail, projectId, projectAssetId }) {
      const project = requireProject(ownerEmail, projectId);
      const assetRow = db.prepare(`SELECT pa.*, p.kind AS project_kind, p.title AS project_title,
          p.status AS project_status, p.updated_at AS project_updated_at
        FROM project_assets pa
        JOIN projects p ON p.id = pa.project_id
        WHERE pa.id = ? AND pa.owner_email = ? AND pa.project_id = ?
          AND pa.deleted_at IS NULL AND p.deleted_at IS NULL`).get(
        projectAssetId, project.ownerEmail, project.id,
      );
      if (!assetRow) return null;
      const asset = projectAssetLibraryItemFromRow(assetRow);
      const refColumns = `
        l.relation AS lineage_relation,
        l.generation_run_id AS lineage_relation_generation_run_id,
        l.created_at AS lineage_relation_created_at,
        linked.id AS lineage_asset_id,
        linked.asset_id AS lineage_asset_external_id,
        linked.version_id AS lineage_version_id,
        linked.generation_run_id AS lineage_generation_run_id,
        linked.role AS lineage_role,
        linked.parent_asset_id AS lineage_parent_asset_id,
        linked.content_hash AS lineage_content_hash,
        linked.stable_url AS lineage_stable_url,
        linked.mime_type AS lineage_mime_type,
        linked.width AS lineage_width,
        linked.height AS lineage_height,
        linked.retention_class AS lineage_retention_class,
        linked.retention_state AS lineage_retention_state,
        linked.production_state AS lineage_production_state,
        linked.created_at AS lineage_asset_created_at,
        p.id AS lineage_project_id,
        p.kind AS lineage_project_kind,
        p.title AS lineage_project_title,
        p.status AS lineage_project_status,
        p.updated_at AS lineage_project_updated_at`;
      const relationJoins = `
        JOIN project_assets linked ON linked.id = LINKED_ID
          AND linked.owner_email = ? AND linked.project_id = ? AND linked.deleted_at IS NULL
        JOIN projects p ON p.id = linked.project_id AND p.owner_email = linked.owner_email AND p.deleted_at IS NULL`;
      const parentRows = db.prepare(`SELECT ${refColumns}
        FROM project_asset_lineage l
        ${relationJoins.replace('LINKED_ID', 'l.source_asset_id')}
        WHERE l.project_id = ? AND l.target_asset_id = ?
        ORDER BY l.created_at DESC, linked.created_at DESC, linked.id DESC`).all(
        project.ownerEmail, project.id, project.id, asset.projectAssetId,
      );
      const childRows = db.prepare(`SELECT ${refColumns}
        FROM project_asset_lineage l
        ${relationJoins.replace('LINKED_ID', 'l.target_asset_id')}
        WHERE l.project_id = ? AND l.source_asset_id = ?
        ORDER BY l.created_at DESC, linked.created_at DESC, linked.id DESC`).all(
        project.ownerEmail, project.id, project.id, asset.projectAssetId,
      );
      const sourceReferences = externalProjectAssetRefs(asset).flatMap(reference => {
        const sourceRow = db.prepare(`SELECT pa.*, p.kind AS project_kind, p.title AS project_title,
            p.status AS project_status, p.updated_at AS project_updated_at
          FROM project_assets pa
          JOIN projects p ON p.id = pa.project_id
          WHERE pa.id = ? AND pa.project_id = ? AND pa.owner_email = ?
            AND pa.deleted_at IS NULL AND p.deleted_at IS NULL
            AND pa.content_hash = ?`).get(
          reference.projectAssetId, reference.projectId, project.ownerEmail, reference.expectedContentHash,
        );
        if (!sourceRow) return [];
        const sourceAsset = projectAssetLibraryItemFromRow(sourceRow);
        return [{
          ...reference,
          verified: true,
          sourceAsset: {
            projectAssetId: sourceAsset.projectAssetId,
            assetId: sourceAsset.assetId,
            versionId: sourceAsset.versionId,
            role: sourceAsset.role,
            contentHash: sourceAsset.contentHash,
            stableUrl: sourceAsset.stableUrl,
            mimeType: sourceAsset.mimeType,
            mediaKind: sourceAsset.mediaKind,
            width: sourceAsset.width,
            height: sourceAsset.height,
            createdAt: sourceAsset.createdAt,
          },
          project: sourceAsset.project,
        }];
      });
      return {
        asset,
        parents: parentRows.map(projectAssetLineageRefFromRow),
        children: childRows.map(projectAssetLineageRefFromRow),
        sourceReferences,
      };
    },

    listProjectAssets({ ownerEmail, projectId, mediaKind = '' } = {}) {
      const project = requireProject(ownerEmail, projectId);
      const assets = db.prepare(`SELECT * FROM project_assets
        WHERE owner_email = ? AND project_id = ? AND deleted_at IS NULL
        ORDER BY created_at DESC, id DESC`).all(project.ownerEmail, project.id).map(projectAssetFromRow);
      const kind = String(mediaKind || '').trim().toLowerCase();
      return kind ? assets.filter(asset => asset.mediaKind === kind) : assets;
    },

    listProjectAssetLibrary({ ownerEmail, projectId = '', projectKind = '', mediaKind = '', productionState = '', query = '', limit = 200 } = {}) {
      const owner = normalizeOwner(ownerEmail);
      if (!owner) throw new TypeError('ownerEmail is required');
      const normalizedProjectId = String(projectId || '').trim();
      const normalizedProjectKind = String(projectKind || '').trim().toLowerCase();
      const normalizedMediaKind = String(mediaKind || '').trim().toLowerCase();
      const normalizedProductionState = String(productionState || '').trim().toLowerCase();
      const normalizedQuery = normalizeAssetLibraryQuery(query);
      if (normalizedProjectKind && !PROJECT_KINDS.has(normalizedProjectKind)) throw new TypeError('unknown projectKind');
      if (normalizedMediaKind && !['image', 'video', 'audio'].includes(normalizedMediaKind)) throw new TypeError('unknown mediaKind');
      if (normalizedProductionState && !PROJECT_ASSET_PRODUCTION_STATES.has(normalizedProductionState)) throw codedError('PROJECT_ASSET_PRODUCTION_STATE_INVALID', 'unknown project asset production state');
      const boundedLimit = Number.isSafeInteger(Number(limit))
        ? Math.min(500, Math.max(1, Number(limit)))
        : 200;
      const clauses = [
        'pa.owner_email = ?',
        'pa.deleted_at IS NULL',
        'p.owner_email = pa.owner_email',
        'p.deleted_at IS NULL',
        'json_extract(pa.metadata_json, \'$.visibleInLibrary\') IS NOT false',
      ];
      const params = [owner];
      if (normalizedProjectId) {
        clauses.push('pa.project_id = ?');
        params.push(normalizedProjectId);
      }
      if (normalizedProjectKind) {
        clauses.push('p.kind = ?');
        params.push(normalizedProjectKind);
      }
      if (normalizedMediaKind) {
        clauses.push('pa.mime_type LIKE ?');
        params.push(`${normalizedMediaKind}/%`);
      }
      if (normalizedProductionState) {
        clauses.push('pa.production_state = ?');
        params.push(normalizedProductionState);
      }
      if (normalizedQuery) {
        const pattern = `%${escapeLikePattern(normalizedQuery)}%`;
        clauses.push(`(
          LOWER(pa.id) LIKE ? ESCAPE '\\'
          OR LOWER(pa.asset_id) LIKE ? ESCAPE '\\'
          OR LOWER(pa.role) LIKE ? ESCAPE '\\'
          OR LOWER(pa.metadata_json) LIKE ? ESCAPE '\\'
          OR LOWER(p.id) LIKE ? ESCAPE '\\'
          OR LOWER(COALESCE(p.title, '')) LIKE ? ESCAPE '\\'
        )`);
        params.push(pattern, pattern, pattern, pattern, pattern, pattern);
      }
      params.push(boundedLimit);
      return db.prepare(`SELECT pa.*, p.kind AS project_kind, p.title AS project_title,
          p.status AS project_status, p.updated_at AS project_updated_at
        FROM project_assets pa
        JOIN projects p ON p.id = pa.project_id
        WHERE ${clauses.join(' AND ')}
        ORDER BY pa.created_at DESC, pa.id DESC
        LIMIT ?`).all(...params).map(projectAssetLibraryItemFromRow);
    },

    linkProjectAsset({ ownerEmail, projectId, sourceProjectAssetId, targetProjectAssetId, relation, generationRunId = null }) {
      const project = requireProject(ownerEmail, projectId);
      const source = db.prepare(`SELECT id FROM project_assets
        WHERE id = ? AND owner_email = ? AND project_id = ? AND deleted_at IS NULL`).get(sourceProjectAssetId, project.ownerEmail, project.id);
      const target = db.prepare(`SELECT id FROM project_assets
        WHERE id = ? AND owner_email = ? AND project_id = ? AND deleted_at IS NULL`).get(targetProjectAssetId, project.ownerEmail, project.id);
      if (!source || !target) throw codedError('PROJECT_ASSET_NOT_FOUND', 'project asset not found');
      const normalizedRelation = cleanProjectAssetValue(relation, 'relation', 80);
      const createdAt = timestamp().toISOString();
      db.prepare(`INSERT OR IGNORE INTO project_asset_lineage
        (project_id, source_asset_id, target_asset_id, relation, generation_run_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`).run(project.id, source.id, target.id, normalizedRelation, generationRunId || null, createdAt);
      return { projectId: project.id, sourceProjectAssetId: source.id, targetProjectAssetId: target.id, relation: normalizedRelation };
    },

    listProjects({ ownerEmail, includeCompleted = true } = {}) {
      const owner = normalizeOwner(ownerEmail);
      const rows = includeCompleted
        ? db.prepare('SELECT * FROM projects WHERE owner_email = ? AND deleted_at IS NULL ORDER BY updated_at DESC').all(owner)
        : db.prepare("SELECT * FROM projects WHERE owner_email = ? AND deleted_at IS NULL AND status <> 'completed' ORDER BY updated_at DESC").all(owner);
      return rows.map(projectFromRow);
    },

    createVersion({ ownerEmail, projectId, parentVersionId = null, reason, inputSnapshot = {}, planSnapshot = {}, canvasSnapshotId = null, idempotencyKey = '' }) {
      if (!VERSION_REASONS.has(reason)) throw new TypeError('unknown version reason');
      const key = normalizeOptionalIdempotencyKey(idempotencyKey);
      const fingerprint = key ? stableSerialize({
        projectId,
        parentVersionId,
        reason,
        inputSnapshot: inputSnapshot || {},
        planSnapshot: planSnapshot || {},
        canvasSnapshotId,
      }) : '';
      return db.transaction(() => {
        const project = requireProject(ownerEmail, projectId);
        if (key) {
          const previous = db.prepare(`SELECT response FROM project_idempotency_keys
            WHERE owner_email = ? AND route = 'POST /api/projects/:projectId/versions' AND idempotency_key = ?`).get(project.ownerEmail, key);
          if (previous) {
            const replay = parse(previous.response, {});
            if (replay.projectId !== project.id || !replay.version?.id || (replay.fingerprint && replay.fingerprint !== fingerprint)) {
              throw codedError('IDEMPOTENCY_CONFLICT', 'idempotency key belongs to another project');
            }
            return replay.version;
          }
        }
        if (parentVersionId) requireVersion(project.id, parentVersionId);
        const sequence = db.prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS value FROM project_versions WHERE project_id = ?').get(project.id).value;
        const id = randomUUID();
        const createdAt = timestamp().toISOString();
        db.prepare(`INSERT INTO project_versions
          (id, project_id, parent_version_id, reason, sequence, input_snapshot, plan_snapshot, canvas_snapshot_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          id, project.id, parentVersionId, reason, sequence,
          JSON.stringify(inputSnapshot || {}), JSON.stringify(planSnapshot || {}), canvasSnapshotId, createdAt,
        );
        db.prepare('UPDATE projects SET head_version_id = ?, updated_at = ? WHERE id = ?').run(id, createdAt, project.id);
        const version = versionFromRow(db.prepare('SELECT * FROM project_versions WHERE id = ?').get(id));
        if (key) {
          db.prepare(`INSERT INTO project_idempotency_keys (owner_email, route, idempotency_key, response, created_at)
            VALUES (?, 'POST /api/projects/:projectId/versions', ?, ?, ?)`).run(
            project.ownerEmail, key, JSON.stringify({ projectId: project.id, fingerprint, version }), createdAt,
          );
        }
        return version;
      }).immediate();
    },

    createCheckpoint({ ownerEmail, projectId, versionId, generationRunId = null, reason, expiresAt = null }) {
      if (!CHECKPOINT_REASONS.has(reason)) throw new TypeError('unknown checkpoint reason');
      const project = requireProject(ownerEmail, projectId);
      requireVersion(project.id, versionId);
      const created = timestamp();
      const id = randomUUID();
      const expiry = expiresAt ? new Date(expiresAt) : new Date(created.getTime() + checkpointTtlMs);
      if (!Number.isFinite(expiry.getTime())) throw new TypeError('expiresAt must be a valid date');
      db.prepare(`INSERT INTO recovery_checkpoints
        (id, owner_email, project_id, version_id, generation_run_id, reason, status, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?)`).run(
        id, project.ownerEmail, project.id, versionId, generationRunId, reason, expiry.toISOString(), created.toISOString(),
      );
      return hydrateCheckpoint(db.prepare('SELECT * FROM recovery_checkpoints WHERE id = ?').get(id));
    },

    ensureVideoGeneration({
      ownerEmail,
      generationRunId,
      projectId = null,
      title = 'AI 视频项目',
      inputSnapshot = {},
      planSnapshot = {},
      quoteId = null,
      holdId = null,
      assets = [],
    }) {
      const owner = normalizeOwner(ownerEmail);
      const runId = String(generationRunId || '').trim();
      if (!owner) throw new TypeError('ownerEmail is required');
      if (!runId) throw new TypeError('generationRunId is required');
      return db.transaction(() => {
        const existingRun = db.prepare('SELECT * FROM project_generation_runs WHERE id = ? AND owner_email = ?').get(runId, owner);
        if (existingRun) {
          const run = runFromRow(existingRun);
          return {
            project: requireProject(owner, run.projectId),
            sourceVersion: requireVersion(run.projectId, run.sourceVersionId),
            run,
          };
        }
        const project = projectId
          ? requireProject(owner, String(projectId || '').trim())
          : insertProject({ ownerEmail: owner, kind: 'video', title });
        if (project.kind !== 'video') throw codedError('VIDEO_PROJECT_KIND_INVALID', 'target project must be a video project');
        if (project.status === 'completed') throw codedError('VIDEO_PROJECT_COMPLETED', 'completed video project cannot accept another generation');
        const sourceVersionId = randomUUID();
        const createdAt = timestamp().toISOString();
        const parentVersionId = project.headVersionId || null;
        const sequence = db.prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS value FROM project_versions WHERE project_id = ?').get(project.id).value;
        db.prepare(`INSERT INTO project_versions
          (id, project_id, parent_version_id, reason, sequence, input_snapshot, plan_snapshot, canvas_snapshot_id, created_at)
          VALUES (?, ?, ?, 'generation', ?, ?, ?, NULL, ?)`).run(
          sourceVersionId, project.id, parentVersionId, sequence,
          JSON.stringify(inputSnapshot || {}), JSON.stringify(planSnapshot || {}), createdAt,
        );
        db.prepare("UPDATE projects SET status = 'running', head_version_id = ?, updated_at = ? WHERE id = ?")
          .run(sourceVersionId, createdAt, project.id);
        db.prepare(`INSERT INTO project_generation_runs
          (id, project_id, source_version_id, owner_email, kind, status, quote_id, hold_id, progress, created_at)
          VALUES (?, ?, ?, ?, 'video', 'queued', ?, ?, '{}', ?)`).run(
          runId, project.id, sourceVersionId, owner, quoteId, holdId, createdAt,
        );
        for (const asset of Array.isArray(assets) ? assets : []) {
          const assetId = String(asset?.assetId || '').trim();
          const stableUrl = String(asset?.stableUrl || '').trim();
          const contentHash = String(asset?.contentHash || '').trim();
          const mimeType = String(asset?.mimeType || '').trim().toLowerCase();
          if (!assetId || !stableUrl || /^https?:\/\//i.test(stableUrl)
            || /[\u0000-\u001F\u007F]/.test(stableUrl)
            || !contentHash || !/^(?:image|video|audio)\//.test(mimeType)) {
            throw codedError('VIDEO_ASSET_NOT_READY', 'video source asset is not durably verified');
          }
          db.prepare(`INSERT OR IGNORE INTO project_assets
            (id, asset_id, owner_email, project_id, version_id, generation_run_id, role, content_hash, stable_url, mime_type, retention_class, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'source', ?)`).run(
            `${project.id}:${sourceVersionId}:${assetId}:source`, assetId, owner, project.id, sourceVersionId, runId,
              String(asset?.role || 'reference'), contentHash, stableUrl, mimeType, createdAt,
          );
        }
        return {
          project: requireProject(owner, project.id),
          sourceVersion: requireVersion(project.id, sourceVersionId),
          run: runFromRow(db.prepare('SELECT * FROM project_generation_runs WHERE id = ?').get(runId)),
        };
      }).immediate();
    },

    completeVideoGeneration({
      ownerEmail,
      generationRunId,
      resultInputSnapshot = {},
      resultPlanSnapshot = {},
      outputAsset,
      sourceAssetIds = [],
    }) {
      const owner = normalizeOwner(ownerEmail);
      const runId = String(generationRunId || '').trim();
      if (!owner) throw new TypeError('ownerEmail is required');
      if (!runId) throw new TypeError('generationRunId is required');
      const outputAssetId = String(outputAsset?.assetId || '').trim();
      const stableUrl = String(outputAsset?.stableUrl || '').trim();
      const contentHash = String(outputAsset?.contentHash || '').trim();
      const mimeType = String(outputAsset?.mimeType || '').trim().toLowerCase();
      if (!outputAssetId || !stableUrl) throw new TypeError('outputAsset is required');
      if (/^https?:\/\//i.test(stableUrl) || /[\u0000-\u001F\u007F]/.test(stableUrl)
        || !contentHash || !mimeType.startsWith('video/')) {
        throw codedError('VIDEO_ASSET_NOT_READY', 'video output asset is not durably verified');
      }
      return db.transaction(() => {
        const runRow = db.prepare('SELECT * FROM project_generation_runs WHERE id = ? AND owner_email = ?').get(runId, owner);
        if (!runRow) throw codedError('GENERATION_RUN_NOT_FOUND', 'generation run not found');
        const run = runFromRow(runRow);
        const project = requireProject(owner, run.projectId);
        const sourceVersion = requireVersion(project.id, run.sourceVersionId);
        if (ECOMMERCE_TERMINAL_RUN_STATUSES.has(run.status)) {
          if (run.status !== 'completed') throw terminalConflict(run.status, 'completed');
          return {
            project,
            sourceVersion,
            resultVersion: run.resultVersionId ? requireVersion(project.id, run.resultVersionId) : null,
            run,
          };
        }
        const resultVersionId = randomUUID();
        const completedAt = timestamp().toISOString();
        const plannedDurationSeconds = Number(resultPlanSnapshot?.format?.duration);
        const plannedDurationMs = Number.isSafeInteger(Math.round(plannedDurationSeconds * 1000))
          && plannedDurationSeconds > 0
          ? Math.round(plannedDurationSeconds * 1000)
          : null;
        const sourceProjectAssetIds = [];
        for (const sourceAssetId of new Set(Array.isArray(sourceAssetIds) ? sourceAssetIds : [])) {
          const sourceProjectAsset = db.prepare(`SELECT id FROM project_assets
            WHERE project_id = ? AND owner_email = ? AND asset_id = ? AND version_id = ?`).get(
            project.id, owner, String(sourceAssetId || ''), sourceVersion.id,
          );
          if (sourceProjectAsset) sourceProjectAssetIds.push(sourceProjectAsset.id);
        }
        const canonicalMetadata = {
          source: 'video-generation',
          ...(plannedDurationMs ? { durationMs: plannedDurationMs } : {}),
          aigc: { generated: true, provenanceVersion: 'aigc-v1' },
          provenance: {
            type: 'ai-generated',
            route: 'video',
            generatedAt: completedAt,
            ...(sourceProjectAssetIds.length ? { sourceAssetIds: sourceProjectAssetIds } : {}),
          },
        };
        const sequence = db.prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS value FROM project_versions WHERE project_id = ?').get(project.id).value;
        db.prepare(`INSERT INTO project_versions
          (id, project_id, parent_version_id, reason, sequence, input_snapshot, plan_snapshot, canvas_snapshot_id, created_at)
          VALUES (?, ?, ?, 'accepted_result', ?, ?, ?, NULL, ?)`).run(
          resultVersionId, project.id, sourceVersion.id, sequence,
          JSON.stringify(resultInputSnapshot || {}), JSON.stringify(resultPlanSnapshot || {}), completedAt,
        );
        const targetProjectAssetId = `${project.id}:${outputAssetId}:result`;
        db.prepare(`INSERT INTO project_assets
          (id, asset_id, owner_email, project_id, version_id, generation_run_id, role, content_hash, stable_url, mime_type, metadata_json, retention_class, production_state, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'generated_video', ?, ?, ?, ?, 'completed', 'delivered', ?)`).run(
          targetProjectAssetId, outputAssetId, owner, project.id, resultVersionId, runId,
          contentHash, stableUrl, mimeType, JSON.stringify(canonicalMetadata), completedAt,
        );
        for (const sourceProjectAssetId of sourceProjectAssetIds) {
          db.prepare(`INSERT OR IGNORE INTO project_asset_lineage
            (project_id, source_asset_id, target_asset_id, relation, generation_run_id, created_at)
            VALUES (?, ?, ?, 'generated_from', ?, ?)`).run(
            project.id, sourceProjectAssetId, targetProjectAssetId, runId, completedAt,
          );
        }
        db.prepare(`UPDATE project_generation_runs SET status = 'completed', result_version_id = ?, completed_at = ?
          WHERE id = ? AND project_id = ? AND owner_email = ?`).run(resultVersionId, completedAt, runId, project.id, owner);
        db.prepare(`UPDATE projects SET status = 'completed', accepted_version_id = ?, head_version_id = ?, completed_at = ?, updated_at = ?
          WHERE id = ? AND owner_email = ?`).run(resultVersionId, resultVersionId, completedAt, completedAt, project.id, owner);
        return {
          project: requireProject(owner, project.id),
          sourceVersion,
          resultVersion: requireVersion(project.id, resultVersionId),
          run: runFromRow(db.prepare('SELECT * FROM project_generation_runs WHERE id = ?').get(runId)),
        };
      }).immediate();
    },

    listCheckpoints({ ownerEmail }) {
      const current = timestamp().toISOString();
      return db.prepare(`SELECT * FROM recovery_checkpoints
        WHERE owner_email = ? AND status = 'available' AND expires_at > ? ORDER BY created_at DESC`)
        .all(normalizeOwner(ownerEmail), current).map(hydrateCheckpoint);
    },

    consumeCheckpoint({ ownerEmail, checkpointId }) {
      const changed = db.prepare(`UPDATE recovery_checkpoints SET status = 'consumed'
        WHERE id = ? AND owner_email = ? AND status = 'available' AND expires_at > ?`)
        .run(checkpointId, normalizeOwner(ownerEmail), timestamp().toISOString()).changes;
      return changed === 1 ? hydrateCheckpoint(db.prepare('SELECT * FROM recovery_checkpoints WHERE id = ?').get(checkpointId)) : null;
    },

    dismissCheckpoint({ ownerEmail, checkpointId }) {
      const changed = db.prepare(`UPDATE recovery_checkpoints SET status = 'dismissed'
        WHERE id = ? AND owner_email = ? AND status = 'available'`).run(checkpointId, normalizeOwner(ownerEmail)).changes;
      return changed === 1 ? checkpointFromRow(db.prepare('SELECT * FROM recovery_checkpoints WHERE id = ?').get(checkpointId)) : null;
    },

    createCanvasSession({ ownerEmail, projectId, baseVersionId, snapshot = {}, expiresAt = null }) {
      const project = requireProject(ownerEmail, projectId);
      requireVersion(project.id, baseVersionId);
      const durableSnapshot = normalizeCanvasSnapshot(snapshot || {});
      assertCanvasSnapshotAssets(project.ownerEmail, durableSnapshot);
      const created = timestamp();
      const expiry = expiresAt ? new Date(expiresAt) : new Date(created.getTime() + canvasTtlMs);
      const id = randomUUID();
      db.prepare(`INSERT INTO canvas_sessions
        (id, owner_email, project_id, base_version_id, status, revision, snapshot, expires_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'active', 1, ?, ?, ?, ?)`).run(
        id, project.ownerEmail, project.id, baseVersionId, JSON.stringify(durableSnapshot), expiry.toISOString(), created.toISOString(), created.toISOString(),
      );
      return api.getCanvasSession({ ownerEmail: project.ownerEmail, sessionId: id });
    },

    getCanvasSession({ ownerEmail, sessionId }) {
      return canvasFromRow(db.prepare('SELECT * FROM canvas_sessions WHERE id = ? AND owner_email = ?').get(sessionId, normalizeOwner(ownerEmail)));
    },

    saveCanvasSession({ ownerEmail, sessionId, expectedRevision, snapshot }) {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new TypeError('expectedRevision must be a positive integer');
      const owner = normalizeOwner(ownerEmail);
      const current = db.prepare('SELECT project_id, snapshot FROM canvas_sessions WHERE id = ? AND owner_email = ?').get(sessionId, owner);
      if (!current) throw codedError('PROJECT_NOT_FOUND', 'canvas session not found');
      const durableSnapshot = normalizeCanvasSnapshot(snapshot || {});
      const existingReferences = new Set(canvasAssetReferences(parse(current.snapshot, {})).map(canvasAssetReferenceKey).filter(Boolean));
      assertCanvasSnapshotAssets(owner, durableSnapshot, { allowExistingReferences: existingReferences });
      const updatedAt = timestamp().toISOString();
      const changed = db.prepare(`UPDATE canvas_sessions
        SET snapshot = ?, revision = revision + 1, status = 'saved', updated_at = ?
        WHERE id = ? AND owner_email = ? AND revision = ? AND status IN ('active', 'saved')`)
        .run(JSON.stringify(durableSnapshot), updatedAt, sessionId, owner, expectedRevision).changes;
      if (changed !== 1) throw codedError('VERSION_CONFLICT', 'canvas session revision changed');
      return api.getCanvasSession({ ownerEmail, sessionId });
    },

    discardCanvasSession({ ownerEmail, sessionId }) {
      const changed = db.prepare(`UPDATE canvas_sessions SET status = 'discarded', updated_at = ?
        WHERE id = ? AND owner_email = ? AND status <> 'discarded'`)
        .run(timestamp().toISOString(), sessionId, normalizeOwner(ownerEmail)).changes;
      return changed === 1 ? api.getCanvasSession({ ownerEmail, sessionId }) : null;
    },

    ensureEcommerceGeneration({
      ownerEmail,
      generationRunId,
      title = '',
      inputSnapshot = {},
      planSnapshot = {},
      quoteId = null,
      holdId = null,
      assets = {},
    }) {
      const owner = normalizeOwner(ownerEmail);
      const runId = String(generationRunId || '').trim();
      if (!owner) throw new TypeError('ownerEmail is required');
      if (!runId) throw new TypeError('generationRunId is required');
      return db.transaction(() => {
        const existingRun = db.prepare('SELECT * FROM project_generation_runs WHERE id = ? AND owner_email = ?').get(runId, owner);
        if (existingRun) {
          const run = runFromRow(existingRun);
          return {
            project: requireProject(owner, run.projectId),
            sourceVersion: requireVersion(run.projectId, run.sourceVersionId),
            run,
          };
        }
        const project = insertProject({ ownerEmail: owner, kind: 'ecommerce', title });
        const sourceVersionId = randomUUID();
        const createdAt = timestamp().toISOString();
        db.prepare(`INSERT INTO project_versions
          (id, project_id, parent_version_id, reason, sequence, input_snapshot, plan_snapshot, canvas_snapshot_id, created_at)
          VALUES (?, ?, NULL, 'generation', 1, ?, ?, NULL, ?)`).run(
          sourceVersionId,
          project.id,
          JSON.stringify(inputSnapshot || {}),
          JSON.stringify(planSnapshot || {}),
          createdAt,
        );
        db.prepare("UPDATE projects SET status = 'running', head_version_id = ?, updated_at = ? WHERE id = ?")
          .run(sourceVersionId, createdAt, project.id);
        db.prepare(`INSERT INTO project_generation_runs
          (id, project_id, source_version_id, owner_email, kind, status, quote_id, hold_id, progress, created_at)
          VALUES (?, ?, ?, ?, 'ecommerce', 'queued', ?, ?, '{}', ?)`).run(
          runId, project.id, sourceVersionId, owner, quoteId, holdId, createdAt,
        );
        const sourceEntries = [];
        for (const [group, values] of Object.entries(assets && typeof assets === 'object' ? assets : {})) {
          if (!['product', 'reference', 'items', 'person', 'scene', 'proof', 'protection'].includes(group)) continue;
          for (const value of Array.isArray(values) ? values : []) {
            const assetId = String(value?.assetId || '').trim();
            const stableUrl = String(value?.url || value?.stableUrl || '').trim();
            if (!assetId || !stableUrl || !isOwnedApplicationAssetUrl(stableUrl)) {
              throw codedError('ECOMMERCE_ASSET_NOT_READY', 'ecommerce source asset is not durably verified');
            }
            const refValue = value?.projectAssetRef;
            let sourceRef = null;
            let canonical = null;
            if (refValue && typeof refValue === 'object' && !Array.isArray(refValue)) {
              const projectId = String(refValue.projectId || '').trim();
              const projectAssetId = String(refValue.projectAssetId || '').trim();
              const expectedContentHash = String(refValue.expectedContentHash || '').trim();
              const role = String(refValue.role || group).trim();
              if (!projectId || !projectAssetId || !expectedContentHash || !role) {
                throw codedError('PROJECT_ASSET_REF_INVALID', 'ecommerce source asset reference is incomplete');
              }
              canonical = api.getProjectAsset({
                ownerEmail: owner,
                projectId,
                projectAssetId,
                purpose: 'reuse',
              });
              if (!canonical || canonical.contentHash !== expectedContentHash
                || canonical.stableUrl !== stableUrl || canonical.assetId !== assetId) {
                throw codedError('PROJECT_ASSET_REF_INVALID', 'ecommerce source asset reference does not match its canonical asset');
              }
              sourceRef = { projectId, projectAssetId, role, expectedContentHash };
            }
            const contentHash = String(value?.contentHash || '').trim() || stableAssetContentHash(stableUrl);
            const mimeType = String(value?.mimeType || '').trim().toLowerCase() || stableAssetMimeType(stableUrl);
            if (!contentHash || !mimeType.startsWith('image/')) {
              throw codedError('ECOMMERCE_ASSET_NOT_READY', 'ecommerce source asset has no authoritative hash or image MIME');
            }
            const key = `${assetId}\u0000${contentHash}\u0000${stableUrl}`;
            if (sourceEntries.some(entry => entry.key === key)) continue;
            sourceEntries.push({
              key,
              assetId: canonical?.assetId || assetId,
              stableUrl: canonical?.stableUrl || stableUrl,
              contentHash: canonical?.contentHash || contentHash,
              mimeType: canonical?.mimeType || mimeType,
              role: String(value?.role || sourceRef?.role || group).trim() || group,
              metadata: sourceRef ? { sourceProjectAssetRef: sourceRef } : {},
            });
          }
        }
        for (const entry of sourceEntries) {
          db.prepare(`INSERT INTO project_assets
            (id, asset_id, owner_email, project_id, version_id, generation_run_id, role,
             content_hash, stable_url, mime_type, metadata_json, retention_class, production_state, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'source', 'draft', ?)`)
            .run(
              `${project.id}:${sourceVersionId}:${entry.assetId}:source`, entry.assetId, owner,
              project.id, sourceVersionId, runId, entry.role, entry.contentHash, entry.stableUrl,
              entry.mimeType, JSON.stringify(entry.metadata), createdAt,
            );
        }
        return {
          project: requireProject(owner, project.id),
          sourceVersion: requireVersion(project.id, sourceVersionId),
          run: runFromRow(db.prepare('SELECT * FROM project_generation_runs WHERE id = ?').get(runId)),
        };
      }).immediate();
    },

    completeEcommerceGeneration({
      ownerEmail,
      generationRunId,
      terminalStatus = 'completed',
      resultInputSnapshot = {},
      resultPlanSnapshot = {},
    }) {
      const owner = normalizeOwner(ownerEmail);
      const runId = String(generationRunId || '').trim();
      const resultStatus = String(terminalStatus || '').trim().toLowerCase();
      if (!['completed', 'needs_review'].includes(resultStatus)) {
        throw new TypeError('terminalStatus must be completed or needs_review');
      }
      return db.transaction(() => {
        const runRow = db.prepare('SELECT * FROM project_generation_runs WHERE id = ? AND owner_email = ?').get(runId, owner);
        if (!runRow) throw codedError('GENERATION_RUN_NOT_FOUND', 'generation run not found');
        const run = runFromRow(runRow);
        const project = requireProject(owner, run.projectId);
        const sourceVersion = requireVersion(project.id, run.sourceVersionId);
        if (ECOMMERCE_TERMINAL_RUN_STATUSES.has(run.status)) {
          if (run.status !== resultStatus) throw terminalConflict(run.status, resultStatus);
          return {
            project,
            sourceVersion,
            resultVersion: run.resultVersionId ? requireVersion(project.id, run.resultVersionId) : null,
            run,
          };
        }
        const resultVersionId = randomUUID();
        const completedAt = timestamp().toISOString();
        const versionReason = resultStatus === 'completed' ? 'accepted_result' : 'manual_save';
        const sequence = db.prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS value FROM project_versions WHERE project_id = ?').get(project.id).value;
        db.prepare(`INSERT INTO project_versions
          (id, project_id, parent_version_id, reason, sequence, input_snapshot, plan_snapshot, canvas_snapshot_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`).run(
          resultVersionId,
          project.id,
          sourceVersion.id,
          versionReason,
          sequence,
          JSON.stringify(resultInputSnapshot || {}),
          JSON.stringify(resultPlanSnapshot || {}),
          completedAt,
        );
        for (const resultAsset of Array.isArray(resultInputSnapshot?.assets) ? resultInputSnapshot.assets : []) {
          if (String(resultAsset?.state || '') !== 'completed') continue;
          const stableUrl = String(resultAsset?.stableUrl || '').trim();
          if (!isOwnedApplicationAssetUrl(stableUrl)) {
            throw codedError('ECOMMERCE_ASSET_NOT_READY', 'ecommerce result asset is not an owned application asset');
          }
          const assetId = stableAssetIdFromUrl(stableUrl);
          if (!assetId) continue;
          const contentHash = stableAssetContentHash(stableUrl)
            || String(resultAsset?.contentHash || '').trim()
            || assetId;
          const mimeType = stableAssetMimeType(stableUrl)
            || String(resultAsset?.mimeType || '').trim().toLowerCase()
            || 'image/png';
          const metadata = normalizeProjectAssetMetadata(resultAsset?.metadata);
          const canonicalMetadata = Object.keys(metadata).length
            ? {
              ...metadata,
              source: 'ecommerce-generation',
              aigc: { generated: true, provenanceVersion: 'aigc-v1' },
              provenance: {
                ...(isRecord(metadata.provenance) ? metadata.provenance : {}),
                type: 'ai-generated',
                route: 'ecommerce',
                generatedAt: completedAt,
              },
            }
            : {};
          const role = cleanProjectAssetValue(canonicalMetadata.role || 'generated', 'role', 80);
          // 统一口径：所有AI生成结果默认不进素材库(visibleInLibrary=false)，需用户显式加入；与XHS/画布生成物一致
          const libraryMetadata = { ...canonicalMetadata, visibleInLibrary: false };
          db.prepare(`INSERT OR IGNORE INTO project_assets
            (id, asset_id, owner_email, project_id, version_id, generation_run_id, role, content_hash, stable_url, mime_type, metadata_json, retention_class, production_state, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(
              `${project.id}:${assetId}`,
              assetId,
              owner,
              project.id,
              resultVersionId,
              runId,
              role,
              contentHash,
              stableUrl,
              mimeType,
              JSON.stringify(libraryMetadata),
              resultStatus === 'completed' ? 'completed' : 'unfinished',
              resultStatus === 'completed' ? 'delivered' : 'candidate',
              completedAt,
            );
          const sourceAssetIds = Array.isArray(canonicalMetadata?.provenance?.sourceAssetIds)
            ? [...new Set(canonicalMetadata.provenance.sourceAssetIds.map(value => String(value || '').trim()).filter(Boolean))]
            : [];
          for (const sourceAssetId of sourceAssetIds) {
            const sourceRow = db.prepare(`SELECT id FROM project_assets
              WHERE project_id = ? AND owner_email = ? AND version_id = ? AND asset_id = ?
                AND deleted_at IS NULL`).get(project.id, owner, sourceVersion.id, sourceAssetId);
            if (!sourceRow) continue;
            db.prepare(`INSERT OR IGNORE INTO project_asset_lineage
              (project_id, source_asset_id, target_asset_id, relation, generation_run_id, created_at)
              VALUES (?, ?, ?, 'generated_from', ?, ?)`).run(
              project.id, sourceRow.id, `${project.id}:${assetId}`, runId, completedAt,
            );
          }
        }
        if (resultStatus === 'completed') {
          db.prepare(`UPDATE projects SET status = 'completed', accepted_version_id = ?, head_version_id = ?, completed_at = ?, updated_at = ?
            WHERE id = ? AND owner_email = ?`).run(
            resultVersionId, resultVersionId, completedAt, completedAt, project.id, owner,
          );
        } else {
          db.prepare(`UPDATE projects SET status = 'needs_review', accepted_version_id = NULL, head_version_id = ?, completed_at = NULL, updated_at = ?
            WHERE id = ? AND owner_email = ?`).run(
            resultVersionId, completedAt, project.id, owner,
          );
        }
        const runUpdate = db.prepare(`UPDATE project_generation_runs SET status = ?, result_version_id = ?, completed_at = ?
          WHERE id = ? AND project_id = ? AND owner_email = ?
            AND status NOT IN ('completed', 'needs_review', 'failed', 'cancelled')`).run(
          resultStatus, resultVersionId, completedAt, runId, project.id, owner,
        );
        if (runUpdate.changes !== 1) throw terminalConflict(run.status, resultStatus);
        db.prepare("UPDATE recovery_checkpoints SET status = 'consumed' WHERE project_id = ? AND owner_email = ? AND status = 'available'")
          .run(project.id, owner);
        return {
          project: requireProject(owner, project.id),
          sourceVersion,
          resultVersion: requireVersion(project.id, resultVersionId),
          run: runFromRow(db.prepare('SELECT * FROM project_generation_runs WHERE id = ?').get(runId)),
        };
      }).immediate();
    },

    terminateEcommerceGeneration({ ownerEmail, generationRunId, terminalStatus }) {
      const owner = normalizeOwner(ownerEmail);
      const runId = String(generationRunId || '').trim();
      const runStatus = String(terminalStatus || '').trim().toLowerCase();
      if (!owner) throw new TypeError('ownerEmail is required');
      if (!runId) throw new TypeError('generationRunId is required');
      if (!['needs_review', 'failed', 'cancelled'].includes(runStatus)) {
        throw new TypeError('terminalStatus must be needs_review, failed, or cancelled');
      }
      return db.transaction(() => {
        const runRow = db.prepare('SELECT * FROM project_generation_runs WHERE id = ? AND owner_email = ?').get(runId, owner);
        if (!runRow) throw codedError('GENERATION_RUN_NOT_FOUND', 'generation run not found');
        const run = runFromRow(runRow);
        const project = requireProject(owner, run.projectId);
        const sourceVersion = requireVersion(project.id, run.sourceVersionId);
        if (ECOMMERCE_TERMINAL_RUN_STATUSES.has(run.status)) {
          if (run.status !== runStatus) throw terminalConflict(run.status, runStatus);
          return {
            project,
            sourceVersion,
            resultVersion: run.resultVersionId ? requireVersion(project.id, run.resultVersionId) : null,
            run,
          };
        }
        const terminalAt = timestamp().toISOString();
        const projectStatus = runStatus === 'needs_review' ? 'needs_review' : 'abandoned';
        db.prepare(`UPDATE projects SET status = ?, accepted_version_id = NULL, completed_at = NULL, updated_at = ?
          WHERE id = ? AND owner_email = ?`).run(projectStatus, terminalAt, project.id, owner);
        const runUpdate = db.prepare(`UPDATE project_generation_runs SET status = ?, result_version_id = NULL, completed_at = ?
          WHERE id = ? AND project_id = ? AND owner_email = ?
            AND status NOT IN ('completed', 'needs_review', 'failed', 'cancelled')`).run(
          runStatus, terminalAt, runId, project.id, owner,
        );
        if (runUpdate.changes !== 1) throw terminalConflict(run.status, runStatus);
        db.prepare("UPDATE recovery_checkpoints SET status = 'consumed' WHERE project_id = ? AND owner_email = ? AND status = 'available'")
          .run(project.id, owner);
        return {
          project: requireProject(owner, project.id),
          sourceVersion,
          resultVersion: null,
          run: runFromRow(db.prepare('SELECT * FROM project_generation_runs WHERE id = ?').get(runId)),
        };
      }).immediate();
    },

    linkGenerationRun({ ownerEmail, projectId, sourceVersionId, generationRunId = randomUUID(), kind, quoteId = null, holdId = null, progress = {} }) {
      const project = requireProject(ownerEmail, projectId);
      requireVersion(project.id, sourceVersionId);
      if (!PROJECT_KINDS.has(kind)) throw new TypeError('unknown generation kind');
      const createdAt = timestamp().toISOString();
      db.transaction(() => {
        db.prepare(`INSERT INTO project_generation_runs
          (id, project_id, source_version_id, owner_email, kind, status, quote_id, hold_id, progress, created_at)
          VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?)`).run(
          generationRunId, project.id, sourceVersionId, project.ownerEmail, kind, quoteId, holdId, JSON.stringify(progress || {}), createdAt,
        );
        db.prepare("UPDATE projects SET status = 'running', updated_at = ? WHERE id = ?").run(createdAt, project.id);
      })();
      return runFromRow(db.prepare('SELECT * FROM project_generation_runs WHERE id = ?').get(generationRunId));
    },

    getGenerationRun({ ownerEmail, generationRunId }) {
      const owner = normalizeOwner(ownerEmail);
      const runId = String(generationRunId || '').trim();
      if (!owner) throw new TypeError('ownerEmail is required');
      if (!runId) throw new TypeError('generationRunId is required');
      return runFromRow(db.prepare('SELECT * FROM project_generation_runs WHERE id = ? AND owner_email = ?').get(runId, owner));
    },

    getGenerationRunIdentity({ generationRunId }) {
      const runId = String(generationRunId || '').trim();
      if (!runId) throw new TypeError('generationRunId is required');
      const run = runFromRow(db.prepare('SELECT * FROM project_generation_runs WHERE id = ?').get(runId));
      return run ? { id: run.id, ownerEmail: run.ownerEmail, kind: run.kind, projectId: run.projectId } : null;
    },

    terminateGeneration(input = {}) {
      return api.terminateEcommerceGeneration(input);
    },

    completeProject({ ownerEmail, projectId, acceptedVersionId, generationRunId = null }) {
      const project = requireProject(ownerEmail, projectId);
      requireVersion(project.id, acceptedVersionId);
      const runId = generationRunId == null ? '' : String(generationRunId).trim();
      if (generationRunId != null && !runId) throw new TypeError('generationRunId is invalid');
      const completedAt = timestamp().toISOString();
      db.transaction(() => {
        const runRow = runId
          ? db.prepare(`SELECT * FROM project_generation_runs
              WHERE id = ? AND project_id = ? AND owner_email = ?`).get(runId, project.id, project.ownerEmail)
          : db.prepare(`SELECT * FROM project_generation_runs
              WHERE project_id = ? AND owner_email = ?
              ORDER BY CASE WHEN result_version_id = ? THEN 0 ELSE 1 END, created_at DESC, id DESC
              LIMIT 1`).get(project.id, project.ownerEmail, acceptedVersionId);
        if (runId && !runRow) throw codedError('GENERATION_RUN_NOT_FOUND', 'generation run not found');
        if (runRow) {
          const run = runFromRow(runRow);
          if (ECOMMERCE_TERMINAL_RUN_STATUSES.has(run.status)) {
            if (run.status === 'completed' && run.resultVersionId === acceptedVersionId) return;
            if (run.status !== 'needs_review' || run.resultVersionId !== acceptedVersionId) {
              throw terminalConflict(run.status, 'completed');
            }
          } else {
            const runUpdate = db.prepare(`UPDATE project_generation_runs
              SET status = 'completed', result_version_id = ?, completed_at = ?
              WHERE id = ? AND project_id = ? AND owner_email = ?
                AND status NOT IN ('completed', 'needs_review', 'failed', 'cancelled')`).run(
              acceptedVersionId, completedAt, run.id, project.id, project.ownerEmail,
            );
            if (runUpdate.changes !== 1) throw terminalConflict(run.status, 'completed');
          }
        }
        db.prepare(`UPDATE projects SET status = 'completed', accepted_version_id = ?, head_version_id = ?, completed_at = ?, updated_at = ?
          WHERE id = ? AND owner_email = ?`).run(acceptedVersionId, acceptedVersionId, completedAt, completedAt, project.id, project.ownerEmail);
        db.prepare(`UPDATE project_assets SET retention_class = 'completed',
          production_state = CASE WHEN production_state = 'archived' THEN 'archived' ELSE 'delivered' END
          WHERE project_id = ? AND owner_email = ? AND version_id = ? AND deleted_at IS NULL
            AND retention_class = 'unfinished'`).run(project.id, project.ownerEmail, acceptedVersionId);
        db.prepare(`UPDATE project_assets SET production_state = 'delivered'
          WHERE project_id = ? AND owner_email = ? AND version_id = ? AND deleted_at IS NULL
            AND retention_class IN ('unfinished', 'completed')
            AND production_state IN ('draft', 'candidate')`).run(project.id, project.ownerEmail, acceptedVersionId);
        db.prepare("UPDATE recovery_checkpoints SET status = 'consumed' WHERE project_id = ? AND owner_email = ? AND status = 'available'")
          .run(project.id, project.ownerEmail);
      }).immediate();
      return api.getProject({ ownerEmail: project.ownerEmail, projectId: project.id });
    },

    reviewProject({ ownerEmail, projectId, reviewedVersionId, generationRunId = null }) {
      const project = requireProject(ownerEmail, projectId);
      requireVersion(project.id, reviewedVersionId);
      const runId = generationRunId == null ? '' : String(generationRunId).trim();
      if (generationRunId != null && !runId) throw new TypeError('generationRunId is invalid');
      const reviewedAt = timestamp().toISOString();
      db.transaction(() => {
        const runRow = runId
          ? db.prepare(`SELECT * FROM project_generation_runs
              WHERE id = ? AND project_id = ? AND owner_email = ?`).get(runId, project.id, project.ownerEmail)
          : null;
        if (runId && !runRow) throw codedError('GENERATION_RUN_NOT_FOUND', 'generation run not found');
        if (runRow) {
          const run = runFromRow(runRow);
          if (ECOMMERCE_TERMINAL_RUN_STATUSES.has(run.status)) {
            if (run.status !== 'needs_review' || run.resultVersionId !== reviewedVersionId) {
              throw terminalConflict(run.status, 'needs_review');
            }
          } else {
            const runUpdate = db.prepare(`UPDATE project_generation_runs
              SET status = 'needs_review', result_version_id = ?, completed_at = ?
              WHERE id = ? AND project_id = ? AND owner_email = ?
                AND status NOT IN ('completed', 'needs_review', 'failed', 'cancelled')`).run(
              reviewedVersionId, reviewedAt, run.id, project.id, project.ownerEmail,
            );
            if (runUpdate.changes !== 1) throw terminalConflict(run.status, 'needs_review');
          }
        }
        db.prepare(`UPDATE projects SET status = 'needs_review', accepted_version_id = NULL,
          head_version_id = ?, completed_at = NULL, updated_at = ?
          WHERE id = ? AND owner_email = ?`).run(reviewedVersionId, reviewedAt, project.id, project.ownerEmail);
        db.prepare(`UPDATE project_assets SET production_state = 'candidate'
          WHERE project_id = ? AND owner_email = ? AND version_id = ? AND deleted_at IS NULL
            AND retention_class IN ('unfinished', 'completed')
            AND production_state IN ('draft', 'candidate')`).run(project.id, project.ownerEmail, reviewedVersionId);
      }).immediate();
      return api.getProject({ ownerEmail: project.ownerEmail, projectId: project.id });
    },

    migrateLegacyWork({ ownerEmail, legacyWorkKey, title = '历史作品', assets = [] }) {
      const owner = normalizeOwner(ownerEmail);
      const key = String(legacyWorkKey || '').trim();
      if (!owner) throw new TypeError('ownerEmail is required');
      if (!key) throw new TypeError('legacyWorkKey is required');
      return db.transaction(() => {
        const existing = projectFromRow(db.prepare(`SELECT * FROM projects
          WHERE owner_email = ? AND legacy_work_key = ? AND deleted_at IS NULL`).get(owner, key));
        if (existing) {
          const version = versionFromRow(db.prepare('SELECT * FROM project_versions WHERE project_id = ? ORDER BY sequence DESC LIMIT 1').get(existing.id));
          return { project: existing, version, migrated: false };
        }
        const project = insertProject({ ownerEmail: owner, kind: 'ecommerce', title });
        db.prepare('UPDATE projects SET legacy_work_key = ? WHERE id = ?').run(key, project.id);
        const version = api.createVersion({
          ownerEmail: owner,
          projectId: project.id,
          reason: 'migration',
          inputSnapshot: { legacyWorkKey: key },
          planSnapshot: { source: 'legacy-work' },
        });
        const createdAt = timestamp().toISOString();
        for (const asset of Array.isArray(assets) ? assets : []) {
          const assetId = String(asset?.assetId || '').trim();
          const stableUrl = String(asset?.stableUrl || '').trim();
          if (!assetId || !stableUrl) continue;
          const contentHash = stableAssetContentHash(stableUrl)
            || String(asset?.contentHash || '').trim()
            || assetId;
          const mimeType = stableAssetMimeType(stableUrl)
            || String(asset?.mimeType || '').trim().toLowerCase()
            || 'image/png';
          db.prepare(`INSERT OR IGNORE INTO project_assets
            (id, asset_id, owner_email, project_id, version_id, role, content_hash, stable_url, mime_type, retention_class, production_state, created_at)
            VALUES (?, ?, ?, ?, ?, 'generated', ?, ?, ?, 'completed', 'delivered', ?)`)
            .run(`${project.id}:${assetId}`, assetId, owner, project.id, version.id, contentHash, stableUrl, mimeType, createdAt);
        }
        const completed = api.completeProject({ ownerEmail: owner, projectId: project.id, acceptedVersionId: version.id });
        return { project: completed, version, migrated: true };
      })();
    },
  };

  return api;
}
