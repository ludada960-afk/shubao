import { createHash } from 'node:crypto';

import { sanitizeSnapshot } from './jobStore.mjs';
import { ecommerceDeliveryMetadataForPlan } from './deliveryMetadata.mjs';

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sourceAssetIdsFromPlan(plan = {}) {
  const ids = [
    plan.productAssetIds,
    plan.styleReferenceIds,
    plan.proofAssetIds,
    plan.protectionAssetIds,
  ].flatMap(value => Array.isArray(value) ? value : []);
  return [...new Set(ids.map(cleanString).filter(Boolean))].slice(0, 64);
}

function resultAssetMetadata(asset = {}) {
  const requestSnapshot = isRecord(asset.requestSnapshot) ? asset.requestSnapshot : {};
  const plan = isRecord(requestSnapshot.assetPlanItem) ? requestSnapshot.assetPlanItem : null;
  if (!plan) return {};
  const delivery = ecommerceDeliveryMetadataForPlan(plan);
  const sourceAssetIds = sourceAssetIdsFromPlan(plan);
  return {
    ...delivery,
    source: 'ecommerce-generation',
    aigc: { generated: true, provenanceVersion: 'aigc-v1' },
    provenance: {
      type: 'ai-generated',
      route: 'ecommerce',
      planItemId: cleanString(plan.id),
      ...(sourceAssetIds.length
        ? { sourceAssetIds }
        : {}),
    },
  };
}

function resultAssetSnapshot(asset = {}) {
  const assetId = cleanString(asset.assetId);
  const state = cleanString(asset.state);
  if (!assetId || !state) return null;
  const snapshot = { assetId, state };
  const stableUrl = cleanString(asset.stableUrl);
  if (state === 'completed' && stableUrl) snapshot.stableUrl = stableUrl;
  const metadata = resultAssetMetadata(asset);
  if (Object.keys(metadata).length) snapshot.metadata = metadata;
  return snapshot;
}

export function assetPlanFingerprint(assetPlan) {
  return createHash('sha256').update(JSON.stringify(assetPlan || [])).digest('hex');
}

export function createEcommerceProjectLifecycle({ projectStore } = {}) {
  if (!projectStore || typeof projectStore.ensureEcommerceGeneration !== 'function'
    || typeof projectStore.completeEcommerceGeneration !== 'function'
    || typeof projectStore.terminateEcommerceGeneration !== 'function') {
    throw new TypeError('projectStore ecommerce lifecycle methods are required');
  }
  return {
    async begin({ job = {}, assetPlan = [], holdId = '' } = {}) {
      const fingerprint = assetPlanFingerprint(assetPlan);
      const linked = projectStore.ensureEcommerceGeneration({
        ownerEmail: job.ownerEmail,
        generationRunId: job.id,
        title: cleanString(job.payload?.product_name) || '商品套图',
        inputSnapshot: sanitizeSnapshot({ payload: job.payload || {} }),
        planSnapshot: sanitizeSnapshot({ fingerprint, items: assetPlan }),
        quoteId: cleanString(job.payload?.billing_quote_id) || null,
        holdId: cleanString(holdId) || null,
        assets: job.payload?.assets || {},
      });
      return {
        projectId: linked.project.id,
        sourceVersionId: linked.sourceVersion.id,
        generationRunId: linked.run.id,
        assetPlanFingerprint: fingerprint,
      };
    },

    async complete({ job = {}, output = {}, assets = [], status = 'completed' } = {}) {
      const fingerprint = cleanString(job.progress?.assetPlanFingerprint);
      const resultAssets = (Array.isArray(assets) ? assets : [])
        .map(resultAssetSnapshot)
        .filter(Boolean);
      const completed = projectStore.completeEcommerceGeneration({
        ownerEmail: job.ownerEmail,
        generationRunId: cleanString(job.progress?.generationRunId) || job.id,
        terminalStatus: status,
        resultInputSnapshot: sanitizeSnapshot({ output, assets: resultAssets }),
        resultPlanSnapshot: sanitizeSnapshot({ fingerprint }),
      });
      return {
        projectId: completed.project.id,
        sourceVersionId: completed.sourceVersion.id,
        resultVersionId: completed.resultVersion.id,
        generationRunId: completed.run.id,
        assetPlanFingerprint: fingerprint,
      };
    },

    async terminate({ job = {}, status = 'failed' } = {}) {
      const fingerprint = cleanString(job.progress?.assetPlanFingerprint);
      const terminated = projectStore.terminateEcommerceGeneration({
        ownerEmail: job.ownerEmail,
        generationRunId: cleanString(job.progress?.generationRunId) || job.id,
        terminalStatus: status,
      });
      return {
        projectId: terminated.project.id,
        sourceVersionId: terminated.sourceVersion.id,
        generationRunId: terminated.run.id,
        assetPlanFingerprint: fingerprint,
      };
    },
  };
}
