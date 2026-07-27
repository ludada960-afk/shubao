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

function inProgressError(claim) {
  return billingError('该操作仍在处理中，请稍后重试', {
    status: 409,
    code: 'CANVAS_BILLING_ACTION_IN_PROGRESS',
    retryable: true,
    resumeable: true,
    leaseExpiresAt: claim?.leaseExpiresAt,
  });
}

function recoveryRequiredError(claim) {
  return billingError('该操作的上游结果仍在确认中，为避免重复扣费，请稍后查看结果', {
    status: 409,
    code: 'CANVAS_BILLING_ACTION_RECOVERY_REQUIRED',
    retryable: true,
    resumeable: true,
    leaseExpiresAt: claim?.leaseExpiresAt,
  });
}

/** A server-authoritative, leased transaction for one successful billed action. */
export function createOneShotBilling({
  walletService,
  quoteService,
  actionStore,
  leaseMs = 120_000,
  heartbeatMs = Math.max(1_000, Math.floor(leaseMs / 3)),
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  if (!walletService || typeof walletService.createHold !== 'function'
    || typeof walletService.settleItem !== 'function'
    || typeof walletService.releaseItem !== 'function'
    || typeof walletService.getBalance !== 'function') {
    throw new TypeError('wallet service hold, settle, release, and balance methods are required');
  }
  if (!quoteService || typeof quoteService.verify !== 'function') {
    throw new TypeError('quote service verify is required');
  }
  if (!actionStore || typeof actionStore.get !== 'function'
    || typeof actionStore.claim !== 'function'
    || typeof actionStore.renew !== 'function'
    || typeof actionStore.save !== 'function'
    || typeof actionStore.release !== 'function') {
    throw new TypeError('leased canvas billed action store is required');
  }
  if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0
    || !Number.isSafeInteger(heartbeatMs) || heartbeatMs <= 0 || heartbeatMs >= leaseMs) {
    throw new TypeError('billing action lease and heartbeat must be positive and ordered');
  }

  const inFlight = new Map();

  async function executeOnce({ ownerEmail, quoteId, actionId, sku, referenceType, providerCostCny = 0, metadata = {}, resumableWork = false, work } = {}) {
    const owner = clean(ownerEmail).toLowerCase();
    const safeActionId = clean(actionId);
    const safeSku = clean(sku);
    if (!owner || !safeActionId || !safeSku || typeof work !== 'function') {
      throw billingError('收费动作请求无效', { status: 400, code: 'CANVAS_BILLING_REQUEST_INVALID' });
    }
    let completed = actionStore.get(owner, safeActionId);
    if (completed?.status === 'settled' && completed?.output?.result) {
      return { ...completed.output, replay: true };
    }

    const expectedQuote = quoteFeature(safeSku, 1);
    const verified = quoteService.verify({ quoteId: clean(quoteId), ownerEmail: owner, expectedQuote });
    const claim = actionStore.claim(owner, safeActionId, { sku: safeSku, leaseMs });
    if (claim.status === 'settled' && claim.record?.output?.result) {
      return { ...claim.record.output, replay: true };
    }
    if (claim.status !== 'claimed' || !clean(claim.leaseToken)) throw inProgressError(claim);
    if (claim.reclaimed === true && !claim.record?.result && resumableWork !== true) {
      throw recoveryRequiredError(claim);
    }
    const leaseToken = clean(claim.leaseToken);
    if (claim.record) completed = claim.record;

    let leaseError = null;
    const heartbeat = setIntervalFn(() => {
      try {
        actionStore.renew(owner, safeActionId, leaseToken, { leaseMs });
      } catch (error) {
        leaseError = error instanceof Error ? error : billingError('收费动作租约已失效', {
          status: 409,
          code: 'CANVAS_BILLING_ACTION_LEASE_LOST',
          retryable: true,
        });
        clearIntervalFn(heartbeat);
      }
    }, heartbeatMs);
    heartbeat?.unref?.();

    let hold;
    let delivered = completed?.status === 'delivered' && completed?.result
      ? completed.result
      : null;
    try {
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
        if (error?.code === 'BILLING_INSUFFICIENT_CREDITS') {
          throw insufficientError(walletService, owner, expectedQuote);
        }
        throw error;
      }
      if (hold.status === 'released') {
        throw billingError('该操作已失败或取消，请重新确认费用后再试', {
          status: 409,
          code: 'CANVAS_BILLING_ACTION_RELEASED',
          reQuoteRequired: true,
        });
      }

      const result = delivered || await work();
      if (leaseError) throw leaseError;
      const referenceId = clean(result?.url || result?.result_url || result?.taskId);
      if (!referenceId) throw billingError('画布处理未交付可用结果', { status: 502, code: 'CANVAS_RESULT_INVALID' });
      if (!delivered) {
        actionStore.save(owner, safeActionId, {
          status: 'delivered',
          sku: expectedQuote.sku,
          result,
        }, { leaseToken });
        delivered = result;
      }
      const settlement = walletService.settleItem(hold.id, 'canvas_action', {
        referenceType: clean(referenceType) || 'canvas_action',
        referenceId,
        providerCostCny,
        idempotencyKey: `canvas-settle:${safeActionId}`,
        metadata: { source: 'canvas_action', actionId: safeActionId, ...metadata },
      });
      if (leaseError) throw leaseError;
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
      }, { leaseToken });
      return output;
    } catch (error) {
      const current = hold?.items?.find(item => item.key === 'canvas_action');
      const leaseLost = error?.code === 'CANVAS_BILLING_ACTION_LEASE_LOST';
      if (hold && !delivered && current?.status !== 'settled' && !leaseLost) {
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
    } finally {
      clearIntervalFn(heartbeat);
      try { actionStore.release(owner, safeActionId, leaseToken); } catch {}
    }
  }

  return {
    async execute(input = {}) {
      const owner = clean(input.ownerEmail).toLowerCase();
      const actionId = clean(input.actionId);
      const sku = clean(input.sku);
      if (!owner || !actionId || !sku || typeof input.work !== 'function') return executeOnce(input);
      const key = `${owner}\u0000${actionId}`;
      const active = inFlight.get(key);
      if (active) {
        if (active.sku !== sku) {
          throw billingError('同一收费动作不能更改功能类型', {
            status: 409,
            code: 'CANVAS_BILLING_ACTION_CONFLICT',
          });
        }
        return active.promise;
      }
      const promise = executeOnce(input);
      inFlight.set(key, { sku, promise });
      try {
        return await promise;
      } finally {
        if (inFlight.get(key)?.promise === promise) inFlight.delete(key);
      }
    },
  };
}
