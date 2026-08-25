/**
 * P2 账号体系 — GitHub OAuth App Provider
 *
 * 个人主体即可申请 OAuth App；凭据走 env：
 *   GITHUB_OAUTH_CLIENT_ID / GITHUB_OAUTH_CLIENT_SECRET / GITHUB_OAUTH_REDIRECT_URI(可选)
 * 未配置时 registry.available()=false，/api/auth/providers 不返回该按钮。
 */
import { OAuth2Provider } from './oauth2Provider.mjs';

export const GITHUB_AUTHORIZE_ENDPOINT = 'https://github.com/login/oauth/authorize';
export const GITHUB_TOKEN_ENDPOINT = 'https://github.com/login/oauth/access_token';
export const GITHUB_USER_ENDPOINT = 'https://api.github.com/user';
export const GITHUB_USER_EMAILS_ENDPOINT = 'https://api.github.com/user/emails';

export function createGithubProvider({
  clientId = process.env.GITHUB_OAUTH_CLIENT_ID || '',
  clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET || '',
  redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI || '',
  scope = 'read:user user:email',
  fetchImpl,
} = {}) {
  const provider = new OAuth2Provider({
    id: 'github',
    label: 'GitHub',
    mode: 'oauth2',
    clientId,
    clientSecret,
    scope,
    authorizeEndpoint: GITHUB_AUTHORIZE_ENDPOINT,
    tokenEndpoint: GITHUB_TOKEN_ENDPOINT,
    fetchImpl,
  });
  provider.profileEndpoint = GITHUB_USER_ENDPOINT;
  provider.emailsEndpoint = GITHUB_USER_EMAILS_ENDPOINT;
  provider.redirectUri = String(redirectUri || '');

  const parentHandleCallback = provider.handleCallback.bind(provider);
  provider.handleCallback = async ({ code } = {}, context = {}) => {
    const mergedContext = { redirectUri: context.redirectUri || provider.redirectUri };
    const token = await provider.exchangeCode(code, mergedContext);
    const rawUser = await provider.fetchJson(GITHUB_USER_ENDPOINT, token.access_token, {
      accept: 'application/vnd.github+json',
    });
    let email = rawUser.email || '';
    let emailVerified = false;
    try {
      const emails = await provider.fetchJson(GITHUB_USER_EMAILS_ENDPOINT, token.access_token, {
        accept: 'application/vnd.github+json',
      });
      const primary = Array.isArray(emails)
        ? (emails.find(item => item.primary && item.verified) || emails.find(item => item.verified))
        : null;
      if (primary?.email) {
        email = primary.email;
        emailVerified = true;
      } else if (email) {
        emailVerified = false; // 公开邮箱无法确认归属，不参与邮箱归并。
      }
    } catch {
      // scopes 缺 user:email 时静默降级：仅用公开邮箱且视为未验证。
    }
    return {
      provider: 'github',
      providerAccountId: String(rawUser.id ?? ''),
      loginHint: String(rawUser.login || ''),
      unionid: '',
      email: String(email || '').trim().toLowerCase(),
      emailVerified,
      nickname: String(rawUser.name || rawUser.login || '').trim(),
      avatarUrl: String(rawUser.avatar_url || '').trim(),
      raw: rawUser,
      tokenResponse: token,
    };
  };
  void parentHandleCallback;
  return provider;
}

export function githubEnvConfigured(env = process.env) {
  return Boolean(env.GITHUB_OAUTH_CLIENT_ID && env.GITHUB_OAUTH_CLIENT_SECRET);
}
