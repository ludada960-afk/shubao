/**
 * P2 账号体系 — wechat_open / wecom 占位适配器
 *
 * 只在 provider_configs 表中 enabled=1 且 config_json 里带齐 clientId/clientSecret
 * 时才对外暴露；当前无凭据 → 隐藏。真正扫码/QQ 互信流程待凭据就绪后补齐。
 */
export function createConfigGatedPlaceholder({ id, label, authorizeEndpoint = '' } = {}) {
  let readConfig = () => ({});
  const provider = {
    id: String(id),
    label: String(label),
    mode: 'config-gated',
    placeholder: true,
    bindConfigReader(fn) {
      if (typeof fn === 'function') readConfig = fn;
    },
    available() {
      const config = readConfig() || {};
      const enabled = config.enabled === true || config.enabled === 1;
      return Boolean(enabled && config.clientId && config.clientSecret);
    },
    authorizeUrl(state, { redirectUri } = {}) {
      if (!this.available() || !authorizeEndpoint) {
        throw Object.assign(new Error(`${this.id} 登录尚未开放`), { code: 'AUTH_PROVIDER_UNAVAILABLE' });
      }
      const url = new URL(authorizeEndpoint);
      url.searchParams.set('appid', readConfig()?.clientId || '');
      url.searchParams.set('redirect_uri', String(redirectUri || ''));
      url.searchParams.set('state', String(state));
      url.searchParams.set('response_type', 'code');
      return url.toString();
    },
    async handleCallback() {
      throw Object.assign(new Error(`${this.id} 回调交换尚未实现（占位适配器）`), {
        code: 'AUTH_PROVIDER_NOT_IMPLEMENTED',
      });
    },
  };
  return provider;
}

export function createWechatOpenProvider() {
  return createConfigGatedPlaceholder({
    id: 'wechat_open',
    label: '微信',
    authorizeEndpoint: 'https://open.weixin.qq.com/connect/qrconnect',
  });
}

export function createWecomProvider() {
  return createConfigGatedPlaceholder({
    id: 'wecom',
    label: '企业微信',
    authorizeEndpoint: 'https://login.work.weixin.qq.com/wwlogin/sso/login',
  });
}
