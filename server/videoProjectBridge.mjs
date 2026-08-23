import { assertCanonicalProjectAssetRef } from './projects/projectAssetContract.mjs';

function clean(value, max = 7000) {
  return String(value ?? '').trim().slice(0, max);
}

function parse(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function referenceEntries(references) {
  const values = [];
  if (references.firstImage) values.push({ assetId: references.firstImage, role: 'first_frame' });
  if (references.lastImage) values.push({ assetId: references.lastImage, role: 'last_frame' });
  for (const assetId of references.images || []) values.push({ assetId, role: 'reference_image' });
  for (const assetId of references.videos || []) values.push({ assetId, role: 'reference_video' });
  for (const assetId of references.audios || []) values.push({ assetId, role: 'reference_audio' });
  const seen = new Set();
  return values.filter(entry => {
    if (!entry.assetId || seen.has(entry.assetId)) return false;
    seen.add(entry.assetId);
    return true;
  });
}

function tableExists(db, name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

export function auditLegacyVideoAssets(db, { now = () => new Date(), sampleLimit = 20 } = {}) {
  if (!db || !tableExists(db, 'video_assets')) throw new TypeError('video_assets table is required');
  const generatedAt = now();
  const rows = db.prepare('SELECT * FROM video_assets').all();
  const byId = new Set(rows.map(row => row.id));
  const referencedIds = new Set();
  const missingReferenceIds = new Set();
  if (tableExists(db, 'video_jobs')) {
    for (const job of db.prepare('SELECT refs_json, result_asset_id FROM video_jobs').all()) {
      const references = parse(job.refs_json, {});
      for (const entry of referenceEntries(references)) referencedIds.add(entry.assetId);
      if (job.result_asset_id) referencedIds.add(job.result_asset_id);
    }
  }
  for (const id of referencedIds) if (!byId.has(id)) missingReferenceIds.add(id);
  const unreferencedIds = rows.filter(row => !referencedIds.has(row.id)).map(row => row.id);
  const hashes = new Map();
  for (const row of rows) {
    if (!row.sha256) continue;
    const ids = hashes.get(row.sha256) || [];
    ids.push(row.id);
    hashes.set(row.sha256, ids);
  }
  const duplicateGroups = [...hashes.entries()].filter(([, ids]) => ids.length > 1);
  const supportedKinds = new Set(['image', 'video', 'audio', 'output']);
  const supportedTypes = /^(image|video|audio)\//;
  const missingOwnerIds = rows.filter(row => !clean(row.owner_email, 320)).map(row => row.id);
  const missingChecksumIds = rows.filter(row => !clean(row.sha256, 100)).map(row => row.id);
  const unsupportedIds = rows
    .filter(row => !supportedKinds.has(row.kind) || !supportedTypes.test(row.content_type))
    .map(row => row.id);
  const limit = Math.max(1, Math.min(100, Number(sampleLimit) || 20));
  return {
    mode: 'dry-run',
    generatedAt: (generatedAt instanceof Date ? generatedAt : new Date(generatedAt)).toISOString(),
    total: rows.length,
    referencedAssets: [...referencedIds].filter(id => byId.has(id)).length,
    unreferencedAssets: unreferencedIds.length,
    missingAssetReferences: missingReferenceIds.size,
    missingOwners: missingOwnerIds.length,
    missingChecksums: missingChecksumIds.length,
    unsupportedRows: unsupportedIds.length,
    duplicateChecksums: duplicateGroups.length,
    samples: {
      unreferencedAssetIds: unreferencedIds.slice(0, limit),
      missingReferenceIds: [...missingReferenceIds].slice(0, limit),
      missingOwnerIds: missingOwnerIds.slice(0, limit),
      missingChecksumIds: missingChecksumIds.slice(0, limit),
      unsupportedIds: unsupportedIds.slice(0, limit),
      duplicateChecksumGroups: duplicateGroups.slice(0, limit).map(([sha256, ids]) => ({ sha256, assetIds: ids.slice(0, limit) })),
    },
  };
}

export function createVideoProjectBridge({ db, projectStore, now = () => new Date() } = {}) {
  if (!db || !projectStore) throw new TypeError('video project bridge dependencies are required');

  function resolveAssets(ownerEmail, references) {
    const entries = referenceEntries(references);
    if (!entries.length) return [];
    const rows = db.prepare(`SELECT * FROM video_assets WHERE owner_email = ? AND id IN (${entries.map(() => '?').join(',')})`)
      .all(ownerEmail, ...entries.map(entry => entry.assetId));
    const byId = new Map(rows.map(row => [row.id, row]));
    return entries.flatMap(entry => {
      const row = byId.get(entry.assetId);
      return row ? [{
        ...entry,
        kind: row.kind,
        contentHash: row.sha256 || '',
        stableUrl: `/api/video/assets/${row.id}`,
        mimeType: row.content_type,
        bytes: Number(row.bytes || 0),
      }] : [];
    });
  }

  function snapshots(job) {
    const references = parse(job.refs_json, {});
    const assets = resolveAssets(job.owner_email, references);
    return {
      assets,
      inputSnapshot: {
        prompt: clean(job.prompt),
        negativePrompt: clean(job.negative_prompt, 1200),
        mode: clean(job.mode, 40),
        references: assets.map(({ assetId, role, kind, contentHash, stableUrl, mimeType, bytes }) => ({
          assetId, role, kind, contentHash, stableUrl, mimeType, bytes,
        })),
      },
      planSnapshot: {
        model: {
          productId: clean(job.product_id, 80),
          providerRoute: clean(job.provider_route, 120),
          catalogVersion: clean(job.catalog_version, 120),
        },
        format: {
          duration: Number(job.duration || 0),
          aspectRatio: clean(job.aspect_ratio, 20),
          resolution: clean(job.resolution, 20),
          generateAudio: Number(job.generate_audio) === 1,
          seed: Number(job.seed || 0),
        },
      },
    };
  }

  function ensureDraft(job, { projectId = '' } = {}) {
    const { assets, inputSnapshot, planSnapshot } = snapshots(job);
    return projectStore.ensureVideoGeneration({
      ownerEmail: job.owner_email,
      generationRunId: job.id,
      projectId: clean(projectId, 140) || null,
      title: clean(job.prompt, 42) || 'AI 视频项目',
      inputSnapshot,
      planSnapshot,
      quoteId: clean(job.quote_id, 5000) || null,
      holdId: clean(job.hold_id, 200) || null,
      assets,
    });
  }

  return {
    ensureDraft,

    validateTarget({ ownerEmail, projectId }) {
      const targetId = clean(projectId, 140);
      if (!targetId) return null;
      const project = projectStore.getProject({ ownerEmail, projectId: targetId });
      if (!project) throw Object.assign(new Error('project not found'), { code: 'PROJECT_NOT_FOUND' });
      if (project.kind !== 'video') throw Object.assign(new Error('target project must be a video project'), { code: 'VIDEO_PROJECT_KIND_INVALID' });
      if (project.status === 'completed') throw Object.assign(new Error('completed video project cannot accept another generation'), { code: 'VIDEO_PROJECT_COMPLETED' });
      return project;
    },

    projectDelivery(job) {
      const draft = ensureDraft(job);
      const outputId = clean(job.result_asset_id, 140);
      const output = db.prepare('SELECT * FROM video_assets WHERE id = ? AND owner_email = ?').get(outputId, job.owner_email);
      if (!output || output.kind !== 'output') throw new Error('verified video output asset is missing');
      const { assets, inputSnapshot, planSnapshot } = snapshots(job);
      return projectStore.completeVideoGeneration({
        ownerEmail: job.owner_email,
        generationRunId: job.id,
        resultInputSnapshot: {
          ...inputSnapshot,
          delivery: {
            assetId: output.id,
            stableUrl: `/api/video/assets/${output.id}`,
            contentHash: output.sha256 || '',
            mimeType: output.content_type,
            bytes: Number(output.bytes || 0),
          },
        },
        resultPlanSnapshot: {
          ...planSnapshot,
          attempt: {
            id: clean(job.current_attempt_id, 140),
            providerTaskId: clean(job.provider_task_id, 200),
          },
        },
        outputAsset: {
          assetId: output.id,
          stableUrl: `/api/video/assets/${output.id}`,
          contentHash: output.sha256 || '',
          mimeType: output.content_type,
        },
        sourceAssetIds: assets.map(asset => asset.assetId),
      });
    },

    deliveryProjectAssetRef(job) {
      const projectId = clean(job?.project_id, 140);
      const generationRunId = clean(job?.id, 140);
      if (!projectId || !generationRunId) return null;
      const asset = projectStore.listProjectAssets({
        ownerEmail: job.owner_email,
        projectId,
      }).find(candidate => candidate.generationRunId === generationRunId && candidate.role === 'generated_video');
      if (!asset) return null;
      const ref = assertCanonicalProjectAssetRef({
        projectId: asset.projectId,
        projectAssetId: asset.projectAssetId,
        role: asset.role,
        expectedContentHash: asset.contentHash,
      }, asset);
      return {
        ...ref,
        assetId: asset.assetId,
        contentHash: asset.contentHash,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        metadata: asset.metadata,
        durationMs: Number.isSafeInteger(asset.metadata?.durationMs) ? asset.metadata.durationMs : null,
        generationRunId: asset.generationRunId,
        retentionClass: asset.retentionClass,
      };
    },

    auditLegacyAssets() {
      return auditLegacyVideoAssets(db, { now });
    },
  };
}
