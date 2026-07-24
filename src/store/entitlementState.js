export function normalizeEntitlement(payload = {}) {
  const unlimited = Boolean(payload.unlimited);
  return {
    credits: unlimited ? null : Math.max(0, Number(payload.credits) || 0),
    unlimited,
  };
}
