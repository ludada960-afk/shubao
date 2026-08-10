import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('video studio is an authenticated durable billed workspace embedded in home and canvas', async () => {
  const [app, home, page, canvas, workModel, server, generation] = await Promise.all([
    source('../src/App.jsx'),
    source('../src/pages/Home/index.jsx'),
    source('../src/pages/VideoStudio/index.jsx'),
    source('../src/pages/EcCanvas/index.jsx'),
    source('../src/pages/EcCanvas/canvasWorkModel.js'),
    source('../server/index.mjs'),
    source('../server/videoGeneration.mjs'),
  ]);
  assert.match(app, /video-studio/);
  assert.match(app, /视频创作/);
  assert.match(page, /脚本成片/);
  assert.match(page, /首尾帧/);
  assert.match(page, /多模态参考/);
  assert.match(page, /爆款重构/);
  assert.match(page, /AI 积分 \/ 次/);
  assert.match(page, /disabled=\{!canGenerate\}/);
  assert.match(page, /video-composer/);
  assert.match(page, /video-config-trigger/);
  assert.match(page, /createPortal/);
  assert.match(page, /创作模式/);
  assert.match(page, /素材参考/);
  assert.match(page, /镜头规格/);
  assert.match(page, /生成设置/);
  assert.match(page, /embedded = false/);
  assert.match(page, /在画布中继续/);
  assert.match(page, /type: 'SET_RESULT'/);
  assert.match(page, /type: 'NAVIGATE', page: 'ec-canvas'/);
  assert.match(home, /mode: 'video'/);
  assert.match(home, /<VideoStudioPage embedded/);
  assert.match(server, /\/api\/video\/capabilities/);
  assert.match(server, /\/api\/video\/jobs/);
  assert.match(home, /workspace-video-model\.png/);
  assert.match(canvas, /CanvasVideoComposer/);
  assert.match(canvas, /resultVideoUrl/);
  assert.match(canvas, /createUploadedVideoNodes/);
  assert.match(canvas, /buildCanvasImportResult\(work\)/);
  assert.match(workModel, /videoUrl,\n    video_url: videoUrl/);
  assert.match(await source('../src/pages/EcCanvas/canvasStudioModel.js'), /createCanvasVideoComposerNode/);
  assert.match(generation, /walletService\.createHold/);
  assert.match(generation, /walletService\.settleItem/);
  assert.match(generation, /walletService\.releaseItem/);
  assert.match(generation, /upsertWork/);
});

test('pricing presents only the real checkout price', async () => {
  const [catalog, modal] = await Promise.all([
    source('../server/billing/catalog.mjs'),
    source('../src/components/business/Modals.jsx'),
  ]);
  assert.doesNotMatch(catalog, /compareAtFen/);
  assert.doesNotMatch(modal, /正式版价|公测价|line-through/);
  assert.match(modal, /选择套餐/);
});
