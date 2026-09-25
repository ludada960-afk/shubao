/* 谁把 320px 页面撑到 351？列出 right 最大的 8 个元素（带父链，便于定位）。 */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'diag@example.com' });
  if (path === '/api/works') return json({ works: [] });
  return json({ ok: true });
});
await page.goto(server.base.replace(/\/$/, '') + '/image-creation?id=image.product_suite', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const report = await page.evaluate(() => {
  const doc = document.documentElement;
  const chain = node => {
    const out = [];
    let current = node;
    while (current && current !== document.body && out.length < 5) {
      out.push(String(current.className || current.tagName).slice(0, 34));
      current = current.parentElement;
    }
    return out.join(' < ');
  };
  const rows = [];
  for (const node of document.querySelectorAll('body *')) {
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.right <= doc.clientWidth + 0.5) continue;
    rows.push({ w: Math.round(rect.width), right: Math.round(rect.right), chain: chain(node) });
  }
  rows.sort((a, b) => b.right - a.right);
  return { clientWidth: doc.clientWidth, scrollWidth: doc.scrollWidth, rows: rows.slice(0, 8) };
});
console.log(JSON.stringify(report, null, 1));
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
