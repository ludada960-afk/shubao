import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertCanonicalProjectAssetRef,
  mediaKindFromMime,
  normalizeProjectAssetRef,
} from '../server/projects/projectAssetContract.mjs';
import {
  normalizeClientProjectAssetRef,
  projectAssetReferenceKey,
} from '../src/services/projectAssetContract.js';

test('derives media kind from MIME without trusting a client supplied kind', () => {
  assert.equal(mediaKindFromMime('image/webp'), 'image');
  assert.equal(mediaKindFromMime('video/mp4'), 'video');
  assert.equal(mediaKindFromMime('audio/mpeg'), 'audio');
  assert.equal(mediaKindFromMime('application/octet-stream'), 'document');
});

test('canonical project asset references require project, asset, role and expected hash', () => {
  assert.deepEqual(normalizeProjectAssetRef({
    projectId: 'p1', projectAssetId: 'a1', role: 'reference', expectedContentHash: 'h1',
  }), {
    projectId: 'p1', projectAssetId: 'a1', role: 'reference', expectedContentHash: 'h1',
  });
  assert.throws(() => normalizeProjectAssetRef({ projectId: 'p1', projectAssetId: 'a1', role: 'reference' }), /expectedContentHash/);
  assert.throws(() => normalizeProjectAssetRef({ projectId: 'p1\nasset', projectAssetId: 'a1', role: 'reference', expectedContentHash: 'h1' }), /control characters/);
});

test('canonical references are matched to the owner-scoped project asset row', () => {
  const ref = assertCanonicalProjectAssetRef({
    projectId: 'p1', projectAssetId: 'a1', role: 'reference', expectedContentHash: 'h1',
  }, {
    id: 'a1', project_id: 'p1', content_hash: 'h1', mime_type: 'video/mp4', stable_url: '/api/video/assets/a1',
  });
  assert.equal(ref.mediaKind, 'video');
  assert.equal(ref.stableUrl, '/api/video/assets/a1');
  assert.throws(() => assertCanonicalProjectAssetRef({
    projectId: 'p2', projectAssetId: 'a1', role: 'reference', expectedContentHash: 'h1',
  }, { id: 'a1', project_id: 'p1', content_hash: 'h1', mime_type: 'video/mp4' }), /does not belong/);
});

test('client references stay display-safe and use a stable identity key', () => {
  const ref = normalizeClientProjectAssetRef({
    projectId: 'p1', projectAssetId: 'a1', role: 'product', contentHash: 'hash-1',
    mimeType: 'image/webp', stableUrl: '/api/generated-assets/a1.webp', mediaKind: 'image',
    ownerEmail: 'must-not-become-authority@example.com',
  });
  assert.equal(ref.ownerEmail, undefined);
  assert.equal(projectAssetReferenceKey(ref), 'p1:a1:hash-1');
});
