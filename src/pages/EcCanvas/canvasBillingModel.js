const FREE = Object.freeze({ paid: false, units: 0, currency: 'ec_points', sku: null });
const ACTIONS = Object.freeze({
  'reverse-prompt': { paid: true, units: 0.2, currency: 'ec_points', sku: 'ec_reverse_prompt' },
  ocr: { paid: true, units: 0.2, currency: 'ec_points', sku: 'ec_canvas_ocr' },
  // 抠图前会先跑一次商品识别（ec_canvas_recognize 0.2），展示价必须含它，否则用户看到 0.5 实际被扣 0.7
  'remove-bg': { paid: true, units: 0.7, currency: 'ec_points', sku: 'ec_remove_bg', skus: ['ec_canvas_recognize', 'ec_remove_bg'] },
  'smart-remix': { paid: true, units: 1, currency: 'ec_points', sku: 'ec_image_2k' },
  inpaint: { paid: true, units: 1, currency: 'ec_points', sku: 'ec_image_2k' },
  retouch: { paid: true, units: 1, currency: 'ec_points', sku: 'ec_image_2k' },
  extend: { paid: true, units: 1, currency: 'ec_points', sku: 'ec_image_2k' },
  translate: { paid: true, units: 1, currency: 'ec_points', sku: 'ec_image_2k' },
  upscale: { paid: true, units: 1, currency: 'ec_points', sku: 'ec_image_2k' },
  'upscale-4k': { paid: true, units: 2, currency: 'ec_points', sku: 'ec_image_4k' },
  // 同上：智能分层 = 商品识别 0.2 + 分层 3 = 3.2
  'layer-edit': { paid: true, units: 3.2, currency: 'ec_points', sku: 'ec_smart_layer', skus: ['ec_canvas_recognize', 'ec_smart_layer'] },
  'pixel-layers': { paid: true, units: 3, currency: 'ec_points', sku: 'ec_layer_psd' },
  /* ═══ 2026-10-04：两个擦除档都改成**按次固定价**（用户原话：「这里应该固定一个费用呀，
     不管他框选哪里，还是他直接在视频的字幕进行智能去除，都应该是一个固定的费用才对吧」）
     —— 原来这两行都是按秒单价（`perSecond`），界面上那个"预计"随片子长短浮动，
     用户点之前不知道要花多少。

     · `video-desubtitle`（框选，本机 ffmpeg delogo，成本 0）⇒ **1 积分/次**。
       服务端那边 SKU 已经摘掉 `perSecond`，`billingQuantity` 变 'clip'，数量恒为 1 ——
       这里跟着去掉 `perSecond`，两处同形。
     · `video-desubtitle-auto`（智能，火山 MediaKit）⇒ **3 积分/次**，≤ 60 秒。
       这一档**不能**无脑平价：火山按累计擦除时长收我们 ¥0.4/分钟，目录允许到 300 秒，
       平价卖一条 300 秒的片子要亏 ¥1.5。所以封顶 60 秒（毛利 46.0%，过引流带 40% 地板，
       启动期由 `videoMarginGateReport` 的 flatMargin 一列断言），超出仍按 0.05 积分/秒。
     ⚠️ 这里的数字是**目录的镜像**：`server/billing/catalog.mjs` 那四行 SKU 才是真相。
        两者不一致时用户会看到"界面写 1 积分、实际扣 3"—— test/image-provider-fallback 那种
        门禁钉不住它，所以另有 test/canvas-erase-flat-price-1004 逐值比对两边。 */
  'video-desubtitle': {
    paid: true, units: 1, currency: 'ec_points',
    sku: 'video_desubtitle_local_short', skus: ['video_desubtitle_local_short', 'video_desubtitle_local_long'],
  },
  'video-desubtitle-auto': {
    paid: true, units: 3, currency: 'ec_points',
    sku: 'video_desubtitle_volc_short', skus: ['video_desubtitle_volc_short', 'video_desubtitle_volc_long'],
    /* 封顶秒数同样从服务端来（capabilities.quotes.*.flatMaxSeconds）；这里只作兜底文案。 */
    flatMaxSeconds: 60,
  },
  'psd-export': FREE,
});

/** 计价表里存在的动作键；注册表的 priceFeature 必须落在这里面（否则会静默回落成"免费"） */
export const CANVAS_BILLING_KEYS = Object.freeze(Object.keys(ACTIONS));

export function getCanvasActionBilling(actionId) {
  return { ...(ACTIONS[actionId] || FREE) };
}

/** 这一个动作**按次**要花多少积分 —— 就是服务端目录里那条 SKU 的面值。
 *
 * ⚠️ 2026-10-04 删掉了原来那个 `perSecond` / `unitsPerSecond` 分支。
 *    它 2026-10-02 加进来是为了修一个真事故：那时「去字幕」是按秒的（0.04 积分/秒），
 *    而这张表里所有动作的 `units` 语义都是**固定总价**，照抄就会把「0.04 积分/秒」
 *    显示成「40 积分」—— 差 1000 倍。
 *    ⇒ 现在**画布上再没有按秒的动作**了（两个擦除档都改成了按次固定价，
 *       见文件头），这条分支**永远走不到**。
 *    删掉它不是因为"以后用不上"，是因为留着它就会让人以为"画布计价表也能表达按秒" ——
 *    而按秒那件事的真身在服务端（`billableQuantity` + `localQuoteFor` + `flatMaxSeconds`）。
 *    这里再来一条按秒分支，就是**第二份真相**，改目录时不会跟着改，也没人会发现。
 *    要新增一个按秒动作时，价格从 `localQuoteFor(capability, seconds)` 出，别往这张表里塞。 */
export function formatCanvasActionPrice(actionId) {
  const billing = getCanvasActionBilling(actionId);
  if (billing.enabled === false) return billing.reason;
  if (!billing.paid) return '免费';
  return `${billing.units} 积分`;
}
