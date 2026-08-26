/**
 * 支付通道注册表 —— 仿 server/auth/providerRegistry.mjs 的占位适配器模式。
 *
 * 只维护通道状态与上线开关位，不接入任何真实支付 SDK：
 * - balance：现有余额/积分充值通道，保持 active（积分套餐购买即余额充值）。
 * - wechat_qr / alipay：unavailable 占位；环境变量开关位置预留
 *   （PAYMENT_CHANNEL_WECHAT_QR_ENABLED=1 / PAYMENT_CHANNEL_ALIPAY_ENABLED=1），
 *   接入真实 SDK 时新增对应 adapter 并把状态切为 active 即可，订单侧 channelRef 字段已就绪。
 */
const CHANNEL_DEFS = Object.freeze([
  Object.freeze({
    id: 'balance',
    label: '余额充值',
    kind: 'internal',
    defaultStatus: 'active',
    description: '账户余额与积分套餐直接结算，当前可用',
  }),
  Object.freeze({
    id: 'wechat_qr',
    label: '微信支付',
    kind: 'external',
    defaultStatus: 'unavailable',
    launchEnv: 'PAYMENT_CHANNEL_WECHAT_QR_ENABLED',
    availabilityNote: '即将开通',
  }),
  Object.freeze({
    id: 'alipay',
    label: '支付宝',
    kind: 'external',
    defaultStatus: 'unavailable',
    launchEnv: 'PAYMENT_CHANNEL_ALIPAY_ENABLED',
    availabilityNote: '即将开通',
  }),
]);

const SAFE_CHANNEL_ID = /^[a-z0-9][a-z0-9_-]{0,127}$/i;

export function createPaymentChannelRegistry({ env = process.env, channels = null } = {}) {
  const defs = (Array.isArray(channels) && channels.length ? channels : CHANNEL_DEFS)
    .map(def => Object.freeze({ ...def }));
  for (const def of defs) {
    if (!SAFE_CHANNEL_ID.test(def.id || '')) {
      throw new TypeError(`payment channel id is invalid: ${def.id}`);
    }
  }
  const byId = new Map(defs.map(def => [def.id, def]));

  function statusOf(def) {
    if (!def.launchEnv) return def.defaultStatus;
    // 开关位只允许显式 "1" 上线；任何其他值（含缺失）都保持占位状态，避免意外放量。
    return String(env?.[def.launchEnv] ?? '').trim() === '1' ? 'active' : def.defaultStatus;
  }

  return {
    ids: () => [...byId.keys()],
    get: channelId => byId.get(String(channelId)) || null,
    isActive: channelId => {
      const def = byId.get(String(channelId));
      return Boolean(def) && statusOf(def) === 'active';
    },
    listChannels: () => defs.map(def => {
      const status = statusOf(def);
      return Object.freeze({
        id: def.id,
        label: def.label,
        kind: def.kind,
        status,
        enabled: status === 'active',
        ...(def.description ? { description: def.description } : {}),
        ...(def.availabilityNote ? { availabilityNote: def.availabilityNote } : {}),
        ...(def.launchEnv ? { launchEnv: def.launchEnv } : {}),
      });
    }),
  };
}
