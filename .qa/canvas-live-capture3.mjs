/* ═══ 批 CW 取证 3：知渔的**真编辑器**内部结构 + 刘颖AI 的灵感库 ═══════════════════════════════
   要回答的问题：① "集合工作流的页面"到底该在**画布外面**还是**画布里面**？
                ② 知渔的编辑器里有没有"换/挑模板"的入口？
   安全口径：只走导航（我的画布 → 打开某个画布 → 编辑器），**绝不点 生成/运行/解锁/支付**。
────────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const PORT = Number(process.env.SHUBO_CDP_PORT) > 0 ? Number(process.env.SHUBO_CDP_PORT) : 9333;
mkdirSync('.playwright-shots/cw', { recursive: true });
const browser = await chromium.connectOverCDP('http://127.0.0.1:' + PORT);
const ctx = browser.contexts()[0];
const scrub = t => String(t || '').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '<email>').replace(/\b1[3-9]\d{9}\b/g, '<phone>');

const INVENTORY = () => {
  const R = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const txt = el => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  const clickable = Array.from(document.querySelectorAll('button, [role="button"], a[href], [class*="node"]'))
    .map(el => ({ t: txt(el).slice(0, 36), r: R(el) })).filter(b => b.t && b.r.w > 8 && b.r.h > 8);
  return {
    url: location.href,
    title: document.title,
    bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 4000),
    counts: {
      clickable: clickable.length, canvas: document.querySelectorAll('canvas').length,
      reactFlow: document.querySelectorAll('[class*="react-flow"]').length,
      nodes: document.querySelectorAll('[class*="node"], [data-node-id]').length,
      toolbarButtons: document.querySelectorAll('[class*="toolbar"] button, [class*="Toolbar"] button').length,
      svgPaths: document.querySelectorAll('svg path').length,
    },
    clickable: clickable.slice(0, 70),
  };
};
const out = [];
const snap = async (page, label) => {
  const inv = await page.evaluate(INVENTORY);
  inv.label = label; inv.bodyText = scrub(inv.bodyText);
  inv.clickable = inv.clickable.map(b => ({ ...b, t: scrub(b.t) }));
  out.push(inv);
  console.log('\n===== ' + label + '  ' + inv.url);
  console.log('  计数：' + JSON.stringify(inv.counts));
  console.log('  可点元素：' + JSON.stringify(inv.clickable.slice(0, 45).map(b => b.t)));
  console.log('  正文：' + inv.bodyText.slice(0, 1200));
  await page.screenshot({ path: `.playwright-shots/cw/${label.replace(/[^\w\u4e00-\u9fa5]+/g, '_').slice(0, 30)}.png` }).catch(() => {});
  return inv;
};

/* ── ① 知渔：我的画布列表 → 打开第一个画布 → 真编辑器 ───────────────────────────────────── */
const qv = ctx.pages().find(p => /quantv\.com\/canvas/.test(p.url()));
if (qv) {
  await qv.bringToFront().catch(() => {});
  await qv.goto('https://laoyu.quantv.com/canvas?tab=projects', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await qv.waitForTimeout(4000);
  await snap(qv, '知渔_画布列表');
  /* 打开列表里第一个画布（点卡片本体，不是上面的「新建」） */
  const opened = await qv.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[class*="card"], [class*="project"], li, article'))
      .filter(el => /副本|未命名画布|趣味电视|水果小猫/.test(el.innerText || ''));
    const target = cards[cards.length - 1] || cards[0];
    if (!target) return false;
    target.click();
    return (target.innerText || '').slice(0, 20);
  });
  console.log('\n点了画布卡：' + opened);
  await qv.waitForTimeout(8000);
  await snap(qv, '知渔_真编辑器');
}

/* ── ② 刘颖AI：灵感库 ───────────────────────────────────────────────────────────────────── */
const ly = ctx.pages().find(p => /liuyingai\.cn/.test(p.url()));
if (ly) {
  await ly.bringToFront().catch(() => {});
  await ly.waitForTimeout(800);
  await ly.click('text=灵感库', { timeout: 8000 }).catch(e => console.log('点「灵感库」失败：' + String(e.message).slice(0, 70)));
  await ly.waitForTimeout(3000);
  await snap(ly, '刘颖AI_灵感库');
  await ly.click('text=工作流', { timeout: 5000 }).catch(() => {});
  await ly.waitForTimeout(2500);
  await snap(ly, '刘颖AI_工作流页_带缩略');
}

writeFileSync('docs/design/data/competitor-canvas-live-3.json', JSON.stringify({
  capturedAt: new Date().toISOString(),
  source: '用户本人登录态 Chromium（CDP 9333）只读实采；只走导航入口，未触发任何生成/解锁；敏感信息已脱敏',
  pages: out,
}, null, 1));
console.log('\n已写 docs/design/data/competitor-canvas-live-3.json（' + out.length + ' 页）');
await browser.close();
