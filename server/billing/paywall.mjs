/**
 * 4c183cd4 续命 P-D commerce paywall —— 微信/支付宝 sandbox 真实接入层。
 *
 * 目标：在不动现有 paymentService 主账务的前提下，叠加"外部三方支付"真实接入
 *       沙箱链路（不连真通道），用于打通"用户扫码 -> 异步回调 -> 入账 -> 退款"的端到端流程。
 *
 * 模式（仿 server/auth/providers/placeholderProviders.mjs 占位适配器模式）：
 *   - wechat_qrPayAdapter  : 微信支付 sandbox，预下单返回 prepay_id + 二维码占位（mock QR data URI）。
 *                           回调走统一 /api/billing/paywall/callback?channel=wechat_qr，
 *                           验签用 sandbox-fixed 密钥 + 订单金额 + 商户单号三重核对。
 *   - alipayAdapter        : 支付宝 sandbox，预下单返回 redirect URL（mock gateway），
 *                           回调走统一 /api/billing/paywall/callback?channel=alipay，
 *                           验签走 sandbox-fixed 密钥 + 订单金额 + 商户单号三重核对。
 *
 * 沙箱环境变量（sandbox only, 真上线前必须替换为生产密钥 + 真回调地址）：
 *   - PAYWALL_WECHAT_SANDBOX_KEY=1  (sandbox 模式开关；其他值 = unavailable)
 *   - PAYWALL_ALIPAY_SANDBOX_KEY=1
 *   - PAYWALL_CALLBACK_BASE_URL=    (回调基础 URL, 留空则用 localhost sandbox)
 *
 * 4 档定价 + 月卡 2 档白名单：复用 server/billing/catalog.mjs 的 PRODUCTS（ec_trial_990/
 * ec_starter_29/ec_growth_79/ec_studio_199 + 月卡 ec_monthpack_39/ec_monthpack_59）。
 * 只接受 ec_points 货币的 SKU；content_sets 旧 SKU 不进入 paywall。
 *
 * 不实现：
 *   - 真实微信/支付宝 SDK（生产用 wxpay-axios-plugin / alipay-sdk，由后续 P-D-1 子代理补）
 *   - 真实钱款清结算（钱进沙箱账户，不入账）
 *   - 自动对账（依赖支付 Service 的 processed_provider_events 表去重）
 *
 * 表：paywall_transactions（独立表，避免污染现有 payment_orders 口径）
 *   - id / owner_email / sku / amount_fen / channel / provider_order_id
 *   - status: created|paid|refunded|failed
 *   - sandbox=true (恒为 1，未来上线时以此字段做单一切换判定)
 *   - created_at / updated_at
 */
import { randomUUID, createHmac, createHash } from 'node:crypto';
import { PRODUCTS, getProduct } from './catalog.mjs';

const SANDBOX_AMOUNT_CAP_FEN = 1_000_000; // 沙箱单笔上限 10000 元，防真钱意外冲入
const SAFE_IDENTIFIER = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const SAFE_PROVIDER = /^(wechat_qr|alipay)$/;
const CHANNELS = Object.freeze(['wechat_qr', 'alipay']);

// 4 档定价 + 月卡 2 档白名单：来自 catalog.mjs.PRODUCTS (ec_trial_990 ~ ec_studio_199 + 月卡)
// paywall 不接 content_sets / 不接 enabled=false 的产品；后续扩 SKU 改本表即可
const PAYWALL_SKUS = Object.freeze([
  'ec_trial_990',
  'ec_starter_29',
  'ec_growth_79',
  'ec_studio_199',
  'ec_monthpack_39',
  'ec_monthpack_59',
]);

function codedError(code, message = code, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw codedError('PAYWALL_REQUEST_INVALID', `${label} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeEmail(value) {
  return nonEmptyString(value, 'ownerEmail').toLowerCase();
}

function normalizeChannel(value) {
  const channel = nonEmptyString(value, 'channel').toLowerCase();
  if (!SAFE_PROVIDER.test(channel)) {
    throw codedError('PAYWALL_CHANNEL_INVALID', `channel must be wechat_qr or alipay, got ${channel}`);
  }
  return channel;
}

function normalizeSku(value) {
  const sku = nonEmptyString(value, 'sku');
  if (!PAYWALL_SKUS.includes(sku)) {
    throw codedError('PAYWALL_SKU_NOT_ALLOWED', `sku ${sku} is not in the paywall whitelist`, 422);
  }
  const product = getProduct(sku);
  if (product.currency !== 'ec_points') {
    throw codedError('PAYWALL_SKU_NOT_ALLOWED', `sku ${sku} currency ${product.currency} is not ec_points`, 422);
  }
  return sku;
}

function normalizeAmountFen(value) {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > SANDBOX_AMOUNT_CAP_FEN) {
    throw codedError('PAYWALL_AMOUNT_INVALID',
      `amount must be a positive integer in (0, ${SANDBOX_AMOUNT_CAP_FEN}] fen`);
  }
  return amount;
}

function sandboxEnabled(env, channel) {
  const key = channel === 'wechat_qr'
    ? 'PAYWALL_WECHAT_SANDBOX_KEY'
    : 'PAYWALL_ALIPAY_SANDBOX_KEY';
  return String(env?.[key] ?? '').trim() === '1';
}

function safeCallbackBase(env) {
  const raw = String(env?.PAYWALL_CALLBACK_BASE_URL ?? '').trim();
  if (!raw) return 'http://127.0.0.1:5180/api/billing/paywall/callback';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

// 沙箱固定密钥（仅 sandbox；真上线时由真签名服务器签发 + 验签）
const WECHAT_SANDBOX_SECRET = 'SANDBOX_WECHAT_PAY_DEMO_SECRET';
const ALIPAY_SANDBOX_SECRET = 'SANDBOX_ALIPAY_DEMO_SECRET';

function mockQrDataUri(payload) {
  // 真实场景：用 qr-image / qrcode 等生成 PNG b64；沙箱占位用 1x1 png data URI。
  // 1x1 transparent PNG: 89504E470D0A1A0A 0000000D49484452 00000001000000010806000000 1F15C489 0000000D49444154 789C63000100000005000121 0F0304 1F0000000049454E44 AE426082
  const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  return `data:image/png;base64,${tinyPng}#${Buffer.from(payload).toString('base64').slice(0, 96)}`;
}

function wechatSign({ appId, mchId, nonceStr, prepayId, timestamp, secret = WECHAT_SANDBOX_SECRET }) {
  const raw = `appId=${appId}&mchId=${mchId}&nonceStr=${nonceStr}&prepayId=${prepayId}&timestamp=${timestamp}`;
  return createHmac('sha256', secret).update(raw).digest('hex');
}

function alipaySign({ outTradeNo, totalAmount, subject, secret = ALIPAY_SANDBOX_SECRET }) {
  const raw = `out_trade_no=${outTradeNo}&total_amount=${totalAmount}&subject=${subject}`;
  return createHash('md5').update(`${raw}${secret}`).digest('hex');
}

function wechatVerifySignature({ appId, mchId, nonceStr, prepayId, timestamp, sign }) {
  const expected = wechatSign({ appId, mchId, nonceStr, prepayId, timestamp });
  return expected === sign;
}

function alipayVerifySignature({ outTradeNo, totalAmount, subject, sign }) {
  const expected = alipaySign({ outTradeNo, totalAmount, subject });
  return expected === sign;
}

function rowFromTransaction(row) {
  if (!row) return null;
  let checkout = null;
  if (typeof row.checkout_payload === 'string' && row.checkout_payload.trim() !== '') {
    try {
      checkout = JSON.parse(row.checkout_payload);
    } catch {
      checkout = null;
    }
  }
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    sku: row.sku,
    amountFen: row.amount_fen,
    currency: row.currency,
    grantUnits: row.grant_units,
    channel: row.channel,
    providerOrderId: row.provider_order_id,
    status: row.status,
    sandbox: row.sandbox === 1,
    checkoutPayload: checkout,
    paidAt: row.paid_at,
    refundedAt: row.refunded_at,
    refundAmountFen: row.refund_amount_fen,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createPaywallService(db, { env = process.env, walletService = null, paymentService = null } = {}) {
  if (!db || typeof db.prepare !== 'function' || typeof db.transaction !== 'function') {
    throw new TypeError('db must be a better-sqlite3 database');
  }

  // 独立 paywall_transactions 表：避免污染主账务口径
  db.exec(`
    CREATE TABLE IF NOT EXISTS paywall_transactions (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      sku TEXT NOT NULL,
      amount_fen INTEGER NOT NULL,
      currency TEXT NOT NULL,
      grant_units INTEGER NOT NULL,
      channel TEXT NOT NULL,
      provider_order_id TEXT NOT NULL,
      status TEXT NOT NULL,
      sandbox INTEGER NOT NULL DEFAULT 1,
      checkout_payload TEXT NOT NULL DEFAULT '',
      paid_at TEXT,
      refunded_at TEXT,
      refund_amount_fen INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_paywall_tx_channel_provider
      ON paywall_transactions (channel, provider_order_id);
    CREATE INDEX IF NOT EXISTS idx_paywall_tx_owner ON paywall_transactions (owner_email, created_at);
    CREATE INDEX IF NOT EXISTS idx_paywall_tx_status ON paywall_transactions (status, created_at);
  `);

  const stmts = {
    insert: db.prepare(`
      INSERT INTO paywall_transactions
        (id, owner_email, sku, amount_fen, currency, grant_units, channel, provider_order_id, status, sandbox, checkout_payload, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'created', 1, '', ?, ?)
    `),
    get: db.prepare('SELECT * FROM paywall_transactions WHERE id = ?'),
    getByProviderOrder: db.prepare(
      'SELECT * FROM paywall_transactions WHERE channel = ? AND provider_order_id = ?',
    ),
    markPaid: db.prepare(`
      UPDATE paywall_transactions
      SET status = 'paid', paid_at = ?, updated_at = ?
      WHERE id = ? AND status IN ('created', 'pending')
    `),
    markRefunded: db.prepare(`
      UPDATE paywall_transactions
      SET status = 'refunded', refunded_at = ?, refund_amount_fen = ?, updated_at = ?
      WHERE id = ? AND status = 'paid'
    `),
    markFailed: db.prepare(`
      UPDATE paywall_transactions
      SET status = 'failed', updated_at = ?
      WHERE id = ? AND status IN ('created', 'pending')
    `),
    updateCheckout: db.prepare(`
      UPDATE paywall_transactions
      SET checkout_payload = ?, updated_at = ?
      WHERE id = ?
    `),
  };

  // 微信 sandbox 适配器
  function wechatCreateOrder({ transactionId, sku, amountFen, ownerEmail, callbackUrl }) {
    if (!sandboxEnabled(env, 'wechat_qr')) {
      throw codedError('PAYWALL_CHANNEL_DISABLED', 'wechat_qr sandbox is not enabled', 503);
    }
    const prepayId = `wx_sandbox_prepay_${randomUUID().replace(/-/g, '')}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonceStr = randomUUID().replace(/-/g, '').slice(0, 32);
    const sign = wechatSign({
      appId: 'wx_sandbox_app',
      mchId: 'mch_sandbox_demo',
      nonceStr,
      prepayId,
      timestamp,
    });
    const qrPayload = `weixin://wxpay/bizpayurl?pr=${prepayId}`;
    const checkout = {
      mode: 'qr',
      qrCode: mockQrDataUri(qrPayload),
      prepayId,
      timestamp,
      nonceStr,
      sign,
      appId: 'wx_sandbox_app',
      mchId: 'mch_sandbox_demo',
      notifyUrl: callbackUrl,
      sandbox: true,
    };
    return { providerOrderId: prepayId, checkout };
  }

  // 支付宝 sandbox 适配器
  function alipayCreateOrder({ transactionId, sku, amountFen, ownerEmail, callbackUrl, product }) {
    if (!sandboxEnabled(env, 'alipay')) {
      throw codedError('PAYWALL_CHANNEL_DISABLED', 'alipay sandbox is not enabled', 503);
    }
    const outTradeNo = `alipay_sandbox_${randomUUID().replace(/-/g, '')}`;
    const totalAmount = (amountFen / 100).toFixed(2);
    const subject = product ? `薯包 AI 积分-${product.sku}` : `薯包 AI 积分-${sku}`;
    const sign = alipaySign({ outTradeNo, totalAmount, subject });
    const query = new URLSearchParams({
      out_trade_no: outTradeNo,
      total_amount: totalAmount,
      subject,
      sign,
      sign_type: 'MD5',
      notify_url: callbackUrl,
      sandbox: 'true',
    }).toString();
    const redirectUrl = `https://openapi.alipaydev.com/gateway.do?${query}`;
    const checkout = {
      mode: 'redirect',
      url: redirectUrl,
      outTradeNo,
      totalAmount,
      subject,
      sign,
      sandbox: true,
      notifyUrl: callbackUrl,
    };
    return { providerOrderId: outTradeNo, checkout };
  }

  // 公开 API: 创建 paywall 订单（对外 = POST /api/billing/paywall/create）
  function createOrder({ ownerEmail, sku, channel, clientAmountFen = null } = {}) {
    const email = normalizeEmail(ownerEmail);
    const channelId = normalizeChannel(channel);
    const skuId = normalizeSku(sku);
    const product = getProduct(skuId);
    if (product.priceFen <= 0) {
      throw codedError('PAYWALL_SKU_INVALID', `sku ${skuId} has no payable price`);
    }
    // 客户端可传 clientAmountFen 防篡价（必须等于 server-side catalog priceFen）
    const amountFen = clientAmountFen === null || clientAmountFen === undefined
      ? product.priceFen
      : normalizeAmountFen(clientAmountFen);
    if (amountFen !== product.priceFen) {
      throw codedError('PAYWALL_AMOUNT_MISMATCH',
        `client amount ${amountFen} fen != catalog price ${product.priceFen} fen for sku ${skuId}`, 422);
    }
    if (!sandboxEnabled(env, channelId)) {
      throw codedError('PAYWALL_CHANNEL_DISABLED',
        `channel ${channelId} sandbox is not enabled (set ${channelId === 'wechat_qr' ? 'PAYWALL_WECHAT_SANDBOX_KEY' : 'PAYWALL_ALIPAY_SANDBOX_KEY'}=1)`, 503);
    }
    const baseUrl = safeCallbackBase(env);
    if (!baseUrl) {
      throw codedError('PAYWALL_CALLBACK_INVALID', 'PAYWALL_CALLBACK_BASE_URL is invalid');
    }
    const callbackUrl = `${baseUrl}?channel=${channelId}`;
    const id = randomUUID();
    const now = new Date().toISOString();
    stmts.insert.run(
      id, email, skuId, amountFen, product.currency, product.grantUnits,
      channelId, 'pending', now, now,
    );
    let result;
    try {
      result = channelId === 'wechat_qr'
        ? wechatCreateOrder({ transactionId: id, sku: skuId, amountFen, ownerEmail: email, callbackUrl })
        : alipayCreateOrder({ transactionId: id, sku: skuId, amountFen, ownerEmail: email, callbackUrl, product });
    } catch (error) {
      stmts.markFailed.run(now, id);
      throw error;
    }
    stmts.updateCheckout.run(JSON.stringify(result.checkout), now, id);
    // update provider_order_id (insert 时留 'pending'，checkout 后覆盖)
    db.prepare('UPDATE paywall_transactions SET provider_order_id = ?, updated_at = ? WHERE id = ?')
      .run(result.providerOrderId, now, id);
    return rowFromTransaction(stmts.get.get(id));
  }

  // 公开 API: 处理三方回调（对外 = POST /api/billing/paywall/callback）
  // 微信回调字段: { channel: 'wechat_qr', out_trade_no, transaction_id, total_fee, sign, ... }
  // 支付宝回调字段: { channel: 'alipay', out_trade_no, trade_no, total_amount, sign, ... }
  function handleCallback(callbackBody = {}, { rawBody = null, headers = {} } = {}) {
    const channelId = normalizeChannel(callbackBody.channel);
    if (!sandboxEnabled(env, channelId)) {
      throw codedError('PAYWALL_CHANNEL_DISABLED',
        `channel ${channelId} sandbox is not enabled`, 503);
    }
    const providerOrderId = nonEmptyString(
      callbackBody.providerOrderId || callbackBody.out_trade_no || callbackBody.transactionId,
      'providerOrderId',
    );
    const tx = stmts.getByProviderOrder.get(channelId, providerOrderId);
    if (!tx) {
      throw codedError('PAYWALL_TRANSACTION_NOT_FOUND',
        `no transaction for ${channelId}/${providerOrderId}`, 404);
    }
    if (tx.status === 'paid') {
      return { duplicate: true, transaction: rowFromTransaction(tx) };
    }
    // 验签（按通道）
    if (channelId === 'wechat_qr') {
      const appId = nonEmptyString(callbackBody.appId, 'appId');
      const mchId = nonEmptyString(callbackBody.mchId, 'mchId');
      const nonceStr = nonEmptyString(callbackBody.nonceStr, 'nonceStr');
      const prepayId = nonEmptyString(callbackBody.prepayId || providerOrderId, 'prepayId');
      const timestamp = nonEmptyString(callbackBody.timestamp, 'timestamp');
      const sign = nonEmptyString(callbackBody.sign, 'sign');
      if (!wechatVerifySignature({ appId, mchId, nonceStr, prepayId, timestamp, sign })) {
        throw codedError('PAYWALL_SIGNATURE_INVALID', 'wechat_qr callback signature mismatch', 401);
      }
      const totalFee = Number(callbackBody.total_fee);
      if (!Number.isSafeInteger(totalFee) || totalFee !== tx.amount_fen) {
        throw codedError('PAYWALL_AMOUNT_MISMATCH',
          `wechat callback total_fee ${totalFee} != transaction ${tx.amount_fen}`, 422);
      }
    } else {
      // alipay
      const outTradeNo = nonEmptyString(callbackBody.out_trade_no || providerOrderId, 'out_trade_no');
      const totalAmount = nonEmptyString(callbackBody.total_amount, 'total_amount');
      const expectedTotal = (tx.amount_fen / 100).toFixed(2);
      if (totalAmount !== expectedTotal) {
        throw codedError('PAYWALL_AMOUNT_MISMATCH',
          `alipay callback total_amount ${totalAmount} != transaction ${expectedTotal}`, 422);
      }
      const subject = nonEmptyString(callbackBody.subject, 'subject');
      const sign = nonEmptyString(callbackBody.sign, 'sign');
      if (!alipayVerifySignature({ outTradeNo, totalAmount, subject, sign })) {
        throw codedError('PAYWALL_SIGNATURE_INVALID', 'alipay callback signature mismatch', 401);
      }
    }
    const now = new Date().toISOString();
    const updated = stmts.markPaid.run(now, now, tx.id);
    if (updated.changes !== 1) {
      throw codedError('PAYWALL_STATE_INVALID',
        `transaction ${tx.id} cannot transition to paid (status=${tx.status})`, 409);
    }
    // 可选：入账到 walletService（与主 paymentService 路径并行；幂等键加 paywall 前缀防撞）
    if (walletService && typeof walletService.grant === 'function') {
      try {
        const product = getProduct(tx.sku);
        walletService.grant({
          ownerEmail: tx.owner_email,
          currency: product.currency,
          units: product.grantUnits,
          idempotencyKey: `paywall-grant:${tx.id}`,
          sourceType: 'paywall_order',
          sourceId: tx.id,
          metadata: {
            sku: tx.sku,
            channel: tx.channel,
            providerOrderId,
            paymentOrderId: tx.id,
            sandbox: true,
          },
        });
      } catch (grantError) {
        // 入账失败不回滚 paid 状态（用户已付款）；让 admin 通过对账补单
        // eslint-disable-next-line no-console
        console.warn('[paywall] wallet grant failed', { txId: tx.id, error: grantError?.message });
      }
    }
    return { duplicate: false, transaction: rowFromTransaction(stmts.get.get(tx.id)) };
  }

  // 公开 API: 退款（admin only, 对外 = POST /api/billing/paywall/refund）
  function refundOrder({ transactionId, refundAmountFen = null, reason = '' } = {}) {
    const id = nonEmptyString(transactionId, 'transactionId');
    const tx = stmts.get.get(id);
    if (!tx) throw codedError('PAYWALL_TRANSACTION_NOT_FOUND', `transaction ${id} not found`, 404);
    if (tx.status !== 'paid') {
      throw codedError('PAYWALL_STATE_INVALID', `transaction ${id} status=${tx.status} cannot be refunded`, 409);
    }
    const amount = refundAmountFen === null || refundAmountFen === undefined
      ? tx.amount_fen
      : normalizeAmountFen(refundAmountFen);
    if (amount > tx.amount_fen) {
      throw codedError('PAYWALL_AMOUNT_INVALID', `refund ${amount} > paid ${tx.amount_fen}`, 422);
    }
    const now = new Date().toISOString();
    const updated = stmts.markRefunded.run(now, amount, now, id);
    if (updated.changes !== 1) {
      throw codedError('PAYWALL_STATE_INVALID', `transaction ${id} cannot transition to refunded`, 409);
    }
    // 退款不调 walletService.revoke (walletService 仅接受 positive units, 退款扣减走 admin 决策:
    //  - 平台垫付: 留 admin 手工 ledger 调整
    //  - 月卡撤销: 走 xcardWhitelist 单独逻辑 (P-D-1 子代理)
    // paywall_transactions 表自身记录 refundAmountFen + refunded_at, 已满足对账与异常预警
    return rowFromTransaction(stmts.get.get(id));
  }

  function getTransaction(id) {
    if (typeof id !== 'string' || id.trim() === '') return null;
    return rowFromTransaction(stmts.get.get(id));
  }

  function getStatus({ transactionId = null, providerOrderId = null, channel = null } = {}) {
    if (transactionId) return getTransaction(transactionId);
    if (providerOrderId && channel) {
      const ch = normalizeChannel(channel);
      return rowFromTransaction(stmts.getByProviderOrder.get(ch, providerOrderId));
    }
    return null;
  }

  // 统计：admin 用
  function listTransactions({ status = null, channel = null, limit = 100 } = {}) {
    const params = [];
    const where = [];
    if (status) { where.push('status = ?'); params.push(String(status)); }
    if (channel) {
      const ch = normalizeChannel(channel);
      where.push('channel = ?'); params.push(ch);
    }
    const sql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const lim = Math.max(1, Math.min(1000, Number(limit) || 100));
    return db.prepare(
      `SELECT * FROM paywall_transactions ${sql} ORDER BY datetime(created_at) DESC LIMIT ${lim}`,
    ).all(...params).map(rowFromTransaction);
  }

  function stats({ days = 30 } = {}) {
    const safeDays = Math.max(1, Math.min(365, Number(days) || 30));
    // SQLite 默认 created_at 是 'YYYY-MM-DD HH:MM:SS' 格式, 用 SQL 端 datetime() 转换更安全
    const cutoffMs = Date.now() - safeDays * 86400_000;
    const cutoff = new Date(cutoffMs).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='paywall_transactions'").get()) {
      return {
        generatedAt: new Date().toISOString(),
        days: safeDays,
        from: cutoff,
        to: new Date().toISOString(),
        totals: { transactionCount: 0, paidCount: 0, refundedCount: 0, failedCount: 0, grossRevenueCny: 0, refundAmountCny: 0, netRevenueCny: 0, marginCny: 0 },
        bySku: [],
        byChannel: [],
        anomalies: [],
      };
    }
    const totals = db.prepare(`
      SELECT
        COUNT(*) AS transactionCount,
        SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS paidCount,
        SUM(CASE WHEN status='refunded' THEN 1 ELSE 0 END) AS refundedCount,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failedCount,
        COALESCE(SUM(CASE WHEN status='paid' THEN amount_fen ELSE 0 END), 0) AS grossRevenueFen,
        COALESCE(SUM(CASE WHEN status='refunded' THEN refund_amount_fen ELSE 0 END), 0) AS refundAmountFen
      FROM paywall_transactions
      WHERE datetime(created_at) >= datetime(?)
    `).get(cutoff);
    const paid = Number(totals.paidCount || 0);
    const refunded = Number(totals.refundedCount || 0);
    const grossCny = Number(totals.grossRevenueFen || 0) / 100;
    const refundCny = Number(totals.refundAmountFen || 0) / 100;
    const netCny = grossCny - refundCny;
    // 毛利 = 净收入 - 上游成本 (paywall 无 provider cost，按毛利 = 净收入 95% 保守估算，扣 3% 支付费 + 2% 渠道费)
    const marginCny = Number((netCny * 0.95).toFixed(6));
    const bySku = db.prepare(`
      SELECT sku AS sku,
        COUNT(*) AS transactionCount,
        SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS paidCount,
        SUM(CASE WHEN status='refunded' THEN 1 ELSE 0 END) AS refundedCount,
        COALESCE(SUM(CASE WHEN status='paid' THEN amount_fen ELSE 0 END), 0) AS grossRevenueFen
      FROM paywall_transactions
      WHERE datetime(created_at) >= datetime(?)
      GROUP BY sku
      ORDER BY grossRevenueFen DESC
    `).all(cutoff).map(row => ({
      sku: row.sku,
      transactionCount: Number(row.transactionCount || 0),
      paidCount: Number(row.paidCount || 0),
      refundedCount: Number(row.refundedCount || 0),
      grossRevenueCny: Number(row.grossRevenueFen || 0) / 100,
    }));
    const byChannel = db.prepare(`
      SELECT channel AS channel,
        COUNT(*) AS transactionCount,
        SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS paidCount,
        SUM(CASE WHEN status='refunded' THEN 1 ELSE 0 END) AS refundedCount,
        COALESCE(SUM(CASE WHEN status='paid' THEN amount_fen ELSE 0 END), 0) AS grossRevenueFen
      FROM paywall_transactions
      WHERE datetime(created_at) >= datetime(?)
      GROUP BY channel
      ORDER BY grossRevenueFen DESC
    `).all(cutoff).map(row => ({
      channel: row.channel,
      transactionCount: Number(row.transactionCount || 0),
      paidCount: Number(row.paidCount || 0),
      refundedCount: Number(row.refundedCount || 0),
      grossRevenueCny: Number(row.grossRevenueFen || 0) / 100,
    }));
    // 异常退款预警：单日退款率 > 30% 触发 critical；单笔退款率 > 50% 触发 warning
    const anomalies = [];
    for (const skuRow of bySku) {
      if (skuRow.paidCount > 0) {
        const refundRate = skuRow.refundedCount / skuRow.paidCount;
        if (refundRate > 0.5) {
          anomalies.push({
            code: 'PAYWALL_HIGH_SKU_REFUND',
            severity: 'critical',
            sku: skuRow.sku,
            refundRate: Number(refundRate.toFixed(4)),
            paidCount: skuRow.paidCount,
            refundedCount: skuRow.refundedCount,
            detail: `sku ${skuRow.sku} 退款率 ${(refundRate * 100).toFixed(1)}% 超过 50% 危险线`,
          });
        } else if (refundRate > 0.3) {
          anomalies.push({
            code: 'PAYWALL_HIGH_SKU_REFUND',
            severity: 'warning',
            sku: skuRow.sku,
            refundRate: Number(refundRate.toFixed(4)),
            paidCount: skuRow.paidCount,
            refundedCount: skuRow.refundedCount,
            detail: `sku ${skuRow.sku} 退款率 ${(refundRate * 100).toFixed(1)}% 超过 30% 告警线`,
          });
        }
      }
    }
    return {
      generatedAt: new Date().toISOString(),
      days: safeDays,
      from: cutoff,
      to: new Date().toISOString(),
      totals: {
        transactionCount: Number(totals.transactionCount || 0),
        paidCount: paid,
        refundedCount: refunded,
        failedCount: Number(totals.failedCount || 0),
        grossRevenueCny: Number(grossCny.toFixed(6)),
        refundAmountCny: Number(refundCny.toFixed(6)),
        netRevenueCny: Number(netCny.toFixed(6)),
        marginCny,
        grossMargin: netCny > 0 ? Number((marginCny / netCny).toFixed(4)) : null,
        refundRate: paid > 0 ? Number((refunded / paid).toFixed(4)) : 0,
      },
      bySku,
      byChannel,
      anomalies,
    };
  }

  return {
    createOrder,
    handleCallback,
    refundOrder,
    getTransaction,
    getStatus,
    listTransactions,
    stats,
    channels: () => CHANNELS.slice(),
    allowedSkus: () => PAYWALL_SKUS.slice(),
  };
}

export const PAYWALL_SCHEMA_VERSION = 1;
