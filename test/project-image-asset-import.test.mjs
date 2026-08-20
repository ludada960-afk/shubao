import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { createImageProjectAssetImporter } from '../server/projects/projectImageAssetImport.mjs';

const OWNER = 'owner@example.com';
const PROJECT = 'project-image-1';
const CONTENT_HASH = crypto.createHash('sha256').update('image-bytes').digest('hex');
const ASSET_ID = `${CONTENT_HASH}.png`;

function createHarness({ record = {}, stored = {} } = {}) {
  const calls = [];
  const projectStore = {
    createProjectAsset(input) {
      calls.push(input);
      return {
        projectAssetId: 'canonical-image-1',
        projectId: input.projectId,
        assetId: input.assetId,
        stableUrl: input.stableUrl,
        contentHash: input.contentHash,
        mimeType: input.mimeType,
        mediaKind: 'image',
        role: input.role,
      };
    },
  };
  const assetUploadService = {
    async getOwnedAsset(input) {
      assert.deepEqual(input, { ownerEmail: OWNER, assetId: ASSET_ID });
      return {
        assetId: ASSET_ID,
        url: `/api/generated-assets/${ASSET_ID}`,
        kind: 'original',
        mimeType: 'image/png',
        width: 1200,
        height: 900,
        byteSize: 4,
        role: 'product',
        ...record,
      };
    },
  };
  const readGeneratedAsset = async assetId => {
    assert.equal(assetId, ASSET_ID);
    return {
      buffer: Buffer.from('image-bytes'),
      contentType: 'image/png',
      ...stored,
    };
  };
  return {
    importer: createImageProjectAssetImporter({ projectStore, assetUploadService, readGeneratedAsset }),
    calls,
  };
}

test('imports an owner-scoped ecommerce original into a canonical image project asset', async () => {
  const { importer, calls } = createHarness();
  const asset = await importer({
    ownerEmail: OWNER,
    projectId: PROJECT,
    imageAssetId: ASSET_ID,
    role: 'product',
    metadata: { displayName: '主商品图' },
  });

  assert.equal(asset.projectAssetId, 'canonical-image-1');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    ownerEmail: OWNER,
    projectId: PROJECT,
    assetId: ASSET_ID,
    role: 'product',
    stableUrl: `/api/generated-assets/${ASSET_ID}`,
    contentHash: CONTENT_HASH,
    mimeType: 'image/png',
    width: 1200,
    height: 900,
    metadata: {
      displayName: '主商品图',
      source: 'ecommerce-upload',
      sourceImageAssetId: ASSET_ID,
      width: 1200,
      height: 900,
      bytes: 4,
    },
    retentionClass: 'source',
  });
});

test('rejects preview, missing, or integrity-mismatched image records before project persistence', async () => {
  for (const record of [
    { kind: 'preview' },
    { url: '/api/generated-assets/not-the-asset.png' },
  ]) {
    const { importer, calls } = createHarness({ record });
    await assert.rejects(
      importer({ ownerEmail: OWNER, projectId: PROJECT, imageAssetId: ASSET_ID }),
      error => ['IMAGE_ASSET_NOT_READY', 'IMAGE_ASSET_NOT_FOUND'].includes(error.code),
    );
    assert.equal(calls.length, 0);
  }
});

test('requires signed owner context and validates bounded metadata', async () => {
  const { importer } = createHarness();
  await assert.rejects(importer({ projectId: PROJECT, imageAssetId: ASSET_ID }), /ownerEmail/);
  await assert.rejects(importer({ ownerEmail: OWNER, imageAssetId: ASSET_ID }), /projectId/);
  await assert.rejects(
    importer({ ownerEmail: OWNER, projectId: PROJECT, imageAssetId: ASSET_ID, metadata: [] }),
    error => error.code === 'IMAGE_ASSET_METADATA_INVALID',
  );
});
