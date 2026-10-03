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
    /* 2026-10-03 用户批注（画布 + 首页截图）：
       「206.4 上面不是有个 AI 积分吗，这个保留，然后 206.4 右边的 AI 积分几个字去掉，
         避免重复…高度还是要跟原来这样一样，但是宽度肯定就要适配紧一点了。」

       真因就在这一行：`value` 原来是 **"206.4 AI 积分" 整串**，
       而按钮上本来就有一行小字「AI 积分」⇒ 单位出现两次。
       ⇒ `value` 只给**数字**；单位由那行小字承担。
          高度不变（靠 CSS 的 min-height），宽度自然收紧。 */
    value: String(readablePoints(ecPoints)),
    label: '账户额度',
    state: refreshStatus === 'refreshing' ? 'refreshing' : refreshStatus === 'error' ? 'error' : 'ready',
  };
}
