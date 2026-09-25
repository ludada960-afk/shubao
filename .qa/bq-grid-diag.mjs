/* 干净版诊断：320px 下 /image-creation?id=image.product_suite 的栅格到底是什么。 */
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
  const roots = Array.from(document.querySelectorAll('.media-workbench')).map(node => {
    const cs = getComputedStyle(node);
    return {
      cls: node.className,
      grid: cs.gridTemplateColumns,
      width: Math.round(node.getBoundingClientRect().width),
      right: Math.round(node.getBoundingClientRect().right),
      parentCls: String(node.parentElement?.className || '').slice(0, 60),
      parentGrid: node.parentElement ? getComputedStyle(node.parentElement).gridTemplateColumns : '',
    };
  });
  return { clientWidth: doc.clientWidth, scrollWidth: doc.scrollWidth, roots };
});
console.log(JSON.stringify(report, null, 1));
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
