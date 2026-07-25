import { randomUUID } from 'node:crypto';

const CONTENT_CURRENCY = 'content_sets';
const FAILURE_REASON = 'generation_failed';
const MAX_GENERATION_ID_LENGTH = 128;
const SAFE_GENERATION_ID_RE = /^[a-z0-9][a-z0-9_-]*$/i;
const STABLE_ASSET_URL_RE = /^\/api\/generated-assets\/[a-f0-9]{64}\.(?:jpg|png|webp)$/;

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeOwnerEmail(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw codedError('CONTENT_OWNER_INVALID', 'Content generation owner is required');
  }
  return value.trim().toLowerCase();
}

function normalizeMode(value) {
  const mode = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!['xhs', 'plog'].includes(mode)) {
    throw codedError('CONTENT_MODE_INVALID', "Content generation mode must be 'xhs' or 'plog'");
  }
  return mode;
}

function normalizeGenerationId(value, { allowGenerated = false } = {}) {
  if (value === undefined && allowGenerated) return randomUUID();
  const generationId = typeof value === 'string' ? value.trim() : '';
  if (!generationId
    || generationId.length > MAX_GENERATION_ID_LENGTH
    || !SAFE_GENERATION_ID_RE.test(generationId)) {
    throw codedError(
      'CONTENT_GENERATION_ID_INVALID',
      'generationId must use 1-128 safe letters, numbers, underscores, or hyphens',
    );
  }
  return generationId;
}

function workIdFor(generationId) {
  return `content-${generationId}`;
}

function hasCopy(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return false;
  for (const key of ['title', 'caption', 'body_text']) {
    if (typeof result[key] === 'string' && result[key].trim() !== '') return true;
  }
  return Array.isArray(result.copyLines)
    && result.copyLines.some(line => typeof line === 'string' && line.trim() !== '');
}

function stableAssetCount(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return 0;
  const urls = [];
  if (typeof result.cover_url === 'string') urls.push(result.cover_url);
  if (Array.isArray(result.image_urls)) urls.push(...result.image_urls);
  return new Set(urls.filter(url => STABLE_ASSET_URL_RE.test(url))).size;
}

export function describeContentGenerationFailure(error, billing = null) {
  const released = billing?.status === 'released';
  const billingMessage = released
    ? '创作额度已退回'
    : '创作额度释放状态待确认，请稍后查看余额';
  if (error?.code === 'CONTENT_DELIVERY_EMPTY') {
    return `未生成可交付内容，${billingMessage}`;
  }
  if (/Image API|图片|生成/i.test(error?.message || '')) {
    return `图片生成暂时失败，${billingMessage}`;
  }
  return error?.message || '生成失败，请稍后重试';
}

function billingSnapshot({
  status,
  generationId,
  workId,
  holdId = null,
  entitlement = null,
  balance,
}) {
  const unlimited = balance?.unlimited === true;
  return {
    currency: CONTENT_CURRENCY,
    status,
    settledUnits: status === 'settled' ? 1 : 0,
    balance: balance === null || unlimited ? null : (balance?.availableUnits ?? 0),
    heldUnits: balance?.heldUnits ?? 0,
    unlimited,
    generationId,
    holdId,
    workId,
    entitlement: entitlement ?? null,
  };
}

export function createContentBilling({ contentEntitlements, walletService } = {}) {
  if (!contentEntitlements
    || typeof contentEntitlements.holdSet !== 'function'
    || typeof contentEntitlements.completeSet !== 'function'
    || typeof contentEntitlements.failSet !== 'function') {
    throw new TypeError('contentEntitlements holdSet, completeSet, and failSet are required');
  }
  if (!walletService || typeof walletService.getBalance !== 'function') {
    throw new TypeError('walletService.getBalance is required');
  }

  function currentBalance(ownerEmail) {
    return walletService.getBalance(ownerEmail, CONTENT_CURRENCY);
  }

  function mutationBalance(ownerEmail, ...candidates) {
    return candidates.find(candidate => (
      candidate
      && typeof candidate === 'object'
      && typeof candidate.unlimited === 'boolean'
    )) ?? currentBalance(ownerEmail);
  }

  function beginContentGeneration(input = {}) {
    const ownerEmail = normalizeOwnerEmail(input.ownerEmail);
    const generationId = normalizeGenerationId(input.generationId, { allowGenerated: true });
    const workId = workIdFor(generationId);
    const mode = normalizeMode(input.mode);
    let hold;
    try {
      hold = contentEntitlements.holdSet({ ownerEmail, generationId, workId, mode });
    } catch (error) {
      if (error?.code === 'BILLING_INSUFFICIENT_CREDITS') {
        const balance = currentBalance(ownerEmail);
        error.currency = CONTENT_CURRENCY;
        error.required = 1;
        error.available = balance.unlimited ? null : balance.availableUnits;
        error.resumeable = true;
      }
      throw error;
    }
    return billingSnapshot({
      status: 'held',
      generationId,
      workId,
      holdId: hold.id,
      balance: mutationBalance(ownerEmail, hold.balance),
    });
  }

  function failContentGeneration(input = {}) {
    const ownerEmail = normalizeOwnerEmail(input.ownerEmail);
    const generationId = normalizeGenerationId(input.generationId);
    const workId = workIdFor(generationId);
    const failed = contentEntitlements.failSet({
      ownerEmail,
      generationId,
      workId,
      reason: FAILURE_REASON,
    });
    return billingSnapshot({
      status: failed.status,
      generationId,
      workId,
      holdId: failed.holdId,
      balance: mutationBalance(ownerEmail, failed.release?.balance, failed.balance),
    });
  }

  function completeContentGeneration(input = {}) {
    const ownerEmail = normalizeOwnerEmail(input.ownerEmail);
    const generationId = normalizeGenerationId(input.generationId);
    const workId = workIdFor(generationId);
    if (!hasCopy(input.result) || stableAssetCount(input.result) === 0) {
      return failContentGeneration({ ownerEmail, generationId });
    }
    const completed = contentEntitlements.completeSet({
      ownerEmail,
      generationId,
      workId,
      result: input.result,
    });
    return billingSnapshot({
      status: completed.status,
      generationId,
      workId,
      holdId: completed.holdId,
      entitlement: completed.entitlement,
      balance: mutationBalance(
        ownerEmail,
        completed.settlement?.balance,
        completed.balance,
      ),
    });
  }

  function previewContentGeneration(input = {}) {
    const generationId = normalizeGenerationId(input.generationId, { allowGenerated: true });
    normalizeMode(input.mode);
    return billingSnapshot({
      status: 'preview',
      generationId,
      workId: workIdFor(generationId),
      balance: null,
    });
  }

  return {
    beginContentGeneration,
    completeContentGeneration,
    failContentGeneration,
    previewContentGeneration,
  };
}
