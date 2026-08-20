import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canvasMediaAssetRefs,
  createCanvasSnapshot,
  createFreshCanvasSession,
  restoreCanvasMediaPlayback,
  restoreCanvasSnapshot,
} from '../src/pages/EcCanvas/canvasSessionModel.js';

const workInput = {
  work: { id: 'work-1', product_name: '保温杯', platform: '天猫' },
  productAssets: [
    { assetId: 'product-front', url: '/front.png', name: '产品正面' },
    { assetId: 'product-side', url: '/side.png', name: '产品侧面' },
  ],
  outputs: [
    { assetId: 'main-1', url: '/main.png', name: '首屏主图', ratio: '1:1' },
    { assetId: 'detail-1', url: '/detail.png', name: '材质详情', ratio: '3:4' },
  ],
};

test('work import creates clean product image nodes and parallel output edges', () => {
  const session = createFreshCanvasSession(workInput);
  const sourceImages = session.nodes.filter(node => node.kind === 'image' && node.isProductSource);
  assert.equal(sourceImages.length, 2);
  assert.ok(sourceImages.every(node => node.showMeta === false));
  assert.equal(session.nodes.filter(node => node.kind === 'output').length, 2);
  assert.ok(session.connections.every(edge => edge.from === sourceImages[0].id));
  assert.equal(session.connections.some(edge => edge.from.startsWith('output-')), false);
});

test('fresh imports never reuse prior Canvas nodes or connections', () => {
  const first = createFreshCanvasSession(workInput);
  first.nodes.push({ id: 'stale-node' });
  first.connections.push({ id: 'stale-edge' });
  const second = createFreshCanvasSession(workInput);
  assert.equal(second.nodes.some(node => node.id === 'stale-node'), false);
  assert.equal(second.connections.some(edge => edge.id === 'stale-edge'), false);
});

test('product references stay individually draggable while outputs keep commercial names', () => {
  const session = createFreshCanvasSession(workInput);
  const sources = session.nodes.filter(node => node.isProductSource);
  assert.deepEqual(sources.map(node => node.assetId), ['product-front', 'product-side']);
  assert.deepEqual(sources.map(node => [node.x, node.y]), [[32, 72], [310, 72]]);
  assert.deepEqual(session.nodes.filter(node => node.kind === 'output').map(node => node.name), ['首屏主图', '材质详情']);
});

test('the primary product image is the only parent of imported result nodes', () => {
  const session = createFreshCanvasSession(workInput);
  const [source] = session.nodes.filter(node => node.isProductSource);
  for (const output of session.nodes.filter(node => node.kind === 'output')) {
    assert.deepEqual(output.sourceNodeIds, [source.id]);
    assert.equal(session.connections.filter(edge => edge.to === output.id).length, 1);
  }
});

test('fresh imports arrange outputs by horizontal commercial role lanes without default labels', () => {
  const session = createFreshCanvasSession({
    ...workInput,
    outputs: [
      { assetId: 'main-a', url: '/main-a.png', name: '主图 A', group: '主图', ratio: '1:1' },
      { assetId: 'main-b', url: '/main-b.png', name: '主图 B', group: '主图', ratio: '3:4' },
      { assetId: 'detail-a', url: '/detail-a.png', name: '详情 A', group: '详情图', ratio: '3:4' },
    ],
  });
  const main = session.nodes.filter(node => node.group === '主图');
  const detail = session.nodes.find(node => node.group === '详情图');
  assert.equal(main[0].y, main[1].y);
  assert.ok(main[1].x > main[0].x);
  assert.ok(detail.y > main[0].y);
  assert.ok(session.connections.every(edge => !edge.label));
});

test('output-only legacy works never create connections to a missing product source', () => {
  const session = createFreshCanvasSession({
    work: { id: 'legacy-output-only', product_name: '缺失原图的旧作品' },
    productAssets: [],
    outputs: [{ assetId: 'main-only', url: '/main-only.png', name: '商品主图', group: '主图' }],
  });

  assert.equal(session.nodes.some(node => node.isProductSource), false);
  assert.deepEqual(session.connections, []);
  assert.deepEqual(session.nodes.find(node => node.assetId === 'main-only')?.sourceNodeIds, []);
});

test('explicit Canvas snapshots preserve nodes, connections, and a valid viewport without sharing mutable state', () => {
  const source = {
    nodes: [{ id: 'source-1', x: 12 }],
    connections: [{ id: 'edge-1', from: 'source-1', to: 'output-1' }],
    viewport: { x: 20, y: 30, scale: 0.8 },
  };
  const snapshot = createCanvasSnapshot(source);
  source.nodes[0].x = 999;
  const restored = restoreCanvasSnapshot(snapshot);

  assert.deepEqual(restored, {
    nodes: [{ id: 'source-1', x: 12 }],
    connections: [{ id: 'edge-1', from: 'source-1', to: 'output-1' }],
    viewport: { x: 20, y: 30, scale: 0.8 },
  });
  assert.notEqual(restored.nodes, snapshot.nodes);
});

test('restoring a server Canvas snapshot preserves transient media playback while durable snapshots remove it', () => {
  const source = {
    nodes: [{
      id: 'video-1',
      kind: 'video',
      url: '/api/video/media/video-1?purpose=playback&expires=123',
      playbackUrl: '/api/video/media/video-1?purpose=playback&expires=123',
      assetRef: {
        projectId: 'project-1',
        projectAssetId: 'asset-1',
        contentHash: 'hash-1',
        stableUrl: '/api/video/assets/video-1',
        mediaKind: 'video',
      },
    }],
  };

  const restored = restoreCanvasSnapshot(source);
  const durable = createCanvasSnapshot(restored);

  assert.equal(restored.nodes[0].url, source.nodes[0].playbackUrl);
  assert.equal(restored.nodes[0].playbackUrl, source.nodes[0].playbackUrl);
  assert.equal(durable.nodes[0].url, source.nodes[0].assetRef.stableUrl);
  assert.equal('playbackUrl' in durable.nodes[0], false);
});

test('local Canvas drafts remint media playback from canonical project asset references', () => {
  const nodes = [{
    id: 'video-draft-1',
    kind: 'video',
    url: '/api/video/assets/video-1',
    projectAssetRef: {
      projectId: 'project-1',
      projectAssetId: 'asset-1',
      assetId: 'video-1',
      contentHash: 'hash-1',
      stableUrl: '/api/video/assets/video-1',
      mimeType: 'video/mp4',
    },
  }, {
    id: 'audio-draft-1',
    kind: 'audio',
    url: '/api/video/assets/audio-1',
    assetRef: {
      projectId: 'project-1',
      projectAssetId: 'asset-2',
      assetId: 'audio-1',
      contentHash: 'hash-2',
      stableUrl: '/api/video/assets/audio-1',
      mimeType: 'audio/mpeg',
    },
  }];
  assert.deepEqual(canvasMediaAssetRefs(nodes).map(ref => ref.projectAssetId), ['asset-1', 'asset-2']);
  const recovered = restoreCanvasMediaPlayback(nodes, [
    { ...nodes[0].projectAssetRef, playbackUrl: '/api/video/media/video-1?purpose=playback&cap=one' },
    { ...nodes[1].assetRef, playbackUrl: '/api/video/media/audio-1?purpose=playback&cap=two' },
  ]);
  assert.equal(recovered[0].url, '/api/video/media/video-1?purpose=playback&cap=one');
  assert.equal(recovered[1].url, '/api/video/media/audio-1?purpose=playback&cap=two');
  assert.equal(recovered[0].projectAssetRef.stableUrl, '/api/video/assets/video-1');
  assert.equal(recovered[1].assetRef.stableUrl, '/api/video/assets/audio-1');
});
