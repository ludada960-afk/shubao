/**
 * P2 账号体系 — Provider Registry
 *
 * - provider_configs 表：DB 侧开关与配置（enabled / config_json），管理后台后续可直接改行。
 * - GitHub：env 凭据齐备即可用；provider_configs 显式 enabled=0 可强制下线。
 * - wechat_open / wecom：占位适配器，读表 enabled 才暴露，当前无凭据 = 隐藏。
 */
import { createGithubProvider, githubEnvConfigured } from './providers/githubProvider.mjs';
import { createWechatOpenProvider, createWecomProvider } from './providers/placeholderProviders.mjs';
import { ensureOAuthSchema } from './oauthStore.mjs';

export function ensureProviderConfigSchema(db) {
  ensureOAuthSchema(db); // provider_configs 与 identities/states 同批建表
}

export function readProviderConfig(db, providerId) {
  const row = db.prepare('SELECT provider, enabled, config_json FROM provider_configs WHERE provider = ?')
    .get(String(providerId));
  if (!row) return null;
  let config = {};
  try { config = JSON.parse(row.config_json || '{}') || {}; } catch { config = {}; }
  return { provider: row.provider, enabled: Number(row.enabled) === 1, config };
}

export function createProviderRegistry({ db, providers = null, env = process.env } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('db must be a better-sqlite3 database');
  }
  ensureProviderConfigSchema(db);
  const list = Array.isArray(providers) && providers.length
    ? providers
    : [
      createGithubProvider({
        clientId: env.GITHUB_OAUTH_CLIENT_ID || '',
        clientSecret: env.GITHUB_OAUTH_CLIENT_SECRET || '',
      }),
      createWechatOpenProvider(),
      createWecomProvider(),
    ];
  const byId = new Map(list.map(provider => [String(provider.id), provider]));

  // 占位适配器读取扁平形状：{ enabled, clientId, clientSecret }
  for (const provider of list) {
    if (typeof provider.bindConfigReader === 'function') {
      provider.bindConfigReader(() => {
        const entry = readProviderConfig(db, provider.id);
        if (!entry) return null;
        return { ...(entry.config || {}), enabled: entry.enabled };
      });
    }
  }

  function isEnabledInDb(providerId) {
    const row = readProviderConfig(db, providerId);
    return row ? row.enabled : true; // 无行 = 默认遵循代码侧判定
  }

  function getAvailable(providerId) {
    const provider = byId.get(String(providerId));
    if (!provider) return null;
    if (!isEnabledInDb(providerId)) return null;
    if (typeof provider.available === 'function' && !provider.available()) return null;
    return provider;
  }

  function listAvailable() {
    const out = [];
    for (const provider of byId.values()) {
      const available = getAvailable(provider.id);
      if (!available) continue;
      out.push({
        id: provider.id,
        label: provider.label || provider.id,
        mode: provider.mode || 'oauth2',
        authorizePath: `/api/auth/oauth/${encodeURIComponent(provider.id)}/authorize`,
      });
    }
    return out;
  }

  return {
    ids: () => [...byId.keys()],
    get: providerId => byId.get(String(providerId)) || null,
    getAvailable,
    listAvailable,
    githubEnvConfigured: () => githubEnvConfigured(env),
  };
}