/* ═══ 批 BU 诊断：按**用户的实际视口**（截图 2560×1280 = CSS 1280×640、DPR 2）复现 ═══════════════
   用户第二次反馈：「我鼠标没放上去，只是放在这个区域而已，第一个按钮还是会亮啊」
   ⇒ 上一轮用 1600/1920 宽复现不出（那种宽度下卡片布局不一样）—— 这次严格按他的尺寸来：
      在"比例"那一组的外框内撒一圈采样点，每个点直接问浏览器"**哪几颗按钮 :hover 为真**"，
      并把第一颗按钮的矩形打出来（若它被拉大成覆盖整块，就一眼看得出来）。 */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 2 });
const page = await context.newPage();
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'probe@example.com' });
  if (path === '/api/works') return json({ works: [] });
  return json({ ok: true });
});
await page.goto(server.base.replace(/\/$/, '') + '/image-creation?id=image.concept_set', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.media-field-segmented button', { timeout: 40000 });
await page.waitForTimeout(1500);

/* 把"比例"那一组滚进视口再量 */
const info = await page.evaluate(() => {
  const groups = Array.from(document.querySelectorAll('.media-field-segmented'));
  const index = groups.findIndex(group => /比例/.test(group.getAttribute('aria-label') || ''));
  const group = groups[index < 0 ? 0 : index];
  group.scrollIntoView({ block: 'center' });
  const rect = group.getBoundingClientRect();
  const buttons = Array.from(group.querySelectorAll('button')).map((node, i) => {
    const r = node.getBoundingClientRect();
    const cs = getComputedStyle(node);
    return {
      i,
      text: (node.textContent || '').trim().slice(0, 10),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      position: cs.position,
      zIndex: cs.zIndex,
      display: cs.display,
    };
  });
  return {
    index,
    label: group.getAttribute('aria-label'),
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
    buttons,
  };
});
console.log('【组与按钮布局】', JSON.stringify(info, null, 1));

/* 在组的外框内撒 9 个点（含四角、边中、行间、右侧空白） */
const { x, y, w, h } = info.rect;
const points = [
  ['左上角内 4px', x + 4, y + 4],
  ['上边中部', Math.round(x + w / 2), y + 4],
  ['右上角内 4px', x + w - 4, y + 4],
  ['左边中部', x + 4, Math.round(y + h / 2)],
  ['正中', Math.round(x + w / 2), Math.round(y + h / 2)],
  ['右边中部', x + w - 4, Math.round(y + h / 2)],
  ['左下角内 4px', x + 4, y + h - 4],
  ['下边中部', Math.round(x + w / 2), y + h - 4],
  ['右下角内 4px', x + w - 4, y + h - 4],
];

for (const [name, px, py] of points) {
  await page.mouse.move(px, py, { steps: 3 });
  await page.waitForTimeout(220);
  const state = await page.evaluate(gi => {
    const group = document.querySelectorAll('.media-field-segmented')[gi];
    const buttons = Array.from(group.querySelectorAll('button'));
    const under = document.elementFromPoint(window.__px || 0, window.__py || 0);
    return {
      hovered: buttons.map((b, i) => (b.matches(':hover') ? i : -1)).filter(i => i >= 0),
      under: under ? (under.tagName + '.' + String(under.className || '').slice(0, 40)) : '',
    };
  }, info.index);
  console.log(`  ${name} @(${px},${py}) → :hover 命中按钮 = ${JSON.stringify(state.hovered)}`);
}

/* 最后：把光标放到"第一颗按钮的矩形之外、但仍在组内"的一个点，确认 under 是谁 */
const probe = await page.evaluate(gi => {
  const group = document.querySelectorAll('.media-field-segmented')[gi];
  const first = group.querySelector('button');
  const r = first.getBoundingClientRect();
  return { firstRect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
}, info.index);
console.log('【第一颗按钮矩形】', JSON.stringify(probe));

await browser.close();
stopDevServer(server.proc, { owned: server.owned });
