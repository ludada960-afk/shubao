
/**
 * 薯包AI 后端服务
 * 复刻 Coze 工作流：内容分析 → 视觉规划 → 图片生成 → 结果组装
 */
import express from 'express';
import cors from 'cors';
import https from 'https';
import 'dotenv/config';
import { fileURLToPath } from 'url';
import { basename, dirname, resolve, join, extname } from 'path';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';
import { mountOnApp as mountExtRoutes } from './extensionRoutes.mjs';
import { resolveAuthSessionSecret } from './authSessionSecret.mjs';
import { createAuthService, createDualModeSessionTokens } from './auth/authService.mjs';
import { mountAuthRoutes } from './authRoutes.mjs';
import { createOAuthStore } from './auth/oauthStore.mjs';
import { createProviderRegistry } from './auth/providerRegistry.mjs';
import { buildOutline, IMAGE_TYPE_INFO } from './ecommercePromptEngine.mjs';
import {
  PLOG_STYLES, PLOG_CATEGORIES, SCENE_LENSES, LAYOUT_TEMPLATES, COVER_VARIANTS,
  classifyScene, getLensesForScene, extractToneFromImage, buildToneCard,
  buildPlogPrompt, generatePlogCopy, generatePlogCaption
} from './plogPromptEngine.mjs';
import {
  buildDynamicXhsAnalysisRequest,
  buildDynamicPlogRequest,
  compileDynamicXhsVisual,
  createDynamicPlogFallback,
  createDynamicXhsFallback,
  deriveXhsCreativeDirection,
  normalizeDynamicXhsAnalysis,
  normalizeDynamicPlogPlan,
  parseXhsPlannerJson,
} from './xhsCreativePlanner.mjs';

import { initDB, migrateLegacyUserCredits, getAllUsers, getUserCredits, addUserCredits, consumeUserCredit, createTask, startTask, updateTaskProgress, completeTask, failTask, getTask, getAllWorks, getDeletedWorks, getWorkCount, upsertWork, softDeleteWork, restoreWork } from './db.mjs';
import { normalizeEmail } from './accessPolicy.mjs';
import {
  getAccountAccess,
  requireAccountAccess,
  requireAdminAccess,
  requireFeatureAccess,
} from './accessControl.mjs';
import { createWalletService } from './billing/walletService.mjs';
import { createPaymentService } from './billing/paymentService.mjs';
import { createPaymentChannelRegistry } from './billing/paymentChannels.mjs';
import { assertCatalogMarginGates } from './billing/catalog.mjs';
import { mountBillingRoutes } from './billing/routes.mjs';
// 4c183cd4 续命 P-D commerce paywall: 微信/支付宝 sandbox 真接入 (4 档定价 + 月卡 2 档)
import { createPaywallService } from './billing/paywall.mjs';
import { mountPaywallRoutes } from './billing/paywallRoutes.mjs';
import { visionRouter } from './routes/visionRouter.mjs';
// 4c183cd4 续命 P1 TTS 口播 (provider-neutral 桥, 跟 modlens vision 桥同模式)
import { mountTTSRoutes } from './services/ttsBridge.mjs';
// 4c183cd4 续命 P-G 画布 1-click chain (4 步: 文案->首帧->视频->音轨+字幕, 集成 costBasis + TTS)
import { mountChainRoutes } from './services/chainService.mjs';
// 4c183cd4 续命 P-F 孪生体 2.0 矩阵 (Web / 小程序 / API) — 薯包独门 1/3
// 集成 ttsBridge (9c5d01d5) + visionBridge (4c285eca) + chainService (b015edb8) + 中文 AI 合规水印 (4c183cd4 续命)
import { mountTwinMatrixRoutes } from './services/twinMatrix.mjs';
import { createBillingQuoteService } from './billing/quoteService.mjs';
import { createOneShotBilling } from './billing/oneShotBilling.mjs';
import { createAdminOperations } from './adminOperations.mjs';
import { mountAdminRoutes } from './adminRoutes.mjs';
import { createCanvasBilledActionStore } from './billing/canvasBilledActionStore.mjs';
import {
  createContentEntitlements,
  isCompleteContentDelivery,
} from './billing/contentEntitlements.mjs';
import {
  authenticateContentRequest,
  contentBillingHttpError,
  createBilledSseRunner,
  createContentBilling,
  createGeneratedAssetPersister,
  createPreviewSseRunner,
  createSessionTokenService,
} from './billing/contentBilling.mjs';
import { imageGenerationPool } from './imageGenerationPool.mjs';
import { createGeneratedAssetStore, stableAssetDataUrl } from './generatedAssets.mjs';
import { createImageDelivery } from './imageDelivery.mjs';
import { GALLERY_FILE_MAP, GALLERY_IMAGE_EXTENSIONS } from './galleryCatalog.mjs';
import { resolveContentReferenceGroups } from './contentReferenceAssets.mjs';
import { normalizeReferenceGroups, referenceUsageLabel, selectSourceInputs } from './contentReferenceRouter.mjs';
import {
  createImageInputReader,
  imageBufferToDataUrl,
  imageBufferToVisionDataUrl,
} from './imageInput.mjs';
import { createGenerationJobs } from './generationJobs.mjs';
import { createCanvasGenerationStore } from './canvasGenerationStore.mjs';
import { createProjectStore } from './projects/projectStore.mjs';
import { createContentProjectLifecycle } from './projects/contentProjectLifecycle.mjs';
import { createVideoProjectAssetImporter } from './projects/projectVideoAssetImport.mjs';
import { createImageProjectAssetImporter } from './projects/projectImageAssetImport.mjs';
import { createGeneratedProjectAssetImporter } from './projects/projectGeneratedAssetImport.mjs';
import { createVideoProjectBridge } from './videoProjectBridge.mjs';
import { createVideoWorkbenchStore } from './videoWorkbenchStore.mjs';
import { createVideoWorkbenchRollout } from './videoWorkbenchRollout.mjs';
import { createRetentionService } from './projects/retentionService.mjs';
import { createWorkAssetCascade, registerWorkDeleteCascade } from './workAssetCascade.mjs';
import { decorateOwnedWorkPlayback } from './projects/workMediaPlayback.mjs';
import { createCompositionStore } from './projects/compositionStore.mjs';
import { createCompositionAssetAuthorizer, createCompositionService } from './composition/compositionService.mjs';
import { createPixelLayers } from './composition/layerService.mjs';
import { exportPsd, validatePsdStructure } from './composition/psdExporter.mjs';
import { mountProjectRoutes } from './projects/projectRoutes.mjs';
// 4c183cd4 续命 P-C 1-click 派生升级: 项目级 Clone Service
import { createProjectCloneService } from './projects/cloneService.mjs';
import { mountVideoWorkbenchRoutes } from './videoWorkbenchRoutes.mjs';
import { mountPublicTemplateRoutes, loadDefaultUsageStats } from './templates/publicTemplates.mjs';
import { mountWorkRoutes } from './worksRoutes.mjs';
import {
  createCanvasGenerationStatusHandler,
  createCanvasGenerationService,
  createCanvasRegenerateHandler,
} from './canvasGenerationService.mjs';
import { createCanvasBackgroundCleanPlate } from './canvasBackgroundCleanPlate.mjs';
import { createCanvasLayeringService } from './canvasLayeringService.mjs';
import {
  createCanvasSegmentationPlanTokenService,
  decodeBrowserSegmentationMasks,
} from './canvasSegmentationPlan.mjs';
import { resolveGenerationSize } from './ecommerceEngine/modelCatalog.mjs';
import {
  createEcommerceAssetRouteHandlers,
  createEcommerceAssetUploadService,
} from './ecommerceEngine/assetUpload.mjs';
import {
  createEcommerceExportRouteHandlers,
  createEcommerceExportService,
} from './ecommerceEngine/exportService.mjs';
import { composeAndPersistLongDetail } from './ecommerceEngine/longDetailComposer.mjs';
import {
  buildAssetPlan,
  buildFormalEcommerceQualityPrompt,
  canRetry,
  compileAssetRequest,
  compileCampaignBible,
  createDesignDirectionService,
  createEcommerceOrchestrator,
  createEcommerceProjectLifecycle,
  createEcommerceBilling,
  createEcommerceRouteHandlers,
  createEcommerceStartupRecovery,
  createEcommerceTaskWorkPersistence,
  createProviderAdapter,
  createProviderRouter,
  createModelProviderRouter,
  createNanoBananaProviderAdapter,
  ecommerceFeatureForItem,
  evaluateAsset,
  evaluateSuiteDiversity,
  planRepair,
  repairEcommerceAsset,
  mergeProductFacts,
} from './ecommerceEngine/index.mjs';
import { normalizeStyleReferenceProfile } from './ecommerceEngine/styleReferenceProfile.mjs';
import { createVisualAnalysisService } from './ecommerceEngine/visualAnalysisService.mjs';
import { createVisualAnalysisStore } from './ecommerceEngine/visualAnalysisStore.mjs';
import { createVlmClient, createVlmDeadline } from './ecommerceEngine/vlmClient.mjs';
import { createLegacyVisualAssetMigration } from './ecommerceEngine/legacyVisualAssetMigration.mjs';
import {
  BETA_GUARDED_POST_ROUTES,
  RATE_LIMITED_POST_ROUTES,
  getGenerationRateLimit,
  getGenerationRouteFeature,
} from './generationRouteGuard.mjs';
import {
  buildCanvasTransformPrompt,
  canvasAnnotationSvg,
  cropRectForRatio,
  gridRects,
  gridRectsFromGuides,
  parseVisionTextBlocks,
  resolveGridDimensions,
} from './canvasTools.mjs';
import { segmentUniformBackground } from './canvasSegmentation.mjs';
import { generateCompleteImageSet } from './contentImageGeneration.mjs';
import {
  createVideoGeneration,
  readRequestBuffer,
  sendVideoAsset,
} from './videoGeneration.mjs';
import { createVideoUploadService } from './videoUploadService.mjs';
import { createVideoReconciliation } from './videoReconciliation.mjs';
import { readVideoPlatformFlags } from './config.mjs';
import { createVideoPlanningService } from './videoPlanning.mjs';
import { buildVideoWorkbenchPlan, videoWorkbenchPlanFingerprint } from './videoWorkbenchPlan.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
function safeCanvasClientError(error, fallback = '画布服务暂时不可用，请稍后重试') {
  const message = String(error?.message || '');
  if (/api|key|token|authorization|authentication|vision|provider|\b401\b|\b403\b|\{\s*"?error/i.test(message)) return fallback;
  return error?.status && error.status < 500 ? message : fallback;
}
const envPath = resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const m = line.match(/^\s*([^#\s=]+)\s*=\s*(.+)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/["']/g, '');
  });
  console.log('  → 已加载 .env 配置');
}

// New content generations share the ecommerce point wallet. Legacy content-set
// rows remain readable through the compatibility path in the entitlement store.
if (!process.env.SHUBAO_ACCESS_MODE) process.env.SHUBAO_ACCESS_MODE = 'commercial';
if (!process.env.SHUBAO_CONTENT_BILLING_CURRENCY) {
  process.env.SHUBAO_CONTENT_BILLING_CURRENCY = 'ec_points';
}
if (!process.env.SHUBAO_CONTENT_BILLING_UNITS) {
  process.env.SHUBAO_CONTENT_BILLING_UNITS = '9000';
}

// 作品、任务、用户额度统一使用 SQLite，避免 JSON 文件并发覆盖。
const db = initDB(process.env.SHUBAO_DB_PATH || undefined);
const walletService = createWalletService(db);
const authorizeAccountEmail = email => requireAccountAccess(db, email);
const videoPlatformFlags = readVideoPlatformFlags(process.env);
// The owner-only planning workbench is provider-neutral and safe to expose
// before the live renderer gate. Live rendering stays separately gated so a
// planning session can never be mistaken for a paid generation session.
const videoWorkbenchEnabled = videoPlatformFlags.VIDEO_PLATFORM_P1_WORKBENCH
  || videoPlatformFlags.VIDEO_PLATFORM_P1_PLANNING;
const videoWorkbenchMode = videoPlatformFlags.VIDEO_PLATFORM_P1_WORKBENCH ? 'live' : 'planning';
let videoWorkbenchStore = null;
const videoWorkbenchRollout = createVideoWorkbenchRollout({
  enabled: videoWorkbenchEnabled,
  mode: videoWorkbenchMode,
  authorizeOwner: email => requireAdminAccess(db, email),
});
let videoReconciliation = null;
const adminOperations = createAdminOperations({
  db,
  walletService,
  runtimeStatus: () => ({
    imageQueue: imageGenerationPool.stats(),
    ecommerce: orchestrator.runtimeStats(),
    video: videoGeneration.runtimeStats(),
  }),
  videoOperations: () => videoReconciliation,
  videoWorkbenchMetrics: () => ({
    rollout: videoWorkbenchRollout.status(),
    ...(videoWorkbenchStore?.operationalMetrics?.() || { unavailable: true }),
  }),
});
// 分层毛利门禁启动断言（2026-08-26 终案）：任一 SKU 跌破档位地板即拒绝启动（fail closed）。
assertCatalogMarginGates();
// 支付通道注册表：wechat_qr/alipay 为 unavailable 占位 + 上线开关位；balance 保持 active。
const paymentChannelRegistry = createPaymentChannelRegistry({ env: process.env });
const paymentService = createPaymentService(db, walletService);
// 4c183cd4 续命 P-D commerce paywall: 独立 paywall_transactions 表, 复用 walletService 入账 + grant 幂等键防撞
const paywallService = createPaywallService(db, { env: process.env, walletService });
const contentEntitlements = createContentEntitlements(db, walletService);
const authSessionSecret = resolveAuthSessionSecret({
  envSecret: process.env.AUTH_SESSION_SECRET,
  filePath: process.env.AUTH_SESSION_SECRET_FILE || resolve(__dirname, '.auth-session-secret'),
});
// P1 认证底座：v2 可吊销会话（jti + refresh 轮换）为主，存量 HMAC token 走
// legacy 分支——30 天宽限期内命中即换发新 session（见 authService.mjs）。
const legacyContentSessionTokens = createSessionTokenService({ secret: authSessionSecret });
const authService = createAuthService({ db, secret: authSessionSecret });
const oauthStore = createOAuthStore(db, {
  ensureUserByEmail: (email, options) => authService.ensureUserByEmail(email, options),
});
const authProviderRegistry = createProviderRegistry({ db });
const contentSessionTokens = createDualModeSessionTokens({
  authService,
  legacy: legacyContentSessionTokens,
});
const billingQuoteService = createBillingQuoteService({ secret: authSessionSecret });
const canvasSegmentationPlanTokens = createCanvasSegmentationPlanTokenService({ secret: authSessionSecret });
const contentBilling = createContentBilling({ db, contentEntitlements, walletService });
const {
  beginContentGeneration,
  completeContentGeneration,
  failContentGeneration,
  previewContentGeneration,
} = contentBilling;
const imageDelivery = createImageDelivery({
  assetRoot: resolve(__dirname, 'generated-assets'),
  proxyCacheRoot: resolve(__dirname, 'cache_img'),
});
const PUBLIC_IMAGE_ROOTS = [
  resolve(__dirname, '../public/images'),
  resolve(__dirname, '../dist/images'),
];
const generatedAssetStore = createGeneratedAssetStore({
  directory: resolve(__dirname, 'generated-assets'),
  onPersist: asset => {
    void imageDelivery.prewarmGeneratedVariants(asset.id).catch(() => {});
  },
});
const projectStore = createProjectStore(db);
// 4c183cd4 续命 P-C 1-click 派生升级: 项目级 Clone Service (同风格/变风格/变角度)
const projectCloneService = createProjectCloneService({ db, projectStore });
const contentProjectLifecycle = createContentProjectLifecycle({
  projectStore,
  readGeneratedAsset: assetId => generatedAssetStore.read(assetId),
  importImageAsset: input => importImageAssetToProject(input),
});
const videoProjectBridge = createVideoProjectBridge({ db, projectStore });
videoWorkbenchStore = videoWorkbenchEnabled
  ? createVideoWorkbenchStore({ db, projectStore })
  : null;
// 视频上游路由策略（2026-09 汇率修正后留档，仅注释不改行为）：
// 国内 $ 计价中转（65535 类）的美元余额已实证按人民币 ×1 核算，Seedance 类视频折算单条成本
// 相对 IP233 按条价（¥5.07/720p）低约 7 倍。建议路由权重：国内中转优先、IP233 作按条兜底。
// 当前代码尚无动态权重/优先级机制（产品与上游为静态绑定），接入权重属行为改动，需另行评审；
// 届时 MINIMAX/IP233 的 baseUrl 与 key 装配处即本段下方配置。
const videoGeneration = createVideoGeneration({
  db,
  walletService,
  quoteService: billingQuoteService,
  upsertWork,
  assetRoot: resolve(__dirname, 'video-assets'),
  apiKey: process.env.IP233_VIDEO_API_KEY || process.env.VIDEO_API_KEY || '',
  minimaxApiKey: process.env.MINIMAX_VIDEO_API_KEY || '',
  baseUrl: process.env.IP233_VIDEO_BASE_URL || 'https://api-new.ip233.com/v1',
  minimaxBaseUrl: process.env.MINIMAX_VIDEO_BASE_URL || process.env.IP233_VIDEO_BASE_URL || 'https://api-new.ip233.com/v1',
  allowHiddenProducts: process.env.MINIMAX_VIDEO_PUBLIC_ENABLED === 'true',
  assetSigningSecret: authSessionSecret,
  projectBridge: videoPlatformFlags.VIDEO_PLATFORM_PROJECT_BRIDGE ? videoProjectBridge : null,
  ownerReads: videoPlatformFlags.VIDEO_PLATFORM_OWNER_READS,
  readNewState: videoPlatformFlags.VIDEO_PLATFORM_READ_NEW_STATE,
  validateWorkbenchPlanApproval: async ({ ownerEmail, projectId, planHash, input }) => {
    if (!videoWorkbenchStore || typeof videoWorkbenchStore.getGenerationPlanApproval !== 'function') return false;
    const approval = videoWorkbenchStore.getGenerationPlanApproval({ ownerEmail, projectId });
    if (!approval || approval.planHash !== planHash) return false;
    const plan = buildVideoWorkbenchPlan(videoWorkbenchStore.listWorkbench({ ownerEmail, projectId }), {
      productId: input?.productId,
      mode: input?.workbenchMode || input?.mode,
      resolution: input?.resolution,
      generateAudio: input?.generateAudio !== false,
    });
    return plan.status === 'ready' && videoWorkbenchPlanFingerprint(plan) === planHash;
  },
});
const importVideoAssetToProject = createVideoProjectAssetImporter({
  projectStore,
  readVideoAsset: videoGeneration.readAsset,
});
let imageProjectAssetImporter = null;
const importImageAssetToProject = input => {
  imageProjectAssetImporter ||= createImageProjectAssetImporter({
    projectStore,
    assetUploadService: ecommerceAssetUploadService,
    readGeneratedAsset: generatedAssetStore.read,
  });
  return imageProjectAssetImporter(input);
};
const registerGeneratedAssetToProject = createGeneratedProjectAssetImporter({
  projectStore,
  readGeneratedAsset: generatedAssetStore.read,
});
const videoUploadService = createVideoUploadService({
  db,
  directory: resolve(__dirname, 'video-upload-staging'),
  importAsset: input => videoGeneration.importUploadedAsset(input),
});
videoReconciliation = createVideoReconciliation({
  db,
  reconcile: input => videoGeneration.reconcileOperations(input),
  cleanupUploads: input => videoUploadService.cleanExpiredUploads(input),
  readAttempts: videoPlatformFlags.VIDEO_PLATFORM_ATTEMPTS,
  readOutbox: videoPlatformFlags.VIDEO_PLATFORM_OUTBOX,
  readNewState: videoPlatformFlags.VIDEO_PLATFORM_READ_NEW_STATE,
  actions: {
    recheck: jobId => videoGeneration.recheckJob(jobId),
    replayProjection: jobId => videoGeneration.replayProjection(jobId),
    confirmNotSubmitted: (jobId, input) => videoGeneration.confirmNotSubmitted(jobId, input),
    retryConfirmedNotSubmitted: jobId => videoGeneration.retryConfirmedNotSubmitted(jobId),
    quarantine: (jobId, input) => videoGeneration.quarantineJob(jobId, input),
  },
});
const videoReconciliationSweep = setInterval(() => {
  void videoReconciliation.run({ limit: 50 }).catch(error => {
    console.error('[video-reconciliation] 自动恢复失败:', error?.message || error);
  });
}, 30_000);
videoReconciliationSweep.unref?.();
const persistGeneratedAsset = createGeneratedAssetPersister({ generatedAssetStore });
const runBilledContentSse = createBilledSseRunner({
  beginContentGeneration,
  completeContentGeneration,
  failContentGeneration,
  onStart: ({ ownerEmail, begun, input }) => contentProjectLifecycle.begin({
    ownerEmail,
    generationId: begun.generationId,
    mode: begun.mode,
    referenceGroups: input?.referenceGroups,
  }),
  prepareDelivery: ({ ownerEmail, delivery, context }) => contentProjectLifecycle.prepareResult({
    ownerEmail,
    context,
    delivery,
  }).then(project => ({
    context: project,
    delivery: {
      ...delivery,
      projectId: project.projectId,
      projectKind: project.projectKind,
      sourceVersionId: project.sourceVersionId,
      resultVersionId: project.resultVersionId,
      projectAssetRefs: project.projectAssetRefs,
    },
  })),
  onComplete: ({ ownerEmail, completed, context }) => completed.jobStatus === 'completed'
    ? contentProjectLifecycle.complete({ ownerEmail, context })
    : contentProjectLifecycle.review({ ownerEmail, context }),
  onFailure: ({ ownerEmail, context }) => contentProjectLifecycle.terminate({ ownerEmail, context }),
  onRecovery: ({ ownerEmail, begun }) => contentProjectLifecycle.reconcile({
    ownerEmail,
    generationId: begun.generationId,
    billing: begun.billing,
    delivery: begun.delivery,
  }),
});
const runContentPreviewSse = createPreviewSseRunner({ previewContentGeneration });
const ecommerceJobs = createGenerationJobs(resolve(__dirname, 'works.db'));
const canvasGenerationStore = createCanvasGenerationStore(db);
const retentionService = createRetentionService({
  db,
  assetStore: {
    remove(assetId) {
      if (!/^[a-f0-9]{64}\.(?:jpg|png|webp)$/i.test(String(assetId || ''))) return;
      const filePath = resolve(__dirname, 'generated-assets', assetId);
      try { fs.unlinkSync(filePath); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
    },
  },
});
// 作品删除联动素材回收（WORK_ASSET_CASCADE=on 默认；off 时 softDeleteWork 保持历史行为）。
registerWorkDeleteCascade(createWorkAssetCascade({ db, retention: retentionService }));
// cache_img 外链代理缓存 TTL 清理：跟随每日 retention sweep 调度（默认 72h，PROXY_CACHE_TTL_HOURS 可调）。
imageDelivery.pruneProxyCache().then(result => {
  if (result.deletedFiles > 0) console.log('[proxy-cache] 启动清理过期缓存文件 ' + result.deletedFiles + ' 个，释放 ' + (result.deletedBytes / (1024 * 1024)).toFixed(1) + ' MB');
}).catch(error => console.warn('[proxy-cache] startup prune failed:', error?.message || error));
try { retentionService.sweep(); } catch (error) { console.warn('[retention] startup sweep failed:', error.message); }
const retentionSweep = setInterval(() => {
  imageDelivery.pruneProxyCache().catch(error => console.warn('[proxy-cache] prune failed:', error?.message || error));
  try { retentionService.sweep(); } catch (error) { console.warn('[retention] sweep failed:', error.message); }
}, 24 * 60 * 60 * 1000);
retentionSweep.unref();
const compositionStore = createCompositionStore(db);
const compositionAssetAuthorizer = createCompositionAssetAuthorizer({ db });
const compositionService = createCompositionService({
  compositionStore,
  generatedAssetStore,
  assetAuthorizer: compositionAssetAuthorizer,
});
const legacyWorksPath = resolve(__dirname, 'works.json');
if (getWorkCount() === 0 && fs.existsSync(legacyWorksPath)) {
  try {
    const legacyWorks = JSON.parse(fs.readFileSync(legacyWorksPath, 'utf8'));
    let migratedWorks = 0;
    for (const work of legacyWorks) {
      upsertWork({ ...work, _saveKey: work._saveKey || `legacy_${work.id || crypto.randomUUID()}` });
      migratedWorks++;
    }
    console.log(`  → 已迁移 ${migratedWorks} 条旧作品到 SQLite`);
  } catch (error) {
    console.warn('  → works.json 迁移跳过:', error.message);
  }
}

// ── 用户额度持久化 ──
const USERS_FILE = resolve(__dirname, 'users.json');
// 首次升级时把旧 JSON 额度导入 SQLite；旧文件保留作为只读回退，不覆盖用户数据。
if (Object.keys(getAllUsers()).length === 0 && fs.existsSync(USERS_FILE)) {
  try {
    const legacyUsers = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    for (const [email, credits] of Object.entries(legacyUsers || {})) {
      if (Number(credits) > 0) addUserCredits(email, Number(credits));
    }
    migrateLegacyUserCredits(db);
    console.log(`  → 已迁移 ${Object.keys(legacyUsers || {}).length} 个旧用户额度到 SQLite`);
  } catch (error) {
    console.warn('  → users.json 迁移跳过:', error.message);
  }
}
function loadUsers() {
  return getAllUsers();
}
function saveUsers(users) {
  for (const [email, credits] of Object.entries(users || {})) {
    const current = getUserCredits(email);
    const delta = Number(credits) - current;
    if (delta > 0) addUserCredits(email, delta);
    else if (delta < 0) consumeUserCredit(email, -delta);
  }
}

const app = express();
app.set('trust proxy', 'loopback');
app.disable('x-powered-by');

const defaultAllowedOrigins = [
  'https://shuimg.cn',
  'https://www.shuimg.cn',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];
const configuredAllowedOrigins = String(process.env.SHUBAO_ALLOWED_ORIGINS || '')
  .split(/[\s,]+/)
  .map(origin => origin.trim().replace(/\/$/, ''))
  .filter(origin => /^https?:\/\//i.test(origin));
const allowedOrigins = new Set(configuredAllowedOrigins.length ? configuredAllowedOrigins : defaultAllowedOrigins);

// Keep browser-facing hardening centralized so API, static files and health
// responses share the same baseline. CSP stays intentionally configurable:
// the editor uses inline styles and provider-hosted image URLs.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// 套图方案（design-directions）降级遥测：演练(2026-08-26)发现 PLANNER_TIMEOUT 高频
// 降级只留日志、不可观测，这里进程内计数并随 /health 暴露，供告警与巡检使用。
const designDirectionTelemetry = {
  served: 0,
  plannerFallbacks: 0,
  degraded: 0,
  lastFallbackAt: null,
  lastDegradedAt: null,
};

// 轻量健康检查：供 PM2、反向代理和部署脚本判断进程是否真的能响应。
app.get('/health', (req, res) => {
  const ready = !shuttingDown;
  res.status(ready ? 200 : 503).json({
    ok: ready,
    ready,
    service: 'shubao',
    pid: process.pid,
    uptime: Math.round(process.uptime()),
    imageQueue: imageGenerationPool.stats(),
    ecommerceRuntime: orchestrator.runtimeStats(),
    designDirections: { ...designDirectionTelemetry },
  });
});

// HTTP → HTTPS 跳转（仅生产环境 shuimg.cn 且有 SSL 证书时启用）
// 开发环境（localhost / IP 访问）不跳转，避免本地无证书导致死循环
app.use((req, res, next) => {
  const host = req.headers.host || '';
  const isShuimg = host.indexOf('shuimg') !== -1;
  const isSecure = req.secure;
  const isLocalDev = host.indexOf('localhost') !== -1 || /^\d+\.\d+\.\d+\.\d+/.test(host);
  // 仅在非本地开发环境 且 有 shuimg 域名 且 非 API 路径 且 非 HTTPS 时跳转
  if (isShuimg && !isLocalDev && !req.path.startsWith('/api/') && !isSecure) {
    const target = 'https://' + host.replace(/:[0-9]+$/, '') + req.url;
    console.log('[301] → ' + target);
    return res.redirect(301, target);
  }
  next();
});

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin.replace(/\/$/, ''))) return callback(null, true);
    return callback(null, false);
  },
  maxAge: 600,
}));

function captureWebhookBody(req, _res, buffer) {
  if (req.originalUrl?.startsWith('/api/billing/webhooks/')) {
    req.rawBody = Buffer.from(buffer);
  }
}

// ── Body 大小分层（2026-08-26 收紧）：全局默认 100kb，仅 base64 图片直传路由放开到 15mb ──
// 大体解析器必须先于全局注册：express.json 解析后写入 req._body，后续同名解析器自动跳过。
// 名单口径：路由 body 中存在按设计可传 data:image base64 的字段（imageInput DATA_IMAGE_RE 直读）。
const LARGE_BODY_ROUTES = new Set([
  '/api/analyze',              // 插件 base64Images（≤3张竞品图）
  '/api/bookmarklet-extract',  // 插件 base64Images
  '/api/ec-temp-upload',       // images[] 全 base64 data URI
  '/api/generate',             // images/reference 兼容 data URI
  '/api/plog-generate',        // refImage
  '/api/canvas/transform',     // image_url
  '/api/canvas/regenerate',    // image_url
  '/api/canvas/segmentation-plan', // image_url
  '/api/canvas/analyze-layers',// image_url
  '/api/canvas/ocr',           // image_url
  '/api/canvas/replace-text',  // image_url
  '/api/remove-bg',            // image_url
  '/api/reverse-prompt',       // image_url
  '/api/ecommerce/auto-recognize', // refShots
  '/api/ecommerce/stitch-long',    // imageUrls 兼容 data URI
  '/api/ecommerce/assets',         // asset.data 为 data:image base64（探针/上传 JSON 走此路径）
]);
const largeJsonBodyParser = express.json({ limit: '15mb', verify: captureWebhookBody });
for (const largeBodyRoute of LARGE_BODY_ROUTES) {
  app.use(largeBodyRoute, largeJsonBodyParser);
}
app.use(express.json({ limit: '100kb', verify: captureWebhookBody }));
app.use(express.urlencoded({ limit: '100kb', extended: false, verify: captureWebhookBody }));

app.get('/api/generated-assets/:id', async (req, res) => {
  const asset = await imageDelivery.readGeneratedVariant(
    req.params.id,
    req.query.variant || 'full',
    req.query.format || 'webp',
  );
  if (!asset) return res.status(404).end('generated asset not found');
  res.setHeader('Content-Type', asset.contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(asset.buffer);
});

// ── IP 速率限制（止血：防止 API 被盗刷 LLM 额度）──
// 对消耗 LLM 额度的生图路由限 10 次/分钟/IP
const rateLimitStore = new Map();         // key: `${email-or-ip}:${minuteBucket}` -> count
const CONTENT_PREVIEW_ROUTES = new Set(['/api/generate', '/api/plog-generate']);
const SIGNED_GENERATION_ROUTES = new Set([
  ...CONTENT_PREVIEW_ROUTES,
  '/api/regenerate-image',
  '/api/regenerate-text',
  '/api/analyze',
  '/api/extract-product-link',
  '/api/generate-ecommerce',
  '/api/ecommerce/auto-recognize',
  '/api/ecommerce/design-directions',
  // 视频方案分析必须走会话签名分支；落入 body-email 旧分支会对已登录用户
  // 返回 ACCOUNT_NOT_ALLOWED「当前账号暂时无法使用此功能」。
  '/api/video/plans',
  '/api/polish-ec-text',
  '/api/canvas/regenerate',
  '/api/canvas/transform',
  '/api/canvas/segmentation-plan',
  '/api/canvas/analyze-layers',
  '/api/canvas/ocr',
  '/api/canvas/replace-text',
  '/api/canvas/pixel-layers',
  '/api/canvas/psd-export',
  '/api/reverse-prompt',
  '/api/remove-bg',
  '/api/extension/analyze',
  '/api/extension/regenerate',
]);
function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
function normalizeGuardedPath(path) {
  const value = typeof path === 'string' && path ? path : '/';
  if (value === '/') return value;
  return (value.replace(/\/+$/, '') || '/').toLowerCase();
}
function rateLimiter(req, res, next) {
  const ip = getClientIp(req);
  const identity = req._userEmail || ip;
  const { max, windowMs } = getGenerationRateLimit(req._userEmail);
  const bucket = Math.floor(Date.now() / windowMs);
  const key = `${identity}:${bucket}`;
  const count = (rateLimitStore.get(key) || 0) + 1;
  rateLimitStore.set(key, count);
  // 清理过期桶（简单 GC）
  if (rateLimitStore.size > 10000) {
    for (const k of rateLimitStore.keys()) {
      const b = Number(k.split(':').pop());
      if (bucket - b > 5) rateLimitStore.delete(k);
    }
  }
  if (count > max) {
    console.warn(`[rate-limit] ${identity} 超限 ${count}/${max} on ${req.path}`);
    return res.status(429).json({ error: `请求过于频繁，请稍后再试（每分钟限 ${max} 次生成）` });
  }
  next();
}

// 所有会调用生图、识图或 LLM 上游的 POST 路由统一经过服务端权限与限流边界。
// 权限先于限流执行，避免匿名请求占用受邀用户的限流桶。
app.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  const guardedPath = normalizeGuardedPath(req.path);
  const continueWithRateLimit = () => (
    RATE_LIMITED_POST_ROUTES.has(guardedPath) ? rateLimiter(req, res, next) : next()
  );
  if (BETA_GUARDED_POST_ROUTES.has(guardedPath)) {
    return betaAccessMiddleware(req, res, continueWithRateLimit, guardedPath);
  }
  return continueWithRateLimit();
});

// legacy token 命中后换发的 v2 会话通过响应头旁路下发（客户端可选择性采用）。
app.use((req, res, next) => {
  const renewal = req._sessionRenewal;
  if (renewal?.accessToken) {
    res.setHeader('x-shubao-access-token', renewal.accessToken);
    res.setHeader('x-shubao-refresh-token', renewal.refreshToken || '');
    res.setHeader('x-shubao-session-renewed', '1');
  }
  next();
});

function betaAccessMiddleware(req, res, next, guardedPath = normalizeGuardedPath(req.path)) {
  if (CONTENT_PREVIEW_ROUTES.has(guardedPath) && req.body?.preview === true) {
    req._contentPreview = true;
    return next();
  }
  if (SIGNED_GENERATION_ROUTES.has(guardedPath)) {
    try {
      req._userEmail = authenticateContentRequest(req, {
        sessionTokens: contentSessionTokens,
        authorizeEmail: authorizeAccountEmail,
      });
      const feature = getGenerationRouteFeature(guardedPath);
      const featureAccess = feature ? requireFeatureAccess(db, req._userEmail, feature) : null;
      if (featureAccess && !featureAccess.ok) {
        return res.status(featureAccess.status).json({
          error: featureAccess.error,
          code: featureAccess.code,
          feature,
        });
      }
      return next();
    } catch (error) {
      const mapped = contentBillingHttpError(error);
      return res.status(mapped.status).json(mapped.body);
    }
  }
  // P1 认证底座：废除 req.body.email 自报授权，其余受限 POST 路由同样
  // 只接受签名会话（v2 可吊销会话或宽限期内的存量 HMAC legacy token）。
  try {
    req._userEmail = authenticateContentRequest(req, {
      sessionTokens: contentSessionTokens,
      authorizeEmail: authorizeAccountEmail,
    });
  } catch (error) {
    const mapped = contentBillingHttpError(error);
    return res.status(mapped.status).json(mapped.body);
  }
  next();
}

mountBillingRoutes(app, {
  walletService,
  paymentService,
  paymentChannelRegistry,
  quoteService: billingQuoteService,
  authenticateOwner(req) {
    return authenticateContentRequest(req, {
      sessionTokens: contentSessionTokens,
      authorizeEmail: authorizeAccountEmail,
    });
  },
  // 4c183cd4 续命 P2：账务域内的 admin 鉴权（/api/billing/cost-summary 用）
  authorizeAdmin(email) {
    return requireAdminAccess(db, email);
  },
  // 4c183cd4 续命 P2：复用 adminOperations.costSummary，避免再开第二条 SQL 路径
  costSummary: adminOperations.costSummary,
});

// 4c183cd4 续命 P-D commerce paywall: 微信/支付宝 sandbox 真接入, 4 档定价 + 月卡 2 档
// 鉴权: 跟 mountBillingRoutes 同源 (authenticateContentRequest); admin 走 authorizeAdmin
// 账务: paywallService 内部 grant, 幂等键前缀 paywall-grant:txId 防与主 paymentService 撞键
mountPaywallRoutes(app, {
  paywallService,
  authenticateOwner(req) {
    return authenticateContentRequest(req, {
      sessionTokens: contentSessionTokens,
      authorizeEmail: authorizeAccountEmail,
    });
  },
  authorizeAdmin(email) {
    return requireAdminAccess(db, email);
  },
});

app.use('/api/vision', visionRouter);

// 4c183cd4 续命 P1 TTS 口播路由 (provider-neutral 桥, 跟 modlens vision 桥同模式)
// 鉴权: authenticateContentRequest (v2 可吊销会话 + 存量 HMAC 宽限期), 跟 visionRouter / billing 路由同源.
// 真实账务 (hold/settle/release) 由调用方决定是否接入 walletService, 本桥只算 cost + 调 adapter.
mountTTSRoutes(app, {
  authenticateOwner(req) {
    return authenticateContentRequest(req, {
      sessionTokens: contentSessionTokens,
      authorizeEmail: authorizeAccountEmail,
    });
  },
});

// 4c183cd4 续命 P-G 画布 1-click chain (4 步: 文案->首帧->视频->音轨+字幕)
// 鉴权: 跟 TTS / visionRouter 同源 (authenticateContentRequest).
// 账务: 本路由只算 cost (costBasis 4 步累计), 真实 hold/settle 由上层付费链路 (ec-cron / paid-task) 接入 walletService.
mountChainRoutes(app, {
  authenticate: req => authenticateContentRequest(req, {
    sessionTokens: contentSessionTokens,
    authorizeEmail: authorizeAccountEmail,
  }),
});

// 4c183cd4 续命 P-F 孪生体 2.0 矩阵 (Web / 小程序 / API) 三处真实现
// 鉴权同 chain (authenticateContentRequest). 不需要 db/projectStore, 纯纯孪生链.
// 三处入口: /api/twin/web/* + /api/twin/miniprogram/* + /api/twin/api/*
// 公共端点: /api/twin/matrix/health + /api/twin/capabilities + /api/twin/compliance/legals
mountTwinMatrixRoutes(app, {
  authenticate: req => authenticateContentRequest(req, {
    sessionTokens: contentSessionTokens,
    authorizeEmail: authorizeAccountEmail,
  }),
});

// 4c183cd4 续命 P-F 数据回流画布 (薯包独门 3/3)
// 鉴权同 twin (authenticateContentRequest). 内存 ring buffer 10000 条, 进程重启清空.
// 路由: /api/canvas/feedback/{summary,event,aggregate}
import { mountCanvasFeedbackRoutes } from './extensions/canvasFeedback.mjs';
mountCanvasFeedbackRoutes(app, {
  authenticate: req => authenticateContentRequest(req, {
    sessionTokens: contentSessionTokens,
    authorizeEmail: authorizeAccountEmail,
  }),
});

// 4c183cd4 续命 P0-D 飞书可视化 webhook 入站路由
import { handleFeishuChallenge, dispatchFeishuEvent } from './feishu/webhook.mjs';
app.get('/feishu/events', (req, res) => {
  const verificationToken = process.env.FEISHU_BOT_VERIFICATION_TOKEN || '';
  const result = handleFeishuChallenge(verificationToken, req.query);
  if (result) return res.json(result);
  res.status(401).json({ error: 'invalid verification token' });
});
app.post('/feishu/events', express.raw({ type: '*/*' }), (req, res) => {
  // 简化: 假定 body 是 JSON (实际生产应验签 + 解密)
  try {
    const event = JSON.parse(req.body.toString('utf-8'));
    const result = dispatchFeishuEvent(event, {
      eventCallback: (e) => { /* TODO: 写 taskProgress / exception 卡 */ return 'ok'; },
    });
    res.json({ code: 0, msg: 'ok', data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
const adminRouteHandlers = mountAdminRoutes(app, {
  operations: adminOperations,
  authenticateOwner(req) {
    return authenticateContentRequest(req, {
      sessionTokens: contentSessionTokens,
      authorizeEmail: authorizeAccountEmail,
    });
  },
  authorizeAdmin(email) {
    return requireAdminAccess(db, email);
  },
  // 续命 P2: 用户列表/成本核算 admin 也能访问, 走 requireAccountAccess 拿完整 access (含 role)
  authorizeAccount(email) {
    return requireAccountAccess(db, email);
  },
});

// P2 账号体系：adminOperations 之前在 authService 之前实例化，
// 现把 auth 域句柄 late-bind 进去，让 listSessions/revokeSession 可用。
adminOperations.bindAuthService(authService);
// 4c183cd4 续命 P-D commerce paywall: 把 paywallService 注入 adminOperations 用于 stats/refund/list
adminOperations.bindPaywallService(paywallService);

mountProjectRoutes(app, {
  projectStore,
  // 4c183cd4 续命 P-C 1-click 派生升级
  cloneService: projectCloneService,
  importVideoAsset: importVideoAssetToProject,
  importImageAsset: importImageAssetToProject,
  registerGeneratedAsset: registerGeneratedAssetToProject,
  resolveAssetPlaybackUrl({ asset, ownerEmail, req }) {
    const match = /^\/api\/video\/(?:assets|media)\/([^/?#]+)$/i.exec(String(asset?.stableUrl || '').trim());
    if (!match) return '';
    const proto = String(req?.headers?.['x-forwarded-proto'] || req?.protocol || 'https').split(',')[0].trim();
    const host = typeof req?.get === 'function' ? req.get('host') : req?.headers?.host;
    const publicBaseUrl = host ? `${proto}://${host}` : '';
    return videoGeneration.playbackUrlForAsset(decodeURIComponent(match[1]), ownerEmail, publicBaseUrl);
  },
  authenticateOwner(req) {
    return authenticateContentRequest(req, {
      sessionTokens: contentSessionTokens,
      authorizeEmail: authorizeAccountEmail,
    });
  },
});

// 4c183cd4 续命 P3 模板社区: 公开模板目录 + 复制到画布
const publicTemplateUsageStats = loadDefaultUsageStats({ rootDir: __dirname });
mountPublicTemplateRoutes(app, {
  projectStore,
  usageStats: publicTemplateUsageStats,
  authenticateOwner(req) {
    return authenticateContentRequest(req, {
      sessionTokens: contentSessionTokens,
      authorizeEmail: authorizeAccountEmail,
    });
  },
  runtime: { log: console.log.bind(console) },
});

mountVideoWorkbenchRoutes(app, {
  enabled: videoWorkbenchEnabled,
  planningOnly: videoWorkbenchRollout.planningOnly,
  store: videoWorkbenchStore,
  authorizeCohort: videoWorkbenchRollout,
  playbackUrlForAsset({ assetId, ownerEmail, req }) {
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
    const host = typeof req.get === 'function' ? req.get('host') : req.headers.host;
    const publicBaseUrl = host ? `${proto}://${host}` : '';
    return videoGeneration.playbackUrlForAsset(assetId, ownerEmail, publicBaseUrl);
  },
  authenticateOwner(req) {
    return authenticateContentRequest(req, {
      sessionTokens: contentSessionTokens,
      authorizeEmail: authorizeAccountEmail,
    });
  },
});

app.get('/api/account/access', (req, res) => {
  try {
    const ownerEmail = authenticateContentRequest(req, {
      sessionTokens: contentSessionTokens,
      authorizeEmail: authorizeAccountEmail,
    });
    const account = getAccountAccess(db, ownerEmail);
    return res.json({ account });
  } catch (error) {
    const mapped = contentBillingHttpError(error);
    return res.status(mapped.status).json(mapped.body);
  }
});

function sendContentInputError(res) {
  const error = new Error('请输入内容');
  error.code = 'CONTENT_INPUT_INVALID';
  const mapped = contentBillingHttpError(error);
  return res.status(mapped.status).json({ ...mapped.body, error: '请输入内容' });
}

// 生产模式：serve 前端构建产物
const distPath = resolve(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use((req, res, next) => {
    if (req.path === '/') res.set('Cache-Control', 'no-store, must-revalidate');
    next();
  });
  // 指纹化构建产物可长期缓存；/images、/gallery 素材更新依赖发布或 ?v= 查询串，
  // 给予一周强缓存 + 过期后协商（etag/Last-Modified 仍由 express.static 提供）。
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      const normalized = String(filePath).replaceAll('\\', '/');
      if (normalized.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (/\/(?:images|gallery)\//.test(normalized)) {
        res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
      }
    },
  }));
  console.log(`  → 静态文件: ${distPath}`);
}

const PORT = process.env.PORT || 3001;

// 临时上传只用于一次分析，定期回收，避免长期运行后磁盘持续膨胀。
const TEMP_UPLOAD_CLEANUP_MS = 60 * 60 * 1000;
const TEMP_UPLOAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const tempUploadCleanup = setInterval(() => {
  const dir = resolve(__dirname, 'temp_uploads');
  if (!fs.existsSync(dir)) return;
  const cutoff = Date.now() - TEMP_UPLOAD_MAX_AGE_MS;
  for (const file of fs.readdirSync(dir)) {
    const path = join(dir, file);
    try {
      if (fs.statSync(path).mtimeMs < cutoff) fs.unlinkSync(path);
    } catch (e) {
      console.warn('[temp-upload] cleanup failed:', file, e.message);
    }
  }
}, TEMP_UPLOAD_CLEANUP_MS);
tempUploadCleanup.unref();

// 全局未捕获异常处理：进程状态不再被错误污染，交给 PM2 重新拉起。
process.on('uncaughtException', err => {
  console.error('‼️ 未捕获异常:', err.message, err.stack?.split('\n').slice(0,5).join('\n'));
  process.exitCode = 1;
  setImmediate(() => process.exit(1));
});
process.on('unhandledRejection', err => {
  console.error('‼️ 未处理Promise拒绝:', err?.message || err);
  process.exitCode = 1;
  setImmediate(() => process.exit(1));
});

// ============================================================
// API 配置
// ============================================================

/* async 路由包装器：Express 4 不自带 async 错误捕获 */
const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const LLM_KEY = process.env.LLM_API_KEY || '';
const LLM_BASE = (process.env.LLM_BASE_URL || '').replace(/\/+$/, '');
const LLM_MODEL = process.env.LLM_MODEL || 'claude-sonnet-4-6';
const IMG_KEY = process.env.IMAGE_API_KEY || '';
const IMG_BASE = (process.env.IMAGE_PRIMARY_BASE_URL || 'https://task-api-1-cn.65535.space').replace(/\/+$/, '');
const IMG_OVERFLOW_BASE = (process.env.IMAGE_OVERFLOW_BASE_URL || '').replace(/\/+$/, '');
const IMG_LEGACY_BASE = (process.env.IMAGE_BASE_URL || '').replace(/\/+$/, '');
const IMG_MODEL = process.env.IMAGE_MODEL || 'gpt-image-2';
const IMG_AUTH_STRATEGY = String(process.env.IMAGE_AUTH_STRATEGY || 'bearer').trim().toLowerCase();
const IMG_PROVIDER_PROTOCOL = String(process.env.IMAGE_PROVIDER_PROTOCOL || 'native-tasks').trim().toLowerCase();
const NANO_BANANA_KEY = process.env.NANO_BANANA_API_KEY || '';
const NANO_BANANA_BASE = (process.env.NANO_BANANA_BASE_URL || 'https://api.change2pro.com').replace(/\/+$/, '');
const NANO_BANANA_FLASH_MODEL = process.env.NANO_BANANA_FLASH_MODEL || 'gemini-2.5-flash-image';
const NANO_BANANA_PRO_MODEL = process.env.NANO_BANANA_PRO_MODEL || 'gemini-3-pro-image';
// 演练加固(2026-08-26)：生图网关是否至少配置了一条可用路由。
// 未配置时必须在受理前拒绝，否则任务会以 retryable 方式无限重试、
// 用户积分被无限期冻结且前端永远等待（本地 dev 实测复现）。
const ecommerceImageProviderReady = () => Boolean((IMG_BASE && IMG_KEY) || NANO_BANANA_KEY);

// Vision API — 商品图和参考图分析
const MINI_KEY = process.env.MINI_API_KEY || '';
const MINI_BASE = (process.env.MINI_BASE_URL || '').replace(/\/+$/, '');
const MINI_MODEL = process.env.MINI_MODEL || 'gpt-5.6-luna';
const DESIGN_DIRECTION_SERVER_TIMEOUT_MS = 75_000;

// ============================================================
// LLM 调用（兼容 OpenAI 格式，自动重试 + 双通道降级）
// ============================================================
async function callLLM(systemPrompt, userContent, options = {}) {
  const { temperature = 0.6, maxTokens = 4000 } = options;
  const errors = [];

  if (LLM_BASE) {
    const url = `${LLM_BASE}/v1/chat/completions`;
    const body = {
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature,
      max_tokens: maxTokens,
      "通用": `视觉风格：小红书信息图风格，干净明亮的浅色背景
每页内容：标题+核心信息点+配图，图文结合
布局：封面标题+主视觉，P2-P7按内容逻辑排列（清单/步骤/对比/场景），P8总结
配色：根据内容氛围选色，保持柔和
禁止：❌文字堆砌 ❌无配图 ❌版面太空`,
};
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_KEY}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
      }
      const errText = await res.text().catch(() => '');
      console.warn('OpenAI LLM:', res.status, errText.slice(0, 200));
      if (res.status === 503) {
        await new Promise(r => setTimeout(r, 3000));
        const retryRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_KEY}` },
          body: JSON.stringify(body),
        });
        if (retryRes.ok) {
          const data = await retryRes.json();
          return data.choices?.[0]?.message?.content || '';
        }
      }
      errors.push(`OpenAI ${res.status}: ${errText.slice(0, 100)}`);
    } catch (e) {
      errors.push(`OpenAI error: ${e.message}`);
    }
  } else {
    errors.push('未配置 LLM API（LLM_BASE_URL）');
  }

  if (MINI_KEY && MINI_BASE) {
    try {
      return await callMiniLLM(systemPrompt, [], String(userContent || ''), options);
    } catch (error) {
      errors.push(`Vision gateway fallback: ${error.message}`);
    }
  }

  throw new Error(`LLM 调用失败: ${errors.join(' | ')}`);
}

// ============================================================
// LLM Vision 调用 — 主模型看图分析（多图，支持 Claude / GPT）
// ============================================================
async function callLLMWithVision(systemPrompt, images, userPrompt) {
  if (!LLM_KEY || !LLM_BASE) throw new Error('LLM API 未配置');
  const url = `${LLM_BASE}/v1/chat/completions`;
  const content = [{ type: 'text', text: userPrompt }];
  for (const img of images.slice(0, 3)) {
    if (img) content.push({ type: 'image_url', image_url: { url: img } });
  }
  const body = {
    model: LLM_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content },
    ],
    max_tokens: 1500,
    temperature: 0.3,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Vision API error ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ============================================================
// Vision 调用 — 商品图和参考图分析
// ============================================================
async function callMiniLLM(systemPrompt, imageUrl, userPrompt, { signal, maxTokens = 1500, temperature = 0.3 } = {}) {
  const images = imageUrl
    ? (Array.isArray(imageUrl) ? imageUrl : [imageUrl]).filter(Boolean)
    : [];
  return createEcommerceVlmClient().completeText({
    systemPrompt,
    userPrompt: userPrompt || (images.length ? '分析这些图片' : '请处理这段内容'),
    images,
    signal,
    maxTokens: Math.min(Math.max(Number(maxTokens) || 1500, 256), 12000),
    temperature: Math.min(Math.max(Number(temperature) || 0.3, 0), 1),
  });
}

/**
 * 分析参考图 — 用 GPT-4o mini Vision 提取风格/颜色/光线/材质
 * 支持分批分析大量图片（每批最多5张），最终合并结果
 * @param {string[]} imageUrls - 参考图 URL 或 data URL
 * @returns {Promise<Object>} 分析结果
 */
async function analyzeReferenceImages(imageUrls, { signal } = {}) {
  if (!imageUrls?.length) return null;
  const systemPrompt = `你是一个电商产品图片分析专家。分析这些参考图，提取以下信息，用 JSON 格式返回（只返回 JSON，不要其他文字）：
{
  "product_shape": "产品形状描述",
  "dominant_colors": ["主色1", "主色2", ...],
  "style_vibe": "整体风格感觉（极简/奢华/自然/科技感/温馨等）",
  "lighting": "光线类型（柔光/硬光/侧光/顶光/自然光等）",
  "background": "背景描述",
  "material_texture": "材质质感描述",
  "composition": "构图方式（居中/三分法/特写/俯拍等）",
  "color_temperature": "色温（暖/冷/中性）",
  "key_visual_elements": ["关键视觉元素1", "元素2", ...]
}
多看几张图，综合提取共通的视觉特征。如果有多张图，统一描述它们的共性。`

  const BATCH_SIZE = 5; // 每批最多5张（API限制）
  const batches = [];
  for (let i = 0; i < imageUrls.length; i += BATCH_SIZE) {
    batches.push(imageUrls.slice(i, i + BATCH_SIZE));
  }

  try {
    if (batches.length === 1) {
      // 单批：直接分析
      const result = await callMiniLLM(systemPrompt, batches[0],
        `综合这些商品图片的视觉特征，输出统一的视觉报告 JSON。共 ${batches[0].length} 张。`,
        { signal });
      const match = result.match(/\{[^]*\}/);
      if (match) return JSON.parse(match[0]);
      return null;
    }

    // 多批：分批分析后合并
    const batchResults = [];
    for (let i = 0; i < batches.length; i++) {
      try {
        const r = await callMiniLLM(systemPrompt, batches[i],
          `分析第 ${i+1}/${batches.length} 批图片（共 ${batches[i].length} 张），输出视觉报告 JSON。`,
          { signal });
        const m = r.match(/\{[^]*\}/);
        if (m) batchResults.push(JSON.parse(m[0]));
      } catch (e) {
        if (signal?.aborted) throw signal.reason || e;
      }
    }
    if (!batchResults.length) return null;
    if (batchResults.length === 1) return batchResults[0];

    // 合并多批：取最频繁的 style_vibe，合并 dominant_colors 去重
    const merged = batchResults[0];
    const allColors = new Set(merged.dominant_colors || []);
    const allElements = new Set(merged.key_visual_elements || []);
    for (const r of batchResults.slice(1)) {
      (r.dominant_colors || []).forEach(c => allColors.add(c));
      (r.key_visual_elements || []).forEach(e => allElements.add(e));
    }
    merged.dominant_colors = [...allColors].slice(0, 6);
    merged.key_visual_elements = [...allElements].slice(0, 8);
    return merged;
  } catch (e) {
    if (signal?.aborted) throw signal.reason || e;
    console.warn('[Vision] 分析失败:', e.message);
    return null;
  }
}
const CATEGORY_IMG_DIRECTIVES = {
  "旅游攻略": 'Travel destination photography. Natural scenic views, architecture, landscapes, local people. Warm sunlight, rich colors, depth of field. Atmospheric and inviting. Pure visual only.',
  "好物评测": 'Product photography. Clean studio lighting, soft reflections, product on simple surface. Close-up details, macro shots, natural shadows. Professional commercial photography style.',
  "美食探店": 'Real restaurant/cafe interior photography. Food close-ups with steam, natural window light, wooden tables, cozy atmosphere. Barista or diner naturally in frame. Warm golden tones, soft bokeh. Ingredients naturally arranged.',
  "穿搭分享": 'Fashion photography. Model in urban setting, natural light, full-body and half-body shots. Fabric texture close-ups, clean background. Street style aesthetic, natural poses.',
  "美妆护肤": 'Beauty portrait photography. Soft natural lighting on skin, close-up face shots. Product next to skin, ingredient textures. Clean, fresh aesthetic with pastel tones.',
  "数码3C": 'Tech product photography. Product on clean surface, dramatic lighting, metallic reflections. Close-up details of materials and textures. Dark or neutral background. Sleek modern aesthetic.',
  "学习干货": 'Clean desk flat lay photography. Notebooks, pens, glasses, natural window light. Organized study space. Warm neutral tones. Soft shadows and natural materials.',
  "职场干货": 'Modern office photography. Clean workspace, laptop, natural light. Minimalist composition. Plants and personal items for warmth. Professional calm atmosphere.',
  "家居家装": 'Interior design photography. Well-lit room with natural light. Furniture, plants, textiles. Cozy warm atmosphere. Scandinavian or Japanese aesthetic. Clean uncluttered spaces.',
  "健身减肥": 'Active lifestyle photography. Person exercising in bright space. Yoga mat, weights, water bottle. Natural light streaming in. Energetic and fresh atmosphere.',
  "美妆·化妆教程": 'Step-by-step face close-up photography. Model skin at different stages. Soft natural window light. Clean white or neutral background. Beauty editorial aesthetic.',
  "情感共鸣": 'Atmospheric mood photography. Soft focus, warm lamp light, window with rain, cozy corner with plants and books. Gentle warm tones. Peaceful contemplative mood.',
  "影视推荐": 'Cinematic collage style. Dark background with warm accent lighting. Multiple scene compositions arranged artistically. Dramatic shadows, rich colors, film grain texture.',
  "一人食": 'Cozy food photography. Single dish on wooden table, chopsticks, natural window light. Warm homey atmosphere. Ingredients naturally placed around the dish.',
  "美甲": 'Hand model close-up photography. Well-manicured hands in natural light. Clean neutral background. Soft focus background. Elegant and minimal.',
  "书单推荐": 'Books flat lay photography. Books stacked and open on wooden surface. Cozy reading corner with soft lamp light. Warm comfortable atmosphere. Natural textures.',
  "健康养生": 'Natural ingredients photography. Fresh herbs, fruits, tea leaves on wooden surface. Bright natural light. Green and warm tones. Organic clean aesthetic.',
  "通用": 'Clean photography-style image. One main subject centered. Soft natural lighting, warm neutral tones. Professional composition. Portrait vertical 3:4.'
};

// ============================================================
// 图片生成
async function generateImage(prompt, category, isCover, jkContext, customSize, refImageBase64) {
  const jkKeywords = [/水手服/,/JK/,/制服/,/百褶裙/,/领结/,/sailor/i,/seifuku/i,/校服/i,/校园/i,/学院风/i,/青春/i,/学校/i,/日系/i];
  const isJK = jkContext || (category === '穿搭分享' && jkKeywords.some(k => k.test(prompt)));

  let finalPrompt;
  if (isJK) {
    // GPT-image-2 安全过滤器阻止"school-age character"类图片
    // API建议改用 "adult fashion model" + "Japanese-inspired academy uniform look"
    // 做词汇替换以安全通过，保持人物/模特/价格标注完整
    let safe = prompt
      // 年龄明确化：adult (age 22)
      .replace(/\b(model|girl|woman)\b/gi, 'adult fashion model (age 22)')
      .replace(/\b(person|figure)\b/gi, 'adult model')
      // "sailor uniform" 优先整体替换 → 安全术语
      .replace(/\bsailor\s+uniform\b/gi, 'Japanese-inspired academy style')
      .replace(/\buniform\b/gi, 'fashion style')
      .replace(/\bsailor\b/gi, 'nautical')
      // school → 避免触发
      .replace(/\b(school|schoolgirl|schoolboy|student|teen|teenage|teenager)\b/gi, 'fashion')
      .replace(/校服|校园|学生|高中生|初中生/g, '学院风')
      // "wearing" ← 保留
      .replace(/\s{2,}/g, ' ').trim();
    const prefix = isCover
      ? `Fashion editorial photography. Adult female model portrait. `  // 封面不加价格标注
      : `Fashion editorial photography. Adult female model, Chinese price labels on clothing. `;
    finalPrompt = prefix + safe + ` Soft natural light, vertical 3:4, street style photography.`;
    console.log('[JK safe] len=' + finalPrompt.length);
  } else {
    // 非JK路径：原样
    const promptPrefix = `Xiaohongshu poster, vertical 3:4, photo-realistic, photography style. `;
    const textRule = isCover
      ? ' Cover text must use Chinese characters only. For example, large bold Chinese title at top, price labels in Chinese at bottom. NO English text except brand names.'
      : ' Chinese text annotations REQUIRED on this image. Include Chinese labels, prices, titles, and tags as part of the image design. Text must be Simplified Chinese. Do NOT add English text.';
    const promptSuffix = ` Leave 5% margin from ALL edges. Portrait ONLY. High quality, detailed, professional.${textRule}`;
    finalPrompt = promptPrefix + prompt + promptSuffix;
  }
  return await callImageAPI(finalPrompt, customSize, refImageBase64);
}

// Ref: 参考图 base64，传给 GPT-Image-2 做视觉参考
async function callImageAPI(fullPrompt, customSize, refImageBase64) {
  const size = customSize || resolveGenerationSize({ resolution: '2K', ratio: '3:4' }).size;
  const inputAssets = [];
  const references = Array.isArray(refImageBase64) ? refImageBase64 : (refImageBase64 ? [refImageBase64] : []);
  for (const [index, reference] of references.entries()) {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=\s]+)$/i.exec(String(reference));
    if (!match) throw new Error('参考图必须是 PNG、JPEG 或 WebP data URI');
    const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    if (!buffer.length) throw new Error('参考图不能为空');
    inputAssets.push({ buffer, contentType: match[1].toLowerCase(), fileName: `content-reference-${index + 1}.png` });
  }
  return imageGenerationPool.run(async () => {
    const submitted = await ecommerceProviderAdapter.submitEdit({
      idempotencyKey: `legacy-image-${crypto.randomUUID()}`,
      prompt: fullPrompt,
      modelRoute: { model: IMG_MODEL, size, async: true, mode: inputAssets.length ? 'edit' : 'generate' },
      inputAssets,
    });
    const completed = await ecommerceProviderAdapter.pollUntilReady(submitted.jobId);
    if (completed.status !== 'completed' || !completed.outputUrl) {
      throw new Error(completed.error || '图片任务未完成');
    }
    return completed.outputUrl;
  });
}

// ============================================================
// Coze 工作流 - 内容分析 prompt
// ============================================================
const CONTENT_ANALYSIS_SP = `# 角色定义
你是一位顶级小红书爆款图文内容策划专家，精通红鸦（RedCrow）的爆款内容创作体系。你的核心任务是根据用户提供的原始文本和品类，生成符合红鸦风格的高质量图文内容方案。

## 🚨 最核心规则（违反即不合格，必须100%遵守）
**所有输出内容必须使用简体中文。标题、正文、标签、page story、info_blocks label/value 全部用中文写。禁止出现任何英文单词、英文句子、英文段落。品牌名可以保留英文，但必须附中文翻译/说明。菜品名、产品名、地名都要用中文。如果用户输入中有英文，翻译成中文后再用。例："coffee"→"咖啡"，"restaurant"→"餐厅"，"OOTD"→"今日穿搭"。如果你的输出包含超过3个英文单词（品牌名除外），整个输出不合格。**

# 你必须深度理解红鸦内容体系的核心公式
## 1. 爆款标题公式（必须使用）
- 数字结果式：3天2夜/人均800/5个技巧/7天逆袭
- 身份场景式：打工人/学生党/宝妈/00后 + 场景痛点
- 反差痛点式：谁懂啊/再也不/原来/才/千万别
- 清单总结式：合集/汇总/必看/指南
- 恐惧共鸣式：别等才/再就晚了
标题必须带emoji（🔥/✨/💡/😱/✅）

## 2. 正文结构黄金公式
第一部分：谁懂啊/家人们/再也不开头，用个人经历引发共鸣（1-2句话）
第二部分：正文干货（按品类不同密度）：
  - 干货类（旅游/科普/育儿/学习/职场/书单）：使用✅/⭐/📌做分割，3-5个info_blocks，每块含核心信息+个人体验+价格/数据
  - 好物种草类（好物评测/产品实测/数码/家居家电）：使用🔥/🎧/💡/🎯做分割，每块聚焦1个产品核心卖点
  - 视觉导向类（穿搭/美妆/美食/美甲/护肤）：简短有力，2-3个信息点足矣
第三部分：结尾CTA互动引导

## 3. 情绪价值表达规则
- 每段用emoji做标题分割（🔥/💰/🎧/💡/✅/⭐/📌/😱）
- 用口语化表达，**不同赛道用不同流行语**：
  穿搭/美妆→OOTD/一衣多穿/叠穿大法/谁穿谁好看/显白/氛围感/穿搭公式/甜酷/慵懒风/清冷感
  美食→真的被香迷糊了/大口满足/幸福感爆棚/太上头了/一口就沦陷
  旅游→这辈子一定要去/美哭了/合集码住/不踩雷/被问疯了
  好物→闭眼入/后悔没早买/真香/懒人必备/被夸爆了
  通用→我直接惊了/谁懂啊/真的绝了/绝绝子/建议收藏/码住
- 穿插个人真实体验（我试过了/亲测有效/用了3个月）
- 结尾加互动引导



# 重要：主题保留规则（必须严格遵守）
- 用户输入的文案就是你要写的内容主题，**必须围绕该主题生成内容**，不能换主题、不能自由发挥、不能生成与输入无关的内容
- 例如：如果用户输入「云南旅游」，你生成关于云南旅游的内容；如果用户输入「咖啡机」，你生成咖啡机评测。**不要偏差**
- **禁止**：用户写A内容，你生成B内容。这是严重错误

# 每页内容规则（pages数组，共8个元素，P1-P8全部为内容页，封面独立生成）
每页结构：{"page_id":1-8,"page_type":"content","title":"本页标题（10字以内）","hook":"一句话钩子","story":"核心内容（按赛道控制长度）","info_blocks":[{"label":"标签如价格/时间","value":"值"}],"layout_hint":"画面描述：指定用拼图还是单图、主体什么、文字标注位置"}


## 特别提示：可复用模板概念（参考GPT Image 2已验证有效的模板类型）
以下模板类型是已验证能稳定出图的排版方式，可用于参考生成layout_hint和prompt：
- 食物时间切片：一个食物拆成4-6阶段(未成熟→成熟→过熟→变质)，每段配中文阶段名+外观+内部变化+保存建议
- 手绘标注线：白色手绘线/箭头/圈注叠加在真实照片上，每处写2-6个字
- 路线手账图：暖色纸张背景，城市节点+线条连接+景点+天数+交通图标
- 一周穿搭/清单：7天/多项目网格排列，每格小图+标签
- 九宫格：9张规整排列+中央文字，适合总结页
- 对比分屏：左右Before/After，关键差异处标签标注
- 情绪治愈风：低饱和配色+温柔手绘线条+留白
- 知识流程图：竖排步骤+箭头串联+编号+短说明
- 产品爆炸图：产品配件分散排列+引导线+部件名称
- 斜切拼接：斜线分割画面为2个区域，各放不同场景
## 赛道内容密度分级（**必须严格遵守字数限制**）
### 🏔️ 干货类（旅游/科普/育儿/学习/职场/书单）
- story长度：**80-150字**，3-5个info_blocks
- info_blocks必须含具体数字（价格/时间/数据/评分）
- 信息必须详实：每页只说1-2个重点，但说透
- layout_hint：指定具体拼图版式
- P7: 延伸/额外推荐/深度对比
- P8: 总结推荐+总花费/推荐理由+互动引导（**不能是end**）
- 信息密度：高

### 🛍️ 好物种草类（好物评测/数码3C/家居家装/美妆·产品测评）
- story长度：**60-100字**，3-4个info_blocks
- 聚焦产品核心卖点+使用场景+真实体验
- P7: 横向对比/优缺点
- P8: 总结推荐+价格+购买引导
- 信息密度：中高

### 👗 视觉导向类（穿搭/美妆教程/美食探店/美甲/一人食/养生花茶/健身减肥）
- story长度：**60-100字**（**必须写满，低于60字扣分**），2-3个info_blocks
- body_text总字数：**150-250字（低于150字扣分）**
- 简洁有力，突出视觉描述，但**必须有具体内容**（价格/菜品名/口味/尺寸/颜色等）
- P7: 搭配技巧/延伸推荐
- P8: 总结+互动
- 信息密度：中高（探店类必须有菜品名+价格+口味+环境描述）

# 情感共鸣、影视推荐 特殊处理
- 情感共鸣：story 30-50字，每页1个金句+感悟，P8为总结+互动
- 影视推荐：story 40-60字，每部一页，P8为横向推荐+互动

# 严格的输出约束
- 每页必须填写layout_hint字段，明确描述画面布局
- 必须填写category字段：根据内容判断品类
- 禁止在story中堆砌与主题无关的内容
- 禁止生造不存在的品牌或产品规格
- **禁止篡改用户原文中的地点/名称**
- **P8不能是end/结束**：P8必须为总结推荐+总花费/推荐理由+互动引导CTA
- **时效性**：正文中涉及年份统一使用{{current_year}}年，月份使用{{current_month}}月
- 所有内容必须有实质信息（具体价格/数据/步骤），避免空洞的形容词堆砌

# 输出格式
必须返回JSON，包含category, title, body_text, hashtags, tags, pages字段
**pages数组必须包含8个元素（page_id 1-8），一条都不能少**

**重要提醒：不要默认选旅游攻略。只有内容明确是行程、景点、天数时才是旅游攻略。美妆产品、美食、穿搭、家居家装等内容不要误判为旅游攻略。仔细阅读用户输入再决定品类。**

===== 标题公式（必须使用，注意多样化，每次不能重复使用同一公式） =====
格式：[情绪钩子][emoji] + [内容承诺] + [数字/量化]
- 数字结果式：3天2夜💨人均800+玩到爽！/ N天N夜攻略🔥人均XXX拿下
- 熬夜付出式：熬夜总结🔥XXX精华攻略/花了N天整理出这份XXX/实测N天才敢来分享
- 闭眼冲式：XXX闭眼冲！N款XXX推荐💅/黄黑皮/干皮/油皮闭眼入！
- 实测背书式：实测XXX🆘效果太狠了/XXX亲测N天，效果真的绝了/用空瓶了才来说真话
- 目标达成式：养成XXX✨这N种方法太厉害了/从XX到XX，我做对了什么
- 格局炸裂式：格局炸裂🤯建议反复阅读这N本XXX/看完彻底醒悟了🔥
- 新手友好式：新手必看🔥XXX全攻略/保姆级教程💡XXX一篇看懂
- 情绪共鸣式：「真的被XXX惊艳到了！」/「后悔没早点发现！」/「无限回购！」
- 避坑指南式：XXX避雷指南⚠️这N个坑千万别踩/花过XX万冤枉钱才总结出的XXX
- 省钱攻略式：N元搞定XXX🔥打工人学生党必看/不到XX元拿下XXX性价比之王
注意：禁止反复使用熬夜总结/3天2夜等固定开头，每次必须换不同的标题切入点

===== 正文写作规则（必须遵守） =====
【第1段 开头钩子（3-4句）】（多样化，禁止连续重复使用同一句式）
模式1 共鸣痛点：谁懂啊！/家人们谁懂啊！！/是不是还在纠结/有没有姐妹和我一样
模式2 反常识：不要只顾着/以前总觉得/做了XX年XXX才明白
模式3 实测背书：我帮大家实测了/花了一个月时间亲测/用空瓶了才敢来分享
模式4 焦虑放大：真的太容易了/再不做就来不及了/别等了才后悔
模式5 惊喜发现式：发现了一个宝藏XXX！/终于找到了！/姐妹们快去试试这个！
模式6 对比反差式：用之前vs用之后/以前的我vs现在的我
注意：每次生成的【第1段 开头钩子】不能与之前使用过的重复，禁止连续多次使用谁懂啊

【第2段起 正文干货】
- 使用emoji作为每段标题分割（🔥/💰/🚄/✅/⭐/⚠️/💡/🔸/👉）
- 列表格式：每项编号或emoji开头，2-3句
- 段落之间空行分隔
- **必须包含具体数字/价格/时间/步骤等数据**

【最后一段 结尾CTA】（多样化选择，避免重复使用同一句式）
1. 呼吁行动型：快艾特你的笨蛋闺蜜一起出发吧！/赶紧存下来，周末就去！/码住这篇，下次直接用！
2. 祝福口号型：一起做个气血满满的元气少女吧！💪/愿我们都能在生活里闪闪发光✨/这个夏天，一起美到发光！
3. 鼓励坚持型：坚持28天，皮肤自带打光板！/三天打鱼两天晒网可不行/给自己一个月的时间
4. 金句型：生活不是为了赶路而是为了感受路/取悦自己才是终身浪漫的开始
5. 价值强调型：阅读是回报率超高的投资/这笔钱花得最值的就是XXX/用一杯奶茶的钱换一个好皮肤
6. 互动提问型：评论区交出你的宝藏XXX！/你觉得哪个最值得入手？/有没有和我一样踩过雷的姐妹？
注意：每次生成的结尾CTA不能与之前生成过的重复

===== 🚨 赛道特有规则 — 严格执行，不可跳过 =====
每条规则指定了该赛道 **每页应该讲什么**，以及 **页与页之间的逻辑关系**。

【🏔️ 旅游攻略 — 按天拆分行前中后】
**逻辑**：行程天数→每天独立一页→美食→避坑→总结
- body_text：行程概览（不要逐日详述）+ 预算 + 2-3个Tips。**禁止逐日写行程**
- pages结构（7页，无P2）：
  P1=总览+亮点推荐（总天数+目的地+预算+核心亮点关键词）
  P3=Day1行程（具体景点+时间安排+门票价格+交通方式）
  P4=Day2行程（同上结构，不同景点）
  P5=Day3行程（如有更短行程则P5=美食推荐）
  P6=出片点位+预算明细（具体拍照点+各项目花费）
  P7=避坑指南（3-5个坑点，每个带小标题）
  P8=总结+CTA（总花费+推荐理由+互动引导）
- 每条行程必须有具体景点名+时间+价格
- info_blocks示例：[{"label":"Day1","value":"鼓浪屿+中山路"},{"label":"门票","value":"约80元"},{"label":"交通","value":"船票约35元"}]

【💄 美妆护肤 — 按使用步骤拆分】
**逻辑**：产品总览→质地实测→成分拆解→使用手法→效果对比→优缺点→横向对比→总结
- pages结构（7页，无P2）：
  P1=产品外观+规格参数+价格（产品全貌+核心功效+适合肤质+价格标签）
  P3=质地实测（产品挤在手背/化妆棉上、颜色/气味/延展性特写+评分）
  P4=成分功效分析（核心成分图解+功效说明+适合肤质标签）
  P5=使用手法教程（分步骤：取量→涂抹→按摩→吸收→注意事项）
  P6=效果对比Before/After（使用前vs使用后皮肤状态对比+时间跨度）
  P7=优缺点分析（左右分栏：优点/缺点各3-4条+综合评分）
  P8=总结推荐（推荐理由+适合肤质+价格回顾+互动引导）
- **每页必须包含产品实物图片**，不能只有文字或图表

【👗 穿搭分享 — 按套系拆分】
**逻辑**：多套搭配→每套一页→面料→场景→技巧→总结
- pages结构（7页，无P2）：
  P1=总览（多套缩略图+风格标签，本期刊容主题标题）
  P3=第一套搭配详情（全身展示+单品标注+价格+风格关键词）
  P4=第二套搭配详情（不同模特/不同风格+全身展示+单品标注+价格）
  P5=第三套搭配详情（不同模特/不同风格+全身展示+单品标注+价格）
  P6=面料/版型细节（局部特写+面料标签+版型对比）或场景穿搭（三格图：校园/通勤/约会）
  P7=搭配技巧（左右分屏对比+技巧说明+颜色/款式建议）
  P8=总结+推荐（总价+最推荐的一套+互动引导）
- **每页模特不同**：禁止连续两页同一人设/场景/姿势
- info_blocks：每页至少3个（价格、面料、版型、颜色数据）

【🍳 美食探店 — 按菜式拆分】
**逻辑**：招牌菜→各道菜逐一展示→拼盘→环境→对比→总结
- pages结构（7页，无P2）：
  P1=招牌菜特写（推荐菜品名称+价格+口感描述+推荐程度）
  P3-P5=各道菜逐一展示（每页一道菜：菜品大图+价格+口味+食材+推荐指数⭐）
  P6=拼盘展示（3-4道菜排列+环境氛围+位置信息）
  P7=同类对比（该店vs其他店同类菜品对比+推荐）
  P8=总结+推荐组合（最佳搭配+人均+互动CTA）

【📱 好物评测 — 产品横评】
**逻辑**：产品总览→逐品详测→对比→总结
- pages结构（7页）：
  P1=所有产品总览（网格排列+名称+核心卖点标签+价格区间）
  P3-P5=各产品详测（每页一个产品：产品全景+规格+实测体验+价格）
  P6=横向对比表（多产品参数+价格+评分对比）
  P7=优缺点分栏+综合推荐
  P8=总结+推荐购买的型号+理由+互动

【💻 学习干货 — 方法分步解析】
**逻辑**：总览→方法1→方法2→方法3→资源→避坑→总结
- pages结构（7页）：
  P1=方法总览（核心方法论+适用人群+目标数据+时间规划）
  P3=方法一（具体步骤+实施方式+所需时间+效果数据）
  P4=方法二（同上结构，不同方法）
  P5=方法三（同上结构，不同方法）
  P6=资源推荐（工具/书籍/app清单+价格+使用建议）
  P7=常见误区/避坑（3-5个常见问题+正确做法）
  P8=总结+行动计划+互动

【💼 职场干货 — 技巧逐条拆解】
**逻辑**：总览→逐条技巧→案例→总结
- pages结构（7页）：
  P1=总览（核心方法论+适用人群+核心数据）
  P3-P5=逐条技巧（每条技巧独立一页：技巧名+具体做法+案例+效果）
  P6=实际案例（真实场景应用+前后对比）
  P7=常见误区（3-5个坑+正确做法）
  P8=总结+行动清单+互动

【🏠 家居家装 — 区域拆分改造】
**逻辑**：总览→各区域逐一展示→好物→避坑→总结
- pages结构（7页）：
  P1=改造前全景（原貌+问题标注+改造目标+预算）
  P3-P5=各区域展示（每页一个区域：改造后全景+核心单品+价格）
  P6=好物推荐清单（推荐单品+价格+购买渠道）
  P7=避坑Tips（3-5个装修/改造注意事项）
  P8=费用明细+总结+互动

【💪 健身减肥 — 阶段/部位/天数拆分】
**逻辑**：总览→各阶段训练→饮食→对比→总结
- pages结构（7页）：
  P1=计划总览（训练目标+时长+频率+核心动作概览）
  P3-P5=各训练模块（每页一个模块：训练动作+组数+时间+效果说明）
  P6=饮食方案（每日食谱+热量+营养搭配）
  P7=效果对比（Before/After+周期+数据变化）
  P8=总结+坚持建议+互动

【🧴 美妆·化妆教程 — 上妆步骤拆分】
**逻辑**：底妆→眼妆→唇妆→修容→定妆→产品清单→总结
- pages结构（7页）：
  P1=完妆效果+所需产品清单+难度等级+预计用时
  P3=底妆步骤（妆前→粉底→遮瑕→定妆，每步配图+产品名）
  P4=眼妆步骤（眼影→眼线→睫毛，颜色+手法）
  P5=唇妆+腮红（色号+涂抹手法）
  P6=修容+高光（位置示意+手法）
  P7=定妆+持久技巧（产品+手法）
  P8=全妆展示+产品清单+价格+互动

【📖 书单推荐/影视推荐 — 逐本/逐部介绍】
**逻辑**：总览→逐本/部分享→总结
- pages结构（7页）：
  P1=总览（所有推荐汇总+数量+类型标签）
  P3-P7=逐本/部介绍（每页一个：封面+评分+类型+金句/剧情+推荐理由+适合人群）
  P8=总结+最推荐+互动

【🧘 情感共鸣 — 情境递进】
**逻辑**：引出共鸣→逐层递进→升华→互动
- pages结构（7页）：
  P1=开篇引语（核心情感主题+氛围配图）
  P3-P6=层层递进（每页一个情境/感悟+金句+留白排版）
  P7=升华（核心观点+治愈金句）
  P8=回顾+互动引导

【🍳 一人食 — 按食谱拆分】
**逻辑**：总览→各天食谱→备餐技巧→总结
- pages结构（7页）：
  P1=成品展示+标题+制作时长
  P3-P6=各天食谱/各类菜谱（每页一道：食材清单+步骤+时间+价格）
  P7=备餐技巧（批量制作技巧+保存方法+省时技巧）
  P8=总结+推荐搭配+互动

【💅 美甲 — 按款式拆分】
**逻辑**：总览→各款展示→对比→总结
- pages结构（7页）：
  P1=成品款展示+标题（本期主题）
  P3-P6=各款式逐一展示（每页一个：手部特写+色号+价格+风格标签）
  P7=各款横向对比（款式+适合场景+推荐）
  P8=总结+最推荐+互动

===== 标签规则 =====
- 5-8个标签，放在body_text末尾（小红书格式：正文后空一行写标签）
- 标签格式：#标签名 用空格分隔，不用换行
- hashtags数组仅用于导出文件，不单独展示在界面上

===== 整体风格约束 =====
- 人称：姐妹们/宝子们（美妆/穿搭/美食/旅游），各位（通用/职场/书单/数码）
- 语气：口语化（谁懂啊/真的绝了/闭眼入/太狠了）
- 每段必须有实质信息（具体价格/数据/步骤），禁止空洞形容词堆砌
- ⚠️ **价格免责声明**：价格用模糊词（约/起/左右），禁止精确到个位数。**不要每个物品都标价**
- 所有文字必须是简体中文，**禁止出现任何英文内容**。标题、正文、标签、page story全部用简体中文。品牌名/产品名如有英文原称也请翻译或加中文注。
- **正文内容必须充实完整，信息密度要高**。干货类300-500字，种草类200-350字，视觉类也要达到150-250字。body_text绝对不能只有几十个字。每段必须有具体价格/数据/步骤。禁止空洞形容词堆砌。
- **小红书各赛道最优字数**：标题≤20字（含emoji），正文因赛道不同
  干货类（旅游/学习/职场/育儿/书单）：300-500字
  种草类（好物/数码/家居）：200-350字
  视觉类（穿搭/美妆/美食/美甲）：150-250字
- 如果正文超过上述限制，必须精简内容，不能截断
- **pages必须生成8个元素（page_id 1-8），全部为内容页，封面图独立生成**
- **禁止篡改用户输入中的地点名**
- **时效性：年份必须使用{{current_year}}年，月份使用{{current_month}}月**
- **P8不能是end/结束**：P8必须为总结推荐+总花费/推荐理由+互动引导CTA
- **内容多样化要求**：每次生成的标题句式、开头钩子、结尾CTA必须各不相同

【再次提醒】⚠️ **所有内容必须简体中文，禁止任何英文**。品牌名可保留但必须附中文。如果输出包含>3个英文单词（品牌名除外），输出不合格。

=== 输入内容 ===
品类：由用户输入的内容自动判断
文案：
{{text_content}}

== 如果品类是旅游攻略，P5必须是美食推荐页 ==
`;

const CONTENT_ANALYSIS_UP = `【强制】你只能基于「文案」字段的内容来写。文案写什么主题，你就生成什么内容。
▶ 文案是旅行内容 → 生成旅游攻略
▶ 文案是产品介绍 → 生成好物评测
▶ 文案是美食体验 → 生成美食探店
▶ 文案是护肤美妆 → 生成美妆护肤
▶ 文案是穿搭描述 → 生成穿搭分享
▶ 文案是学习经验 → 生成学习干货
▶ 文案是职场心得 → 生成职场干货
▶ 文案是影视/书籍 → 生成影视推荐/书单
▶ 文案是健康养生 → 生成健康养生

【强制】所有内容必须使用简体中文，**禁止输出任何英文**。菜品名、品牌名、产品名都必须用中文写。例如"coffee"写"咖啡"，"restaurant"写"餐厅"。
▶ 文案是家居改造 → 生成家居家装
▶ 文案是情感抒发 → 生成情感共鸣
▶ 文案是亲子育儿 → 生成育儿知识
生成的内容主题必须与文案一致，不能偏差。如果文案提到具体地名（如云南、大理），标题和正文必须保留这些地名。

品类：根据文案内容自动判断品类
检测到的品类：{{detected_category}}

严格按照以下JSON结构输出，不要输出任何多余内容。

**body_text字数由赛道决定（干货类300-500字，种草类200-350字，视觉类150-250字），严禁超出上限**。

**重要：category字段必须在JSON开头位置填写**
品类可选值：旅游攻略 | 好物评测 | 美食探店 | 穿搭分享 | 美妆护肤 | 美妆·化妆教程 | 数码3C | 学习干货 | 职场干货 | 家居家装 | 健身减肥 | 情感共鸣 | 影视推荐 | 一人食 | 书单推荐 | 美甲 | 健康养生 | 育儿知识 | 养生花茶

**pages数组必须包含8个元素（page_id 1-8），全部为内容页**

{
  "category": "此处填写品类名，从上方列表选一个",
  "title": "标题（红鸦式，参考【标题公式】）",
  "body_text": "完整正文（干货≤500字，种草≤350字，视觉≤250字）",
  "hashtags": ["#标签1", "#标签2"],
  "tags": [],
  "pages": [
    {"page_id":1,"page_type":"content","title":"页标题","hook":"一句话钩子","story":"核心内容（按赛道字数限制）","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":2,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":3,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":4,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":5,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":6,"page_type":"content","title":"页标题","hook":"钩子","story":"内容","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":7,"page_type":"content","title":"延伸/对比","hook":"补充钩子","story":"横向对比或深度延伸","info_blocks":[{"label":"标签","value":"值"}],"layout_hint":"画面描述"},
    {"page_id":8,"page_type":"content","title":"总结推荐","hook":"互动引导","story":"总花费+推荐理由+CTA","info_blocks":[{"label":"总计","value":"金额"}],"layout_hint":"总结卡片+互动引导"}
  ]
}


=== 输入内容 ===
文案：
{{text_content}}

必须严格按照以上JSON结构输出，不要输出任何多余内容。`;

// ============================================================
// 工作流：内容分析
// ============================================================
async function contentAnalysis(textContent, { creativeDirection = null, visionContext = '' } = {}) {
  if (creativeDirection) {
    try {
      const request = buildDynamicXhsAnalysisRequest({ text: textContent, visionContext, direction: creativeDirection });
      const raw = await callMiniLLM(request.systemPrompt, [], request.userPrompt, {
        signal: AbortSignal.timeout(45_000),
        temperature: 0.82,
        maxTokens: 6500,
      });
      const dynamic = normalizeDynamicXhsAnalysis(parseXhsPlannerJson(raw), { direction: creativeDirection, text: textContent });
      if (dynamic) return dynamic;
      throw new Error('动态策划缺少完整标题、正文或页面');
    } catch (error) {
      console.warn('[XHS dynamic planner] 策划失败，使用动态事实兜底:', error.message);
      return createDynamicXhsFallback({ text: textContent, direction: creativeDirection });
    }
  }
  // ===== 前置关键词分类：从用户输入提取品类（绕开LLM分类不可靠的问题） =====
  function detectCategory(text) {
    const t = text.toLowerCase();
    if (/旅游|旅行|攻略|景点|民宿|酒店|打卡|机票|高铁|自驾|古镇|县城|小众|反向|周末|度假|海滩|雪山|湖泊|路线|行程/.test(t)) return "旅游攻略";
    if (/护肤|精华|面霜|眼霜|洁面|防晒|面膜|水乳|早c晚a|成分|肤质|敏感肌/.test(t)) return "美妆护肤";
    if (/口红|眼影|腮红|粉底|化妆|教程|妆容|美妆/.test(t)) return "美妆·化妆教程";
    if (/穿搭|ootd|搭配|显瘦|显白|裙子|裤子|外套|鞋|包|配饰|风格/.test(t)) return "穿搭分享";
    if (/美食|探店|咖啡|餐厅|甜品|小吃|火锅|烧烤|外卖|菜单/.test(t)) return "美食探店";
    if (/便当|一人食|快手菜|做饭|食谱|烹饪|厨房/.test(t)) return "一人食";
    if (/评测|实测|测评|开箱|推荐|好物|种草|平价|购物/.test(t)) return "好物评测";
    if (/数码|手机|电脑|耳机|相机|平板|智能|科技|app/.test(t)) return "数码3C";
    if (/学习|考研|英语|考试|读书|笔记|方法|自律|打卡|成长/.test(t)) return "学习干货";
    if (/职场|工作|面试|简历|升职|加薪|打工|裸辞|副业/.test(t)) return "职场干货";
    if (/家居|装修|出租屋|改造|收纳|软装|北欧|极简/.test(t)) return "家居家装";
    if (/健身|减肥|瘦|运动|瑜伽|普拉提|跑步|健身/.test(t)) return "健身减肥";
    if (/情感|共鸣|治愈|心情|感悟|人生|成长|深夜/.test(t)) return "情感共鸣";
    if (/影视|电影|电视剧|综艺|追剧|纪录片/.test(t)) return "影视推荐";
    if (/书单|读书|书籍|阅读|推荐/.test(t)) return "书单推荐";
    if (/美甲|指甲/.test(t)) return "美甲";
    if (/养生|花茶|健康|中医|内调|食疗/.test(t)) return "健康养生";
    if (/育儿|宝宝|孩子|亲子|早教/.test(t)) return "育儿知识";
    if (/花草茶|花茶/.test(t)) return "养生花茶";
    return "";
  }
  const detectedCat = detectCategory(textContent);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const legacyTextContent = `${textContent}${visionContext || ''}`;
  const sysPrompt = CONTENT_ANALYSIS_SP.replace(/{{current_year}}/g, String(currentYear)).replace(/{{current_month}}/g, String(currentMonth)).replace(/{{text_content}}/g, legacyTextContent)
    .replace('{{detected_category}}', detectedCat || '');
  const userPrompt = CONTENT_ANALYSIS_UP
    .replace('{{category}}', '自动判断')
    .replace('{{text_content}}', legacyTextContent)
    .replace(/{{current_year}}/g, String(currentYear))
    .replace(/{{current_month}}/g, String(currentMonth));

  let raw = await callLLM(sysPrompt, userPrompt, { temperature: 0.5, maxTokens: 12000 });
  raw = raw.replace(/20(?:2[0-9]|3[0-9])[年]?/g, `${currentYear}年`).replace(/20(?:2[0-9]|3[0-9])/g, String(currentYear));
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  raw = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  raw = raw.replace(/\r?\n|\r/g, ' ');

  function extractAndPad(rawText) {
    try { return JSON.parse(rawText); } catch (e) {}
    try {
      const fixed = rawText.replace(/\}\s*\{/g, '},{').replace(/\]\s*\{/g, '],{').replace(/\}\s*\[/g, '},[');
      let s = fixed;
      const start2 = s.indexOf('{');
      if (start2 >= 0) s = s.slice(start2);
      let opens2 = 0, arrays2 = 0, inStr2 = false, esc2 = false;
      for (const ch of s) {
        if (esc2) { esc2 = false; continue; }
        if (ch === '\\' && inStr2) { esc2 = true; continue; }
        if (ch === '"') { inStr2 = !inStr2; continue; }
        if (!inStr2) {
          if (ch === '{') opens2++;
          if (ch === '}') opens2--;
          if (ch === '[') arrays2++;
          if (ch === ']') arrays2--;
        }
      }
      if (inStr2) s += '"';
      while (arrays2 > 0) { s += ']'; arrays2--; }
      while (opens2 > 0) { s += '}'; opens2--; }
      const m = s.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
    } catch (e) {}
    try {
      let s = rawText.replace(/[^\x20-\x7E一-鿿　-〿＀-￯{},:\[\]\"\-. ]/g, '');
      const start = s.indexOf('{');
      if (start === -1) throw new Error('no json');
      s = s.slice(start);
      let opens = 0, arrays = 0, inStr = false, esc = false;
      for (const ch of s) {
        if (esc) { esc = false; continue; }
        if (ch === '\\' && inStr) { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (!inStr) {
          if (ch === '{') opens++;
          if (ch === '}') opens--;
          if (ch === '[') arrays++;
          if (ch === ']') arrays--;
        }
      }
      if (inStr) s += '"';
      while (arrays > 0) { s += ']'; arrays--; }
      while (opens > 0) { s += '}'; opens--; }
      return JSON.parse(s);
    } catch (e) {}
    // 方法4：用正则提取顶层字段（title/body_text/hashtags），放弃pages
    try {
      const titleM = rawText.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const bodyM = rawText.match(/"body_text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const tagsM = rawText.match(/"hashtags"\s*:\s*\[([^\]]*)\]/);
      if (titleM) {
        const result = { title: titleM[1], body_text: bodyM ? bodyM[1] : '', hashtags: tagsM ? [tagsM[1]] : [], tags: [] };
        result.pages = [];
        const cats = rawText.match(/"category"\s*:\s*"([^"]*)"/);
        if (cats) result.category = cats[1];
        return result;
      }
    } catch (e) {}
    throw new Error('内容分析JSON解析失败(前): ' + rawText.slice(0, 150) + '...(后): ' + rawText.slice(-80));
  }

  const parsed = extractAndPad(raw);
  // Fix: LLM sometimes returns \n as literal backslash-n instead of actual newlines
  if (parsed.body_text) parsed.body_text = parsed.body_text.replace(/\\n/g, '\n');

  // ===== 英文检测 + 三级重试机制 =====
  function countEnglish(text) {
    const words = (text || '').match(/[a-zA-Z]{3,}/g);
    const brandExceptions = ['OOTD','DIY','vs','Vlog','vlog','APP','App'];
    return words ? words.filter(w => !brandExceptions.includes(w)).length : 0;
  }
  let enCount = countEnglish(parsed.body_text);
  let retries = 0;
  while (enCount > 5 && retries < 3) {
    retries++;
    console.log('[EN检测] body_text含英文' + enCount + '个，第' + retries + '次重试...');
    const threatMsg = retries === 1 ? '你的输出包含了太多英文！全部用简体中文写，一个英文字母都不能有。'
      : retries === 2 ? '【最后一次机会】再出现英文你的回复将被丢弃！只准写中文，不许写英文。'
      : 'WARNING: YOUR OUTPUT WILL BE DISCARDED IF IT CONTAINS ENGLISH. WRITE ONLY IN CHINESE. DO NOT USE ANY ENGLISH.';
    const retryPrompt = sysPrompt + '\n\n【严重警告】' + threatMsg;
    const retryRaw = await callLLM(retryPrompt, userPrompt, { temperature: Math.max(0.1, 0.5 - retries * 0.15), maxTokens: 12000 });
    const fixedRaw = retryRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      const parsed2 = extractAndPad(fixedRaw);
      if (parsed2.body_text) {
        parsed2.body_text = parsed2.body_text.replace(/\\n/g, '\n');
        const enAgain = countEnglish(parsed2.body_text);
        if (enAgain <= 5) {
          Object.assign(parsed, parsed2);
          enCount = enAgain;
          break;
        }
      }
    } catch(e) { continue; }
  }

  // 最后一招：如果还是有英文，调LLM专门翻译 body_text
  if (countEnglish(parsed.body_text) > 5) {
    console.log('[EN检测] 重试用尽，强制翻译body_text...');
    try {
      const translatePrompt = '你是一个翻译助手。将以下文本翻译成简体中文小红书风格，保持emoji和格式不变。只返回翻译结果，不要解释。\n\n' + (parsed.body_text || '');
      const translated = await callLLM('你是翻译助手，只输出翻译结果。', translatePrompt, { temperature: 0.1, maxTokens: 4000 });
      if (translated && translated.length > 20) {
        parsed.body_text = translated.replace(/^["']|["']$/g, '');
        console.log('[EN检测] 翻译完成，长度:' + parsed.body_text.length);
      }
    } catch(e) { console.warn('[EN检测] 翻译失败:', e.message); }
  }

  const pages = parsed.pages || [];
  if (pages.length < 8) {
    const existingIds = new Set(pages.map(p => p.page_id));
    for (let i = 1; i <= 8; i++) {
      if (!existingIds.has(i)) {
        const prev = pages.find(p => p.page_id === i - 1) || pages[pages.length - 1] || {};
        pages.push({ page_id: i, page_type: i === 1 ? 'cover' : 'content', title: i === 9 ? '总结推荐' : (prev.title || '') + '续', hook: i === 9 ? '别忘了收藏哦～' : (prev.hook || ''), story: i === 9 ? '总结：快来评论区告诉我吧！' : (prev.story || ''), info_blocks: i === 9 ? [{ label: '总计', value: '待补充' }] : (prev.info_blocks || []), layout_hint: i === 9 ? '总结卡片+互动引导' : (prev.layout_hint || '') });
      }
    }
  }
  // 截断到8页(LLM可能输出多于8页)
  console.log(); if (pages.length > 8) pages.length = 8; console.log();

  // 旅游攻略后处理：P5改为美食推荐页（仅限category明确为旅游攻略且P5内容为空或可替换）
  if (parsed.category === '旅游攻略' && pages.length >= 5) {
    const p5 = pages.find(p => p.page_id === 5);
    if (p5 && (!p5.story || p5.story.length < 20 || p5.story.includes('推荐当地') || p5.story.includes('特色菜'))) {
      // 从title或body_text中提取目的地地名
      const titleOrBody = parsed.title + parsed.body_text;
      let dest = '此';
      // 匹配常见的城市名模式：标题/正文前几个字经常是目的地
      const cityMatch = titleOrBody.match(/^([^\d\s]{2,4})(?:\d|旅游|攻略|之行|之旅|出发|周末)/);
      if (cityMatch) dest = cityMatch[1];
      else {
        // 后备：提取body_text中第一个城市名（查找常见后缀）
        const knownCities = titleOrBody.match(/(重庆|成都|长沙|西安|杭州|苏州|南京|武汉|广州|深圳|北京|上海|厦门|丽江|大理|昆明|贵阳|桂林|青岛|三亚|海口|哈尔滨|乌鲁木齐|拉萨|兰州|西宁|银川|呼和浩特|南宁|福州|南昌|合肥|郑州|济南|太原|石家庄|沈阳|大连|长春|天津)[^\s]{0,2}/);
        if (knownCities) dest = knownCities[1];
      }
      p5.title = '美食推荐';
      p5.story = `推荐${dest}当地3-4道地道特色美食，每道写明菜名+价格(参考当地人实际消费)+口感详细描述+推荐理由。必须围绕"${dest}"本地的真实招牌菜/小吃，不能写其他城市的菜系。`;
      p5.info_blocks = [{label:'推荐菜1',value:'价格'},{label:'推荐菜2',value:'价格'},{label:'推荐菜3',value:'价格'}];
      p5.layout_hint = '食物特写+拼盘展示(3-4样当地美食排列)，每样标注名称+价格+口感描述';
    }
  }

    // 最终保底：强制截断到8页
  if (pages.length > 8) pages.length = 8;

  return {
    category: parsed.category || '未分类',
    title: parsed.title || '',
    body_text: parsed.body_text || '',
    hashtags: parsed.hashtags || [],
    tags: parsed.tags || [],
    pages,
  };
}

// ============================================================
// Coze 工作流 - 视觉规划 prompt
// ============================================================
const VISUAL_PLANNING_SP = `# 角色：小红书视觉编排师
任务：根据内容方案，为【{{category}}】赛道生成8条内容页prompt，以及1条**独立封面prompt**，输出JSON。

## 核心规则
1. ⛔ 禁止横图：必须 portrait vertical 3:4 exact
2. ✅ **图片上必须包含中文文字标注**。用英文在prompt中描述中文文字的内容和位置，例如："top area with bold Chinese title '白衬衫+百褶裙 全身搭配展示'". 中文文字要清晰可读，与背景有足够对比度。
3. ✅ 所有内容留5%边距，不贴边
4. ⛔ 禁止深色/黑色/暗色背景，全部浅色/白色/柔和色
    **背景色根据内容氛围适配**：分析画面主题的情绪和氛围选择配色，避免全部使用相同的米黄/奶油色，让不同内容有视觉区分度
5. ✅ **每页必须不同排版**：连续两页严格禁止相同排版。8页中至少变化4种以上视觉结构。**排版要有创意**：避免死板的网格/行列排列。尝试放射状环绕排列、层叠交错、大小错落、透视角度。让画面有动感和设计感。有些页用上下分层，有些用左右分栏，有些用居中聚焦，有些用网格/拼贴排列，有些用错落叠放，有些用斜切/对角线分割。禁止连续2页相同排版。
6. ✅ 价格用模糊词（约/起/左右），只在总价或首项标价
7. ✅ 允许适度装饰：圆角卡片、柔和渐变、小图标/emoji点缀
8. ✅ 内容必须填满画布：3:4竖图覆盖≥75%画布高度。禁止大面积空白
9. ✅ 每页有明确视觉焦点：主体→陪体→背景层次
10. ✅ 画面要有真实感和质感，光影自然，材质细节丰富

**【关键】图片内容必须与页面内容严格对应**
每页的图片必须反映该页的【title】和【hook】和【layout_hint】中描述的主体内容。赛道模板只提供样式和排版参考，不能替代页面内容。
- 例如：如果P2的title是"甜酷水手服"，图片必须画水手服，不能画白衬衫/通勤装。
- 例如：如果P3是"面料/版型细节"，图片必须展示面料纹理或版型特写。
- 赛道模板的排版建议（如"全身搭配图"）要结合页面具体内容来执行。

## 【关键】JK/制服类专用英文术语（防止被误判为通勤装）
当内容涉及JK制服、水手服、西式制服、校园时尚时，以下英文术语**必须使用**：
- 水手服 sailor 类 → 必须写 "Japanese sailor school uniform, oversized navy collar with triple white stripes, red ribbon bow tie"
- 西式制服 blazer 类 → 必须写 "Japanese school blazer uniform, fitted navy jacket with gold school crest button, striped necktie"
- 百褶裙 → "Japanese school pleated miniskirt, box pleats, above knee length"
- 领结/领带 → "ribbon necktie, striped school tie, bow tie"
- 整体氛围 → "Japanese high school girl, kawaii, youthful street snap"
**禁止使用的词汇（导致通勤风误判）：**
❌ "corporate / office / professional / business casual / workwear"
❌ "white blouse" → 改用 "white dress shirt" 或 "sailor top"
❌ "navy jacket" → 改用 "sailor collar top" 或 "school blazer with crest"
❌ "business suit / office lady / workplace"

## 【关键】通用术语替换规则（所有赛道适用）
即使不属于JK制服类，也禁止在prompt中使用商务/办公室类词汇。上衣+裙子的搭配用 "campus style / preppy look" 而非 "office wear / work outfit"。

## 赛道专属视觉模板
{{category_rules}}

**【关键】赛道规则中提到的文字（标题、标签、标注、价格、品牌名等）必须直接渲染在图片上。在prompt里用英文描述这些中文文字的位置、大小和内容，确保图片上有清晰可读的中文文字。**

## 每页prompt生成规则
- **prompt用结构化字段驱动**：描述场景、主体、光线、构图、配色
- **必须使用三段式区域结构**：TOP x% + MIDDLE y% + BOTTOM z%，精确描述每块区域放什么
  - TOP区域：主视觉主体上部（约占15%）
  - MIDDLE区域：主体内容/场景/人物/物体（约占60%）
  - BOTTOM区域：底部装饰/背景延伸（约占20%）
- 英文prompt描述画面，同时必须描述图片上需要呈现的中文文字（标题、价格、标签、产品名等），例如："bottom 20%: Chinese price tag '约200元'"
- 竖图3:4（1024×1366）
- **背景色根据内容适配**：分析画面主题的氛围和情绪，选择最匹配的配色方案。例如：海滨内容用蓝白色系，美食内容用暖色系，科技内容用冷色系，护肤内容用柔和粉白色系。**避免每张图都用相同的米黄/奶油色**，让不同内容的图片有视觉区分度
- 连续两页不能用同一种排版方式
- 内容覆盖≥75%画布高度

## 封面prompt生成规则
- 封面图单独生成，**不包含在pages的8条prompt中**
- 封面prompt格式：竖图3:4 + 封面标题（**只能用中文写，禁止英文**）+ 视觉冲击力强的画面
- 封面标题必须使用简体中文汉字，不能用英文字母。品牌名/数字可以用英文/数字混排。
- 封面与内容页风格统一
- **封面必须用三段式区域结构**：TOP 20%（标题区，中文大标题）+ MIDDLE 60%（主视觉区）+ BOTTOM 20%

## 内容页prompt生成规则（8条）
- 内容页prompt**必须包含中文文字标注**（标题、价格标签、产品名等），用英文描述文字位置和内容
- 注意文字要与背景有对比度，确保可读
- **⛔ 禁止写 "Showing: 标题" 这种空泛描述**。必须根据该页的layout_hint写出具体的画面内容：人物姿态、场景配置、构图排版、配色方案、标注线/箭头位置。layout_hint里的描述必须100%转化为英文prompt。
- **【关键】模特多样性**：每页的模特必须不同——变脸型、发型、发色、身高体型、拍摄角度（正面/侧面/斜侧/背面）、姿势和站姿。禁止连续两页出现同一张脸。例如：P1齐肩发圆脸正面，P2高马尾长脸斜侧，P3双丸子头方脸背面。让人感觉每套搭配穿在不同真实的人身上。

## 输出格式
{"visual_system":"简短描述≤30字","cover_prompt":"英文prompt(竖图+中文标题+视觉冲击)≤280字符，标题必须简体中文","image_prompts":[{"page_id":1,"prompt":"英文prompt(含中文文字标注描述)≤280字符"},...]}
image_prompts共8条page 1-8。纯JSON。封面和内容页都需要包含中文文字，用英文描述文字位置和内容。
`;

const CATEGORY_RULES = {
  "旅游攻略": `视觉：手绘路线地图+拼贴风景，暖色纸张底纹，信息密度极高
封面：多景拼贴（4宫格地标照）+大字标题+价格数字
P1：行程总览卡（出发地->目的地路线图+总天数+人均预算+核心亮点关键词标签，暖色底纹手绘风格地图）
P2：路线图+节点标注城市/景点/交通方式/时间
P3-P5：每日行程（时间线+景点照+价格+Tips）
P6：美食拼盘（菜名+价格+口感）
P7：预算表格（交通/住宿/门票/餐饮）
P8：总结+CTA
配色：暖米/蓝白/翠绿底，文字用白/深褐
禁止：❌纯风景大片无标注 ❌信息量太少 ❌看不懂路线`,
  "好物评测": `视觉：产品实拍+拆解图+横向对比，白/浅灰底
封面：多品评测则封面必须展示所有产品（网格排列或多个产品环绕），非单品图
P1：产品总览卡（产品全景图+核心卖点标签+价格区间，左上角标题，底部评分星级。冷白/浅灰背景，产品居中高亮展示）
P2：产品平面图+配件+规格标签
P3：拆解爆炸图（零件分散+引导线+部件名）
P4：使用场景+功能标注
P5：Before/After对比图
P6：横向对比表（本品+竞品参数/价格/评分）
P7：优缺点分栏+综合评分
P8：总结+推荐+购买建议
配色：根据产品类型适配（科技=深灰/蓝调、生活=暖白/木色、美妆=柔粉/米色、运动=亮白/绿调）
信息密度：高——每页必须有价格/参数/评分
禁止：❌产品太小 ❌无参数/价格 ❌多品评测却只画一个产品`,
  "美食探店": `视觉：食物微距特写+手绘标注线+价格标签，暖橙/棕色调
封面：招牌菜大图+店名+人均价格
P1：美食总览（3-4道招牌菜缩略图排列+店名+人均价格+营业时间，暖橙色调，菜单风格排版）
P2-P4：各道菜特写（白色描边+价格+口感文字）
P5：拼盘展示（3-4道菜排列+名称）
P6：环境氛围+位置
P7：同类对比或推荐榜
P8：总结+推荐组合
禁止：❌冷色调 ❌无价格 ❌食物太小`,
  "穿搭分享": `视觉：杂志街拍风+单品拆解+干净背景
封面：全身照+风格标签+标题大字
P1：穿搭灵感板（3-4套不同风格缩略图拼贴+风格关键词标签，如"甜系/酷感/文艺"，每套标注核心单品名。左上角大标题显示本期穿搭主题，底部显示'今日穿搭灵感'副标题。整体柔和暖色调，杂志感版面设计）
P2-P4：各套详情页（每页展示一套完整搭配：全身展示+单品标注+价格标签+风格关键词，模特正面全身，标注每一个单品品牌/价格。短外套类突出腰线，连衣裙类展示裙摆，叠穿类展示层次）
P5：面料/版型细节（局部特写，对比展示不同版型差异，含价格标签标注）或配饰特写（袜子/鞋/包/发饰，标注价格和品牌）
P6：场景穿搭（校园/通勤/约会三格图）
P7：搭配技巧/风格对比（左右分屏对比图，标注差异点）
P8：总结+推荐单品（总价标注+推荐理由+互动CTA）
关键：必须包含模特全身展示、单品标注、价格标签、风格对比、OOTD`,
  "美妆护肤": `视觉：美妆杂志风，柔和自然光，面部/产品特写
封面：产品+使用效果+标题
P1：美妆单品总览（产品全貌+核心功效标签+适合肤质+价格，柔粉/米色背景，杂志感排版）
P2：产品参数+质地特写+评分
P3：成分功效分析图
P4：使用步骤教程
P5：Before/After效果对比
P6：优缺点+评分
P7：横向对比
P8：总结推荐
禁止：❌冷硬光线 ❌无成分/功效说明`,
  "数码3C": `视觉：科技产品摄影，冷白/深灰背景
封面：产品场景图+标题+核心卖点
P1：数码产品概览（产品全景+核心参数标签+价格，科技感排版，冷色调背景，参数围绕产品排列）
P2：产品全景+环绕参数标签
P3：拆解爆炸图（内部结构+元件标注）
P4：功能演示+界面
P5：参数对比表（本品+竞品）
P6：细节特写
P7：使用场景
P8：总结+推荐
禁止：❌暖色调 ❌无参数对比`,
  "学习干货": `视觉：知识信息图+卡片风，清爽有层次
封面：学习场景+标题+目标数据
P1：学习目录卡（核心方法/学习目标+时间规划+难度标签，卡片式排版，清爽蓝白配色）
P2-P7：方法步骤/避坑对比/资源推荐
P8：总结+CTA
禁止：❌纯文字无图 ❌排版千篇一律`,
  "职场干货": `视觉：商务知识卡，简洁有力
封面：办公场景+标题+核心数据
P1：职场知识目录（核心方法论+适用人群+核心数据标签，商务蓝/灰配色，简洁卡片式排版）
P2-P7：方法论/清单/案例/对比
P8：总结+行动建议
禁止：❌信息堆砌无层次`,
  "家居家装": `视觉：家居实景杂志风
封面：改造后全景+标题+花费
P1：改造前全景（房间原貌+核心问题标注+改造目标+预算区间，暖米色底，对比前状态展示）
P2：Before/After对比
P3-P5：各分区展示+单品标注
P6：好物推荐清单
P7：避坑Tips
P8：费用明细+总结
禁止：❌无人的空房间`,
  "健身减肥": `视觉：运动健身风，明亮活力
封面：运动场景+标题+成果数据
P1：健身计划总览（训练目标+时长+频率+核心动作概览，明亮活力配色，动感排版）
P2：数据总览+时间线
P3-P6：训练方法+动作图解
P7：饮食+食谱
P8：成果对比+CTA
禁止：❌无数据 ❌排版单一`,
  "美妆·化妆教程": `视觉：步骤式教程，柔和自然光
封面：完妆效果+标题
P1：妆容总览（完妆效果+所需产品清单+难度等级+预计用时，柔粉/浅米背景，优雅排版）
P2-P7：分步教程（底妆/眼妆/唇妆等）
P8：产品清单+总结
禁止：❌步骤不清 ❌无产品标注`,
  "情感共鸣": `视觉：治愈系文字+氛围感+留白
封面：大号金句+小装饰
P1：开篇引语（核心情感主题的大字，配柔和氛围插画或渐变背景，留白多，营造温暖治愈感）
P2-P7：每页一条感悟+留白
P8：回顾+互动
禁止：❌排版拥挤 ❌色彩艳丽`,
  "影视推荐": `视觉：影视海报+评分推荐卡
封面：多部拼接+标题
P1：片单总览（多部推荐剧集封面缩略图网格排列+类型标签+豆瓣评分，标题居中或左上，电影感排版）
P2-P7：每部一页（海报+评分+推荐语）
P8：总结+互动
禁止：❌海报太小 ❌无评分`,
  "一人食": `视觉：美食食谱卡，暖白/米色调
封面：成品+标题+时长
P2-P6：各天食谱（食材+步骤）
P7：备餐技巧
P8：总结
禁止：❌步骤不清 ❌食物不可口`,
  "美甲": `视觉：精致美甲展示，手部特写
封面：完成款+标题+色号
P2-P7：各款展示/步骤/对比
P8：总结
禁止：❌手部太小 ❌无颜色标注`,
  "书单推荐": `视觉：文艺书本实拍+金句卡
封面：书本堆叠+标题+数量
P2-P7：每本（封面+金句+推荐语+评分）
P8：总结+互动
禁止：❌书太小 ❌无推荐理由`,
  "健康养生": `视觉：自然食材+功效卡片风
封面：食材+标题+功效
P2-P7：食材拆解+功效/做法/注意
P8：总结
禁止：❌食材模糊 ❌无功效说明`,
  "通用": `视觉：小红书信息图，干净明亮浅色底
封面：标题+主视觉
P2-P7：按内容逻辑排列
P8：总结
禁止：❌文字堆砌 ❌无配图`,
};

const VISUAL_PLANNING_UP = `根据以下内容方案和品类，生成8条内容页图片创作提示词，以及1条封面图提示词。

【重要】每张图片的内容必须反映对应页面的title/hook/layout_hint，赛道视觉模板只提供排版和样式参考，具体的画面主体（人物、产品、场景、服饰等）必须来自页面内容本身。

内容方案：
{{analysis_result}}
品类：{{category}}

输出JSON，包含visual_system、cover_prompt（封面独立）、image_prompts数组（8条，page_id 1-8）。
每条prompt包含：竖图3:4 + 该赛道对应页固定版式 + 赛道配色 + 留5%边距。prompt中必须描述图片里要出现的中文文字内容（标题、价格、标签等），用英文说明文字位置和内容。
`;


// ============================================================
// 工作流：视觉规划
// ============================================================
async function visualPlanning(analysisResult, { creativeDirection = null } = {}) {
  if (creativeDirection) {
    return compileDynamicXhsVisual({ analysis: analysisResult, direction: creativeDirection });
  }
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const analysisStr = JSON.stringify({
    category: analysisResult.category,
    title: analysisResult.title,
    pages: (analysisResult.pages || []).map(p => ({
      page_id: p.page_id, title: p.title, hook: p.hook,
      story: p.story, info_blocks: p.info_blocks, layout_hint: p.layout_hint
    }))
  }, null, 2);
  const categoryKey = analysisResult.category;
  const catRules = CATEGORY_RULES[categoryKey] || CATEGORY_RULES["通用"] || CATEGORY_RULES["好物评测"];
  const sysPrompt = VISUAL_PLANNING_SP
    .replace(/{{category}}/g, categoryKey)
    .replace(/{{category_rules}}/g, catRules)
    .replace(/{{current_year}}/g, String(currentYear))
    .replace(/{{current_month}}/g, String(currentMonth));
  const userPrompt = VISUAL_PLANNING_UP
    .replace('{{analysis_result}}', analysisStr)
    .replace('{{category}}', analysisResult.category)
    .replace(/{{current_year}}/g, String(currentYear))
    .replace(/{{current_month}}/g, String(currentMonth));

  let raw = await callLLM(sysPrompt, userPrompt, { temperature: 0.7, maxTokens: 22000 });
  raw = raw.replace(/20(?:2[0-9]|3[0-9])[年]?/g, `${currentYear}年`).replace(/20(?:2[0-9]|3[0-9])/g, String(currentYear));
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  raw = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  raw = raw.replace(/\r?\n|\r/g, ' ');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    // 智能修复：尝试提取最外层JSON对象
    let fixed = raw.replace(/\}\s*\{/g, '},{').replace(/\]\s*\{/g, '],{').replace(/\}\s*\[/g, '},[');
    // 尝试补全不完整的JSON末尾
    if (raw.indexOf('"cover_prompt"') > 0 && raw.indexOf('"image_prompts"') > 0) {
      const lastBrace = raw.lastIndexOf('}');
      const expectedEnd = raw.lastIndexOf('"}]}');
      if (lastBrace < 0 && expectedEnd < 0) fixed = raw + '}]}}';
      else if (raw.lastIndexOf('}') < raw.length - 1 && raw.lastIndexOf('}') > raw.length - 10) fixed = raw + '}';
    }
    fixed += fixed.endsWith('}') ? '' : '"}]}}';
    try {
      const m = fixed.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
      else throw new Error('No JSON object found');
    } catch (e2) {
      try {
        const clean = raw.replace(/[^\x20-\x7E一-鿿　-〿＀-￯{},:\[\]\"\-. ]/g, '') + '"}]}}';
        const m = clean.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
        else throw new Error('No JSON after clean');
      } catch (e3) {
        throw new Error('视觉规划JSON解析失败: ' + raw.slice(0, 200));
      }
    }
  }

  let prompts = (parsed.image_prompts || [])
    .filter(p => p.page_id && p.page_id > 1)
    .sort((a, b) => a.page_id - b.page_id);

  const needed = 8;
  if (prompts.length < needed && analysisResult.pages) {
    const existingIds = new Set(prompts.map(p => p.page_id));
    for (let pageId = 1; pageId <= 8; pageId++) {
      if (!existingIds.has(pageId)) {
        const page = analysisResult.pages.find(p => p.page_id === pageId);
        const story = page?.story || '';
        const title = page?.title || '';
        prompts.push({
          page_id: pageId,
          prompt: `Xiaohongshu poster, vertical 3:4, info-graphic style. Include Chinese text labels, price tags, and titles visible on the image. Showing: ${title || 'scene'}. Clean layout, professional, readable Chinese text.`
        });
      }
    }
    prompts.sort((a, b) => a.page_id - b.page_id);
  }

    return {
      visualSystem: parsed.visual_system || analysisResult.category,
      coverPrompt: parsed.cover_prompt || '',
      imagePrompts: prompts,
    };
}

// ============================================================
// 工作流：图片生成（并发，队列管理）
// ============================================================
async function generateAllImages(coverPrompt, imagePrompts) {
  const allPrompts = [
    { id: 'cover', prompt: coverPrompt },
    ...imagePrompts.map(p => ({ id: `p${p.page_id}`, prompt: p.prompt })),
  ];
  const results = [];
  const queue = [...allPrompts];
  const failed = new Set();
  const MAX_WORKERS = 5;

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      if (failed.has(task.id)) continue;
      try {
        const url = await generateImage(task.prompt, task.category || '通用');
        results.push({ id: task.id, url });
        console.log(`[gen] ${task.id} ok (${results.filter(r=>r.url).length}/${allPrompts.length})`);
      } catch (err) {
        console.error(`[gen] ${task.id} failed: ${err.message}. Not retrying.`);
        failed.add(task.id);
      }
    }
  }

  const workers = Array.from({ length: Math.min(MAX_WORKERS, allPrompts.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ============================================================
// 工作流：结果组装
// ============================================================
function assembleResults(analysis, visual, imageResults) {
  const coverResult = imageResults.find(r => r.id === 'cover');
  const contentResults = imageResults
    .filter(r => r.id !== 'cover')
    .sort((a, b) => {
      const na = parseInt(a.id.replace('p', ''));
      const nb = parseInt(b.id.replace('p', ''));
      return na - nb;
    });

  function extractPath(url) {
    try { return url.replace(/\?.*$/, ''); } catch(e) { return url; }
  }
  const seenPaths = new Set();
  let uniqueUrls = contentResults
    .map(r => r.url)
    .filter(Boolean)
    .filter(url => {
      const path = extractPath(url);
      if (seenPaths.has(path)) return false;
      seenPaths.add(path);
      return true;
    });

    // ===== 封面二次校验：封面URL不能出现在内容列表中 =====
    if (coverResult?.url) {
      const coverPath = extractPath(coverResult.url);
      uniqueUrls = uniqueUrls.filter(u => extractPath(u) !== coverPath);
    }
return {
    title: analysis.title,
    body_text: analysis.body_text,
    hashtags: analysis.hashtags,
    tags: analysis.tags,
    category: analysis.category,
    visual_system: visual.visualSystem,
    pages: analysis.pages,
    cover_prompt: visual.coverPrompt,
    image_prompts: visual.imagePrompts,
    cover_url: coverResult?.url || '',
    image_urls: uniqueUrls,
    image_count: uniqueUrls.length,
  };
}

// ============================================================
// 单张图片重新生成
// ============================================================
app.post('/api/regenerate-image', async (req, res) => {
  const {
    prompt,
    category,
    ratio = '1:1',
    resolution = '2K',
    billing_quote_id: quoteId,
    billing_action_id: actionId,
  } = req.body;
  if (!prompt) return res.status(400).json({ error: '缺少prompt' });
  try {
    const selectedSize = resolveGenerationSize({ resolution, ratio });
    const feature = ecommerceFeatureForItem({ imageModel: 'image2', generationSize: selectedSize.size });
    const billed = await canvasOneShotBilling.execute({
      ownerEmail: req._userEmail,
      quoteId,
      actionId,
      sku: feature.sku,
      referenceType: 'legacy_image_regeneration',
      providerCostCny: feature.providerCostCny,
      metadata: { action: 'regenerate_image', imageModel: 'image2' },
      work: async () => {
        const url = await generateImage(prompt, category || '', false, undefined, selectedSize.size);
        if (!url) throw new Error('生成失败');
        return { url, ratio: selectedSize.ratio, resolution: selectedSize.resolution };
      },
    });
    res.json({ ...billed.result, billing: billed.billing });
  } catch (err) {
    res.status(err?.status || 500).json({
      error: safeCanvasClientError(err, '图片重生成失败，请稍后重试'),
      code: err?.code,
      required: err?.required,
      available: err?.available,
      billing: err?.billing,
    });
  }
});
app.post('/api/regenerate-text', async (req, res) => {
  const { text, category, billing_quote_id: quoteId, billing_action_id: actionId } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: '请输入内容' });
  try {
    const billed = await canvasOneShotBilling.execute({
      ownerEmail: req._userEmail,
      quoteId,
      actionId,
      sku: 'ec_ai_assistant',
      referenceType: 'legacy_text_regeneration',
      providerCostCny: 0.01,
      metadata: { action: 'regenerate_text', category: category || '' },
      work: async () => {
        const analysis = await contentAnalysis(text);
        return {
          title: analysis.title || '',
          body_text: analysis.body_text || '',
          hashtags: analysis.hashtags || [],
          category: analysis.category || category || '',
          pages: analysis.pages || [],
          url: `regenerate-text:${crypto.createHash('sha256').update(JSON.stringify(analysis)).digest('hex')}`,
        };
      },
    });
    res.json({ ...billed.result, billing: billed.billing });
  } catch (err) {
    res.status(err?.status || 500).json({ error: safeCanvasClientError(err, '文案重生成暂时不可用，请稍后重试'), code: err?.code, required: err?.required, available: err?.available, billing: err?.billing });
  }
});


// ============================================================
// API 路由
// ============================================================

// P2（封面后第一张）完全独立生成——基于用户原始输入构造，不走 LLM 视觉规划
function buildP2SafePrompt(analysis, userText) {
  const p2Page = (analysis.pages || []).find(p => p.page_id === 1);
  if (!p2Page) {
    console.log('[P2] WARN: no page data, fallback to topic prompt');
    const t = (userText || '').replace(/\p{Emoji}/gu, '').trim().slice(0, 60);
    const fb = 'Xiaohongshu poster, vertical 3:4. A clean scene with Chinese text "' + t + '" visible. Chinese text annotations required. Professional photography.';
    console.log('[P2] fallback len=' + fb.length);
    return fb;
  }

  const title = p2Page.title || '';
  const story = (p2Page.story || '').slice(0, 80);
  const cat = analysis.category || '';
  // 从用户原始输入提取核心主题（去掉 emoji 和空格）
  const topic = (userText || '').replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]/gu, '').trim().slice(0, 60);

  // 【全新思路】每个赛道写死一个强绑定的 prompt，把用户原文嵌入其中，
  // 确保图片内容 100% 围绕主题，不给 AI 任何自由发挥空间
  let prompt;
  if (/学习干货|书单推荐/.test(cat)) {
    prompt = `A wooden study desk. ON THE DESK: 1) An open textbook with Chinese title "${topic}" on its cover page. 2) A black ballpoint pen resting on the book. 3) A yellow highlighter. 4) A cup of coffee. Soft natural window light. The textbook shows Chinese text clearly. DO NOT show skincare, beauty products, or fashion items.`;
  } else if (/旅游攻略/.test(cat)) {
    prompt = `A travel planning desk. ON THE DESK: 1) A printed travel map with Chinese labels. 2) A passport. 3) A camera. 4) A coffee cup. 5) A luggage tag with "${topic}" in Chinese. Natural sunlight. Travel mood. Chinese text labels visible.`;
  } else if (/美食探店|一人食/.test(cat)) {
    prompt = `A restaurant dining table. ON THE TABLE: 1) A plate of delicious food. 2) Chopsticks. 3) A Chinese menu showing "${topic}". 4) A small price tag. Warm golden lighting, steam rising from the dish. Chinese text visible.`;
  } else if (/好物评测/.test(cat)) {
    prompt = `A clean white surface. ON THE SURFACE: 1) The product being reviewed with Chinese label "${topic}". 2) A handwritten review card in Chinese. 3) A price tag. Soft studio lighting. Chinese product labels clearly visible.`;
  } else if (/穿搭分享/.test(cat)) {
    prompt = `Studio fashion photography. An adult female model (age 25-28). SHE WEARS: a navy blue blouse with wide sailor-style collar and white trim, a red ribbon necktie, a gray pleated mini skirt, knee-high socks, and black leather shoes. Full body shot facing forward. Clean light gray background. Soft studio lighting. Chinese price labels visible on each clothing item. Fashion editorial style. NO office wear, NO business suit.`;
  } else if (/美妆护肤|美妆·化妆教程/.test(cat)) {
    prompt = `A clean white vanity table. ON THE TABLE: 1) Skincare products with Chinese label "${topic}". 2) A mirror. 3) Small price tags in Chinese. Soft natural light. Clean minimal composition. Chinese labels visible.`;
  } else if (/数码3C/.test(cat)) {
    prompt = `A dark gray surface. ON THE SURFACE: 1) The tech product with Chinese label "${topic}". 2) Product specs card in Chinese. 3) A price tag. Dramatic side lighting, metallic reflections. Chinese text visible.`;
  } else if (/职场干货/.test(cat)) {
    prompt = `A clean office desk. ON THE DESK: 1) An open notebook with Chinese handwriting "${topic}". 2) A laptop. 3) A coffee cup. 4) A pen holder. Natural light streaming in. Clean minimalist workspace. Chinese sticky notes visible.`;
  } else if (/家居家装/.test(cat)) {
    prompt = `A cozy room interior. IN THE ROOM: 1) A comfortable sofa. 2) A coffee table with a Chinese home magazine showing "${topic}". 3) A potted plant. 4) Warm throw pillows. Natural light through curtains. Scandinavian style. Chinese furniture labels visible.`;
  } else if (/健身减肥/.test(cat)) {
    prompt = `A clean workout space. IN THE SPACE: 1) A yoga mat. 2) A pair of dumbbells. 3) A water bottle. 4) A Chinese fitness guide with "${topic}". Bright natural light. Clean workout area. Chinese fitness text visible.`;
  } else if (/情感共鸣/.test(cat)) {
    prompt = `A cozy corner. IN THE SCENE: 1) A warm desk lamp. 2) An open book. 3) A cup of tea. 4) A handwritten Chinese quote about "${topic}". Soft warm lighting. Peaceful mood. Chinese calligraphy text visible.`;
  } else if (/影视推荐/.test(cat)) {
    prompt = `A cinematic display. ON THE DISPLAY: Chinese text "${topic}" in large film-poster style typography. Dark background with warm gold accent lighting. Chinese title and rating visible.`;
  } else {
    prompt = `A clean scene related to "${topic}". ${title}. Chinese text labels visible. Soft natural lighting, professional photography.`;
  }

  // 加上通用前缀和后缀，保证生成质量和中文文字
  const prefix = 'Xiaohongshu poster, vertical 3:4, photo-realistic, photography style. ';
  const suffix = ' Chinese text annotations REQUIRED. Leave 5% margin from ALL edges. Portrait ONLY. High quality, detailed, professional.';
  const full = prefix + prompt + suffix;
  if (full.length > 700) return full.slice(0, 697) + '...';
  return full;
}

function buildXhsPreviewCoverPrompt(text) {
  const topic = String(text || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  return `小红书封面预览，主题“${topic}”，简洁中文大标题，单一视觉主体，明亮自然光，竖版3:4，不生成内容页。`;
}

async function runXhsPreview(req, res) {
  const text = String(req.body?.text || '').trim();
  return runContentPreviewSse({
    res,
    generationId: req.body?.generationId,
    mode: 'xhs',
    generateCover: async ({ generationId, send }) => {
      send('progress', { step: 'preview_cover', msg: '正在生成封面预览...' });
      const source = await generateImage(buildXhsPreviewCoverPrompt(text), '通用', true, false);
      const url = await persistGeneratedAsset({ source, generationId, label: 'xhs-preview-cover' });
      return {
        url,
        delivery: {
          title: text.slice(0, 30),
          body_text: text,
          hashtags: [],
          category: '预览',
          visual_system: 'preview',
          cover_url: url,
          image_urls: [],
          image_count: 0,
        },
      };
    },
  });
}

async function generateXhsContentSet({ text, images, referenceGroups, send, generationId, workId }) {
  console.log('\n=== 开始工作流: "' + text.slice(0, 40) + '..." ===');
  send('progress', { step: 'content_analysis', msg: '正在分析内容...' });
  const creativeDirection = deriveXhsCreativeDirection(generationId || text);
  const groups = normalizeReferenceGroups(referenceGroups || { style: images });
  if (!groups.style.length && Array.isArray(images)) groups.style = images.slice(0, 3);

  // 【XHS 参考图 Vision 分析】
  let visionContext = '';
  const visionImages = [...groups.style, ...groups.source].slice(0, 6);
  if (visionImages.length) {
    send('progress', { step: 'vision', msg: '正在分析参考图...' });
    try {
      const styleCount = groups.style.length;
      const visionPrompt = `你是一个小红书内容与视觉分析专家。分析这些参考图，严格区分“风格参考”和“我的素材”。风格参考只提取可复用的方法，不要照抄具体文案、人物、商品或构图；我的素材只记录能直接确认的主体、环境和物件事实。用 JSON 返回：
{
  "color_palette": ["#hex1", "#hex2", "#hex3"],
  "style_vibe": "风格描述（简约/清新/复古/治愈/高级/可爱等）",
  "mood": "整体氛围",
  "lighting": "光线特色",
  "composition": "构图特点",
  "subject_facts": ["能从图中直接确认的主体或场景"],
  "narrative_pattern": "这些图如何组织信息和推进阅读",
  "text_hierarchy": "标题、副标题、标签和正文的层级关系",
  "reusable_principles": ["可借鉴但不照抄的设计原则"],
  "aesthetic_tags": ["标签1", "标签2"]
}\n本次输入顺序：前 ${styleCount} 张是风格参考，后面是我的素材。`;
      const visionResult = await callMiniLLM(
        visionPrompt,
        visionImages,
        '分析这些参考图的视觉风格',
        { signal: AbortSignal.timeout(45_000) },
      );
      const parsed = JSON.parse((visionResult || '{}').replace(/```(json)?/g, '').trim());
      if (parsed?.color_palette?.length || parsed?.style_vibe) {
          visionContext = '\n\n[参考图视觉特征]\n' +
            (parsed.style_vibe ? `风格：${parsed.style_vibe}\n` : '') +
          (parsed.mood ? `氛围：${parsed.mood}\n` : '') +
          (parsed.color_palette?.length ? `色调：${parsed.color_palette.join('、')}\n` : '') +
          (parsed.lighting ? `光线：${parsed.lighting}\n` : '') +
          (parsed.composition ? `构图：${parsed.composition}\n` : '') +
          (parsed.subject_facts?.length ? `可确认主体：${parsed.subject_facts.join('、')}\n` : '') +
            (parsed.narrative_pattern ? `内容组织：${parsed.narrative_pattern}\n` : '') +
            (parsed.text_hierarchy ? `文字层级：${parsed.text_hierarchy}\n` : '') +
            (parsed.reusable_principles?.length ? `可借鉴原则：${parsed.reusable_principles.join('、')}\n` : '') +
            (groups.source.length ? `我的素材只可确认：${parsed.subject_facts?.join('、') || '以生成任务中的用户素材为准'}\n` : '');
      }
    } catch (e) {
      console.warn('[XHS Vision] 参考图分析失败（不阻断）:', e.message);
    }
  }

  send('progress', { step: 'creative_plan', msg: `正在形成${creativeDirection.name}内容方案...` });
  const analysis = await contentAnalysis(text, { creativeDirection, visionContext });
  send('progress', { step: 'visual_planning', msg: '正在规划视觉...' });
  const visual = await visualPlanning(analysis, { creativeDirection });

  // 并发生图（每完成一张就推送）
  const allPrompts = [
    { id: 'cover', index: 0, reference_use: groups.source.length ? 'subject' : 'none', prompt: visual.coverPrompt, category: analysis.category },
    ...visual.imagePrompts.map(p => ({ ...p, id: 'p' + p.page_id, index: p.page_id, prompt: p.prompt, category: analysis.category })),
  ];

  // ===== 产品类赛道（美妆护肤/好物评测/数码3C等）内容页强制显示产品 =====
  const productCats = ['美妆护肤','美妆·化妆教程','好物评测','数码3C'];
  allPrompts.forEach(t => {
    if (t.id !== 'cover' && productCats.some(c => analysis.category?.includes(c))) {
      t.prompt = (t.prompt || '') + ' The product with Chinese price label must be clearly visible.';
    }
  });

  // 【关键】全局检测：如果这组prompts中任何一张涉及JK制服，所有图都追加制服风格描述
  const jkKeywordsGlobal = [/水手服/,/JK/,/制服/,/百褶裙/,/领结/,/sailor/i,/seifuku/i,/校服/,/校园/,/日系/];
  const hasJKContext = allPrompts.some(t => jkKeywordsGlobal.some(k => k.test(t.prompt))) ||
    (analysis.pages || []).some(p => /水手服|JK|制服|校服|校园|日系/.test(JSON.stringify(p)));
  allPrompts.forEach(t => t.jkContext = hasJKContext);
  if (hasJKContext) console.log('[JK context] 全部 ' + allPrompts.length + ' 张图启用校园风覆盖模式');

  send('progress', { step: 'generating_images', msg: '正在生成图片...', total: allPrompts.length });
  const results = await generateCompleteImageSet({
    tasks: allPrompts,
    execute: async task => {
      const sourceInputs = selectSourceInputs({ groups, task });
      const source = await generateImage(
        task.prompt,
        task.category,
        task.id === 'cover',
        task.jkContext,
        undefined,
        sourceInputs,
      );
      return await persistGeneratedAsset({ source, generationId, label: `xhs-${task.id}` });
    },
    onComplete: entry => {
      send('image', { ...entry, generationId, workId });
    },
    onAttemptFailure: ({ task, phase, attempt, attempts, error }) => {
      console.error('[gen]', task.id, phase, 'attempt', `${attempt}/${attempts}`, 'failed:', error.message);
    },
  });

  send('progress', { step: 'assembling', msg: '正在组装结果...' });
  const result = assembleResults(analysis, visual, results);
  const delivery = {
    title: analysis.title,
    body_text: analysis.body_text,
    hashtags: analysis.hashtags,
    category: analysis.category,
    visual_system: visual.visualSystem,
    pages: analysis.pages,
    cover_url: result.cover_url || '',
    image_urls: result.image_urls || [],
    image_count: result.image_count || 0,
    cover_prompt: visual.coverPrompt || '',
    image_prompts: (visual.imagePrompts || []).map(p => ({ page_id: p.page_id, prompt: p.prompt })),
    creative_direction: analysis.creative_direction || creativeDirection.id,
    creative_seed: analysis.creative_seed || creativeDirection.seed,
    creative_brief: analysis.creative_brief || null,
    reference_usage: referenceUsageLabel(groups),
    reference_assets: { style_count: groups.style.length, source_count: groups.source.length },
  };
  if (!isCompleteContentDelivery(delivery)) {
    const error = new Error('生成结果未形成九张唯一稳定图片，额度将原路退回');
    error.code = 'CONTENT_IMAGE_SET_INCOMPLETE';
    error.retryable = true;
    throw error;
  }
  return delivery;
}

function contentProjectReferenceGroups({ referenceAssets, referenceAssetIds } = {}) {
  const valid = value => /^[a-f0-9]{64}\.(?:jpg|png|webp)$/i.test(String(value || '').trim())
    ? String(value).trim()
    : '';
  const unique = values => [...new Set((Array.isArray(values) ? values : []).map(valid).filter(Boolean))];
  const groups = referenceAssets && typeof referenceAssets === 'object' ? referenceAssets : {};
  const fallback = unique(referenceAssetIds);
  return {
    style: unique(Array.isArray(groups.style) ? groups.style : fallback),
    source: unique(groups.source),
  };
}

app.post('/api/generate', async (req, res) => {


// 4c183cd4 续命 P1 月卡签到
app.post('/api/billing/checkin', async (req, res) => {
  try {
    const ownerEmail = req.body?.ownerEmail;
    if (!ownerEmail) return res.status(400).json({ ok: false, reason: 'missing-ownerEmail' });
    const result = await dailyCheckin({ ownerEmail });
    res.status(result.ok ? 200 : 409).json(result);
  } catch (e) {
    res.status(500).json({ ok: false, reason: e.message });
  }
});
  const { text, images, referenceAssetIds, referenceAssets } = req.body || {};
  if (!text?.trim()) return sendContentInputError(res);
  if (req._contentPreview === true) return runXhsPreview(req, res);
  let resolvedReferenceGroups;
  try {
    resolvedReferenceGroups = await resolveContentReferenceGroups({
      ownerEmail: req._userEmail,
      referenceAssets,
      referenceAssetIds,
      legacyImages: images,
      assetUploadService: ecommerceAssetUploadService,
      generatedAssetStore,
    });
  } catch (error) {
    return res.status(error?.status || 422).json({ error: error?.message || '参考素材不可用' });
  }
  return runBilledContentSse({
    res,
    ownerEmail: req._userEmail,
    generationId: req.body?.generationId,
    mode: 'xhs',
    projectInput: { referenceGroups: contentProjectReferenceGroups({ referenceAssets, referenceAssetIds }) },
    generate: context => generateXhsContentSet({ ...context, text: text.trim(), referenceGroups: resolvedReferenceGroups }),
  });
});

app.post('/api/analyze', async (req, res) => {
  const { text, billing_quote_id: quoteId, billing_action_id: actionId } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: '请输入内容' });
  try {
    const billed = await canvasOneShotBilling.execute({
      ownerEmail: req._userEmail,
      quoteId,
      actionId,
      sku: 'ec_ai_assistant',
      referenceType: 'legacy_content_analysis',
      providerCostCny: 0.01,
      metadata: { action: 'analyze' },
      work: async () => {
        const analysis = await contentAnalysis(text);
        return { ...analysis, url: `content-analysis:${crypto.createHash('sha256').update(JSON.stringify(analysis)).digest('hex')}` };
      },
    });
    res.json({ ...billed.result, billing: billed.billing });
  } catch (err) {
    res.status(err?.status || 500).json({ error: safeCanvasClientError(err, '内容分析暂时不可用，请稍后重试'), code: err?.code, required: err?.required, available: err?.available, billing: err?.billing });
  }
});

// ============================================================
// 作品存储
// ============================================================
const WORKS_PATH = resolve(__dirname, 'works.json');
const SNAP_DIR = resolve(__dirname, 'backups');
function loadWorks() {
  try {
    if (fs.existsSync(WORKS_PATH)) {
      const data = JSON.parse(fs.readFileSync(WORKS_PATH, 'utf8'));
      // 主文件正常（非空数组）直接返回
      if (Array.isArray(data) && data.length > 0) return data;
      // 主文件异常（空数组等），尝试从备份恢复
      if (Array.isArray(data) && data.length === 0) {
        console.warn('[loadWorks] 主文件为空，尝试从备份恢复...');
        for (const ext of ['.bak1', '.bak2', '.bak3']) {
          const bakPath = WORKS_PATH + ext;
          if (fs.existsSync(bakPath)) {
            try {
              const bak = JSON.parse(fs.readFileSync(bakPath, 'utf8'));
              if (Array.isArray(bak) && bak.length > 0) {
                fs.writeFileSync(WORKS_PATH, JSON.stringify(bak), 'utf8');
                console.log('[loadWorks] 从 ' + ext + ' 恢复成功，共 ' + bak.length + ' 条');
                return bak;
              }
            } catch(e) { continue; }
          }
        }
        // 从快照目录恢复最新的
        try {
          if (fs.existsSync(SNAP_DIR)) {
            const snaps = fs.readdirSync(SNAP_DIR).filter(f => f.startsWith('works-') && f.endsWith('.json')).sort();
            if (snaps.length > 0) {
              const last = JSON.parse(fs.readFileSync(join(SNAP_DIR, snaps[snaps.length-1]), 'utf8'));
              if (Array.isArray(last) && last.length > 0) {
                fs.writeFileSync(WORKS_PATH, JSON.stringify(last), 'utf8');
                console.log('[loadWorks] 从快照 ' + snaps[snaps.length-1] + ' 恢复成功');
                return last;
              }
            }
          }
        } catch(e) {}
      }
    }
  } catch(e) {
    // JSON 解析失败，尝试从备份恢复
    console.warn('[loadWorks] 主文件损坏，尝试从备份恢复...');
    for (const ext of ['.bak1', '.bak2', '.bak3']) {
      const bakPath = WORKS_PATH + ext;
      if (fs.existsSync(bakPath)) {
        try {
          const bak = JSON.parse(fs.readFileSync(bakPath, 'utf8'));
          if (Array.isArray(bak) && bak.length > 0) {
            fs.writeFileSync(WORKS_PATH, JSON.stringify(bak), 'utf8');
            console.log('[loadWorks] 从 ' + ext + ' 恢复成功');
            return bak;
          }
        } catch(e) { continue; }
      }
    }
  }
  return [];
}
function saveWorks(works) {
  try {
    const now = new Date();
    const ts = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0') + 'T' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0') + String(now.getSeconds()).padStart(2,'0');
    const data = JSON.stringify(works.slice(0, 100));

    // ① 轮转备份：保留最近3份
    try {
      if (fs.existsSync(WORKS_PATH + '.bak2')) fs.renameSync(WORKS_PATH + '.bak2', WORKS_PATH + '.bak3');
      if (fs.existsSync(WORKS_PATH + '.bak1')) fs.renameSync(WORKS_PATH + '.bak1', WORKS_PATH + '.bak2');
      if (fs.existsSync(WORKS_PATH)) fs.copyFileSync(WORKS_PATH, WORKS_PATH + '.bak1');
    } catch(e) {}

    // ② 原子替换主文件，避免进程在写入中途退出留下半截 JSON。
    const tmpPath = `${WORKS_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, data, 'utf8');
    fs.renameSync(tmpPath, WORKS_PATH);

    // ③ 时间戳快照（每天最多保留30份，自动清理旧快照）
    const SNAP_DIR = resolve(__dirname, 'backups');
    try {
      if (!fs.existsSync(SNAP_DIR)) fs.mkdirSync(SNAP_DIR, { recursive: true });
      const snapPath = join(SNAP_DIR, 'works-' + ts + '.json');
      fs.writeFileSync(snapPath, data, 'utf8');
      // 清理超过30份的旧快照
      const snaps = fs.readdirSync(SNAP_DIR).filter(f => f.startsWith('works-') && f.endsWith('.json')).sort();
      while (snaps.length > 30) {
        fs.unlinkSync(join(SNAP_DIR, snaps[0]));
        snaps.shift();
      }
    } catch(e) {}

    // ④ 校验：读回来确认一致
    try {
      const verify = fs.readFileSync(WORKS_PATH, 'utf8');
      if (verify === data) {
        console.log('[saveWorks] ✓ ' + works.length + ' 条作品已保存');
        return true;
      } else {
        console.error('[saveWorks] ⚠ 写入校验失败，长度不匹配');
        return false;
      }
    } catch(e) {
      console.error('[saveWorks] ⚠ 校验读取失败:', e.message);
      return false;
    }
  } catch(e) {
    console.error('[saveWorks] 保存失败:', e.message);
    return false;
  }
}
mountWorkRoutes(app, {
  authenticateOwner(req) {
    return authenticateContentRequest(req, {
      sessionTokens: contentSessionTokens,
      authorizeEmail: authorizeAccountEmail,
    });
  },
  mapError: contentBillingHttpError,
  listWorks: ownerEmail => getAllWorks({ ownerEmail }).map(work => {
    const decorated = decorateOwnedWorkPlayback(work, {
      ownerEmail,
      resolveAssetPlaybackUrl: ({ asset, ownerEmail: owner }) => (
        videoGeneration.playbackUrlForAsset(asset.assetId, owner)
      ),
    });
    return {
      ...decorated,
      retention: retentionService.describeWork({ ownerEmail, work }),
    };
  }),
  listTrash: ownerEmail => getDeletedWorks({ ownerEmail }).map(work => decorateOwnedWorkPlayback(work, {
    ownerEmail,
    resolveAssetPlaybackUrl: ({ asset, ownerEmail: owner }) => (
      videoGeneration.playbackUrlForAsset(asset.assetId, owner)
    ),
  })),
  saveOwnedWork: (work, ownerEmail) => upsertWork(work, { ownerEmail }),
  deleteOwnedWork: (saveKey, ownerEmail) => softDeleteWork(saveKey, { ownerEmail }),
  restoreOwnedWork: (saveKey, ownerEmail) => restoreWork(saveKey, { ownerEmail }),
});

// ── 公开图片路由限频：/api/proxy-image 与 /api/public-image 属公开展示设计（无会话语义），
// 不改语义，仅按 IP 限频防盗刷；loopback 豁免（服务器内部 /api/image-proxy 自调用走 localhost）。
const IMAGE_ROUTE_RATE_LIMIT = { max: 240, windowMs: 60_000 };
const imageRouteRateStore = new Map();
function imageRouteRateLimiter(req, res, next) {
  const ip = getClientIp(req);
  if (/^(?:127\.|::1$|::ffff:127\.)/i.test(ip)) return next();
  const bucket = Math.floor(Date.now() / IMAGE_ROUTE_RATE_LIMIT.windowMs);
  const key = `${ip}:${bucket}`;
  const count = (imageRouteRateStore.get(key) || 0) + 1;
  imageRouteRateStore.set(key, count);
  if (imageRouteRateStore.size > 20000) {
    for (const storeKey of imageRouteRateStore.keys()) {
      if (bucket - Number(storeKey.split(':').pop()) > 2) imageRouteRateStore.delete(storeKey);
    }
  }
  if (count > IMAGE_ROUTE_RATE_LIMIT.max) {
    console.warn(`[rate-limit] ${ip} 超限 ${count}/${IMAGE_ROUTE_RATE_LIMIT.max} on ${req.path}`);
    return res.status(429).end('too many requests');
  }
  return next();
}

// 图片代理：远端图片只下载一次，并为列表与画布提供 WebP 派生尺寸。
app.get('/api/proxy-image', imageRouteRateLimiter, async (req, res) => {
  const url = String(req.query.url || '');
  const variant = String(req.query.variant || 'full');
  const format = String(req.query.format || 'webp');
  if (!url) return res.status(400).end('missing url');
  try {
    const image = await imageDelivery.readProxyVariant(url, variant, format);
    res.set('Content-Type', image.contentType);
    res.set('Cache-Control', variant === 'full' ? 'public, max-age=3600' : 'public, max-age=86400');
    res.set('Access-Control-Allow-Origin', '*');
    res.send(image.buffer);
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('invalid remote') || message.includes('unsupported image variant') || message.includes('unsupported image format')) return res.status(400).end('invalid image request');
    if (message.includes('not an image')) return res.status(415).end('not an image');
    if (message.includes('size limit')) return res.status(413).end('image too large');
    res.status(502).end('image temporarily unavailable');
  }
});

// 薯包出品本地图片服务
const GALLERY_DIR = resolve(__dirname, '../薯包出品');
app.get('/api/gallery-prompts', (req, res) => {
  const entries = Object.entries(GALLERY_FILE_MAP).flatMap(([id, folder]) => {
    try {
      const prompt = fs.readFileSync(join(GALLERY_DIR, folder, '提示词.txt'), 'utf8').trim();
      return prompt ? [{ id, prompt }] : [];
    } catch {
      return [];
    }
  });
  res.set('Cache-Control', 'public, max-age=300');
  res.json(entries);
});

app.get('/api/gallery-image', async (req, res) => {
  const { id, file } = req.query;
  if (!id || !file) return res.status(400).end('missing params');
  const folder = GALLERY_FILE_MAP[id];
  if (!folder) return res.status(404).end('unknown id');
  const requestedFile = String(file);
  if (basename(requestedFile) !== requestedFile) return res.status(400).end('invalid file');
  const extension = extname(requestedFile).toLowerCase();
  if (!GALLERY_IMAGE_EXTENSIONS.has(extension)) return res.status(400).end('invalid file');
  const filePath = resolve(GALLERY_DIR, folder, requestedFile);
  const variant = String(req.query.variant || 'full');
  const format = String(req.query.format || 'webp');
  try {
    const image = await imageDelivery.readLocalVariant(filePath, variant, format);
    if (!image) return res.status(404).end('file not found');
    res.set('Content-Type', image.contentType);
    res.set('Cache-Control', variant === 'full'
      ? 'public, max-age=86400'
      : 'public, max-age=31536000, immutable');
    res.send(image.buffer);
  } catch (error) {
    if (/unsupported image (?:variant|format)/.test(String(error?.message || ''))) {
      return res.status(400).end('invalid image variant');
    }
    res.status(500).end('gallery image unavailable');
  }
});

app.get('/api/public-image', imageRouteRateLimiter, async (req, res) => {
  const requestedPath = String(req.query.path || '').replaceAll('\\', '/');
  if (!requestedPath.startsWith('/images/') || requestedPath.includes('\0')) {
    return res.status(400).end('invalid image path');
  }
  const relativePath = requestedPath.slice('/images/'.length);
  const segments = relativePath.split('/');
  if (!segments.length || segments.some(segment => !segment || segment === '.' || segment === '..')) {
    return res.status(400).end('invalid image path');
  }
  const extension = extname(relativePath).toLowerCase();
  if (!GALLERY_IMAGE_EXTENSIONS.has(extension)) return res.status(400).end('invalid image file');
  const variant = String(req.query.variant || 'full');
  const format = String(req.query.format || 'webp');
  try {
    let image = null;
    for (const root of PUBLIC_IMAGE_ROOTS) {
      const filePath = resolve(root, ...segments);
      if (!filePath.startsWith(`${root}${process.platform === 'win32' ? '\\' : '/'}`)) continue;
      image = await imageDelivery.readLocalVariant(filePath, variant, format);
      if (image) break;
    }
    if (!image) return res.status(404).end('file not found');
    res.set('Content-Type', image.contentType);
    res.set('Cache-Control', variant === 'full'
      ? 'public, max-age=86400'
      : 'public, max-age=31536000, immutable');
    res.send(image.buffer);
  } catch (error) {
    if (/unsupported image (?:variant|format)/.test(String(error?.message || ''))) {
      return res.status(400).end('invalid image variant');
    }
    res.status(500).end('public image unavailable');
  }
});

function scheduleGalleryImageWarmup() {
  const covers = [];
  const thumbnails = [];
  for (const folder of Object.values(GALLERY_FILE_MAP)) {
    const directory = resolve(GALLERY_DIR, folder);
    let files = [];
    try {
      files = fs.readdirSync(directory)
        .filter(file => GALLERY_IMAGE_EXTENSIONS.has(extname(file).toLowerCase()) && !/_backup\./i.test(file))
        .sort((left, right) => left.localeCompare(right, 'zh-CN'));
    } catch {
      continue;
    }
    const cover = files.find(file => /^01(?:\D|$)/.test(file)) || files[0];
    if (cover) covers.push({
      filePath: resolve(directory, cover),
      variants: ['thumb', 'display'],
      formats: ['avif', 'webp'],
    });
    for (const file of files) {
      if (file === cover) continue;
      thumbnails.push({
        filePath: resolve(directory, file),
        variants: ['thumb'],
        formats: ['avif', 'webp'],
      });
    }
  }
  const timer = setTimeout(() => {
    void imageDelivery.prewarmLocalVariants([...covers, ...thumbnails], { concurrency: 2 })
      .catch(error => console.warn('[image-delivery] gallery warmup skipped:', error.message));
  }, 1_500);
  timer.unref?.();
}

scheduleGalleryImageWarmup();

// ============================================================
// 图片文字叠加（用 Sharp 把文字画到图片上，带内存缓存）
// ============================================================
app.get('/api/img-proxy-ping', (req, res) => res.json({ok:true}));

const overlayCache = new Map();
const OVERLAY_CACHE_DIR = resolve(__dirname, 'cache_overlay');
if (!fs.existsSync(OVERLAY_CACHE_DIR)) fs.mkdirSync(OVERLAY_CACHE_DIR, { recursive: true });

app.get('/api/image-proxy', async (req, res) => {
  const { url, title, hook, blocks } = req.query;
  if (!url) return res.status(400).end('missing url');

  // 缓存 key = url + 所有参数
  const cacheRaw = url + '|' + (title || '') + '|' + (hook || '') + '|' + (blocks || '');
  const cacheKey = crypto.createHash('md5').update(cacheRaw).digest('hex');
  const diskPath = join(OVERLAY_CACHE_DIR, cacheKey);

  // 1. 内存缓存
  if (overlayCache.has(cacheKey) && Date.now() - overlayCache.get(cacheKey).t < 1800000) {
    const mem = overlayCache.get(cacheKey);
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'max-age=600');
    return res.send(mem.d);
  }

  // 2. 磁盘缓存
  if (fs.existsSync(diskPath)) {
    try {
      const d = fs.readFileSync(diskPath);
      overlayCache.set(cacheKey, { d, t: Date.now() });
      while (overlayCache.size > 100) { const k = overlayCache.keys().next().value; overlayCache.delete(k); }
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'max-age=600');
      return res.send(d);
    } catch(e) {}
  }

  // 3. 远程获取原图（先走本地代理缓存，没有才去外部）
  try {
    let resp;
    try {
      // 先从代理缓存取（避免重复下载源站）
      const proxyUrl = `http://localhost:${PORT}/api/proxy-image?url=${encodeURIComponent(url)}`;
      resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(3000) });
    } catch(e) {
      // 代理没缓存，直接请求源站
      resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    }
    if (!resp.ok) return res.status(502).end('fetch failed');
    const buf = Buffer.from(await resp.arrayBuffer());

    // 获取图片实际尺寸
    const meta = await sharp(buf).metadata();
    const w = meta.width || 1024;
    const h = meta.height || 1366;
    const gradH = Math.round(h * 0.28);
    const gradY = h - gradH;
    const titleY = gradY + Math.round(h * 0.21);
    const hookY = gradY + Math.round(h * 0.26);
    const fontSize1 = Math.round(h * 0.023);
    const fontSize2 = Math.round(h * 0.016);

    // 生成 SVG 文字叠加层
    let svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<defs><linearGradient id="bg" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="rgba(0,0,0,0.8)"/><stop offset="100%" stop-color="transparent"/></linearGradient></defs>`;
    svg += `<rect x="0" y="${gradY}" width="${w}" height="${gradH}" fill="url(#bg)"/>`;

    // 标题（白色大字）
    if (title) {
      const displayTitle = (title || '').slice(0, 40);
      svg += `<text x="${Math.round(w * 0.029)}" y="${titleY}" font-size="${fontSize1}" fill="white" font-weight="bold" font-family="sans-serif">${displayTitle.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</text>`;
    }

    // 钩子（和白字同一 x 坐标）
    if (hook) {
      const displayHook = (hook || '').slice(0, 50);
      svg += `<text x="${Math.round(w * 0.029)}" y="${hookY}" font-size="${fontSize2}" fill="#ffd700" font-family="sans-serif" font-weight="bold" font-style="italic">${displayHook.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</text>`;
    }

    svg += `</svg>`;

    const result = await sharp(buf)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toBuffer();

    // 缓存
    overlayCache.set(cacheKey, { d: result, t: Date.now() });
    while (overlayCache.size > 100) { const k = overlayCache.keys().next().value; overlayCache.delete(k); }
    fs.writeFile(diskPath, result, () => {});

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'max-age=600');
    return res.send(result);
  } catch (e) {
    console.error('[image-proxy]', e.message);
    // fallback: 返回原图
    try {
      const resp = await fetch(url);
      const fb = Buffer.from(await resp.arrayBuffer());
      res.set('Content-Type', 'image/png');
      res.send(fb);
    } catch(e2) {
      res.status(502).end('proxy error');
    }
  }
});

// ============================================================
// 电商链接分析 API — 粘贴商品链接 → 自动提取信息
// ============================================================
// ============================================================
// 商品链接智能提取（JSON-LD + OG + Vision 风格分析）
// ============================================================
const EC_CATS = ['美妆护肤','数码3C','食品饮料','服饰穿搭','家居生活','母婴用品','宠物用品','其他'];

// 提取 HTML 中 JSON-LD 结构化数据
function extractJSONLD(html) {
  const results = [];
  const regex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      results.push(parsed);
    } catch {}
  }
  return results;
}

// 从 JSON-LD 中提取商品信息
function extractProductFromLD(ld) {
  const items = Array.isArray(ld) ? ld : [ld];
  for (const item of items) {
    const graph = item['@graph'] || [item];
    for (const g of graph) {
      if (g['@type'] === 'Product' || g['@type'] === 'ItemPage' || g['@type'] === 'Offer') {
        const name = g.name || '';
        const desc = g.description || '';
        const images = (Array.isArray(g.image) ? g.image : [g.image]).filter(Boolean).map(i =>
          typeof i === 'string' ? i : (i?.url || '')
        );
        const offers = g.offers || {};
        const brand = g.brand?.name || '';
        const category = guessCategory(name + ' ' + desc);
        return { title: name, description: desc, images, brand, category };
      }
    }
  }
  return null;
}

// 提取 OG 标签
function extractOGTags(html) {
  const tags = {};
  const regex = /<meta[^>]*property=(?:"|')og:(\w+)(?:"|')[^>]*content=(?:"|')([^"']*)(?:"|')[^>]*\/?>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) tags[m[1]] = m[2];
  // 也匹配另一种顺序
  const regex2 = /<meta[^>]*content=(?:"|')([^"']*)(?:"|')[^>]*property=(?:"|')og:(\w+)(?:"|')[^>]*\/?>/gi;
  while ((m = regex2.exec(html)) !== null) tags[m[2]] = m[1];
  return tags;
}

// 根据标题+描述猜测品类
function guessCategory(text) {
  const t = text.toLowerCase();
  if (/(美妆|护肤|化妆|精华|面霜|面膜|口红|粉底|眼影|防晒)/.test(t)) return '美妆护肤';
  if (/(手机|数码|电脑|耳机|充电|智能|手表|蓝牙|相机|电子)/.test(t)) return '数码3C';
  if (/(食品|零食|饮料|茶|咖啡|酒水|牛奶|保健品|营养)/.test(t)) return '食品饮料';
  if (/(服饰|衣服|穿搭|鞋|包|配饰|女装|男装|连衣裙|T恤|裤子)/.test(t)) return '服饰穿搭';
  if (/(家居|家具|家纺|床|桌|椅|灯|装饰|收纳|厨具|餐具)/.test(t)) return '家居生活';
  if (/(母婴|奶粉|尿不湿|奶瓶|婴儿|儿童|宝宝|玩具)/.test(t)) return '母婴用品';
  if (/(宠物|猫粮|狗粮|猫砂|宠物用品)/.test(t)) return '宠物用品';
  return '其他';
}

// 将 Vision 分析结果映射到风格包 & 推荐图片类型
function visionToStylePack(vision) {
  if (!vision) return { stylePack: '', imageTypes: [] };

  const vibe = (vision.style_vibe || '').toLowerCase();
  const bg = (vision.background || '').toLowerCase();
  const light = (vision.lighting || '').toLowerCase();
  const comp = (vision.composition || '').toLowerCase();
  const temp = (vision.color_temperature || '').toLowerCase();
  const colors = (vision.dominant_colors || []).join(' ').toLowerCase();
  const elements = (vision.key_visual_elements || []).join(' ').toLowerCase();

  // 计算各风格包得分
  const scores = {
    '':                    { score: 0, desc: '' },
    '官方主图风格': { score: 0, desc: '白底 · 棚拍 · 产品居中' },
    '场景种草风格': { score: 0, desc: '真实场景 · 生活感' },
    '促销大促风格': { score: 0, desc: '促销氛围 · 吸引点击' },
    '真实买家感':   { score: 0, desc: '手机实拍感 · 降低广告感' },
    '品牌质感风格': { score: 0, desc: '统一色板 · 提升溢价' },
    '卖点解说风格': { score: 0, desc: '信息图排版 · 卖点一目了然' },
  };

  // 官方主图
  if (/(白底|white|clean|纯色|studio|纯白)/.test(bg)) scores['官方主图风格'].score += 3;
  if (/(顶光|柔光|soft|diffuse|棚拍)/.test(light)) scores['官方主图风格'].score += 2;
  if (/(居中|centered|center)/.test(comp)) scores['官方主图风格'].score += 2;
  if (/(专业|professional|studio|product)/.test(vibe)) scores['官方主图风格'].score += 2;
  if (/(极简|minimal|简洁|洁净)/.test(vibe)) scores['官方主图风格'].score += 1;

  // 场景种草
  if (/(场景|环境|lifestyle|setting|场景|生活)/.test(bg)) scores['场景种草风格'].score += 3;
  if (/(自然光|warm|ambient|自然|window)/.test(light)) scores['场景种草风格'].score += 2;
  if (/(使用中|in.use|生活|lifestyle)/.test(elements)) scores['场景种草风格'].score += 2;
  if (/(温馨|warm|自然|casual)/.test(vibe)) scores['场景种草风格'].score += 2;

  // 促销大促
  if (/(促销|promotion|sale|折扣|优惠|deal)/.test(elements)) scores['促销大促风格'].score += 4;
  if (/(文字|text|overlay|标签|label|tag)/.test(elements)) scores['促销大促风格'].score += 2;
  if (/(暖|暖色|鲜艳|vibrant|bright|红|橙|黄)/.test(colors)) scores['促销大促风格'].score += 1;
  if (/(促销|promotional)/.test(vibe)) scores['促销大促风格'].score += 2;

  // 真实买家感
  if (/(手机|实拍|实拍|casual|unpolished|自然)/.test(vibe)) scores['真实买家感'].score += 3;
  if (/(随手|自然|生活|straight)/.test(comp)) scores['真实买家感'].score += 1;
  if (/(硬光|harsh|自然|朴素|朴实)/.test(light)) scores['真实买家感'].score += 1;
  if (/(买家秀|平民|unpolished|手机)/.test(elements)) scores['真实买家感'].score += 3;

  // 品牌质感
  if (/(高端|奢华|luxury|premium|elegant|高档)/.test(vibe)) scores['品牌质感风格'].score += 3;
  if (/(莫兰迪|高级|dark|深沉|质感)/.test(colors)) scores['品牌质感风格'].score += 2;
  if (/(统一|consistent|品牌|brand)/.test(elements)) scores['品牌质感风格'].score += 2;
  if (/(极简|minimal|干净|clean)/.test(bg)) scores['品牌质感风格'].score += 1;

  // 卖点解说
  if (/(信息图|infographic|排版|布局)/.test(vibe)) scores['卖点解说风格'].score += 3;
  if (/(标注|label|注解|annotation|文字)/.test(elements)) scores['卖点解说风格'].score += 3;
  if (/(教育|educational|解说|说明)/.test(vibe)) scores['卖点解说风格'].score += 2;

  // 默认：冷/中性色温 + 干净背景 → 官方主图
  if (/(冷|中性|neutral|clean)/.test(temp)) scores['官方主图风格'].score += 1;

  // 选最高分
  let best = '官方主图风格';
  for (const [k, v] of Object.entries(scores)) {
    if (v.score > scores[best].score) best = k;
  }

  // 推荐图片类型
  const imageTypes = [{ key: 'white_bg', count: 1 }];
  if (best === '场景种草风格') imageTypes.push({ key: 'scene', count: 1 });
  if (best === '卖点解说风格') imageTypes.push({ key: 'feature', count: 2 });
  if (best === '品牌质感风格') imageTypes.push({ key: 'macro', count: 1 });
  if (best === '促销大促风格') {
    imageTypes.push({ key: 'feature', count: 1 });
    imageTypes.push({ key: 'package', count: 1 });
  }

  return { stylePack: best, imageTypes, confidence: Math.min(10, Math.round(scores[best].score * 1.5)) };
}

app.post('/api/extract-product-link', async (req, res) => {
  const { url, billing_quote_id: quoteId, billing_action_id: actionId } = req.body || {};
  if (!url) return res.status(400).json({ error: '缺少商品链接' });

  console.log(`[extract-link] 分析链接: ${url.slice(0, 80)}`);

  try {
    const billed = await canvasOneShotBilling.execute({
      ownerEmail: req._userEmail,
      quoteId,
      actionId,
      sku: 'ec_ai_assistant',
      referenceType: 'legacy_product_link_extraction',
      providerCostCny: 0.01,
      metadata: { action: 'extract_product_link', host: (() => { try { return new URL(url).hostname; } catch { return ''; } })() },
      work: async () => {
        // ——— 抓取页面 ———
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

        if (!pageRes.ok) {
          throw Object.assign(new Error('页面无法直接访问，请手动填写商品信息'), {
            status: 422,
            code: 'PRODUCT_LINK_UNAVAILABLE',
          });
        }

    const html = await pageRes.text();

    // ——— Step 1: 提取 JSON-LD 结构化数据（最干净） ———
    const ld = extractJSONLD(html);
    let product = extractProductFromLD(ld);

    // ——— Step 2: 提取 OG 标签补充 ———
    const og = extractOGTags(html);
    const ogImages = [];
    if (og.image) ogImages.push(og.image);
    if (og['image:secure_url']) ogImages.push(og['image:secure_url']);

    // ——— Step 3: 如果 JSON-LD 没找到，降级到 LLM 从干净内容提取 ———
    if (!product) {
      // 只提取页面 clean text（去掉脚步/导航/版权等）
      const cleanText = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
        .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
        .replace(/<header[\s\S]*?<\/header>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 3000);

      const systemPrompt = `你是一个电商商品信息提取器。从商品页内容中提取商品本身的信息，返回纯JSON（不要markdown）。忽略导航、公司介绍、营业执照、品牌介绍等无关内容。
{
  "title": "商品标题",
  "description": "商品简短描述（2-3句话）",
  "materials": "材质/成分描述",
  "sellingPoints": ["卖点1", "卖点2", "卖点3"]
}`;

      const result = await callLLM(systemPrompt, `商品页面内容：\n${cleanText}`, { temperature: 0.3, maxTokens: 2000 });
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          product = {
            title: data.title || '',
            description: data.description || '',
            images: [],
            category: guessCategory((data.title || '') + ' ' + (data.description || '')),
            sellingPoints: data.sellingPoints || [],
            materials: data.materials || '',
          };
        }
      } catch {}
    }

    // 没有可交付结果时让账本释放本次冻结积分。
    if (!product || !product.title) {
      throw Object.assign(new Error('未能从页面提取到商品信息，请手动填写'), {
        status: 422,
        code: 'PRODUCT_LINK_NOT_FOUND',
      });
    }

    // ——— Step 4: 整理图片列表 ———
    // JSON-LD 图片优先，其次 OG 图，最后手动提取
    let images = (product.images || []).filter(Boolean);
    if (!images.length) images = ogImages.filter(Boolean);
    // 过滤掉非商品图的 URL（logo、icon、banner 等）
    images = images.filter(u =>
      !/(logo|icon|banner|avatar|favicon|sprite|bg_|footer|header)/i.test(u)
    );
    // 去重取前 5
    images = [...new Set(images)].slice(0, 5);

    // ——— Step 5: Vision 风格分析（用主 LLM 看图） ———
    let vision = null;
    let styleMapping = { stylePack: '', imageTypes: [], confidence: 0 };
    if (images.length > 0) {
      try {
        const visionSysPrompt = `你是一个电商产品图片分析专家。分析商品图的视觉风格，返回纯 JSON（不要 markdown）：
{
  "style_vibe": "整体风格感觉（极简/奢华/自然/科技感/温馨/专业/促销等）",
  "background": "背景描述（白底/场景/渐变/实景等）",
  "lighting": "光线类型（柔光/硬光/侧光/顶光/自然光等）",
  "composition": "构图方式（居中/三分法/特写/俯拍/平铺等）",
  "dominant_colors": ["主色1", "主色2", "主色3"],
  "color_temperature": "色温（暖/冷/中性）",
  "material_texture": "材质质感描述",
  "has_text_overlay": true/false,
  "overall_feel": "一句话描述整体视觉氛围"
}`;
        const visionRaw = await callLLMWithVision(visionSysPrompt, images,
          `分析这些商品图片的视觉风格。产品是什么？构图？光线？背景？整体风格？`
        );
        const jsonMatch = visionRaw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          vision = JSON.parse(jsonMatch[0]);
          styleMapping = visionToStylePack(vision);
          console.log(`[extract-link] Vision 风格分析: ${styleMapping.stylePack} (置信度 ${styleMapping.confidence}/10)`);
        }
      } catch (e) {
        console.warn(`[extract-link] Vision 分析失败: ${e.message}`);
      }
    }

    // ——— Step 6: 提取卖点（如果 JSON-LD 没有，从描述中推） ———
    let sellingPoints = product.sellingPoints || [];
    if (!sellingPoints.length && product.description) {
      // 用逗号/句号分隔描述作为卖点候选
      sellingPoints = product.description
        .split(/[。，；;]/)
        .map(s => s.trim())
        .filter(s => s.length > 4 && s.length < 30)
        .slice(0, 4);
    }

    console.log(`[extract-link] 成功: ${(product.title || '').slice(0, 40)}`);

        return {
      ok: true,
      title: product.title || '',
      description: product.description || '',
      category: product.category || guessCategory(product.title || ''),
      images,
      sellingPoints,
      materials: product.materials || '',
      brand: product.brand || '',
      // ★ 新增：风格分析结果
      stylePack: styleMapping.stylePack,
      styleConfidence: styleMapping.confidence,
      styleNote: styleMapping.stylePack ? `检测到商品图风格偏向「${styleMapping.stylePack}」` : '',
          imageTypes: styleMapping.imageTypes,
          url: `extract-link:${crypto.createHash('sha256').update(JSON.stringify({ product, images, styleMapping })).digest('hex')}`,
        };
      },
    });
    return res.json({ ...billed.result, billing: billed.billing });

  } catch (err) {
    console.error(`[extract-link] 失败:`, err.message);
    res.status(err?.status || 500).json({ error: safeCanvasClientError(err, '链接分析暂时不可用，请稍后重试'), code: err?.code, required: err?.required, available: err?.available, billing: err?.billing });
  }
});

// ── 持久化的 bookmarklet 存储（重启不丢） ──
const BOOKMARKLET_FILE = join(__dirname, 'bookmarklet_store.json');
const BOOKMARKLET_TTL = 30 * 60 * 1000; // 30 分钟有效期

function loadBmStore() {
  try {
    if (fs.existsSync(BOOKMARKLET_FILE)) {
      const raw = fs.readFileSync(BOOKMARKLET_FILE, 'utf-8');
      const data = JSON.parse(raw);
      const now = Date.now();
      for (const k of Object.keys(data)) {
        if (now - (data[k].ts || 0) > BOOKMARKLET_TTL) delete data[k];
      }
      return data;
    }
  } catch (e) { /* ignore */ }
  return {};
}
function saveBmStore(s) {
  try {
    const now = Date.now();
    for (const k of Object.keys(s)) { if (now - (s[k].ts || 0) > BOOKMARKLET_TTL) delete s[k]; }
    fs.writeFileSync(BOOKMARKLET_FILE, JSON.stringify(s), 'utf-8');
  } catch (e) { console.warn('[bm] persist fail:', e.message); }
}
const _bm = loadBmStore();
setInterval(() => saveBmStore(_bm), 60000);
process.on('exit', () => saveBmStore(_bm));
const bmGet = k => _bm[k] || null;
const bmSet = (k, v) => { _bm[k] = v; saveBmStore(_bm); };
const bmHas = k => !!_bm[k];
const bmDel = k => { delete _bm[k]; saveBmStore(_bm); };

app.post('/api/bookmarklet-extract', (req, res) => {
  const { title, desc, brand, images, sellingPoints, base64Images, detailIframeUrl } = req.body || {};
  if (!title && !images?.length) return res.status(400).json({ error: '未提取到有效数据' });
  const token = 'ext_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const cleanImages = (images || []).filter(u => !/logo|icon|banner|avatar|sprite/i.test(u)).slice(0, 200);
  bmSet(token, {
    title: title || '', desc: desc || '', brand: brand || '',
    images: cleanImages,
    sellingPoints: sellingPoints || [],
    analysis: null,
    analysisReady: false,
    ts: Date.now(),
  });
  // 异步启动视觉反推 + 详情 iframe 抓取
  analyzeProductImages(token, cleanImages, base64Images).catch(e => {
    console.error('[bookmarklet] 视觉反推出错:', e.message);
    markAnalysisDone(token, null);
  });
  // 详情 iframe 抓取（异步补充图片）
  if (detailIframeUrl) {
    fetchDetailImages(detailIframeUrl, token).catch(err => {
      console.warn(`[bookmarklet] 详情页抓取失败:`, err.message);
    });
  }
  res.json({ ok: true, token });
});

app.get('/api/bookmarklet-data', (req, res) => {
  const { token } = req.query;
  if (!token || !bmHas(token)) return res.json({ ok: false });
  const data = bmGet(token);
  // 分析还没完成——图可以先给
  if (!data.analysisReady) return res.json({ ok: true, ready: false, title: data.title, images: data.images || [], sellingPoints: data.sellingPoints || [], desc: data.desc || '', brand: data.brand || '' });
  bmDel(token); // 一次性读取
  res.json({ ok: true, ready: true, ...data });
});

// ── 视觉反推：下载图片 → base64 → vision API 分析 ──
async function analyzeProductImages(token, allImages, base64Images) {
  const urls = (allImages || []).filter(Boolean).slice(0, 3);
  // 优先用浏览器传来的 base64（解决 CDN 防外链问题）
  const imageData = (base64Images || []).filter(Boolean).slice(0, 3);
  if (!imageData.length && !urls.length) return markAnalysisDone(token, null);

  const systemPrompt = `你是一位电商视觉分析师。分析用户提供的商品图片，输出一份完整的视觉报告。
输出纯 JSON（不要 markdown 标记）：
{
  "category": "商品类目（美妆护肤/数码3C/食品饮料/服饰穿搭/家居生活/母婴用品/宠物用品/其他）",
  "stylePack": "最佳匹配风格包（default | scene_selling | detail_selling | ugc_trust | brand_unified | promo_sale）",
  "visualDirection": "一句话描述整体视觉方向",
  "dominantColors": ["主色1", "主色2", "主色3"],
  "lighting": "光照风格描述",
  "composition": "构图特点",
  "background": "背景/场景类型",
  "material": "可见材质特征",
  "keySellingPoints": ["卖点1", "卖点2", "卖点3"],
  "mood": "画面情绪/风格调性"
}`;

  try {
    // 1. 收集可用的 base64 data URI（已有 base64 的优先）
    const dataUris = [...imageData];

    // 2. 尝试下载 URL 图片并转 base64（只试没 base64 的）
    for (let i = dataUris.length; i < 3 && i < urls.length; i++) {
      try {
        const host = new URL(urls[i]).hostname;
        const referer = host.includes('alicdn') ? 'https://www.taobao.com/'
          : host.includes('360buyimg') ? 'https://www.jd.com/'
          : host.includes('pddpic') || host.includes('pinduoduo') ? 'https://mobile.yangkeduo.com/'
          : urls[i];
        const res = await fetch(urls[i], {
          headers: { 'Referer': referer, 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          if (buf.byteLength >= 1000) {
            const ext = urls[i].match(/\.(jpg|jpeg|png|webp)/i)?.[1] || 'jpg';
            dataUris.push('data:image/' + ext + ';base64,' + Buffer.from(buf).toString('base64'));
          }
        }
      } catch (e) { /* skip */ }
    }
    if (!dataUris.length) return markAnalysisDone(token, null);

    // 3. 发 vision API
    const res = await fetch(MINI_BASE + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + MINI_KEY },
      body: JSON.stringify({
        model: MINI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [
            { type: 'text', text: '请分析这些商品图片，输出 JSON 格式的视觉报告。' },
            ...dataUris.map(u => ({ type: 'image_url', image_url: { url: u } })),
          ]},
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return markAnalysisDone(token, null);
    const data = await res.json();
    const result = data.choices?.[0]?.message?.content || '';
    const cleaned = result.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(cleaned);

    const store = bmGet(token);
    if (store) {
      store.analysis = analysis;
      store.analysisReady = true;
      console.log(`[bookmarklet] 反推完成: ${analysis.category}, 风格=${analysis.stylePack}`);
    }
  } catch (err) {
    markAnalysisDone(token, null);
    console.warn(`[bookmarklet] 视觉反推失败:`, err.message);
  }
}

function markAnalysisDone(token, analysis) {
  const store = bmGet(token);
  if (store) {
    store.analysis = analysis || null;
    store.analysisReady = true;
  }
}

// ── 详情 iframe URL 抓取：淘宝/JD 的图文详情在 iframe 里 ──
async function fetchDetailImages(iframeUrl, token) {
  try {
    const res = await fetch(iframeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': new URL(iframeUrl).origin,
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return;
    const html = await res.text();
    // 从 HTML 里提取所有图片 URL
    const urls = [];
    const re = /https?:\/\/[^\s"'\\)<>]+\.(?:jpg|jpeg|png|webp|gif|avif)(?:\?[^\s"'\)<>]*)?/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const u = m[0].split('"')[0].split("'")[0].split(')')[0];
      if (u && u.length < 500 && !/(logo|icon|avatar|sprite|banner)/i.test(u)) {
        urls.push(u);
      }
    }
    // 去重后合并到 stored data
    const unique = [...new Set(urls)];
    if (!unique.length) return;
    const store = bmGet(token);
    if (store) {
      const existing = new Set(store.images.map(u => u.split('#')[0].split('?')[0]));
      const newImgs = unique.filter(u => !existing.has(u.split('#')[0].split('?')[0]));
      if (newImgs.length) {
        store.images = [...store.images, ...newImgs.slice(0, 100)];
        console.log(`[bookmarklet] 详情 iframe 抓到 ${newImgs.length} 张新图 (共 ${store.images.length})`);
      }
    }
  } catch (e) {
    // 静默失败——详情图没有也能用
  }
}

// ============================================================
// 电商 API（v3：预览 + 生成）
// ============================================================

app.post('/api/ecommerce-preview', (req, res) => {
  const { product_name, category, selling_points, ref_count, has_material, image_selections, skus, detail_plan, maintenance } = req.body || {};
  if (!product_name) return res.status(400).json({ error: '缺少商品名称' });

  const sellingPoints = (typeof selling_points === 'string' ? selling_points : '').split(/[\n,;，；]/).filter(Boolean);

  // 用户自选优先，否则按默认套图（主图1:1×5 + 主图3:4×5 + 透明×1 + SKU×用户数 + 勾选切片）
  const hasUserSel = Array.isArray(image_selections) && image_selections.length > 0;
  const selections = hasUserSel
    ? image_selections.map(t => ({ key: t.key || t.k, count: t.count || t.c || 1, variant: t.variant, sliceNote: t.sliceNote }))
    : (() => {
        const def = [
          { key: 'white_bg', count: 1 },
          { key: 'main_text', count: 5 },
          { key: 'main_3x4', count: 5 },
          { key: 'transparent', count: 1 },
        ];
        if (Array.isArray(skus) && skus.length) def.push({ key: 'sku', count: skus.length });
        const dp = detail_plan || {};
        if (dp.sizeAnnot)  def.push({ key: 'detail_slice_size', count: 1, sliceNote: dp.notes?.sizeAnnot });
        if (dp.scene)      def.push({ key: 'detail_slice_scene', count: 1, sliceNote: dp.notes?.scene });
        if (dp.qc)         def.push({ key: 'detail_slice_qc', count: 1, sliceNote: dp.notes?.qc });
        if (dp.compare)    def.push({ key: 'detail_slice_compare', count: 1, sliceNote: dp.notes?.compare });
        if (dp.feature)    def.push({ key: 'detail_slice_feature', count: 1, sliceNote: dp.notes?.feature });
        if (maintenance)   def.push({ key: 'detail_slice_care', count: 1, sliceNote: maintenance });
        return def;
      })();

  const imageTypes = IMAGE_TYPE_INFO.map(t => {
    const r = selections.find(s => s.key === t.key);
    return { ...t, recommended: r?.count || 0, recommendReason: r ? '已配置' : '' };
  });

  const outline = buildOutline({
    productName: product_name,
    category: category || '其他',
    imageSelections: selections,
    sellingPoints,
    skus,
    detailPlan: detail_plan,
    maintenance,
  });

  res.json({ product_name, category: category || '其他', imageTypes, outline });
});

// ============================================================
// 智能识别：Vision 分析参考图 + smartBrief 文字 → 回填 5 步字段
// ============================================================
app.post('/api/ecommerce/auto-recognize', async (req, res) => {
  const { smartBrief, refShots, billing_quote_id: quoteId, billing_action_id: actionId } = req.body || {};
  if (!smartBrief && !refShots?.length) {
    return res.status(400).json({ error: '请填写描述或上传参考图' });
  }
  try {
    const billed = await canvasOneShotBilling.execute({
      ownerEmail: req._userEmail,
      quoteId,
      actionId,
      sku: 'ec_ai_assistant',
      referenceType: 'ecommerce_auto_recognize',
      providerCostCny: 0.01,
      metadata: { action: 'auto_recognize' },
      work: async () => {
        // 1) Vision 分析参考图（复用现有函数）
        let vision = null;
        if (refShots?.length) {
          vision = await analyzeReferenceImages(refShots.slice(0, 5));
        }

    // 2) 让 LLM 综合参考图 + smartBrief 推断 5 步字段
    const sys = `你是电商运营专家。根据用户描述和参考图分析，推断商品信息并返回严格 JSON（只返回 JSON，不要其他文字）：
{
  "product": { "name": "商品名", "category": "品类(从候选里选)", "material": "材质/工艺", "dimensions": "长x宽x高 cm" },
  "skus": [ { "color": "颜色名≤4字", "size": "规格/尺码", "capacity": "容量/数量", "dimLabel": "标注尺寸" } ],
  "style_skill": "推荐风格(高级极简/生活场景/时尚杂志/自然暖调/科技精工，从候选选最匹配的)",
  "detailPlan": { "sizeAnnot": true, "scene": true, "qc": false, "compare": false, "feature": true, "notes": { "sizeAnnot":"", "scene":"", "qc":"", "compare":"", "feature":"" } },
  "maintenance": "一句保养建议"
}
规则：
- skus 至少 1 行，最多 6 行；颜色名用常见中文名（月岩白/曜石黑/雾霾蓝），不自创生僻字。
- detailPlan 只勾选对商品有意义的项；notes 简短或空字符串。
- style_skill 从候选风格中选最能匹配该商品视觉调性的。
- category 必须从候选里选，找不到就填"其他"。`;

    const candidates = ['美妆护肤','数码3C','食品饮料','服饰穿搭','家居生活','母婴用品','宠物用品','其他'];
    const style_skill_candidates = ['高级极简','生活场景','时尚杂志','自然暖调','科技精工'];
    const userMsg = `用户描述：${smartBrief || '（未填）'}\n候选品类：${candidates.join('、')}\n候选风格：${style_skill_candidates.join('、')}\n参考图分析：${vision ? JSON.stringify(vision) : '（无参考图）'}`;

    const llmRes = await callMiniLLM(sys, refShots?.slice(0,5) || [], userMsg);
    const match = (llmRes || '').match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'AI 识别失败，请重试' });
    const parsed = JSON.parse(match[0]);

    // 兜底：确保字段存在
    parsed.product = parsed.product || { name:'', category:'其他', material:'', dimensions:'' };
    parsed.skus = Array.isArray(parsed.skus) && parsed.skus.length ? parsed.skus : [{ color:'', size:'', capacity:'', dimLabel:'' }];
    parsed.detailPlan = Object.assign({ sizeAnnot:true, scene:true, qc:false, compare:false, feature:true, notes:{} }, parsed.detailPlan || {});
    parsed.detailPlan.notes = Object.assign({ sizeAnnot:'', scene:'', qc:'', compare:'', feature:'' }, parsed.detailPlan.notes || {});
    parsed.maintenance = parsed.maintenance || '';
    // 风格映射
    const STYLE_MAP = { '高级极简':'premium_minimal', '生活场景':'lifestyle_scene', '时尚杂志':'fashion_editorial', '自然暖调':'warm_natural', '科技精工':'tech_precision' };
    parsed.style_skill = STYLE_MAP[parsed.style_skill] || 'premium_minimal';
    parsed.rawVision = vision;

        parsed.url = `auto-recognize:${crypto.createHash('sha256').update(JSON.stringify(parsed)).digest('hex')}`;
        return parsed;
      },
    });
    res.json({ ...billed.result, billing: billed.billing });
  } catch (e) {
    console.warn('[auto-recognize] 失败:', e.message);
    res.status(e?.status || 500).json({ error: safeCanvasClientError(e, 'AI 识别暂时不可用，请稍后重试'), code: e?.code, required: e?.required, available: e?.available, billing: e?.billing });
  }
});

// ============================================================
// 临时图片上传 — 前端先上传图片到服务器，再用 URL 请求 API
// ============================================================
const TEMP_UPLOAD_DIR = resolve(__dirname, 'temp_uploads');
if (!fs.existsSync(TEMP_UPLOAD_DIR)) fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
const imageInputReader = createImageInputReader({ generatedAssetStore, tempUploadDir: TEMP_UPLOAD_DIR });
const ecommerceAssetUploadService = createEcommerceAssetUploadService({
  db,
  generatedAssetStore,
});
const migrateLegacyVisualAsset = createLegacyVisualAssetMigration({
  imageInputReader,
  generatedAssetStore,
  getJob: jobId => ecommerceJobs.get(jobId),
  getOwnedAsset: input => ecommerceAssetUploadService.getOwnedAsset(input),
});
function createEcommerceVlmClient({ timeoutMs, retryDelaysMs, model } = {}) {
  const useMini = Boolean(MINI_KEY && MINI_BASE);
  return createVlmClient({
    apiKey: useMini ? MINI_KEY : LLM_KEY,
    baseUrl: useMini ? MINI_BASE : LLM_BASE,
    model: model || (useMini ? MINI_MODEL : LLM_MODEL),
    ...(Number.isFinite(timeoutMs) ? { timeoutMs } : {}),
    ...(Array.isArray(retryDelaysMs) ? { retryDelaysMs } : {}),
  });
}
const visualAnalysisService = createVisualAnalysisService({
  store: createVisualAnalysisStore(db),
  model: MINI_MODEL,
  promptVersion: process.env.VISUAL_ANALYSIS_PROMPT_VERSION || 'visual-analysis-v3',
  readAsset: asset => imageInputReader.read(asset?.url),
  callVision: request => createEcommerceVlmClient().analyzeJson(request),
});

function parseJsonObject(value) {
  const text = String(value || '').replace(/```(?:json)?/gi, '').trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    const parsed = JSON.parse(match[0]);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function ecommerceUserFacts(payload) {
  const skuFacts = {};
  for (const [index, sku] of (Array.isArray(payload.skus) ? payload.skus : []).entries()) {
    if (!sku || typeof sku !== 'object') continue;
    for (const field of ['color', 'size', 'capacity', 'dimLabel', 'count']) {
      const value = String(sku[field] || '').trim();
      if (value) skuFacts[`sku_${index + 1}_${field}`] = { value, source: 'user', visible: true };
    }
  }
  return {
    productName: String(payload.product_name || '').trim(),
    category: String(payload.category || '').trim(),
    materials: String(payload.material || '').trim() ? [String(payload.material).trim()] : [],
    skuFacts,
    sourceAssetIds: (payload.assets?.product || []).map(asset => asset.assetId).filter(Boolean),
  };
}

async function analyzeEcommerceVisualInputs(payload) {
  const abilityId = String(payload?.ability_recipe?.id || '').trim();
  return visualAnalysisService.analyze({
    productAssets: Array.isArray(payload.assets?.product) ? payload.assets.product : [],
    styleAssets: abilityId === 'anything_tryon'
      ? (Array.isArray(payload.assets?.scene) ? payload.assets.scene : [])
      : (Array.isArray(payload.assets?.reference) ? payload.assets.reference : []),
    userFacts: ecommerceUserFacts(payload),
  });
}

function fallbackEcommerceVisualInputs(payload) {
  const productTruth = mergeProductFacts({ user: ecommerceUserFacts(payload) });
  const abilityId = String(payload?.ability_recipe?.id || '').trim();
  const referenceAssets = abilityId === 'anything_tryon' ? payload.assets?.scene : payload.assets?.reference;
  const styleReferenceProfile = normalizeStyleReferenceProfile({
    sourceAssetIds: (referenceAssets || []).map(asset => asset.assetId).filter(Boolean),
  });
  return {
    productTruth,
    styleReferenceProfile,
    cache: {
      product: `fallback:${productTruth.fingerprint}`,
      style: `fallback:${styleReferenceProfile.sourceAssetIds.join(',') || 'none'}`,
    },
  };
}

async function prepareEcommerceProviderRequest(request) {
  const inputAssets = [];
  for (const [index, asset] of (Array.isArray(request.inputAssets) ? request.inputAssets : []).entries()) {
    const source = asset?.url || asset?.sourceUrl;
    if (!source) continue;
    const image = await imageInputReader.read(source);
    const extension = image.contentType === 'image/jpeg'
      ? 'jpg'
      : image.contentType === 'image/webp'
        ? 'webp'
        : 'png';
    inputAssets.push({
      ...asset,
      buffer: image.buffer,
      contentType: image.contentType,
      fileName: `${asset.assetId || `image-${index + 1}`}.${extension}`,
    });
  }
  if (inputAssets.length === 0) {
    const error = new Error('请至少上传一张清晰的产品图后再生成');
    error.status = 400;
    error.code = 'PRODUCT_IMAGE_REQUIRED';
    throw error;
  }
  return { ...request, inputAssets };
}

const ecommerceQualityCache = new Map();
async function analyzeStableEcommerceAsset({ buffer, contentType, productTruth, commercialIntent, role }) {
  const key = crypto.createHash('sha256')
    .update(buffer)
    .update(String(contentType || ''))
    .update(String(productTruth?.fingerprint || ''))
    .update(String(role || ''))
    .update(JSON.stringify(commercialIntent || {}))
    .digest('hex');
  if (!ecommerceQualityCache.has(key)) {
    const systemPrompt = buildFormalEcommerceQualityPrompt();
    const image = stableAssetDataUrl({ buffer, contentType: contentType || 'image/png' });
    const userPrompt = [
      `Product Truth：${JSON.stringify(productTruth || {})}`,
      `Asset Responsibility：${JSON.stringify(commercialIntent || {})}`,
    ].join('\n');
    const promise = createEcommerceVlmClient().analyzeJson({
      systemPrompt,
      userPrompt,
      images: [image],
    })
      .catch(error => {
        ecommerceQualityCache.delete(key);
        throw error;
      });
    ecommerceQualityCache.set(key, promise);
    if (ecommerceQualityCache.size > 200) {
      const oldest = ecommerceQualityCache.keys().next().value;
      ecommerceQualityCache.delete(oldest);
    }
  }
  return ecommerceQualityCache.get(key);
}

function qualityAdapter(section, fallbackCode) {
  return async payload => {
    const contentType = {
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    }[String(payload?.metadata?.format || '').toLowerCase()];
    const report = await analyzeStableEcommerceAsset({
      ...payload,
      contentType: contentType || 'image/png',
    });
    const value = report?.[section];
    if (!value || typeof value.passed !== 'boolean') {
      throw new Error(`质检结果缺少 ${section}`);
    }
    return {
      passed: value.passed,
      confidence: Number.isFinite(value.confidence) ? Math.max(0, Math.min(1, value.confidence)) : 0.5,
      issueCodes: Array.isArray(value.issueCodes) && value.issueCodes.length
        ? value.issueCodes.map(code => String(code).trim()).filter(Boolean)
        : value.passed ? [] : [fallbackCode],
      details: section === 'visualQuality' ? {
        layout: value.layout,
        ...(value.intentFulfillment ? { intentFulfillment: value.intentFulfillment } : {}),
      } : {},
    };
  };
}

const ecommerceBilling = createEcommerceBilling({
  walletService,
  quoteService: billingQuoteService,
});
const canvasOneShotBilling = createOneShotBilling({
  walletService,
  quoteService: billingQuoteService,
  actionStore: createCanvasBilledActionStore(db),
});
const videoPlanningService = createVideoPlanningService({
  completeText: request => createEcommerceVlmClient({
    timeoutMs: 45_000,
    retryDelaysMs: [750],
  }).completeText(request),
});

function imageProviderCredential() {
  return IMG_AUTH_STRATEGY === 'bearer'
    ? { bearerToken: IMG_KEY, authStrategy: 'bearer' }
    : { apiKey: IMG_KEY, authStrategy: 'x-api-key' };
}

const createConfiguredImageAdapter = (baseUrl, {
  protocol = IMG_PROVIDER_PROTOCOL,
  submitPath = process.env.IMAGE_TASK_SUBMIT_PATH || '/v1/tasks',
  pollPath = process.env.IMAGE_TASK_PATH || '/v1/tasks/{id}',
} = {}) => createProviderAdapter({
  baseUrl,
  ...imageProviderCredential(),
  protocol,
  submitPath,
  editPath: process.env.IMAGE_EDIT_PATH || '/v1/images/edits',
  pollPath,
});
const image2ProviderAdapter = IMG_BASE && IMG_KEY ? createProviderRouter({
  primary: createConfiguredImageAdapter(IMG_BASE),
  ...(IMG_OVERFLOW_BASE ? { overflow: createConfiguredImageAdapter(IMG_OVERFLOW_BASE) } : {}),
  legacy: IMG_LEGACY_BASE ? createConfiguredImageAdapter(IMG_LEGACY_BASE, {
    protocol: 'legacy-edits',
    submitPath: process.env.IMAGE_EDIT_PATH || '/v1/images/edits',
    pollPath: process.env.IMAGE_LEGACY_TASK_PATH || '/v1/images/tasks/{id}',
  }) : undefined,
}) : {
  async submitEdit() {
    const error = new Error('图片生成服务暂未配置');
    error.status = 503;
    error.code = 'IMAGE_PROVIDER_UNAVAILABLE';
    error.retryable = true;
    throw error;
  },
  async poll() {
    const error = new Error('图片生成服务暂未配置');
    error.status = 503;
    error.code = 'IMAGE_PROVIDER_UNAVAILABLE';
    error.retryable = true;
    throw error;
  },
  async pollUntilReady() {
    const error = new Error('图片生成服务暂未配置');
    error.status = 503;
    error.code = 'IMAGE_PROVIDER_UNAVAILABLE';
    error.retryable = true;
    throw error;
  },
};
const nanoBananaProviderAdapter = NANO_BANANA_KEY ? createNanoBananaProviderAdapter({
  apiKey: NANO_BANANA_KEY,
  baseUrl: NANO_BANANA_BASE,
  flashModel: NANO_BANANA_FLASH_MODEL,
  proModel: NANO_BANANA_PRO_MODEL,
  generatedAssetStore,
  publicBaseUrl: process.env.INTERNAL_PUBLIC_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3002}`,
}) : null;
const ecommerceProviderAdapter = createModelProviderRouter({
  image2: image2ProviderAdapter,
  nanoBanana: nanoBananaProviderAdapter,
});
const canvasBackgroundCleanPlate = createCanvasBackgroundCleanPlate({
  providerAdapter: ecommerceProviderAdapter,
  imageInputReader,
  model: IMG_MODEL,
});
const canvasLayeringService = createCanvasLayeringService({
  visionClient: {
    analyzeJson: request => createEcommerceVlmClient().analyzeJson(request),
  },
  generatedAssetStore,
  imageInputReader,
  createBackgroundCleanPlate: canvasBackgroundCleanPlate,
});
const canvasGenerationService = createCanvasGenerationService({
  store: canvasGenerationStore,
  imageInputReader,
  providerAdapter: ecommerceProviderAdapter,
  imageGenerationPool,
  generatedAssetStore,
  model: IMG_MODEL,
});
const canvasRegenerateHandler = createCanvasRegenerateHandler({
  service: canvasGenerationService,
  billing: canvasOneShotBilling,
});
const canvasGenerationStatusHandler = createCanvasGenerationStatusHandler({
  service: canvasGenerationService,
});
const ecommerceTaskWorkPersistence = createEcommerceTaskWorkPersistence({ upsertWork });
const ecommerceProjectLifecycle = createEcommerceProjectLifecycle({ projectStore });
const orchestrator = createEcommerceOrchestrator({
  jobs: ecommerceJobs,
  imageGenerationPool,
  migrateLegacyVisualAsset,
  analyzeVisualInputs: analyzeEcommerceVisualInputs,
  fallbackVisualInputs: fallbackEcommerceVisualInputs,
  compileCampaignBible,
  buildAssetPlan,
  compileAssetRequest,
  providerAdapter: ecommerceProviderAdapter,
  generatedAssetStore,
  evaluateAsset,
  evaluateSuiteDiversity,
  planRepair,
  canRetry,
  billing: ecommerceBilling,
  prepareProviderRequest: prepareEcommerceProviderRequest,
  repairAsset: repairEcommerceAsset,
  projectLifecycle: ecommerceProjectLifecycle,
  persistWorkSnapshot: snapshot => ecommerceTaskWorkPersistence.persist(snapshot),
  qualityAdapters: {
    productFidelity: qualityAdapter('productFidelity', 'product_fidelity_failed'),
    ocr: qualityAdapter('copyAndLogo', 'copy_or_logo_failed'),
    visualQuality: qualityAdapter('visualQuality', 'visual_quality_failed'),
  },
});
const ecommerceRouteHandlers = createEcommerceRouteHandlers({ orchestrator });
const ecommerceAssetRouteHandlers = createEcommerceAssetRouteHandlers({
  assetUploadService: ecommerceAssetUploadService,
});
const ecommerceExportService = createEcommerceExportService({
  db,
  generatedAssetStore,
  assetUploadService: ecommerceAssetUploadService,
});
const ecommerceExportRouteHandlers = createEcommerceExportRouteHandlers({
  exportService: ecommerceExportService,
});

app.post('/api/ec-temp-upload', async (req, res) => {
  try {
    const { images } = req.body; // [{ name, data: 'data:image/...' }]
    if (!images?.length) return res.status(400).json({ error: 'no images' });
    const urls = [];
    for (const img of images.slice(0, 15)) {
      const match = (img.data || '').match(/^data:image\/(\w+);base64,(.+)$/);
      if (!match) continue;
      if (match[2].length > 20 * 1024 * 1024) return res.status(413).json({ error: '单张图片过大' });
      const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
      const buf = Buffer.from(match[2], 'base64');
      if (buf.length > 15 * 1024 * 1024) return res.status(413).json({ error: '单张图片过大' });
      const fname = `ec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      fs.writeFileSync(resolve(TEMP_UPLOAD_DIR, fname), buf);
      urls.push(`/api/ec-temp-img/${fname}`);
    }
    res.json({ urls });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/ec-temp-img/:name', (req, res) => {
  const name = String(req.params.name || '');
  if (!/^[a-z0-9][a-z0-9_.-]*$/i.test(name)) return res.status(404).end();
  const fp = resolve(TEMP_UPLOAD_DIR, name);
  if (!fs.existsSync(fp)) return res.status(404).end();
  res.sendFile(fp);
});

// 清理超过1小时的临时文件
setInterval(() => {
  try {
    const now = Date.now();
    fs.readdirSync(TEMP_UPLOAD_DIR).forEach(f => {
      const fp = resolve(TEMP_UPLOAD_DIR, f);
      const stat = fs.statSync(fp);
      if (now - stat.mtimeMs > 3600000) fs.unlinkSync(fp);
    });
  } catch {}
}, 600000);

// 第二步先做有界视觉观察，再用文本规划四套方案，避免大体积多模态请求阻塞整条链路。
const ecommerceDesignDirectionService = createDesignDirectionService({
  readImageAsDataUrl: async (url, { signal } = {}) => {
    const image = await imageInputReader.read(url, { signal });
    return imageBufferToVisionDataUrl(image);
  },
  completeText: (request, { stage } = {}) => createEcommerceVlmClient({
    timeoutMs: stage === 'vision' ? 40_000 : 30_000,
    retryDelaysMs: [],
  }).completeText(request),
});

async function generateDesignDirections(input = {}, { signal } = {}) {
  return ecommerceDesignDirectionService.generate(input, { signal });
}

app.post('/api/ecommerce/design-directions', async (req, res) => {
  const { refresh, billing_quote_id: quoteId, billing_action_id: actionId } = req.body || {};
  const deadline = createVlmDeadline({ timeoutMs: DESIGN_DIRECTION_SERVER_TIMEOUT_MS });
  try {
    if (refresh === true) {
      const billed = await canvasOneShotBilling.execute({
        ownerEmail: req._userEmail,
        quoteId,
        actionId,
        sku: 'ec_direction_refresh',
        referenceType: 'ecommerce_direction_refresh',
        providerCostCny: 0.05,
        metadata: { action: 'direction_refresh' },
        work: async () => {
          const result = await generateDesignDirections(req.body, { signal: deadline.signal });
          if (result.degraded) {
            const error = new Error('图片分析服务暂时不可用，请稍后重试');
            error.code = 'DIRECTION_REFRESH_DEGRADED';
            error.status = 503;
            error.retryable = true;
            throw error;
          }
          const fingerprint = crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex');
          return { ...result, url: `direction-refresh:${fingerprint}` };
        },
      });
      return res.json({ ...billed.result, billing: billed.billing });
    }
    const result = await generateDesignDirections(req.body, { signal: deadline.signal });
    designDirectionTelemetry.served += 1;
    if (result.planner_fallback) {
      designDirectionTelemetry.plannerFallbacks += 1;
      designDirectionTelemetry.lastFallbackAt = new Date().toISOString();
      console.warn('[design-directions] planner fallback:', {
        reason: 'PLANNER_TIMEOUT',
        analysisStatus: result.analysis?.status,
      });
    }
    if (result.degraded) {
      designDirectionTelemetry.degraded += 1;
      designDirectionTelemetry.lastDegradedAt = new Date().toISOString();
      console.warn('[design-directions] 降级:', {
        reasons: result.degradedReasons,
        analysisStatus: result.analysis?.status,
      });
    }
    return res.json(result);
  } catch (e) {
    console.warn('[design-directions] 失败:', {
      message: e?.message,
      code: e?.code,
      status: e?.status,
      providerStatus: e?.providerStatus,
    });
    return res.status(e?.status || 500).json({
      error: e?.message || '设计方向生成失败',
      code: e?.code,
      required: e?.required,
      available: e?.available,
      billing: e?.billing,
    });
  } finally {
    deadline.cleanup();
  }
});

// ============================================================
// AI 润色电商文案（供第二步「补充描述」使用）
// ============================================================
app.post('/api/polish-ec-text', async (req, res) => {
  const { text, product_name, category, billing_quote_id: quoteId, billing_action_id: actionId } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: '请输入需要润色的文案' });

  const sys = `你是资深电商策划文案。将用户提供的产品描述/需求，润色为专业的电商生图 prompt 关键词组合，保留核心需求，补充光影、材质、风格、平台规格等专业维度，让 AI 出图更精准。直接输出润色后的文案，不要解释，不要标题，不超过 150 字。`;
  const userMsg = `产品：${product_name || '未知'}，品类：${category || '其他'}\n原始描述：${text}`;

  try {
    const billed = await canvasOneShotBilling.execute({
      ownerEmail: req._userEmail,
      quoteId,
      actionId,
      sku: 'ec_ai_assistant',
      referenceType: 'ecommerce_text_polish',
      providerCostCny: 0.01,
      metadata: { action: 'polish_ec_text', category: category || '' },
      work: async () => {
        const result = await callMiniLLM(sys, [], userMsg);
        const polished = (result || '').trim();
        if (!polished) throw new Error('AI 未返回润色文案');
        return { polished, url: `polish-ec-text:${crypto.createHash('sha256').update(polished).digest('hex')}` };
      },
    });
    res.json({ ...billed.result, billing: billed.billing });
  } catch (e) {
    res.status(e?.status || 500).json({ error: safeCanvasClientError(e, '润色暂时不可用，请稍后重试'), code: e?.code, required: e?.required, available: e?.available, billing: e?.billing });
  }
});

// ============================================================
// 反推提示词（VLM 看图输出完整生图 prompt）
// ============================================================
app.post('/api/reverse-prompt', async (req, res) => {
  const { image_url, product_name, billing_quote_id: quoteId, billing_action_id: actionId } = req.body || {};
  if (!image_url) return res.status(400).json({ error: '缺少图片' });

  try {
    const billed = await canvasOneShotBilling.execute({
      ownerEmail: req._userEmail,
      quoteId,
      actionId,
      sku: 'ec_reverse_prompt',
      referenceType: 'canvas_reverse_prompt',
      providerCostCny: 0.01,
      metadata: { action: 'reverse_prompt' },
      work: async () => {
        const base64 = imageBufferToDataUrl(await imageInputReader.read(image_url));
        const sys = `你是专业的 AI 生图提示词工程师。分析这张电商产品图，还原生成这张图所需的完整提示词，包含产品描述、背景场景、光影风格、构图方式、色调和平台规格。只输出中文提示词，使用自然、具体、可直接编辑的中文短句，不要附加英文版本、标题或解释，总字数不超过 200 字。`;
        const userMsg = `产品：${product_name || '商品'}。请反推这张图的生图提示词。`;
        let aiRes = '';
        let fallback = false;
        try {
          aiRes = await createEcommerceVlmClient().completeText({
            systemPrompt: sys,
            userPrompt: userMsg,
            images: [base64],
            maxTokens: 1200,
            temperature: 0.3,
          });
        } catch (visionError) {
          fallback = true;
          console.warn('[reverse-prompt] 视觉模型降级:', visionError.message);
        }
        const prompt = (aiRes || `${product_name || '电商商品'}，干净的商业产品摄影，主体居中，准确保留商品外形、材质与品牌细节，使用柔和漫射光和克制高光，背景简洁，适合电商目录展示。`).trim();
        if (!prompt) throw new Error('未识别到可编辑的画面描述');
        return { prompt, fallback, url: `reverse-prompt:${crypto.createHash('sha256').update(prompt).digest('hex')}` };
      },
    });
    res.json({ ...billed.result, billing: billed.billing });
  } catch (e) {
    res.status(e?.status || 500).json({ error: safeCanvasClientError(e), code: e?.code, required: e?.required, available: e?.available, billing: e?.billing });
  }
});

// ============================================================
// 去除背景（调用 remove.bg 或本地 rembg）
// ============================================================
async function removeLightBackground(imageBuffer) {
  const split = await segmentUniformBackground(imageBuffer);
  if (!split.segmented) throw new Error('未检测到可靠的纯色或浅色背景，无法安全去背');
  return split.subject;
}

app.post('/api/remove-bg', async (req, res) => {
  const {
    image_url,
    segmentation_plan_token: planToken,
    segmentation_masks: rawMasks,
    billing_quote_id: quoteId,
    billing_action_id: actionId,
  } = req.body || {};
  if (!image_url) return res.status(400).json({ error: '缺少图片' });

  const REMOVE_BG_KEY = process.env.REMOVE_BG_KEY || '';

  try {
    const segmentationPlan = planToken ? canvasSegmentationPlanTokens.verify({
      token: planToken,
      ownerEmail: req._userEmail,
      imageUrl: image_url,
    }) : null;
    const segmentationMasks = segmentationPlan
      ? decodeBrowserSegmentationMasks(rawMasks, segmentationPlan.prompts)
      : null;
    const billed = await canvasOneShotBilling.execute({
      ownerEmail: req._userEmail,
      quoteId,
      actionId,
      sku: 'ec_remove_bg',
      referenceType: 'canvas_remove_bg',
      providerCostCny: 0.03,
      metadata: { action: 'remove_bg', primaryMethod: segmentationPlan ? 'u2netp-browser' : 'legacy-fallback' },
      work: async () => {
        if (segmentationPlan) {
          return canvasLayeringService.removeBackground({
            imageUrl: image_url,
            segmentationPlan,
            segmentationMasks,
          });
        }

        if (REMOVE_BG_KEY) {
          const { buffer: imgBuf } = await imageInputReader.read(image_url);
          const form = new FormData();
          form.append('image_file', new Blob([imgBuf]), 'image.png');
          form.append('size', 'auto');
          const resp = await fetch('https://api.remove.bg/v1.0/removebg', {
            method: 'POST', headers: { 'X-Api-Key': REMOVE_BG_KEY }, body: form,
          });
          if (!resp.ok) throw new Error(`remove.bg HTTP ${resp.status}`);
          const outBuf = Buffer.from(await resp.arrayBuffer());
          const asset = await generatedAssetStore.persistBuffer({
            buffer: outBuf, contentType: 'image/png', taskId: `canvas_remove_bg_${Date.now()}`, label: 'canvas_remove_bg',
          });
          return { result_url: asset.url, url: asset.url, method: 'remove-bg-api' };
        }

        const { buffer: imgBuf } = await imageInputReader.read(image_url);
        const outBuf = await removeLightBackground(imgBuf);
        const asset = await generatedAssetStore.persistBuffer({
          buffer: outBuf,
          contentType: 'image/png',
          taskId: `canvas_remove_bg_local_${Date.now()}`,
          label: 'canvas_remove_bg_local',
        });
        return { result_url: asset.url, url: asset.url, method: 'local-uniform-background' };
      },
    });
    return res.json({ ...billed.result, billing: billed.billing });
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || '去除背景失败', code: e?.code, required: e?.required, available: e?.available, billing: e?.billing });
  }
});

// ============================================================
// 详情切片 → 纵向拼成长图（用于微信分享）
// ============================================================
app.post('/api/ecommerce/stitch-long', async (req, res) => {
  const { imageUrls, sourceIds = [], format = 'png' } = req.body || {};
  if (!imageUrls?.length) return res.status(400).json({ error: '缺少切片图' });
  if (imageUrls.length > 20) return res.status(400).json({ error: '切片数不能超过 20' });
  try {
    const composed = await composeAndPersistLongDetail({ imageUrls, sourceIds, format }, {
      imageInputReader,
      generatedAssetStore,
    });
    console.log(`[stitch-long] 拼接 ${composed.count} 片 → ${composed.width}x${composed.height} → ${composed.url}`);
    res.json(composed);
  } catch (e) {
    console.warn('[stitch-long] 失败:', e.message);
    res.status(500).json({ error: '拼接失败：' + (e.message || '') });
  }
});

// 电商正式生成只注册持久化编排路由；旧同步 Contact Sheet 流程已移除。
app.post('/api/generate-ecommerce', (req, res, next) => {
  if (!ecommerceImageProviderReady()) {
    return res.status(503).json({
      error: '图片生成服务暂未配置，请联系管理员或稍后再试',
      code: 'IMAGE_PROVIDER_UNAVAILABLE',
    });
  }
  next();
}, ecommerceRouteHandlers.generate);

function authenticateEcommerceRequest(req, res, next) {
  try {
    req._userEmail = authenticateContentRequest(req, {
      sessionTokens: contentSessionTokens,
      authorizeEmail: authorizeAccountEmail,
    });
    next();
  } catch (error) {
    const mapped = contentBillingHttpError(error);
    res.status(mapped.status).json(mapped.body);
  }
}

function authenticateFeatureRequest(feature) {
  return (req, res, next) => {
    try {
      req._userEmail = authenticateContentRequest(req, {
        sessionTokens: contentSessionTokens,
        authorizeEmail: authorizeAccountEmail,
      });
      const access = requireFeatureAccess(db, req._userEmail, feature);
      if (!access.ok) {
        return res.status(access.status).json({ error: access.error, code: access.code, feature });
      }
      return next();
    } catch (error) {
      const mapped = contentBillingHttpError(error);
      return res.status(mapped.status).json(mapped.body);
    }
  };
}

const authenticateVideoRequest = authenticateFeatureRequest('video_generation');
const ecommerceAssetBinaryBody = express.raw({
  type: ['image/*', 'application/octet-stream'],
  limit: '15mb',
});

app.post('/api/ecommerce/assets', authenticateEcommerceRequest, ecommerceAssetBinaryBody, ecommerceAssetRouteHandlers.upload);
app.post('/api/ecommerce/exports', authenticateEcommerceRequest, ecommerceExportRouteHandlers.create);
app.get('/api/ecommerce/jobs', authenticateEcommerceRequest, ecommerceRouteHandlers.listJobs);
app.delete('/api/ecommerce/jobs/:id', authenticateEcommerceRequest, ecommerceRouteHandlers.dismissJob);
app.post('/api/ecommerce/jobs/:id/retry-plan', authenticateEcommerceRequest, ecommerceRouteHandlers.retryPlan);
app.post('/api/ecommerce/jobs/:id/retry-failed', authenticateEcommerceRequest, ecommerceRouteHandlers.retryFailed);
app.get('/api/ecommerce/jobs/:id', authenticateEcommerceRequest, ecommerceRouteHandlers.getJob);

app.get('/api/video/capabilities', (req, res) => {
  res.json({
    loading: false,
    ...videoGeneration.capabilities(),
    uploadMode: videoPlatformFlags.VIDEO_PLATFORM_TUS_UPLOAD ? 'tus' : 'direct',
    workbenchEnabled: videoWorkbenchRollout.enabledForRequest(req, request => authenticateContentRequest(request, {
      sessionTokens: contentSessionTokens,
      authorizeEmail: authorizeAccountEmail,
    })),
    workbenchMode: videoWorkbenchRollout.mode,
    workbenchPlanningOnly: videoWorkbenchRollout.planningOnly,
    directorUi: videoPlatformFlags.VIDEO_PLATFORM_DIRECTOR_UI === true,
  });
});
app.post('/api/video/plans', authenticateVideoRequest, async (req, res) => {
  const {
    billingQuoteId: quoteId,
    billingActionId: actionId,
    analysisImageIds = [],
  } = req.body || {};
  try {
    const imageIds = [...new Set((Array.isArray(analysisImageIds) ? analysisImageIds : [])
      .map(value => String(value || '').trim()).filter(Boolean))].slice(0, 9);
    const images = [];
    for (const id of imageIds) {
      const asset = await videoGeneration.readAsset(id, req._userEmail);
      if (!asset || asset.row.kind !== 'image') {
        const error = new Error('视频方案包含无效或无权访问的分析素材');
        error.status = 400;
        error.code = 'VIDEO_PLAN_ASSET_INVALID';
        throw error;
      }
      const buffer = fs.readFileSync(asset.filePath);
      images.push(`data:${asset.row.content_type};base64,${buffer.toString('base64')}`);
    }
    const billed = await canvasOneShotBilling.execute({
      ownerEmail: req._userEmail,
      quoteId,
      actionId,
      sku: 'video_plan_analysis',
      referenceType: 'video_plan_analysis',
      providerCostCny: 0.05,
      metadata: { action: 'video_plan_analysis', feature: 'video_generation' },
      work: async () => {
        const plan = await videoPlanningService.analyze({ ...req.body, images });
        const fingerprint = crypto.createHash('sha256').update(JSON.stringify(plan)).digest('hex');
        return { ...plan, url: `video-plan:${fingerprint}` };
      },
    });
    const { url: _reference, ...plan } = billed.result;
    return res.json({ plan, billing: billed.billing });
  } catch (error) {
    return res.status(error?.status || 500).json({
      error: error?.message || '视频方案分析失败',
      code: error?.code,
      required: error?.required,
      available: error?.available,
      billing: error?.billing,
    });
  }
});
app.post('/api/video/assets', authenticateVideoRequest, async (req, res) => {
  try {
    const kind = String(req.headers['x-video-asset-kind'] || '').trim().toLowerCase();
    const limits = { image: 10 * 1024 * 1024, video: 50 * 1024 * 1024, audio: 15 * 1024 * 1024 };
    if (!limits[kind]) return res.status(400).json({ error: '素材类型不支持' });
    const buffer = await readRequestBuffer(req, limits[kind]);
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
    const publicBaseUrl = `${proto}://${req.get('host')}`;
    const asset = await videoGeneration.uploadAsset({
      ownerEmail: req._userEmail,
      kind,
      contentType: req.headers['content-type'],
      buffer,
      publicBaseUrl,
    });
    return res.status(201).json({ asset });
  } catch (error) {
    return res.status(error?.status || 500).json({ code: error?.code, error: error?.message || '素材上传失败' });
  }
});
app.all(['/api/video/uploads', '/api/video/uploads/:id'], authenticateVideoRequest, (req, res) => {
  if (!videoPlatformFlags.VIDEO_PLATFORM_TUS_UPLOAD) {
    return res.status(409).json({ code: 'VIDEO_TUS_DISABLED', error: '可续传上传暂时不可用，请使用兼容上传' });
  }
  void videoUploadService.handle(req, res);
});
app.get('/api/video/upload-results/:id', authenticateVideoRequest, (req, res) => {
  videoUploadService.handleResult(req, res, req.params.id);
});
app.get('/api/video/assets/:id', authenticateVideoRequest, async (req, res) => {
  const asset = await videoGeneration.readAsset(req.params.id, req._userEmail);
  if (!asset) return res.status(404).end('video asset not found');
  return sendVideoAsset(req, res, asset);
});
app.get('/api/video/media/:id', async (req, res) => {
  const asset = await videoGeneration.readSignedAsset({
    id: req.params.id,
    purpose: req.query.purpose,
    expires: req.query.expires,
    signature: req.query.signature,
  });
  if (!asset) return res.status(404).end('video asset not found');
  return sendVideoAsset(req, res, asset);
});
app.post('/api/video/jobs', authenticateVideoRequest, async (req, res) => {
  try {
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
    const result = await videoGeneration.createJob({
      ownerEmail: req._userEmail,
      idempotencyKey: req.get('Idempotency-Key'),
      billingQuoteId: req.body?.billingQuoteId,
      publicBaseUrl: `${proto}://${req.get('host')}`,
      input: req.body,
    });
    return res.status(result.replay ? 200 : 202).json(result);
  } catch (error) {
    return res.status(error?.status || 500).json({
      code: error?.code,
      error: error?.status && error.status < 500 ? error.message : '视频任务创建失败，请稍后重试',
      required: error?.required,
      available: error?.available,
    });
  }
});
app.get('/api/video/jobs', authenticateVideoRequest, (req, res) => {
  res.json({ jobs: videoGeneration.listJobs(req._userEmail, req.query.limit) });
});
app.get('/api/video/jobs/:id', authenticateVideoRequest, (req, res) => {
  const job = videoGeneration.getJob(req._userEmail, req.params.id);
  return job ? res.json({ job }) : res.status(404).json({ error: '视频任务不存在' });
});
app.get('/api/admin/video-reviews', adminRouteHandlers.requireAdmin, (req, res) => {
  res.json({ reviews: videoGeneration.listSubmissionReviews(req.query.limit) });
});
app.post('/api/admin/video-reviews/:id/resolve', adminRouteHandlers.requireAdmin, (req, res) => {
  try {
    return res.json({ job: videoGeneration.resolveSubmissionReview(req.params.id, req.body?.providerTaskId) });
  } catch (error) {
    return res.status(error?.status || 400).json({ error: error?.message || '视频任务核对失败', code: error?.code || 'VIDEO_REVIEW_INVALID' });
  }
});
app.post('/api/admin/video-reviews/:id/reject', adminRouteHandlers.requireAdmin, (req, res) => {
  try {
    return res.json({ job: videoGeneration.rejectSubmissionReview(req.params.id) });
  } catch (error) {
    return res.status(error?.status || 400).json({ error: error?.message || '视频任务核对失败', code: error?.code || 'VIDEO_REVIEW_INVALID' });
  }
});

function sendCompositionError(error, res) {
  const code = error?.code || 'COMPOSITION_REQUEST_FAILED';
  if (error?.status === 402) {
    return res.status(402).json({
      code,
      error: error.message || 'AI 积分不足，请购买套餐后继续',
      required: error.required,
      available: error.available,
      billing: error.billing,
      resumeable: error.resumeable,
    });
  }
  if (code === 'DOCUMENT_NOT_FOUND' || code === 'ASSET_NOT_FOUND') {
    return res.status(404).json({ code, error: '未找到可编辑的合成内容' });
  }
  if (code === 'VERSION_CONFLICT') {
    return res.status(409).json({ code, error: '文字内容已在其他位置更新，请刷新后重试' });
  }
  if (error instanceof TypeError || code === 'PROJECT_NOT_FOUND' || code === 'VERSION_NOT_FOUND') {
    return res.status(400).json({ code, error: error.message || '合成参数无效' });
  }
  console.error('[composition] 失败:', error?.message || error);
  return res.status(500).json({ code, error: '文字合成失败，请重试' });
}

app.post('/api/compositions', authenticateEcommerceRequest, async (req, res) => {
  try {
    const result = await compositionService.createDocument({
      ownerEmail: req._userEmail,
      projectId: req.body?.projectId,
      versionId: req.body?.versionId,
      width: req.body?.width,
      height: req.body?.height,
      colorSpace: req.body?.colorSpace || 'srgb',
      backgroundAssetId: req.body?.backgroundAssetId || null,
      layers: req.body?.layers,
    });
    return res.status(201).json(result);
  } catch (error) {
    return sendCompositionError(error, res);
  }
});

app.get('/api/compositions', authenticateEcommerceRequest, (req, res) => {
  try {
    const documents = compositionService.listDocuments({
      ownerEmail: req._userEmail,
      projectId: req.query?.projectId,
      versionId: req.query?.versionId,
    });
    return res.json({ documents });
  } catch (error) {
    return sendCompositionError(error, res);
  }
});

app.get('/api/compositions/:documentId', authenticateEcommerceRequest, (req, res) => {
  try {
    const document = compositionService.getDocument({ ownerEmail: req._userEmail, documentId: req.params.documentId });
    if (!document) return res.status(404).json({ code: 'DOCUMENT_NOT_FOUND', error: '未找到可编辑的合成内容' });
    return res.json({ document });
  } catch (error) {
    return sendCompositionError(error, res);
  }
});

app.post('/api/compositions/:documentId/revisions', authenticateEcommerceRequest, async (req, res) => {
  try {
    const result = await compositionService.saveRevision({
      ownerEmail: req._userEmail,
      documentId: req.params.documentId,
      expectedRevision: req.body?.expectedRevision,
      layers: req.body?.layers,
      backgroundAssetId: req.body?.backgroundAssetId,
    });
    return res.json(result);
  } catch (error) {
    return sendCompositionError(error, res);
  }
});

// 画布二次生成由独立持久化服务负责；路由只转交已认证 owner 与请求体。
app.post('/api/canvas/regenerate', canvasRegenerateHandler);
app.post('/api/canvas/regenerate/status', authenticateEcommerceRequest, canvasGenerationStatusHandler);

async function readCanvasImage(imageUrl) {
  return (await imageInputReader.read(imageUrl)).buffer;
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function clampCanvasUnit(value, fallback = 0) {
  const parsed = Number(value);
  return Math.min(1, Math.max(0, Number.isFinite(parsed) ? parsed : fallback));
}

function canvasCropRect(width, height, cropRect, ratio) {
  if (!cropRect || typeof cropRect !== 'object') return cropRectForRatio(width, height, ratio);
  const x = clampCanvasUnit(cropRect.x);
  const y = clampCanvasUnit(cropRect.y);
  const w = Math.min(1 - x, clampCanvasUnit(cropRect.w, 1 - x));
  const h = Math.min(1 - y, clampCanvasUnit(cropRect.h, 1 - y));
  if (w < 0.01 || h < 0.01) return cropRectForRatio(width, height, ratio);
  const left = Math.min(width - 1, Math.max(0, Math.floor(width * x)));
  const top = Math.min(height - 1, Math.max(0, Math.floor(height * y)));
  return {
    left,
    top,
    width: Math.max(1, Math.min(width - left, Math.round(width * w))),
    height: Math.max(1, Math.min(height - top, Math.round(height * h))),
  };
}

function canvasSplitRects(width, height, direction, splitPosition) {
  const position = Math.min(0.9, Math.max(0.1, Number(splitPosition) || 0.5));
  if (direction === 'horizontal') {
    const split = Math.max(1, Math.min(height - 1, Math.round(height * position)));
    return [
      { left: 0, top: 0, width, height: split },
      { left: 0, top: split, width, height: height - split },
    ];
  }
  const split = Math.max(1, Math.min(width - 1, Math.round(width * position)));
  return [
    { left: 0, top: 0, width: split, height },
    { left: split, top: 0, width: width - split, height },
  ];
}

// 画布二次处理：像素级工具与 AI 工具统一返回稳定素材地址。
app.post('/api/canvas/transform', async (req, res) => {
  const {
    action,
    image_url: imageUrl,
    prompt = '',
    ratio = '1:1',
    target_language: targetLanguage = '中文',
    resolution = '2K',
    image_model: imageModel = 'image2',
    annotation = '',
    annotations = [],
    grid = 2,
    grid_rows: gridRows,
    grid_columns: gridColumns,
    grid_vertical: gridVertical,
    grid_horizontal: gridHorizontal,
    direction = 'vertical',
    crop_rect: cropRect,
    split_position: splitPosition,
    source_box: sourceBox,
    target_box: targetBox,
    rotation = 0,
    billing_quote_id: quoteId,
    billing_action_id: actionId,
  } = req.body || {};
  if (!imageUrl) return res.status(400).json({ error: '缺少图片' });
  const pixelActions = new Set(['crop', 'grid-split', 'split-image', 'annotation']);
  const aiActions = new Set(['retouch', 'extend', 'translate', 'upscale', 'move-scale']);
  if (!pixelActions.has(action) && !aiActions.has(action)) {
    return res.status(400).json({ error: '不支持的画布操作' });
  }
  if (action === 'move-scale') {
    const validBox = box => box && [box.x, box.y, box.w, box.h].every(Number.isFinite)
      && box.x >= 0 && box.y >= 0 && box.w >= 0.03 && box.h >= 0.03
      && box.x + box.w <= 1.000001 && box.y + box.h <= 1.000001;
    if (!validBox(sourceBox) || !validBox(targetBox)) {
      return res.status(400).json({ error: '请先框选对象，并确认它的新位置和大小' });
    }
  }
  try {
    const taskId = `canvas_${action}_${Date.now()}`;

    if (action === 'crop') {
      const sourceBuffer = await readCanvasImage(imageUrl);
      const metadata = await sharp(sourceBuffer).metadata();
      const rect = canvasCropRect(metadata.width || 1, metadata.height || 1, cropRect, ratio);
      const output = await sharp(sourceBuffer).extract(rect).png().toBuffer();
      const asset = await generatedAssetStore.persistBuffer({ buffer: output, taskId, label: 'canvas_crop' });
      return res.json({ url: asset.url, ratio, width: rect.width, height: rect.height });
    }

    if (action === 'grid-split') {
      const sourceBuffer = await readCanvasImage(imageUrl);
      const metadata = await sharp(sourceBuffer).metadata();
      const width = metadata.width || 1;
      const height = metadata.height || 1;
      // 行列已拆分为独立维度：优先取显式 grid_rows/grid_columns，其次从可拖拽分割线数量推导，最后回退旧 N×N 档位。
      const legacyGridSize = Math.max(2, Math.min(5, Math.round(Number(grid) || 2)));
      const { columns, rows } = resolveGridDimensions({
        grid: legacyGridSize,
        rows: gridRows,
        columns: gridColumns,
        horizontalPositions: gridHorizontal,
        verticalPositions: gridVertical,
      });
      if (width < columns || height < rows) {
        return res.status(400).json({ error: `图片尺寸过小，无法拆分为 ${rows * columns} 张独立切片` });
      }
      const urls = [];
      for (const [index, rect] of gridRectsFromGuides(width, height, columns, rows, gridVertical, gridHorizontal).entries()) {
        const output = await sharp(sourceBuffer).extract(rect).png().toBuffer();
        const asset = await generatedAssetStore.persistBuffer({
          buffer: output,
          taskId,
          label: `canvas_grid_${index + 1}`,
        });
        urls.push({ url: asset.url, index });
      }
      return res.json({ urls, count: urls.length, columns, rows });
    }

    if (action === 'split-image') {
      const sourceBuffer = await readCanvasImage(imageUrl);
      const metadata = await sharp(sourceBuffer).metadata();
      const width = metadata.width || 1;
      const height = metadata.height || 1;
      const defaultRects = gridRects(width, height, direction === 'vertical' ? 2 : 1, direction === 'horizontal' ? 2 : 1);
      const rects = splitPosition == null ? defaultRects : canvasSplitRects(width, height, direction, splitPosition);
      const urls = [];
      for (const [index, rect] of rects.entries()) {
        const output = await sharp(sourceBuffer).extract(rect).png().toBuffer();
        const asset = await generatedAssetStore.persistBuffer({
          buffer: output,
          taskId,
          label: `canvas_split_${index + 1}`,
        });
        urls.push({ url: asset.url, index });
      }
      return res.json({ urls, count: urls.length, direction });
    }

    if (action === 'annotation') {
      const sourceBuffer = await readCanvasImage(imageUrl);
      const metadata = await sharp(sourceBuffer).metadata();
      const width = metadata.width || 1024;
      const height = metadata.height || 1024;
      const text = String(annotation || prompt).trim().slice(0, 120);
      const svg = canvasAnnotationSvg(width, height, annotations, text);
      const output = await sharp(sourceBuffer).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
      const asset = await generatedAssetStore.persistBuffer({ buffer: output, taskId, label: 'canvas_annotation' });
      return res.json({ url: asset.url, annotation: text, annotationCount: annotations.length || (text ? 1 : 0) });
    }

    const selectedSize = resolveGenerationSize({ resolution, ratio, imageModel });
    const feature = ecommerceFeatureForItem({ imageModel, generationSize: selectedSize.size });
    const billed = await canvasOneShotBilling.execute({
      ownerEmail: req._userEmail,
      quoteId,
      actionId,
      sku: feature.sku,
      referenceType: 'canvas_transform',
      providerCostCny: feature.providerCostCny,
      metadata: { action, imageModel },
      resumableWork: true,
      work: () => canvasGenerationService.regenerate({
        ownerEmail: req._userEmail,
        body: {
          prompt: buildCanvasTransformPrompt({ action, prompt, targetLanguage, sourceBox, targetBox, rotation }),
          image_url: imageUrl,
          ratio: selectedSize.ratio,
          resolution: selectedSize.resolution,
          image_model: imageModel,
        },
      }),
    });
    return res.json({ ...billed.result, action, billing: billed.billing });
  } catch (error) {
    console.error(`[canvas/${action}] 失败:`, error.message);
    return res.status(error?.status || 500).json({
      error: safeCanvasClientError(error),
      code: error?.code,
      required: error?.required,
      available: error?.available,
      billing: error?.billing,
    });
  }
});

app.post('/api/canvas/regenerate-text', authenticateEcommerceRequest, async (req, res) => {
  const {
    prompt,
    reference_images: referenceImages = [],
    reference_metadata: referenceMetadata = [],
    count = 1,
    billing_quote_id: quoteId,
    billing_action_id: actionId,
  } = req.body || {};
  if (!String(prompt || '').trim()) return res.status(400).json({ error: '缺少文案生成要求' });
  if (!Array.isArray(referenceImages) || referenceImages.length > 8) {
    return res.status(400).json({ error: '参考图片数量不合法' });
  }
  try {
    const outputCount = Math.max(1, Math.min(4, Number(count) || 1));
    const billed = await canvasOneShotBilling.execute({
      ownerEmail: req._userEmail,
      quoteId,
      actionId,
      sku: 'ec_ai_assistant',
      referenceType: 'canvas_text_regeneration',
      providerCostCny: 0.01,
      metadata: { action: 'regenerate_canvas_text', outputCount },
      work: async () => {
        const visualInputs = [];
        for (const imageUrl of referenceImages) {
          visualInputs.push(imageBufferToDataUrl(await imageInputReader.read(imageUrl)));
        }
        const mentionGuide = visualInputs.length
          ? visualInputs.map((_, index) => {
            const meta = Array.isArray(referenceMetadata) ? referenceMetadata[index] : null;
            const label = String(meta?.mention || meta?.label || `@图片${index + 1}`).trim();
            const name = String(meta?.displayName || meta?.name || label.replace(/^@/, '')).trim();
            const role = meta?.role === 'product' ? '商品图' : '参考图';
            return `${label}=${name}（${role}，输入序号 ${index + 1}）`;
          }).join('；')
          : '无参考图片';
        const text = await createEcommerceVlmClient().completeText({
          systemPrompt: [
            '你是专业电商文案编辑。根据用户要求输出可直接编辑使用的中文文案，不要解释过程。',
            '参考图片通过用户可见的 @名称与输入序号建立映射；必须准确区分每张图片，不能虚构图片中不存在的商品属性。',
            '默认给出清晰标题和精炼正文；用户指定格式、数量或语言时严格遵循。',
          ].join('\n'),
          userPrompt: `参考顺序：${mentionGuide}\n生成 ${outputCount} 个版本。\n生成要求：${String(prompt).trim()}`,
          images: visualInputs,
          maxTokens: Math.min(4000, 1200 * outputCount),
          temperature: 0.45,
        });
        const output = String(text || '').trim();
        if (!output) throw new Error('视觉模型未返回文案');
        return { text: output, url: `canvas-text:${crypto.createHash('sha256').update(output).digest('hex')}` };
      },
    });
    return res.json({ ...billed.result, billing: billed.billing });
  } catch (error) {
    console.error('[canvas/regenerate-text] 失败:', error.message);
    return res.status(error?.status || 500).json({ error: safeCanvasClientError(error, '文案生成暂时不可用，请稍后重试'), code: error?.code, required: error?.required, available: error?.available, billing: error?.billing });
  }
});

app.post('/api/canvas/segmentation-plan', async (req, res) => {
  const { image_url: imageUrl } = req.body || {};
  if (!imageUrl) return res.status(400).json({ error: '缺少图片' });
  try {
    const analysis = await canvasLayeringService.createSegmentationPlan({ imageUrl });
    const issued = canvasSegmentationPlanTokens.issue({
      ownerEmail: req._userEmail,
      imageUrl,
      source: analysis.source,
      plan: analysis.plan,
      prompts: analysis.prompts,
    });
    return res.json({
      source: analysis.source,
      prompts: analysis.prompts,
      text_blocks: analysis.plan.textBlocks,
      plan_token: issued.planToken,
      expires_at: issued.expiresAt,
    });
  } catch (error) {
    console.error('[canvas/segmentation-plan] 失败:', error.message);
    return res.status(error?.status || 500).json({
      error: safeCanvasClientError(error, '商品识别暂时不可用，请稍后重试'),
      code: error?.code,
    });
  }
});

// 画布图文分层：自动生成可移动的商品实例、商品整组、背景净版与文字层。
app.post('/api/canvas/analyze-layers', async (req, res) => {
  const {
    image_url: imageUrl,
    segmentation_plan_token: planToken,
    segmentation_masks: rawMasks,
    billing_quote_id: quoteId,
    billing_action_id: actionId,
  } = req.body || {};
  if (!imageUrl) return res.status(400).json({ error: '缺少图片' });
  try {
    const segmentationPlan = canvasSegmentationPlanTokens.verify({
      token: planToken,
      ownerEmail: req._userEmail,
      imageUrl,
    });
    const segmentationMasks = decodeBrowserSegmentationMasks(rawMasks, segmentationPlan.prompts);
    const billed = await canvasOneShotBilling.execute({
      ownerEmail: req._userEmail,
      quoteId,
      actionId,
      sku: 'ec_smart_layer',
      referenceType: 'canvas_smart_layer',
      providerCostCny: 0.20,
      metadata: { action: 'smart_layer', method: 'vision-u2netp-browser-image2' },
      work: () => canvasLayeringService.createLayers({
        imageUrl,
        segmentationPlan,
        segmentationMasks,
      }),
    });
    res.json({ ...billed.result, billing: billed.billing });
  } catch (error) {
    console.error('[canvas/analyze-layers] 失败:', error.message);
    res.status(error?.status || 500).json({
      error: safeCanvasClientError(error, '图层分析暂时不可用，请稍后重试'),
      code: error?.code,
      required: error?.required,
      available: error?.available,
      billing: error?.billing,
    });
  }
});

// 画布图片文字识别：返回图片内的文字框，供原位替换，而不是新建一个文字节点。
app.post('/api/canvas/ocr', authenticateEcommerceRequest, async (req, res) => {
  const {
    image_url: imageUrl,
    billing_quote_id: quoteId,
    billing_action_id: actionId,
  } = req.body || {};
  if (!imageUrl) return res.status(400).json({ error: '缺少图片' });
  try {
    const billed = await canvasOneShotBilling.execute({
      ownerEmail: req._userEmail,
      quoteId,
      actionId,
      sku: 'ec_canvas_ocr',
      referenceType: 'canvas_ocr',
      providerCostCny: 0.01,
      metadata: { action: 'ocr' },
      work: async () => {
        const buffer = await readCanvasImage(imageUrl);
        const image = `data:image/png;base64,${(await sharp(buffer).png().toBuffer()).toString('base64')}`;
        const visionResult = await createEcommerceVlmClient().analyzeJson({
          systemPrompt: '你是商品图 OCR 引擎。只识别图片中已经存在的可见文字，不要生成新文案。只返回 JSON：{"blocks":[{"id":"...","text":"...","x":0,"y":0,"width":0.2,"height":0.08,"color":"#111111","background":"#ffffff"}]}。坐标都是相对图片左上角的 0 到 1 小数，文字框要覆盖完整文字。',
          userPrompt: '逐块识别图片内可编辑文字，保留原文顺序、大小关系和大致位置；没有文字就返回 {"blocks":[]}。',
          images: [image],
          maxTokens: 1500,
          temperature: 0.3,
        });
        const blocks = parseVisionTextBlocks(JSON.stringify(visionResult));
        const fingerprint = crypto.createHash('sha256').update(JSON.stringify(blocks)).digest('hex');
        return { blocks, status: '已识别', url: `canvas-ocr:${fingerprint}` };
      },
    });
    return res.json({ ...billed.result, billing: billed.billing });
  } catch (error) {
    console.error('[canvas/ocr] 失败:', error.message);
    return res.status(error?.status || 500).json({
      error: safeCanvasClientError(error, '图片文字识别暂时不可用，请稍后重试'),
      code: error?.code,
      required: error?.required,
      available: error?.available,
      billing: error?.billing,
    });
  }
});

// 文字替换产出新的图片版本，保留原图节点；当前版本用识别框背景色擦除并重排文字。
app.post('/api/canvas/replace-text', authenticateEcommerceRequest, async (req, res) => {
  const { image_url: imageUrl, blocks = [] } = req.body || {};
  if (!imageUrl || !Array.isArray(blocks) || !blocks.length) return res.status(400).json({ error: '缺少图片或文字修改内容' });
  try {
    const input = await readCanvasImage(imageUrl);
    const metadata = await sharp(input).metadata();
    const width = metadata.width || 1200;
    const height = metadata.height || 1200;
    const safeBlocks = blocks.slice(0, 40).filter(block => String(block?.text || '').trim()).map((block, index) => ({
      ...block,
      id: String(block.id || `text-${index + 1}`),
      x: Math.max(0, Math.min(1, Number(block.x) || 0)),
      y: Math.max(0, Math.min(1, Number(block.y) || 0)),
      width: Math.max(0.01, Math.min(1, Number(block.width) || 0.1)),
      height: Math.max(0.01, Math.min(1, Number(block.height) || 0.08)),
      text: String(block.text).slice(0, 400),
      color: /^#[0-9a-f]{6}$/i.test(String(block.color || '')) ? block.color : '#111111',
      background: /^#[0-9a-f]{6}$/i.test(String(block.background || '')) ? block.background : '#ffffff',
    }));
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${safeBlocks.map(block => {
      const x = Math.round(block.x * width);
      const y = Math.round(block.y * height);
      const w = Math.min(width - x, Math.round(block.width * width));
      const h = Math.min(height - y, Math.round(block.height * height));
      const fontSize = Math.max(12, Math.round(h * 0.62));
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${escapeXml(block.background)}"/><text x="${x + 4}" y="${y + Math.round(h * 0.72)}" fill="${escapeXml(block.color)}" font-size="${fontSize}" font-family="Arial, Microsoft YaHei, sans-serif">${escapeXml(block.text)}</text>`;
    }).join('')}</svg>`;
    const output = await sharp(input).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
    const asset = await generatedAssetStore.persistBuffer({ buffer: output, contentType: 'image/png', taskId: `canvas_replace_text_${Date.now()}`, label: 'canvas_replace_text' });
    return res.json({ url: asset.url, result_url: asset.url, blocks: safeBlocks, status: '已替换' });
  } catch (error) {
    console.error('[canvas/replace-text] 失败:', error.message);
    return res.status(500).json({ error: safeCanvasClientError(error, '图片文字替换失败，请稍后重试') });
  }
});

// 画布像素分层：将已经过 owner 校验的源图层固化为透明位图和掩码。
app.post('/api/canvas/pixel-layers', authenticateEcommerceRequest, async (req, res) => {
  try {
    const documentId = String(req.body?.documentId || '').trim();
    if (!documentId) throw new TypeError('documentId is required');
    const document = compositionService.getDocument({ ownerEmail: req._userEmail, documentId });
    if (!document) throw Object.assign(new Error('composition document not found'), { code: 'DOCUMENT_NOT_FOUND' });
    for (const layer of document.layers) {
      if (layer?.kind !== 'image') continue;
      const allowed = await compositionAssetAuthorizer({
        ownerEmail: req._userEmail,
        projectId: document.projectId,
        versionId: document.versionId,
        assetId: layer.assetId,
      });
      if (!allowed) throw Object.assign(new Error('image layer asset not found'), { code: 'ASSET_NOT_FOUND' });
    }
    const billed = await canvasOneShotBilling.execute({
      ownerEmail: req._userEmail,
      quoteId: req.body?.billing_quote_id,
      actionId: req.body?.billing_action_id,
      sku: 'ec_layer_psd',
      referenceType: 'canvas_pixel_layers',
      providerCostCny: 0.20,
      metadata: { action: 'pixel_layers', documentId },
      work: async () => {
        const layered = await createPixelLayers({ document, generatedAssetStore });
        const saved = compositionStore.saveRevision({ ownerEmail: req._userEmail, documentId, expectedRevision: req.body?.expectedRevision ?? document.revision, layers: layered.layers, backgroundAssetId: document.backgroundAssetId, renderedAssetId: document.renderedAssetId });
        return { url: `composition:${documentId}:r${saved.revision}`, document: { ...saved, capabilities: layered.capabilities } };
      },
    });
    return res.json({ document: billed.result.document, billing: billed.billing });
  } catch (error) {
    return sendCompositionError(error, res);
  }
});

// 画布 PSD 导出：只发布经结构校验的多图层二进制文件。
app.post('/api/canvas/psd-export', authenticateEcommerceRequest, async (req, res) => {
  try {
    const documentId = String(req.body?.documentId || '').trim();
    if (!documentId) throw new TypeError('documentId is required');
    const document = compositionService.getDocument({ ownerEmail: req._userEmail, documentId });
    if (!document) throw Object.assign(new Error('composition document not found'), { code: 'DOCUMENT_NOT_FOUND' });
    const buffer = await exportPsd({ document, generatedAssetStore });
    validatePsdStructure(buffer);
    res.setHeader('Content-Type', 'image/vnd.adobe.photoshop');
    res.setHeader('Content-Disposition', `attachment; filename="${document.id}.psd"`);
    return res.send(buffer);
  } catch (error) {
    return sendCompositionError(error, res);
  }
});

// ── P1 认证底座：验证码 / 密码 / 找回密码 / 会话刷新与换发 ──
mountAuthRoutes(app, {
  authService,
  requireAccess: authorizeAccountEmail,
  legacyTokens: legacyContentSessionTokens,
  providers: authProviderRegistry,
  oauthStore,
  mailer: {
    canSend: () => true,
    sendVerificationCodeMail: ({ to, code }) => { try { sendVerificationCode({ to, code }); } catch (e) { /* ignore */ } },
    sendPasswordResetMail: ({ to, code }) => { try { sendVerificationCode({ to, code }); } catch (e) { void e; } },
  },
});

// ============================================================
// 扩展端 API 路由
// ============================================================
mountExtRoutes(app, { billing: canvasOneShotBilling });

// ============================================================
// 启动
// ============================================================


function plogOptions({ style, layout, coverVariant } = {}) {
  return {
    style: PLOG_STYLES[style] ? style : 'ins-minimal',
    layout: LAYOUT_TEMPLATES[layout] ? layout : 'casual',
    coverVariant: COVER_VARIANTS[coverVariant] ? coverVariant : 'collage',
  };
}

async function runPlogPreview(req, res) {
  const text = String(req.body?.text || '').trim();
  const options = plogOptions(req.body);
  const scene = classifyScene(text);
  const lens = getLensesForScene(scene, 1)[0];
  return runContentPreviewSse({
    res,
    generationId: req.body?.generationId,
    mode: 'plog',
    generateCover: async ({ generationId, send }) => {
      send('progress', { step: 'preview_cover', msg: '正在生成 Plog 封面预览...' });
      const prompt = buildPlogPrompt({
        lens,
        style: options.style,
        toneInfo: null,
        isCover: true,
        index: 0,
        totalCount: 1,
        category: scene,
        layout: options.layout,
        coverVariant: options.coverVariant,
      });
      const source = await callImageAPI(prompt, null, null);
      const url = await persistGeneratedAsset({
        source,
        generationId,
        label: 'plog-preview-cover',
      });
      return {
        url,
        delivery: {
          caption: generatePlogCaption(scene, scene, options.style),
          copyLines: [],
          cover_url: url,
          image_urls: [],
          image_count: 0,
        },
      };
    },
  });
}

async function generatePlogContentSet({
  text,
  refImage,
  referenceGroups,
  style,
  layout,
  coverVariant,
  skipEnrich,
  send,
  generationId,
  workId,
}) {
  const options = plogOptions({ style, layout, coverVariant });
  const groups = normalizeReferenceGroups(referenceGroups || { style: refImage ? [refImage] : [] });
  if (!groups.style.length && refImage) groups.style = [refImage];
  send('progress', { step: 'scene', msg: '正在分析场景...' });
  const scene = classifyScene(text);
  const creativeDirection = deriveXhsCreativeDirection(generationId || text);

  send('progress', { step: 'lens', msg: `正在形成${creativeDirection.name}生活镜头...` });
  const totalCount = 9;
  let creativePlan = createDynamicPlogFallback({ text, direction: creativeDirection, count: totalCount });
  let lenses = creativePlan.lenses;
  if (!skipEnrich && text.length > 6) {
    try {
      const request = buildDynamicPlogRequest({ text, scene, direction: creativeDirection, count: totalCount });
      const raw = await callMiniLLM(request.systemPrompt, [], request.userPrompt, {
        signal: AbortSignal.timeout(45_000),
        temperature: 0.86,
        maxTokens: 5000,
      });
      creativePlan = normalizeDynamicPlogPlan(parseXhsPlannerJson(raw), totalCount);
      if (!creativePlan) throw new Error('动态Plog策划缺少完整镜头');
      lenses = creativePlan.lenses;
    } catch (error) {
      console.error('[plog dynamic] 规划失败, 使用动态事实镜头:', error.message);
    }
  }

  const toneSource = groups.style[0] || groups.source[0];
  send('progress', { step: 'tone', msg: toneSource ? '正在分析参考素材的色调与生活质感...' : '已选风格色调' });
  const toneInfo = toneSource
    ? await extractToneFromImage(toneSource, callMiniLLM)
    : null;
  let referenceContext = '';
  const contextImages = [...groups.style, ...groups.source].slice(0, 6);
  if (contextImages.length) {
    try {
      const contextRaw = await callMiniLLM(
        '你是生活方式摄影分析师。区分风格参考和用户生活素材，只输出可验证事实与可借鉴的视觉方法，不复制具体文字、人物或物件。',
        contextImages,
        `前 ${groups.style.length} 张是风格参考，其余是用户生活素材。请输出JSON：{"style_principles":["色调/光线/材质/构图方法"],"source_facts":["用户素材中能直接确认的主体、空间和物件"],"mood":"氛围"}`,
        { signal: AbortSignal.timeout(45_000), maxTokens: 1800, temperature: 0.25 },
      );
      const parsed = JSON.parse((contextRaw || '').replace(/```(?:json)?/g, '').trim().match(/\{[\s\S]*\}/)?.[0] || '{}');
      referenceContext = [
        parsed.mood ? `氛围：${parsed.mood}` : '',
        parsed.style_principles?.length ? `风格方法：${parsed.style_principles.join('、')}` : '',
        parsed.source_facts?.length ? `用户素材事实：${parsed.source_facts.join('、')}` : '',
      ].filter(Boolean).join('。');
    } catch (error) {
      console.warn('[plog reference] 素材分析失败（不阻断）:', error.message);
    }
  }

  send('progress', { step: 'generating', msg: '正在绘制 Plog 图片...', total: totalCount, current: 0 });
  let completedCount = 0;
  const tasks = Array.from({ length: totalCount }, (_, index) => {
    const isCover = index === 0;
    return {
      id: isCover ? 'cover' : 'p' + index,
      index,
      reference_use: lenses[index]?.reference_use || 'none',
      prompt: buildPlogPrompt({
        lens: lenses[index], style: options.style, toneInfo, isCover, index, totalCount,
        category: scene, layout: options.layout, coverVariant: options.coverVariant,
      }) + (referenceContext ? ` Reference analysis: ${referenceContext}. ` : '')
        + (lenses[index]?.reference_use && lenses[index].reference_use !== 'none'
          ? 'Use the supplied user source image as the subject or environment anchor for this shot; do not import unrelated objects from it. '
          : ''),
    };
  });
  const results = await generateCompleteImageSet({
    tasks,
    execute: async task => {
      const sourceInputs = selectSourceInputs({ groups, task });
      const source = await callImageAPI(task.prompt, null, sourceInputs);
      return persistGeneratedAsset({ source, generationId, label: 'plog-' + task.id });
    },
    onComplete: (entry, task) => {
      completedCount += 1;
      send('image', {
        ...entry,
        index: task.index,
        total: totalCount,
        generationId,
        workId,
      });
      send('progress', {
        step: 'generating',
        msg: '正在绘制 Plog 图片...',
        total: totalCount,
        current: completedCount,
      });
    },
    onAttemptFailure: ({ task, phase, attempt, attempts, error }) => {
      console.error('[plog-v2]', task.id, phase, 'attempt', `${attempt}/${attempts}`, 'failed:', error.message);
    },
  });

  const coverUrl = results.find(result => result.id === 'cover')?.url || '';
  const imageUrls = results.filter(result => result.id !== 'cover').map(result => result.url);
  // Keep the exact prompt used for every delivered image so saved works can be
  // promoted to Inspiration cases and later regenerated without guessing.
  const imagePrompts = tasks.map(task => ({
    page_id: task.index,
    prompt: task.prompt,
    shot_role: lenses[task.index]?.shot_role || '',
    reference_use: task.reference_use,
  }));
  return {
    scene,
    style: options.style,
    layout: options.layout,
    coverVariant: options.coverVariant,
    caption: creativePlan?.caption || generatePlogCaption(scene, scene, options.style),
    copyLines: creativePlan?.copyLines || generatePlogCopy(scene, lenses, toneInfo),
    cover_url: coverUrl,
    cover_prompt: imagePrompts[0]?.prompt || '',
    image_urls: imageUrls,
    image_prompts: imagePrompts,
    image_count: imageUrls.length,
    total_count: totalCount,
    toneInfo,
    creative_direction: creativeDirection.id,
    creative_seed: creativeDirection.seed,
    creative_brief: {
      promise: '用有呼吸感的生活镜头整理一段可回看的记忆',
      shot_roles: lenses.map(lens => lens.shot_role).filter(Boolean),
      variation_note: '镜头职责、景别和节奏由本轮文本与素材动态决定',
    },
    reference_usage: referenceUsageLabel(groups),
    reference_assets: { style_count: groups.style.length, source_count: groups.source.length },
  };
}

// ── Plog 生活氛围感（V2：独立引擎，与种草完全隔离）──
app.post('/api/plog-generate', async (req, res) => {
  const { text, refImage, referenceAssetIds, referenceAssets, style, layout, coverVariant, skipEnrich } = req.body || {};
  if (!text?.trim()) return sendContentInputError(res);
  if (req._contentPreview === true) return runPlogPreview(req, res);
  let resolvedReferenceGroups;
  try {
    resolvedReferenceGroups = await resolveContentReferenceGroups({
      ownerEmail: req._userEmail,
      referenceAssets,
      referenceAssetIds,
      legacyImages: refImage ? [refImage] : [],
      assetUploadService: ecommerceAssetUploadService,
      generatedAssetStore,
    });
  } catch (error) {
    return res.status(error?.status || 422).json({ error: error?.message || '参考素材不可用' });
  }
  return runBilledContentSse({
    res,
    ownerEmail: req._userEmail,
    generationId: req.body?.generationId,
    mode: 'plog',
    projectInput: { referenceGroups: contentProjectReferenceGroups({ referenceAssets, referenceAssetIds }) },
    generate: context => generatePlogContentSet({
      ...context,
      text: text.trim(),
      referenceGroups: resolvedReferenceGroups,
      style,
      layout,
      coverVariant,
      skipEnrich,
    }),
  });
});

/* ── 全局 Express 错误处理器（兜底）──
 * 任何 async route handler 未捕获的异常会到这里。
 * 防止「一个路由崩 → 整个进程挂」。
 */
app.use((err, req, res, next) => {
  if (!err) return next();
  console.error('‼️ Express 路由异常:', err.message, err.stack?.split('\n').slice(1,4).join(' '));
  if (res.headersSent) return;
  res.status(500).json({ error: '服务器内部错误，请稍后重试' });
});

// SPA fallback：非 API 路由返回 index.html（支持前端路由）
app.get('*', (req, res) => {
  const indexPath = resolve(__dirname, '..', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(404).send('Not Found');
});

// HTTP/HTTPS 服务句柄：统一处理启动失败和优雅退出，避免重复启动后留下假活进程。
let httpServer;
let httpsServer;
const closeServer = (server) => new Promise(resolve => {
  if (!server?.listening) return resolve();
  server.close(() => resolve());
});

const recoverEcommerceStartup = createEcommerceStartupRecovery({
  orchestrator,
  maxAttempts: 3,
  retryDelayMs: 250,
  maxFollowUpScans: 40,
  followUpDelayMs: 30_000,
  // 启动恢复的有限次跟进结束后，继续周期接管租约过期仍卡在
  // queued/analyzing/generating 的任务，防止用户停止轮询后任务永久卡住。
  sweepIntervalMs: Number(process.env.ECOMMERCE_RECOVERY_SWEEP_MS) || 120_000,
  onAttemptError(error, attempt) {
    console.error(`[ecommerce] 启动恢复扫描失败 (${attempt}/3):`, error.message);
  },
});
const startupRecoveryResults = await recoverEcommerceStartup();
videoGeneration.recover();
const resumed = startupRecoveryResults.filter(result => result.status === 'fulfilled').length;
const failedRecoveries = startupRecoveryResults.filter(result => result.status === 'rejected');
if (startupRecoveryResults.length) {
  console.log(`[ecommerce] 启动恢复完成: ${resumed} 个任务恢复, ${failedRecoveries.length} 个等待后续恢复`);
}
for (const result of failedRecoveries) {
  console.error('[ecommerce] 任务启动恢复暂未完成:', result.reason?.message || result.reason);
}

httpServer = app.listen(PORT, () => {
  console.log(`\n🧩 薯包AI 后端服务运行中`);
  console.log(`╔══════════════════════════════════════════════════╗`);
  console.log(`║  三 API 分工:`);
  console.log(`║  ① 💬 LLM(文本): ${LLM_BASE ? LLM_BASE + '/v1/chat/completions' : '未配置'} (${LLM_MODEL})`);
  console.log(`║     → 内容策划/文案生成/分析推理 (纯文本)`);
  console.log(`║  ② 👁️ MINI(识图): ${MINI_BASE ? MINI_BASE + '/v1/chat/completions' : '未配置'} (${MINI_MODEL})`);
  console.log(`║     → 参考图分析/VLM视觉解析/产品识别`);
  console.log(`║  ③ 🎨 IMAGE(生图): ${IMG_BASE}/v1/tasks (${IMG_MODEL}, async)`);
  console.log(`║     → 电商商品图/XHS配图/Plog图片生成`);
  console.log(`╚══════════════════════════════════════════════════╝`);
  console.log(`   HTTP: http://localhost:${PORT}`);
  process.send?.('ready');
});
httpServer.on('error', err => {
  console.error(`‼️ HTTP 服务启动失败 (${PORT}):`, err.message);
  process.exitCode = 1;
  process.exit(1);
});
httpServer.requestTimeout = 15 * 60 * 1000;
httpServer.headersTimeout = 30 * 1000;
httpServer.keepAliveTimeout = 65 * 1000;

// HTTPS 服务
const certDir = resolve(__dirname, '..', 'cert');
const certPath = join(certDir, 'cert.pem');
const keyPath = join(certDir, 'key.pem');
const directHttpsEnabled = process.env.DISABLE_DIRECT_HTTPS !== '1';
if (directHttpsEnabled && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const credentials = { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  const SSL_PORT = process.env.SSL_PORT || 3443;
  httpsServer = https.createServer(credentials, app).listen(SSL_PORT, () => {
    console.log(`   HTTPS: https://shuimg.cn:${SSL_PORT}`);
    console.log(`   → 路由器端口转发 443 → ${SSL_PORT}`);
  });
  httpsServer.on('error', err => {
    console.error(`‼️ HTTPS 服务启动失败 (${SSL_PORT}):`, err.message);
    process.exitCode = 1;
    process.exit(1);
  });
} else if (directHttpsEnabled) {
  console.log(`   证书不存在，跳过 HTTPS`);
  console.log(`   生成证书: cd cert && openssl req -x509 -nodes -days 3650 -newkey rsa:2048 -keyout key.pem -out cert.pem`);
} else {
  console.log(`   直连 HTTPS 已禁用，由反向代理终止 TLS`);
}

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] 收到 ${signal}，停止接收新请求`);
  recoverEcommerceStartup.stop();
  const configuredDrainMs = Number(process.env.SHUBAO_SHUTDOWN_DRAIN_MS);
  const drainTimeoutMs = Number.isSafeInteger(configuredDrainMs) && configuredDrainMs > 0
    ? configuredDrainMs
    : 18 * 60 * 1000;
  const force = setTimeout(() => process.exit(1), drainTimeoutMs + 30_000);
  force.unref();
  const [ecommerceIdle, imageQueueIdle] = await Promise.all([
    orchestrator.waitForIdle({ timeoutMs: drainTimeoutMs }),
    imageGenerationPool.waitForIdle({ timeoutMs: drainTimeoutMs }),
    closeServer(httpServer),
    closeServer(httpsServer),
  ]);
  if (!ecommerceIdle || !imageQueueIdle) {
    console.error('[shutdown] 后台任务未在排空期限内完成，将由持久化租约在新进程恢复');
  }
  videoUploadService.close();
  videoGeneration.close();
  clearInterval(videoReconciliationSweep);
  clearInterval(retentionSweep);
  clearTimeout(force);
  process.exit(0);
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
