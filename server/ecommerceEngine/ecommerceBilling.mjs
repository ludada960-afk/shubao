import { quoteFeature } from '../billing/catalog.mjs';

const FOUR_K_SIZES = new Set(['2880x2880', '2448x3264', '3264x2448', '2160x3840']);

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

export function ecommerceFeatureForItem(item) {
  return quoteFeature(
    FOUR_K_SIZES.has(cleanString(item?.generationSize)) ? 'ec_image_4k' : 'ec_image_2k',
    1,
  );
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
          qualityConfidence: quality?.confidence || '',
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
