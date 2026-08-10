import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildCanvasImportResult,
  canvasWorkCategory,
  canvasOutputImages,
  canvasWorkOutputFingerprint,
  collectCanvasWorkImages,
  filterCanvasWorks,
  normalizeCanvasWorkPanel,
} from '../src/pages/EcCanvas/canvasWorkModel.js';

test('video works remain visible without image thumbnails and filter as video', () => {
  const works = normalizeCanvasWorkPanel({
    ownerEmail: 'owner@example.com',
    serverWorks: [{
      id: 'video-1',
      _phone: 'owner@example.com',
      _videoResult: true,
      title: '商品短视频',
      video_url: '/api/video/assets/result.mp4',
      video: { duration: 8, resolution: '720p' },
    }],
  });
  assert.equal(works.length, 1);
  assert.equal(works[0].videoUrl, '/api/video/assets/result.mp4');
  assert.equal(canvasWorkCategory(works[0]), 'video');
  assert.equal(filterCanvasWorks(works, 'video').length, 1);
});

test('Canvas work panel keeps only the signed owner local works and preserves server metadata', () => {
  const localWorks = [
    {
      id: 'mine-local',
      _saveKey: 'mine-local',
      _phone: ' Owner@Example.com ',
      _ecResult: true,
      product_name: '本地保温杯',
      productAssets: [{ assetId: 'local-product', url: '/api/generated-assets/' + 'a'.repeat(64) + '.png' }],
      images: [{ key: 'local-main', url: '/api/generated-assets/' + 'b'.repeat(64) + '.png' }],
    },
    {
      id: 'other-local',
      _saveKey: 'other-local',
      _phone: 'other@example.com',
      _ecResult: true,
      product_name: '其他账号作品',
      images: [{ key: 'other-main', url: '/api/generated-assets/' + 'c'.repeat(64) + '.png' }],
    },
    {
      id: 'legacy-unowned',
      _saveKey: 'legacy-unowned',
      _ecResult: true,
      product_name: '无归属旧缓存',
      images: [{ key: 'legacy-main', url: '/api/generated-assets/' + 'd'.repeat(64) + '.png' }],
    },
  ];
  const serverWorks = [
    {
      id: 'server-work',
      _saveKey: 'server-work',
      _phone: 'owner@example.com',
      _ecResult: true,
      product_name: '云端保温杯',
      projectId: 'project-1',
      sourceVersionId: 'source-version-1',
      resultVersionId: 'result-version-1',
      canvasSessionId: 'canvas-session-1',
      canvasSessionRevision: 4,
      productAssets: [{ assetId: 'server-product', url: '/api/generated-assets/' + 'e'.repeat(64) + '.png' }],
      images: [{ key: 'server-main', url: '/api/generated-assets/' + 'f'.repeat(64) + '.png' }],
    },
  ];

  const panel = normalizeCanvasWorkPanel({ localWorks, serverWorks, ownerEmail: 'owner@example.com' });

  assert.deepEqual(panel.map(work => work._saveKey), ['server-work', 'mine-local']);
  assert.equal(panel[0].projectId, 'project-1');
  assert.equal(panel[0].resultVersionId, 'result-version-1');
  assert.equal(panel[0].canvasSessionId, 'canvas-session-1');
  assert.equal(panel[0].canvasSessionRevision, 4);
  assert.equal(panel[0].productAssets[0].assetId, 'server-product');
});

test('Canvas work collection keeps ecommerce and Xiaohongshu works in one categorized library', () => {
  const panel = normalizeCanvasWorkPanel({
    serverWorks: [
      {
        _saveKey: 'ec-1',
        _ecResult: true,
        product_name: '电商套图',
        images: { main: '/api/generated-assets/' + 'a'.repeat(64) + '.png' },
      },
      {
        _saveKey: 'xhs-1',
        title: '小红书图文',
        cover_url: '/api/generated-assets/' + 'b'.repeat(64) + '.png',
        image_urls: [
          '/api/generated-assets/' + 'c'.repeat(64) + '.png',
          '/api/generated-assets/' + 'd'.repeat(64) + '.png',
        ],
      },
    ],
  });

  assert.equal(panel.length, 2);
  assert.equal(canvasWorkCategory(panel[0]), 'ecommerce');
  assert.equal(canvasWorkCategory(panel[1]), 'xhs');
  assert.equal(panel[1].images.length, 3);
  assert.deepEqual(filterCanvasWorks(panel, 'xhs').map(work => work._saveKey), ['xhs-1']);
  assert.equal(filterCanvasWorks(panel, 'all').length, 2);
});

test('importing a Xiaohongshu work preserves its library category in Canvas', () => {
  const imported = buildCanvasImportResult({
    _saveKey: 'xhs-import',
    title: '旅行图文',
    cover_url: '/cover.png',
    image_urls: ['/page-1.png'],
  }, { importId: 'fresh-import' });

  assert.equal(imported.workType, 'xhs');
  assert.equal(imported._ecResult, true);
  assert.equal(imported.imageRecords.length, 2);
});

test('free visual creation stays in its own Canvas work category', () => {
  const work = {
    _saveKey: 'visual-work',
    _phone: 'owner@example.com',
    _ecResult: true,
    workType: 'visual',
    product_name: '音乐节海报',
    images: [{ key: 'poster-1', url: '/api/generated-assets/' + '9'.repeat(64) + '.png' }],
  };
  const panel = normalizeCanvasWorkPanel({ ownerEmail: 'owner@example.com', serverWorks: [work] });
  assert.equal(canvasWorkCategory(panel[0]), 'visual');
  assert.equal(filterCanvasWorks(panel, 'visual').length, 1);
  assert.equal(buildCanvasImportResult(panel[0], { importId: 'visual-import' }).workType, 'visual');
});

test('Canvas open-work result preserves project, product and session metadata', () => {
  const result = buildCanvasImportResult({
    name: '云端保温杯',
    platform: '天猫',
    _saveKey: 'server-work',
    projectId: 'project-1',
    sourceVersionId: 'source-version-1',
    resultVersionId: 'result-version-1',
    canvasSessionId: 'canvas-session-1',
    canvasSessionRevision: 4,
    productAssets: [{ assetId: 'server-product', url: '/api/generated-assets/' + 'e'.repeat(64) + '.png' }],
    images: [{ key: 'server-main', url: '/api/generated-assets/' + 'f'.repeat(64) + '.png' }],
  }, { importId: 'import-1' });

  assert.equal(result.product_name, '云端保温杯');
  assert.equal(result.projectId, 'project-1');
  assert.equal(result.resultVersionId, 'result-version-1');
  assert.equal(result.canvasSessionId, 'canvas-session-1');
  assert.equal(result.canvasSessionRevision, 4);
  assert.deepEqual(result.productAssets, [{ assetId: 'server-product', url: '/api/generated-assets/' + 'e'.repeat(64) + '.png', key: 'image_1', label: 'image_1' }]);
  assert.deepEqual(result.images, { 'server-main': '/api/generated-assets/' + 'f'.repeat(64) + '.png' });
  assert.deepEqual(result.imageRecords, [{
    key: 'server-main',
    url: '/api/generated-assets/' + 'f'.repeat(64) + '.png',
    label: 'server-main',
  }]);
});

test('immediate Canvas handoff prefers structured delivery records over the legacy URL map', () => {
  const structured = [{
    id: 'white-background',
    key: 'white-background',
    url: '/api/generated-assets/' + 'a'.repeat(64) + '.webp',
    displayName: '白底首图',
    label: '白底首图',
    role: 'white_background',
    group: '白底图',
    ratio: '1:1',
    size: '2048x2048',
    width: 2048,
    height: 2048,
  }];

  assert.deepEqual(canvasOutputImages({
    images: { 'white-background': '/api/generated-assets/legacy.png' },
    imageRecords: structured,
  }), structured);
});

test('canvas autosave adds generated and edited stable images to Works without duplicating originals', () => {
  const original = '/api/generated-assets/' + 'a'.repeat(64) + '.png';
  const generated = '/api/generated-assets/' + 'b'.repeat(64) + '.png';
  const edited = '/api/generated-assets/' + 'c'.repeat(64) + '.png';
  const images = collectCanvasWorkImages({
    baseImages: [{ key: 'original', label: '原始主图', url: original }],
    nodes: [
      { id: 'source', kind: 'image', url: original, name: '原始主图' },
      { id: 'generated', kind: 'image-composer', status: 'success', url: generated, name: '图片生成结果', ratio: '1:1' },
      { id: 'edited', kind: 'output', status: 'ready', url: edited, name: '去除背景结果', ratio: '1:1' },
      { id: 'pending', kind: 'output', status: 'processing', url: '/pending.png' },
    ],
  });

  assert.deepEqual(images.map(image => image.url), [original, generated, edited]);
  assert.equal(images[1].label, '图片生成结果');
  assert.equal(images[2].source, 'canvas');
});

test('work output fingerprint changes only when a completed canvas image changes', () => {
  assert.equal(
    canvasWorkOutputFingerprint([
      { url: '/a.png', status: 'ready', kind: 'output' },
      { url: '/draft.png', status: 'processing', kind: 'image-composer' },
    ]),
    '/a.png',
  );
  assert.equal(canvasWorkOutputFingerprint([{ url: '/a.png', status: 'ready', kind: 'output' }]), '/a.png');
});

test('canvas-backed scripts have a declared package dependency', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.match(packageJson.dependencies?.canvas || '', /^\^?3\./);
});
