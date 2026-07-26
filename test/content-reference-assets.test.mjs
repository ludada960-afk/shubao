import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveContentReferenceImages } from '../server/contentReferenceAssets.mjs';

const FIRST = `${'a'.repeat(64)}.jpg`;
const SECOND = `${'b'.repeat(64)}.png`;

function services({ missing = false, rejectOwner = false } = {}) {
  const checked = [];
  return {
    checked,
    assetUploadService: {
      async getOwnedAsset({ ownerEmail, assetId }) {
        checked.push({ ownerEmail, assetId });
        if (rejectOwner) throw Object.assign(new Error('无权访问该素材'), { status: 403 });
        return { assetId };
      },
    },
    generatedAssetStore: {
      async read(assetId) {
        if (missing) return null;
        return {
          buffer: Buffer.from(assetId),
          contentType: assetId.endsWith('.png') ? 'image/png' : 'image/jpeg',
        };
      },
    },
  };
}

test('paid content references resolve only owner-scoped original assets', async () => {
  const deps = services();
  const images = await resolveContentReferenceImages({
    ownerEmail: 'creator@example.com',
    referenceAssetIds: [FIRST, SECOND, FIRST],
    assetUploadService: deps.assetUploadService,
    generatedAssetStore: deps.generatedAssetStore,
  });
  assert.deepEqual(deps.checked, [
    { ownerEmail: 'creator@example.com', assetId: FIRST },
    { ownerEmail: 'creator@example.com', assetId: SECOND },
  ]);
  assert.equal(images.length, 2);
  assert.match(images[0], /^data:image\/jpeg;base64,/);
  assert.match(images[1], /^data:image\/png;base64,/);
});

test('content references preserve legacy previews only when no valid owned asset IDs exist', async () => {
  const deps = services();
  assert.deepEqual(await resolveContentReferenceImages({
    ownerEmail: 'creator@example.com',
    referenceAssetIds: ['not-an-asset-id', 'data:image/png;base64,unsafe'],
    legacyImages: ['preview-one', 'preview-two'],
    limit: 1,
    assetUploadService: deps.assetUploadService,
    generatedAssetStore: deps.generatedAssetStore,
  }), ['preview-one']);
  assert.deepEqual(deps.checked, []);
});

test('content references reject ownership and missing stored originals', async () => {
  const denied = services({ rejectOwner: true });
  await assert.rejects(() => resolveContentReferenceImages({
    ownerEmail: 'other@example.com', referenceAssetIds: [FIRST], ...denied,
  }), { message: '无权访问该素材', status: 403 });

  const missing = services({ missing: true });
  await assert.rejects(() => resolveContentReferenceImages({
    ownerEmail: 'creator@example.com', referenceAssetIds: [FIRST], ...missing,
  }), /参考素材已不可用/);
});
