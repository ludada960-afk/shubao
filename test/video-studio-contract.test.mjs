import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('video studio is an authenticated durable billed workspace embedded in home and canvas', async () => {
  const [app, nav, home, page, styles, canvas, workModel, server, generation, videoModel, videoService, assetAnalysis] = await Promise.all([
    source('../src/App.jsx'),
    source('../src/components/layout/CreativeDomainNav.jsx'),
    source('../src/pages/Home/index.jsx'),
    source('../src/pages/VideoStudio/index.jsx'),
    source('../src/pages/VideoStudio/VideoStudio.css'),
    source('../src/pages/EcCanvas/index.jsx'),
    source('../src/pages/EcCanvas/canvasWorkModel.js'),
    source('../server/index.mjs'),
    source('../server/videoGeneration.mjs'),
    source('../src/pages/VideoStudio/videoStudioModel.js'),
    source('../src/services/video.js'),
    source('../src/pages/VideoStudio/videoAssetAnalysis.js'),
  ]);
  assert.match(app, /video-studio/);
  assert.match(nav, /creativeDomainNavigation/);
  assert.match(page, /VIDEO_CREATION_MODES/);
  assert.match(page, /quoteForVideoProduct/);
  assert.match(page, /productId:\s*selectedProduct\.id/);
  assert.match(page, /capabilities\.products/);
  assert.doesNotMatch(page, /function skuFor\(/);
  assert.doesNotMatch(page, /video_seedance_720p/);
  assert.match(page, /resolveVideoApiMode/);
  assert.match(page, /hasRequiredVideoInputs/);
  assert.match(page, /buildVideoPlan/);
  assert.match(page, /分析并生成方案/);
  assert.match(page, /确认生成方案/);
  assert.match(page, /方案分析 1 积分/);
  assert.match(page, /analyzeVideoPlan/);
  assert.match(page, /inspectVideoPlanningFiles/);
  assert.match(page, /plannedUploads/);
  assert.match(page, /if \(!state\.logged \|\| state\.browserQa\) \{/);
  assert.match(page, /\}, \[state\.logged, state\.browserQa\]\);/);
  assert.match(page, /reusable = plannedUploads/);
  assert.doesNotMatch(page, /不调用上游，也不会扣积分/);
  assert.match(page, /planReviewed/);
  assert.match(page, /useState\('smart'\)/);
  assert.match(page, /video-mode-tabs/);
  assert.match(page, /把创意素材变成吸引人的短片/);
  assert.doesNotMatch(page, /变成可交付的视频/);
  assert.match(page, /function VideoModelMark/);
  assert.match(page, /<Clapperboard size=\{14\}/);
  assert.match(page, /role="tablist"/);
  assert.match(page, /video-content-composer/);
  assert.match(page, /video-materials/);
  assert.match(page, /上传素材/);
  assert.match(page, /video-media-deck/);
  assert.match(page, /video-material-actions/);
  assert.match(page, /kind: 'image'/);
  assert.match(page, /kind: 'video'/);
  assert.match(page, /kind: 'audio'/);
  assert.match(page, /video-material-action is-\$\{action\.kind\}/);
  assert.doesNotMatch(page, /aria-label="添加素材"/);
  assert.match(page, /MediaPreview/);
  assert.doesNotMatch(page, /return <div className="video-panel-assets">/);
  assert.doesNotMatch(page, /图片素材（可选）/);
  assert.match(page, /video-quick-tools/);
  assert.match(page, /引用素材/);
  assert.match(page, /providerLabel/);
  assert.match(page, /tierLabel/);
  assert.match(page, /limitations/);
  assert.match(page, /AI 积分 \/ 次/);
  assert.doesNotMatch(page, /quickUploadRef/);
  assert.doesNotMatch(page, /脚本成片无需参考素材/);
  assert.doesNotMatch(page, /\{ key: 'mode'/);
  assert.doesNotMatch(page, /\{ key: 'assets'/);
  assert.match(styles, /\.video-mode-tabs/);
  assert.match(styles, /button\.is-selected \.video-mode-copy strong/);
  assert.match(styles, /color:\s*#fff/);
  assert.doesNotMatch(styles, /\.video-model-mark\.is-seedance\s*\{\s*background:\s*conic-gradient/);
  assert.match(styles, /grid-template-columns:\s*repeat\(3/);
  assert.match(styles, /\.video-content-composer/);
  assert.match(styles, /\.video-materials/);
  assert.match(styles, /\.video-media-deck/);
  assert.match(styles, /\.video-material-actions/);
  assert.match(styles, /\.video-material-action\.is-image/);
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
  assert.match(page, /任务、素材与结果自动保存/);
  assert.match(page, /job\?\.projectId \? `项目已保存/);
  assert.match(page, /type: 'SET_RESULT'/);
  assert.match(page, /type: 'NAVIGATE', page: 'ec-canvas'/);
  assert.match(home, /mode: 'video'/);
  assert.match(home, /<VideoStudioPage embedded/);
  assert.match(server, /\/api\/video\/capabilities/);
  assert.doesNotMatch(server, /app\.get\('\/api\/video\/capabilities',\s*authenticateEcommerceRequest/);
  assert.match(server, /\/api\/video\/jobs/);
  assert.match(server, /\/api\/video\/plans/);
  assert.match(server, /app\.get\('\/api\/video\/assets\/:id',\s*authenticateVideoRequest/);
  assert.match(server, /videoGeneration\.readAsset\(req\.params\.id, req\._userEmail\)/);
  assert.match(server, /videoGeneration\.readAsset\(id, req\._userEmail\)/);
  assert.match(server, /app\.get\('\/api\/video\/media\/:id'/);
  assert.match(server, /videoGeneration\.readSignedAsset/);
  assert.match(server, /decorateOwnedWorkPlayback\(work,/);
  assert.match(server, /videoGeneration\.playbackUrlForAsset\(asset\.assetId, owner\)/);
  assert.match(server, /video_plan_analysis/);
  assert.match(videoService, /export function analyzeVideoPlan/);
  assert.match(assetAnalysis, /videoMetadata/);
  assert.match(assetAnalysis, /audioMetadata/);
  assert.match(assetAnalysis, /frameTimes/);
  assert.match(page, /if \(!state\.logged \|\| state\.browserQa\)[\s\S]*?setHistory\(\[\]\)/);
  assert.match(page, /\}, \[state\.logged\]\);/);
  assert.match(home, /entry-video\.png/);
  assert.match(canvas, /CanvasVideoComposer/);
  assert.match(canvas, /resolveVideoApiMode/);
  assert.match(canvas, /hasRequiredVideoInputs/);
  assert.match(canvas, /`video_\$\{model\}_\$\{Number\(duration\)/);
  assert.match(canvas, /productId:\s*composer\.modelProductId \|\| 'seedance_standard'/);
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
  assert.match(canvasStudio, /buildVideoPlan/);
  assert.match(canvasStudio, /分析并生成方案/);
  assert.match(canvasStudio, /真实素材分析已完成/);
  assert.doesNotMatch(canvasStudio, /本地整理，不调用上游/);
  assert.match(canvasStudio, /planReviewed/);
  assert.match(canvas, /handleVideoComposerAnalyze/);
  assert.match(canvas, /plannedVideoAssets/);
  assert.match(canvas, /analyzeVideoPlan/);
  assert.doesNotMatch(canvasStudio, /480P 预览/);
  assert.match(canvasStudio, /\{option\.label\}/);
  assert.match(videoModel, /智能成片/);
  assert.match(videoModel, /首尾帧/);
  assert.match(videoModel, /爆款重构/);
  const canvasVideoComposer = canvasStudio.match(/export function CanvasVideoComposer[\s\S]*?export function CanvasEcommerceComposer/)?.[0] || '';
  assert.doesNotMatch(canvasVideoComposer, /脚本成片|多图参考|产品图/);
  assert.match(canvasVideoComposer, /ComposerSources[\s\S]*accept="image\/\*,video\/\*,audio\/\*"/);
  assert.match(canvasVideoComposer, /accept="image\/\*,video\/\*,audio\/\*"/);
  assert.match(canvasVideoComposer, /视频模型/);
  assert.match(canvasVideoComposer, /modelProductId/);
  assert.doesNotMatch(canvasVideoComposer, /VideoSourceStrip/);
  assert.doesNotMatch(canvasVideoComposer, /accept="video\/\*"/);
  assert.match(generation, /walletService\.createHold/);
  assert.match(generation, /walletService\.settleItem/);
  assert.match(generation, /walletService\.releaseItem/);
  assert.match(generation, /upsertWork/);
});

test('pricing presents only the real checkout price', async () => {
  const [catalog, modal] = await Promise.all([
    source('../server/billing/catalog.mjs'),
    source('../src/pages/Pricing/index.jsx'),
  ]);
  assert.doesNotMatch(catalog, /compareAtFen/);
  assert.doesNotMatch(modal, /正式版价|公测价|line-through/);
  assert.match(modal, /选择套餐/);
});

test('video assets preview immediately and upload resumably without proxy buffering', async () => {
  const [page, videoService, uploadClient, uploadServer, server, nginx] = await Promise.all([
    source('../src/pages/VideoStudio/index.jsx'),
    source('../src/services/video.js'),
    source('../src/services/videoUploadClient.js'),
    source('../server/videoUploadService.mjs'),
    source('../server/index.mjs'),
    source('../scripts/nginx/shuimg.cn.conf'),
  ]);
  assert.match(uploadClient, /from 'tus-js-client'/);
  assert.match(uploadClient, /createImmediateMediaPreview/);
  assert.match(uploadClient, /retryDelays/);
  assert.match(uploadClient, /onProgress/);
  assert.match(uploadClient, /removeFingerprintOnSuccess:\s*true/);
  assert.match(videoService, /createVideoAssetUpload/);
  assert.match(page, /upload\.asset\?\.url/);
  assert.match(page, /上传中/);
  assert.match(page, /重试上传/);
  assert.match(page, /ensureUpload/);
  assert.match(uploadServer, /new Server\(/);
  assert.match(uploadServer, /new FileStore\(/);
  assert.match(uploadServer, /createReadStream/);
  assert.match(uploadServer, /sha256/);
  assert.match(uploadServer, /owner_email/);
  assert.match(server, /\/api\/video\/uploads/);
  assert.match(server, /\/api\/video\/upload-results\/\:id/);
  assert.match(nginx, /client_max_body_size\s+64m/);
  assert.match(nginx, /proxy_request_buffering\s+off/);
});
