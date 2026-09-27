/* 批 CU 诊断 5：**逐个按钮**用 DOM 级 click 点一遍，记录 is-active 与 popover —— 定性到"哪几颗坏了" */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const UPLOAD_FILE = 'public/gallery/ecommerce/baby-bottle-product-suite/01.webp';
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

const count = async () => page.evaluate(() => ({
  pops: Array.from(document.querySelectorAll('[class*="popover"]')).map(el => String(el.className).slice(0, 46) + ' ' + Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height)),
  actives: Array.from(document.querySelectorAll('.ec-canvas-suite-controls button, .ec-canvas-suite-settings-control button'))
    .filter(b => b.classList.contains('is-active'))
    .map(b => (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 10)),
}));
const labels = await page.evaluate(() => Array.from(document.querySelectorAll('.ec-canvas-suite-controls button, .ec-canvas-suite-settings-control button'))
  .map(b => (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 12)));
console.log('按钮清单：' + JSON.stringify(labels));

for (let i = 0; i < labels.length; i += 1) {
  /* 每次都用**当前第 i 颗**（DOM 每次重新查，防止面板重排后索引错位） */
  const info = await page.evaluate(i => {
    const btns = Array.from(document.querySelectorAll('.ec-canvas-suite-controls button, .ec-canvas-suite-settings-control button'));
    const b = btns[i];
    if (!b) return null;
    b.click();
    return (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 12);
  }, i);
  await page.waitForTimeout(700);
  const c = await count();
  console.log(`  第 ${i} 颗「${info}」 → is-active=${JSON.stringify(c.actives)}  popover=${JSON.stringify(c.pops)}`);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(250);
}
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
