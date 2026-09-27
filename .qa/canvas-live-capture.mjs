/* ═══ 批 CW 取证：连上用户已登录的那个 Chromium（CDP 9333），**只读**抓两家画布的真实结构 ═══════════
   用户已登录并打开了页面（他原话：「知渔那边他的画布的页面首先就是一个全是工作流模板的样式。
   你需要进入到真正的画布的话，你就点上面的那个我的画布那个就可以进入到真正的画布里面去。
   然后你也可以任意的在他这个画布页面上 https://laoyu.quantv.com/canvas?tab=featured
   点击任意一个工作流也可以创建进入画布里面。这就是我说的两种方式」）。
   安全口径：**只读 + 只点模板卡/入口按钮**；绝不点任何「生成/立即生成/运行」这类会花钱的动作。
   产出：docs/design/data/competitor-canvas-live.json（已脱敏）+ 截图 .playwright-shots/cw/
   用法：node .qa/canvas-live-capture.mjs
────────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const PORT = Number(process.env.SHUBO_CDP_PORT) > 0 ? Number(process.env.SHUBO_CDP_PORT) : 9333;
mkdirSync('.playwright-shots/cw', { recursive: true });

const browser = await chromium.connectOverCDP('http://127.0.0.1:' + PORT);
const ctx = browser.contexts()[0];
console.log('已连上浏览器；当前标签页：' + ctx.pages().map(p => p.url().slice(0, 70)).join(' | '));

/* 脱敏：邮箱、手机号、token/邀请码一律不落盘（本项目铁律：不把凭据写进项目文件） */
const scrub = text => String(text || '')
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '<email>')
  .replace(/\b1[3-9]\d{9}\b/g, '<phone>')
  .replace(/\beyJ[\w-]{10,}\b/g, '<jwt>');

const PAGE_INVENTORY = () => {
  const R = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const txt = el => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const btns = Array.from(document.querySelectorAll('button, [role="button"], a[href]'))
    .map(el => ({ t: txt(el), tag: el.tagName.toLowerCase(), href: el.getAttribute('href') || '', r: R(el) }))
    .filter(b => b.t && b.r.w > 6 && b.r.h > 6);
  const tabs = Array.from(document.querySelectorAll('[role="tab"], [class*="tab"]'))
    .map(el => txt(el)).filter(t => t && t.length < 20);
  return {
    url: location.href,
    title: document.title,
    bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 3000),
    counts: {
      buttons: btns.length,
      cards: document.querySelectorAll('[class*="card"], [class*="Card"]').length,
      svgThumbs: document.querySelectorAll('svg').length,
      imgs: document.querySelectorAll('img').length,
      canvases: document.querySelectorAll('canvas').length,
      reactFlow: document.querySelectorAll('[class*="react-flow"], [class*="reactflow"]').length,
      nodes: document.querySelectorAll('[class*="node"], [data-node-id], [data-id]').length,
    },
    tabs: [...new Set(tabs)].slice(0, 20),
    buttons: btns.slice(0, 80),
  };
};

const out = [];
const shot = async (page, name) => { await page.screenshot({ path: `.playwright-shots/cw/${name}.png` }).catch(() => {}); };

/* ① 逐个把用户已经打开的、以及我们想看的页面找出来（能复用就复用，不新开多余标签） */
const wanted = [
  ['知渔 · 画布模板墙（?tab=featured）', /quantv\.com\/canvas/],
  ['知渔 · 我的画布（真正的画布）', /quantv\.com\/canvas\/editor|quantv\.com\/canvas\/[a-z0-9]/i],
  ['刘颖AI · 画布', /liuyingai\.cn/],
];
for (const [label, re] of wanted) {
  const page = ctx.pages().find(p => re.test(p.url()));
  if (!page) { console.log('（跳过，没找到已打开的页面）' + label); continue; }
  await page.bringToFront().catch(() => {});
  await page.waitForTimeout(2500);
  const inv = await page.evaluate(PAGE_INVENTORY);
  inv.label = label;
  inv.bodyText = scrub(inv.bodyText);
  inv.buttons = inv.buttons.map(b => ({ ...b, t: scrub(b.t) }));
  out.push(inv);
  console.log('\n===== ' + label + '  ' + inv.url);
  console.log('  计数：' + JSON.stringify(inv.counts));
  console.log('  页签：' + JSON.stringify(inv.tabs));
  console.log('  按钮前 25 个：' + JSON.stringify(inv.buttons.slice(0, 25).map(b => b.t + (b.href ? '(' + b.href.slice(0, 30) + ')' : ''))));
  console.log('  正文前 400 字：' + inv.bodyText.slice(0, 400));
  await shot(page, label.replace(/[^\w\u4e00-\u9fa5]+/g, '_').slice(0, 30));
}

writeFileSync('docs/design/data/competitor-canvas-live.json', JSON.stringify({
  capturedAt: new Date().toISOString(),
  source: '用户本人登录态的 Chromium（CDP 9333），只读实采；邮箱/手机/token 已脱敏',
  pages: out,
}, null, 1));
console.log('\n已写 docs/design/data/competitor-canvas-live.json（' + out.length + ' 页）');
await browser.close();   /* 只断开 CDP 连接，不关用户的浏览器 */
