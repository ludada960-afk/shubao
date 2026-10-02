// server/aigcVisibleLabel.mjs
// AIGC **显式标识**（画面提示标识）—— 2026-10-03
//
// 法条依据（逐字）：
//   《人工智能生成合成内容标识办法》（国信办通字〔2025〕2 号）第四条(二)：
//     「对于图片……在图片的**适当位置**添加**显著的**提示标识」；
//   第五条是**隐式标识**（文件元数据），由 server/aigcStamp.mjs 负责。
//   两者是**并列**义务，不是二选一 —— 只有元数据标识不满足第四条。
//
// ⚠️ 为什么显式标识必须**重编码**、而隐式标识不用：
//   隐式标识写进容器元数据，可以零重编码（PNG 插 chunk / WebP 升级 VP8X）。
//   显式标识要**画进像素**，没有零成本的做法。
//   ⇒ 顺序固定：**先画显式标识（重编码）→ 再写隐式标识（零重编码）**。
//      反过来做，画上去的角标会在写元数据时丢在解码器缓存里吗？不会，但顺序上
//      先重编码更省一次解码；更重要的是重编码后字节已定，再插 chunk 才对。
//
// ⚠️ 画质代价（如实说明，不要对外声称"无损"）：
//   · PNG  → sharp 的 png() 是**无损**的，只有 CPU 代价，没有画质损失。
//   · JPEG/WebP → 重编码是**有损**的。本站的 JPEG/WebP 出口本来就已经在
//     generatedAssets / 画布导出里各自编码过一次，这里是再一次。
//     默认参数偏保守（jpeg q92 / webp q90）以把损失压到最小。
//
// 设计取舍（为什么是角落小角标、而不是满屏平铺水印）：
//   《标识办法》要求"显著"，但本站的产物是**电商商品图**，用户要直接上传到
//   淘宝/天猫等平台 —— 而这些平台对**主图**有硬性要求（白底、无第三方水印）。
//   满屏平铺水印会让产物**直接违反平台规则**，用户拿到的是废图。
//   ⇒ 默认取「左下角胶囊角标」：显著可辨、不遮挡商品主体、不破坏白底。
//
// ⚠️ 已知限制（都是**实测**出来的，不是推测；样例见 scripts/p10-make-sample.mjs）
//
//   1. 【缩略图上文字不可读，但标识存在可辨 —— 这是可以接受的】
//      实测 1200×900 原图 → 300px 缩略图：
//        · 胶囊轮廓仍是完整闭合的亮环，四边对背景 4.6:1 ~ 6.9:1（过 WCAG 非文本 3:1）
//          ⇒「这里有个标识」这个感知成立；
//        · 但「AI 生成」里两个汉字在缩略图上每个只有 ~4px 宽，糊成一团。
//      试过把角标放大（比例 0.045→0.055、上限 48→64）**没有解决** ——
//      这是**笔画密度 vs 降采样**的问题，不是尺寸问题。要让中文在 300px 下可读，
//      角标得做到 ~210px 宽（占画幅 17.5%），那才会真伤到商品图。
//      ⇒ 结论：不追这个。平台生成的缩略图是下游衍生物，不是我们交付的资产；
//         我们交付的带标识原图合规即可。不要对外声称「缩略图上文字可读」。
//
//   2. 【1:1 居中裁切会切掉角标 —— 需要产品决策，未擅自更改】
//      实测：1200×900 裁成 900×900（保留 x 150~1050），左下角标只剩 **7px / 133px**。
//      若平台按 1:1 居中裁切，标识基本消失。
//      三个选项（**都需要产品/法务拍板，本次没动**）：
//        a. 维持左下角 —— 交付给用户的资产是合规的，被平台裁切属下游行为；
//        b. 改到**底部居中** —— 能扛住居中裁切，但更挡视觉、也更像平台促销标；
//        c. 角落打两次 —— 抗裁切，但两处都有标识，观感更差。
//      换位置只需改 aigcLabelConfig.mjs 的 DEFAULT_LABEL_POSITION。
//
//   3. 深色画面上胶囊读成「亮描边空心胶囊」而非实心块（填充 0.89 不透明压近黑底
//      仍≈17）。视觉上成立，且这正是描边要的效果 —— 但要知道性质变了。

import { PRODUCER_LABEL, DEFAULT_LABEL_POSITION } from './aigcLabelConfig.mjs';

/* 尺寸是按**缩略图还能认出来**定的，不是按原图看着舒服定的。
   实测（1200×900 原图 + 缩到 300px 宽的信息流缩略图）：
     比例 0.045 / 上限 48 → 缩略图上角标只剩 ~27px 宽、字高 ~5px，基本读不出来。
   《标识办法》第四条要求的是「**显著**的」提示标识 —— 原图 1:1 看得清不算达标，
   用户真正大量浏览的场景是缩略图。所以按比例放大到 0.055、上限提到 64。
   （再大就压画面了，而且电商主图要过平台审核，见下方取舍说明。） */
const MIN_BADGE_HEIGHT = 22;
const MAX_BADGE_HEIGHT = 64;
const BADGE_HEIGHT_RATIO = 0.055;

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/* 角标配色。
   ⚠️ 这里踩过一个坑：原来胶囊是 `rgba(17,17,17,0.62)` 半透明黑。**在深色画面上它
   根本不分离** —— 实测深色底上胶囊与背景的对比度只有 1.03:1（深色块上 1.008:1），
   等于角标隐形，只剩白字飘在那儿，看着像渲染坏了而不是标识。
   半透明方案在**两种底色上不可能同时成立**。改成：
     · 近乎不透明的深色填充（0.88）—— 白底上压得住；
     · **一圈亮描边** —— 深色底上靠这条边把胶囊轮廓"画"出来。
   描边是与底色无关的兜底：底再暗，轮廓也还在。 */
const CAPSULE_FILL = 'rgba(17,17,17,0.88)';
const CAPSULE_STROKE = 'rgba(255,255,255,0.92)';
const CAPSULE_STROKE_WIDTH_RATIO = 0.055;

/**
 * 角标的几何 —— **单一真源**，applyVisibleLabel 与测试都从这里取。
 * 之前把这段算术写了两份且公式不一致，导致按一个宽度摆位置、按另一个宽度画 SVG，
 * 角标整体偏出画布（测试抓到 bottom-right 不对）。
 *
 * 导出是为了让测试能**精确探测像素**。之前测试靠猜坐标，结果漏掉了「胶囊在深色底上
 * 隐形」这个真 bug：断言只量到了白字（很亮）就通过了，根本没量胶囊本身。
 */
export function badgeGeometry({ imageWidth, imageHeight, text = PRODUCER_LABEL, position = DEFAULT_LABEL_POSITION } = {}) {
  const badgeHeight = Math.min(
    MAX_BADGE_HEIGHT,
    Math.max(MIN_BADGE_HEIGHT, Math.round(imageHeight * BADGE_HEIGHT_RATIO)),
  );
  const margin = Math.max(6, Math.round(badgeHeight * 0.5));
  const fontSize = Math.max(12, Math.round(badgeHeight * 0.55));
  const padX = Math.round(badgeHeight * 0.45);
  const radius = Math.round(badgeHeight / 2);
  const charWidth = fontSize * 0.62; // 中文按全角估宽
  const boxWidth = Math.round(padX * 2 + charWidth * String(text).length);
  const boxHeight = Math.round(badgeHeight * 1.7);
  const { left, top } = badgeOrigin({ imageWidth, imageHeight, boxWidth, boxHeight, position, margin });
  return {
    badgeHeight, margin, fontSize, padX, radius, boxWidth, boxHeight, left, top,
    strokeWidth: Math.max(1.5, badgeHeight * CAPSULE_STROKE_WIDTH_RATIO),
  };
}

/** 角标 SVG。近乎不透明的深底 + 白字 + 亮描边（描边保证深色底上也看得见轮廓）。 */
function badgeSvg({ text, ...g }) {
  const { fontSize, radius, boxWidth, boxHeight, strokeWidth } = g;
  const half = strokeWidth / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${boxWidth}" height="${boxHeight}">
      <rect x="${half}" y="${half}" width="${boxWidth - strokeWidth}" height="${boxHeight - strokeWidth}"
            rx="${radius}" ry="${radius}" fill="${CAPSULE_FILL}" stroke="${CAPSULE_STROKE}"
            stroke-width="${strokeWidth}"/>
      <text x="${boxWidth / 2}" y="${boxHeight / 2}" fill="#ffffff"
            font-family="PingFang SC,Microsoft YaHei,Noto Sans CJK SC,sans-serif"
            font-size="${fontSize}" font-weight="600"
            text-anchor="middle" dominant-baseline="central">${xmlEscape(text)}</text>
    </svg>`,
    'utf8',
  );
}

/** 角标左上角坐标。position = 左下/左上/右下/右上。 */
function badgeOrigin({ imageWidth, imageHeight, boxWidth, boxHeight, position, margin }) {
  const left = position.endsWith('left') ? margin : imageWidth - boxWidth - margin;
  const top = position.startsWith('top') ? margin : imageHeight - boxHeight - margin;
  return { left: Math.max(0, Math.round(left)), top: Math.max(0, Math.round(top)) };
}

/**
 * 给图片加显式标识角标。
 *
 * @param {Buffer} buffer 原始字节
 * @param {{contentType?: string, sharp: Function, position?: string, text?: string, quality?: object}} options
 * @returns {Promise<Buffer>} 带角标的字节；**失败时原样返回**（标识失败不能阻断生成）
 */
export async function applyVisibleLabel(buffer, {
  contentType = 'image/png',
  sharp,
  position = DEFAULT_LABEL_POSITION,
  text = PRODUCER_LABEL,
  quality = {},
} = {}) {
  if (!sharp || !Buffer.isBuffer(buffer) || !buffer.length) return buffer;
  try {
    /* .rotate() 无参 = 按 EXIF 自动摆正。顺带把方向烧进像素，
       否则角标会画在「转正之前」的坐标上，跑到奇怪的位置。 */
    const base = sharp(buffer, { failOn: 'none' }).rotate();
    const meta = await base.metadata();
    const imageWidth = Number(meta.width) || 0;
    const imageHeight = Number(meta.height) || 0;
    if (!imageWidth || !imageHeight) return buffer;

    const geometry = badgeGeometry({ imageWidth, imageHeight, text, position });
    const svg = badgeSvg({ text, ...geometry });

    const composite = base.composite([{ input: svg, left: geometry.left, top: geometry.top }]);
    const out = /webp/i.test(contentType)
      ? await composite.webp({ quality: quality.webp ?? 90, effort: 5 }).toBuffer()
      : /jpe?g/i.test(contentType)
        ? await composite.jpeg({ quality: quality.jpeg ?? 92, mozjpeg: true }).toBuffer()
        : await composite.png({ compressionLevel: 9 }).toBuffer();
    return Buffer.isBuffer(out) && out.length ? out : buffer;
  } catch (error) {
    try {
      console.warn('[aigcVisibleLabel] 显式标识写入失败，返回原字节:', error?.message);
    } catch { /* ignore */ }
    return buffer;
  }
}

export const VISIBLE_LABEL_DEFAULTS = Object.freeze({
  position: DEFAULT_LABEL_POSITION,
  text: PRODUCER_LABEL,
  minHeight: MIN_BADGE_HEIGHT,
  maxHeight: MAX_BADGE_HEIGHT,
  heightRatio: BADGE_HEIGHT_RATIO,
});
