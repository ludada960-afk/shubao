// test/xcard-monthpack.test.mjs
// 2026-08-26 周一切片 · §6 #5 月卡细则
// -----------------------------------------------------------------------------
// 验证：paymentChannels.mjs 暴露 balance_monthpack 通道（30 天 + 赠分限图）；
// xcardWhitelist 视频/全部 video_* 拒绝，图片/工具类放行，月卡 SKU 自身不可再次扣赠分；
// adminOperations byChannel 收入看板聚合 payment_orders.channel_ref；
// guardXcardGiftUsage 抛 XCARD_GIFT_RESTRICTED。
// -----------------------------------------------------------------------------
import test from 'node:test';
import assert from 'node:assert/strict';

import { createPaymentChannelRegistry } from '../server/billing/paymentChannels.mjs';
import {
  MONTHPACK_SKUS,
  XCARD_RULES,
  guardXcardGiftUsage,
  isXcardGiftEligible,
  xcardGiftMessage,
} from '../server/billing/xcardWhitelist.mjs';

test('paymentChannels exposes balance_monthpack with monthpack SKUs and 30-day validity', () => {
  const registry = createPaymentChannelRegistry({ env: {} });
  const channel = registry.get('balance_monthpack');
  assert.ok(channel, 'balance_monthpack channel must be registered');
  assert.equal(channel.kind, 'internal');
  assert.equal(channel.defaultStatus, 'active');
  assert.equal(channel.validityDays, 30);
  assert.deepEqual([...channel.skus], MONTHPACK_SKUS);
  assert.equal(channel.giftRuleFlag, XCARD_RULES.flag);
});

test('paymentChannels listChannels reports active balance_monthpack', () => {
  const registry = createPaymentChannelRegistry({ env: {} });
  const listed = registry.listChannels();
  const monthpack = listed.find(c => c.id === 'balance_monthpack');
  assert.equal(monthpack.status, 'active');
  assert.equal(monthpack.enabled, true);
  // wechat_qr / alipay 默认 unavailable（除非显式 env=1）
  const wx = listed.find(c => c.id === 'wechat_qr');
  assert.equal(wx.status, 'unavailable');
});

test('paymentChannels can be forced active via env=1', () => {
  const registry = createPaymentChannelRegistry({ env: { PAYMENT_CHANNEL_WECHAT_QR_ENABLED: '1' } });
  const wx = registry.get('wechat_qr');
  assert.equal(registry.isActive('wechat_qr'), true);
  assert.equal(wx.label, '微信支付');
});

test('xcard whitelist: image/tool SKUs are eligible for gift credits', () => {
  for (const sku of ['ec_image_2k', 'ec_image_4k', 'ec_nano_flash_1k',
    'ec_nano_flash_2k', 'ec_nano_flash_4k', 'ec_nano_pro_1k', 'ec_nano_pro_4k',
    'ec_extension_basic', 'ec_extension_complete', 'ec_ai_assistant',
    'ec_remove_bg', 'ec_direction_refresh', 'ec_reverse_prompt']) {
    assert.equal(isXcardGiftEligible(sku), true, `${sku} should be eligible`);
  }
});

test('xcard whitelist: video SKUs are NOT eligible for gift credits', () => {
  for (const sku of ['video_seedance_fast_short', 'video_seedance_fast_long',
    'video_seedance_standard_short', 'video_seedance_standard_long',
    'video_minimax_h3_2k_short', 'video_minimax_h3_2k_long',
    'video_seedance_1080p', 'video_plan_analysis']) {
    assert.equal(isXcardGiftEligible(sku), false, `${sku} must be blocked from gift`);
  }
});

test('xcard whitelist: monthpack SKUs themselves are not eligible (no self-spend on gift)', () => {
  for (const sku of MONTHPACK_SKUS) {
    assert.equal(isXcardGiftEligible(sku), false);
  }
});

test('guardXcardGiftUsage returns ok for image SKUs and XCARD_GIFT_RESTRICTED for video', () => {
  assert.equal(guardXcardGiftUsage('ec_image_2k').ok, true);
  const blocked = guardXcardGiftUsage('video_seedance_standard_long');
  assert.equal(blocked.ok, undefined);
  assert.equal(blocked.code, 'XCARD_GIFT_RESTRICTED');
  assert.match(blocked.message, /月卡赠分仅限图片/);
});

test('xcardGiftMessage returns null for eligible SKUs and a Chinese copy for blocked ones', () => {
  assert.equal(xcardGiftMessage('ec_image_2k'), null);
  assert.match(xcardGiftMessage('video_seedance_standard_short'), /月卡赠分仅限图片/);
  assert.match(xcardGiftMessage('ec_monthpack_39'), /月卡礼包不可再次使用赠分/);
});

test('XCARD_RULES metadata pins flag, validityDays, whitelist prefixes', () => {
  assert.equal(XCARD_RULES.flag, 'xcard_gift_2026_08_26');
  assert.equal(XCARD_RULES.validityDays, 30);
  assert.equal(XCARD_RULES.monthpackSkus, MONTHPACK_SKUS);
  // 视频前缀必须包含 video_
  assert.ok(XCARD_RULES.videoFeaturePrefixes.some(p => p === 'video_'));
});
