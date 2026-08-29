/**
 * 4c183cd4 续命 P-D commerce paywall 单元测试
 * 覆盖：service 4 档定价 + 月卡 2 档 + 微信/支付宝 sandbox mock + 签名校验 + 退款 + 异常预警
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { ensureBillingSchema } from '../server/billing/schema.mjs';
import { createWalletService } from '../server/billing/walletService.mjs';
import { createPaywallService } from '../server/billing/paywall.mjs';
import { createAdminOperations } from '../server/adminOperations.mjs';

const WECHAT_SANDBOX_SECRET = 'SANDBOX_WECHAT_PAY_DEMO_SECRET';
const ALIPAY_SANDBOX_SECRET = 'SANDBOX_ALIPAY_DEMO_SECRET';

function createHarness(overrides = {}) {
  const db = new Database(':memory:');
  ensureBillingSchema(db);
  const walletService = overrides.walletService ?? createWalletService(db);
  const env = {
    PAYWALL_WECHAT_SANDBOX_KEY: '1',
    PAYWALL_ALIPAY_SANDBOX_KEY: '1',
    PAYWALL_CALLBACK_BASE_URL: 'http://127.0.0.1:5180/api/billing/paywall/callback',
    ...overrides.env,
  };
  const service = createPaywallService(db, { env, walletService });
  return { db, walletService, service, env };
}

function wechatSignLocal({ appId, mchId, nonceStr, prepayId, timestamp }) {
  const raw = `appId=${appId}&mchId=${mchId}&nonceStr=${nonceStr}&prepayId=${prepayId}&timestamp=${timestamp}`;
  return createHmac('sha256', WECHAT_SANDBOX_SECRET).update(raw).digest('hex');
}

function alipaySignLocal({ outTradeNo, totalAmount, subject }) {
  const raw = `out_trade_no=${outTradeNo}&total_amount=${totalAmount}&subject=${subject}`;
  return createHash('md5').update(`${raw}${ALIPAY_SANDBOX_SECRET}`).digest('hex');
}

test('service exposes expected 6 paywall SKUs (4 档定价 + 月卡 2 档) and 2 channels', () => {
  const { service } = createHarness();
  assert.deepEqual(service.channels(), ['wechat_qr', 'alipay']);
  assert.deepEqual(service.allowedSkus(), [
    'ec_trial_990',
    'ec_starter_29',
    'ec_growth_79',
    'ec_studio_199',
    'ec_monthpack_39',
    'ec_monthpack_59',
  ]);
});

test('creates wechat_qr paywall order with QR checkout and prepay metadata', t => {
  const { db, service } = createHarness();
  t.after(() => db.close());

  const tx = service.createOrder({
    ownerEmail: 'buyer@example.com',
    sku: 'ec_starter_29',
    channel: 'wechat_qr',
  });
  assert.equal(tx.status, 'created');
  assert.equal(tx.ownerEmail, 'buyer@example.com');
  assert.equal(tx.sku, 'ec_starter_29');
  assert.equal(tx.amountFen, 2900);
  assert.equal(tx.grantUnits, 105000);
  assert.equal(tx.channel, 'wechat_qr');
  assert.equal(tx.sandbox, true);
  assert.match(tx.providerOrderId, /^wx_sandbox_prepay_/);
  assert.equal(tx.checkoutPayload.mode, 'qr');
  assert.match(tx.checkoutPayload.qrCode, /^data:image\/png;base64,/);
  assert.equal(tx.checkoutPayload.notifyUrl,
    'http://127.0.0.1:5180/api/billing/paywall/callback?channel=wechat_qr');
  assert.ok(tx.checkoutPayload.prepayId);
  assert.ok(tx.checkoutPayload.sign);
});

test('creates alipay paywall order with redirect URL and sandbox sign', t => {
  const { db, service } = createHarness();
  t.after(() => db.close());

  const tx = service.createOrder({
    ownerEmail: 'alipay-buyer@example.com',
    sku: 'ec_growth_79',
    channel: 'alipay',
  });
  assert.equal(tx.amountFen, 7900);
  assert.equal(tx.grantUnits, 295000);
  assert.match(tx.providerOrderId, /^alipay_sandbox_/);
  assert.equal(tx.checkoutPayload.mode, 'redirect');
  assert.match(tx.checkoutPayload.url, /^https:\/\/openapi\.alipaydev\.com\/gateway\.do\?/);
  assert.equal(tx.checkoutPayload.totalAmount, '79.00');
  assert.equal(tx.checkoutPayload.subject, '薯包 AI 积分-ec_growth_79');
  assert.equal(tx.checkoutPayload.sandbox, true);
});

test('client amount tampering is rejected with PAYWALL_AMOUNT_MISMATCH', t => {
  const { db, service } = createHarness();
  t.after(() => db.close());

  assert.throws(() => service.createOrder({
    ownerEmail: 'tamper@example.com',
    sku: 'ec_starter_29',
    channel: 'wechat_qr',
    clientAmountFen: 1, // 与 catalog priceFen 2900 不一致
  }), error => error.code === 'PAYWALL_AMOUNT_MISMATCH');
});

test('rejects SKUs not in the 4+2 whitelist (e.g. xhs_studio_199)', t => {
  const { db, service } = createHarness();
  t.after(() => db.close());

  assert.throws(() => service.createOrder({
    ownerEmail: 'xhs@example.com',
    sku: 'xhs_studio_199',
    channel: 'wechat_qr',
  }), error => error.code === 'PAYWALL_SKU_NOT_ALLOWED');
});

test('rejects unknown channel and missing sandbox env (PAYWALL_CHANNEL_DISABLED)', t => {
  const { db, service } = createHarness({ env: { PAYWALL_WECHAT_SANDBOX_KEY: '1', PAYWALL_ALIPAY_SANDBOX_KEY: '1' } });
  t.after(() => db.close());

  assert.throws(() => service.createOrder({
    ownerEmail: 'buyer@example.com',
    sku: 'ec_starter_29',
    channel: 'stripe',
  }), error => error.code === 'PAYWALL_CHANNEL_INVALID');

  const noWechat = createPaywallService(db, {
    env: { PAYWALL_WECHAT_SANDBOX_KEY: '0', PAYWALL_ALIPAY_SANDBOX_KEY: '1' },
    walletService: createWalletService(db),
  });
  assert.throws(() => noWechat.createOrder({
    ownerEmail: 'buyer@example.com',
    sku: 'ec_starter_29',
    channel: 'wechat_qr',
  }), error => error.code === 'PAYWALL_CHANNEL_DISABLED');
});

test('wechat callback with valid sandbox signature flips status to paid and grants wallet units', t => {
  const { db, walletService, service } = createHarness();
  t.after(() => db.close());

  const tx = service.createOrder({
    ownerEmail: 'cb-wechat@example.com',
    sku: 'ec_studio_199',
    channel: 'wechat_qr',
  });
  const checkout = JSON.parse(db.prepare('SELECT checkout_payload AS p FROM paywall_transactions WHERE id = ?').get(tx.id).p);
  const { appId, mchId, nonceStr, prepayId, timestamp } = checkout;
  const sign = wechatSignLocal({ appId, mchId, nonceStr, prepayId, timestamp });

  const before = walletService.getBalance('cb-wechat@example.com', 'ec_points').availableUnits;
  const result = service.handleCallback({
    channel: 'wechat_qr',
    providerOrderId: tx.providerOrderId,
    appId, mchId, nonceStr, prepayId, timestamp, sign,
    total_fee: 19900,
    result_code: 'SUCCESS',
  }, {});
  assert.equal(result.duplicate, false);
  assert.equal(result.transaction.status, 'paid');
  const after = walletService.getBalance('cb-wechat@example.com', 'ec_points').availableUnits;
  assert.equal(after - before, 760000, '月卡非,纯积分包,grantUnits=760000');

  // 重复回调 = 幂等
  const replay = service.handleCallback({
    channel: 'wechat_qr',
    providerOrderId: tx.providerOrderId,
    appId, mchId, nonceStr, prepayId, timestamp, sign,
    total_fee: 19900,
  }, {});
  assert.equal(replay.duplicate, true);
  const after2 = walletService.getBalance('cb-wechat@example.com', 'ec_points').availableUnits;
  assert.equal(after2, after, '重复回调不重复 grant');
});

test('alipay callback with valid sandbox signature flips status to paid and grants wallet units', t => {
  const { db, walletService, service } = createHarness();
  t.after(() => db.close());

  const tx = service.createOrder({
    ownerEmail: 'cb-alipay@example.com',
    sku: 'ec_monthpack_39',
    channel: 'alipay',
  });
  const checkout = JSON.parse(db.prepare('SELECT checkout_payload AS p FROM paywall_transactions WHERE id = ?').get(tx.id).p);
  const { outTradeNo, totalAmount, subject } = checkout;
  const sign = alipaySignLocal({ outTradeNo, totalAmount, subject });

  const before = walletService.getBalance('cb-alipay@example.com', 'ec_points').availableUnits;
  const result = service.handleCallback({
    channel: 'alipay',
    out_trade_no: outTradeNo,
    total_amount: totalAmount,
    subject,
    sign,
    trade_no: '20260829_alipay_demo_trade_001',
  }, {});
  assert.equal(result.duplicate, false);
  assert.equal(result.transaction.status, 'paid');
  const after = walletService.getBalance('cb-alipay@example.com', 'ec_points').availableUnits;
  assert.equal(after - before, 175000, '月卡 39 grantUnits=175000 (base 150000 + gift 25000)');
});

test('callback rejects invalid signature with PAYWALL_SIGNATURE_INVALID', t => {
  const { db, service } = createHarness();
  t.after(() => db.close());

  const tx = service.createOrder({
    ownerEmail: 'sig@example.com',
    sku: 'ec_starter_29',
    channel: 'wechat_qr',
  });
  assert.throws(() => service.handleCallback({
    channel: 'wechat_qr',
    providerOrderId: tx.providerOrderId,
    appId: 'wx_sandbox_app',
    mchId: 'mch_sandbox_demo',
    nonceStr: 'fake',
    prepayId: tx.providerOrderId,
    timestamp: '1700000000',
    sign: 'wrong_sign',
    total_fee: 2900,
  }, {}), error => error.code === 'PAYWALL_SIGNATURE_INVALID');

  // alipay
  const txAli = service.createOrder({
    ownerEmail: 'sig2@example.com',
    sku: 'ec_starter_29',
    channel: 'alipay',
  });
  assert.throws(() => service.handleCallback({
    channel: 'alipay',
    out_trade_no: txAli.providerOrderId,
    total_amount: '29.00',
    subject: '薯包 AI 积分-ec_starter_29',
    sign: 'wrong_sign',
  }, {}), error => error.code === 'PAYWALL_SIGNATURE_INVALID');
});

test('callback rejects amount mismatch with PAYWALL_AMOUNT_MISMATCH', t => {
  const { db, service } = createHarness();
  t.after(() => db.close());

  const tx = service.createOrder({
    ownerEmail: 'amt@example.com',
    sku: 'ec_starter_29',
    channel: 'wechat_qr',
  });
  const checkout = JSON.parse(db.prepare('SELECT checkout_payload AS p FROM paywall_transactions WHERE id = ?').get(tx.id).p);
  const { appId, mchId, nonceStr, prepayId, timestamp } = checkout;
  const sign = wechatSignLocal({ appId, mchId, nonceStr, prepayId, timestamp });

  assert.throws(() => service.handleCallback({
    channel: 'wechat_qr',
    providerOrderId: tx.providerOrderId,
    appId, mchId, nonceStr, prepayId, timestamp, sign,
    total_fee: 1, // 篡价
  }, {}), error => error.code === 'PAYWALL_AMOUNT_MISMATCH');
});

test('refundOrder flips paid->refunded and stores refundAmountFen', t => {
  const { db, service } = createHarness();
  t.after(() => db.close());

  const tx = service.createOrder({
    ownerEmail: 'rf@example.com',
    sku: 'ec_starter_29',
    channel: 'alipay',
  });
  const checkout = JSON.parse(db.prepare('SELECT checkout_payload AS p FROM paywall_transactions WHERE id = ?').get(tx.id).p);
  const sign = alipaySignLocal({
    outTradeNo: checkout.outTradeNo,
    totalAmount: checkout.totalAmount,
    subject: checkout.subject,
  });
  service.handleCallback({
    channel: 'alipay',
    out_trade_no: checkout.outTradeNo,
    total_amount: checkout.totalAmount,
    subject: checkout.subject,
    sign,
  }, {});

  const refunded = service.refundOrder({
    transactionId: tx.id,
    refundAmountFen: 2900,
    reason: 'user request',
  });
  assert.equal(refunded.status, 'refunded');
  assert.equal(refunded.refundAmountFen, 2900);
  assert.ok(refunded.refundedAt);

  // 部分退款也接受
  const tx2 = service.createOrder({
    ownerEmail: 'rf2@example.com',
    sku: 'ec_starter_29',
    channel: 'wechat_qr',
  });
  const checkout2 = JSON.parse(db.prepare('SELECT checkout_payload AS p FROM paywall_transactions WHERE id = ?').get(tx2.id).p);
  const sign2 = wechatSignLocal({
    appId: checkout2.appId, mchId: checkout2.mchId,
    nonceStr: checkout2.nonceStr, prepayId: checkout2.prepayId, timestamp: checkout2.timestamp,
  });
  service.handleCallback({
    channel: 'wechat_qr',
    providerOrderId: tx2.providerOrderId,
    appId: checkout2.appId, mchId: checkout2.mchId,
    nonceStr: checkout2.nonceStr, prepayId: checkout2.prepayId, timestamp: checkout2.timestamp,
    sign: sign2,
    total_fee: 2900,
  }, {});
  const partial = service.refundOrder({ transactionId: tx2.id, refundAmountFen: 1000 });
  assert.equal(partial.status, 'refunded');
  assert.equal(partial.refundAmountFen, 1000);

  // 退款超付报错 (用新订单)
  const txOver = service.createOrder({
    ownerEmail: 'rf-over@example.com',
    sku: 'ec_starter_29',
    channel: 'wechat_qr',
  });
  const ckOver = JSON.parse(db.prepare('SELECT checkout_payload AS p FROM paywall_transactions WHERE id = ?').get(txOver.id).p);
  const signOver = wechatSignLocal({
    appId: ckOver.appId, mchId: ckOver.mchId,
    nonceStr: ckOver.nonceStr, prepayId: ckOver.prepayId, timestamp: ckOver.timestamp,
  });
  service.handleCallback({
    channel: 'wechat_qr',
    providerOrderId: txOver.providerOrderId,
    appId: ckOver.appId, mchId: ckOver.mchId,
    nonceStr: ckOver.nonceStr, prepayId: ckOver.prepayId, timestamp: ckOver.timestamp,
    sign: signOver,
    total_fee: 2900,
  }, {});
  assert.throws(() => service.refundOrder({ transactionId: txOver.id, refundAmountFen: 99999999 }),
    error => error.code === 'PAYWALL_AMOUNT_INVALID');

  // 未付款退款报错
  const tx3 = service.createOrder({
    ownerEmail: 'rf3@example.com',
    sku: 'ec_starter_29',
    channel: 'wechat_qr',
  });
  assert.throws(() => service.refundOrder({ transactionId: tx3.id }),
    error => error.code === 'PAYWALL_STATE_INVALID');
});

test('stats returns totals/bySku/byChannel with anomaly detection (退款率 > 30% 告警)', t => {
  const { db, service } = createHarness();
  t.after(() => db.close());

  // 10 笔 paid, 4 笔 refunded (ec_starter_29, 退款率 40% > 30% 告警)
  const ids = [];
  for (let i = 0; i < 10; i++) {
    const tx = service.createOrder({
      ownerEmail: `stat${i}@example.com`,
      sku: 'ec_starter_29',
      channel: i % 2 ? 'wechat_qr' : 'alipay',
    });
    const checkout = JSON.parse(db.prepare('SELECT checkout_payload AS p FROM paywall_transactions WHERE id = ?').get(tx.id).p);
    if (tx.channel === 'wechat_qr') {
      const sign = wechatSignLocal({
        appId: checkout.appId, mchId: checkout.mchId,
        nonceStr: checkout.nonceStr, prepayId: checkout.prepayId, timestamp: checkout.timestamp,
      });
      service.handleCallback({
        channel: 'wechat_qr',
        providerOrderId: tx.providerOrderId,
        appId: checkout.appId, mchId: checkout.mchId,
        nonceStr: checkout.nonceStr, prepayId: checkout.prepayId, timestamp: checkout.timestamp,
        sign,
        total_fee: 2900,
      }, {});
    } else {
      const sign = alipaySignLocal({
        outTradeNo: checkout.outTradeNo,
        totalAmount: checkout.totalAmount,
        subject: checkout.subject,
      });
      service.handleCallback({
        channel: 'alipay',
        out_trade_no: checkout.outTradeNo,
        total_amount: checkout.totalAmount,
        subject: checkout.subject,
        sign,
      }, {});
    }
    ids.push(tx);
  }
  // 退 4 笔
  for (let i = 0; i < 4; i++) {
    service.refundOrder({ transactionId: ids[i].id, refundAmountFen: 2900, reason: 'test refund' });
  }

  const s = service.stats({ days: 30 });
  // 6 paid + 4 refunded = 10 transactions, 退款率 4/6=0.667 -> critical (>50%)
  assert.equal(s.totals.paidCount, 6);
  assert.equal(s.totals.refundedCount, 4);
  assert.equal(s.totals.transactionCount, 10);
  assert.equal(s.totals.grossRevenueCny, 174);  // 6 * 29 = 174
  assert.equal(s.totals.refundAmountCny, 116);  // 4 * 29 = 116
  assert.equal(s.totals.netRevenueCny, 58);    // 174 - 116
  assert.equal(s.totals.refundRate, Number((4 / 6).toFixed(4)));
  // bySku: ec_starter_29 退款率 4/6=0.667 触发 critical
  const skuRow = s.bySku.find(r => r.sku === 'ec_starter_29');
  assert.ok(skuRow);
  assert.equal(skuRow.refundedCount, 4);
  assert.equal(skuRow.paidCount, 6);
  // anomalies: 4/6=0.667 退款率 -> critical (>50% 危险线)
  assert.ok(s.anomalies.length > 0);
  const anom = s.anomalies.find(a => a.sku === 'ec_starter_29');
  assert.ok(anom, '应触发 ec_starter_29 退款率告警');
  assert.equal(anom.code, 'PAYWALL_HIGH_SKU_REFUND');
  assert.equal(anom.severity, 'critical');
  assert.match(anom.detail, /退款率 66\.7%/);
});

test('adminOperations paywallStats delegates to paywall service and exposes totals', t => {
  const db = new Database(':memory:');
  ensureBillingSchema(db);
  const walletService = createWalletService(db);
  const paywallService = createPaywallService(db, {
    env: { PAYWALL_WECHAT_SANDBOX_KEY: '1', PAYWALL_ALIPAY_SANDBOX_KEY: '1' },
    walletService,
  });
  const adminOps = createAdminOperations({ db, walletService });
  adminOps.bindPaywallService(paywallService);

  // 未注入时抛 ADMIN_PAYWALL_UNAVAILABLE
  const detached = createAdminOperations({ db, walletService });
  assert.throws(() => detached.paywallStats({}), error => error.code === 'ADMIN_PAYWALL_UNAVAILABLE');

  // 注入后 1 笔 paid
  const tx = paywallService.createOrder({
    ownerEmail: 'admin@example.com',
    sku: 'ec_growth_79',
    channel: 'wechat_qr',
  });
  const checkout = JSON.parse(db.prepare('SELECT checkout_payload AS p FROM paywall_transactions WHERE id = ?').get(tx.id).p);
  const sign = wechatSignLocal({
    appId: checkout.appId, mchId: checkout.mchId,
    nonceStr: checkout.nonceStr, prepayId: checkout.prepayId, timestamp: checkout.timestamp,
  });
  paywallService.handleCallback({
    channel: 'wechat_qr',
    providerOrderId: tx.providerOrderId,
    appId: checkout.appId, mchId: checkout.mchId,
    nonceStr: checkout.nonceStr, prepayId: checkout.prepayId, timestamp: checkout.timestamp,
    sign,
    total_fee: 7900,
  }, {});

  const stats = adminOps.paywallStats({ days: 30 });
  assert.equal(stats.totals.paidCount, 1);
  assert.equal(stats.totals.grossRevenueCny, 79);
  assert.ok(stats.bySku.find(r => r.sku === 'ec_growth_79'));
  assert.ok(stats.byChannel.find(c => c.channel === 'wechat_qr'));

  // 列表 + 退款 admin 入口
  const list = adminOps.paywallList({ limit: 10 });
  assert.equal(list.length, 1);
  assert.equal(list[0].status, 'paid');
  const refundResult = adminOps.paywallRefund({
    transactionId: tx.id,
    refundAmountFen: 7900,
    reason: 'admin test',
  });
  assert.equal(refundResult.status, 'refunded');

  db.close();
});
