/* ═══ 批 CY-⑬ 探针（**只量不改**）：全站生成面板的「参数按钮行」现状盘点 ═════════════════════════════
   用户原话（逐字，图片批注第 2 条）：
   「然后你这几块按钮**明明可以合成一块按钮**啊。什么**尺寸，清晰度，数量**这些都是可以放在同一个
     **生成配置**里面去呀。你为什么没有把这些问题都考虑清楚呢？然后我说的只是其中一个部分，我觉得
     你应该**全局都要去查看一下**，肯定有很多这种生成面板，他们的配置这里都是存在同等问题的。
     你要全部去考虑明白，然后全部去重新规划，重新设计。」

   量什么（每颗按钮四件事，正是"看起来不齐"的四个来源）：
     ① 标签（aria-label 或文案）
     ② 宽 × 高 —— **模型选择按钮太小**是用户点名的（CY-⑫ 已把槽位 75→132，这里复核）
     ③ **有没有向下的箭头**（用户原话：「其他的按钮，它后面不是有一个箭头的符号吗？那你这里为什么
        没有符号呢？」）—— 有 chevron 的记 ✓
     ④ 有没有**标题行**（首页是「小标题 + 摘要值」两行：`.visual-config-trigger-copy > small+strong`）
     —— 这一条是本批的判据核心：合并后的「生成配置」应当是**两行摘要**触发器。
   另外量整行：几颗按钮、总宽、有没有超出容器。

   用法：node .qa/cy13-param-row-audit.mjs
   ─────────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const ROW_SELECTORS = [
  '.ec-canvas-parameter-controls',
  '.ec-canvas-video-controls',
  '.ec-canvas-suite-controls',
  '.visual-config-cluster',
  '.video-config-cluster',
  '.xhs-template-tools',
];

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
  if (path === '/api/video/capabilities') return json({ ok: true, items: [], draft: null });
  return json({ ok: true, items: [], draft: null });
});

/** 把一个参数行摊成可读的一行行文本。 */
const dumpRow = label => page.evaluate(({ label, ROW_SELECTORS }) => {
  const out = [];
  for (const sel of ROW_SELECTORS) {
    for (const row of document.querySelectorAll(sel)) {
      const buttons = Array.from(row.querySelectorAll(':scope > *, :scope > label')).map(item => {
        const btn = item.matches('button') ? item : item.querySelector('button, select');
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        const hasChevron = Boolean(btn.querySelector('svg.lucide-chevron-down, svg[class*="chevron"], .visual-config-trigger-chevron'));
        const copy = btn.querySelector('.visual-config-trigger-copy, .ec-canvas-config-trigger-copy, .ec-canvas-parameter-item-copy');
        const twoLine = Boolean(copy && copy.querySelector('small') && copy.querySelector('strong'));
        return {
          label: btn.getAttribute('aria-label') || (btn.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24),
          w: Math.round(r.width),
          h: Math.round(r.height),
          chevron: hasChevron,
          twoLine,
          tag: btn.tagName.toLowerCase(),
        };
      }).filter(Boolean);
      if (!buttons.length) continue;
      const rr = row.getBoundingClientRect();
      out.push({
        label,
        row: sel,
        rowW: Math.round(rr.width),
        rowScrollOver: row.scrollWidth - row.clientWidth,
        buttons,
      });
    }
  }
  return out;
}, { label, ROW_SELECTORS });

const show = rows => {
  for (const r of rows) {
    console.log(`\n  【${r.label}】${r.row}  行宽 ${r.rowW}px${r.rowScrollOver > 1 ? `  ⚠️ 横向溢出 ${r.rowScrollOver}px` : ''}  ${r.buttons.length} 颗：`);
    for (const b of r.buttons) {
      const flags = [b.chevron ? '箭头✓' : '箭头✗', b.twoLine ? '两行摘要✓' : '两行摘要✗', b.tag === 'select' ? '原生select' : ''].filter(Boolean).join(' ');
      console.log(`     · ${String(b.w).padStart(4)}×${b.h}  ${String(b.label).padEnd(22)} ${flags}`);
    }
  }
};

/* ═══ 一、画布：四个生成框 ═══════════════════════════════════════════════════════════════════════ */
await page.goto(base + '/ec-canvas?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000);

const buildFromAddMenu = async match => {
  await page.click('.ec-canvas-left-rail button, .ec-canvas-left-rail [role="button"]').catch(() => {});
  await page.waitForTimeout(600);
  const ok = await page.evaluate(match => {
    const btns = Array.from(document.querySelectorAll('.ec-canvas-add-menu button, [class*="add-menu"] button'));
    const b = btns.find(x => (x.textContent || '').includes(match));
    if (!b) return false;
    b.click();
    return true;
  }, match);
  await page.waitForTimeout(2400);
  return ok;
};

console.log('════════ 画布：四个生成框 ════════');
for (const [name, match] of [['图片生成', '生成图片'], ['生成文案', '生成文案'], ['生成视频', '生成视频']]) {
  if (!(await buildFromAddMenu(match))) { console.log(`\n【${name}】添加菜单里点不到「${match}」`); continue; }
  show(await dumpRow(name));
}
/* 套图：走派生菜单（左侧 + 里也有「生成电商套图」） */
if (await buildFromAddMenu('生成电商套图')) show(await dumpRow('电商套图'));
else {
  await page.goto(base + '/ec-canvas?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  console.log('\n【电商套图】添加菜单里点不到，先看图片框是否还在');
}

/* ═══ 二、首页两个创作台（用户说"全局都要去查看一下"）══════════════════════════════════════════ */
console.log('\n\n════════ 首页：图片生成 / 视频生成 ════════');
await page.goto(base + '/?qa=home', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4500);
const homeRows = await dumpRow('首页');
if (!homeRows.length) {
  /* 首页默认可能是别的板块：把两个创作台都点一遍 */
  for (const tab of ['图片生成', '视频生成']) {
    await page.evaluate(tab => {
      const t = Array.from(document.querySelectorAll('button, [role="tab"], a')).find(x => (x.textContent || '').trim() === tab);
      t?.click();
    }, tab).catch(() => {});
    await page.waitForTimeout(2500);
    show(await dumpRow('首页 · ' + tab));
  }
} else show(homeRows);

await page.screenshot({ path: '.qa/shots/cy13-home.png', fullPage: false }).catch(() => {});
await browser.close();
await stopDevServer();
console.log('\n盘点结束（未改任何代码）。');
