import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('video studio is an authenticated durable billed workspace', async () => {
  const [app, page, server, generation] = await Promise.all([
    source('../src/App.jsx'),
    source('../src/pages/VideoStudio/index.jsx'),
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
  assert.match(server, /\/api\/video\/capabilities/);
  assert.match(server, /\/api\/video\/jobs/);
  assert.match(await source('../src/pages/Home/index.jsx'), /workspace-video\.png/);
  assert.match(await source('../src/pages/EcCanvas/index.jsx'), /CanvasVideoComposer/);
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
