/* 守卫的"真实滚动"验证（换一个**肯定能滚**的页面：首页）。 */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer, gotoHealthy } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  return json({ ok: true });
});
await gotoHealthy(page, server.base, '.homepage-mode-card');
await page.waitForTimeout(800);

const out = await page.evaluate(async () => {
  const read = () => document.documentElement.getAttribute('data-scrolling');
  const before = { attr: read(), scrollY: window.scrollY, canScroll: document.documentElement.scrollHeight > window.innerHeight };
  window.scrollBy(0, 300);
  await new Promise(r => setTimeout(r, 80));
  const during = read();
  await new Promise(r => setTimeout(r, 400));
  const afterIdle = read();
  /* 手动挂上再动鼠标：应当立刻摘掉 */
  document.documentElement.setAttribute('data-scrolling', '1');
  const manual = read();
  window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
  await new Promise(r => setTimeout(r, 60));
  const afterMouse = read();
  return { before, during, afterIdle, manual, afterMouse, scrollYAfter: window.scrollY };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
