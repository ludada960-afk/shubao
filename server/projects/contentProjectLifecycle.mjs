import { createHash } from 'node:crypto';

const CONTENT_PROJECT_KINDS = Object.freeze({
  xhs: 'xiaohongshu',
  plog: 'plog',
});
const STABLE_GENERATED_ASSET = /^\/api\/generated-assets\/([a-f0-9]{64})\.(jpg|png|webp)$/i;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function contentKind(mode) {
  const kind = CONTENT_PROJECT_KINDS[clean(mode).toLowerCase()];
  if (!kind) throw new TypeError('content mode is invalid');
  return kind;
}

function assetFromUrl(url, index) {
  const value = clean(url);
  const match = STABLE_GENERATED_ASSET.exec(value);
  if (!match) return null;
  const extension = match[2].toLowerCase();
  return {
    assetId: `${match[1]}.${extension}`,
    stableUrl: value,
    contentHash: match[1],
    mimeType: extension === 'jpg' ? 'image/jpeg' : `image/${extension}`,
    role: index === 0 ? 'generated_cover' : 'generated',
  };
}

function deliveryAssets(delivery = {}) {
  return [delivery.cover_url, ...(Array.isArray(delivery.image_urls) ? delivery.image_urls : [])]
    .map(assetFromUrl)
    .filter(Boolean)
    .filter((asset, index, assets) => assets.findIndex(item => item.stableUrl === asset.stableUrl) === index);
}

function asProjectRef(asset) {
  return {
    projectId: asset.projectId,
    projectAssetId: asset.projectAssetId,
    assetId: asset.assetId,
    contentHash: asset.contentHash,
    stableUrl: asset.stableUrl,
    mimeType: asset.mimeType,
    mediaKind: 'image',
    role: asset.role,
  };
}

export function createContentProjectLifecycle({ projectStore, readGeneratedAsset } = {}) {
  const required = [
    'createProjectIdempotent', 'createVersion', 'linkGenerationRun', 'getGenerationRun', 'getGenerationRunIdentity',
    'createProjectAsset', 'completeProject', 'reviewProject', 'terminateGeneration',
  ];
  if (!projectStore || required.some(name => typeof projectStore[name] !== 'function')
    || typeof readGeneratedAsset !== 'function') {
    throw new TypeError('projectStore content lifecycle methods are required');
  }

  async function begin({ ownerEmail, generationId, mode, title = '' } = {}) {
    const owner = clean(ownerEmail).toLowerCase();
    const runId = clean(generationId);
    const kind = contentKind(mode);
    if (!owner || !runId) throw new TypeError('content owner and generation id are required');
    const existingIdentity = projectStore.getGenerationRunIdentity({ generationRunId: runId });
    if (existingIdentity && existingIdentity.ownerEmail !== owner) {
      throw Object.assign(new Error('content generation belongs to another owner'), { code: 'CONTENT_PROJECT_OWNER_MISMATCH' });
    }
    const existingRun = projectStore.getGenerationRun({ ownerEmail: owner, generationRunId: runId });
    if (existingRun) {
      if (existingRun.kind !== kind) {
        throw Object.assign(new Error('content generation mode conflicts with the existing project'), { code: 'CONTENT_PROJECT_CONFLICT' });
      }
      return {
        projectId: existingRun.projectId,
        projectKind: kind,
        sourceVersionId: existingRun.sourceVersionId,
        generationRunId: existingRun.id,
        ...(existingRun.resultVersionId ? { resultVersionId: existingRun.resultVersionId } : {}),
      };
    }
    const projectResponse = projectStore.createProjectIdempotent({
      ownerEmail: owner,
      idempotencyKey: `content-project:${runId}`,
      kind,
      title: clean(title) || (kind === 'plog' ? 'Plog 生活记录' : '小红书内容'),
    });
    const project = projectResponse.project || projectResponse;
    const sourceVersion = projectStore.createVersion({
      ownerEmail: owner,
      projectId: project.id,
      reason: 'generation',
      inputSnapshot: { generationId: runId, mode: clean(mode).toLowerCase() },
      planSnapshot: { source: 'content-generation' },
      idempotencyKey: `content-source:${runId}`,
    });
    const run = projectStore.linkGenerationRun({
      ownerEmail: owner,
      projectId: project.id,
      sourceVersionId: sourceVersion.id,
      generationRunId: runId,
      kind,
    });
    if (run.projectId !== project.id || run.sourceVersionId !== sourceVersion.id || run.kind !== kind) {
      throw Object.assign(new Error('content project generation run does not match'), { code: 'CONTENT_PROJECT_CONFLICT' });
    }
    return {
      projectId: project.id,
      projectKind: kind,
      sourceVersionId: sourceVersion.id,
      generationRunId: runId,
    };
  }

  async function prepareResult({ ownerEmail, context, delivery } = {}) {
    const owner = clean(ownerEmail).toLowerCase();
    const assets = deliveryAssets(delivery);
    if (!context?.projectId || !context?.sourceVersionId || !assets.length) {
      throw Object.assign(new Error('content result is not projectable'), { code: 'CONTENT_PROJECT_RESULT_INVALID' });
    }
    const verifiedAssets = [];
    for (const asset of assets) {
      const stored = await readGeneratedAsset(asset.assetId);
      const actualHash = stored?.buffer && Buffer.isBuffer(stored.buffer)
        ? createHash('sha256').update(stored.buffer).digest('hex')
        : '';
      const actualMime = clean(stored?.contentType).toLowerCase();
      if (!stored || actualHash !== asset.contentHash
        || !actualMime.startsWith('image/')) {
        throw Object.assign(new Error('content result asset is not durably verified'), { code: 'CONTENT_PROJECT_ASSET_NOT_READY' });
      }
      verifiedAssets.push({ ...asset, mimeType: actualMime });
    }
    const resultVersion = projectStore.createVersion({
      ownerEmail: owner,
      projectId: context.projectId,
      parentVersionId: context.sourceVersionId,
      reason: 'accepted_result',
      inputSnapshot: {
        generationId: context.generationRunId,
        mode: context.projectKind === 'plog' ? 'plog' : 'xhs',
        title: clean(delivery?.title || delivery?.caption),
      },
      planSnapshot: { assetCount: verifiedAssets.length },
      idempotencyKey: `content-result:${context.generationRunId}`,
    });
    const refs = verifiedAssets.map(asset => asProjectRef(projectStore.createProjectAsset({
      ownerEmail: owner,
      projectId: context.projectId,
      versionId: resultVersion.id,
      generationRunId: context.generationRunId,
      assetId: asset.assetId,
      role: asset.role,
      stableUrl: asset.stableUrl,
      contentHash: asset.contentHash,
      mimeType: asset.mimeType,
      retentionClass: 'unfinished',
      metadata: { source: 'content-generation', generationId: context.generationRunId },
    })));
    return {
      ...context,
      resultVersionId: resultVersion.id,
      projectAssetRefs: refs,
    };
  }

  async function complete({ ownerEmail, context } = {}) {
    if (!context?.resultVersionId) throw new TypeError('content result version is required');
    projectStore.completeProject({
      ownerEmail: clean(ownerEmail).toLowerCase(),
      projectId: context.projectId,
      acceptedVersionId: context.resultVersionId,
      generationRunId: context.generationRunId,
    });
    return context;
  }

  async function review({ ownerEmail, context } = {}) {
    if (!context?.resultVersionId) throw new TypeError('content review version is required');
    projectStore.reviewProject({
      ownerEmail: clean(ownerEmail).toLowerCase(),
      projectId: context.projectId,
      reviewedVersionId: context.resultVersionId,
      generationRunId: context.generationRunId,
    });
    return context;
  }

  async function terminate({ ownerEmail, context, status = 'failed' } = {}) {
    if (!context?.projectId || !context?.generationRunId) return null;
    return projectStore.terminateGeneration({
      ownerEmail: clean(ownerEmail).toLowerCase(),
      generationRunId: context.generationRunId,
      terminalStatus: status === 'needs_review' ? 'needs_review' : 'failed',
    });
  }

  async function reconcile({ ownerEmail, generationId, billing = {}, delivery = {} } = {}) {
    const owner = clean(ownerEmail).toLowerCase();
    const run = projectStore.getGenerationRun({ ownerEmail: owner, generationRunId: generationId });
    if (!run) return null;
    const context = {
      projectId: clean(delivery.projectId) || run.projectId,
      projectKind: clean(delivery.projectKind) || run.kind,
      sourceVersionId: clean(delivery.sourceVersionId) || run.sourceVersionId,
      resultVersionId: clean(delivery.resultVersionId) || run.resultVersionId,
      generationRunId: run.id,
    };
    if (billing.status === 'settled' && context.resultVersionId) return complete({ ownerEmail: owner, context });
    if (billing.status === 'needs_review' && context.resultVersionId) return review({ ownerEmail: owner, context });
    if (billing.status === 'released' || billing.status === 'failed') return terminate({ ownerEmail: owner, context });
    return null;
  }

  return { begin, prepareResult, complete, review, terminate, reconcile };
}
