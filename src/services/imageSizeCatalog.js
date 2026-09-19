/* ═══ 图片「画面规格」的唯一真源（前端镜像，2026-09-19 批 J-⑪）══════════════════════════
   用户批注 #7-4：「你这些**尺寸的样式啊做的实在太差了**，你不能照抄他们的样子吗？
   他们会有**很多很多个尺寸的规格**可以给人选的，为什么你没有呢？**你只有这四个吗？**」

   为什么这张表要存在、而且必须与后端逐值一致：
   后端 server/ecommerceEngine/modelCatalog.mjs 的 LEGAL_IMAGE_SIZES 是**生成尺寸的权威** ——
   请求里给的比例只要不在表里，服务端**静默回落成 1:1**（见 resolveGenerationSize 第 129 行）。
   也就是说：UI 多给一个选项 = 用户选 21:9、拿到 1:1，而且没有任何提示。
   所以 UI 能给的**恰好就是这张表的键**，一个不多、一个不少；
   跨端一致性由 test/image-size-catalog-parity.test.mjs 逐值比对（两份表不可能各自漂移）。

   ⚠️ 不在前端写第二套"常见比例"清单：能选的就是能生成的。 */

/* ═══ 2026-09-19 批 O-⑦：新增 2:3 / 3:2（与服务端 modelCatalog.mjs **逐值镜像**）═════════
   依据：知渔图片侧每个 app 的 ratio 是 7 档（1:1方图 / 2:3竖版长图 / 3:2横版摄影 / 3:4竖版海报 /
   4:3横版主图 / 9:16手机竖屏 / 16:9手机横屏），我们原来缺 2:3 与 3:2。
   两份表的一致性由 test/image-size-catalog-parity.test.mjs 逐值比对 —— 不能各自漂移。 */
export const LEGAL_IMAGE_SIZES = Object.freeze({
  '1K': Object.freeze({
    '1:1': '1024x1024', '3:4': '768x1024', '4:3': '1024x768',
    '9:16': '576x1024', '16:9': '1024x576', '21:9': '1008x432',
    '2:3': '672x1008', '3:2': '1008x672',
  }),
  '2K': Object.freeze({
    '1:1': '2048x2048', '3:4': '1536x2048', '4:3': '2048x1536',
    '9:16': '1152x2048', '16:9': '2048x1152', '21:9': '2048x864',
    '2:3': '1344x2016', '3:2': '2016x1344',
  }),
  '4K': Object.freeze({
    '1:1': '2880x2880', '3:4': '2448x3264', '4:3': '3264x2448',
    '9:16': '2160x3840', '16:9': '3840x2160', '21:9': '3584x1536',
    '2:3': '2304x3456', '3:2': '3456x2304',
  }),
});

/** 全部合法比例（三档分辨率支持的是同一组六档，取自 2K 这一档的键）。 */
export const IMAGE_RATIOS = Object.freeze(Object.keys(LEGAL_IMAGE_SIZES['2K']));

function normalizeResolution(resolution) {
  const key = String(resolution || '').trim().toUpperCase();
  return Object.hasOwn(LEGAL_IMAGE_SIZES, key) ? key : '2K';
}

/** 这一档分辨率下、这个比例的真实像素尺寸（例如 2K + 16:9 → '2048x1152'）；不合法返回 ''。 */
export function imageSizeOf(resolution, ratio) {
  return LEGAL_IMAGE_SIZES[normalizeResolution(resolution)][ratio] || '';
}

/** 给用户看的像素标签（乘号用 ×，不是 x —— 屏幕上 'x' 会被读成字母）。 */
export function imagePixelLabel(resolution, ratio) {
  const size = imageSizeOf(resolution, ratio);
  return size ? size.replace('x', '×') : '';
}
