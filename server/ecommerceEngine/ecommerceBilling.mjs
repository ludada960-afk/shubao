import { quoteFeature } from '../billing/catalog.mjs';
import { IMAGE_MODEL_IDS, LEGAL_IMAGE_SIZES, buildModelRoute, normalizeImageModel } from './modelCatalog.mjs';

/* 9-13 修计费口径：原来用「手写白名单」判断 1K/4K，漏了 16:9 与 21:9 的尺寸
   （4K 的 3840x2160 / 3584x1536 被当成 2K 少收费，1K 的 1024x576 / 1008x432 被当成 2K 多收费）。
   现在直接以 LEGAL_IMAGE_SIZES（生成尺寸的唯一真源）反查分辨率档位，不再维护第二份清单。 */
const SIZE_TO_RESOLUTION = new Map();
for (const [resolution, ratios] of Object.entries(LEGAL_IMAGE_SIZES)) {
  for (const size of Object.values(ratios)) SIZE_TO_RESOLUTION.set(size, resolution.toLowerCase());
}

function resolutionForSize(size) {
  return SIZE_TO_RESOLUTION.get(cleanString(size)) || '2k';
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function reQuoteError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.status = 409;
  error.reQuoteRequired = true;
  error.retryable = false;
  return error;
}

// usage_events 的 feature/provider/model 遥测：结算时随 metadata 写入，
// 否则 walletService 落库为空串，成本与失败无法按供应商归因（2026-08-26 演练发现）。
function usageTelemetryForItem(item) {
  try {
    const route = buildModelRoute({
      imageModel: item?.imageModel,
      ratio: item?.ratio,
      size: item?.generationSize,
    });
    return { feature: 'ecommerce_image', provider: route.provider, model: route.model };
  } catch {
    return { feature: 'ecommerce_image', provider: '', model: normalizeImageModel(item?.imageModel) };
  }
}

export function ecommerceFeatureForItem(item) {
  const imageModel = normalizeImageModel(item?.imageModel);
  const resolution = resolutionForSize(item?.generationSize);
  if (imageModel === 'nano-banana-2') return quoteFeature(`ec_nano_flash_${resolution}`, 1);
  if (imageModel === 'nano-banana-pro') return quoteFeature(`ec_nano_pro_${resolution}`, 1);
  /* 9-13 新增四族五档：与前端 src/services/imageModelCatalog.js 的 generationBillingSku 一一对应
     （单位数、成本见 server/billing/catalog.mjs）。Midjourney 上游只有 1K/2K，4K 归到 2K 档，
     避免「收了 4K 的钱、给了 2K 的图」。 */
  const advancedSku = {
    'image2-5-sunburst': 'ec_image25_sunburst',
    'image2-5-flare': 'ec_image25_flare',
    'mdkj-super': 'ec_mdkj',
    'gemini-3-image': 'ec_gemini3',
    'midjourney': 'ec_mj',
  }[imageModel];
  if (advancedSku) return quoteFeature(`${advancedSku}_${imageModel === 'midjourney' && resolution === '4k' ? '2k' : resolution}`, 1);
  return quoteFeature(resolution === '4k' ? 'ec_image_4k' : 'ec_image_2k', 1);
}

export function createEcommerceBilling({ walletService, quoteService } = {}) {
  if (!walletService || typeof walletService.createHold !== 'function'
    || typeof walletService.getBalance !== 'function'
    || typeof walletService.settleItem !== 'function'
    || typeof walletService.releaseItem !== 'function'
    || typeof walletService.releaseRemainder !== 'function') {
    throw new TypeError('walletService billing methods are required');
  }
  if (!quoteService || typeof quoteService.verify !== 'function') {
    throw new TypeError('quoteService.verify is required');
  }

  return {
    preflight({ ownerEmail, payload } = {}) {
      if (typeof quoteService.verifyFresh !== 'function') return null;
      return quoteService.verifyFresh({
        quoteId: cleanString(payload?.billing_quote_id),
        ownerEmail,
      });
    },

    async hold({ job, assetPlan }) {
      if (!Array.isArray(assetPlan) || assetPlan.length === 0) {
        throw reQuoteError('BILLING_QUOTE_PLAN_EMPTY', '生成方案为空，请重新确认套图方案');
      }
      const itemQuotes = assetPlan.map(ecommerceFeatureForItem);
      const skus = new Set(itemQuotes.map(quote => quote.sku));
      if (skus.size !== 1) {
        throw reQuoteError('BILLING_QUOTE_PLAN_MIXED', '当前生成方案包含不同清晰度，请统一后重新获取费用');
      }
      const sku = itemQuotes[0].sku;
      const acceptedQuote = quoteFeature(sku, assetPlan.length);
      const verifiedQuote = quoteService.verify({
        quoteId: cleanString(job?.payload?.billing_quote_id),
        ownerEmail: job?.ownerEmail,
        expectedQuote: acceptedQuote,
      });
      const items = assetPlan.map((item, index) => ({
        key: item.id,
        sku: itemQuotes[index].sku,
        units: itemQuotes[index].units,
      }));

      try {
        return walletService.createHold({
          ownerEmail: job.ownerEmail,
          currency: verifiedQuote.currency,
          quoteId: verifiedQuote.quoteId,
          idempotencyKey: `ec-hold:${job.id}`,
          expiresAt: verifiedQuote.expiresAt,
          items,
          metadata: {
            taskId: job.id,
            source: 'ecommerce_generate',
            quoteExpiresAt: verifiedQuote.expiresAt,
          },
        });
      } catch (error) {
        if (error?.code === 'BILLING_INSUFFICIENT_CREDITS') {
          const balance = walletService.getBalance(job.ownerEmail, verifiedQuote.currency);
          const billingError = new Error('AI 积分不足，请购买套餐后继续');
          billingError.status = 402;
          billingError.code = error.code;
          billingError.resumeable = true;
          billingError.required = acceptedQuote.totalUnits;
          billingError.available = balance.unlimited ? billingError.required : balance.availableUnits;
          throw billingError;
        }
        throw error;
      }
    },

    async settle({ holdId, job, item, stableAsset, quality }) {
      const quote = ecommerceFeatureForItem(item);
      return walletService.settleItem(holdId, item.id, {
        referenceType: 'ecommerce_asset',
        referenceId: stableAsset.id,
        providerCostCny: quote.providerCostCny,
        idempotencyKey: `ec-settle:${job.id}:${item.id}`,
        metadata: {
          taskId: job.id,
          role: item.role,
          generationSize: item.generationSize,
          imageModel: normalizeImageModel(item.imageModel),
          qualityConfidence: quality?.confidence || '',
          ...usageTelemetryForItem(item),
        },
      });
    },

    async release({ holdId, job, item, reason, quality }) {
      return walletService.releaseItem(holdId, item.id, {
        reason,
        idempotencyKey: `ec-release:${job.id}:${item.id}`,
        metadata: {
          taskId: job.id,
          role: item.role,
          qualityConfidence: quality?.confidence || '',
        },
      });
    },

    async releaseRemainder({ holdId, job, reason }) {
      return walletService.releaseRemainder(holdId, {
        reason,
        idempotencyKey: `ec-release-remainder:${job.id}:setup`,
        metadata: {
          taskId: job.id,
          source: 'ecommerce_parent_setup',
        },
      });
    },
  };
}
