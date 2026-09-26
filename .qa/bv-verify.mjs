/* ═══ 批 BV 复验：① 选中态是品牌色、悬停只换底色、两组互不混淆；② 内容短时 CTA 仍贴栏底 ═══════════ */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  return json({ ok: true });
});

/* 用"地景 Logo 幻象"：字段少 ⇒ 左栏内容短，正好验 CTA 是否贴底 */
await page.goto(server.base.replace(/\/$/, '') + '/image-creation?id=image.remove_bg', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.media-workbench-submit', { timeout: 40000 });
await page.waitForTimeout(1500);
await page.mouse.move(2, 2);
await page.waitForTimeout(300);

const rest = await page.evaluate(() => {
  const left = document.querySelector('.media-workbench-left');
  const cta = document.querySelector('.media-workbench-cta');
  const first = document.querySelector('.media-field-segmented button');
  const active = document.querySelector('.media-field-segmented button.is-active');
  const cs = getComputedStyle(active || first);
  const lb = left.getBoundingClientRect();
  const cb = cta.getBoundingClientRect();
  return {
    activeText: active ? (active.textContent || '').trim() : '(无选中)',
    activeBg: cs.backgroundColor,
    activeBorder: cs.borderTopColor,
    activeRing: cs.boxShadow.slice(0, 44),
    leftBottom: Math.round(lb.bottom),
    ctaBottom: Math.round(cb.bottom),
    ctaGapToLeftBottom: Math.round(lb.bottom - cb.bottom),
    contentHeight: Math.round(left.scrollHeight),
    viewportHeight: Math.round(left.clientHeight),
  };
});

/* 悬停第二颗：应当**只换底色**（描边保持默认色），与选中态区分开 */
const second = await page.evaluate(() => {
  const b = document.querySelectorAll('.media-field-segmented button')[1].getBoundingClientRect();
  return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
});
await page.mouse.move(second.x, second.y, { steps: 4 });
await page.waitForTimeout(350);
const hoverState = await page.evaluate(() => {
  const b = document.querySelectorAll('.media-field-segmented button')[1];
  const cs = getComputedStyle(b);
  return { text: (b.textContent || '').trim(), bg: cs.backgroundColor, border: cs.borderTopColor, shadow: cs.boxShadow.slice(0, 30) };
});

console.log(JSON.stringify({ rest, hoverState }, null, 1));
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
