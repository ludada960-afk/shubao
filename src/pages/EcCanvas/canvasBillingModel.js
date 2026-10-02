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
  /* ═══ 2026-10-02：第一个**按秒计价**的画布动作（视频去字幕 / 本机 ffmpeg delogo）══════════════
     为什么单列一条、而不是照别的动作那样填个 `units` 就完事：

     这张表里所有动作的 `units` 都是**这个动作的固定总价**，
     `formatCanvasActionPrice` 直接渲染 `${units} 积分`。而去字幕在服务端是

         video_desubtitle_local_short / _long
           { units: 40, perSecond: true, priceFen: 4, ... }   // 0.04 积分/秒

     数量 = 秒数（`billableQuantity`）。所以：
       · 把它填成 `units: 40` ⇒ 按钮上会写「**40 积分**」，
         而 10 秒的片子真实只扣 0.4 积分 —— **差 100 倍**；
       · 而这张表原来**连"按秒"这个概念都没有**（`perSecond` 出现 0 次），
         按条的计价结构里根本没有"数量"这个位置能塞秒数。

     ⇒ 这里显式加 `perSecond`，让展示走「单价/秒」而不是「总价」。
     ⚠️ **但总价不能在这里算**：要按这条视频的实际时长挑 short/long 两档
        （≤8 秒走 short，超了走 long）并 × 秒数。
        那个计算**已经在** `videoStudioModel.localQuoteFor(product, seconds)` 里，
        由服务端 `capabilities` 派生的 product 驱动 —— **不在前端另写一份**，
        否则就是 catalog.mjs 注释里警告的"菜单与扣费各写一份就是『看着 0.5、扣的是 0.04』那类事故"。

     ⇒ 所以这里只声明「这一档按秒、单价是多少」，**不声明总价**；
        总价由 `localQuoteFor` 出，界面与 hold 用**同一个** quote（见 `desubtitleQuoteFor`）。 */
  'video-desubtitle': {
    paid: true, perSecond: true, unitsPerSecond: 0.04, currency: 'ec_points',
    sku: 'video_desubtitle_local_short', skus: ['video_desubtitle_local_short', 'video_desubtitle_local_long'],
  },
  'psd-export': FREE,
});

/** 计价表里存在的动作键；注册表的 priceFeature 必须落在这里面（否则会静默回落成"免费"） */
export const CANVAS_BILLING_KEYS = Object.freeze(Object.keys(ACTIONS));

export function getCanvasActionBilling(actionId) {
  return { ...(ACTIONS[actionId] || FREE) };
}

export function formatCanvasActionPrice(actionId) {
  const billing = getCanvasActionBilling(actionId);
  if (billing.enabled === false) return billing.reason;
  if (!billing.paid) return '免费';
  /* ⚠️ 按秒的档**不能**渲染成总价：那会把 0.04 积分/秒 显示成 "40 积分"（差 1000 倍）。
     这里只报单价；总价由 localQuoteFor 按这条素材的真实时长算（见文件头那段）。 */
  if (billing.perSecond) return `${billing.unitsPerSecond} 积分/秒`;
  return `${billing.units} 积分`;
}

/** 这一档是不是「按秒计价」。注册表用它决定要不要给按钮动态报价。 */
export function isPerSecondAction(actionId) {
  return Boolean(getCanvasActionBilling(actionId).perSecond);
}
