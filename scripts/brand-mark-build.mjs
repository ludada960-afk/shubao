/* ═══ 批 BD：重做品牌标（mark）═══════════════════════════════════════════════════════════════════
   为什么用脚本合成而不是继续用现成那张图：现成那张（logo.png / logo-icon.webp）是
   "奶油底 + 一圈**灰色描边**"的贴纸式方块 —— 那圈灰边正是"随手做的"观感来源之一，
   而且它是 457px 的位图，在 30px 上用浏览器缩放出四不像的圆角。
   这里自己画：**超椭圆感圆角（32%）+ 品牌淡底 + 1px 品牌内环 + 顶部高光 + 吉祥物放大到 78%**
   （吉祥物在贴纸式底板里只占 ~70%，四周留白过多 ⇒ 30px 下看着小气）。
   输出 3x（180px）一份，30px 显示时有 6 倍余量，任何 DPI 都不糊。 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = 'public/images/logo.png';   // 457×457，含 14px 透明外边距 + 灰描边底板
const OUT_DIR = 'public/images';
const SIZE = 180;                        // 3x of 60 / 6x of 30

/* ① 先 trim 掉透明外边距，再按比例内缩一点把那条**灰描边**一起切掉
   （⚠️ 不能用 cover 裁：cover 会把叶尖切掉 —— 第一版就是这么翻车的；
      改成 contain 等比缩放进方框，四边留一点透明，什么都不丢） */
const trimmed = await sharp(SRC).trim({ threshold: 5 }).toBuffer();
const meta = await sharp(trimmed).metadata();
const inset = Math.max(2, Math.round(meta.width * 0.02));
const inner = await sharp(trimmed)
  .extract({ left: inset, top: inset, width: meta.width - inset * 2, height: meta.height - inset * 2 })
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();

/* ② 圆角遮罩（32% ≈ squircle 的近似）+ 品牌内环。**不加顶部高光** —— 第一版那条白色 50% 的
   path 把上半张（叶子那一块）洗白了，等于把吉祥物弄脏了。 */
const r = Math.round(SIZE * 0.32);
const mask = Buffer.from(
  `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
     <rect x="0" y="0" width="${SIZE}" height="${SIZE}" rx="${r}" ry="${r}" fill="#fff"/>
   </svg>`,
);
const ring = Buffer.from(
  `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
     <rect x="0.75" y="0.75" width="${SIZE - 1.5}" height="${SIZE - 1.5}" rx="${r - 1}" ry="${r - 1}"
           fill="none" stroke="rgba(109,40,217,0.16)" stroke-width="1.5"/>
   </svg>`,
);

mkdirSync(OUT_DIR, { recursive: true });
await sharp(inner)
  .composite([
    { input: mask, blend: 'dest-in' },
    { input: ring, blend: 'over' },
  ])
  .png({ compressionLevel: 9 })
  .toFile(`${OUT_DIR}/brand-mark-3x.png`);

/* 顺便把 2x（60px）也出出来：给 30px 显示做 srcset，避免小屏拉大图 */
await sharp(`${OUT_DIR}/brand-mark-3x.png`).resize(120, 120).png({ compressionLevel: 9 }).toFile(`${OUT_DIR}/brand-mark-2x.png`);

console.log('写出 brand-mark-3x.png / brand-mark-2x.png');
