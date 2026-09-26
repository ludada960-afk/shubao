/* ═══ 批 BV 诊断：到底哪个状态让"每组第一颗按钮"常亮 ═════════════════════════════════════════════
   用户第三次反馈（逐字）：「我的鼠标没有放到这个按钮上，但是第一个按钮依然是会有这个**阴影**在…
   我放在其他地方的话，它第一个也是会亮着的…你现在好像工作台里面**所有的这些按钮区**都存在这个问题」
   ⇒ 这次不猜 hover 了：把每组每颗按钮的 **:hover / :focus / :focus-visible** 与计算样式（阴影、底色、描边）
      全量打出来，并读 document.activeElement —— 一眼分清"悬停"还是"聚焦"。 */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('pageerror', error => console.log('PAGEERROR:', error.message));
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  return json({ ok: true });
});

/* 用用户截图里的那一页：地景 Logo 幻象 */
await page.goto(server.base.replace(/\/$/, '') + '/image-creation?id=image.landscape_logo', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.media-field-segmented button', { timeout: 40000 });
await page.waitForTimeout(1500);

/* 鼠标停在"页面左上角之外"—— 确保没有任何悬停 */
await page.mouse.move(2, 2);
await page.waitForTimeout(400);

const dump = await page.evaluate(() => {
  const active = document.activeElement;
  const groups = Array.from(document.querySelectorAll('.media-field-segmented'));
  return {
    activeElement: active ? active.tagName + '.' + String(active.className || '') + '#' + (active.id || '') : '(none)',
    groups: groups.map((group, gi) => ({
      gi,
      label: group.getAttribute('aria-label'),
      buttons: Array.from(group.querySelectorAll('button')).map((node, bi) => {
        const cs = getComputedStyle(node);
        return {
          bi,
          text: (node.textContent || '').trim().slice(0, 8),
          hover: node.matches(':hover'),
          focus: node.matches(':focus'),
          focusVisible: node.matches(':focus-visible'),
          active: node.classList.contains('is-active'),
          shadow: cs.boxShadow === 'none' ? 'none' : cs.boxShadow.slice(0, 46),
          bg: cs.backgroundColor,
          border: cs.borderTopColor + ' / ' + cs.borderTopWidth,
        };
      }),
    })),
  };
});
console.log(JSON.stringify(dump, null, 1));
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
