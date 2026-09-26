/* 查：为什么真实滚动没有挂上 data-scrolling（守卫装了、规则也生效，就是属性没上）。 */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', error => console.log('PAGEERROR:', error.message));
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  return json({ ok: true });
});
await page.goto(server.base.replace(/\/$/, '') + '/image-creation?id=image.concept_set', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2000);

const result = await page.evaluate(async () => {
  const seen = [];
  const onScroll = event => seen.push({ target: event.target?.nodeName || 'window', phase: 'capture' });
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  /* ① 合成事件：验证监听器是否真的挂上了 */
  window.dispatchEvent(new Event('scroll'));
  const afterSynthetic = document.documentElement.getAttribute('data-scrolling');
  await new Promise(r => setTimeout(r, 400));
  /* ② 真滚：先看页面能不能滚 */
  const before = window.scrollY;
  window.scrollBy(0, 300);
  await new Promise(r => setTimeout(r, 120));
  const during = document.documentElement.getAttribute('data-scrolling');
  const afterY = window.scrollY;
  /* ③ 内层容器滚（左栏自己滚）：capture 能不能收到 */
  const left = document.querySelector('.media-workbench-left');
  if (left) left.scrollTop += 80;
  await new Promise(r => setTimeout(r, 120));
  const afterInner = document.documentElement.getAttribute('data-scrolling');
  window.removeEventListener('scroll', onScroll, { capture: true });
  return { afterSynthetic, canScroll: afterY !== before, scrollYFrom: before, scrollYTo: afterY, during, afterInner, seenCount: seen.length, seenTargets: [...new Set(seen.map(s => s.target))] };
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
