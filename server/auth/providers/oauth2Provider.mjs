/**
 * P2 账号体系 — OAuth2 通用 Provider 基类
 *
 * 统一接口约定（registry 与 authRoutes 只依赖该形状）：
 *   id: string                    注册标识（URL 段，如 github）
 *   label: string                 展示名
 *   mode: 'oauth2' | 'config-gated'
 *   available(): boolean          凭据/配置是否齐备（不齐备则 /api/auth/providers 不返回）
 *   authorizeUrl(state, {redirectUri}): string
 *   handleCallback({code, state}, {redirectUri}) -> Promise<profile>
 *     profile = { provider, providerAccountId, unionid, email, emailVerified, nickname, avatarUrl, raw }
 *
 * 网络全部走注入的 fetchImpl（默认 globalThis.fetch），便于 mock 单测。
 */
export class OAuth2Provider {
  constructor({
    id,
    label,
    mode = 'oauth2',
    clientId = '',
    clientSecret = '',
    scope = '',
    authorizeEndpoint,
    tokenEndpoint,
    fetchImpl = (...args) => globalThis.fetch(...args),
    extraAuthorizeParams = {},
  } = {}) {
    if (!id) throw new TypeError('provider id is required');
    this.id = String(id);
    this.label = String(label || id);
    this.mode = mode;
    this.clientId = String(clientId || '');
    this.clientSecret = String(clientSecret || '');
    this.scope = String(scope || '');
    this.authorizeEndpoint = authorizeEndpoint ? String(authorizeEndpoint) : '';
    this.tokenEndpoint = tokenEndpoint ? String(tokenEndpoint) : '';
    this.extraAuthorizeParams = { ...extraAuthorizeParams };
    this._fetch = typeof fetchImpl === 'function' ? fetchImpl : (...a) => globalThis.fetch(...a);
  }

  get configured() {
    return Boolean(this.clientId && this.clientSecret && this.authorizeEndpoint && this.tokenEndpoint);
  }

  available() {
    return this.configured;
  }

  authorizeUrl(state, { redirectUri } = {}) {
    if (!this.available()) {
      throw Object.assign(new Error(`provider ${this.id} 尚未配置`), { code: 'AUTH_PROVIDER_UNAVAILABLE' });
    }
    const url = new URL(this.authorizeEndpoint);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', String(redirectUri || ''));
    url.searchParams.set('state', String(state));
    url.searchParams.set('response_type', 'code');
    if (this.scope) url.searchParams.set('scope', this.scope);
    for (const [key, value] of Object.entries(this.extraAuthorizeParams)) {
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  async exchangeCode(code, { redirectUri } = {}) {
    const response = await this._fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: String(code || ''),
        ...(redirectUri ? { redirect_uri: String(redirectUri) } : {}),
        grant_type: 'authorization_code',
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.access_token) {
      throw Object.assign(
        new Error(`OAuth token 兑换失败（${this.id}）`),
        { code: 'AUTH_OAUTH_UPSTREAM_FAILED', upstreamStatus: response.status },
      );
    }
    return payload;
  }

  async fetchJson(url, accessToken, { accept = 'application/json' } = {}) {
    const response = await this._fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: accept },
    });
    if (!response.ok) {
      throw Object.assign(new Error(`OAuth profile 拉取失败（${this.id}）`), {
        code: 'AUTH_OAUTH_UPSTREAM_FAILED',
        upstreamStatus: response.status,
      });
    }
    return response.json();
  }

  // 子类覆写：把上游原始数据归一化为标准 profile。
  normalizeProfile(/* rawUser, context */) {
    throw new Error('normalizeProfile must be implemented');
  }

  async handleCallback({ code } = {}, context = {}) {
    const token = await this.exchangeCode(code, context);
    const rawUser = await this.fetchJson(this.profileEndpoint || this.tokenEndpoint, token.access_token);
    return this.normalizeProfile(rawUser, { tokenResponse: token });
  }
}
