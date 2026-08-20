import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { createGeneratedProjectAssetImporter } from '../server/projects/projectGeneratedAssetImport.mjs';

test('registers a verified generated image as an owner-scoped project asset', async () => {
  const buffer = Buffer.from('generated-canvas-image');
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const assetId = `${hash}.png`;
  const calls = [];
  const importer = createGeneratedProjectAssetImporter({
    projectStore: {
      createProjectAsset(input) {
        calls.push(input);
        return { projectAssetId: 'project-asset-1', ...input };
      },
    },
    readGeneratedAsset: async requestedId => requestedId === assetId
      ? { buffer, contentType: 'image/png' }
      : null,
  });

  const asset = await importer({
    ownerEmail: 'Owner@Example.com',
    projectId: 'project-1',
    versionId: 'version-1',
    assetId,
    stableUrl: `/api/generated-assets/${assetId}`,
    role: 'canvas-output',
    metadata: { source: 'canvas' },
  });

  assert.equal(asset.projectAssetId, 'project-asset-1');
  assert.deepEqual(calls, [{
    ownerEmail: 'owner@example.com',
    projectId: 'project-1',
    versionId: 'version-1',
    assetId,
    role: 'canvas-output',
    stableUrl: `/api/generated-assets/${assetId}`,
    contentHash: hash,
    mimeType: 'image/png',
    retentionClass: 'generated',
    metadata: { source: 'canvas' },
  }]);
});

test('rejects unverified, external, and hash-mismatched generated assets', async () => {
  const buffer = Buffer.from('generated-canvas-image');
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const assetId = `${hash}.webp`;
  const importer = createGeneratedProjectAssetImporter({
    projectStore: { createProjectAsset() { throw new Error('must not persist'); } },
    readGeneratedAsset: async () => ({ buffer, contentType: 'image/png' }),
  });

  await assert.rejects(
    importer({ ownerEmail: 'owner@example.com', projectId: 'project-1', assetId, stableUrl: 'https://cdn.example.com/image.webp' }),
    error => error.code === 'GENERATED_ASSET_NOT_FOUND',
  );
  await assert.rejects(
    importer({ ownerEmail: 'owner@example.com', projectId: 'project-1', assetId: `${'b'.repeat(64)}.png`, stableUrl: `/api/generated-assets/${'b'.repeat(64)}.png` }),
    error => error.code === 'GENERATED_ASSET_NOT_READY',
  );
});
