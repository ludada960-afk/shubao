/* ═══ 批 BU 复验：三条触发路径（滚动 / 视口变化 / 文档尺寸变化）都要进抑制态，
   而且鼠标一动必须立刻恢复 ═══════════════════════════════════════════════════════════════════════ */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer, gotoHealthy } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'probe@example.com' });
  if (path === '/api/works') return json({ works: [] });
  return json({ ok: true });
});
await gotoHealthy(page, server.base, '.homepage-mode-card');
await page.waitForTimeout(900);

const read = () => page.evaluate(() => document.documentElement.getAttribute('data-scrolling'));

/* ① 滚动 */
await page.evaluate(() => window.scrollBy(0, 240));
await page.waitForTimeout(70);
const onScroll = await read();
await page.waitForTimeout(400);
const afterScroll = await read();

/* ② 视口变化 */
await page.setViewportSize({ width: 1280, height: 700 });
await page.waitForTimeout(70);
const onResize = await read();
await page.waitForTimeout(400);
const afterResize = await read();

/* ③ 文档尺寸变化（模拟"图片加载完 / 面板展开"把内容推到光标底下） */
await page.evaluate(() => {
  const spacer = document.createElement('div');
  spacer.id = 'bu-spacer';
  spacer.style.height = '40px';
  document.body.appendChild(spacer);   // 改文档高度 ⇒ ResizeObserver 应当触发
});
await page.waitForTimeout(90);
const onLayout = await read();
await page.waitForTimeout(400);
const afterLayout = await read();

/* ④ 鼠标一动立刻恢复 */
await page.evaluate(() => document.documentElement.setAttribute('data-scrolling', '1'));
const manual = await read();
await page.mouse.move(600, 300, { steps: 2 });
await page.waitForTimeout(90);
const afterMouse = await read();

console.log(JSON.stringify({ onScroll, afterScroll, onResize, afterResize, onLayout, afterLayout, manual, afterMouse }, null, 1));
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
