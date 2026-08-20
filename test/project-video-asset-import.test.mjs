import assert from 'node:assert/strict';
import test from 'node:test';
import { createVideoProjectAssetImporter } from '../server/projects/projectVideoAssetImport.mjs';

const OWNER = 'owner@example.com';
const PROJECT = 'project-video-1';
const HASH = 'a'.repeat(64);

function source(overrides = {}) {
  return {
    row: {
      id: 'upload-1.mp4',
      owner_email: OWNER,
      kind: 'video',
      content_type: 'video/mp4',
      bytes: 2048,
      sha256: HASH,
      file_name: 'upload-1.mp4',
      ...overrides,
    },
    filePath: 'F:/runtime/video-asset.mp4',
  };
}

function createHarness({ asset = null } = {}) {
  const calls = [];
  const projectStore = {
    createProjectAsset(input) {
      calls.push(input);
      return asset || {
        projectAssetId: 'canonical-1',
        projectId: input.projectId,
        assetId: input.assetId,
        stableUrl: input.stableUrl,
        contentHash: input.contentHash,
        mimeType: input.mimeType,
        mediaKind: 'video',
        role: input.role,
        metadata: input.metadata,
      };
    },
  };
  const readVideoAsset = async () => source();
  return { importer: createVideoProjectAssetImporter({ projectStore, readVideoAsset }), calls };
}

test('imports an owned verified video asset into a canonical project asset', async () => {
  const { importer, calls } = createHarness();
  const asset = await importer({
    ownerEmail: OWNER,
    projectId: PROJECT,
    videoAssetId: 'upload-1.mp4',
    role: 'reference-video',
    metadata: { displayName: '产品演示' },
  });

  assert.equal(asset.projectAssetId, 'canonical-1');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    ownerEmail: OWNER,
    projectId: PROJECT,
    assetId: 'upload-1.mp4',
    role: 'reference-video',
    stableUrl: '/api/video/assets/upload-1.mp4',
    contentHash: HASH,
    mimeType: 'video/mp4',
    metadata: {
      displayName: '产品演示',
      source: 'video-upload',
      sourceVideoAssetId: 'upload-1.mp4',
      fileName: 'upload-1.mp4',
      bytes: 2048,
    },
    retentionClass: 'source',
  });
});

test('rejects unverified, output, unsupported and missing media assets before project persistence', async () => {
  for (const overrides of [
    { kind: 'output' },
    { sha256: '' },
    { content_type: 'application/octet-stream' },
    { bytes: 0 },
  ]) {
    const calls = [];
    const importer = createVideoProjectAssetImporter({
      projectStore: { createProjectAsset(input) { calls.push(input); } },
      readVideoAsset: async () => source(overrides),
    });
    await assert.rejects(
      importer({ ownerEmail: OWNER, projectId: PROJECT, videoAssetId: 'upload-1.mp4' }),
      error => ['VIDEO_ASSET_NOT_FOUND', 'VIDEO_ASSET_NOT_READY'].includes(error.code),
    );
    assert.equal(calls.length, 0);
  }
});

test('requires signed-owner context and a bounded role without trusting source ownership fields', async () => {
  const { importer } = createHarness();
  await assert.rejects(importer({ projectId: PROJECT, videoAssetId: 'upload-1.mp4' }), /ownerEmail/);
  await assert.rejects(importer({ ownerEmail: OWNER, videoAssetId: 'upload-1.mp4' }), /projectId/);
  await assert.rejects(importer({ ownerEmail: OWNER, projectId: PROJECT, videoAssetId: 'upload-1.mp4', role: '' }), /role/);
});
