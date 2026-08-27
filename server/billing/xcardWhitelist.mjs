// server/billing/xcardWhitelist.mjs
// 2026-08-26 周一切片 · §6 #5 月卡细则
// -----------------------------------------------------------------------------
// 风险：30 天有效期 + 赠分限图，规则不清会导致用户投诉积分被清零。无自动续订 = 弱 LTV 锁定。
// 默认建议：30 天当月制 + 赠分限图/工具类（catalog 硬限制）+ 签到每日 50 积分（3 个月实验）；
// 买断年卡观察一季度再定。
// -----------------------------------------------------------------------------
// 设计要点：
//   1) xcard_gift = 月卡礼包赠分限定类目；白名单只允许图片/工具类 SKU 扣分，
//      视频类 SKU（video_*）禁止走赠分，必须用主积分。
//   2) isXcardGiftEligible(sku) 纯函数：catalog 元数据 + 白名单集交集判断。
//   3) MONTHPACKS 暴露给 paymentChannels / 价格页 / admin 看板，由 catalog 单源生成。
//   4) guardXcardGiftUsage(sku) 在 wallet settleUsage 处调用，违规抛 XCARD_GIFT_RESTRICTED。
// -----------------------------------------------------------------------------

// 月卡 SKU 与赠送积分的限定关系（数据源来自 server/billing/catalog.mjs PRODUCTS）。
// 这里只放映射，避免和 catalog 双源失同步。
export const MONTHPACK_SKUS = Object.freeze(['ec_monthpack_39', 'ec_monthpack_59']);

// 赠分允许的类目白名单（图片 / 工具类）：所有 video_*、快试 / 标准 / 长档视频、画布、
// 商品档案、付费扩展均不在白名单。
const IMAGE_FEATURE_PREFIXES = Object.freeze(['ec_image_', 'ec_nano_', 'ec_reverse_prompt',
  'ec_extension_', 'ec_ai_assistant', 'ec_canvas_ocr', 'ec_remove_bg',
  'ec_direction_refresh', 'ec_smart_layer', 'ec_layer_psd']);
const VIDEO_FEATURE_PREFIXES = Object.freeze(['video_']);

function prefixMatch(sku, prefixes) {
  return prefixes.some(prefix => sku.startsWith(prefix));
}

export function isXcardGiftEligible(sku) {
  if (typeof sku !== 'string' || !sku) return false;
  // 月卡礼包本身可被自己扣（grants），不计入赠分白名单
  if (MONTHPACK_SKUS.includes(sku)) return false;
  // 视频类全部禁止走赠分
  if (prefixMatch(sku, VIDEO_FEATURE_PREFIXES)) return false;
  // 图片 / 工具类放行
  return prefixMatch(sku, IMAGE_FEATURE_PREFIXES);
}

// 给 walletService.settleUsage / 退费流程用的硬断言；违规抛带 code 的错。
export function guardXcardGiftUsage(sku) {
  if (isXcardGiftEligible(sku)) return { ok: true };
  return Object.assign(new Error(
    MONTHPACK_SKUS.includes(sku)
      ? '月卡礼包不可再次使用赠分'
      : '月卡赠分仅限图片/工具类目',
  ), {
    code: 'XCARD_GIFT_RESTRICTED',
    sku,
  });
}

// 公开端友好文案：业务侧拼到结算/退费响应。
export function xcardGiftMessage(sku) {
  if (isXcardGiftEligible(sku)) return null;
  if (MONTHPACK_SKUS.includes(sku)) return '月卡礼包不可再次使用赠分';
  return '月卡赠分仅限图片/工具类目';
}

export const XCARD_RULES = Object.freeze({
  flag: 'xcard_gift_2026_08_26',
  validityDays: 30,
  imageFeaturePrefixes: IMAGE_FEATURE_PREFIXES,
  videoFeaturePrefixes: VIDEO_FEATURE_PREFIXES,
  monthpackSkus: MONTHPACK_SKUS,
});
