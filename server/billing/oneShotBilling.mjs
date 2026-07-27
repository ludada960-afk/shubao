import { quoteFeature } from './catalog.mjs';

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function billingError(message, { status = 500, code, ...details } = {}) {
  return Object.assign(new Error(message), { status, code, ...details });
}

function insufficientError(walletService, ownerEmail, quote) {
  const balance = walletService.getBalance(ownerEmail, quote.currency);
  return billingError('AI 积分不足，请购买套餐后继续', {
    status: 402,
    code: 'BILLING_INSUFFICIENT_CREDITS',
    resumeable: true,
    required: quote.totalUnits,
    available: balance.unlimited ? quote.totalUnits : balance.availableUnits,
    billing: { currency: quote.currency, status: 'insufficient' },
  });
}

/** A small, server-authoritative transaction for one successful canvas action. */
export function createOneShotBilling({ walletService, quoteService, actionStore } = {}) {
  if (!walletService || typeof walletService.createHold !== 'function'
    || typeof walletService.settleItem !== 'function'
    || typeof walletService.releaseItem !== 'function'
    || typeof walletService.getBalance !== 'function') {
    throw new TypeError('wallet service hold, settle, release, and balance methods are required');
  }
  if (!quoteService || typeof quoteService.verify !== 'function') {
    throw new TypeError('quote service verify is required');
  }
  if (!actionStore || typeof actionStore.get !== 'function' || typeof actionStore.save !== 'function') {
    throw new TypeError('canvas billed action store get and save are required');
  }

  return {
    async execute({ ownerEmail, quoteId, actionId, sku, referenceType, providerCostCny = 0, metadata = {}, work } = {}) {
      const owner = clean(ownerEmail).toLowerCase();
      const safeActionId = clean(actionId);
      const safeSku = clean(sku);
      if (!owner || !safeActionId || !safeSku || typeof work !== 'function') {
        throw billingError('收费动作请求无效', { status: 400, code: 'CANVAS_BILLING_REQUEST_INVALID' });
      }
      const completed = actionStore.get(owner, safeActionId);
      if (completed?.status === 'settled' && completed?.output?.result) {
        return { ...completed.output, replay: true };
      }
      const expectedQuote = quoteFeature(safeSku, 1);
      const verified = quoteService.verify({ quoteId: clean(quoteId), ownerEmail: owner, expectedQuote });
      let hold;
      try {
        hold = walletService.createHold({
          ownerEmail: owner,
          currency: verified.currency,
          quoteId: verified.quoteId,
          idempotencyKey: `canvas-hold:${safeActionId}`,
          expiresAt: verified.expiresAt,
          items: [{ key: 'canvas_action', sku: expectedQuote.sku, units: expectedQuote.units }],
          metadata: { source: 'canvas_action', actionId: safeActionId, ...metadata },
        });
      } catch (error) {
        if (error?.code === 'BILLING_INSUFFICIENT_CREDITS') throw insufficientError(walletService, owner, expectedQuote);
        throw error;
      }
      if (hold.status === 'released') {
        throw billingError('该操作已失败或取消，请重新确认费用后再试', {
          status: 409, code: 'CANVAS_BILLING_ACTION_RELEASED', reQuoteRequired: true,
        });
      }

      let delivered = completed?.status === 'delivered' && completed?.result
        ? completed.result
        : null;
      try {
        const result = delivered || await work();
        const referenceId = clean(result?.url || result?.result_url || result?.taskId);
        if (!referenceId) throw billingError('画布处理未交付可用结果', { status: 502, code: 'CANVAS_RESULT_INVALID' });
        if (!delivered) {
          actionStore.save(owner, safeActionId, {
            status: 'delivered',
            sku: expectedQuote.sku,
            result,
          });
          delivered = result;
        }
        const settlement = walletService.settleItem(hold.id, 'canvas_action', {
          referenceType: clean(referenceType) || 'canvas_action',
          referenceId,
          providerCostCny,
          idempotencyKey: `canvas-settle:${safeActionId}`,
          metadata: { source: 'canvas_action', actionId: safeActionId, ...metadata },
        });
        const output = {
          result,
          billing: {
            currency: expectedQuote.currency,
            status: settlement.status,
            balance: settlement.balance?.unlimited ? null : settlement.balance?.availableUnits,
            unlimited: settlement.balance?.unlimited === true,
          },
        };
        actionStore.save(owner, safeActionId, {
          status: 'settled',
          sku: expectedQuote.sku,
          result,
          output,
        });
        return output;
      } catch (error) {
        const current = hold.items?.find(item => item.key === 'canvas_action');
        if (!delivered && current?.status !== 'settled') {
          try {
            walletService.releaseItem(hold.id, 'canvas_action', {
              reason: `canvas_action_failed:${clean(error?.code || error?.message).slice(0, 120) || 'unknown'}`,
              idempotencyKey: `canvas-release:${safeActionId}`,
              metadata: { source: 'canvas_action', actionId: safeActionId, ...metadata },
            });
          } catch (releaseError) {
            if (!error?.status) throw releaseError;
          }
        }
        throw error;
      }
    },
  };
}
