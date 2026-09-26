/* ═══ 批 BT 复验：滚动悬停守卫 ═══════════════════════════════════════════════════════════════════
   要证的三件事：
     ① 滚轮滚动时 <html> 会挂上 data-scrolling，停下后自动摘掉；
     ② 鼠标一动立刻摘掉（用户真的指向某颗按钮时，悬停必须马上可用）；
     ③ **挂上 data-scrolling 时，悬停在按钮上也不再出现悬停底色** —— 这正是"假悬停"的治法。
   （"滚动后旧元素仍保持 hover"是浏览器行为，Playwright 里没法真的制造光标错位；
     所以第 ③ 条用"人为挂属性 + 真实鼠标悬停"来验证规则本身。）
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
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
await page.waitForSelector('.media-field-segmented button', { timeout: 40000 });
await page.waitForTimeout(1200);

/* 把"比例"那一组滚进视口 */
const target = await page.evaluate(() => {
  const groups = Array.from(document.querySelectorAll('.media-field-segmented'));
  const index = groups.findIndex(group => /比例/.test(group.getAttribute('aria-label') || ''));
  const group = groups[index < 0 ? 0 : index];
  group.scrollIntoView({ block: 'center' });
  return index;
});
await page.waitForTimeout(600);

const first = await page.evaluate(index => {
  const groups = Array.from(document.querySelectorAll('.media-field-segmented'));
  const group = groups[index < 0 ? 0 : index];
  const button = group.querySelector('button');
  const r = button.getBoundingClientRect();
  return { text: (button.textContent || '').trim(), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
}, target);

const readFirst = () => page.evaluate(index => {
  const groups = Array.from(document.querySelectorAll('.media-field-segmented'));
  const button = groups[index < 0 ? 0 : index].querySelector('button');
  const cs = getComputedStyle(button);
  return { hovered: button.matches(':hover'), bg: cs.backgroundColor, border: cs.borderTopColor };
}, target);

/* ③ 悬停在第一颗上：正常态应当有悬停底色 */
await page.mouse.move(first.x, first.y, { steps: 4 });
await page.waitForTimeout(350);
const normalHover = await readFirst();

/* 人为挂上"滚动中"再读一次（鼠标仍停在按钮上） */
await page.evaluate(() => document.documentElement.setAttribute('data-scrolling', '1'));
await page.waitForTimeout(300);
const duringScroll = await readFirst();
await page.evaluate(() => document.documentElement.removeAttribute('data-scrolling'));
await page.waitForTimeout(300);
const afterRestore = await readFirst();

/* ①② 真滚一下：看属性是否自动挂上/摘掉 */
await page.evaluate(() => {
  const left = document.querySelector('.media-workbench-left');
  if (left) left.scrollTop += 140;
  else window.scrollBy(0, 260);
});
await page.waitForTimeout(60);
const attrWhileScrolling = await page.evaluate(() => document.documentElement.getAttribute('data-scrolling'));
await page.waitForTimeout(400);
const attrAfterIdle = await page.evaluate(() => document.documentElement.getAttribute('data-scrolling'));

/* ②b 鼠标一动就摘掉 */
await page.evaluate(() => document.documentElement.setAttribute('data-scrolling', '1'));
await page.mouse.move(first.x + 3, first.y + 3, { steps: 2 });
await page.waitForTimeout(120);
const attrAfterMouseMove = await page.evaluate(() => document.documentElement.getAttribute('data-scrolling'));

console.log(JSON.stringify({
  first,
  normalHover,
  duringScroll,
  afterRestore,
  attrWhileScrolling,
  attrAfterIdle,
  attrAfterMouseMove,
}, null, 1));

await browser.close();
stopDevServer(server.proc, { owned: server.owned });
