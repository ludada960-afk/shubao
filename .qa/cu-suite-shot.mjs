/* 批 CU 诊断 2：点「商品信息」前后各截一张图 + dump（看"点了没反应"到底是什么样子） */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const UPLOAD_FILE = 'public/gallery/ecommerce/baby-bottle-product-suite/01.webp';
mkdirSync('.playwright-shots/cu', { recursive: true });
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
  return json({ ok: true, items: [], draft: null });
});
await page.goto(base + '/ec-canvas?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000);
for (const input of await page.$$('input[type=file]')) {
  const accept = (await input.getAttribute('accept')) || '';
  if (/video/.test(accept)) continue;
  await input.setInputFiles(UPLOAD_FILE).catch(() => {});
  break;
}
await page.waitForTimeout(2500);
await page.click('[data-derive-action="ecommerce-suite"]', { force: true }).catch(() => {});
await page.waitForTimeout(2500);

const snap = async tag => {
  const info = await page.evaluate(() => {
    const composer = document.querySelector('.ec-canvas-suite-controls');
    const box = composer?.closest('[data-canvas-node-id]')?.getBoundingClientRect();
    const selectedNodes = Array.from(document.querySelectorAll('[data-canvas-node-id]'))
      .filter(el => /selected|is-selected/.test(el.className) || /2px solid/.test(getComputedStyle(el).border))
      .map(el => ({ id: el.getAttribute('data-canvas-node-id'), cls: String(el.className).slice(0, 40), border: getComputedStyle(el).borderTopWidth + ' ' + getComputedStyle(el).borderTopColor }));
    return {
      hasControls: !!composer,
      suiteControlsText: (composer?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90),
      selectedNodes,
      popovers: Array.from(document.querySelectorAll('[class*="popover"]')).map(el => ({ c: String(el.className).slice(0, 44), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) })),
      deriveMenu: !!document.querySelector('.ec-canvas-derive-menu'),
    };
  });
  console.log('\n### ' + tag + '\n' + JSON.stringify(info, null, 1));
  await page.screenshot({ path: `.playwright-shots/cu/${tag}.png` });
};

await snap('10-before');
const btn = await page.$('.ec-canvas-suite-controls button:has-text("商品信息")');
console.log('\n找到「商品信息」按钮：' + (btn ? '是' : '否'));
if (btn) {
  await btn.click({ force: true });
  await page.waitForTimeout(700);
  await snap('11-after-params-click');
}
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
