export function normalizeEntitlement(payload = {}) {
  const balances = payload.balances || {};
  const ecommerce = balances.ec_points;
  const content = balances.content_sets;
  const unlimited = Boolean(payload.unlimited)
    || Boolean(ecommerce?.unlimited)
    || Boolean(content?.unlimited);
  if (unlimited) {
    return { ecPoints: null, ecPointsExpiring: null, ecPointsExpiresAt: null, contentSets: null, unlimited: true };
  }

  const availableUnits = (balance) => {
    const value = typeof balance === 'object' && balance !== null
      ? balance.availableUnits
      : balance;
    return Math.max(0, Number(value) || 0);
  };
  // 月卡礼包积分带 expires_at：拆出「会过期部分（积分）」+「最早到期时间（ISO）」，前端据此做倒计时。
  const ecBalanceObject = typeof ecommerce === 'object' && ecommerce !== null;
  const expiringUnits = ecBalanceObject ? (Number(ecommerce.expiringUnits) || 0) : 0;
  const expiringAt = ecBalanceObject ? (ecommerce.expiringAt || null) : null;
  return {
    ecPoints: availableUnits(ecommerce) / 1000,
    ecPointsExpiring: Math.max(0, expiringUnits) / 1000,
    ecPointsExpiresAt: expiringAt,
    contentSets: availableUnits(content),
    unlimited: false,
  };
}

export function createSessionRequestGate() {
  let epoch = 0;
  return {
    capture() {
      return epoch;
    },
    invalidate() {
      epoch += 1;
    },
    isCurrent(requestEpoch) {
      return requestEpoch === epoch;
    },
  };
}

export function withCreditsCompatibility(entitlement) {
  return {
    ...entitlement,
    credits: entitlement?.contentSets ?? null,
  };
}
