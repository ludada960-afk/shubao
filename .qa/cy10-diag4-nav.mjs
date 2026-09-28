/* 判别：刚生成完就用**侧边栏**去画布，会不会同样被弹回？（若是 ⇒ 与我这条接线无关，是 App 级竞态） */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';
const RESULT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const server = await startDevServer();
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = b => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  if (path === '/api/billing/quote') return json({ quote: { quoteId: 'q1', totalUnits: 1000, currency: 'ec_points' } });
  if (path === '/api/billing/balance') return json({ ok: true, currency: 'ec_points', balance: 999, unlimited: false, credits: 999 });
  if (path === '/api/billing/catalog') return json({ ok: true, products: [] });
  if (path === '/api/canvas/regenerate') return json({ url: RESULT, taskId: 't1', ratio: '1:1', resolution: '2K' });
  if (/skill/i.test(path)) return json({ ok: true, builtin: [], mine: [], groups: [], skills: [], items: [] });
  return json({ ok: true, items: [], draft: null, builtin: [], mine: [], groups: [], templates: [] });
});
await page.addInitScript(() => {
  const future = new Date(Date.now() + 3600 * 1000).toISOString();
  localStorage.setItem('sb-auth', JSON.stringify({ id: 'p@e.com', email: 'p@e.com', nickname: 'P', token: 't', expiresAt: future }));
});
await page.goto(base + '/image-creation?id=image.giant_product', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.media-workbench-submit', { timeout: 30000 });
await page.waitForTimeout(800);
await page.evaluate(() => {
  const input = document.querySelector('.media-field input[type="text"], .media-field input:not([type])');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '超大山竹');
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(500);
await page.evaluate(() => document.querySelector('.media-workbench-submit')?.click());
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"][aria-labelledby="app-dialog-title"]');
  const b = d ? [...d.querySelectorAll('button')].find(n => /确认生成/.test(n.textContent || '')) : null;
  if (b) b.click(); else document.querySelector('.media-workbench-submit')?.click();
});
await page.waitForFunction(() => document.querySelectorAll('.media-run-slot img').length > 0, null, { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(700);

/* 用**侧边栏**（App 自己的导航）去画布 —— 不等，紧接着点（复现"刚生成完就切页"） */
const clicked = await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll('a, button')).find(n => /无限画布/.test(n.textContent || ''));
  if (!el) return false;
  el.click();
  return true;
});
console.log('点了侧边栏「无限画布」：' + clicked);
for (const ms of [600, 1200, 2400, 4000]) {
  await page.waitForTimeout(ms === 600 ? 600 : ms - (ms === 1200 ? 600 : ms === 2400 ? 1200 : 2400));
  const st = await page.evaluate(() => ({
    canvas: Boolean(document.querySelector('.ec-canvas-topbar')),
    workbench: Boolean(document.querySelector('.media-workbench-submit')),
    url: location.pathname + location.search,
  }));
  console.log('  +' + ms + 'ms: ' + JSON.stringify(st));
}
await browser.close();
await stopDevServer(server.proc, { owned: true });
