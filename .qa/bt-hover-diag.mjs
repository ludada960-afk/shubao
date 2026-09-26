/* ═══ 批 BT 诊断：用 `:hover` 匹配做权威判定（不再靠"样式有没有变"）═════════════════════════════
   用户批注：「我鼠标放在这块区域，他默认第一个按钮会有亮起来的交互，但是我鼠标明明没放在第一个按钮上呀」
   上一版探针在 1600 宽下量不出问题 ⇒ 这次：
     · 用用户截图的视口（1920×1000）；
     · 在"比例"那一组的**外框内**撒 12 个采样点（含行间缝隙、组内右侧空白、行的中间）；
     · 每个点直接问浏览器：**哪几颗按钮的 :hover 为真**（`:hover` 是权威，不看过渡/样式差异）。 */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1000 } });
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

const layout = await page.evaluate(() => {
  const groups = Array.from(document.querySelectorAll('.media-field-segmented'));
  return groups.map((group, gi) => {
    const rect = group.getBoundingClientRect();
    return {
      gi,
      label: group.getAttribute('aria-label') || '',
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      buttons: Array.from(group.querySelectorAll('button')).map((b, bi) => {
        const r = b.getBoundingClientRect();
        return { bi, text: (b.textContent || '').trim().slice(0, 10), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
      }),
    };
  });
});
console.log('【布局】', JSON.stringify(layout, null, 1));

/* 取"比例"那一组（label 里带「比例」） */
/* 目标组可能在视口外 ⇒ 先滚到视口中间，再**重新量**它的矩形（getBoundingClientRect 是视口坐标） */
let target = layout.find(item => /比例/.test(item.label)) || layout[0];
await page.evaluate(gi => {
  const group = document.querySelectorAll('.media-field-segmented')[gi];
  group.scrollIntoView({ block: 'center' });
}, target.gi);
await page.waitForTimeout(600);
target = await page.evaluate(gi => {
  const group = document.querySelectorAll('.media-field-segmented')[gi];
  const rect = group.getBoundingClientRect();
  return {
    gi,
    label: group.getAttribute('aria-label') || '',
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
    buttons: Array.from(group.querySelectorAll('button')).map((b, bi) => {
      const r = b.getBoundingClientRect();
      return { bi, text: (b.textContent || '').trim().slice(0, 10), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
    }),
  };
}, target.gi);
console.log('【目标组】', JSON.stringify(target));

const probes = [];
const { x, y, w, h } = target.rect;
const points = [
  { name: '组内左上角空白', px: x + 6, py: y + 6 },
  { name: '第一行行间缝隙(第1/2颗之间)', px: Math.round((target.buttons[0].rect.x + target.buttons[0].rect.w + target.buttons[1].rect.x) / 2), py: target.buttons[0].rect.y + 10 },
  { name: '第一行下方 4px（两行之间）', px: target.buttons[0].rect.x + 20, py: target.buttons[0].rect.y + target.buttons[0].rect.h + 4 },
  { name: '组内右侧空白(第一行)', px: x + w - 6, py: target.buttons[0].rect.y + 10 },
  { name: '第二行右侧空白', px: x + w - 6, py: target.buttons[target.buttons.length - 1].rect.y + 10 },
  { name: '组内底部空白', px: x + 20, py: y + h - 4 },
];

for (const point of points) {
  await page.mouse.move(point.px, point.py, { steps: 3 });
  await page.waitForTimeout(250);
  const hovered = await page.evaluate(gi => {
    const groups = Array.from(document.querySelectorAll('.media-field-segmented'));
    const group = groups[gi];
    const buttons = Array.from(group.querySelectorAll('button'));
    return {
      groupHover: group.matches(':hover'),
      hoveredButtons: buttons.filter(b => b.matches(':hover')).map(b => (b.textContent || '').trim().slice(0, 12)),
      firstHover: buttons[0] ? buttons[0].matches(':hover') : null,
    };
  }, target.gi);
  probes.push({ ...point, ...hovered });
}

console.log('【逐点 :hover 实况】');
for (const item of probes) {
  console.log(`  ${item.name} @(${item.px},${item.py}) → 组 hover=${item.groupHover} · 命中按钮=${JSON.stringify(item.hoveredButtons)}`);
}

await browser.close();
stopDevServer(server.proc, { owned: server.owned });
