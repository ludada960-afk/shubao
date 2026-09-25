/* 把 public/images/brand-mark-*.png 转成内联数据模块（src/constants/brandMarkInline*.js）。
   改完品牌资产后跑一次：node scripts/brand-mark-inline.mjs
   ⚠️ 为什么不用构建期内联：Vite 只对 <4KB 的资源自动内联，我们是 18/31KB —— 超过阈值，
      必须显式转（这也是"LOGO 每次都在加载"的直接原因）。 */
import fs from 'node:fs';
const pairs = [
  ['public/images/brand-mark-3x.png', 'src/constants/brandMarkInline.js', 'BRAND_MARK_3X'],
  ['public/images/brand-mark-2x.png', 'src/constants/brandMarkInline2x.js', 'BRAND_MARK_2X'],
];
for (const [src, out, name] of pairs) {
  const bytes = fs.readFileSync(src);
  const uri = 'data:image/png;base64,' + bytes.toString('base64');
  fs.writeFileSync(out, '/* 自动生成（scripts/brand-mark-inline.mjs），勿手改 */\nexport const ' + name + " = '" + uri + "';\n");
  console.log(name + ': ' + (bytes.length / 1024).toFixed(1) + 'KB → ' + (uri.length / 1024).toFixed(1) + 'KB');
}
