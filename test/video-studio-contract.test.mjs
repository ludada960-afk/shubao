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
  /* 9-12 用户批注：积分统一放在按钮内（.shubao-gen-cta-points），左侧独立积分栏已去掉 */
  /* 2026-09-16 用户批注（图2-② / 图3-①，第三次追问）：「现在不是已经有预设了一套方案在这里吗？
     为什么你的积分还是一积分呢？……肯定是按他整个视频要收多少钱去告诉他呀。」
     —— 按钮上显示的是**整个任务的总价**（方案分析 + 成片预估），且随模型/时长实时变化。
     本条守的判据一字未变：积分统一放在按钮内、不再有左侧独立积分栏。 */
  assert.ok(page.includes('<span className="shubao-gen-cta-points"'), '积分必须在按钮内');
  assert.match(page, /\{totalJobPoints \|\| ANALYSIS_POINTS\} 积分/, '未确认方案时按钮显示的是整个任务的总价');
  assert.match(page, /const totalJobPoints = estimatedPoints > 0 \? estimatedPoints \+ ANALYSIS_POINTS : 0;/,
    '总价 = 方案分析 + 成片预估（成片预估来自服务端报价，随配置变化）');
  assert.ok(!page.includes('video-submit-meta'), '左侧独立积分栏不得回归');
  assert.match(page, /const ANALYSIS_POINTS = 1;/);
  assert.match(page, /video-generate-trigger shubao-gen-cta/);
  assert.match(page, /analyzeVideoPlan/);
  assert.match(page, /inspectVideoPlanningFiles/);
  assert.match(page, /plannedUploads/);
  assert.match(page, /if \(!state\.logged \|\| state\.browserQa\) \{/);
  assert.match(page, /\}, \[state\.logged, state\.browserQa\]\);/);
  assert.match(page, /reusable = plannedUploads/);
  assert.doesNotMatch(page, /不调用上游，也不会扣积分/);
  assert.match(page, /planReviewed/);
  /* 默认创作方式 = 智能成片。
     ⚠️ 原来这条断言写的是字面量 useState('smart')，9-17 支持技能子页面用 initialMode 指定
        自己那一档（skillVideoMode）之后就变成**守实现细节**：源码合规、断言却红，
        而它当时不在 precommit 的 BLOCKING 名单里，只在部署时跑 —— 结果是提交全绿、部署永远红，
        线上一个月没更新。现在改成守**默认值本身**（常量），改默认值才报错，改写法不报错。 */
  assert.match(page, /useState\(\(\) => initialMode \|\| DEFAULT_VIDEO_MODE\)/);
  assert.match(page, /DEFAULT_VIDEO_MODE/);
  assert.match(page, /video-mode-tabs/);
  assert.match(page, /把创意素材变成吸引人的短片/);
  assert.doesNotMatch(page, /变成可交付的视频/);
  /* 9-11 三轮: 视频模型标改为真实品牌标 (ModelLogo + videoProductLogo) */
  assert.match(page, /function VideoModelMark\(\{ product = null, provider = '' \}\)/);
  assert.match(page, /videoProductLogo\(product\)/);
  assert.match(page, /role="tablist"/);
  assert.match(page, /video-content-composer/);
  assert.match(page, /video-materials/);
  assert.match(page, /上传素材/);
  assert.match(page, /video-media-deck/);
  /* ⚠️ 2026-09-18 用户批注 3：视频素材改成**三张对称卡片**，样式从图片侧复制（不要歪卡）。
     落点从"三个 .video-material-action 动作卡"换成"图片侧同一份实现"：
       · 结构 = ec-xhs-media-column → ec-xhs-media-strip（与图片侧 .visual-reference-zone 逐层同构）
       · 卡片 = EcommerceAddCard / EcommerceImageCard（同一个组件，不是抄一份 CSS）
       · 对称 = grid 三列等宽 + 倾斜清零（见 .video-material-strip 的注释）
       · 追加 = 清空素材 + 全屏两颗按钮
     旧断言守的是被产品替换掉的那套动作卡，所以这里**改守新契约**（不是为了让测试过而回退 UI）。 */
  assert.match(page, /ec-xhs-media-column video-material-column/);
  assert.match(page, /ec-xhs-media-strip video-material-strip/);
  assert.match(page, /import \{ EcommerceAddCard, EcommerceImageCard \} from '\.\.\/Home\/ec\/components\/EcommerceAssetCards\.jsx'/);
  assert.match(page, /kind: 'image'/);
  assert.match(page, /kind: 'video'/);
  assert.match(page, /kind: 'audio'/);
  assert.match(page, /className="video-materials-clear"/);
  assert.match(page, /className="video-materials-fullscreen"/);
  assert.match(page, /requestFullscreen/);
  assert.match(page, /fullscreenchange/);
  assert.match(page, /function clearMaterials()/);
  assert.doesNotMatch(page, /aria-label="添加素材"/);
  /* MediaPreview 是"卡片内部自绘缩略图"的旧实现，已随三卡改造删除（0 个渲染点）；
     缩略图现在由 MediaAssetCard / EcommerceImageCard 承担。 */
  assert.doesNotMatch(page, /function MediaPreview\(\{/);
  assert.doesNotMatch(page, /function UploadStatus\(\{/);
  assert.match(page, /EcommerceImageCard/);
  assert.doesNotMatch(page, /return <div className="video-panel-assets">/);
  assert.doesNotMatch(page, /图片素材（可选）/);
  assert.match(page, /video-quick-tools/);
  assert.match(page, /引用素材/);
  assert.match(page, /providerLabel/);
  assert.match(page, /tierLabel/);
  /* 2026-09-16 用户批注（图2-②）：「你为什么这里会有两套描述呢？你只要保留一套就好了呀。
     然后你的积分其实是不能在这里说的。」—— 模型列表原本一行塞了 4 段文字
     （型号+档位 / 描述 / 限制 / 积分），现在只留**一段描述**。
     判据随之更新：列表只能有一段描述，且不得再列积分（积分只出现在右下角按钮上）。 */
  assert.match(page, /product\.description/, '模型列表必须保留一段描述');
  assert.ok(!/<small className="video-model-limit">/.test(page), '不得再单独铺限制文案（列表只留一套描述）');
  assert.ok(!/AI 积分 \/ 次/.test(page), '模型列表不得再写积分（积分只出现在右下角按钮上）');
  assert.doesNotMatch(page, /quickUploadRef/);
  assert.doesNotMatch(page, /脚本成片无需参考素材/);
  assert.doesNotMatch(page, /\{ key: 'mode'/);
  assert.doesNotMatch(page, /\{ key: 'assets'/);
  assert.match(styles, /\.video-mode-tabs/);
  assert.match(styles, /button\.is-selected \.video-mode-copy strong/);
  /* 2026-09-14 §18 灰阶迁移：白字改用 --sb-neutral-0（值不变）。断言「解析后为白」。 */
  assert.match(styles, /color:\s*(#fff\b|var\(--sb-neutral-0\))/);
  assert.doesNotMatch(styles, /\.video-model-mark\.is-seedance\s*\{\s*background:\s*conic-gradient/);
  assert.match(styles, /grid-template-columns:\s*repeat\(3/);
  assert.match(styles, /\.video-content-composer/);
  assert.match(styles, /\.video-materials/);
  assert.match(styles, /\.video-media-deck/);
  /* 三张对称卡：等宽网格是"对称"的可判据形式，倾斜清零是"不要歪卡"的可判据形式。 */
  /* ⚠️ 2026-09-19 判据随用户批注 #1-②/#2-① 一起更新（不是为了让测试过而回退 UI）：
     原判据守的是「三列等宽网格」—— 用户看过之后明确否掉了那个形态：
     「你直接拿图片生成那边的那种卡片样式过来用……弄成三张卡片这样，不必向左歪、向右歪就是正常的放。
      上传完素材，它是会在这里面向右挤的。如果素材过于多的话，向右挤，就会有下面有一条滑动条。」
     新契约守三件事：
       ① 一条**横向带子**（flex-nowrap + overflow-x:auto）—— 素材向右挤，挤不下出滑动条；
       ② 卡尺寸取图片侧那一档（86×108）且**不被拉伸**（flex: 0 0 86px）；
       ③ 倾斜清零（"不要歪卡"）。 */
  assert.match(styles, /\.video-material-strip \{[^}]*display: flex;[^}]*flex-wrap: nowrap;[^}]*overflow-x: auto;/);
  assert.match(styles, /\.video-material-strip \.ec-xhs-upload-card \{[^}]*flex: 0 0 86px;/);
  assert.match(styles, /\.video-material-strip \.ec-xhs-upload-card,[\s\S]{0,260}transform: none;/);
  assert.match(styles, /\.video-materials-clear,/);
  assert.match(styles, /\.video-materials-fullscreen \{/);
  assert.match(styles, /\.video-composer\.is-fullscreen \{/);
  assert.match(styles, /\.video-inline-menu/);
  /* 2026-09-16：模型列表里的「N AI 积分 / 次」已按用户批注（图2-②「你的积分其实是不能在这里说的」）
     移除；积分改为统一显示在右下角生成按钮上（.shubao-gen-cta-points），
     且显示的是整个任务的总价。本条守的判据改为：**积分必须在按钮上随配置动态显示**。 */
  assert.match(page, /shubao-gen-cta-points/, '积分必须显示在生成按钮内');
  assert.match(page, /totalJobPoints/, '按钮上的积分必须是动态总价');
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
  /* ⚠️ 本条原来守的是 `upload.asset?.url` —— 那是 MediaPreview 组件里的写法，
     而 MediaPreview 早已没有任何渲染点（9-18 三卡改造时删掉）。
     「立刻可预览」这条判据真正在跑的位置有两个，逐个守：
       ① 上传客户端给即时预览：createImmediateMediaPreview —— 页面必须**确实调用它**，
          否则「能预览」只是库里有这个函数；
       ② 已上传的素材用服务端地址：uploadFor(...)?.asset?.url。 */
  assert.match(page, /createImmediateMediaPreview\(/);
  assert.match(page, /uploadFor\(item\.file\)\?\.asset\?\.url/);
  assert.match(page, /上传中|uploading/);
  assert.match(page, /重试上传|onRetry/);
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
