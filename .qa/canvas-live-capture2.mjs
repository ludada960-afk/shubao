/* ═══ 批 CW 取证 2：进两家的"真画布/工作流页"再抓一层（只读 + 只走免费入口）════════════════════
   用户原话：「你需要进入到真正的画布的话，你就点上面的那个**我的画布**那个就可以进入到真正的画布里面去。
   然后你也可以任意的在他这个画布页面上 … **点击任意一个工作流也可以创建进入画布里面**。
   这就是我说的两种方式，你自己帮我考虑一下，到底怎么做会更好？」
   安全口径（钱的铁律）：**绝不点**「解锁/立即生成/生成/运行/支付/购买」这类会花钱或跑上游的动作；
   走「我的画布」「工作流」这些**纯导航**入口，以及「免费解锁」筛出来的模板卡。
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
  const clickable = Array.from(document.querySelectorAll('button, [role="button"], a[href], [class*="card"]'))
    .map(el => ({ t: txt(el).slice(0, 40), href: el.getAttribute('href') || '', r: R(el) }))
    .filter(b => b.t && b.r.w > 6 && b.r.h > 6);
  return {
    url: location.href,
    title: document.title,
    bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 3500),
    counts: {
      clickable: clickable.length,
      cards: document.querySelectorAll('[class*="card"], [class*="Card"]').length,
      canvas: document.querySelectorAll('canvas').length,
      reactFlow: document.querySelectorAll('[class*="react-flow"], [class*="reactflow"]').length,
      flowNodes: document.querySelectorAll('.react-flow__node, [data-node-id], [class*="flow-node"]').length,
      svgLines: document.querySelectorAll('svg path, svg line').length,
    },
    clickable: clickable.slice(0, 60),
  };
};

const out = [];
const snap = async (page, label) => {
  const inv = await page.evaluate(INVENTORY);
  inv.label = label;
  inv.bodyText = scrub(inv.bodyText);
  inv.clickable = inv.clickable.map(b => ({ ...b, t: scrub(b.t) }));
  out.push(inv);
  console.log('\n===== ' + label + '  ' + inv.url);
  console.log('  计数：' + JSON.stringify(inv.counts));
  console.log('  可点元素前 30：' + JSON.stringify(inv.clickable.slice(0, 30).map(b => b.t)));
  console.log('  正文前 700 字：' + inv.bodyText.slice(0, 700));
  await page.screenshot({ path: `.playwright-shots/cw/${label.replace(/[^\w\u4e00-\u9fa5]+/g, '_').slice(0, 30)}.png` }).catch(() => {});
  return inv;
};

/* ── ① 知渔：点顶部「我的画布」进真画布 ───────────────────────────────────────────────────── */
const qv = ctx.pages().find(p => /quantv\.com\/canvas/.test(p.url()));
if (qv) {
  await qv.bringToFront().catch(() => {});
  await qv.waitForTimeout(1200);
  await qv.click('text=我的画布', { timeout: 8000 }).catch(e => console.log('点「我的画布」失败：' + String(e.message).slice(0, 80)));
  await qv.waitForTimeout(4000);
  await snap(qv, '知渔_我的画布_真画布');
}

/* ── ② 知渔：回到模板墙 → 筛「免费解锁」→ 点第一张卡（用户授权；免费档不花钱）────────────── */
if (qv) {
  await qv.goto('https://laoyu.quantv.com/canvas?tab=featured', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await qv.waitForTimeout(3500);
  await qv.click('text=免费解锁', { timeout: 8000 }).catch(e => console.log('点「免费解锁」筛选失败：' + String(e.message).slice(0, 80)));
  await qv.waitForTimeout(2500);
  const before = qv.url();
  const card = await qv.$('[class*="card"]:has-text("一键解锁同款"), [class*="card"]:has-text("免费")');
  console.log('\n模板墙筛选「免费解锁」后 URL 未变？' + (qv.url() === before));
  if (card) {
    await card.click({ timeout: 8000 }).catch(e => console.log('点模板卡失败：' + String(e.message).slice(0, 80)));
    await qv.waitForTimeout(5000);
    await snap(qv, '知渔_从免费模板进画布');
  } else {
    console.log('（没找到免费模板卡，跳过）');
  }
}

/* ── ③ 刘颖AI：点顶部「工作流」──────────────────────────────────────────────────────────── */
const ly = ctx.pages().find(p => /liuyingai\.cn/.test(p.url()));
if (ly) {
  await ly.bringToFront().catch(() => {});
  await ly.waitForTimeout(1000);
  await ly.click('text=工作流', { timeout: 8000 }).catch(e => console.log('点「工作流」失败：' + String(e.message).slice(0, 80)));
  await ly.waitForTimeout(4000);
  await snap(ly, '刘颖AI_工作流页');
}

writeFileSync('docs/design/data/competitor-canvas-live-2.json', JSON.stringify({
  capturedAt: new Date().toISOString(),
  source: '用户本人登录态 Chromium（CDP 9333）只读实采（只走免费/导航入口）；敏感信息已脱敏',
  pages: out,
}, null, 1));
console.log('\n已写 docs/design/data/competitor-canvas-live-2.json（' + out.length + ' 页）');
await browser.close();
