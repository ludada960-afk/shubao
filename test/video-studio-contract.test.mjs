import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('video studio is an authenticated durable billed workspace embedded in home and canvas', async () => {
  const [app, home, page, styles, canvas, workModel, server, generation, videoModel] = await Promise.all([
    source('../src/App.jsx'),
    source('../src/pages/Home/index.jsx'),
    source('../src/pages/VideoStudio/index.jsx'),
    source('../src/pages/VideoStudio/VideoStudio.css'),
    source('../src/pages/EcCanvas/index.jsx'),
    source('../src/pages/EcCanvas/canvasWorkModel.js'),
    source('../server/index.mjs'),
    source('../server/videoGeneration.mjs'),
    source('../src/pages/VideoStudio/videoStudioModel.js'),
  ]);
  assert.match(app, /video-studio/);
  assert.match(app, /视频创作/);
  assert.match(page, /VIDEO_CREATION_MODES/);
  assert.match(page, /resolveVideoApiMode/);
  assert.match(page, /hasRequiredVideoInputs/);
  assert.match(page, /useState\('smart'\)/);
  assert.match(page, /video-mode-tabs/);
  assert.match(page, /role="tablist"/);
  assert.match(page, /video-content-composer/);
  assert.match(page, /video-materials/);
  assert.match(page, /上传素材/);
  assert.match(page, /video-media-deck/);
  assert.match(page, /video-media-add-card/);
  assert.match(page, /图片、视频或音频/);
  assert.match(page, /MediaPreview/);
  assert.doesNotMatch(page, /return <div className="video-panel-assets">/);
  assert.doesNotMatch(page, /图片素材（可选）/);
  assert.match(page, /video-quick-tools/);
  assert.match(page, /引用素材/);
  assert.match(page, /Seedance 2\.0/);
  assert.doesNotMatch(page, /quickUploadRef/);
  assert.doesNotMatch(page, /脚本成片无需参考素材/);
  assert.doesNotMatch(page, /\{ key: 'mode'/);
  assert.doesNotMatch(page, /\{ key: 'assets'/);
  assert.match(styles, /\.video-mode-tabs/);
  assert.match(styles, /grid-template-columns:\s*repeat\(3/);
  assert.match(styles, /\.video-content-composer/);
  assert.match(styles, /\.video-materials/);
  assert.match(styles, /\.video-media-deck/);
  assert.match(styles, /\.video-media-add-card/);
  assert.match(styles, /\.video-media-preview/);
  assert.match(styles, /\.video-inline-menu/);
  assert.match(page, /AI 积分 \/ 次/);
  assert.match(page, /disabled=\{!canGenerate\}/);
  assert.match(page, /video-composer/);
  assert.match(page, /video-config-trigger/);
  assert.match(page, /createPortal/);
  assert.match(page, /视频创作模式/);
  assert.match(page, /上传素材/);
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
  assert.match(canvas, /resolveVideoApiMode/);
  assert.match(canvas, /hasRequiredVideoInputs/);
  assert.match(canvas, /resultVideoUrl/);
  assert.match(canvas, /createUploadedVideoNodes/);
  assert.match(canvas, /mode:\s*composer\.mode \|\| 'smart'/);
  assert.match(canvas, /buildCanvasImportResult\(work\)/);
  assert.match(workModel, /videoUrl,\n    video_url: videoUrl/);
  const canvasStudio = await source('../src/pages/EcCanvas/components/CanvasStudio.jsx');
  const canvasModel = await source('../src/pages/EcCanvas/canvasStudioModel.js');
  assert.match(canvasModel, /createCanvasVideoComposerNode/);
  assert.match(canvasModel, /mode:\s*'smart'/);
  assert.match(canvasStudio, /VIDEO_CREATION_MODES/);
  assert.match(canvasStudio, /VIDEO_CREATION_MODES\.map/);
  assert.match(canvasStudio, /\{option\.label\}/);
  assert.match(videoModel, /智能成片/);
  assert.match(videoModel, /首尾帧/);
  assert.match(videoModel, /爆款重构/);
  const canvasVideoComposer = canvasStudio.match(/export function CanvasVideoComposer[\s\S]*?export function CanvasEcommerceComposer/)?.[0] || '';
  assert.doesNotMatch(canvasVideoComposer, /脚本成片|多图参考|产品图/);
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
