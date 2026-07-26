export function normalizeEntitlement(payload = {}) {
  const balances = payload.balances || {};
  const ecommerce = balances.ec_points;
  const content = balances.content_sets;
  const unlimited = Boolean(payload.unlimited)
    || Boolean(ecommerce?.unlimited)
    || Boolean(content?.unlimited);
  if (unlimited) {
    return { ecPoints: null, contentSets: null, unlimited: true };
  }

  const availableUnits = (balance) => {
    const value = typeof balance === 'object' && balance !== null
      ? balance.availableUnits
      : balance;
    return Math.max(0, Number(value) || 0);
  };
  return {
    ecPoints: availableUnits(ecommerce) / 1000,
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
