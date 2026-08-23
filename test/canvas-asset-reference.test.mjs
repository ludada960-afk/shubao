import assert from 'node:assert/strict';
import test from 'node:test';

import {
  attachCanvasProjectAssetRef,
  canvasProjectAssetRefKey,
  collectCanvasProjectAssetRefs,
  normalizeCanvasProjectAssetRef,
} from '../src/pages/EcCanvas/canvasAssetReferenceModel.js';
import {
  buildCanvasImportResult,
  collectCanvasWorkImages,
} from '../src/pages/EcCanvas/canvasWorkModel.js';
import { createFreshCanvasSession } from '../src/pages/EcCanvas/canvasSessionModel.js';
import { createUploadedImageNodes } from '../src/pages/EcCanvas/canvasStudioModel.js';

const reference = {
  projectId: 'project-1',
  projectAssetId: 'project-asset-1',
  assetId: 'generated-1.png',
  contentHash: 'hash-1',
  stableUrl: '/api/generated-assets/generated-1.png',
  mimeType: 'image/png',
  mediaKind: 'image',
  role: 'product',
};

test('canvas canonical asset refs require project identity and content hash', () => {
  assert.deepEqual(normalizeCanvasProjectAssetRef(reference), {
    ...reference,
    width: null,
    height: null,
  });
  assert.equal(normalizeCanvasProjectAssetRef({ ...reference, contentHash: '' }), null);
  assert.equal(normalizeCanvasProjectAssetRef({ assetId: 'legacy', url: '/legacy.png' }), null);
  assert.equal(canvasProjectAssetRefKey(reference), 'project-1:project-asset-1:hash-1');
});

test('image and video node factories preserve canonical refs without exposing owner data', () => {
  const image = createUploadedImageNodes({ assets: [{ ...reference, name: '产品图' }] })[0];
  assert.equal(image.projectAssetId, reference.projectAssetId);
  assert.deepEqual(image.assetRef, normalizeCanvasProjectAssetRef(reference));
  assert.equal('ownerEmail' in image.assetRef, false);
});

test('Canvas nodes preserve only safe project asset metadata for delivery provenance', () => {
  const image = createUploadedImageNodes({ assets: [{
    ...reference,
    name: '商品识别图',
    metadata: {
      displayName: '商品识别图',
      role: 'main_text',
      width: 1200,
      height: 1200,
      aigc: { generated: true, provenanceVersion: 'aigc-v1', provider: 'private-provider' },
      provenance: {
        route: 'ecommerce',
        planItemId: 'plan-main',
        generatedAt: '2026-08-21T08:00:00.000Z',
        sourceAssetIds: ['source-1'],
        prompt: 'private prompt must not enter Canvas',
      },
      prompt: 'private prompt',
      providerJobId: 'private-job',
      ownerEmail: 'owner@example.com',
    },
  }] })[0];

  assert.deepEqual(image.metadata, {
    displayName: '商品识别图',
    role: 'main_text',
    width: 1200,
    height: 1200,
    aigc: { generated: true, provenanceVersion: 'aigc-v1' },
    provenance: {
      route: 'ecommerce',
      planItemId: 'plan-main',
      generatedAt: '2026-08-21T08:00:00.000Z',
      sourceAssetIds: ['source-1'],
    },
  });
  assert.equal(image.metadata.prompt, undefined);
  assert.equal(image.metadata.ownerEmail, undefined);
});

test('work import and Canvas output persistence retain one deduplicated canonical ref list', () => {
  const imported = buildCanvasImportResult({
    projectId: reference.projectId,
    images: [{ ...reference, key: 'main' }],
    productAssets: [{ ...reference, key: 'product' }],
  });
  assert.deepEqual(imported.projectAssetRefs, [normalizeCanvasProjectAssetRef(reference)]);

  const session = createFreshCanvasSession({
    work: { id: 'work-1', projectId: reference.projectId },
    productAssets: [{ ...reference, name: '产品图' }],
    outputs: [{ ...reference, name: '生成图' }],
  });
  assert.ok(session.nodes.some(node => node.projectAssetId === reference.projectAssetId));

  const saved = collectCanvasWorkImages({
    nodes: [{
      id: 'output-1',
      kind: 'output',
      status: 'ready',
      url: reference.stableUrl,
      assetId: reference.assetId,
      assetRef: reference,
      displayLabel: '生成图',
    }],
  });
  assert.equal(saved[0].projectAssetId, reference.projectAssetId);
  assert.deepEqual(collectCanvasProjectAssetRefs({ work: { projectId: reference.projectId, imageRecords: saved } }), [normalizeCanvasProjectAssetRef(reference)]);
});

test('attaching an invalid or legacy asset leaves the display node unchanged', () => {
  const node = { id: 'legacy-node', url: '/legacy.png', assetId: 'legacy' };
  assert.deepEqual(attachCanvasProjectAssetRef(node, node), node);
});
