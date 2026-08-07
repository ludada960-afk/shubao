function readablePoints(value) {
  const points = Number(value);
  return Number.isFinite(points) ? points : 0;
}

export function accountEntitlementDisplay({
  logged = false,
  ecPoints = 0,
  unlimited = false,
  refreshStatus = 'ready',
} = {}) {
  if (!logged) {
    return { value: '登录后查看额度', label: '账户额度', state: 'signed-out' };
  }
  if (unlimited) {
    return { value: '无限额度', label: 'AI 积分', state: 'unlimited' };
  }
  return {
    value: `${readablePoints(ecPoints)} AI 积分`,
    label: '账户额度',
    state: refreshStatus === 'refreshing' ? 'refreshing' : refreshStatus === 'error' ? 'error' : 'ready',
  };
}
