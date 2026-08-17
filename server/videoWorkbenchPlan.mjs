import {
  VIDEO_CATALOG_VERSION,
  DEFAULT_VIDEO_PRODUCT_ID,
  getVideoProduct,
  validateVideoProductInput,
  videoFeatureSku,
} from './videoCatalog.mjs';
import { quoteFeature } from './billing/catalog.mjs';

const MAX_SHOTS = 30;
const MAX_TOTAL_DURATION_MS = 30 * 60 * 1000;

function text(value, max = 400) {
  return String(value ?? '').trim().slice(0, max);
}

function blocker(code, detail, shotId = '') {
  return { code, detail, ...(shotId ? { shotId } : {}) };
}

function approvedAssetMap(workbench) {
  return new Map((Array.isArray(workbench?.assets) ? workbench.assets : []).map(asset => [asset.id, asset]));
}

function normalizeOptions(options = {}) {
  const productId = text(options.productId, 80) || DEFAULT_VIDEO_PRODUCT_ID;
  const mode = text(options.mode, 40).toLowerCase() || 'smart';
  const resolution = text(options.resolution, 20).toLowerCase() || '720p';
  const generateAudio = options.generateAudio !== false;
  return { productId, mode, resolution, generateAudio };
}

function quoteForShot(productId, durationMs) {
  const duration = Math.max(4, Math.min(15, Math.ceil(Number(durationMs || 0) / 1000)));
  const sku = videoFeatureSku({ productId, duration });
  const quote = quoteFeature(sku, 1);
  return {
    duration,
    sku,
    productId,
    units: quote.totalUnits,
    points: Math.ceil(quote.totalUnits / 1000),
  };
}

export function buildVideoWorkbenchPlan(workbench = {}, options = {}) {
  const normalized = normalizeOptions(options);
  const product = getVideoProduct(normalized.productId);
  const shots = Array.isArray(workbench.shots) ? workbench.shots.slice(0, MAX_SHOTS) : [];
  const assets = approvedAssetMap(workbench);
  const blockers = [];
  const warnings = [];
  const totalDurationMs = shots.reduce((sum, shot) => sum + Math.max(0, Number(shot?.durationMs) || 0), 0);

  try {
    if (product.public === false) throw new Error(`${product.label} 暂不向普通账号开放`);
    validateVideoProductInput({
      productId: normalized.productId,
      duration: Math.max(product.durations.min, Math.min(product.durations.max, 8)),
      mode: normalized.mode === 'smart' ? 'script' : normalized.mode,
      resolution: normalized.resolution,
      generateAudio: normalized.generateAudio,
    });
  } catch (error) {
    blockers.push(blocker('PRODUCT_OPTIONS_INVALID', error.message));
  }
  if (!shots.length) blockers.push(blocker('NO_SHOTS', '先添加至少一个分镜，再生成视频。'));
  if (shots.length >= MAX_SHOTS) warnings.push(`当前计划已达到 ${MAX_SHOTS} 个分镜的预检上限。`);
  if (totalDurationMs > MAX_TOTAL_DURATION_MS) blockers.push(blocker('PLAN_TOO_LONG', '单个项目的预检总时长不能超过 30 分钟。'));

  const lineItems = [];
  const normalizedShots = shots.map((shot, index) => {
    const shotId = text(shot?.id, 200) || `shot-${index + 1}`;
    const durationMs = Number(shot?.durationMs) || 0;
    const bindings = Array.isArray(shot?.bindings) ? shot.bindings : [];
    if (shot?.status === 'stale') blockers.push(blocker('SHOT_STALE', '该分镜引用的素材版本已变化，请重新确认。', shotId));
    if (!text(shot?.purpose, 500)) blockers.push(blocker('SHOT_PURPOSE_MISSING', '请补充分镜目的。', shotId));
    if (!text(shot?.prompt, 8000)) blockers.push(blocker('SHOT_PROMPT_MISSING', '请补充分镜提示词。', shotId));
    if (!Number.isSafeInteger(durationMs) || durationMs < 500 || durationMs > 120_000) {
      blockers.push(blocker('SHOT_DURATION_INVALID', '分镜时长必须在 0.5 到 120 秒之间。', shotId));
    }
    if (!bindings.length) blockers.push(blocker('SHOT_BINDING_MISSING', '至少绑定一个已确认素材版本。', shotId));
    bindings.forEach(binding => {
      const asset = assets.get(binding.assetId);
      if (!asset || asset.status !== 'approved' || asset.approvedVersionId !== binding.assetVersionId) {
        blockers.push(blocker('ASSET_NOT_APPROVED', '分镜引用的素材版本不是当前已确认版本。', shotId));
      }
    });
    const quote = quoteForShot(normalized.productId, durationMs);
    lineItems.push({ shotId, ...quote });
    return {
      id: shotId,
      position: Number.isSafeInteger(shot?.position) ? shot.position : index,
      purpose: text(shot?.purpose, 500),
      durationMs,
      prompt: text(shot?.prompt, 8000),
      bindingCount: bindings.length,
      status: shot?.status || 'draft',
    };
  });

  if (normalized.generateAudio && !Array.isArray(workbench.audioTracks)) {
    warnings.push('当前项目没有音轨记录，将按视频产品默认声音设置报价。');
  }
  const units = blockers.length ? 0 : lineItems.reduce((sum, item) => sum + item.units, 0);
  const points = blockers.length ? 0 : lineItems.reduce((sum, item) => sum + item.points, 0);
  return {
    status: blockers.length ? 'blocked' : 'ready',
    catalogVersion: VIDEO_CATALOG_VERSION,
    product: { id: product.id, label: product.label, tierLabel: product.tierLabel },
    options: normalized,
    shots: normalizedShots,
    totalDurationMs,
    blockers,
    warnings,
    quote: {
      catalogVersion: VIDEO_CATALOG_VERSION,
      units,
      points,
      maximumUnits: units,
      maximumPoints: points,
      lineItems: blockers.length ? [] : lineItems,
    },
    generatedAt: new Date().toISOString(),
  };
}
