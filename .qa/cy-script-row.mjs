/* ═══ 批 CY 探针：① 生成脚本回到字段标题行右端（与图片侧那颗同位置同规格）② 首页不再有 CTA 提示行 ═══
   用户原话（逐字）：
   ①「你看你图片生成这边的**一键润色**的按钮是在**这个位置**。可是你视频生成那边的**生成脚本**那个按钮
     为什么不是在这个位置呢？我已经跟你强调过很多次了，他们是**同个等级**的东西呀。」
   ②「然后你按钮下面这个输入描述这个东西，你为什么要放在这里呢？他跟首页没有任何关系呀，首页不需要这个呀。
     首页这个视频生成的这个按钮这里你要**做回原来的样子**呀，不能加入这个东西，明白吗？」
   量什么：两页那颗行内动作按钮的 rect（相对各自标题行）、字号/字重/内边距/圆角/高度；以及两处是否挂着提示行。
   用法：node .qa/cy-script-row.mjs
────────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const errors = [];
const mock = async page => page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = b => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  if (path === '/api/video/capabilities') return json({ loading: false, generationEnabled: true, workbenchEnabled: false, directorUi: false, uploadMode: 'tus', products: [] });
  if (/skills/.test(path)) return json({ ok: true, builtin: [], mine: [], groups: [] });
  return json({ ok: true, items: [], draft: null, templates: [] });
});

/* 量「标题行 + 里面那颗行内动作」的几何 */
const readRow = (labelText) => `(() => {
  const labels = Array.from(document.querySelectorAll('.media-field-label'));
  const row = labels.find(el => (el.textContent || '').includes(${JSON.stringify(labelText)}));
  if (!row) return { found: false };
  const btn = row.querySelector('.media-workbench-inline-action');
  const wrap = row.querySelector('.media-field-inline-actions');
  const R = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; };
  const cs = btn ? getComputedStyle(btn) : null;
  return {
    found: true,
    row: R(row),
    wrap: wrap ? R(wrap) : null,
    btn: btn ? R(btn) : null,
    btnText: btn ? (btn.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 20) : '',
    font: cs ? Math.round(parseFloat(cs.fontSize) * 100) / 100 + '/' + cs.fontWeight : '',
    pad: cs ? cs.paddingLeft + ' ' + cs.paddingTop : '',
    radius: cs ? Math.round(parseFloat(cs.borderTopLeftRadius)) : 0,
    border: cs ? cs.borderTopWidth + ' ' + cs.borderTopColor : '',
  };
})()`;

const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', e => errors.push('PAGEERR ' + String(e.message).slice(0, 140)));
await mock(page);

/* ① 视频侧：脚本块的标题行 */
await page.goto(base + '/video-creation?id=video.smart', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4200);
const videoRow = await page.evaluate(readRow('脚本'));
console.log('① 视频侧「脚本」标题行：' + JSON.stringify(videoRow, null, 1));
const videoInlineCount = await page.evaluate(() => document.querySelectorAll('.video-wb-block .media-field-inline-action').length);
const videoFooterBtn = await page.evaluate(() => document.querySelectorAll('.video-script-trigger').length);
const videoHint = await page.evaluate(() => {
  const h = document.querySelector('.shubao-gen-cta-hint');
  return h ? (h.textContent || '').trim().slice(0, 20) : null;
});
console.log('   脚本块内的行内动作数=' + videoInlineCount + '；底栏旧的 .video-script-trigger=' + videoFooterBtn + '（应 0）');
console.log('   子页面 CTA 下方提示行=' + JSON.stringify(videoHint));

/* ② 图片侧：产品卖点的标题行（参照物） */
await page.goto(base + '/image-creation?id=image.product_suite', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4200);
const imageRow = await page.evaluate(readRow('产品卖点'));
console.log('\n② 图片侧「产品卖点」标题行：' + JSON.stringify(imageRow, null, 1));

/* ③ 两者逐值对比 */
if (videoRow.found && imageRow.found && videoRow.btn && imageRow.btn) {
  const same = (k) => videoRow[k] === imageRow[k] ? '✅ 同' : `❌ 不同（视频 ${videoRow[k]} / 图片 ${imageRow[k]}）`;
  console.log('\n③ 逐值对比（同等级同规格）：');
  console.log('   字号/字重 ' + same('font'));
  console.log('   内边距    ' + same('pad'));
  console.log('   圆角      ' + same('radius'));
  console.log('   描边      ' + same('border'));
  console.log('   按钮高度  视频 ' + videoRow.btn.h + ' / 图片 ' + imageRow.btn.h);
  /* 位置口径：按钮右缘与标题行右缘的距离（"贴着标题行右端"）应为 0 或极小 */
  const gapOf = row => row.row.right - row.btn.right;
  console.log(`   贴右端：视频 ${gapOf(videoRow)}px / 图片 ${gapOf(imageRow)}px（都应为 0 —— 按钮右缘=标题行右缘）`);
  console.log(`   与标题同高：视频 btn.y=${videoRow.btn.y} row.y=${videoRow.row.y}｜图片 btn.y=${imageRow.btn.y} row.y=${imageRow.row.y}`);
} else {
  console.log('\n⚠️ 有一侧没找到那颗按钮：video=' + videoRow.found + ' image=' + imageRow.found);
}

/* ④ 首页视频：CTA 下面不许再有提示行 */
await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.homepage-mode-card', { timeout: 45000 }).catch(() => {});
await page.click('.homepage-mode-card.card-1').catch(() => {});
await page.waitForTimeout(1200);
const homeHint = await page.evaluate(() => {
  const h = document.querySelector('.composer.is-home .shubao-gen-cta-hint, .video-composer.is-home .shubao-gen-cta-hint, .shubao-gen-cta-hint');
  return h ? (h.textContent || '').trim().slice(0, 20) : null;
});
const homeCta = await page.evaluate(() => document.querySelectorAll('.video-generate-trigger').length);
console.log('\n④ 首页·视频生成：CTA 个数=' + homeCta + '；CTA 下方提示行=' + JSON.stringify(homeHint) + '（应为 null）');

console.log('\n运行时错误：' + (errors.length ? JSON.stringify(errors.slice(0, 5)) : '无'));
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
