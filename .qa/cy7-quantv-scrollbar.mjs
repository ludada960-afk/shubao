/* 只读：知渔工作台左栏的**滚动条占不占宽度**（决定我们那 11px 要不要"照抄"改掉） */
import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
let page = ctx.pages().find(p => /image-creation\?tool=product-listing-set/.test(p.url()));
if (!page) {
  page = ctx.pages().find(p => /quantv\.com/.test(p.url())) || await ctx.newPage();
  await page.goto('https://laoyu.quantv.com/image-creation?tool=product-listing-set', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
}
const out = await page.evaluate(() => {
  /* 找"可纵向滚动"的容器：scrollHeight 明显大于 clientHeight 的那些 */
  const rows = [];
  document.querySelectorAll('div, section, main, aside').forEach(el => {
    const cs = getComputedStyle(el);
    if (!/auto|scroll/.test(cs.overflowY)) return;
    if (el.scrollHeight <= el.clientHeight + 4) return;
    const r = el.getBoundingClientRect();
    if (r.width < 220 || r.height < 200) return;
    rows.push({
      cls: String(el.className || '').slice(0, 40),
      box: { x: Math.round(r.x), w: Math.round(r.width) },
      bar: el.offsetWidth - el.clientWidth,
      scrollbarGutter: cs.scrollbarGutter || '(未设)',
      scrollbarWidth: cs.scrollbarWidth || '(未设)',
      padding: cs.paddingLeft + ' / ' + cs.paddingRight,
      scrollH: el.scrollHeight, clientH: el.clientHeight,
    });
  });
  rows.sort((a, b) => b.bar - a.bar);
  return rows.slice(0, 6);
});
console.log('知渔页面里"可纵向滚动"的容器（按占宽降序）：');
out.forEach(o => console.log('  ' + JSON.stringify(o.box).padEnd(28) + ' 滚动条占宽=' + String(o.bar).padStart(3) + 'px  gutter=' + o.scrollbarGutter.padEnd(9) +
  ' scrollbar-width=' + String(o.scrollbarWidth).padEnd(7) + ' padding=' + o.padding.padEnd(14) + ' ' + o.cls));
if (!out.length) console.log('  （没找到可滚容器 —— 页面可能还没进到工作台）');
await browser.close().catch(() => {});
