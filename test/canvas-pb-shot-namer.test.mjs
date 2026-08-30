// 4c183cd4 续命 P-B 画布节点电影分镜命名 (namer)
// 单测 createCanvasShotNamer: 6 类前缀 (Enclosure/Breakthrough/Framing/Voice/Caption/Sequence)
// 单测 createUploadedImageNodes/createUploadedVideoNodes 走 namer 时输出 Enclosure-001 / Breakthrough-001

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createCanvasShotNamer, createUploadedImageNodes, createUploadedVideoNodes } from '../src/pages/EcCanvas/canvasStudioModel.js';

test('P-B: createCanvasShotNamer image 走 Enclosure 自增 001/002/003', () => {
  const namer = createCanvasShotNamer();
  assert.equal(namer.next('image'), 'Enclosure-001');
  assert.equal(namer.next('image'), 'Enclosure-002');
  assert.equal(namer.next('image'), 'Enclosure-003');
});

test('P-B: createCanvasShotNamer video 走 Breakthrough 自增 001/002', () => {
  const namer = createCanvasShotNamer();
  assert.equal(namer.next('video'), 'Breakthrough-001');
  assert.equal(namer.next('video'), 'Breakthrough-002');
});

test('P-B: createCanvasShotNamer text 走 Caption (未来类型保留)', () => {
  const namer = createCanvasShotNamer();
  assert.equal(namer.next('text'), 'Caption-001');
});

test('P-B: createCanvasShotNamer audio 走 Voice 默认', () => {
  const namer = createCanvasShotNamer();
  assert.equal(namer.next('audio'), 'Voice-001');
});

test('P-B: createCanvasShotNamer shot/candidate 走 Framing/Overture', () => {
  const namer = createCanvasShotNamer();
  assert.equal(namer.next('image', { type: 'shot' }), 'Framing-001');
  assert.equal(namer.next('image', { type: 'candidate' }), 'Overture-001');
});

test('P-B: 同一 namer 多 kind 计数独立 (image 不影响 video)', () => {
  const namer = createCanvasShotNamer();
  assert.equal(namer.next('image'), 'Enclosure-001');
  assert.equal(namer.next('video'), 'Breakthrough-001');
  assert.equal(namer.next('image'), 'Enclosure-002');
  assert.equal(namer.next('video'), 'Breakthrough-002');
});

test('P-B: createUploadedImageNodes 传 namer 时 name 走 Enclosure-001/002', () => {
  const namer = createCanvasShotNamer();
  const nodes = createUploadedImageNodes({
    assets: [
      { url: 'https://x/a.jpg', assetId: 'a' },
      { url: 'https://x/b.jpg', assetId: 'b' },
    ],
    namer,
    now: 12345,
  });
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].name, 'Enclosure-001');
  assert.equal(nodes[0].displayLabel, 'Enclosure-001');
  assert.equal(nodes[1].name, 'Enclosure-002');
});

test('P-B: createUploadedImageNodes 资产有 name 时优先保留 (不覆盖用户命名)', () => {
  const namer = createCanvasShotNamer();
  const nodes = createUploadedImageNodes({
    assets: [
      { url: 'https://x/a.jpg', assetId: 'a', name: 'T恤主图' },
    ],
    namer,
    now: 12345,
  });
  assert.equal(nodes[0].name, 'T恤主图');
  assert.equal(nodes[0].displayLabel, 'T恤主图');
  // namer 仍前进 (单调递增), 但用户命名后保留
  assert.equal(namer.next('image'), 'Enclosure-002');
});

test('P-B: createUploadedVideoNodes 传 namer 时 name 走 Breakthrough-001/002', () => {
  const namer = createCanvasShotNamer();
  const nodes = createUploadedVideoNodes({
    assets: [
      { id: 'v1', url: 'https://x/v1.mp4', assetId: 'v1' },
      { id: 'v2', url: 'https://x/v2.mp4', assetId: 'v2' },
    ],
    namer,
    now: 67890,
  });
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].name, 'Breakthrough-001');
  assert.equal(nodes[1].name, 'Breakthrough-002');
  assert.equal(nodes[0].kind, 'video');
});

test('P-B: createUploadedImageNodes 不传 namer 仍走兜底 Enclosure-001', () => {
  const nodes = createUploadedImageNodes({
    assets: [{ url: 'https://x/a.jpg', assetId: 'a' }],
    now: 12345,
  });
  assert.equal(nodes[0].name, 'Enclosure-001');
});

test('P-B: snapshot() 返回计数器状态 (session 内持久化)', () => {
  const namer = createCanvasShotNamer();
  namer.next('image');
  namer.next('image');
  namer.next('video');
  const snap = namer.snapshot();
  assert.equal(snap.image, 2);
  assert.equal(snap.video, 1);
});
