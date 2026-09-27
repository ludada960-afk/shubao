/* ═══ 批 CU 续：四个生成框（图片/文案/视频/套图）的按钮区适配都要查 ═══════════════════════════
   用户原话（逐字）：「可能不止电商套图有存在这个问题，其他的区域应该也有存在这些问题，
   像**生成文案啊，生成图片啊，生成视频**啊，他们那边应该也有这些类似的问题存在，
   那你都得去把他们给解决掉。」
   做法：先用左侧「+」添加菜单把每个框建出来（列出菜单项以便核对），
        再把创作台面板强制成 6 档宽度，逐档量「行 scrollWidth / 子元素右缘 vs 面板右缘」。
   用法：node .qa/cu-adapt-all.mjs
────────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const UPLOAD_FILE = 'public/gallery/ecommerce/baby-bottle-product-suite/01.webp';
const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('PAGEERR ' + String(e.message).slice(0, 180)));
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  return json({ ok: true, items: [], draft: null });
});
await page.goto(base + '/ec-canvas?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000);

/* 左侧「+」添加菜单：先看看它有什么 */
await page.click('.ec-canvas-left-rail button, .ec-canvas-left-rail [role="button"]').catch(() => {});
await page.waitForTimeout(700);
const addMenu = await page.evaluate(() => Array.from(document.querySelectorAll('.ec-canvas-add-menu button, [class*="add-menu"] button')).map(b => (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 20)));
console.log('左侧 + 菜单项：' + JSON.stringify(addMenu));

/* 上传素材（派生菜单需要来源） */
for (const input of await page.$$('input[type=file]')) {
  const accept = (await input.getAttribute('accept')) || '';
  if (/video/.test(accept)) continue;
  await input.setInputFiles(UPLOAD_FILE).catch(() => {});
  break;
}
await page.waitForTimeout(2200);

const measure = width => page.evaluate(width => {
  const host = document.querySelector('.ec-canvas-node-composer, .ec-canvas-context-composer');
  if (!host) return { err: '没有创作台面板' };
  host.style.width = width + 'px';
  host.style.maxWidth = width + 'px';
  const hb = host.getBoundingClientRect();
  const rows = Array.from(host.children).map(el => {
    const r = el.getBoundingClientRect();
    return { cls: String(el.className).split(' ').slice(0, 2).join('.'), right: Math.round(r.right), scrollW: el.scrollWidth, clientW: el.clientWidth };
  });
  const deep = [];
  for (const el of host.querySelectorAll('.ec-canvas-suite-controls, .ec-canvas-composer-footer, .ec-canvas-parameter-controls, .ec-canvas-video-controls, .ec-canvas-suite-source-rows')) {
    const r = el.getBoundingClientRect();
    const kids = Array.from(el.children).map(k => k.getBoundingClientRect().right);
    if (!kids.length) continue;
    deep.push({ cls: String(el.className).split(' ').slice(0, 2).join('.'), over: Math.round(Math.max(...kids) - r.right), scrollOver: el.scrollWidth - el.clientWidth });
  }
  return { host: { w: Math.round(hb.width), kind: String(host.className).slice(0, 60) }, rows, deep };
}, width);

const checkOne = async label => {
  const first = await measure(620);
  if (first.err) { console.log('\n' + label + ' → ' + first.err); return; }
  console.log('\n===== ' + label + '  ' + first.host.kind);
  for (const w of [620, 540, 480, 435, 380, 320]) {
    const m = await measure(w);
    if (m.err) { console.log('  w=' + w + ' → ' + m.err); continue; }
    const bad = m.deep.filter(d => d.over > 1 || d.scrollOver > 1);
    console.log('  w=' + w + ' 面板内容宽 ' + m.host.w + '  越界行 ' + bad.length
      + (bad.length ? ' → ' + bad.map(d => d.cls + '(溢' + d.over + 'px/scroll+' + d.scrollOver + ')').join(' | ') : ''));
  }
};

/* ① 套图（派生菜单进） */
const hasMenu = await page.$('[data-derive-action="ecommerce-suite"]');
if (hasMenu) { await page.click('[data-derive-action="ecommerce-suite"]', { force: true }); await page.waitForTimeout(2200); await checkOne('电商套图'); }

/* ②③④ 图片 / 视频 / 文案：派生菜单里没有这三项，改从**左侧 + 添加菜单**建
   （菜单项实测：上传图片/上传视频/上传音频/从作品导入/从资产库选择/生成图片/生成文案/
     生成电商套图/生成视频/语音合成/智能字幕） */
const openAddMenu = async () => {
  await page.click('.ec-canvas-left-rail button, .ec-canvas-left-rail [role="button"]').catch(() => {});
  await page.waitForTimeout(600);
};
for (const [label, match] of [['图片生成', '生成图片'], ['生成文案', '生成文案'], ['生成视频', '生成视频']]) {
  await openAddMenu();
  const clicked = await page.evaluate(match => {
    const btns = Array.from(document.querySelectorAll('.ec-canvas-add-menu button, [class*="add-menu"] button'));
    const b = btns.find(x => (x.textContent || '').includes(match));
    if (!b) return false;
    b.click();
    return true;
  }, match);
  await page.waitForTimeout(2400);
  if (!clicked) { console.log('\n' + label + ' → 添加菜单里点不到「' + match + '」'); continue; }
  await checkOne(label);
}
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
