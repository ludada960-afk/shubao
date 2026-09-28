/* ═══ 批 CY-⑫ 探针：**从哪儿进来的，「返回」就退回哪儿**（用户当面纠正）═══════════════════════════════
   用户原话（逐字）：「我现在在图片生成和视频生成的任意一个子页面去点击进去访问之后，当我点击左上角的
     返回按钮之后，它出来好像一直都会出现在这两个总页面的**最上方**，这肯定是不对的呀。我在哪个页面
     点进去的？那我退出来，当然是在这个刚点击进去的时候的这个地方呀。」
   验三件事：
     ① 在 Hub 上滚到某处 → 点一张卡进子页面：子页面**从顶部开始**（这一条不能变）；
     ② 点「返回」：回到 Hub，且**滚动位置回到刚点进去时的那个地方**；
     ③ 深链（地址栏直接进子页面）没有"来的地方" ⇒ 返回后回顶部（与从前一致，不引入新怪癖）。
   用法：node .qa/cy12-hub-return-scroll.mjs
   ─────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERR ' + String(e.message).slice(0, 160)));
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = b => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  if (/skill/i.test(path)) return json({ ok: true, builtin: [], mine: [], groups: [], skills: [], items: [] });
  return json({ ok: true, items: [], draft: null, builtin: [], mine: [], groups: [], templates: [] });
});
await page.addInitScript(() => {
  const future = new Date(Date.now() + 3600 * 1000).toISOString();
  localStorage.setItem('sb-auth', JSON.stringify({ id: 'p@e.com', email: 'p@e.com', nickname: 'P', token: 't', expiresAt: future }));
});

const readScroll = () => page.evaluate(() => Math.round(window.scrollY || 0));

/* ① Hub 上滚到某处 → 点卡片进子页面 */
await page.goto(base + '/image-creation', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.media-hub', { timeout: 30000 });
await page.waitForTimeout(1200);
const scrollTarget = await page.evaluate(() => Math.min(900, Math.max(0, document.body.scrollHeight - window.innerHeight - 40)));
await page.evaluate(top => window.scrollTo({ top, behavior: 'auto' }), scrollTarget);
await page.waitForTimeout(500);
const hubBefore = await readScroll();
console.log('① Hub 滚到 ' + hubBefore + '（目标 ' + scrollTarget + '）');
/* ⚠️ 先确认 Hub 上真有可点的卡（第一版没确认，点了等于没点，后面的"回到原处"是空跑 ✓ 假绿）。 */
const hubCards = await page.evaluate(() => ({
  hits: document.querySelectorAll('.media-case-card-hit').length,
  cards: document.querySelectorAll('.media-case-card').length,
  first: (document.querySelector('.media-case-card-hit, .media-case-card')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30),
}));
console.log('   Hub 上的卡：.media-case-card-hit ' + hubCards.hits + ' 个 / .media-case-card ' + hubCards.cards + ' 个   第一张「' + hubCards.first + '」');
/* ⚠️ 不能直接用 Playwright 的 `page.click`：它会**先把元素滚进视口** —— 第一张卡在页面顶部，
   于是页面被滚回 0，记下来的"来的时候的位置"就是 0，后面那条"回到原处"永远是假绿（第一次就这么骗过了我）。
   ⇒ 挑一张**当前就在视口里**的卡，用**合成点击**（不滚动）点它。 */
const clicked = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('.media-hub .media-case-card-hit'));
  const inView = cards.find(el => { const r = el.getBoundingClientRect(); return r.top > 40 && r.bottom < window.innerHeight - 40; });
  if (!inView) return { ok: false, reason: '视口内没有卡' };
  inView.click();
  return { ok: true, scrollAtClick: Math.round(window.scrollY || 0) };
});
console.log('   点卡时页面在：' + JSON.stringify(clicked));
await page.waitForSelector('.media-workbench-submit, .media-hub', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);
const onSubpage = await page.evaluate(() => ({ url: location.pathname + location.search, scroll: Math.round(window.scrollY || 0), workbench: Boolean(document.querySelector('.media-workbench-submit')) }));
console.log('   进子页面：' + onSubpage.url + '  滚动=' + onSubpage.scroll + '（应为 0）');

/* ② 点「返回」 → 回到刚点进去时的那个地方 */
await page.click('.topbar-back').catch(async () => { await page.evaluate(() => document.querySelector('.topbar-back')?.click()); });
await page.waitForSelector('.media-hub', { timeout: 20000 }).catch(() => {});
/* ⚠️ 分时间点采样：区分"根本没恢复"与"恢复了、随后又被谁重置"（第一版只看了 1.2s 后的值，分不出）。 */
for (const ms of [80, 300, 800, 1600]) {
  await page.waitForTimeout(ms === 80 ? 80 : ms - (ms === 300 ? 80 : ms === 800 ? 300 : 800));
  const st = await page.evaluate(() => ({ y: Math.round(window.scrollY || 0), h: Math.round(document.documentElement.scrollHeight), vh: window.innerHeight, hub: Boolean(document.querySelector('.media-hub')) }));
  console.log('   +' + ms + 'ms 滚动=' + st.y + '  文档高=' + st.h + '  视口=' + st.vh + '  Hub=' + st.hub + (st.h - st.vh < 900 ? '  ⚠️ 装不下 900（会被裁）' : ''));
}
await page.waitForTimeout(400);
const back = await readScroll();
const hubAgain = await page.evaluate(() => Boolean(document.querySelector('.media-hub')));
console.log('② 返回后：在 Hub=' + hubAgain + '  滚动=' + back + '（期望回到 ' + hubBefore + '）');
console.log('   ⇒ 回到原处了吗：' + (hubAgain && Math.abs(back - hubBefore) <= 8 ? '是 ✓' : '⚠️ 否（差 ' + Math.abs(back - hubBefore) + 'px）'));

/* ③ 深链：直接进子页面再返回 → 回顶部（没有"来的地方"） */
await page.goto(base + '/image-creation?id=image.giant_product', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.media-workbench-submit', { timeout: 30000 });
await page.waitForTimeout(800);
await page.click('.topbar-back').catch(async () => { await page.evaluate(() => document.querySelector('.topbar-back')?.click()); });
await page.waitForSelector('.media-hub', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(900);
const deep = await readScroll();
console.log('③ 深链返回后：滚动=' + deep + '（期望 0）⇒ ' + (deep === 0 ? '是 ✓' : '⚠️ 不是 0'));

console.log('\n页面错误：' + (errors.length ? errors.join(' | ') : '无'));
await browser.close();
await stopDevServer(server.proc, { owned: true });
