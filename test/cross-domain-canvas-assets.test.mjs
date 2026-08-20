import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildCanvasAssetRef,
  canvasProjectAssetRefKey,
} from '../src/pages/EcCanvas/canvasAssetReferenceModel.js';
import {
  createCanvasSnapshot,
  importProjectAssetToCanvas,
} from '../src/pages/EcCanvas/canvasSessionModel.js';

const projectAsset = {
  projectId: 'project-1',
  projectAssetId: 'asset-1',
  assetId: 'stable-image.webp',
  stableUrl: '/api/generated-assets/stable-image.webp',
  contentHash: 'hash-image-1',
  mimeType: 'image/webp',
  role: 'product',
  name: '商品主图',
  width: 1200,
  height: 1200,
};

test('builds a display-safe Canvas asset ref without client authority fields', () => {
  const ref = buildCanvasAssetRef({
    ...projectAsset,
    ownerEmail: 'must-not-cross-the-boundary@example.com',
    retentionState: 'active',
  });

  assert.deepEqual(ref, {
    projectId: 'project-1',
    projectAssetId: 'asset-1',
    assetId: 'stable-image.webp',
    contentHash: 'hash-image-1',
    stableUrl: '/api/generated-assets/stable-image.webp',
    mimeType: 'image/webp',
    mediaKind: 'image',
    role: 'product',
    width: 1200,
    height: 1200,
  });
  assert.equal('ownerEmail' in ref, false);
  assert.equal(canvasProjectAssetRefKey(ref), 'project-1:asset-1:hash-image-1');
});

test('Canvas derives media kind from MIME before any display hint', () => {
  const ref = buildCanvasAssetRef({
    ...projectAsset,
    mediaKind: 'audio',
  });
  assert.equal(ref.mediaKind, 'image');
});

test('imports image, video and audio project assets as canonical Canvas source nodes', () => {
  const base = createCanvasSnapshot({
    nodes: [{ id: 'existing', kind: 'text', status: 'ready', x: 0, y: 0 }],
    connections: [],
    viewport: { x: 12, y: 18, scale: 0.8 },
  });
  const assets = [
    projectAsset,
    { ...projectAsset, projectAssetId: 'asset-2', assetId: 'clip.mp4', stableUrl: '/api/video/assets/clip.mp4', contentHash: 'hash-video-2', mimeType: 'video/mp4', mediaKind: 'video', role: 'reference-video', name: '参考视频' },
    { ...projectAsset, projectAssetId: 'asset-3', assetId: 'voice.mp3', stableUrl: '/api/video/assets/voice.mp3', contentHash: 'hash-audio-3', mimeType: 'audio/mpeg', mediaKind: 'audio', role: 'voice', name: '旁白音频' },
  ];

  let session = base;
  for (const asset of assets) {
    const result = importProjectAssetToCanvas({ asset, session });
    assert.equal(result.added, true);
    session = result.session;
  }

  assert.deepEqual(session.viewport, base.viewport);
  assert.equal(session.nodes.filter(node => node.projectAssetId).length, 3);
  assert.deepEqual(
    session.nodes.filter(node => node.projectAssetId).map(node => node.kind),
    ['image', 'video', 'audio'],
  );
  assert.equal(session.nodes.find(node => node.projectAssetId === 'asset-2').assetRef.mediaKind, 'video');
  assert.equal(session.nodes.find(node => node.projectAssetId === 'asset-3').assetRef.mediaKind, 'audio');
});

test('uses transient playback URLs for media nodes while keeping stable asset identity in the snapshot', () => {
  const asset = {
    ...projectAsset,
    projectAssetId: 'asset-playback',
    assetId: 'clip.mp4',
    stableUrl: '/api/video/assets/clip.mp4',
    playbackUrl: '/api/video/media/clip.mp4?expires=123&signature=transient',
    contentHash: 'hash-playback',
    mimeType: 'video/mp4',
    mediaKind: 'video',
  };
  const imported = importProjectAssetToCanvas({ asset, session: createCanvasSnapshot() });
  assert.equal(imported.node.url, asset.playbackUrl);
  assert.equal(imported.node.assetRef.stableUrl, asset.stableUrl);
  const snapshot = createCanvasSnapshot(imported.session);
  assert.equal(snapshot.nodes[0].url, asset.stableUrl);
  assert.equal('playbackUrl' in snapshot.nodes[0], false);
});

test('re-importing the same canonical asset is idempotent and preserves the session', () => {
  const first = importProjectAssetToCanvas({ asset: projectAsset, session: createCanvasSnapshot() });
  const second = importProjectAssetToCanvas({ asset: projectAsset, session: first.session });

  assert.equal(first.added, true);
  assert.equal(second.added, false);
  assert.equal(second.reason, 'already-imported');
  assert.equal(second.nodeId, first.node.id);
  assert.deepEqual(second.session, first.session);
});

test('legacy URL-only assets are rejected without mutating the Canvas session', () => {
  const session = createCanvasSnapshot({ nodes: [{ id: 'existing', kind: 'text' }] });
  const result = importProjectAssetToCanvas({
    asset: { id: 'legacy', stableUrl: '/legacy.png', mimeType: 'image/png' },
    session,
  });

  assert.equal(result.added, false);
  assert.equal(result.reason, 'invalid-project-asset');
  assert.deepEqual(result.session, session);
});

test('Canvas Works entry exposes the owner-scoped project asset library without generation hooks', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const studio = await readFile(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  assert.match(source, /listProjectAssetLibrary\(/);
  assert.match(source, /项目素材类型/);
  assert.match(source, /handleImportProjectAsset/);
  assert.match(source, /importProjectAssetToCanvas/);
  assert.match(source, /项目素材/);
  assert.match(source, /不会产生生成或扣费/);
  assert.match(source, /node\.kind === 'audio'/);
  assert.match(source, /mediaKind === 'video' \? <video src=\{asset\.playbackUrl \|\| asset\.stableUrl\}/);
  assert.match(source, /mediaKind === 'audio' \? <audio[\s\S]*?src=\{asset\.playbackUrl \|\| asset\.stableUrl\}/);
  assert.match(source, /CanvasAudioNode/);
  assert.match(studio, /<audio/);
});

test('Canvas opening a cached video Work remints playback even without a local draft', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /const mediaRefs = canvasMediaAssetRefs\(newNodes\)/);
  assert.match(source, /getProjectAsset\(ref\.projectId, ref\.projectAssetId\)/);
  assert.doesNotMatch(source, /if \(draft && initialSnapshot\?\.nodes\?\.length\) \{/);
});

test('Canvas remote-session recovery remints playback URLs for restored media nodes', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /const remoteSnapshot = restoreCanvasSnapshot\(remoteSession\.snapshot\);[\s\S]*?const remoteMediaRefs = canvasMediaAssetRefs\(remoteSnapshot\.nodes\);/);
  assert.match(source, /getProjectAsset\(ref\.projectId, ref\.projectAssetId\)[\s\S]*?restoreCanvasMediaPlayback\(previous, resolvedAssets\)/);
  assert.doesNotMatch(source, /const resolvedAssets = assets\.filter\(Boolean\);\s*if \(!resolvedAssets\.length\) return;/);
});

test('explicit Canvas restore remints playback URLs before replacing the active nodes', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /const restoredMediaRefs = canvasMediaAssetRefs\(snapshot\.nodes\);/);
  assert.match(source, /getProjectAsset\(ref\.projectId, ref\.projectAssetId\)[\s\S]*?restoreCanvasMediaPlayback\(snapshot\.nodes, resolvedAssets\)/);
  assert.doesNotMatch(source, /if \(resolvedAssets\.length\) \{\s*setNodes\(restoreCanvasMediaPlayback/);
});
