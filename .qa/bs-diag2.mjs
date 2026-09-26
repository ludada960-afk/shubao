/* ═══ 批 BS 诊断：用户这两条批注各是什么根因 ═══════════════════════════════════════════════════
   ①「你这按钮为什么还是没按流影AI那个按钮规则去改呢，你这个样式依然没有渐变变化呀」
      → 量 CTA 的 computed background-image（静止 / 悬停两态），并找出**是哪条规则赢了**
        （本仓的老毛病：同名选择器多条，后一条赢）。
   ②「我鼠标只要停留在任意按钮区，你第一个按钮就会亮起来」
      → 在"比例"这一组上分别把鼠标停在「空白处 / 第 2 颗 / 第 4 颗」，记录**每颗按钮**的
        background / border / box-shadow，看是不是有规则让"组内第一颗"在**组 hover** 时亮。 */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'probe@example.com' });
  if (path === '/api/works') return json({ works: [] });
  return json({ ok: true });
});
await page.goto(server.base.replace(/\/$/, '') + '/image-creation?id=image.concept_set', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.media-workbench-submit', { timeout: 40000 });
await page.waitForTimeout(1500);

const readCta = () => page.evaluate(() => {
  const cta = document.querySelector('.media-workbench-submit');
  const cs = getComputedStyle(cta);
  return { backgroundImage: cs.backgroundImage, backgroundColor: cs.backgroundColor, boxShadow: cs.boxShadow, transform: cs.transform };
});
const rest = await readCta();
const box = await page.evaluate(() => {
  const cta = document.querySelector('.media-workbench-submit');
  const r = cta.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
});
await page.mouse.move(box.x, box.y, { steps: 6 });
await page.waitForTimeout(500);
const hover = await readCta();
await page.mouse.move(20, 20);

/* ② 比例那一组：三处位置分别读每颗按钮的样式 */
const groupInfo = await page.evaluate(() => {
  const group = document.querySelector('.media-field-segmented');
  if (!group) return null;
  const buttons = Array.from(group.querySelectorAll('button'));
  const r = group.getBoundingClientRect();
  return {
    count: buttons.length,
    groupRect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    // 组内两块之间的空隙（用前两颗的矩形算）
    gapX: buttons.length > 1
      ? Math.round(buttons[1].getBoundingClientRect().x - buttons[0].getBoundingClientRect().right)
      : null,
  };
});

const readButtons = () => page.evaluate(() => Array.from(document.querySelectorAll('.media-field-segmented button')).map((node, index) => {
  const cs = getComputedStyle(node);
  return {
    i: index,
    text: (node.textContent || '').trim().slice(0, 8),
    active: node.classList.contains('is-active'),
    bg: cs.backgroundColor,
    bgImage: cs.backgroundImage,
    border: cs.borderTopColor + '/' + cs.borderTopWidth,
    shadow: cs.boxShadow.slice(0, 40),
  };
}));

const before = await readButtons();
/* 停在组内"空隙"（若 gap 为 0 就停在最后一颗右边的组内空白） */
const gapPoint = await page.evaluate(() => {
  const group = document.querySelector('.media-field-segmented');
  const buttons = Array.from(group.querySelectorAll('button'));
  const last = buttons[buttons.length - 1].getBoundingClientRect();
  const groupRect = group.getBoundingClientRect();
  // 组内右侧空白（如果装得下）
  if (groupRect.right - last.right > 6) return { x: Math.round(last.right + 4), y: Math.round(last.y + last.height / 2) };
  // 否则两颗之间的缝
  const a = buttons[0].getBoundingClientRect();
  const b = buttons[1].getBoundingClientRect();
  return { x: Math.round((a.right + b.left) / 2), y: Math.round(a.y + a.height / 2) };
});
await page.mouse.move(gapPoint.x, gapPoint.y, { steps: 4 });
await page.waitForTimeout(400);
const onGap = await readButtons();

/* 停在第 2 颗上 */
const second = await page.evaluate(() => {
  const b = document.querySelectorAll('.media-field-segmented button')[1].getBoundingClientRect();
  return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
});
await page.mouse.move(second.x, second.y, { steps: 4 });
await page.waitForTimeout(400);
const onSecond = await readButtons();

/* 到底哪条规则给第一颗按钮上的样式？用 CSS.getMatchedStylesForNode 太绕，
   这里改成：把悬停态下"变了的那几颗"标出来就够定位。 */
const changed = (list) => list.filter((item, index) => JSON.stringify(item) !== JSON.stringify(before[index]));

console.log(JSON.stringify({
  beforeAll: before,
  cta: { rest, hover },
  group: groupInfo,
  gapPoint,
  second,
  changedOnGap: changed(onGap),
  changedOnSecond: changed(onSecond),
}, null, 1));

await browser.close();
stopDevServer(server.proc, { owned: server.owned });
