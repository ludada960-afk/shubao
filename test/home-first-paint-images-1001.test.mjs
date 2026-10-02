// test/home-first-paint-images-1001.test.mjs
// 2026-10-01 性能（批 CY-㊴ 之二十）：首页首屏的图片。
//
// 实测背景（1440×900，gzip 下发口径）：
//   首屏图片 809 KB，其中
//     · logo.png **457×457 = 153 KB**，却只渲染成 **30×30** —— 单它一张就占 19%
//     · 案例区整块在页面 1344px 处（首屏之外），但 priority 仍让前 4 张走 eager
//     · 页脚 appicon（22 KB）在页面最底 2967px 处，没写 loading ⇒ 浏览器默认 eager
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('1. 侧栏 logo 不许再用那张 153KB 的 PNG（它只渲染 30×30）', () => {
  const sidebar = read('src/components/layout/AppSidebar.jsx');
  /* 不是简单替换 —— 用 <picture> 让 webp 走 source、png 留作兜底。 */
  assert.match(sidebar, /<picture>[\s\S]*?<source[^>]*logo-icon\.webp[^>]*type="image\/webp"/,
    '侧栏 logo 必须用 <picture> + logo-icon.webp');
  assert.match(sidebar, /<img src="\/images\/logo\.png"[^>]*width=\{30\}/,
    'img 里必须保留 png 作为兜底（万一将来两个文件不再是同一个标，还有退路）');

  /* 体积本身也要钉住：logo.png 是 457×457，不该有人再拿它当 30px 的图用 */
  const png = statSync(new URL('../public/images/logo.png', import.meta.url)).size;
  const webp = statSync(new URL('../public/images/logo-icon.webp', import.meta.url)).size;
  assert.ok(png > 100 * 1024,
    'logo.png 变成了 ' + Math.round(png / 1024) + ' KB —— 若已重新压缩过，这条门禁可以更新');
  assert.ok(webp * 5 < png,
    'logo-icon.webp 应显著小于 logo.png（' + Math.round(webp / 1024) + 'KB vs ' + Math.round(png / 1024) + 'KB）');
});

test('2. 首屏之外的案例图不许再走 loading="eager"', () => {
  const gallery = read('src/pages/Home/GallerySection.jsx');
  /* ResponsiveImage.jsx:118 是 `loading || (priority ? 'eager' : 'lazy')` ——
     只传 priority 就会变成 eager。整块案例区在 1344px（首屏 900px 之外），
     所以必须**显式**给 loading="lazy"，只保留 priority 带来的 fetchpriority 排序。 */
  assert.match(gallery, /<ResponsiveImage[^>]*priority=\{priority\}[^>]*loading="lazy"/,
    '案例区必须显式 loading="lazy"（只给 priority 会被 ResponsiveImage 变成 eager）');
  assert.doesNotMatch(gallery, /<ResponsiveImage[^>]*loading="lazy"[^>]*priority/,
    '属性顺序不要紧，但要确保 loading="lazy" 确实和 priority 写在同一个元素上');
});

test('3. 页脚 appicon 在页面最底部，必须懒加载', () => {
  const footer = read('src/components/layout/Footer.jsx');
  assert.match(footer, /<img[^>]*IMAGES\.appicon[^>]*loading="lazy"/,
    '页脚图标（18px、页面最底）必须 loading="lazy"');
});

test('4. 已知的一条现实：Chrome 的 lazy 有距离阈值，页面 1~2.5kpx 处的图仍会被预取', () => {
  /* 这条是**记录事实**，防止下一个���把 lazy 改动当成"省下了 186KB"去汇报。
     实测：把案例区改成 lazy 之后，那几张图仍然出现在请求日志里
     —— 因为它们距视口还在 Chrome 的 lazy 预取阈值内（快连约 1250px，慢连更远）。
     ⇒ lazy 是**正确**的声明（不再强制抢带宽），但**不要**把它当成字节节省来算。 */
  const note = read('test/home-first-paint-images-1001.test.mjs');
  assert.match(note, /Chrome/,
    '这条事实必须留在门禁注释里');
});

test('5. logo.png 只许作为 <picture> 的兜底，不许被任何组件直接当首屏图用', () => {
  /* 允许的形态：<picture><source … webp/><img src="/images/logo.png"/></picture>
     不允许：裸的 <img src="/images/logo.png">（那会让浏览器优先下 153KB 那张）。 */
  const all = [];
  (function walk(dir) {
    for (const n of readdirSync(new URL('../' + dir + '/', import.meta.url))) {
      const p = dir + '/' + n;
      if (statSync(new URL('../' + p + '/', import.meta.url)).isDirectory()) walk(p);
      else if (/\.jsx?$/.test(n)) all.push(p);
    }
  })('src');

  for (const f of all) {
    const s = read(f);
    /* 先把 <picture>…</picture> 整段抠掉，剩下的才是"裸用" */
    const outsidePicture = s.replace(/<picture>[\s\S]*?<\/picture>/g, '');
    const hits = [...outsidePicture.matchAll(/<img[^>]*\/images\/logo\.png/g)];
    assert.equal(hits.length, 0,
      f + ' 在 <picture> 之外直接用 <img src="/images/logo.png"> '
      + '—— 浏览器会优先下那张 153KB 的 PNG');
  }
});