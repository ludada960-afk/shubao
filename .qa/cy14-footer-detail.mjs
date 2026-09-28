/* ═══ 批 CY-⑭ 探针 v3：底栏 4px 溢出的**逐子元素**归因 ═══════════════════════════════════════════════
   v2 已经排除了"画布缩放导致单位混算"这个假象（实测 zoom=1，四个生成框**每一个**都正好超出 4px）。
   4px 这种"四个框一模一样"的数字，指向的是**结构性**问题，不是内容宽度问题
   （四个框的内容行差别很大：258 / 258 / 0 / 0，CTA 宽度 95 / 103 / 69 / 130，溢出却都是 4）。
   ⇒ 这一版把底栏的**每个直接子元素**连同 rect / computed style 全量倒出来，找那 4px 是谁。

   用法：node .qa/cy14-footer-detail.mjs                                                      */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('PAGEERR ' + String(e.message).slice(0, 200)));
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  if (path === '/api/video/capabilities') return json({ ok: true, items: [], draft: null });
  return json({ ok: true, items: [], draft: null });
});
await page.goto(base + '/ec-canvas?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4500);

const ok = await page.evaluate(() => {
  document.querySelector('.ec-canvas-left-rail button, .ec-canvas-left-rail [role="button"]')?.click();
  return true;
});
await page.waitForTimeout(700);
await page.evaluate(() => {
  Array.from(document.querySelectorAll('.ec-canvas-add-menu button, [class*="add-menu"] button'))
    .find(x => (x.textContent || '').includes('生成图片'))?.click();
});
await page.waitForTimeout(2600);

const dump = await page.evaluate(() => {
  const composer = document.querySelector('.ec-canvas-node-composer');
  if (!composer) return { error: '没有 .ec-canvas-node-composer' };
  const ccs = getComputedStyle(composer);
  const footer = composer.querySelector('.ec-canvas-composer-footer');
  const fr = footer.getBoundingClientRect();
  const cs = getComputedStyle(footer);
  const children = Array.from(footer.children).map(el => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      cls: el.className,
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 16),
      left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width),
      marginLeft: s.marginLeft, marginRight: s.marginRight, flex: s.flex, order: s.order,
      position: s.position,
    };
  });
  return {
    composerClass: composer.className,
    composerRect: (() => { const r = composer.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) }; })(),
    composerOverflowX: ccs.overflowX,
    composerWidth: ccs.width,
    footer: {
      left: Math.round(fr.left), right: Math.round(fr.right), width: Math.round(fr.width),
      padL: cs.paddingLeft, padR: cs.paddingRight, borderR: cs.borderRightWidth,
      display: cs.display, flexWrap: cs.flexWrap, gap: cs.gap, overflowX: cs.overflowX, position: cs.position,
    },
    children,
  };
});

console.log(JSON.stringify(dump, null, 2));
await browser.close();
await stopDevServer();
